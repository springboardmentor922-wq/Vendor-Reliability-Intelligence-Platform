import os
import shutil
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.database import get_db
from app.models import Vendor, Communication, ActivityLog, User, ProcurementRequest
from app.schemas import CommunicationCreate, CommunicationResponse, ActivityLogResponse
from app.security import get_current_user
from app.routers.notifications import add_notification

router = APIRouter(prefix="/api/v1/vendors", tags=["Communication"])

COMM_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "communication"
)
os.makedirs(COMM_UPLOAD_DIR, exist_ok=True)


async def _check_vendor_access(vendor_id: uuid.UUID, current_user: User, db: AsyncSession) -> Vendor:
    """
    Enforces RBAC:
    - Internal staff (Administrator, Procurement Manager, Supply Chain Manager, Finance Officer, Auditor)
      can access any vendor communication thread.
    - Vendor role users can only access the thread for their own vendor (verified via contact email).
    """
    stmt = select(Vendor).where(Vendor.id == vendor_id).options(selectinload(Vendor.contacts))
    vendor = (await db.execute(stmt)).scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    user_roles = [r.name for r in current_user.roles]
    is_staff = any(
        r in ["Administrator", "Procurement Manager", "Supply Chain Manager", "Finance Officer", "Auditor"]
        for r in user_roles
    )

    if "Vendor" in user_roles and not is_staff:
        # Verify contact email match
        has_match = any(c.email.lower() == current_user.email.lower() for c in (vendor.contacts or []))
        if not has_match:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You may only view and participate in your own vendor thread."
            )
    elif not is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have permission to access vendor communications."
        )

    return vendor


def _determine_sender_role(current_user: User) -> str:
    user_roles = [r.name for r in current_user.roles]
    is_staff = any(
        r in ["Administrator", "Procurement Manager", "Supply Chain Manager", "Finance Officer", "Auditor"]
        for r in user_roles
    )
    if "Vendor" in user_roles and not is_staff:
        return "Vendor"
    for role_candidate in ["Administrator", "Procurement Manager", "Supply Chain Manager", "Finance Officer", "Auditor"]:
        if role_candidate in user_roles:
            return role_candidate
    return user_roles[0] if user_roles else "Staff"


