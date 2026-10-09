"""Notification and alert services.

Provider-neutral: in-app notifications work without external credentials, while
email/SMS delivery can be layered on later through Celery providers.
"""

from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from deps import get_current_user, get_db, normalize_role, require_role

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
ALERT_TYPES = {
    "procurement",
    "delivery_delay",
    "vendor_approval",
    "contract_expiry",
    "compliance",
    "invoice",
}


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "procurement",
):
    item = models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        is_read=False,
    )
    db.add(item)
    return item


def notify_user(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "procurement",
):
    return create_notification(db, user_id, title, message, notification_type)


def notify_roles(
    db: Session,
    roles: list[str],
    title: str,
    message: str,
    notification_type: str = "procurement",
):
    allowed = {normalize_role(role) for role in roles}
    users = db.query(models.User).all()
    for user in users:
        if normalize_role(user.role) in allowed:
            create_notification(db, user.id, title, message, notification_type)


def generate_alerts(db: Session):
    counts = {key: 0 for key in ALERT_TYPES}
    now = datetime.utcnow()
    # Due/late POs
    for po in (
        db.query(models.PurchaseOrder)
        .filter(models.PurchaseOrder.status.in_(["Approved", "Ordered"]))
        .all()
    ):
        if po.expected_delivery and po.expected_delivery.replace(tzinfo=None) < now:
            create_notification(
                db,
                po.created_by,
                "Delivery delay detected",
                f"{po.po_number or 'PO #' + str(po.id)} is past its expected delivery date.",
                "delivery_delay",
            )
            counts["delivery_delay"] += 1
    # Contract expiry
    for c in db.query(models.Contract).filter(models.Contract.status == "Active").all():
        if c.end_date and 0 <= (c.end_date.replace(tzinfo=None) - now).days <= 60:
            target = c.vendor.users[0].id if c.vendor and c.vendor.users else None
            if target is None:
                notify_roles(
                    db,
                    ["administrator", "procurement_manager"],
                    "Contract expires soon",
                    f"{c.contract_name} expires in {(c.end_date.replace(tzinfo=None) - now).days} day(s).",
                    "contract_expiry",
                )
            else:
                create_notification(
                    db,
                    target,
                    "Contract expires soon",
                    f"{c.contract_name} expires in {(c.end_date.replace(tzinfo=None) - now).days} day(s).",
                    "contract_expiry",
                )
            counts["contract_expiry"] += 1
    # Compliance
    for c in (
        db.query(models.Contract)
        .filter(models.Contract.compliance_status.in_(["Pending", "Non-Compliant"]))
        .all()
    ):
        target = c.vendor.users[0].id if c.vendor and c.vendor.users else None
        if target is None:
            notify_roles(
                db,
                ["administrator", "procurement_manager"],
                "Compliance attention needed",
                f"{c.contract_name} is marked {c.compliance_status}.",
                "compliance",
            )
        else:
            create_notification(
                db,
                target,
                "Compliance attention needed",
                f"{c.contract_name} is marked {c.compliance_status}.",
                "compliance",
            )
        counts["compliance"] += 1
    # Overdue invoices
    for invoice in (
        db.query(models.Invoice).filter(models.Invoice.status == "Pending").all()
    ):
        if invoice.due_date and invoice.due_date.replace(tzinfo=None) < now:
            target = (
                invoice.vendor.users[0].id
                if invoice.vendor and invoice.vendor.users
                else None
            )
            if target is None:
                notify_roles(
                    db,
                    ["administrator", "finance_officer"],
                    "Invoice overdue",
                    f"{invoice.invoice_number} is past its due date.",
                    "invoice",
                )
            else:
                create_notification(
                    db,
                    target,
                    "Invoice overdue",
                    f"{invoice.invoice_number} is past its due date.",
                    "invoice",
                )
            counts["invoice"] += 1
    return counts


class TestNotification(BaseModel):
    notification_type: str = "procurement"
    message: str | None = None


@router.get("")
def list_notifications(
    limit: int = 100,
    unread_only: bool = False,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
    )
    if unread_only:
        query = query.filter(models.Notification.is_read.is_(False))
    rows = query.limit(min(max(limit, 1), 500)).all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "notification_type": n.notification_type,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in rows
    ]


@router.get("/count/unread")
def unread_count(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    count = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read.is_(False),
        )
        .count()
    )
    return {"count": count}


@router.put("/{notification_id}/read")
def mark_read(
    notification_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = (
        db.query(models.Notification)
        .filter(
            models.Notification.id == notification_id,
            models.Notification.user_id == current_user.id,
        )
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}


@router.put("/read-all")
def mark_all_read(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read.is_(False),
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read"}


@router.post("/generate")
def trigger_alerts(
    current_user: models.User = Depends(
        require_role(["administrator", "procurement_manager", "supply_chain_manager"])
    ),
    db: Session = Depends(get_db),
):
    counts = generate_alerts(db)
    db.commit()
    return {
        "message": "Alert scan completed",
        "created": sum(counts.values()),
        "breakdown": counts,
    }


@router.post("/test")
def send_test_notification(
    payload: TestNotification,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.notification_type not in ALERT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid notification type")
    notify_user(
        db,
        current_user.id,
        "Test notification",
        payload.message
        or f"Test {payload.notification_type.replace('_', ' ')} notification.",
        payload.notification_type,
    )
    db.commit()
    return {"message": "Test notification created"}
