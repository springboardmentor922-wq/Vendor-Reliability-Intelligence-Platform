from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import (
    get_db, get_current_user, require_roles_strict, require_roles,
    get_vendor_for_user
)
from app.models.user import User
from app.models.vendor import Vendor
from app.models.procurement import ProcurementRequest
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.vendor_selection import VendorSelection
from app.models.communication import AuditLog
from app.services.notification_service import send_notification, send_notification_async
from app.services.blockchain_service import record_blockchain_audit_async

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders & Fulfillment"])

class POItemPayload(BaseModel):
    item_name: str
    description: Optional[str] = None
    quantity: float
    unit_price: float
    sku: Optional[str] = None

class CreatePOCall(BaseModel):
    requisition_id: Optional[int] = None
    vendor_id: Optional[int] = None
    expected_delivery_date: datetime
    shipping_address: Optional[str] = "Central Logistics Terminal, Dock 4, Chicago, IL"
    terms_and_conditions: Optional[str] = "Standard Enterprise Terms (Net 30 Days). Strict SLA enforcement."
    items: Optional[List[POItemPayload]] = None
    auto_issue: Optional[bool] = False

class POStatusUpdatePayload(BaseModel):
    status: str
    actual_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None

class VendorDecisionPayload(BaseModel):
    rejection_reason: Optional[str] = None
    reason: Optional[str] = None

class VendorDispatchPayload(BaseModel):
    carrier: str
    tracking_number: str
    dispatch_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None

class PODeliveryUpdatePayload(BaseModel):
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    expected_delivery_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None
    delivery_status: Optional[str] = None

@router.get("/ready-for-po")
def get_requisitions_ready_for_po(
    db: Session = Depends(get_db),
    scm_user: User = Depends(require_roles(["Supply Chain Manager", "Administrator", "Procurement Manager", "Finance Officer"]))
):
    """
    Step 15: SCM views financially approved vendor selections ready for PO creation.
    """
    prs = db.query(ProcurementRequest).options(
        joinedload(ProcurementRequest.vendor_selections).joinedload(VendorSelection.vendor),
        joinedload(ProcurementRequest.financial_approvals),
        joinedload(ProcurementRequest.vendor),
        joinedload(ProcurementRequest.purchase_orders)
    ).filter(
        ProcurementRequest.status.in_(["READY_FOR_PO", "FINANCE_APPROVED", "Approved"])
    ).order_by(ProcurementRequest.id.desc()).all()

    result = []
    for p in prs:
        if p.purchase_orders and len(p.purchase_orders) > 0:
            continue
        approved_sels = [s for s in p.vendor_selections if s.status == "Approved"] if p.vendor_selections else []
        sel = approved_sels[-1] if approved_sels else (sorted(p.vendor_selections, key=lambda s: s.id)[-1] if p.vendor_selections else None)
        
        approved_fins = [f for f in p.financial_approvals if f.status == "Approved"] if p.financial_approvals else []
        fin = approved_fins[-1] if approved_fins else (sorted(p.financial_approvals, key=lambda f: f.id)[-1] if p.financial_approvals else None)

        v_obj = sel.vendor if (sel and sel.vendor) else p.vendor
        v_name = v_obj.name if v_obj else "Assigned Vendor"
        v_comp = v_obj.company if (v_obj and v_obj.company) else v_name
        
        quotation_amt = float(sel.quotation_amount) if (sel and sel.quotation_amount) else float(p.estimated_budget or 0.0)
        budget_amt = float(fin.budget_allocated) if (fin and fin.budget_allocated) else quotation_amt

        result.append({
            "requisition_id": p.id,
            "request_number": p.request_number,
            "department": p.department,
            "title": p.title,
            "quantity": p.quantity,
            "priority": p.priority,
            "vendor_id": sel.vendor_id if sel else (p.assigned_vendor_id or (v_obj.id if v_obj else None)),
            "vendor_name": v_name,
            "vendor_company": v_comp,
            "vendor": {
                "id": v_obj.id,
                "name": v_name,
                "company": v_comp,
                "category": v_obj.category
            } if v_obj else None,
            "quotation_amount": quotation_amt,
            "budget_allocated": budget_amt,
            "approval_date": fin.approved_at if fin else p.approval_date
        })
    return result

