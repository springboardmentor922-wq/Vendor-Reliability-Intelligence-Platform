from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_procurement_team, require_finance
from app.core.utils import generate_code, log_activity, notify_user
from app.db.session_dep import get_db
from app.models.user import User
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, Invoice, POStatus
from app.models.procurement import ProcurementRequest, ProcurementStatus
from app.models.vendor import Vendor
from app.schemas.purchase_order import (
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    PurchaseOrderOut,
    PurchaseOrderStatusUpdate,
    InvoiceCreate,
    InvoiceOut,
    InvoiceStatusUpdate,
)

router = APIRouter()


@router.post("", response_model=PurchaseOrderOut, status_code=201)
def create_purchase_order(
    payload: PurchaseOrderCreate, db: Session = Depends(get_db), current_user: User = Depends(require_procurement_team)
):
    """Purchase Order Creation with line items; total is computed automatically."""
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    po = PurchaseOrder(
        po_number=generate_code("PO"),
        procurement_request_id=payload.procurement_request_id,
        vendor_id=payload.vendor_id,
        created_by_id=current_user.id,
        status=POStatus.PENDING,
        order_date=datetime.utcnow(),
        expected_delivery_date=payload.expected_delivery_date,
        notes=payload.notes,
    )
    db.add(po)
    db.flush()

    total = 0.0
    for item in payload.items:
        line_total = item.quantity * item.unit_price
        total += line_total
        db.add(
            PurchaseOrderItem(
                purchase_order_id=po.id,
                item_name=item.item_name,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                total_price=line_total,
            )
        )
    po.total_amount = total

    if payload.procurement_request_id:
        req = db.query(ProcurementRequest).filter(ProcurementRequest.id == payload.procurement_request_id).first()
        if req:
            req.status = ProcurementStatus.ORDERED
            req.assigned_vendor_id = payload.vendor_id

    db.commit()
    db.refresh(po)

    log_activity(db, current_user.id, "purchase_order_created", "purchase_order", po.id, po.po_number)
    if vendor.user_id:
        notify_user(db, vendor.user_id, "procurement_alert", f"New Purchase Order {po.po_number}", "A new PO has been issued to you.", "purchase_order", po.id)
    return po


@router.get("", response_model=List[PurchaseOrderOut])
def list_purchase_orders(
    status_filter: Optional[POStatus] = None,
    vendor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(PurchaseOrder).options(joinedload(PurchaseOrder.items))
    if status_filter:
        query = query.filter(PurchaseOrder.status == status_filter)
    if vendor_id:
        query = query.filter(PurchaseOrder.vendor_id == vendor_id)
    return query.order_by(PurchaseOrder.created_at.desc()).all()


@router.get("/{po_id}", response_model=PurchaseOrderOut)
def get_purchase_order(po_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    po = db.query(PurchaseOrder).options(joinedload(PurchaseOrder.items)).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


@router.put("/{po_id}", response_model=PurchaseOrderOut)
def update_purchase_order(
    po_id: int, payload: PurchaseOrderUpdate, db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_team),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(po, field, value)
    db.commit()
    db.refresh(po)
    return po


@router.put("/{po_id}/status", response_model=PurchaseOrderOut)
def update_po_status(
    po_id: int, payload: PurchaseOrderStatusUpdate, db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_team),
):
    """Order Tracking: move a PO through Pending -> Approved -> Ordered -> Delivered -> Completed/Cancelled."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    po.status = payload.status
    if payload.status == POStatus.DELIVERED:
        po.actual_delivery_date = datetime.utcnow()

    if po.procurement_request_id:
        req = db.query(ProcurementRequest).filter(ProcurementRequest.id == po.procurement_request_id).first()
        if req and payload.status == POStatus.DELIVERED:
            req.status = ProcurementStatus.DELIVERED
        elif req and payload.status == POStatus.COMPLETED:
            req.status = ProcurementStatus.COMPLETED
        elif req and payload.status == POStatus.CANCELLED:
            req.status = ProcurementStatus.CANCELLED

    db.commit()
    db.refresh(po)

    log_activity(db, current_user.id, "po_status_updated", "purchase_order", po.id, f"{po.po_number} -> {payload.status.value}")

    vendor = db.query(Vendor).filter(Vendor.id == po.vendor_id).first()
    if vendor and vendor.user_id:
        notify_user(db, vendor.user_id, "delivery_alert", f"PO {po.po_number} status: {payload.status.value}", None, "purchase_order", po.id)
    return po


# ---- Invoice Management ----

@router.post("/{po_id}/invoices", response_model=InvoiceOut, status_code=201)
def create_invoice(
    po_id: int, payload: InvoiceCreate, db: Session = Depends(get_db), current_user: User = Depends(require_finance)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    invoice = Invoice(**payload.model_dump())
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    log_activity(db, current_user.id, "invoice_created", "invoice", invoice.id, invoice.invoice_number)
    return invoice


@router.get("/{po_id}/invoices", response_model=List[InvoiceOut])
def list_invoices(po_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Invoice).filter(Invoice.purchase_order_id == po_id).order_by(Invoice.created_at.desc()).all()


@router.put("/invoices/{invoice_id}/status", response_model=InvoiceOut)
def update_invoice_status(
    invoice_id: int, payload: InvoiceStatusUpdate, db: Session = Depends(get_db),
    current_user: User = Depends(require_finance),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.status = payload.status
    db.commit()
    db.refresh(invoice)
    return invoice
