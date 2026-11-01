from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, get_current_user, require_roles_strict, require_roles
from app.models.user import User
from app.models.purchase_order import PurchaseOrder
from app.models.delivery import Delivery
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.communication import AuditLog
from app.services.notification_service import send_notification_async
from app.services.reliability_engine import calculate_vendor_metrics_async
from app.services.blockchain_service import record_blockchain_audit_async

router = APIRouter(prefix="/deliveries", tags=["Delivery Tracking & Fulfillment Confirmation"])

class DeliveryRecordPayload(BaseModel):
    purchase_order_id: int
    expected_delivery_date: datetime
    actual_delivery_date: datetime
    ordered_quantity: float
    delivered_quantity: float
    carrier: Optional[str] = "DHL Express Freight"
    tracking_number: Optional[str] = None
    notes: Optional[str] = "Goods inspected at receiving dock."

@router.post("", status_code=status.HTTP_201_CREATED)
def record_delivery(
    payload: DeliveryRecordPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    # Strict RBAC: ONLY Supply Chain Manager can record delivery!
    scm_user: User = Depends(require_roles_strict(["Supply Chain Manager"]))
):
    """
    Step 23 & 24: Supply Chain Manager records physical delivery receipt.
    System calculates delay_days and records delivery status.
    Generates draft Invoice for Finance Officer verification.
    Executes in a single atomic commit; secondary tasks run in background.
    """
    po = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.vendor),
        joinedload(PurchaseOrder.procurement_request)
    ).filter(PurchaseOrder.id == payload.purchase_order_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    # Calculate delay days: actual vs expected
    exp_date = payload.expected_delivery_date.date()
    act_date = payload.actual_delivery_date.date()
    delay_days = (act_date - exp_date).days
    delay_days = max(0, delay_days)

    # Determine delivery status
    if payload.delivered_quantity < payload.ordered_quantity:
        delivery_status = "Partially Delivered"
    elif delay_days > 0:
        delivery_status = "Delayed"
    else:
        delivery_status = "Delivered"

    # Create Delivery record
    delivery = Delivery(
        purchase_order_id=po.id,
        recorded_by_id=scm_user.id,
        expected_delivery_date=payload.expected_delivery_date,
        actual_delivery_date=payload.actual_delivery_date,
        ordered_quantity=payload.ordered_quantity,
        delivered_quantity=payload.delivered_quantity,
        delay_days=delay_days,
        delivery_status=delivery_status,
        carrier=payload.carrier,
        tracking_number=payload.tracking_number,
        notes=payload.notes
    )
    db.add(delivery)

    # Update PO state
    po.status = delivery_status
    po.actual_delivery_date = payload.actual_delivery_date
    po.updated_at = datetime.utcnow()
    if po.procurement_request:
        po.procurement_request.status = "Delivered" if delivery_status in ["Delivered", "Delayed"] else delivery_status
        po.procurement_request.updated_at = datetime.utcnow()

    # Step 25: If full delivery or confirmed, create/update Invoice for Finance
    existing_inv = db.query(Invoice).filter(Invoice.purchase_order_id == po.id).first()
    if not existing_inv:
        inv_count = db.query(Invoice).count() + 1
        inv_number = f"INV-{datetime.utcnow().year}-{inv_count:04d}"
        invoice_amount = round(po.total_amount * (payload.delivered_quantity / max(payload.ordered_quantity, 1.0)), 2)
        invoice = Invoice(
            invoice_number=inv_number,
            purchase_order_id=po.id,
            vendor_id=po.vendor_id,
            amount=invoice_amount,
            status="INVOICE_RECEIVED",
            three_way_match_status="PENDING",
            notes=f"Auto-generated invoice from confirmed delivery of {payload.delivered_quantity} units."
        )
        db.add(invoice)

    db.flush()

    # Immutable audit log
    v_name = po.vendor.name if po.vendor else "Assigned Vendor"
    v_comp = po.vendor.company if (po.vendor and po.vendor.company) else v_name

    audit = AuditLog(
        user_id=scm_user.id,
        user_name=scm_user.full_name,
        user_role=scm_user.role,
        action="DELIVERY_RECORDED",
        entity_type="Delivery",
        entity_id=delivery.id,
        previous_status="In Transit",
        new_status=delivery_status,
        details=f"Supply Chain Manager {scm_user.full_name} recorded delivery for PO {po.po_number} (Vendor: {v_name}): Ordered {payload.ordered_quantity}, Delivered {payload.delivered_quantity}, Delay days: {delay_days}, Status: {delivery_status}."
    )
    db.add(audit)
    db.commit()
    db.refresh(delivery)

    # Background tasks
    background_tasks.add_task(
        send_notification_async,
        title="Delivery Recorded - Invoice Ready for Verification",
        message=f"Delivery recorded for {po.po_number} ({delivery_status}, Delivered: {payload.delivered_quantity}/{payload.ordered_quantity}). Invoice ready for 3-way matching and verification.",
        target_role="Finance Officer",
        ref_id=po.id,
        ref_type="PurchaseOrder",
        notif_type="approval"
    )

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="Delivery",
        entity_id=delivery.id,
        action="DELIVERY_RECORDED",
        actor_id=scm_user.id,
        metadata={"po_number": po.po_number, "status": delivery_status, "delivered_qty": payload.delivered_quantity}
    )

    return {
        "message": f"Delivery recorded successfully for {po.po_number}.",
        "delivery_id": delivery.id,
        "delivery_status": delivery.delivery_status,
        "delay_days": delivery.delay_days,
        "ordered_quantity": delivery.ordered_quantity,
        "delivered_quantity": delivery.delivered_quantity,
        "po_status": po.status,
        "vendor_id": po.vendor_id,
        "vendor_name": v_name,
        "vendor_company": v_comp
    }