@router.post("", status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: CreatePOCall,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    scm_user: User = Depends(require_roles(["Supply Chain Manager", "Administrator"]))
):
    """
    Step 16 & 17: Supply Chain Manager creates Purchase Order.
    Can be created from a financially approved requisition or directly.
    Executes in a single atomic transaction; secondary notifications & blockchain run asynchronously.
    """
    pr = None
    vendor_id = payload.vendor_id
    total_amount = 0.0

    if payload.requisition_id:
        pr = db.query(ProcurementRequest).filter(ProcurementRequest.id == payload.requisition_id).first()
        if not pr:
            raise HTTPException(status_code=404, detail="Purchase Requisition not found")

        if pr.status not in ["READY_FOR_PO", "FINANCE_APPROVED", "Approved"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot create PO: Requisition must be in 'READY_FOR_PO' or 'Approved' state. Current state: '{pr.status}'."
            )

        # Use selected vendor from approved vendor selection
        sel = pr.vendor_selections[-1] if pr.vendor_selections else None
        vendor_id = sel.vendor_id if sel else pr.assigned_vendor_id

    if not vendor_id:
        raise HTTPException(status_code=400, detail="No vendor selected for this purchase order.")

    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Selected vendor not found.")

    count = db.query(PurchaseOrder).count() + 1
    po_number = f"PO-{datetime.utcnow().year}-{count:04d}"

    # Calculate total
    if payload.items and len(payload.items) > 0:
        total_amount = sum(i.quantity * i.unit_price for i in payload.items)
    elif pr and pr.vendor_selections:
        total_amount = pr.vendor_selections[-1].quotation_amount
    elif pr:
        total_amount = pr.estimated_budget
    else:
        total_amount = 5000.0

    initial_status = "Issued" if payload.auto_issue else "Draft"
    issued_time = datetime.utcnow() if payload.auto_issue else None

    new_po = PurchaseOrder(
        po_number=po_number,
        procurement_request_id=pr.id if pr else None,
        vendor_id=vendor.id,
        created_by_id=scm_user.id,
        issued_by_id=scm_user.id if payload.auto_issue else None,
        total_amount=float(total_amount),
        currency="USD",
        status=initial_status,
        issued_at=issued_time,
        expected_delivery_date=payload.expected_delivery_date,
        shipping_address=payload.shipping_address,
        terms_and_conditions=payload.terms_and_conditions
    )
    db.add(new_po)
    db.flush()

    # Add items
    if payload.items and len(payload.items) > 0:
        for it in payload.items:
            po_item = PurchaseOrderItem(
                purchase_order_id=new_po.id,
                item_name=it.item_name.strip(),
                description=it.description,
                quantity=float(it.quantity),
                unit_price=float(it.unit_price),
                total_price=float(it.quantity * it.unit_price),
                sku=it.sku
            )
            db.add(po_item)
    elif pr:
        po_item = PurchaseOrderItem(
            purchase_order_id=new_po.id,
            item_name=pr.title,
            description=pr.description,
            quantity=pr.quantity,
            unit_price=round(total_amount / pr.quantity, 2) if pr.quantity > 0 else total_amount,
            total_price=total_amount,
            sku=f"SKU-{pr.id:04d}"
        )
        db.add(po_item)
    else:
        po_item = PurchaseOrderItem(
            purchase_order_id=new_po.id,
            item_name=f"Supply Order for {vendor.name}",
            description="Commercial procurement line items",
            quantity=1.0,
            unit_price=float(total_amount),
            total_price=float(total_amount),
            sku="DIRECT-PO-01"
        )
        db.add(po_item)

    if pr:
        pr.status = "Ordered"
        pr.updated_at = datetime.utcnow()

    # Immutable audit log
    audit = AuditLog(
        user_id=scm_user.id,
        user_name=scm_user.full_name,
        user_role=scm_user.role,
        action="PO_ISSUED" if payload.auto_issue else "PO_CREATED_DRAFT",
        entity_type="PurchaseOrder",
        entity_id=new_po.id,
        previous_status="READY_FOR_PO" if pr else "NONE",
        new_status=new_po.status,
        details=f"User {scm_user.full_name} created {po_number} for vendor {vendor.name} totaling ${total_amount:,.2f} (Status: {new_po.status})."
    )
    db.add(audit)
    
    # SINGLE ATOMIC COMMIT
    db.commit()
    db.refresh(new_po)

    # Secondary operations dispatched asynchronously
    if payload.auto_issue:
        if vendor.user_id:
            background_tasks.add_task(
                send_notification_async,
                title="New Purchase Order Issued",
                message=f"Purchase Order {new_po.po_number} (Total: ${new_po.total_amount:,.2f}) has been issued to your enterprise. Please review and accept.",
                user_id=vendor.user_id,
                ref_id=new_po.id,
                ref_type="PurchaseOrder",
                notif_type="order"
            )

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="PurchaseOrder",
        entity_id=new_po.id,
        action="PO_CREATED",
        actor_id=scm_user.id,
        metadata={"po_number": po_number, "total_amount": total_amount, "vendor": vendor.name}
    )

    return {
        "message": f"Purchase Order {po_number} created in {new_po.status} status.",
        "id": new_po.id,
        "po_id": new_po.id,
        "po_number": new_po.po_number,
        "status": new_po.status,
        "total_amount": new_po.total_amount,
        "vendor_id": vendor.id,
        "vendor_name": vendor.name,
        "vendor_company": vendor.company or vendor.name,
        "vendor": {
            "id": vendor.id,
            "name": vendor.name,
            "company": vendor.company or vendor.name,
            "category": vendor.category
        }
    }

