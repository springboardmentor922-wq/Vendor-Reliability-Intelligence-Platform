"""Communication: vendor messaging threads, file sharing and activity logs."""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status
)
from sqlalchemy import or_
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import (
    get_current_user,
    require_auditor_or_staff,
    require_staff,
    vendor_scope
)
from models import (
    ActivityLog,
    Contract,
    Message as MessageModel,
    MessageAttachment,
    MessageThread,
    NotificationType,
    ProcurementRequest,
    PurchaseOrder,
    ThreadStatus,
    User,
    UserRole,
    Vendor
)
from schemas.common import Message
from schemas.communication import (
    THREAD_STATUSES,
    ActivityLogResponse,
    AttachmentResponse,
    MessageCreate,
    MessageResponse,
    ThreadCreate,
    ThreadDetail,
    ThreadResponse,
    ThreadUpdate
)
from services.events import log_activity, notify_roles, notify_user, notify_vendor_users

router = APIRouter(prefix="/communication", tags=["Communication"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

ALLOWED_UPLOAD_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "image/jpeg",
    "text/plain",
    "text/csv"
}


# =========================================================
# HELPERS
# =========================================================

def _get_thread(db: Session, thread_id: int) -> MessageThread:
    thread = (
        db.query(MessageThread)
        .filter(MessageThread.id == thread_id)
        .first()
    )

    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    return thread


def _assert_thread_access(current_user: User, thread: MessageThread) -> None:
    scope = vendor_scope(current_user)

    if scope is not None and thread.vendor_id != scope:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access conversations involving your organisation"
        )


def _message_response(message: MessageModel) -> MessageResponse:
    payload = MessageResponse.model_validate(message)
    payload.sender_name = message.sender.name if message.sender else None
    payload.sender_role = message.sender.role if message.sender else None
    payload.attachments = [
        AttachmentResponse.model_validate(a) for a in message.attachments
    ]
    return payload


def _thread_response(
    thread: MessageThread,
    current_user: User
) -> ThreadResponse:
    payload = ThreadResponse.model_validate(thread)
    payload.vendor_name = thread.vendor.vendor_name if thread.vendor else None
    payload.po_number = (
        thread.purchase_order.po_number if thread.purchase_order else None
    )
    payload.request_number = (
        thread.request.request_number if thread.request else None
    )
    payload.contract_number = (
        thread.contract.contract_number if thread.contract else None
    )
    payload.created_by_name = thread.creator.name if thread.creator else None
    payload.message_count = len(thread.messages)
    payload.unread_count = sum(
        1 for m in thread.messages
        if not m.is_read and m.sender_id != current_user.id
    )

    if thread.messages:
        last = thread.messages[-1]
        payload.last_message_preview = (
            last.body[:120] + "..." if len(last.body) > 120 else last.body
        )

    return payload


def _notify_thread_participants(
    db: Session,
    thread: MessageThread,
    sender: User
) -> None:
    """Notify the other side of the conversation about a new message."""

    preview = thread.subject

    if sender.role == UserRole.VENDOR:
        notify_roles(
            db,
            [UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER,
             UserRole.SUPPLY_CHAIN_MANAGER],
            NotificationType.MESSAGE,
            "New vendor message",
            f"{sender.name} replied on '{preview}'.",
            link=f"/communication/{thread.id}"
        )
        return

    if thread.vendor_id:
        notify_vendor_users(
            db, thread.vendor_id, NotificationType.MESSAGE,
            "New message from procurement",
            f"{sender.name} posted on '{preview}'.",
            link=f"/communication/{thread.id}"
        )

    if thread.created_by != sender.id:
        notify_user(
            db, thread.created_by, NotificationType.MESSAGE,
            "New reply on your conversation",
            f"{sender.name} replied on '{preview}'.",
            link=f"/communication/{thread.id}"
        )


# =========================================================
# REFERENCE DATA
# =========================================================

@router.get("/meta/statuses", response_model=list[str])
def list_statuses(current_user: User = Depends(get_current_user)):
    return THREAD_STATUSES


# =========================================================
# THREADS
# =========================================================