@router.post("/{delivery_id}/confirm-completed")
def confirm_delivery_completed(
    delivery_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    # Strict RBAC: ONLY Supply Chain Manager can confirm delivery!
    scm_user: User = Depends(require_roles_strict(["Supply Chain Manager"]))
):
    """
    Step 25: Supply Chain Manager confirms completed delivery.
    PO moves to 'Delivered' / 'Completed'.
    Triggers vendor metrics calculation in background.
    """
    delivery = db.query(Delivery).options(
        joinedload(Delivery.purchase_order).joinedload(PurchaseOrder.vendor)
    ).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery record not found")

    po = delivery.purchase_order
    delivery.delivery_status = "Completed"
    po.status = "Delivered"
    po.updated_at = datetime.utcnow()

    # Ensure invoice exists for Finance Officer verification
    inv = db.query(Invoice).filter(Invoice.purchase_order_id == po.id).first()
    if not inv:
        inv_count = db.query(Invoice).count() + 1
        inv_number = f"INV-{datetime.utcnow().year}-{inv_count:04d}"
        inv = Invoice(
            invoice_number=inv_number,
            purchase_order_id=po.id,
            vendor_id=po.vendor_id,
            amount=po.total_amount,
            status="INVOICE_RECEIVED",
            three_way_match_status="PENDING",
            notes=f"Auto-generated invoice from confirmed delivery completion of {delivery.delivered_quantity} units."
        )
        db.add(inv)

    db.flush()

    v_name = po.vendor.name if po.vendor else "Assigned Vendor"
    v_comp = po.vendor.company if (po.vendor and po.vendor.company) else v_name

    audit = AuditLog(
        user_id=scm_user.id,
        user_name=scm_user.full_name,
        user_role=scm_user.role,
        action="DELIVERY_CONFIRMED_COMPLETED",
        entity_type="Delivery",
        entity_id=delivery.id,
        previous_status="Delivered",
        new_status="Completed",
        details=f"Supply Chain Manager {scm_user.full_name} confirmed completion of delivery for PO {po.po_number} (Vendor: {v_name}). Notification dispatched to Finance Officer for 3-way match and payment."
    )
    db.add(audit)
    db.commit()

    # Secondary tasks in background: metrics calculation and notifications
    background_tasks.add_task(calculate_vendor_metrics_async, po.vendor_id)

    background_tasks.add_task(
        send_notification_async,
        title="Delivery Completed - Payment Processing Required",
        message=f"Supply Chain confirmed 100% delivery completion for PO {po.po_number}. Invoice {inv.invoice_number if inv else 'N/A'} is ready for 3-way match verification and payment disbursement.",
        target_role="Finance Officer",
        ref_id=po.id,
        ref_type="PurchaseOrder",
        notif_type="approval"
    )

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="Delivery",
        entity_id=delivery.id,
        action="DELIVERY_CONFIRMED_COMPLETED",
        actor_id=scm_user.id,
        metadata={"po_number": po.po_number, "status": "Completed", "vendor": v_name}
    )

    return {
        "message": f"Delivery completion confirmed for PO {po.po_number}. Forwarded to Finance Officer for 3-way match & payment verification.",
        "delivery_status": delivery.delivery_status,
        "po_status": po.status,
        "invoice_status": inv.status if inv else "Pending",
        "vendor_id": po.vendor_id,
        "vendor_name": v_name,
        "vendor_company": v_comp
    }

@router.get("")
def get_deliveries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Supply Chain Manager", "Finance Officer", "Auditor", "Administrator"]))
):
    """Lists delivery records with eager vendor and PO details."""
    deliveries = db.query(Delivery).options(
        joinedload(Delivery.purchase_order).joinedload(PurchaseOrder.vendor),
        joinedload(Delivery.recorded_by)
    ).order_by(Delivery.id.desc()).all()

    return [
        {
            "id": d.id,
            "purchase_order_id": d.purchase_order_id,
            "po_number": d.purchase_order.po_number if d.purchase_order else "N/A",
            "vendor_id": d.purchase_order.vendor_id if (d.purchase_order and d.purchase_order.vendor) else None,
            "vendor_name": d.purchase_order.vendor.name if (d.purchase_order and d.purchase_order.vendor) else "N/A",
            "vendor_company": d.purchase_order.vendor.company if (d.purchase_order and d.purchase_order.vendor and d.purchase_order.vendor.company) else (d.purchase_order.vendor.name if (d.purchase_order and d.purchase_order.vendor) else "N/A"),
            "vendor": {
                "id": d.purchase_order.vendor.id,
                "name": d.purchase_order.vendor.name,
                "company": d.purchase_order.vendor.company,
                "category": d.purchase_order.vendor.category
            } if (d.purchase_order and d.purchase_order.vendor) else None,
            "expected_delivery_date": d.expected_delivery_date,
            "actual_delivery_date": d.actual_delivery_date,
            "ordered_quantity": d.ordered_quantity,
            "delivered_quantity": d.delivered_quantity,
            "delay_days": d.delay_days,
            "delivery_status": d.delivery_status,
            "carrier": d.carrier,
            "tracking_number": d.tracking_number,
            "recorded_by": d.recorded_by.full_name if d.recorded_by else "Supply Chain Lead",
            "created_at": d.created_at
        }
        for d in deliveries
    ]