@router.post("/{po_id}/issue")
def issue_purchase_order(
    po_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    # Strict RBAC: Purchase Order is issued ONLY by Supply Chain Manager
    scm_user: User = Depends(require_roles_strict(["Supply Chain Manager"]))
):
    """
    Step 18 & 19: Supply Chain Manager reviews and issues PO to the selected vendor.
    PO moves to 'Issued'.
    Executes in a single atomic transaction; vendor notification & blockchain audit queued asynchronously.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    if po.status not in ["Draft", "Pending Approval"]:
        raise HTTPException(status_code=400, detail=f"Cannot issue PO in '{po.status}' status. Must be 'Draft'.")

    po.status = "Issued"
    po.issued_by_id = scm_user.id
    po.issued_at = datetime.utcnow()
    po.updated_at = datetime.utcnow()
    if po.procurement_request:
        po.procurement_request.status = "Ordered"
        po.procurement_request.updated_at = datetime.utcnow()

    # Immutable audit log in SAME transaction
    audit = AuditLog(
        user_id=scm_user.id,
        user_name=scm_user.full_name,
        user_role=scm_user.role,
        action="PO_ISSUED",
        entity_type="PurchaseOrder",
        entity_id=po.id,
        previous_status="Draft",
        new_status="Issued",
        details=f"Supply Chain Manager {scm_user.full_name} issued PO {po.po_number} to {po.vendor.name}."
    )
    db.add(audit)
    db.commit()

    # Step 19: Notify Vendor asynchronously
    v_name = po.vendor.name if po.vendor else "Assigned Vendor"
    v_comp = po.vendor.company if (po.vendor and po.vendor.company) else v_name
    if po.vendor and po.vendor.user_id:
        background_tasks.add_task(
            send_notification_async,
            title="New Purchase Order Issued",
            message=f"Purchase Order {po.po_number} (Total: ${po.total_amount:,.2f}) has been issued to your enterprise. Please review and accept.",
            user_id=po.vendor.user_id,
            ref_id=po.id,
            ref_type="PurchaseOrder",
            notif_type="order"
        )
    else:
        background_tasks.add_task(
            send_notification_async,
            title="New Purchase Order Issued",
            message=f"Purchase Order {po.po_number} has been issued to {v_name}.",
            target_role="Vendor",
            ref_id=po.id,
            ref_type="PurchaseOrder",
            notif_type="order"
        )

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="PurchaseOrder",
        entity_id=po.id,
        action="PO_ISSUED",
        actor_id=scm_user.id,
        metadata={"po_number": po.po_number, "status": "Issued", "vendor": v_name}
    )

    return {
        "message": f"Purchase Order {po.po_number} issued to vendor {v_name}.",
        "po_id": po.id,
        "po_number": po.po_number,
        "status": po.status,
        "issued_at": po.issued_at,
        "vendor_id": po.vendor_id,
        "vendor_name": v_name,
        "vendor_company": v_comp
    }

# ==========================================
# STEP 20 & 21: VENDOR ACTIONS
# ==========================================

@router.post("/{po_id}/accept")
@router.put("/{po_id}/accept")
def vendor_accept_po(
    po_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Vendor", "Administrator", "Supply Chain Manager", "Procurement Manager"]))
):
    """
    Step 20: Vendor accepts the issued Purchase Order.
    PO moves to 'Accepted'. Notifies Supply Chain Manager asynchronously.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    v_name = po.vendor.name if po.vendor else "Assigned Vendor"

    if po.status not in ["Issued", "Draft", "Pending Acceptance"]:
        raise HTTPException(status_code=400, detail=f"Cannot accept PO in '{po.status}' status. Must be 'Pending Acceptance' or 'Issued'.")

    po.status = "Accepted"
    if not po.issued_at:
        po.issued_at = datetime.utcnow()
        po.issued_by_id = po.created_by_id or 1
    po.vendor_accepted_at = datetime.utcnow()
    po.updated_at = datetime.utcnow()
    if po.procurement_request:
        po.procurement_request.status = "Ordered"
        po.procurement_request.updated_at = datetime.utcnow()

    # Audit log in same transaction
    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action="PO_ACCEPTED_BY_VENDOR",
        entity_type="PurchaseOrder",
        entity_id=po.id,
        previous_status="Pending Acceptance",
        new_status="Accepted",
        details=f"User {current_user.full_name} ({current_user.role}) accepted PO {po.po_number} for vendor {v_name}."
    )
    db.add(audit)
    db.commit()

    # Notify Supply Chain Manager asynchronously
    background_tasks.add_task(
        send_notification_async,
        title="Vendor Accepted Purchase Order",
        message=f"Vendor {v_name} accepted Purchase Order {po.po_number}.",
        target_role="Supply Chain Manager",
        ref_id=po.id,
        ref_type="PurchaseOrder",
        notif_type="order"
    )

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="PurchaseOrder",
        entity_id=po.id,
        action="PO_ACCEPTED_BY_VENDOR",
        actor_id=current_user.id,
        metadata={"po_number": po.po_number, "status": "Accepted", "vendor": v_name}
    )

    return {
        "message": f"Purchase Order {po.po_number} accepted successfully.",
        "status": po.status,
        "vendor_id": po.vendor_id,
        "vendor_name": v_name,
        "vendor_company": po.vendor.company if po.vendor else v_name
    }

