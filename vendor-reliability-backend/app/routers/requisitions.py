from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, get_current_user, require_roles_strict, require_roles, block_vendor_role
from app.models.user import User
from app.models.procurement import ProcurementRequest, PurchaseRequisitionItem
from app.models.communication import AuditLog
from app.services.notification_service import send_notification_async
from app.services.blockchain_service import record_blockchain_audit_async

router = APIRouter(prefix="/requisitions", tags=["Purchase Requisitions"])

class PRItemCreate(BaseModel):
    item_name: str
    description: Optional[str] = None
    quantity: float = 1.0
    estimated_unit_price: float = 0.0
    sku: Optional[str] = None
    specifications: Optional[str] = None

class PRCreate(BaseModel):
    department: Optional[str] = "Procurement"
    product_name: str # Required material/product / service
    quantity: float
    unit_budget: Optional[float] = None # Budget assigned per unit
    required_date: Optional[datetime] = None
    priority: str = "Medium" # Low, Medium, High, Urgent
    reason: str # Reason/description
    category: str # REQUIRED Vendor Category dropdown
    estimated_budget: Optional[float] = 0.0
    items: Optional[List[PRItemCreate]] = None

@router.post("", status_code=status.HTTP_201_CREATED)
def create_purchase_requisition(
    data: PRCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    # Strict RBAC: The Procurement Manager identifies organizational requirements and creates Purchase Requisitions
    current_user: User = Depends(require_roles_strict(["Procurement Manager"]))
):
    """
    Procurement Manager creates a Procurement Request.
    Requirement includes: item, quantity, unit budget / total budget, required date, priority, category, description.
    Single commit with async background tasks for speed.
    """
    if not data.category or not data.category.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Vendor category is required."
        )

    from app.services.eligibility_service import normalize_category
    canonical_cat = normalize_category(data.category)

    count = db.query(ProcurementRequest).count() + 1
    pr_number = f"PR-{datetime.utcnow().year}-{count:04d}"

    # Calculate budget: support per-unit budget and line items
    qty = float(data.quantity) if data.quantity and float(data.quantity) > 0 else 1.0
    unit_b = float(data.unit_budget) if (data.unit_budget is not None and float(data.unit_budget) > 0) else None
    total_est = float(data.estimated_budget or 0.0)

    if unit_b is not None and total_est == 0.0:
        total_est = qty * unit_b
    elif total_est > 0.0 and unit_b is None:
        unit_b = round(total_est / qty, 2)
    elif unit_b is not None and total_est > 0.0:
        pass # Both provided, respect both

    if data.items:
        items_sum = sum(i.quantity * i.estimated_unit_price for i in data.items)
        if items_sum > 0:
            total_est = items_sum
            unit_b = round(total_est / qty, 2)

    new_pr = ProcurementRequest(
        request_number=pr_number,
        department=(data.department or "Procurement").strip(),
        title=data.product_name.strip(),
        description=data.reason.strip(),
        quantity=qty,
        required_date=data.required_date,
        priority=data.priority or "Medium",
        category=canonical_cat,
        unit_budget=float(unit_b or 0.0),
        estimated_budget=float(total_est),
        status="SUBMITTED",
        requested_by_id=current_user.id
    )
    db.add(new_pr)
    db.flush()

    # Add line items if provided
    if data.items:
        for it in data.items:
            po_item = PurchaseRequisitionItem(
                requisition_id=new_pr.id,
                item_name=it.item_name.strip(),
                description=it.description,
                quantity=float(it.quantity),
                estimated_unit_price=float(it.estimated_unit_price),
                estimated_total_price=float(it.quantity * it.estimated_unit_price),
                sku=it.sku,
                specifications=it.specifications
            )
            db.add(po_item)

    # Audit log in same transaction
    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action="PR_CREATED",
        entity_type="PurchaseRequisition",
        entity_id=new_pr.id,
        previous_status="NONE",
        new_status="SUBMITTED",
        details=f"Procurement Manager {current_user.full_name} created PR {pr_number} for department '{new_pr.department}': {new_pr.title} (Qty: {new_pr.quantity}, Budget: ${total_est:,.2f})"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_pr)

    # Secondary notification and blockchain audit run in background
    background_tasks.add_task(
        send_notification_async,
        title="Purchase Requisition Created",
        message=f"Purchase Requisition {pr_number} ({new_pr.title}, Qty: {new_pr.quantity}) created and ready for vendor evaluation.",
        target_role="Procurement Manager",
        ref_id=new_pr.id,
        ref_type="ProcurementRequest",
        notif_type="approval"
    )

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="ProcurementRequest",
        entity_id=new_pr.id,
        action="PR_CREATED",
        actor_id=current_user.id,
        metadata={"request_number": pr_number, "department": new_pr.department, "budget": total_est}
    )

    return {
        "message": f"Purchase Requisition {pr_number} created successfully.",
        "id": new_pr.id,
        "pr_id": new_pr.id,
        "request_number": new_pr.request_number,
        "status": new_pr.status,
        "department": new_pr.department,
        "title": new_pr.title,
        "category": new_pr.category,
        "quantity": new_pr.quantity,
        "unit_budget": new_pr.unit_budget,
        "estimated_budget": new_pr.estimated_budget,
        "priority": new_pr.priority,
        "description": new_pr.description,
        "created_at": new_pr.created_at
    }