@router.post("/{vendor_id}/messages", response_model=CommunicationResponse, status_code=status.HTTP_201_CREATED)
async def send_vendor_message(
    vendor_id: uuid.UUID,
    payload: CommunicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a message tied to a vendor (optionally linked to a procurement request for discussions).
    Allowed for the vendor themselves (their own thread) and internal staff.
    Logs an entry in activity_logs and creates a cross-party notification.
    """
    vendor = await _check_vendor_access(vendor_id, current_user, db)

    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Validate optional procurement_request_id
    if payload.procurement_request_id:
        pr_stmt = select(ProcurementRequest).where(ProcurementRequest.id == payload.procurement_request_id)
        pr = (await db.execute(pr_stmt)).scalar_one_or_none()
        if not pr:
            raise HTTPException(status_code=404, detail="Linked procurement request not found")

    sender_role = _determine_sender_role(current_user)

    comm = Communication(
        vendor_id=vendor_id,
        procurement_request_id=payload.procurement_request_id,
        sender_id=current_user.id,
        sender_role=sender_role,
        message=payload.message.strip()
    )
    db.add(comm)

    # Activity Log
    truncated_msg = comm.message[:50] + "..." if len(comm.message) > 50 else comm.message
    activity = ActivityLog(
        user_id=current_user.id,
        action="SENT_MESSAGE",
        entity_type="vendor",
        entity_id=vendor_id,
        details=f"{current_user.full_name} ({sender_role}) sent message: \"{truncated_msg}\""
    )
    db.add(activity)

    # Notification Trigger
    if sender_role == "Vendor":
        # Notify internal staff (broadcast / general alert)
        notif_text = f"💬 New message from {vendor.company_name} ({current_user.full_name}): \"{truncated_msg}\""
        await add_notification(db, notif_text, notification_type="general")
    else:
        # Staff sending to vendor -> notify vendor user(s) and broadcast
        contact_emails = [c.email.lower() for c in (vendor.contacts or [])]
        if contact_emails:
            v_user_stmt = select(User).where(func.lower(User.email).in_(contact_emails))
            v_users = (await db.execute(v_user_stmt)).scalars().all()
            for vu in v_users:
                await add_notification(
                    db,
                    f"💬 Message from {current_user.full_name} ({sender_role}) for {vendor.company_name}: \"{truncated_msg}\"",
                    user_id=vu.id,
                    notification_type="general"
                )
        # Also broadcast so other team members see the update
        await add_notification(
            db,
            f"💬 {current_user.full_name} posted in {vendor.company_name} thread: \"{truncated_msg}\"",
            notification_type="general"
        )

    await db.commit()
    await db.refresh(comm)

    return CommunicationResponse(
        id=comm.id,
        vendor_id=comm.vendor_id,
        procurement_request_id=comm.procurement_request_id,
        sender_id=comm.sender_id,
        sender_name=current_user.full_name,
        sender_role=comm.sender_role,
        message=comm.message,
        attachment_path=comm.attachment_path,
        created_at=comm.created_at
    )


@router.get("/{vendor_id}/messages", response_model=List[CommunicationResponse])
async def get_vendor_messages(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Return message history for that vendor, ordered by created_at.
    Restricted so a Vendor role can only see their own vendor's thread, and internal staff can see any.
    """
    await _check_vendor_access(vendor_id, current_user, db)

    stmt = (
        select(Communication)
        .where(Communication.vendor_id == vendor_id)
        .options(selectinload(Communication.sender))
        .order_by(Communication.created_at.asc())
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()

    return [
        CommunicationResponse(
            id=m.id,
            vendor_id=m.vendor_id,
            procurement_request_id=m.procurement_request_id,
            sender_id=m.sender_id,
            sender_name=m.sender.full_name if m.sender else "System / Unknown",
            sender_role=m.sender_role,
            message=m.message,
            attachment_path=m.attachment_path,
            created_at=m.created_at
        )
        for m in messages
    ]


@router.post("/{vendor_id}/messages/{message_id}/attachment", response_model=CommunicationResponse)
async def upload_message_attachment(
    vendor_id: uuid.UUID,
    message_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload an attachment tied to a specific communication message.
    Uses local-storage pattern matching POs and contracts (backend/uploads/communication/).
    Logs an activity entry.
    """
    await _check_vendor_access(vendor_id, current_user, db)

    stmt = (
        select(Communication)
        .where(Communication.id == message_id, Communication.vendor_id == vendor_id)
        .options(selectinload(Communication.sender))
    )
    comm = (await db.execute(stmt)).scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=404, detail="Message not found")

    file_id = uuid.uuid4().hex[:8]
    safe_filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(COMM_UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    comm.attachment_path = safe_filename

    activity = ActivityLog(
        user_id=current_user.id,
        action="ATTACHED_FILE",
        entity_type="vendor",
        entity_id=vendor_id,
        details=f"{current_user.full_name} attached '{file.filename}' to message"
    )
    db.add(activity)

    await db.commit()
    await db.refresh(comm)

    return CommunicationResponse(
        id=comm.id,
        vendor_id=comm.vendor_id,
        procurement_request_id=comm.procurement_request_id,
        sender_id=comm.sender_id,
        sender_name=comm.sender.full_name if comm.sender else current_user.full_name,
        sender_role=comm.sender_role,
        message=comm.message,
        attachment_path=comm.attachment_path,
        created_at=comm.created_at
    )


@router.get("/{vendor_id}/messages/{message_id}/attachment")
async def download_message_attachment(
    vendor_id: uuid.UUID,
    message_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download/view attachment file for a communication message."""
    await _check_vendor_access(vendor_id, current_user, db)

    stmt = select(Communication).where(Communication.id == message_id, Communication.vendor_id == vendor_id)
    comm = (await db.execute(stmt)).scalar_one_or_none()
    if not comm or not comm.attachment_path:
        raise HTTPException(status_code=404, detail="Attachment not found")

    full_path = os.path.join(COMM_UPLOAD_DIR, comm.attachment_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    # original filename is after the first underscore
    parts = comm.attachment_path.split("_", 1)
    orig_name = parts[1] if len(parts) > 1 else comm.attachment_path
    return FileResponse(path=full_path, filename=orig_name)


@router.get("/{vendor_id}/activity", response_model=List[ActivityLogResponse])
async def get_vendor_activity(
    vendor_id: uuid.UUID,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Return recent activity log entries for that vendor.
    Restricted by RBAC (vendor only sees their own; internal staff sees any).
    """
    await _check_vendor_access(vendor_id, current_user, db)

    stmt = (
        select(ActivityLog)
        .where(ActivityLog.entity_id == vendor_id)
        .options(selectinload(ActivityLog.user))
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return [
        ActivityLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_name=log.user.full_name if log.user else "System",
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            details=log.details,
            created_at=log.created_at
        )
        for log in logs
    ]