@router.post("/{po_id}/reject")
@router.put("/{po_id}/reject")
def vendor_reject_po(
    po_id: int,
    payload: VendorDecisionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Vendor", "Administrator", "Supply Chain Manager", "Procurement Manager"]))
):
    """
    Step 20 (Rejection): Vendor rejects the Purchase Order with reason.
    """
    reason = (payload.rejection_reason or payload.reason or "Declined by vendor.").strip()

    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    v_name = po.vendor.name if po.vendor else "Assigned Vendor"

    if po.status not in ["Issued", "Draft", "Pending Acceptance"]:
        raise HTTPException(status_code=400, detail=f"Cannot reject PO in '{po.status}' status.")

    po.status = "Rejected"
    po.vendor_rejection_reason = reason
    po.updated_at = datetime.utcnow()
    db.commit()

    # Notify SCM & Procurement
    send_notification(
        db=db,
        title="Purchase Order Rejected by Vendor",
        message=f"Vendor {v_name} rejected {po.po_number}. Reason: {reason}",
        target_role="Supply Chain Manager",
        ref_id=po.id,
        ref_type="PurchaseOrder",
        notif_type="alert"
    )

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action="PO_REJECTED_BY_VENDOR",
        entity_type="PurchaseOrder",
        entity_id=po.id,
        previous_status="Pending Acceptance",
        new_status="Rejected",
        reason=reason,
        details=f"User {current_user.full_name} ({current_user.role}) rejected PO {po.po_number} for vendor {v_name}. Reason: {reason}"
    )
    db.add(audit)
    db.commit()

    return {"message": f"PO {po.po_number} marked as Rejected successfully.", "status": po.status, "vendor_rejection_reason": reason}

