"""Per-user notification inbox."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from datetime import datetime

from database import get_db
from deps import get_current_user, require_procurement_or_supply_chain
from models import Notification, NotificationType, User
from schemas.common import Message
from services.notifier import run_alert_sweep

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    notification_type: str
    title: str
    message: str
    link: Optional[str] = None
    priority: str
    is_read: bool
    channel: str = "In-App"
    email_sent: bool = False
    sms_sent: bool = False
    event_key: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationSummary(BaseModel):
    total: int
    unread: int
    by_type: dict[str, int]
    by_priority: dict[str, int]


class SweepResult(BaseModel):
    """How many alerts each sweep raised or refreshed."""

    delivery_delays: int
    contract_expiry: int
    compliance: int
    vendor_approvals: int
    procurement: int
    predicted_delays: int
    total: int


@router.get("/meta/types", response_model=list[str])
def list_types(current_user: User = Depends(get_current_user)):
    return NotificationType.ALL


@router.get("/summary", response_model=NotificationSummary)
def notification_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    items = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .all()
    )

    by_type: dict[str, int] = {}
    by_priority: dict[str, int] = {}

    for item in items:
        by_type[item.notification_type] = by_type.get(item.notification_type, 0) + 1
        by_priority[item.priority] = by_priority.get(item.priority, 0) + 1

    return NotificationSummary(
        total=len(items),
        unread=sum(1 for i in items if not i.is_read),
        by_type=by_type,
        by_priority=by_priority
    )


@router.post("/sweep", response_model=SweepResult)
def trigger_sweep(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    """Re-derive every alert from the current state of the database.

    Each alert is keyed to the event that caused it, so running the sweep
    repeatedly refreshes the existing alerts rather than duplicating them.
    """

    results = run_alert_sweep(db)

    return SweepResult(**results, total=sum(results.values()))


@router.get("", response_model=list[NotificationResponse])
@router.get("/", response_model=list[NotificationResponse], include_in_schema=False)
def list_notifications(
    unread_only: bool = Query(default=False),
    notification_type: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id
    )

    if unread_only:
        query = query.filter(Notification.is_read.is_(False))

    if notification_type:
        query = query.filter(
            Notification.notification_type == notification_type
        )

    return query.order_by(Notification.id.desc()).limit(limit).all()


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    notification.is_read = True

    db.commit()
    db.refresh(notification)

    return notification


@router.post("/read-all", response_model=Message)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    updated = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False)
        )
        .update({Notification.is_read: True}, synchronize_session=False)
    )

    db.commit()

    return Message(message=f"{updated} notification(s) marked as read")


@router.delete("/{notification_id}", response_model=Message)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    db.delete(notification)
    db.commit()

    return Message(message="Notification deleted")
