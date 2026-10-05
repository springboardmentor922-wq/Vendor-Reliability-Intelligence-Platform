from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Invoice, PurchaseOrder, Vendor, User, Payment
from auth import get_current_user
from notification_service import notify_user, notify_role, notify_roles


router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"]
)


# ============================================================
# HELPER - CONVERT INVOICE TO RESPONSE
# ============================================================

def invoice_response(db: Session, invoice: Invoice):
    po = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == invoice.purchase_order_id)
        .first()
    )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == invoice.vendor_id)
        .first()
    )

    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "purchase_order_id": invoice.purchase_order_id,
        "purchase_order_number": po.order_number if po else None,
        "vendor_id": invoice.vendor_id,
        "vendor_name": vendor.company_name if vendor else "Unknown Vendor",
        "invoice_date": invoice.invoice_date,
        "due_date": invoice.due_date,
        "amount": invoice.amount,
        "status": invoice.status,
        "verified_at": invoice.verified_at,
        "paid_at": invoice.paid_at,
        "rejection_reason": invoice.rejection_reason,
        "created_at": invoice.created_at
    }


# ============================================================
# GET ALL INVOICES
# ADMIN / FINANCE / AUDITOR
# ============================================================

@router.get("")
def get_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_roles = [
        "administrator",
        "finance_officer",
        "auditor"
    ]

    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view invoices"
        )

    invoices = (
        db.query(Invoice)
        .order_by(Invoice.id.desc())
        .all()
    )

    return [
        invoice_response(db, invoice)
        for invoice in invoices
    ]


# ============================================================
# GET MY INVOICES
# VENDOR ONLY
# ============================================================

@router.get("/vendor/my-invoices")
def get_my_vendor_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "vendor":
        raise HTTPException(
            status_code=403,
            detail="Only vendors can access their own invoices"
        )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.user_id == current_user.id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor profile not found"
        )

    invoices = (
        db.query(Invoice)
        .filter(Invoice.vendor_id == vendor.id)
        .order_by(Invoice.id.desc())
        .all()
    )

    return [
        invoice_response(db, invoice)
        for invoice in invoices
    ]


# ============================================================
# GET SINGLE INVOICE
# ADMIN / FINANCE / AUDITOR
# ============================================================

@router.get("/{invoice_id}")
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_roles = [
        "administrator",
        "finance_officer",
        "auditor"
    ]

    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view this invoice"
        )

    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )

    return invoice_response(db, invoice)


# ============================================================
# CREATE INVOICE FROM DELIVERED PO
# VENDOR / ADMIN
# ============================================================

@router.post("/from-purchase-order/{purchase_order_id}")
def create_invoice_from_purchase_order(
    purchase_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_roles = [
        "vendor",
        "administrator"
    ]

    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Only vendor or administrator can create an invoice"
        )

    po = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == purchase_order_id)
        .first()
    )

    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found"
        )

    if po.status != "delivered":
        raise HTTPException(
            status_code=400,
            detail="Invoice can only be created after the purchase order is delivered"
        )

    existing_invoice = (
        db.query(Invoice)
        .filter(Invoice.purchase_order_id == purchase_order_id)
        .first()
    )

    if existing_invoice:
        raise HTTPException(
            status_code=400,
            detail="An invoice already exists for this purchase order"
        )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == po.vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    # Vendor can create invoice only for their own PO
    if current_user.role == "vendor":
        if vendor.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only create invoices for your own purchase orders"
            )

    today = date.today()

    # Generate invoice number
    invoice_number = f"INV-{today.year}-{purchase_order_id:04d}"

    # Prevent invoice-number collision
    existing_number = (
        db.query(Invoice)
        .filter(Invoice.invoice_number == invoice_number)
        .first()
    )

    if existing_number:
        invoice_number = (
            f"INV-{today.year}-{purchase_order_id:04d}-"
            f"{datetime.now().strftime('%H%M%S')}"
        )

    invoice = Invoice(
        invoice_number=invoice_number,
        purchase_order_id=po.id,
        vendor_id=po.vendor_id,
        invoice_date=today,
        due_date=today + timedelta(days=30),
        amount=po.total_amount,
        status="pending"
    )

    db.add(invoice)

    # Flush so invoice_number/id are available before commit
    db.flush()

    # --------------------------------------------------------
    # NOTIFICATION - FINANCE
    # --------------------------------------------------------

    notify_role(
        db,
        "finance_officer",
        "New Invoice Submitted",
        f"Invoice {invoice.invoice_number} from {vendor.company_name} "
        f"has been submitted for verification.",
        "invoice"
    )

    # --------------------------------------------------------
    # NOTIFICATION - VENDOR
    # --------------------------------------------------------

    if vendor.user_id and vendor.user_id != current_user.id:
        notify_user(
            db,
            vendor.user_id,
            "Invoice Submitted",
            f"Invoice {invoice.invoice_number} has been submitted successfully.",
            "invoice"
        )

    db.commit()
    db.refresh(invoice)

    return {
        "message": "Invoice created successfully",
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "purchase_order_number": po.order_number,
        "vendor_name": vendor.company_name,
        "amount": invoice.amount,
        "status": invoice.status
    }


# ============================================================
# VERIFY INVOICE
# FINANCE ONLY
# ============================================================