@router.put("/{po_id}/status")
def update_po_status(
    po_id: int,
    payload: POStatusUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    General status update endpoint used by PurchaseOrderService.
    Supports role-sensitive transitions for Vendor, SCM, and Admin.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    target = payload.status.strip()

    if current_user.role == "Vendor":
        vendor = get_vendor_for_user(db, current_user)
        if not vendor or po.vendor_id != vendor.id:
            raise HTTPException(status_code=403, detail="Unauthorized: You can only update your own Purchase Orders.")

        if target == "Accepted":
            po.status = "Accepted"
            po.vendor_accepted_at = datetime.utcnow()
            if not po.issued_at:
                po.issued_at = datetime.utcnow()
                po.issued_by_id = po.created_by_id or 1
        elif target == "Rejected":
            po.status = "Rejected"
            po.vendor_rejection_reason = payload.notes or "Declined by vendor."
        elif target in ["Delivered", "In Transit"]:
            po.status = target
            if payload.actual_delivery_date:
                po.actual_delivery_date = payload.actual_delivery_date
        else:
            raise HTTPException(status_code=400, detail=f"Vendors cannot set PO status to '{target}'.")
    else:
        # Management (SCM, Admin, Procurement, Finance)
        if target in ["Completed", "COMPLETED"]:
            if not po.deliveries:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot mark Purchase Order as 'Completed' when physical delivery has not been recorded. Delivery is pending."
                )
        po.status = target
        if target == "Issued" and not po.issued_at:
            po.issued_at = datetime.utcnow()
            po.issued_by_id = current_user.id
        if target == "Delivered" and payload.actual_delivery_date:
            po.actual_delivery_date = payload.actual_delivery_date

    if po.procurement_request:
        if target in ["Delivered", "In Transit", "Ordered", "Completed", "Cancelled"]:
            po.procurement_request.status = target
        elif target in ["Accepted", "Issued"]:
            po.procurement_request.status = "Ordered"
        po.procurement_request.updated_at = datetime.utcnow()

    po.updated_at = datetime.utcnow()
    db.commit()
    return {"message": f"PO {po.po_number} status updated to {po.status}.", "status": po.status, "po_id": po.id}

@router.post("/{po_id}/approve")
def approve_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Administrator", "Procurement Manager", "Finance Officer", "Supply Chain Manager"]))
):
    """Management approval endpoint used by purchase-orders.html."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    po.status = "Approved"
    po.approved_by_id = current_user.id
    po.approved_at = datetime.utcnow()
    po.updated_at = datetime.utcnow()
    if po.procurement_request:
        po.procurement_request.status = "Ordered"
        po.procurement_request.updated_at = datetime.utcnow()
    db.commit()
    return {"message": f"Purchase Order {po.po_number} approved.", "status": po.status, "po_id": po.id}

@router.post("/{po_id}/dispatch")
@router.put("/{po_id}/dispatch")
def vendor_dispatch_po(
    po_id: int,
    payload: VendorDispatchPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Vendor", "Administrator", "Supply Chain Manager", "Procurement Manager"]))
):
    """
    Step 21: Vendor prepares and dispatches order.
    Records carrier, tracking number, dispatch date. Status -> 'In Transit'.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    v_name = po.vendor.name if po.vendor else "Assigned Vendor"

    if po.status not in ["Accepted", "Issued", "Pending Acceptance", "Dispatched"]:
        raise HTTPException(status_code=400, detail=f"Cannot dispatch PO in status '{po.status}'. Must be 'Accepted'.")

    po.status = "In Transit"
    po.carrier = payload.carrier.strip()
    po.tracking_number = payload.tracking_number.strip()
    po.dispatch_date = payload.dispatch_date or datetime.utcnow()
    if payload.expected_delivery_date:
        po.expected_delivery_date = payload.expected_delivery_date
    po.notes = payload.notes
    po.updated_at = datetime.utcnow()
    if po.procurement_request:
        po.procurement_request.status = "In Transit"
        po.procurement_request.updated_at = datetime.utcnow()
    db.commit()

    # Step 22: Supply Chain Manager notified to track delivery
    send_notification(
        db=db,
        title="Shipment Dispatched - In Transit",
        message=f"Order {po.po_number} dispatched by {v_name} via {po.carrier} (Tracking: {po.tracking_number}). Ready for delivery tracking.",
        target_role="Supply Chain Manager",
        ref_id=po.id,
        ref_type="PurchaseOrder",
        notif_type="order"
    )

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action="PO_DISPATCHED_IN_TRANSIT",
        entity_type="PurchaseOrder",
        entity_id=po.id,
        previous_status="Accepted",
        new_status="In Transit",
        details=f"User {current_user.full_name} ({current_user.role}) dispatched PO {po.po_number} for {v_name} via {po.carrier} (Tracking: {po.tracking_number})."
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"PO {po.po_number} marked as In Transit successfully.",
        "status": po.status,
        "carrier": po.carrier,
        "tracking_number": po.tracking_number,
        "dispatch_date": po.dispatch_date,
        "expected_delivery_date": po.expected_delivery_date
    }

