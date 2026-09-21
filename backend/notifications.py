"""Milestone-3: Notification System.

Event-triggered, in-app notifications. Notifications are created either
inline from business events (PO status change, vendor approval) or by
running the alert generators (delivery-delay, contract-expiry, compliance,
procurement alerts) against the live database.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

import models
from database import engine
from deps import get_current_user, get_db, require_role

router = APIRouter(prefix="/notifications", tags=["notifications"])

ALERT_TYPES = {
    "procurement",
    "delivery_delay",
    "vendor_approval",
    "contract_expiry",
    "compliance",
}


def create_notification(db: Session, user_id: int, title: str, message: str,
                        notification_type: str):
    """Create a single in-app notification row."""
    n = models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        is_read=False,
    )
    db.add(n)
    return n


def notify_roles(db: Session, roles: list[str], title: str, message: str,
                 notification_type: str):
    """Notify every user whose role is in `roles`."""
    users = db.query(models.User).filter(models.User.role.in_(roles)).all()
    for u in users:
        create_notification(db, u.id, title, message, notification_type)


def notify_user(db: Session, user_id: int, title: str, message: str,
                notification_type: str):
    return create_notification(db, user_id, title, message, notification_type)


# --------------------------------------------------------------------------
# Alert generators (run against live DB to surface actionable events)
# --------------------------------------------------------------------------

def generate_alerts(db: Session):
    """Create notifications for all currently-detectable risk events.

    Returns a summary of how many notifications were created per type.
    """
    from datetime import datetime as _dt
    now = _dt.now()
    counts: dict[str, int] = {}
    roles = ["admin", "procurement", "manager"]

    # 1. Contract-expiry alerts (within 90 days)
    contracts = db.query(models.Contract).filter(
        models.Contract.end_date >= now,
        models.Contract.end_date <= now + timedelta(days=90),
        models.Contract.status == "Active",
    ).all()
    for c in contracts:
        days_left = (c.end_date - now).days
        level = "within 30 days" if days_left <= 30 else (
            "within 60 days" if days_left <= 60 else "within 90 days")
        notify_roles(
            db, roles,
            "Contract Expiry Alert",
            f"Contract '{c.contract_name}' (vendor #{c.vendor_id}) expires "
            f"{level} ({c.end_date.strftime('%Y-%m-%d')}).",
            "contract_expiry",
        )
        counts["contract_expiry"] = counts.get("contract_expiry", 0) + 1

    # 2. Compliance alerts (contracts marked non-compliant)
    non_compliant = db.query(models.Contract).filter(
        models.Contract.compliance_status.notin_(["Compliant"]),
        models.Contract.status == "Active",
    ).all()
    for c in non_compliant:
        notify_roles(
            db, roles,
            "Compliance Notification",
            f"Contract '{c.contract_name}' is not marked Compliant "
            f"(status: {c.compliance_status}). Review documentation.",
            "compliance",
        )
        counts["compliance"] = counts.get("compliance", 0) + 1

    # 3. Delivery-delay alerts from the real dataset (high-risk suppliers)
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT product_card_id, product_name, reliability_score,
                   late_rate, risk_level
            FROM dataset_suppliers
            WHERE risk_level = 'High'
               OR late_rate > 60
            ORDER BY late_rate DESC
            LIMIT 10
        """)).fetchall()
    for r in rows:
        notify_roles(
            db, roles,
            "Delivery Delay Alert",
            f"Supplier '{r.product_name}' has {r.late_rate:.1f}% late "
            f"deliveries (reliability {r.reliability_score}). Risk: "
            f"{r.risk_level}. Consider expedited review.",
            "delivery_delay",
        )
        counts["delivery_delay"] = counts.get("delivery_delay", 0) + 1

    # 4. Procurement alerts (pending requests / orders past due)
    pending_prs = db.query(models.ProcurementRequest).filter(
        models.ProcurementRequest.status == "Pending").count()
    if pending_prs:
        notify_roles(
            db, roles,
            "Procurement Alert",
            f"{pending_prs} procurement request(s) are awaiting approval.",
            "procurement",
        )
        counts["procurement"] = counts.get("procurement", 0) + 1

    overdue_orders = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.expected_delivery < now,
        models.PurchaseOrder.status.in_(["Pending", "Approved"]),
    ).count()
    if overdue_orders:
        notify_roles(
            db, roles,
            "Procurement Alert",
            f"{overdue_orders} purchase order(s) are past their expected "
            f"delivery date.",
            "procurement",
        )
        counts["procurement"] = counts.get("procurement", 0) + 1

    return counts


# --------------------------------------------------------------------------
# API endpoints
# --------------------------------------------------------------------------

class TestNotification(BaseModel):
    notification_type: str  # one of ALERT_TYPES
    message: str | None = None


@router.get("")
def list_notifications(
    unread_only: bool = False,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(models.Notification.is_read == False)  # noqa: E712
    items = q.order_by(models.Notification.created_at.desc()).limit(100).all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "notification_type": n.notification_type,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in items
    ]


@router.get("/count/unread")
def unread_count(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False,  # noqa: E712
    ).count()
    return {"unread": count}


@router.put("/{notification_id}/read")
def mark_read(
    notification_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}


@router.put("/read-all")
def mark_all_read(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read"}


@router.post("/generate")
def trigger_alerts(
    current_user: models.User = Depends(
        require_role(["admin", "procurement", "manager"])),
    db: Session = Depends(get_db),
):
    """Scan live data and create alert notifications for detected events."""
    counts = generate_alerts(db)
    db.commit()
    created = sum(counts.values())
    return {
        "message": f"Alert generation complete ({created} notification(s))",
        "created": created,
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
    message = payload.message or (
        f"Test {payload.notification_type.replace('_', ' ')} notification "
        f"sent to your inbox.")
    notify_user(db, current_user.id, "Test Notification", message,
                payload.notification_type)
    db.commit()
    return {"message": "Test notification created"}