@router.put("/{invoice_id}/verify")
def verify_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "finance_officer":
        raise HTTPException(
            status_code=403,
            detail="Only finance officers can verify invoices"
        )

    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )

    if invoice.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Only pending invoices can be verified"
        )

    invoice.status = "verified"
    invoice.verified_at = datetime.now()

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == invoice.vendor_id)
        .first()
    )

    # --------------------------------------------------------
    # NOTIFICATION - VENDOR
    # --------------------------------------------------------

    if vendor and vendor.user_id:
        notify_user(
            db,
            vendor.user_id,
            "Invoice Verified",
            f"Invoice {invoice.invoice_number} has been verified by Finance.",
            "invoice"
        )

    # --------------------------------------------------------
    # NOTIFICATION - ADMIN
    # --------------------------------------------------------

    notify_role(
        db,
        "administrator",
        "Invoice Verified",
        f"Invoice {invoice.invoice_number} has been verified successfully.",
        "invoice"
    )

    db.commit()
    db.refresh(invoice)

    return {
        "message": "Invoice verified successfully",
        "invoice_number": invoice.invoice_number,
        "status": invoice.status
    }


# ============================================================
# REJECT INVOICE
# FINANCE ONLY
# ============================================================

@router.put("/{invoice_id}/reject")
def reject_invoice(
    invoice_id: int,
    rejection_reason: str = "Invoice rejected by Finance",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "finance_officer":
        raise HTTPException(
            status_code=403,
            detail="Only finance officers can reject invoices"
        )

    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )

    if invoice.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Only pending invoices can be rejected"
        )

    invoice.status = "rejected"
    invoice.rejection_reason = rejection_reason

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == invoice.vendor_id)
        .first()
    )

    # --------------------------------------------------------
    # NOTIFICATION - VENDOR
    # --------------------------------------------------------

    if vendor and vendor.user_id:
        notify_user(
            db,
            vendor.user_id,
            "Invoice Rejected",
            f"Invoice {invoice.invoice_number} has been rejected. "
            f"Reason: {rejection_reason}",
            "invoice"
        )

    # --------------------------------------------------------
    # NOTIFICATION - ADMIN
    # --------------------------------------------------------

    notify_role(
        db,
        "administrator",
        "Invoice Rejected",
        f"Invoice {invoice.invoice_number} from "
        f"{vendor.company_name if vendor else 'Unknown Vendor'} has been rejected.",
        "invoice"
    )

    db.commit()
    db.refresh(invoice)

    return {
        "message": "Invoice rejected",
        "invoice_number": invoice.invoice_number,
        "status": invoice.status,
        "reason": invoice.rejection_reason
    }


# ============================================================
# PAY INVOICE
# FINANCE ONLY
#
# IMPORTANT:
# This creates BOTH:
# 1. Payment record
# 2. Paid invoice status
# ============================================================

@router.put("/{invoice_id}/pay")
def pay_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only Finance can process payments
    if current_user.role != "finance_officer":
        raise HTTPException(
            status_code=403,
            detail="Only finance officers can process payments"
        )

    # Find invoice
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )

    # Invoice must be verified before payment
    if invoice.status != "verified":
        raise HTTPException(
            status_code=400,
            detail="Only verified invoices can be paid"
        )

    # --------------------------------------------------------
    # CHECK IF PAYMENT ALREADY EXISTS
    # --------------------------------------------------------

    existing_payment = (
        db.query(Payment)
        .filter(Payment.invoice_id == invoice.id)
        .first()
    )

    if existing_payment:
        raise HTTPException(
            status_code=400,
            detail="Payment already exists for this invoice"
        )

    # --------------------------------------------------------
    # GENERATE PAYMENT NUMBER
    # --------------------------------------------------------

    last_payment = (
        db.query(Payment)
        .order_by(Payment.id.desc())
        .first()
    )

    if last_payment and last_payment.payment_number:
        try:
            last_number = int(
                last_payment.payment_number.split("-")[-1]
            )
            next_number = last_number + 1
        except (ValueError, IndexError):
            next_number = last_payment.id + 1
    else:
        next_number = 1

    payment_number = f"PAY-{date.today().year}-{next_number:04d}"

    # --------------------------------------------------------
    # CREATE PAYMENT RECORD
    # --------------------------------------------------------

    payment = Payment(
        payment_number=payment_number,
        invoice_id=invoice.id,
        purchase_order_id=invoice.purchase_order_id,
        vendor_id=invoice.vendor_id,
        amount=invoice.amount,
        payment_date=date.today(),
        payment_method="Bank Transfer",
        status="completed",
        remarks="Payment completed against invoice"
    )

    db.add(payment)

    # --------------------------------------------------------
    # MARK INVOICE AS PAID
    # --------------------------------------------------------

    invoice.status = "paid"
    invoice.paid_at = datetime.now()

    # --------------------------------------------------------
    # SAVE BOTH CHANGES
    # --------------------------------------------------------

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to complete payment"
        )

    db.refresh(invoice)
    db.refresh(payment)

    # --------------------------------------------------------
    # PAYMENT NOTIFICATION
    # --------------------------------------------------------

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == invoice.vendor_id)
        .first()
    )

    # Notify vendor
    if vendor and vendor.user_id:
        notify_user(
            db,
            vendor.user_id,
            "Payment Completed",
            f"Payment of ₹{invoice.amount} for invoice "
            f"{invoice.invoice_number} has been completed.",
            "payment"
        )

    # Notify administrator
    notify_role(
        db,
        "administrator",
        "Invoice Payment Completed",
        f"Payment for invoice {invoice.invoice_number} "
        f"has been completed successfully.",
        "payment"
    )

    db.commit()

    return {
        "message": "Invoice payment completed successfully",
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "invoice_status": invoice.status,
        "invoice_amount": invoice.amount,
        "payment_id": payment.id,
        "payment_number": payment.payment_number,
        "payment_amount": payment.amount,
        "payment_status": payment.status,
        "payment_date": payment.payment_date,
        "payment_method": payment.payment_method,
        "paid_at": invoice.paid_at
    }