@router.post("/{po_id}/delivery")
@router.put("/{po_id}/delivery")
def update_po_delivery(
    po_id: int,
    payload: PODeliveryUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 22: Update shipment tracking and estimated delivery details.
    Vendor can update shipment & delivery details according to existing workflow.
    Supply Chain Manager performs final Delivery Confirmation upon physical receipt.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    if payload.carrier:
        po.carrier = payload.carrier.strip()
    if payload.tracking_number:
        po.tracking_number = payload.tracking_number.strip()
    if payload.expected_delivery_date:
        po.expected_delivery_date = payload.expected_delivery_date
    if payload.notes:
        po.notes = payload.notes

    po.updated_at = datetime.utcnow()
    db.commit()

    return {
        "message": f"Delivery tracking details updated for PO {po.po_number}.",
        "po_id": po.id,
        "po_number": po.po_number,
        "status": po.status,
        "carrier": po.carrier,
        "tracking_number": po.tracking_number,
        "expected_delivery_date": po.expected_delivery_date,
        "notes": po.notes
    }

@router.get("")
def get_purchase_orders(
    status: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    vendor_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get Purchase Orders with role-based and vendor-specific visibility.
    """
    query = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.vendor),
        joinedload(PurchaseOrder.procurement_request),
        joinedload(PurchaseOrder.items),
        joinedload(PurchaseOrder.deliveries),
        joinedload(PurchaseOrder.invoices)
    )

    if vendor_id is not None:
        query = query.filter(PurchaseOrder.vendor_id == vendor_id)

    filter_val = status or status_filter
    if filter_val and filter_val.lower() != "all":
        s = filter_val.strip().lower()
        if s in ["pending", "pending acceptance", "issued"]:
            query = query.filter(PurchaseOrder.status.in_(["Issued", "Draft", "Pending Acceptance"]))
        elif s == "dispatched":
            query = query.filter(PurchaseOrder.status.in_(["Dispatched", "In Transit"]))
        elif s in ["delivered", "delivery confirmed", "completed"]:
            query = query.filter(PurchaseOrder.status.in_(["Delivered", "Completed", "Delivery Confirmed"]))
        else:
            query = query.filter(PurchaseOrder.status.ilike(filter_val.strip()))

    pos = query.order_by(PurchaseOrder.id.desc()).all()
    result = []
    for po in pos:
        delivery = po.deliveries[-1] if po.deliveries else None
        invoice = po.invoices[-1] if po.invoices else None
        v_name = po.vendor.name if po.vendor else "Unknown"
        v_comp = po.vendor.company if (po.vendor and po.vendor.company) else v_name
        result.append({
            "id": po.id,
            "po_number": po.po_number,
            "procurement_request_id": po.procurement_request_id,
            "requisition_number": po.procurement_request.request_number if po.procurement_request else "N/A",
            "requirement_title": po.procurement_request.title if po.procurement_request else None,
            "department": po.procurement_request.department if po.procurement_request else "N/A",
            "vendor_id": po.vendor_id,
            "vendor_name": v_name,
            "vendor_company": v_comp,
            "vendor": {
                "id": po.vendor.id,
                "name": po.vendor.name,
                "company": v_comp,
                "category": po.vendor.category
            } if po.vendor else None,
            "total_amount": po.total_amount,
            "currency": po.currency,
            "status": po.status,
            "blockchain_status": getattr(po, "blockchain_status", "CONFIRMED"),
            "created_at": po.created_at,
            "issued_at": po.issued_at,
            "vendor_accepted_at": po.vendor_accepted_at,
            "vendor_rejection_reason": po.vendor_rejection_reason,
            "dispatch_date": po.dispatch_date,
            "carrier": po.carrier,
            "tracking_number": po.tracking_number,
            "expected_delivery_date": po.expected_delivery_date,
            "actual_delivery_date": po.actual_delivery_date,
            "terms_and_conditions": po.terms_and_conditions,
            "shipping_address": po.shipping_address,
            "notes": po.notes,
            "items": [
                {
                    "id": item.id,
                    "item_name": item.item_name,
                    "description": item.description,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "total_price": item.total_price,
                    "sku": item.sku
                }
                for item in po.items
            ] if po.items else [],
            "delivery": {
                "delivered_quantity": delivery.delivered_quantity if delivery else None,
                "ordered_quantity": delivery.ordered_quantity if delivery else None,
                "delay_days": delivery.delay_days if delivery else 0,
                "delivery_status": delivery.delivery_status if delivery else None,
                "carrier": delivery.carrier if delivery else None,
                "tracking_number": delivery.tracking_number if delivery else None,
                "notes": delivery.notes if delivery else None
            } if delivery else None,
            "invoice": {
                "id": invoice.id if invoice else None,
                "invoice_number": invoice.invoice_number if invoice else None,
                "status": invoice.status if invoice else None,
                "three_way_match_status": invoice.three_way_match_status if invoice else None
            } if invoice else None
        })
    return result

@router.get("/{po_id}")
def get_purchase_order_by_id(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve single Purchase Order with rich vendor and item details."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    if current_user.role == "Vendor":
        vendor = get_vendor_for_user(db, current_user)
        if not vendor or po.vendor_id != vendor.id:
            raise HTTPException(status_code=403, detail="Unauthorized to view this purchase order.")

    delivery = po.deliveries[-1] if po.deliveries else None
    invoice = po.invoices[-1] if po.invoices else None
    v_name = po.vendor.name if po.vendor else "Unknown"
    v_comp = po.vendor.company if (po.vendor and po.vendor.company) else v_name

    return {
        "id": po.id,
        "po_number": po.po_number,
        "procurement_request_id": po.procurement_request_id,
        "requisition_number": po.procurement_request.request_number if po.procurement_request else "N/A",
        "department": po.procurement_request.department if po.procurement_request else "N/A",
        "vendor_id": po.vendor_id,
        "vendor_name": v_name,
        "vendor_company": v_comp,
        "vendor": {
            "id": po.vendor.id,
            "name": po.vendor.name,
            "company": v_comp,
            "category": po.vendor.category
        } if po.vendor else None,
        "total_amount": po.total_amount,
        "currency": po.currency,
        "status": po.status,
        "blockchain_status": getattr(po, "blockchain_status", "CONFIRMED"),
        "created_at": po.created_at,
        "issued_at": po.issued_at,
        "vendor_accepted_at": po.vendor_accepted_at,
        "dispatch_date": po.dispatch_date,
        "carrier": po.carrier,
        "tracking_number": po.tracking_number,
        "expected_delivery_date": po.expected_delivery_date,
        "actual_delivery_date": po.actual_delivery_date,
        "shipping_address": po.shipping_address,
        "terms_and_conditions": po.terms_and_conditions,
        "items": [
            {
                "id": item.id,
                "item_name": item.item_name,
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price,
                "sku": item.sku
            }
            for item in po.items
        ] if po.items else [],
        "delivery": {
            "delivered_quantity": delivery.delivered_quantity if delivery else None,
            "ordered_quantity": delivery.ordered_quantity if delivery else None,
            "delay_days": delivery.delay_days if delivery else 0,
            "delivery_status": delivery.delivery_status if delivery else None
        } if delivery else None,
        "invoice": {
            "id": invoice.id if invoice else None,
            "invoice_number": invoice.invoice_number if invoice else None,
            "status": invoice.status if invoice else None,
            "three_way_match_status": invoice.three_way_match_status if invoice else None
        } if invoice else None
    }
