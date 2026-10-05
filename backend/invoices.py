"""Invoice lifecycle and finance analytics."""

from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from deps import (
    ensure_vendor_scope,
    get_current_user,
    get_db,
    log_activity,
    normalize_role,
    require_role,
)
from notifications import create_notification

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


class InvoiceCreate(BaseModel):
    purchase_order_id: int
    vendor_id: int | None = None
    amount: float | None = Field(default=None, ge=0)
    tax_amount: float | None = Field(default=None, ge=0)
    due_date: datetime | None = None
    notes: str | None = None
    document_path: str | None = None


class InvoiceStatusUpdate(BaseModel):
    status: str
    notes: str | None = None


def _serialize_invoice(i):
    return {
        "id": i.id,
        "invoice_number": i.invoice_number,
        "purchase_order_id": i.purchase_order_id,
        "po_number": i.purchase_order.po_number
        if i.purchase_order and i.purchase_order.po_number
        else f"PO #{i.purchase_order_id}",
        "vendor_id": i.vendor_id,
        "vendor_name": i.vendor.company_name if i.vendor else f"Vendor #{i.vendor_id}",
        "amount": i.amount,
        "tax_amount": i.tax_amount or 0,
        "total": round(i.amount + (i.tax_amount or 0), 2),
        "status": i.status,
        "due_date": i.due_date.isoformat() if i.due_date else None,
        "paid_date": i.paid_date.isoformat() if i.paid_date else None,
        "document_path": i.document_path,
        "notes": i.notes,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


@router.get("")
def list_invoices(
    status: str | None = None,
    vendor_id: int | None = None,
    limit: int = Query(200, ge=1, le=500),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Invoice).order_by(models.Invoice.id.desc())
    role = normalize_role(current_user.role)
    if role == "vendor":
        query = query.filter(models.Invoice.vendor_id == current_user.vendor_id)
    elif vendor_id:
        query = query.filter(models.Invoice.vendor_id == vendor_id)
    if status:
        query = query.filter(models.Invoice.status == status)
    return [_serialize_invoice(i) for i in query.limit(limit).all()]


@router.post("")
def create_invoice(
    payload: InvoiceCreate,
    current_user: models.User = Depends(
        require_role(
            ["administrator", "procurement_manager", "finance_officer", "vendor"]
        )
    ),
    db: Session = Depends(get_db),
):
    po = (
        db.query(models.PurchaseOrder)
        .filter(models.PurchaseOrder.id == payload.purchase_order_id)
        .first()
    )
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    ensure_vendor_scope(current_user, po.vendor_id)
    vendor_id = po.vendor_id
    amount = float(payload.amount if payload.amount is not None else po.subtotal)
    tax = float(payload.tax_amount if payload.tax_amount is not None else po.tax_amount)
    count = db.query(models.Invoice).count() + 1
    invoice = models.Invoice(
        invoice_number=f"INV-{datetime.utcnow().year}-{count:05d}",
        purchase_order_id=po.id,
        vendor_id=vendor_id,
        amount=amount,
        tax_amount=tax,
        status="Pending",
        due_date=payload.due_date,
        notes=payload.notes,
        document_path=payload.document_path,
    )
    db.add(invoice)
    db.flush()
    log_activity(
        db,
        current_user.id,
        "CREATE_INVOICE",
        "Invoice",
        invoice.id,
        f"Created {invoice.invoice_number} for {amount + tax:.2f}",
    )
    db.commit()
    db.refresh(invoice)
    return _serialize_invoice(invoice)


@router.put("/{invoice_id}/status")
def update_invoice_status(
    invoice_id: int,
    payload: InvoiceStatusUpdate,
    current_user: models.User = Depends(
        require_role(["administrator", "finance_officer", "vendor"])
    ),
    db: Session = Depends(get_db),
):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    ensure_vendor_scope(current_user, invoice.vendor_id)
    allowed = {"Pending", "Approved", "Paid", "Overdue", "Cancelled", "Disputed"}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid invoice status")
    old = invoice.status
    invoice.status = payload.status
    if payload.status == "Paid":
        invoice.paid_date = datetime.utcnow()
    if payload.notes:
        invoice.notes = payload.notes
    log_activity(
        db,
        current_user.id,
        "UPDATE_INVOICE_STATUS",
        "Invoice",
        invoice.id,
        f"{old} -> {payload.status}",
    )
    db.commit()
    db.refresh(invoice)
    return _serialize_invoice(invoice)


@router.get("/summary")
def invoice_summary(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    query = db.query(models.Invoice)
    if normalize_role(current_user.role) == "vendor":
        query = query.filter(models.Invoice.vendor_id == current_user.vendor_id)
    invoices = query.all()
    return {
        "total": len(invoices),
        "pending": sum(i.status == "Pending" for i in invoices),
        "approved": sum(i.status == "Approved" for i in invoices),
        "paid": sum(i.status == "Paid" for i in invoices),
        "overdue": sum(i.status == "Overdue" for i in invoices),
        "open_value": round(
            sum(
                (i.amount + (i.tax_amount or 0))
                for i in invoices
                if i.status not in {"Paid", "Cancelled"}
            ),
            2,
        ),
        "paid_value": round(
            sum(
                (i.amount + (i.tax_amount or 0)) for i in invoices if i.status == "Paid"
            ),
            2,
        ),
    }
