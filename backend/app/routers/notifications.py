from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta

from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.models.vendor import Vendor
from app.models.procurement import PurchaseOrder, Invoice
from app.models.contract import Contract, Certification
from app.models.enums import NotificationType, POStatus, ContractStatus, InvoiceStatus, VendorStatus
from app.schemas.analytics import NotificationResponse
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notification Engine"])

@router.get("", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns user notifications ordered by newest first.
    """
    return db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).limit(20).all()

@router.post("/scan-and-trigger")
def scan_and_trigger_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Event-driven background alert engine:
    Scans live database for delivery delays, contract renewals, overdue invoices,
    and unreviewed supplier onboarding requests.
    """
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    today_dt = datetime.utcnow()
    in_30_days = (today_dt + timedelta(days=30)).strftime("%Y-%m-%d")
    alerts_created = 0

    delayed_pos = db.query(PurchaseOrder).filter(
        PurchaseOrder.status.in_([POStatus.PENDING, POStatus.APPROVED, POStatus.ORDERED]),
        PurchaseOrder.expected_delivery_date < today_str
    ).all()

    for po in delayed_pos:
        vendor_name = po.vendor.company_name if po.vendor else "Supplier"
        msg = f"Delivery Delay Alert: Purchase Order {po.po_number} for {vendor_name} is overdue (Expected: {po.expected_delivery_date})."
        existing = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.message == msg).first()
        if not existing:
            notif = Notification(
                user_id=current_user.id,
                type=NotificationType.DELIVERY_DELAY,
                message=msg,
                is_read=False
            )
            db.add(notif)
            alerts_created += 1

    expiring_contracts = db.query(Contract).filter(
        Contract.end_date <= in_30_days,
        Contract.end_date >= today_str
    ).all()

    for c in expiring_contracts:
        vendor_name = c.vendor.company_name if c.vendor else "Supplier"
        msg = f"Contract Expiry Warning: Agreement '{c.title}' with {vendor_name} expires on {c.end_date}. Review renewal terms."
        existing = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.message == msg).first()
        if not existing:
            notif = Notification(
                user_id=current_user.id,
                type=NotificationType.CONTRACT_EXPIRY,
                message=msg,
                is_read=False
            )
            db.add(notif)
            alerts_created += 1

    pending_vendors = db.query(Vendor).filter(Vendor.status == VendorStatus.PENDING).all()
    if pending_vendors:
        msg = f"Vendor Approval Required: {len(pending_vendors)} new supplier registration(s) awaiting procurement verification."
        existing = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.message == msg).first()
        if not existing:
            notif = Notification(
                user_id=current_user.id,
                type=NotificationType.VENDOR_APPROVAL,
                message=msg,
                is_read=False
            )
            db.add(notif)
            alerts_created += 1

    overdue_invoices = db.query(Invoice).filter(
        Invoice.status == InvoiceStatus.PENDING,
        Invoice.due_date < today_str
    ).all()

    for inv in overdue_invoices:
        msg = f"Commercial Alert: Invoice {inv.invoice_number} (₹{inv.amount:,.2f}) is past due date ({inv.due_date})."
        existing = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.message == msg).first()
        if not existing:
            notif = Notification(
                user_id=current_user.id,
                type=NotificationType.PROCUREMENT_ALERT,
                message=msg,
                is_read=False
            )
            db.add(notif)
            alerts_created += 1

    certs = db.query(Certification).all()
    for c in certs:
        if c.expiry_date <= (today_dt + timedelta(days=30)).date():
            v_name = c.vendor.company_name if c.vendor else "Supplier"
            is_expired = c.expiry_date < today_dt.date()
            msg = f"Compliance Alert: {v_name}'s certification '{c.name}' {'has expired' if is_expired else 'expires soon'} ({c.expiry_date}). Audit compliance status."
            existing = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.message == msg).first()
            if not existing:
                notif = Notification(
                    user_id=current_user.id,
                    type=NotificationType.COMPLIANCE_ALERT,
                    message=msg,
                    is_read=False
                )
                db.add(notif)
                alerts_created += 1

    db.commit()

    if delayed_pos or expiring_contracts:
        urgency_msg = f"[VendorIQ SMS Alert] Urgent: {len(delayed_pos)} PO delivery delay(s) and {len(expiring_contracts)} contract renewal(s) detected. Please check dashboard."
        _SMS_GATEWAY_LOGS.append({
            "id": len(_SMS_GATEWAY_LOGS) + 1,
            "recipient_phone": "+91 98765 43210",
            "recipient_name": current_user.full_name,
            "message": urgency_msg,
            "status": "Delivered via SMS Gateway",
            "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        })

    return {"status": "success", "alerts_triggered": alerts_created, "sms_dispatched": len(delayed_pos) > 0 or len(expiring_contracts) > 0}

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif

@router.patch("/mark-all-read")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"status": "success", "message": "All notifications marked as read"}

_SMS_GATEWAY_LOGS = [
    {
        "id": 1,
        "recipient_phone": "+91 98765 43210",
        "recipient_name": "Marcus Vance",
        "message": "[VendorIQ SMS Gateway] Delivery Alert: PO-2026-F6124E from Apex Raw Materials marked dispatched.",
        "status": "Delivered via SMS Gateway",
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    }
]

@router.get("/sms-logs")
def get_sms_notification_logs(
    current_user: User = Depends(get_current_user)
):
    """
    Returns audit trail of SMS gateway notifications.
    """
    return _SMS_GATEWAY_LOGS[-25:]

@router.post("/send-sms")
def send_sms_notification(
    payload: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Dispatches a simulated real-time SMS notification.
    """
    phone = payload.get("recipient_phone") or "+91 98765 43210"
    msg = payload.get("message") or f"[VendorIQ SMS] Alert triggered by {current_user.full_name}"
    sms_entry = {
        "id": len(_SMS_GATEWAY_LOGS) + 1,
        "recipient_phone": phone,
        "recipient_name": payload.get("recipient_name") or current_user.full_name,
        "message": msg,
        "status": "Delivered via SMS Gateway",
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    }
    _SMS_GATEWAY_LOGS.append(sms_entry)
    return {"status": "success", "sms": sms_entry}