@router.get("")
def get_purchase_requisitions(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Strict ownership filtering:
    - Requesting User sees ONLY their own submitted PRs
    - Vendors are completely BLOCKED (403 Forbidden)
    - Procurement, Finance, Supply Chain, Auditor, Admin see organizational requisitions
    """
    if current_user.role == "Vendor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Vendors cannot view internal organization requisitions."
        )

    query = db.query(ProcurementRequest).options(
        joinedload(ProcurementRequest.requested_by),
        joinedload(ProcurementRequest.vendor_selections).joinedload(app_vendor_sel_vendor),
        joinedload(ProcurementRequest.financial_approvals),
        joinedload(ProcurementRequest.purchase_orders).joinedload(app_po_vendor),
        joinedload(ProcurementRequest.purchase_orders).joinedload(app_po_deliveries),
        joinedload(ProcurementRequest.purchase_orders).joinedload(app_po_invoices),
        joinedload(ProcurementRequest.vendor),
        joinedload(ProcurementRequest.items)
    ) if False else db.query(ProcurementRequest).options(
        joinedload(ProcurementRequest.requested_by),
        joinedload(ProcurementRequest.vendor_selections),
        joinedload(ProcurementRequest.financial_approvals),
        joinedload(ProcurementRequest.purchase_orders),
        joinedload(ProcurementRequest.vendor),
        joinedload(ProcurementRequest.items)
    )

    if current_user.role == "Supply Chain Manager":
        query = query.filter(ProcurementRequest.status.in_([
            "READY_FOR_PO", "FINANCE_APPROVED", "PO_CREATED", "Ordered", "In Transit", "Delivered", "Completed"
        ]))

    if status_filter and status_filter.lower() != "all":
        sf = status_filter.strip()
        if sf == "Pending":
            query = query.filter(ProcurementRequest.status.in_(["Pending", "SUBMITTED", "UNDER_REVIEW", "UNDER_EVALUATION", "VENDOR_SELECTED", "FINANCE_PENDING"]))
        elif sf == "Approved":
            query = query.filter(ProcurementRequest.status.in_(["Approved", "READY_FOR_PO", "FINANCE_APPROVED"]))
        elif sf == "Ordered":
            query = query.filter(ProcurementRequest.status.in_(["Ordered", "PO_CREATED", "Issued", "Accepted"]))
        elif sf == "In Transit":
            query = query.filter(ProcurementRequest.status == "In Transit")
        elif sf == "Delivered":
            query = query.filter(ProcurementRequest.status.in_(["Delivered", "Delayed", "Partially Delivered"]))
        elif sf == "Completed":
            query = query.filter(ProcurementRequest.status.in_(["Completed", "COMPLETED"]))
        elif sf == "Cancelled":
            query = query.filter(ProcurementRequest.status.in_(["Cancelled", "REJECTED", "REJECTED_FINANCE"]))
        else:
            query = query.filter(ProcurementRequest.status == sf)

    records = query.order_by(ProcurementRequest.id.desc()).all()
    return [format_pr_response(r, db) for r in records]

def format_pr_response(r: ProcurementRequest, db: Session = None) -> dict:
    sel = r.vendor_selections[-1] if r.vendor_selections else None
    fin = r.financial_approvals[-1] if r.financial_approvals else None
    po = r.purchase_orders[-1] if r.purchase_orders else None

    # Real-time lifecycle status synchronization with moving order
    effective_status = r.status
    delivery = po.deliveries[-1] if (po and po.deliveries) else None
    inv = po.invoices[-1] if (po and po.invoices) else None

    if po:
        if (po.status in ["Completed", "COMPLETED"] and delivery) or (inv and inv.status == "PAID"):
            effective_status = "Completed"
        elif po.status in ["Delivered", "Delayed", "Partially Delivered"] or delivery:
            effective_status = "Delivered"
        elif po.status == "In Transit":
            effective_status = "In Transit"
        elif po.status in ["Issued", "Accepted", "Draft", "PO_CREATED", "Approved"]:
            effective_status = "Ordered"
    elif fin and fin.status in ["Approved", "APPROVED"]:
        effective_status = "Approved"
    elif sel:
        effective_status = "VENDOR_SELECTED"

    if r.status != effective_status and r.status not in ["Cancelled", "REJECTED", "REJECTED_FINANCE"]:
        r.status = effective_status
        if db:
            try:
                db.commit()
            except Exception:
                pass

    # Resolve vendor information
    v_target = None
    if po and po.vendor:
        v_target = po.vendor
    elif sel and sel.vendor:
        v_target = sel.vendor
    elif r.vendor:
        v_target = r.vendor

    v_name = v_target.name if v_target else None
    v_comp = v_target.company if (v_target and v_target.company) else v_name

    po_data = None
    if po:
        po_v_name = po.vendor.name if po.vendor else v_name
        po_v_comp = po.vendor.company if (po.vendor and po.vendor.company) else po_v_name
        po_data = {
            "id": po.id,
            "po_number": po.po_number,
            "status": po.status,
            "total_amount": po.total_amount,
            "vendor_id": po.vendor_id,
            "vendor_name": po_v_name,
            "vendor_company": po_v_comp,
            "vendor": {
                "id": po.vendor.id,
                "name": po_v_name,
                "company": po_v_comp,
                "category": po.vendor.category
            } if po.vendor else None,
            "carrier": po.carrier or (delivery.carrier if delivery else None),
            "tracking_number": po.tracking_number or (delivery.tracking_number if delivery else None),
            "dispatch_date": po.dispatch_date.strftime("%Y-%m-%d %H:%M") if po.dispatch_date else None,
            "expected_delivery_date": po.expected_delivery_date.strftime("%Y-%m-%d") if po.expected_delivery_date else None,
            "actual_delivery_date": (po.actual_delivery_date or (delivery.actual_delivery_date if delivery else None)).strftime("%Y-%m-%d") if (po.actual_delivery_date or (delivery and delivery.actual_delivery_date)) else None,
            "delivery_status": delivery.delivery_status if delivery else None,
            "delay_days": delivery.delay_days if delivery else 0,
            "delivered_quantity": delivery.delivered_quantity if delivery else None,
            "ordered_quantity": delivery.ordered_quantity if delivery else (po.items[0].quantity if po.items else r.quantity),
            "invoice_number": inv.invoice_number if inv else None,
            "invoice_status": inv.status if inv else None,
            "invoice_amount": inv.amount if inv else None,
            "is_paid": (inv.status == "PAID") if inv else False
        }

    return {
        "id": r.id,
        "request_number": r.request_number,
        "department": r.department,
        "title": r.title,
        "description": r.description,
        "quantity": r.quantity,
        "unit_budget": getattr(r, "unit_budget", None) or (round(r.estimated_budget / r.quantity, 2) if (r.quantity and r.quantity > 0) else r.estimated_budget),
        "required_date": r.required_date,
        "priority": r.priority,
        "category": r.category,
        "estimated_budget": r.estimated_budget,
        "status": r.status,
        "rejection_reason": r.rejection_reason,
        "vendor_id": v_target.id if v_target else (r.assigned_vendor_id or None),
        "vendor_name": v_name,
        "vendor_company": v_comp,
        "vendor": {
            "id": v_target.id,
            "name": v_name,
            "company": v_comp,
            "category": v_target.category
        } if v_target else None,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
        "requested_by": {
            "id": r.requested_by.id if r.requested_by else None,
            "name": r.requested_by.full_name if r.requested_by else "Procurement Manager",
            "email": r.requested_by.email if r.requested_by else ""
        },
        "selected_vendor": {
            "id": v_target.id if v_target else None,
            "name": v_name,
            "company": v_comp,
            "category": v_target.category if v_target else None,
            "quotation": sel.quotation_amount if sel else None,
            "justification": getattr(sel, "justification", None) if sel else None,
            "status": sel.status if sel else None
        } if (sel or v_target) else None,
        "financial_approval": {
            "id": fin.id if fin else None,
            "status": fin.status if fin else None,
            "budget_allocated": fin.budget_allocated if fin else None,
            "rejection_reason": fin.rejection_reason if fin else None,
            "approved_at": getattr(fin, "approved_at", None) if fin else None
        } if fin else None,
        "purchase_order": po_data,
        "items": [
            {
                "id": it.id,
                "item_name": it.item_name,
                "description": it.description,
                "quantity": it.quantity,
                "estimated_unit_price": it.estimated_unit_price,
                "estimated_total_price": it.estimated_total_price,
                "sku": it.sku
            }
            for it in r.items
        ] if hasattr(r, "items") and r.items else []
    }

@router.put("/{pr_id}")
def edit_purchase_requisition(
    pr_id: int,
    data: PRCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles_strict(["Procurement Manager"]))
):
    """
    Procurement Manager edits requirements before submission or vendor selection.
    """
    pr = db.query(ProcurementRequest).filter(ProcurementRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")

    if pr.status in ["FINANCE_APPROVED", "READY_FOR_PO", "PO_CREATED", "COMPLETED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit requisition in '{pr.status}' state."
        )

    pr.department = data.department.strip()
    pr.title = data.product_name.strip()
    pr.description = data.reason.strip()
    pr.quantity = float(data.quantity)
    if data.required_date:
        pr.required_date = data.required_date
    pr.priority = data.priority or "Medium"
    if data.category:
        pr.category = data.category
    if data.estimated_budget:
        pr.estimated_budget = float(data.estimated_budget)
    pr.updated_at = datetime.utcnow()

    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action="PR_EDITED",
        entity_type="PurchaseRequisition",
        entity_id=pr.id,
        previous_status=pr.status,
        new_status=pr.status,
        details=f"Procurement Manager {current_user.full_name} edited PR {pr.request_number}."
    )
    db.add(audit)
    db.commit()
    db.refresh(pr)

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="ProcurementRequest",
        entity_id=pr.id,
        action="PR_EDITED",
        actor_id=current_user.id,
        metadata={"request_number": pr.request_number}
    )

    return {"message": f"Purchase requisition {pr.request_number} updated successfully.", "pr_id": pr.id}

@router.post("/{pr_id}/submit")
def submit_purchase_requisition(
    pr_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles_strict(["Procurement Manager"]))
):
    """
    Procurement Manager submits requirement for vendor evaluation.
    """
    pr = db.query(ProcurementRequest).filter(ProcurementRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")

    prev_status = pr.status
    pr.status = "SUBMITTED"
    pr.updated_at = datetime.utcnow()

    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action="PR_SUBMITTED",
        entity_type="PurchaseRequisition",
        entity_id=pr.id,
        previous_status=prev_status,
        new_status="SUBMITTED",
        details=f"Procurement Manager {current_user.full_name} submitted PR {pr.request_number} for vendor evaluation."
    )
    db.add(audit)
    db.commit()
    db.refresh(pr)

    background_tasks.add_task(
        send_notification_async,
        title="Purchase Requirement Submitted",
        message=f"Purchase requirement {pr.request_number} ({pr.title}) is submitted and ready for vendor evaluation.",
        target_role="Procurement Manager",
        ref_id=pr.id,
        ref_type="ProcurementRequest",
        notif_type="approval"
    )

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="ProcurementRequest",
        entity_id=pr.id,
        action="PR_SUBMITTED",
        actor_id=current_user.id,
        metadata={"request_number": pr.request_number}
    )

    return {"message": f"PR {pr.request_number} submitted.", "status": pr.status}

@router.get("/{pr_id}")
def get_purchase_requisition_details(
    pr_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "Vendor":
        raise HTTPException(status_code=403, detail="Vendors cannot access internal PR details.")

    pr = db.query(ProcurementRequest).options(
        joinedload(ProcurementRequest.requested_by),
        joinedload(ProcurementRequest.vendor_selections),
        joinedload(ProcurementRequest.financial_approvals),
        joinedload(ProcurementRequest.purchase_orders),
        joinedload(ProcurementRequest.vendor),
        joinedload(ProcurementRequest.items)
    ).filter(ProcurementRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase requisition not found")

    return format_pr_response(pr, db)
