from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Payment, Invoice, Vendor
from schemas import PaymentCreate, PaymentUpdate, PaymentResponse
from auth import require_role

from notification_service import notify_user, notify_role, notify_roles


router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)


# ============================================================
# PAYMENT SUMMARY
# ============================================================
@router.get("/summary")
def get_payment_summary(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role(
            "administrator",
            "finance_officer",
            "auditor"
        )
    )
):
    total_invoice_value = (
        db.query(
            func.coalesce(
                func.sum(Invoice.amount),
                0
            )
        )
        .filter(Invoice.status != "rejected")
        .scalar()
    )

    completed_payment_value = (
        db.query(
            func.coalesce(
                func.sum(Payment.amount),
                0
            )
        )
        .filter(
            Payment.status == "completed"
        )
        .scalar()
    )

    total_invoice_value = Decimal(
        str(total_invoice_value or 0)
    )

    completed_payment_value = Decimal(
        str(completed_payment_value or 0)
    )

    pending_value = (
        total_invoice_value -
        completed_payment_value
    )

    if pending_value < 0:
        pending_value = Decimal("0.00")

    if total_invoice_value > 0:
        payment_completion = (
            completed_payment_value /
            total_invoice_value
        ) * Decimal("100")
    else:
        payment_completion = Decimal("0.00")

    payment_completion = payment_completion.quantize(
        Decimal("0.01")
    )

    total_invoices = (
        db.query(Invoice)
        .filter(
            Invoice.status != "rejected"
        )
        .count()
    )

    paid_invoices = (
        db.query(Invoice)
        .filter(
            Invoice.status == "paid"
        )
        .count()
    )

    verified_invoices = (
        db.query(Invoice)
        .filter(
            Invoice.status == "verified"
        )
        .count()
    )

    pending_invoices = (
        db.query(Invoice)
        .filter(
            Invoice.status == "pending"
        )
        .count()
    )

    completed_payments = (
        db.query(Payment)
        .filter(
            Payment.status == "completed"
        )
        .count()
    )

    return {
        "total_financial_value": total_invoice_value,
        "completed_value": completed_payment_value,
        "pending_value": pending_value,
        "payment_completion": payment_completion,
        "total_invoices": total_invoices,
        "paid_invoices": paid_invoices,
        "verified_invoices": verified_invoices,
        "pending_invoices": pending_invoices,
        "completed_payments": completed_payments
    }


# ============================================================
# GET ALL PAYMENTS
# ============================================================
@router.get(
    "",
    response_model=list[PaymentResponse]
)
def get_payments(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role(
            "administrator",
            "finance_officer",
            "auditor"
        )
    )
):
    payments = (
        db.query(Payment)
        .order_by(Payment.id.desc())
        .all()
    )

    return payments


# ============================================================
# GET SINGLE PAYMENT
# ============================================================
@router.get(
    "/{payment_id}",
    response_model=PaymentResponse
)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role(
            "administrator",
            "finance_officer",
            "auditor"
        )
    )
):
    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id
        )
        .first()
    )

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found"
        )

    return payment


