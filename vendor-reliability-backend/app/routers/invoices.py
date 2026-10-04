from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from app.core.dependencies import get_db, get_current_user, require_roles
from app.models.user import User
from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder
from app.models.invoice import Invoice
from app.models.communication import AuditLog
from app.schemas.invoice import InvoiceCreate, InvoiceStatusUpdate, InvoiceResponse
from app.services.notification_service import send_notification_async
from app.services.blockchain_service import record_blockchain_audit_async

router = APIRouter(prefix="/invoices", tags=["Invoices"])

def format_invoice(inv: Invoice) -> InvoiceResponse:
    v_name = inv.vendor.name if inv.vendor else None
    v_comp = inv.vendor.company if (inv.vendor and inv.vendor.company) else v_name
    v_obj = {
        "id": inv.vendor.id,
        "name": v_name,
        "company": v_comp,
        "category": inv.vendor.category
    } if inv.vendor else None

    return InvoiceResponse(
        id=inv.id,
        invoice_number=inv.invoice_number,
        purchase_order_id=inv.purchase_order_id,
        vendor_id=inv.vendor_id,
        amount=inv.amount,
        status=inv.status,
        issue_date=inv.issue_date,
        due_date=inv.due_date,
        paid_date=inv.paid_date,
        payment_method=inv.payment_method,
        notes=inv.notes,
        created_at=inv.created_at,
        vendor_name=v_name,
        vendor_company=v_comp,
        vendor=v_obj,
        three_way_match_status=inv.three_way_match_status or "PENDING",
        blockchain_status=getattr(inv, "blockchain_status", "CONFIRMED")
    )

@router.get("", response_model=List[InvoiceResponse])
def get_invoices(
    status: Optional[str] = None,
    vendor_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Invoice).options(
        joinedload(Invoice.vendor),
        joinedload(Invoice.purchase_order)
    )
    if status and status.lower() != "all":
        query = query.filter(Invoice.status == status)
    if vendor_id:
        query = query.filter(Invoice.vendor_id == vendor_id)
    
    invoices = query.order_by(Invoice.id.desc()).all()
    return [format_invoice(inv) for inv in invoices]

@router.get("/{inv_id}", response_model=InvoiceResponse)
def get_invoice_by_id(
    inv_id: int,
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).options(
        joinedload(Invoice.vendor),
        joinedload(Invoice.purchase_order)
    ).filter(Invoice.id == inv_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return format_invoice(inv)

@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    data: InvoiceCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Administrator", "Finance Officer", "Vendor"]))
):
    count = db.query(Invoice).count() + 1
    invoice_number = f"INV-{datetime.utcnow().year}-{count:04d}"

    new_invoice = Invoice(
        invoice_number=invoice_number,
        purchase_order_id=data.purchase_order_id,
        vendor_id=data.vendor_id,
        amount=float(data.amount),
        status="Submitted",
        three_way_match_status="PENDING",
        issue_date=data.issue_date or datetime.utcnow(),
        due_date=data.due_date,
        payment_method=data.payment_method or "Bank Transfer",
        notes=data.notes
    )
    db.add(new_invoice)
    db.flush()

    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action="INVOICE_CREATED",
        entity_type="Invoice",
        entity_id=new_invoice.id,
        previous_status="NONE",
        new_status="Submitted",
        details=f"Created invoice {invoice_number} for amount ${data.amount:,.2f}"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_invoice)

    # Secondary notification and blockchain run asynchronously
    background_tasks.add_task(
        send_notification_async,
        title="New Invoice Submitted",
        message=f"Invoice {invoice_number} submitted for amount ${data.amount:,.2f}.",
        target_role="Finance Officer",
        ref_id=new_invoice.id,
        ref_type="Invoice",
        notif_type="approval"
    )

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="Invoice",
        entity_id=new_invoice.id,
        action="INVOICE_CREATED",
        actor_id=current_user.id,
        metadata={"invoice_number": invoice_number, "amount": data.amount, "vendor_id": data.vendor_id}
    )

    return format_invoice(new_invoice)

@router.put("/{inv_id}/status", response_model=InvoiceResponse)
def update_invoice_status(
    inv_id: int,
    data: InvoiceStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Administrator", "Finance Officer"]))
):
    inv = db.query(Invoice).options(joinedload(Invoice.vendor)).filter(Invoice.id == inv_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    prev_status = inv.status
    inv.status = data.status
    if data.paid_date:
        inv.paid_date = data.paid_date
    elif data.status.lower() == "paid" and not inv.paid_date:
        inv.paid_date = datetime.utcnow()
    if data.payment_method:
        inv.payment_method = data.payment_method

    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action="INVOICE_STATUS_UPDATED",
        entity_type="Invoice",
        entity_id=inv.id,
        previous_status=prev_status,
        new_status=inv.status,
        details=f"Invoice {inv.invoice_number} status updated to {inv.status}"
    )
    db.add(audit)
    db.commit()
    db.refresh(inv)

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="Invoice",
        entity_id=inv.id,
        action="INVOICE_STATUS_UPDATED",
        actor_id=current_user.id,
        metadata={"invoice_number": inv.invoice_number, "status": inv.status}
    )

    return format_invoice(inv)
