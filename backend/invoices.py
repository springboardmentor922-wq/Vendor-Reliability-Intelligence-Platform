"""Milestone-2 and 3: Invoices management and Finance module.

Provides invoice creation from purchase orders, payment status tracking,
and financial analytics for Finance Officers and Procurement Managers.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from deps import get_current_user, get_db, require_role, log_activity
from notifications import create_notification, notify_roles

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


class InvoiceCreate(BaseModel):
    purchase_order_id: int
    vendor_id: int | None = None
    amount: float | None = None  # if none, uses PO total
    tax_amount: float | None = None
    total_amount: float | None = None
    due_date: datetime | None = None
    notes: str | None = None



class InvoiceStatusUpdate(BaseModel):
    status: str  # Pending, Paid, Overdue, Cancelled
    notes: str | None = None


def _serialize_invoice(i: models.Invoice, po: models.PurchaseOrder | None = None, vendor: models.Vendor | None = None) -> dict:
    return {
        "id": i.id,
        "invoice_number": i.invoice_number,
        "purchase_order_id": i.purchase_order_id,
        "po_number": po.po_number if po and po.po_number else f"PO #{i.purchase_order_id}",
        "vendor_id": i.vendor_id,
        "vendor_name": vendor.company_name if vendor else (i.vendor.company_name if i.vendor else f"Vendor #{i.vendor_id}"),
        "amount": i.amount,
        "tax_amount": i.tax_amount,
        "total": i.amount + (i.tax_amount or 0.0),
        "status": i.status,
        "due_date": i.due_date.isoformat() if i.due_date else None,
        "paid_date": i.paid_date.isoformat() if i.paid_date else None,
        "notes": i.notes,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


@router.get("")
def list_invoices(
    status: str | None = None,
    vendor_id: int | None = None,
    limit: int = Query(100, ge=1, le=500),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all invoices, filterable by status and vendor."""
    query = db.query(models.Invoice)

    # Vendor scoping
    if "vendor" in current_user.role.lower():
        if current_user.vendor_id:
            query = query.filter(models.Invoice.vendor_id == current_user.vendor_id)
        else:
            v = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
            if v:
                query = query.filter(models.Invoice.vendor_id == v.id)
            else:
                return []
    elif vendor_id is not None:
        query = query.filter(models.Invoice.vendor_id == vendor_id)

    if status:
        query = query.filter(models.Invoice.status == status)

    invoices = query.order_by(models.Invoice.id.desc()).limit(limit).all()
    result = []
    for inv in invoices:
        po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == inv.purchase_order_id).first()
        vendor = db.query(models.Vendor).filter(models.Vendor.id == inv.vendor_id).first()
        result.append(_serialize_invoice(inv, po, vendor))
    return result


@router.post("")
def create_invoice(
    payload: InvoiceCreate,
    current_user: models.User = Depends(
        require_role(["admin", "procurement", "manager", "finance", "vendor"])
    ),
    db: Session = Depends(get_db),
):
    """Create an invoice for a purchase order."""
    po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == payload.purchase_order_id
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    vendor = db.query(models.Vendor).filter(models.Vendor.id == po.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    amount = payload.amount if payload.amount is not None else po.total_amount
    tax_amount = payload.tax_amount if payload.tax_amount is not None else round(amount * 0.18, 2)

    # Auto-generate unique invoice number (INV-YEAR-XXXX)
    from sqlalchemy import func
    max_id = db.query(func.max(models.Invoice.id)).scalar() or 0
    inv_num = f"INV-{datetime.now().year}-{(max_id + 1):04d}"
    # Check if duplicate exists, increment if necessary
    while db.query(models.Invoice).filter(models.Invoice.invoice_number == inv_num).first():
        max_id += 1
        inv_num = f"INV-{datetime.now().year}-{(max_id + 1):04d}"


    invoice = models.Invoice(
        invoice_number=inv_num,
        purchase_order_id=po.id,
        vendor_id=po.vendor_id,
        amount=amount,
        tax_amount=tax_amount,
        status="Pending",
        due_date=payload.due_date or (datetime.now() + timedelta(days=30)),
        notes=payload.notes,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    # Notify Finance & Procurement
    notify_roles(
        db, ["admin", "finance", "procurement"],
        "Invoice Generated",
        f"Invoice #{inv_num} (${amount + tax_amount:.2f}) generated for PO #{po.id} ({vendor.company_name}).",
        "procurement",
    )

    log_activity(
        db, current_user.id, "CREATE_INVOICE", "Invoice", invoice.id,
        f"INV #{inv_num} for PO #{po.id} - Total: ${amount + tax_amount:.2f}"
    )
    db.commit()
    return _serialize_invoice(invoice, po, vendor)


@router.put("/{invoice_id}/status")
def update_invoice_status(
    invoice_id: int,
    payload: InvoiceStatusUpdate,
    current_user: models.User = Depends(
        require_role(["admin", "finance", "procurement", "manager"])
    ),
    db: Session = Depends(get_db),
):
    """Update invoice payment status (Paid, Pending, Overdue, Cancelled)."""
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    allowed = ["Pending", "Paid", "Overdue", "Cancelled"]
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {allowed}")

    old_status = inv.status
    inv.status = payload.status
    if payload.notes:
        inv.notes = payload.notes
    if payload.status == "Paid" and not inv.paid_date:
        inv.paid_date = datetime.now()

    db.commit()
    db.refresh(inv)

    log_activity(
        db, current_user.id, "UPDATE_INVOICE_STATUS", "Invoice", inv.id,
        f"INV #{inv.invoice_number} status changed from {old_status} to {payload.status}",
    )
    db.commit()

    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == inv.purchase_order_id).first()
    vendor = db.query(models.Vendor).filter(models.Vendor.id == inv.vendor_id).first()
    return _serialize_invoice(inv, po, vendor)


@router.get("/summary")
def invoice_summary(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Financial summary overview for dashboards."""
    infil = db.query(models.Invoice)

    if "vendor" in current_user.role.lower():
        if current_user.vendor_id:
            infil = infil.filter(models.Invoice.vendor_id == current_user.vendor_id)
        else:
            v = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
            if v:
                infil = infil.filter(models.Invoice.vendor_id == v.id)

    invoices = infil.all()
    total_count = len(invoices)
    total_amount = sum(i.amount + (i.tax_amount or 0.0) for i in invoices)
    paid_amount = sum(i.amount + (i.tax_amount or 0.0) for i in invoices if i.status == "Paid")
    pending_amount = sum(i.amount + (i.tax_amount or 0.0) for i in invoices if i.status == "Pending")
    overdue_amount = sum(i.amount + (i.tax_amount or 0.0) for i in invoices if i.status == "Overdue")

    return {
        "total_invoices": total_count,
        "total_amount": round(total_amount, 2),
        "total_invoiced_amount": round(total_amount, 2),
        "paid_amount": round(paid_amount, 2),
        "total_paid_amount": round(paid_amount, 2),
        "pending_amount": round(pending_amount, 2),
        "total_pending_amount": round(pending_amount, 2),
        "overdue_amount": round(overdue_amount, 2),
        "total_overdue_amount": round(overdue_amount, 2),
        "paid_count": len([i for i in invoices if i.status == "Paid"]),
        "pending_count": len([i for i in invoices if i.status == "Pending"]),
        "overdue_count": len([i for i in invoices if i.status == "Overdue"]),
        "overdue_invoices_count": len([i for i in invoices if i.status == "Overdue"]),
    }