@router.get("/threads", response_model=list[ThreadResponse])
def list_threads(
    search: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    vendor_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(MessageThread)

    scope = vendor_scope(current_user)
    if scope is not None:
        query = query.filter(MessageThread.vendor_id == scope)

    if search:
        query = query.filter(MessageThread.subject.ilike(f"%{search.strip()}%"))

    if status_filter:
        query = query.filter(MessageThread.status == status_filter)

    if vendor_id:
        query = query.filter(MessageThread.vendor_id == vendor_id)

    threads = query.order_by(
        MessageThread.last_message_at.desc().nullslast(),
        MessageThread.id.desc()
    ).all()

    return [_thread_response(t, current_user) for t in threads]


@router.get("/threads/{thread_id}", response_model=ThreadDetail)
def get_thread(
    thread_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    thread = _get_thread(db, thread_id)
    _assert_thread_access(current_user, thread)

    # Opening a thread marks the other side's messages as read.
    for message in thread.messages:
        if message.sender_id != current_user.id:
            message.is_read = True

    db.commit()

    base = _thread_response(thread, current_user)

    payload = ThreadDetail(**base.model_dump())
    payload.unread_count = 0
    payload.messages = [_message_response(m) for m in thread.messages]

    return payload


@router.post(
    "/threads",
    response_model=ThreadDetail,
    status_code=status.HTTP_201_CREATED
)
def create_thread(
    payload: ThreadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    vendor_id = payload.vendor_id

    scope = vendor_scope(current_user)
    if scope is not None:
        # A supplier login can only open conversations about itself.
        vendor_id = scope

    if vendor_id and not db.query(Vendor).filter(Vendor.id == vendor_id).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )

    if payload.purchase_order_id and not db.query(PurchaseOrder).filter(
        PurchaseOrder.id == payload.purchase_order_id
    ).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found"
        )

    if payload.procurement_request_id and not db.query(ProcurementRequest).filter(
        ProcurementRequest.id == payload.procurement_request_id
    ).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Procurement request not found"
        )

    if payload.contract_id and not db.query(Contract).filter(
        Contract.id == payload.contract_id
    ).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )

    now = datetime.now(timezone.utc)

    thread = MessageThread(
        subject=payload.subject,
        vendor_id=vendor_id,
        purchase_order_id=payload.purchase_order_id,
        procurement_request_id=payload.procurement_request_id,
        contract_id=payload.contract_id,
        created_by=current_user.id,
        status=ThreadStatus.OPEN,
        priority=payload.priority,
        last_message_at=now
    )

    db.add(thread)
    db.flush()

    db.add(
        MessageModel(
            thread_id=thread.id,
            sender_id=current_user.id,
            body=payload.body
        )
    )

    log_activity(
        db, current_user.id, "Thread", thread.id, "Created",
        f"Conversation '{thread.subject}' started"
    )

    _notify_thread_participants(db, thread, current_user)

    db.commit()
    db.refresh(thread)

    return get_thread(thread.id, db, current_user)


@router.put("/threads/{thread_id}", response_model=ThreadResponse)
def update_thread(
    thread_id: int,
    payload: ThreadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    thread = _get_thread(db, thread_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(thread, field, value)

    log_activity(
        db, current_user.id, "Thread", thread.id, "Updated",
        f"Conversation '{thread.subject}' updated (status {thread.status})"
    )

    db.commit()
    db.refresh(thread)

    return _thread_response(thread, current_user)


@router.delete("/threads/{thread_id}", response_model=Message)
def delete_thread(
    thread_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    thread = _get_thread(db, thread_id)
    subject = thread.subject

    log_activity(
        db, current_user.id, "Thread", thread_id, "Deleted",
        f"Conversation '{subject}' deleted"
    )

    db.delete(thread)
    db.commit()

    return Message(message=f"Conversation '{subject}' deleted successfully")


# =========================================================
# MESSAGES
# =========================================================

@router.post(
    "/threads/{thread_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED
)
def post_message(
    thread_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    thread = _get_thread(db, thread_id)
    _assert_thread_access(current_user, thread)

    if thread.status == ThreadStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This conversation is closed and no longer accepts replies"
        )

    message = MessageModel(
        thread_id=thread.id,
        sender_id=current_user.id,
        body=payload.body
    )

    db.add(message)

    thread.last_message_at = datetime.now(timezone.utc)
    thread.status = (
        ThreadStatus.AWAITING_INTERNAL
        if current_user.role == UserRole.VENDOR
        else ThreadStatus.AWAITING_VENDOR
    )

    _notify_thread_participants(db, thread, current_user)

    db.commit()
    db.refresh(message)

    return _message_response(message)


# =========================================================
# FILE SHARING
# =========================================================

@router.post(
    "/messages/{message_id}/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED
)
async def upload_attachment(
    message_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    message = (
        db.query(MessageModel)
        .filter(MessageModel.id == message_id)
        .first()
    )

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    if message.sender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only attach files to your own messages"
        )

    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"File type '{file.content_type}' is not allowed. Permitted: "
                f"PDF, Word, Excel, CSV, plain text, PNG and JPEG."
            )
        )

    contents = await file.read()

    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Attachments are limited to 10 MB"
        )

    extension = os.path.splitext(file.filename or "")[1][:10]
    stored_name = f"{uuid.uuid4().hex}{extension}"
    stored_path = os.path.join(settings.UPLOAD_DIR, stored_name)

    with open(stored_path, "wb") as handle:
        handle.write(contents)

    attachment = MessageAttachment(
        message_id=message.id,
        file_name=file.filename or stored_name,
        file_path=stored_name,
        file_size=len(contents),
        content_type=file.content_type
    )

    db.add(attachment)

    log_activity(
        db, current_user.id, "Thread", message.thread_id, "File Shared",
        f"'{attachment.file_name}' shared in conversation {message.thread_id}"
    )

    db.commit()
    db.refresh(attachment)

    return attachment


# =========================================================
# ACTIVITY LOGS
# =========================================================

@router.get("/activity", response_model=list[ActivityLogResponse])
def list_activity(
    entity_type: Optional[str] = Query(default=None),
    entity_id: Optional[int] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auditor_or_staff)
):
    query = db.query(ActivityLog)

    if entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)

    if entity_id:
        query = query.filter(ActivityLog.entity_id == entity_id)

    entries = query.order_by(ActivityLog.id.desc()).limit(limit).all()

    responses = []

    for entry in entries:
        payload = ActivityLogResponse.model_validate(entry)
        payload.user_name = entry.user.name if entry.user else None
        responses.append(payload)

    return responses