# ============================================================
# CREATE PAYMENT
# ============================================================
@router.post(
    "",
    response_model=PaymentResponse
)
def create_payment(
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role(
            "administrator",
            "finance_officer"
        )
    )
):
    # --------------------------------------------------------
    # FIND INVOICE
    # --------------------------------------------------------
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == payment_data.invoice_id
        )
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )

    # --------------------------------------------------------
    # ONLY VERIFIED INVOICES CAN BE PAID
    # --------------------------------------------------------
    if invoice.status != "verified":
        raise HTTPException(
            status_code=400,
            detail="Only verified invoices can be paid"
        )

    # --------------------------------------------------------
    # CHECK EXISTING PAYMENT
    # --------------------------------------------------------
    existing_payment = (
        db.query(Payment)
        .filter(
            Payment.invoice_id == invoice.id,
            Payment.status.notin_(
                ["failed", "cancelled"]
            )
        )
        .first()
    )

    if existing_payment:
        raise HTTPException(
            status_code=400,
            detail="A payment already exists for this invoice"
        )

    # --------------------------------------------------------
    # PAYMENT AMOUNT
    # If frontend does not send amount,
    # invoice amount will automatically be used.
    # --------------------------------------------------------
    amount = (
        payment_data.amount
        if payment_data.amount is not None
        else invoice.amount
    )

    amount = Decimal(str(amount))

    if amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Payment amount must be greater than zero"
        )

    if amount > invoice.amount:
        raise HTTPException(
            status_code=400,
            detail="Payment amount cannot exceed invoice amount"
        )

    # --------------------------------------------------------
    # GENERATE PAYMENT NUMBER
    # --------------------------------------------------------
    last_payment = (
        db.query(Payment)
        .order_by(Payment.id.desc())
        .first()
    )

    if last_payment:
        next_number = last_payment.id + 1
    else:
        next_number = 1

    payment_number = (
        f"PAY-{datetime.now().year}-{next_number:04d}"
    )

    # --------------------------------------------------------
    # PAYMENT STATUS
    # Default = completed
    # --------------------------------------------------------
    payment_status = (
        payment_data.status
        if payment_data.status is not None
        else "completed"
    )

    # --------------------------------------------------------
    # DEFAULT TRANSACTION REFERENCE
    # If user leaves it empty, backend generates one.
    # --------------------------------------------------------
    if payment_data.transaction_reference:
        transaction_reference = (
            payment_data.transaction_reference
        )
    else:
        transaction_reference = (
            f"NEFT"
            f"{datetime.now().strftime('%Y%m%d')}"
            f"{next_number:04d}"
        )

    # --------------------------------------------------------
    # DEFAULT REMARKS
    # --------------------------------------------------------
    if payment_data.remarks:
        remarks = payment_data.remarks
    else:
        remarks = (
            f"Payment completed against invoice "
            f"{invoice.invoice_number}"
        )

    # --------------------------------------------------------
    # CREATE PAYMENT
    # --------------------------------------------------------
    payment = Payment(
        payment_number=payment_number,
        invoice_id=invoice.id,
        purchase_order_id=invoice.purchase_order_id,
        vendor_id=invoice.vendor_id,
        amount=amount,
        payment_date=payment_data.payment_date,
        payment_method=payment_data.payment_method,
        transaction_reference=transaction_reference,
        status=payment_status,
        remarks=remarks
    )

    db.add(payment)

    # --------------------------------------------------------
    # IF PAYMENT IS COMPLETED,
    # MARK INVOICE AS PAID
    # --------------------------------------------------------
    if payment_status == "completed":
        invoice.status = "paid"
        invoice.paid_at = datetime.now()

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------
    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == invoice.vendor_id
        )
        .first()
    )

    if payment_status == "completed":

        if vendor and vendor.user_id:
            notify_user(
                db,
                vendor.user_id,
                "Payment Completed",
                f"Payment {payment_number} of ₹{amount} has been completed for invoice {invoice.invoice_number}.",
                "payment"
            )

        notify_role(
            db,
            "administrator",
            "Payment Completed",
            f"Payment {payment_number} for invoice {invoice.invoice_number} has been completed successfully.",
            "payment"
        )

    elif payment_status == "processing":

        if vendor and vendor.user_id:
            notify_user(
                db,
                vendor.user_id,
                "Payment Processing",
                f"Payment {payment_number} for invoice {invoice.invoice_number} is being processed.",
                "payment"
            )

    elif payment_status == "failed":

        if vendor and vendor.user_id:
            notify_user(
                db,
                vendor.user_id,
                "Payment Failed",
                f"Payment {payment_number} for invoice {invoice.invoice_number} has failed.",
                "payment"
            )

        notify_roles(
            db,
            [
                "administrator",
                "finance_officer"
            ],
            "Payment Failed",
            f"Payment {payment_number} for invoice {invoice.invoice_number} has failed.",
            "payment"
        )

    elif payment_status == "cancelled":

        if vendor and vendor.user_id:
            notify_user(
                db,
                vendor.user_id,
                "Payment Cancelled",
                f"Payment {payment_number} for invoice {invoice.invoice_number} has been cancelled.",
                "payment"
            )

        notify_roles(
            db,
            [
                "administrator",
                "finance_officer"
            ],
            "Payment Cancelled",
            f"Payment {payment_number} for invoice {invoice.invoice_number} has been cancelled.",
            "payment"
        )

    # --------------------------------------------------------
    # SAVE
    # --------------------------------------------------------
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create payment"
        )

    db.refresh(payment)

    return payment


