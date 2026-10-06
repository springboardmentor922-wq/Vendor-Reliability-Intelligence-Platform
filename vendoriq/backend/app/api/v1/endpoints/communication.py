from typing import List, Optional
from uuid import UUID
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.utils import log_activity, notify_user
from app.db.session_dep import get_db
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.models.communication import Message, ActivityLog, Notification
from app.schemas.communication import (
    MessageCreate,
    MessageOut,
    ActivityLogOut,
    NotificationOut,
)

router = APIRouter()


# ============================================================
# COMMUNICATION RECIPIENTS
# ============================================================

@router.get("/recipients")
def list_communication_recipients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return safe display data for the Communication recipient
    dropdowns. UUIDs remain internal to the frontend form.
    """

    allowed_roles = {
        UserRole.ADMIN,
        UserRole.PROCUREMENT_MANAGER,
        UserRole.SUPPLY_CHAIN_MANAGER,
        UserRole.VENDOR,
        UserRole.FINANCE_OFFICER,
        UserRole.AUDITOR,
    }

    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Communication access is not permitted for role '{current_user.role.value}'",
        )

    user_query = (
        db.query(User)
        .filter(
            User.is_active.is_(True),
            User.role.in_(
                [
                    UserRole.ADMIN,
                    UserRole.PROCUREMENT_MANAGER,
                    UserRole.SUPPLY_CHAIN_MANAGER,
                    UserRole.VENDOR,
                ]
            ),
        )
        .order_by(User.full_name.asc())
    )

    users = user_query.all()

    vendor_query = (
        db.query(Vendor)
        .filter(Vendor.is_active.is_(True))
        .order_by(Vendor.company_name.asc())
    )

    if current_user.role == UserRole.VENDOR:
        vendor_query = vendor_query.filter(
            Vendor.user_id == current_user.id
        )

    vendors = vendor_query.all()

    return {
        "users": [
            {
                "id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role.value,
            }
            for user in users
        ],
        "vendors": [
            {
                "id": str(vendor.id),
                "company_name": vendor.company_name,
                "contact_person": vendor.contact_person,
                "status": vendor.status.value,
            }
            for vendor in vendors
        ],
    }




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

@router.post("/{message_id}/attachment", response_model=MessageOut)
async def upload_message_attachment(
    message_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = db.query(Message).filter(Message.id == message_id).first()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if (
        message.sender_id != current_user.id
        and message.receiver_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only attach files to your own messages",
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    allowed_extensions = {
        ".pdf", ".doc", ".docx",
        ".xls", ".xlsx",
        ".png", ".jpg", ".jpeg",
        ".txt", ".csv", ".zip"
    }

    extension = os.path.splitext(file.filename)[1].lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{extension}' is not allowed",
        )

    upload_dir = os.path.abspath(
        os.path.join(settings.UPLOAD_DIR, "communications")
    )
    os.makedirs(upload_dir, exist_ok=True)

    stored_filename = f"{uuid.uuid4()}{extension}"
    file_path = os.path.join(upload_dir, stored_filename)

    try:
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)
    finally:
        await file.close()

    message.attachment_path = os.path.join(
        "communications",
        stored_filename
    )

    db.commit()
    db.refresh(message)

    log_activity(
        db,
        current_user.id,
        "file_attached",
        "message",
        message.id,
        file.filename,
    )

    return message


@router.get("/{message_id}/attachment")
def download_message_attachment(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = db.query(Message).filter(Message.id == message_id).first()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if (
        message.sender_id != current_user.id
        and message.receiver_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only access attachments from your own messages",
        )

    if not message.attachment_path:
        raise HTTPException(
            status_code=404,
            detail="No attachment found",
        )

    file_path = os.path.abspath(
        os.path.join(settings.UPLOAD_DIR, message.attachment_path)
    )

    if not os.path.isfile(file_path):
        raise HTTPException(
            status_code=404,
            detail="Attachment file not found",
        )

    return FileResponse(
        file_path,
        filename=os.path.basename(file_path),
    )