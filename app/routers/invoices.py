from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.audit import log_action
from app.models.user import User, UserRole
from app.models.purchase_order import PurchaseOrder
from app.models.invoice import Invoice
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceOut

router = APIRouter(prefix="/invoices", tags=["Invoices"])

MANAGE_ROLES = (UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER, UserRole.FINANCE_OFFICER)


@router.post("/", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == payload.purchase_order_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    existing = db.query(Invoice).filter(Invoice.invoice_number == payload.invoice_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Invoice number already exists")

    invoice = Invoice(**payload.model_dump())
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    log_action(db, current_user.id, f"Created invoice {invoice.invoice_number}", "invoice", invoice.id)

    return invoice


@router.get("/", response_model=List[InvoiceOut])
def list_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Invoice).all()


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.put("/{invoice_id}", response_model=InvoiceOut)
def update_invoice(
    invoice_id: int,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    old_status = invoice.payment_status
    invoice.payment_status = payload.payment_status
    db.commit()
    db.refresh(invoice)

    log_action(
        db, current_user.id,
        f"Invoice {invoice.invoice_number} payment status: {old_status} -> {payload.payment_status}",
        "invoice", invoice.id,
    )

    return invoice