# ============================================================
# UPDATE PAYMENT
# ============================================================
@router.put(
    "/{payment_id}",
    response_model=PaymentResponse
)
def update_payment(
    payment_id: int,
    payment_data: PaymentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role(
            "administrator",
            "finance_officer"
        )
    )
):
    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id
        )
        .first()
    )

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found"
        )

    old_status = payment.status

    # --------------------------------------------------------
    # PAYMENT DATE
    # --------------------------------------------------------
    if payment_data.payment_date is not None:
        payment.payment_date = (
            payment_data.payment_date
        )

    # --------------------------------------------------------
    # AMOUNT
    # --------------------------------------------------------
    if payment_data.amount is not None:
        amount = Decimal(
            str(payment_data.amount)
        )

        if amount <= 0:
            raise HTTPException(
                status_code=400,
                detail="Payment amount must be greater than zero"
            )

        invoice = (
            db.query(Invoice)
            .filter(
                Invoice.id == payment.invoice_id
            )
            .first()
        )

        if invoice and amount > invoice.amount:
            raise HTTPException(
                status_code=400,
                detail="Payment amount cannot exceed invoice amount"
            )

        payment.amount = amount

    # --------------------------------------------------------
    # PAYMENT METHOD
    # --------------------------------------------------------
    if payment_data.payment_method is not None:
        payment.payment_method = (
            payment_data.payment_method
        )

    # --------------------------------------------------------
    # TRANSACTION REFERENCE
    # --------------------------------------------------------
    if payment_data.transaction_reference is not None:
        if payment_data.transaction_reference.strip():
            payment.transaction_reference = (
                payment_data.transaction_reference
            )

    # --------------------------------------------------------
    # REMARKS
    # --------------------------------------------------------
    if payment_data.remarks is not None:
        if payment_data.remarks.strip():
            payment.remarks = (
                payment_data.remarks
            )

    # --------------------------------------------------------
    # STATUS
    # --------------------------------------------------------
    if payment_data.status is not None:
        payment.status = payment_data.status

    # --------------------------------------------------------
    # FIND INVOICE
    # --------------------------------------------------------
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == payment.invoice_id
        )
        .first()
    )

    # --------------------------------------------------------
    # SYNC PAYMENT STATUS WITH INVOICE
    # --------------------------------------------------------
    if invoice:
        if payment.status == "completed":
            invoice.status = "paid"
            invoice.paid_at = datetime.now()

        elif (
            old_status == "completed"
            and payment.status != "completed"
        ):
            invoice.status = "verified"
            invoice.paid_at = None

    # --------------------------------------------------------
    # NOTIFICATIONS
    # Only send notification when status actually changes.
    # --------------------------------------------------------
    if payment.status != old_status:

        vendor = (
            db.query(Vendor)
            .filter(
                Vendor.id == payment.vendor_id
            )
            .first()
        )

        if payment.status == "completed":

            if vendor and vendor.user_id:
                notify_user(
                    db,
                    vendor.user_id,
                    "Payment Completed",
                    f"Payment {payment.payment_number} has been completed successfully.",
                    "payment"
                )

            notify_role(
                db,
                "administrator",
                "Payment Completed",
                f"Payment {payment.payment_number} has been completed.",
                "payment"
            )

        elif payment.status == "processing":

            if vendor and vendor.user_id:
                notify_user(
                    db,
                    vendor.user_id,
                    "Payment Processing",
                    f"Payment {payment.payment_number} is being processed.",
                    "payment"
                )

            notify_role(
                db,
                "finance_officer",
                "Payment Processing",
                f"Payment {payment.payment_number} is now being processed.",
                "payment"
            )

        elif payment.status == "failed":

            if vendor and vendor.user_id:
                notify_user(
                    db,
                    vendor.user_id,
                    "Payment Failed",
                    f"Payment {payment.payment_number} has failed.",
                    "payment"
                )

            notify_roles(
                db,
                [
                    "administrator",
                    "finance_officer"
                ],
                "Payment Failed",
                f"Payment {payment.payment_number} has failed.",
                "payment"
            )

        elif payment.status == "cancelled":

            if vendor and vendor.user_id:
                notify_user(
                    db,
                    vendor.user_id,
                    "Payment Cancelled",
                    f"Payment {payment.payment_number} has been cancelled.",
                    "payment"
                )

            notify_roles(
                db,
                [
                    "administrator",
                    "finance_officer"
                ],
                "Payment Cancelled",
                f"Payment {payment.payment_number} has been cancelled.",
                "payment"
            )

    # --------------------------------------------------------
    # SAVE
    # --------------------------------------------------------
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update payment"
        )

    db.refresh(payment)

    return payment


# ============================================================
# CANCEL PAYMENT
# ============================================================
@router.delete(
    "/{payment_id}"
)
def cancel_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role(
            "administrator",
            "finance_officer"
        )
    )
):
    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id
        )
        .first()
    )

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found"
        )

    payment.status = "cancelled"

    # --------------------------------------------------------
    # FIND INVOICE
    # --------------------------------------------------------
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == payment.invoice_id
        )
        .first()
    )

    # --------------------------------------------------------
    # MOVE INVOICE BACK TO VERIFIED
    # --------------------------------------------------------
    if invoice and invoice.status == "paid":
        invoice.status = "verified"
        invoice.paid_at = None

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------
    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == payment.vendor_id
        )
        .first()
    )

    if vendor and vendor.user_id:
        notify_user(
            db,
            vendor.user_id,
            "Payment Cancelled",
            f"Payment {payment.payment_number} has been cancelled.",
            "payment"
        )

    notify_roles(
        db,
        [
            "administrator",
            "finance_officer"
        ],
        "Payment Cancelled",
        f"Payment {payment.payment_number} has been cancelled.",
        "payment"
    )

    # --------------------------------------------------------
    # SAVE
    # --------------------------------------------------------
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to cancel payment"
        )

    return {
        "message": "Payment cancelled successfully",
        "payment_id": payment.id,
        "payment_number": payment.payment_number,
        "status": payment.status
    }