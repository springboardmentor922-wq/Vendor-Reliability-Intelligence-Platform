import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Notification, User, PurchaseOrder
from app.schemas import NotificationResponse, MessageResponse
from app.security import get_current_user, require_role

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])

async def add_notification(
    db: AsyncSession,
    message: str,
    user_id: Optional[uuid.UUID] = None,
    notification_type: str = "general",
):
    """Helper to emit an in-app cross-party notification (with optional type)."""
    notif = Notification(
        user_id=user_id,
        message=message,
        is_read=False,
        type=notification_type,
    )
    db.add(notif)
    await db.flush()
    return notif

@router.get("", response_model=List[NotificationResponse])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    is_admin = any(r.name == "Administrator" for r in current_user.roles)
    if is_admin:
        # Admin can view all notifications
        stmt = select(Notification).order_by(Notification.created_at.desc()).limit(100)
    else:
        # Users see their notifications + broadcast notifications (user_id is None)
        stmt = (
            select(Notification)
            .where((Notification.user_id == current_user.id) | (Notification.user_id.is_(None)))
            .order_by(Notification.created_at.desc())
            .limit(100)
        )
    result = await db.execute(stmt)
    notifications = result.scalars().all()
    return notifications

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Notification).where(Notification.id == notification_id)
    result = await db.execute(stmt)
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    await db.commit()
    await db.refresh(notif)
    return notif

@router.patch("/read-all", response_model=MessageResponse)
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    is_admin = any(r.name == "Administrator" for r in current_user.roles)
    if is_admin:
        stmt = update(Notification).values(is_read=True)
    else:
        stmt = (
            update(Notification)
            .where((Notification.user_id == current_user.id) | (Notification.user_id.is_(None)))
            .values(is_read=True)
        )
    await db.execute(stmt)
    await db.commit()
    return MessageResponse(message="All notifications marked as read")

@router.post("/check-overdue", response_model=MessageResponse)
async def check_overdue_and_compliance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator"))
):
    """
    Admin-only: scan purchase orders older than 14 days in non-terminal
    states and emit delivery_delay notifications. Also triggers a
    compliance alert for POs with no vendor linked.
    Returns the count of alerts generated.
    """
    from app.email_service import send_delivery_delay_alert, send_compliance_flag_alert
    from app.sms_service import send_delivery_delay_sms, send_compliance_sms

    cutoff = datetime.utcnow() - timedelta(days=14)
    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.vendor))
        .where(
            PurchaseOrder.created_at < cutoff,
            PurchaseOrder.status.notin_(["DELIVERED", "COMPLETED", "CANCELLED"])
        )
    )
    result = await db.execute(stmt)
    overdue_pos = result.scalars().all()

    alerts_sent = 0
    for po in overdue_pos:
        msg = (
            f"⚠️ Delivery Delay: PO {po.po_number} has been open for >14 days "
            f"(status: {po.status})"
        )
        await add_notification(db, msg, notification_type="delivery_delay")

        vendor_email = None
        vendor_phone = None
        vendor_name = po.vendor.company_name if po.vendor else "Unknown"
        if po.vendor and po.vendor.contacts:
            vendor_email = po.vendor.contacts[0].email
            vendor_phone = po.vendor.contacts[0].phone or ""
        elif po.vendor and hasattr(po.vendor, "contact_email"):
            vendor_email = getattr(po.vendor, "contact_email", None)

        if vendor_email:
            send_delivery_delay_alert(vendor_email, vendor_name, po.po_number)
        # Best-effort SMS (logs stub if no phone)
        send_delivery_delay_sms(vendor_phone or "", po.po_number)

        alerts_sent += 1

    # Compliance: POs with null vendor_id
    compliance_stmt = (
        select(PurchaseOrder)
        .where(PurchaseOrder.vendor_id.is_(None))
    )
    comp_result = await db.execute(compliance_stmt)
    unlinked = comp_result.scalars().all()
    for po in unlinked:
        comp_msg = f"🚨 Compliance Flag: PO {po.po_number} has no vendor linked."
        await add_notification(db, comp_msg, notification_type="compliance")
        # Best-effort SMS compliance alert
        send_compliance_sms("", f"PO {po.po_number} has no vendor linked")
        alerts_sent += 1

    await db.commit()
    return MessageResponse(message=f"Overdue/compliance check complete. {alerts_sent} alert(s) generated.")

