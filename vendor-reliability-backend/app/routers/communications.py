from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.communication import CommunicationMessage, AuditLog
from app.models.notification import Notification
from app.schemas.communication import MessageCreate, MessageResponse, AuditLogResponse

router = APIRouter(prefix="/communications", tags=["Communications"])

@router.get("/messages", response_model=List[MessageResponse])
def get_messages(
    vendor_id: Optional[int] = None,
    procurement_id: Optional[int] = None,
    purchase_order_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(CommunicationMessage)
    if vendor_id:
        query = query.filter(CommunicationMessage.vendor_id == vendor_id)
    if procurement_id:
        query = query.filter(CommunicationMessage.procurement_request_id == procurement_id)
    if purchase_order_id:
        query = query.filter(CommunicationMessage.purchase_order_id == purchase_order_id)
    return query.order_by(CommunicationMessage.created_at.asc()).all()

@router.post("/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_msg = CommunicationMessage(
        sender_id=current_user.id,
        recipient_id=data.recipient_id,
        vendor_id=data.vendor_id,
        procurement_request_id=data.procurement_request_id,
        purchase_order_id=data.purchase_order_id,
        subject=data.subject.strip(),
        message=data.message.strip(),
        attachment_name=data.attachment_name,
        attachment_url=data.attachment_url,
        is_read=False
    )
    db.add(new_msg)

    # Send notification to recipient if specified
    if data.recipient_id:
        notif = Notification(
            user_id=data.recipient_id,
            title=f"New message: {data.subject}",
            message=f"From {current_user.full_name}: {data.message[:100]}...",
            type="system",
            reference_id=new_msg.id,
            reference_type="message"
        )
        db.add(notif)

    db.commit()
    db.refresh(new_msg)
    return new_msg

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
