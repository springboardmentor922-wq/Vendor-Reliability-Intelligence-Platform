"""Standalone invoice management (Finance Officer)."""

from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user, require_finance, vendor_scope
from models import Invoice, InvoiceStatus, PurchaseOrder, User, Vendor
from schemas.common import Message
from schemas.purchase_order import InvoiceCreate, InvoiceResponse, InvoiceUpdate
from services.events import log_activity
from services.numbering import next_invoice_number

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def _get_invoice(db: Session, invoice_id: int) -> Invoice:
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    return invoice


def _to_response(invoice: Invoice) -> InvoiceResponse:
    payload = InvoiceResponse.model_validate(invoice)
    payload.vendor_name = invoice.vendor.vendor_name if invoice.vendor else None
    payload.po_number = (
        invoice.purchase_order.po_number if invoice.purchase_order else None
    )
    return payload


@router.get("/meta/statuses", response_model=list[str])
def list_statuses(current_user: User = Depends(get_current_user)):
    return InvoiceStatus.ALL


@router.get("", response_model=list[InvoiceResponse])
@router.get("/", response_model=list[InvoiceResponse], include_in_schema=False)
def list_invoices(
    search: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    vendor_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Invoice)

    scope = vendor_scope(current_user)
    if scope is not None:
        query = query.filter(Invoice.vendor_id == scope)

    if search:
        query = query.filter(Invoice.invoice_number.ilike(f"%{search.strip()}%"))

    if status_filter:
        query = query.filter(Invoice.status == status_filter)

    if vendor_id:
        query = query.filter(Invoice.vendor_id == vendor_id)

    return [
        _to_response(i)
        for i in query.order_by(Invoice.id.desc()).all()
    ]


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    invoice = _get_invoice(db, invoice_id)

    scope = vendor_scope(current_user)
    if scope is not None and invoice.vendor_id != scope:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access invoices belonging to your organisation"
        )

    return _to_response(invoice)


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
@router.post(
    "/",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False
)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance)
):
    vendor_id = payload.vendor_id
    po: Optional[PurchaseOrder] = None

    if payload.purchase_order_id:
        po = (
            db.query(PurchaseOrder)
            .filter(PurchaseOrder.id == payload.purchase_order_id)
            .first()
        )

        if not po:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase order not found"
            )

        vendor_id = po.vendor_id

    if vendor_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either vendor_id or purchase_order_id must be provided"
        )

    if not db.query(Vendor).filter(Vendor.id == vendor_id).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )

    invoice_number = payload.invoice_number or next_invoice_number(db)

    if db.query(Invoice).filter(Invoice.invoice_number == invoice_number).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice number '{invoice_number}' is already in use"
        )

    invoice = Invoice(
        invoice_number=invoice_number,
        purchase_order_id=payload.purchase_order_id,
        vendor_id=vendor_id,
        invoice_date=payload.invoice_date or date.today(),
        due_date=payload.due_date,
        amount=payload.amount,
        tax_amount=payload.tax_amount,
        total_amount=Decimal(payload.amount) + Decimal(payload.tax_amount),
        currency=payload.currency or (po.currency if po else "USD"),
        status=InvoiceStatus.PENDING,
        document_path=payload.document_path,
        notes=payload.notes
    )

    db.add(invoice)

    log_activity(
        db, current_user.id, "Invoice", None, "Created",
        f"Invoice {invoice_number} created"
    )

    db.commit()
    db.refresh(invoice)

    return _to_response(invoice)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance)
):
    invoice = _get_invoice(db, invoice_id)

    data = payload.model_dump(exclude_unset=True)

    if "status" in data and data["status"] not in InvoiceStatus.ALL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"status must be one of: {', '.join(InvoiceStatus.ALL)}"
        )

    for field, value in data.items():
        setattr(invoice, field, value)

    invoice.total_amount = (
        Decimal(invoice.amount or 0) + Decimal(invoice.tax_amount or 0)
    )

    if invoice.status == InvoiceStatus.PAID and not invoice.payment_date:
        invoice.payment_date = date.today()

    log_activity(
        db, current_user.id, "Invoice", invoice.id, "Updated",
        f"Invoice {invoice.invoice_number} updated (status {invoice.status})"
    )

    db.commit()
    db.refresh(invoice)

    return _to_response(invoice)


@router.delete("/{invoice_id}", response_model=Message)
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance)
):
    invoice = _get_invoice(db, invoice_id)

    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A paid invoice cannot be deleted"
        )

    number = invoice.invoice_number

    log_activity(
        db, current_user.id, "Invoice", invoice_id, "Deleted",
        f"Invoice {number} deleted"
    )

    db.delete(invoice)
    db.commit()

    return Message(message=f"Invoice {number} deleted successfully")
