from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.utils import log_activity, notify_user
from app.db.session_dep import get_db
from app.models.user import User
from app.models.communication import Message, ActivityLog, Notification
from app.schemas.communication import MessageCreate, MessageOut, ActivityLogOut, NotificationOut

router = APIRouter()


@router.post("", response_model=MessageOut, status_code=201)
def send_message(payload: MessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Vendor Messaging / Procurement Discussions."""
    message = Message(sender_id=current_user.id, **payload.model_dump())
    db.add(message)
    db.commit()
    db.refresh(message)

    log_activity(db, current_user.id, "message_sent", "message", message.id, payload.subject or "(no subject)")
    if payload.receiver_id:
        notify_user(db, payload.receiver_id, "message", payload.subject or "New message", payload.body[:200], "message", message.id)
    return message


@router.get("", response_model=List[MessageOut])
def list_messages(
    vendor_id: Optional[UUID] = None,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Communication History: inbox + sent items for the current user."""
    query = db.query(Message).filter(
        or_(Message.sender_id == current_user.id, Message.receiver_id == current_user.id)
    )
    if vendor_id:
        query = query.filter(Message.vendor_id == vendor_id)
    if unread_only:
        query = query.filter(Message.receiver_id == current_user.id, Message.is_read == False)  # noqa: E712
    return query.order_by(Message.created_at.desc()).all()


@router.put("/{message_id}/read", response_model=MessageOut)
def mark_message_read(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not permitted")
    message.is_read = True
    db.commit()
    db.refresh(message)
    return message


@router.get("/activity-logs", response_model=List[ActivityLogOut])
def list_activity_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Activity Logs."""
    query = db.query(ActivityLog)
    if entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(ActivityLog.entity_id == entity_id)
    return query.order_by(ActivityLog.created_at.desc()).limit(limit).all()


@router.get("/notifications", response_model=List[NotificationOut])
def list_notifications(
    unread_only: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712
    return query.order_by(Notification.created_at.desc()).all()


@router.put("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif
