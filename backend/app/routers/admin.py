import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User
from app.schemas import UserResponse, MessageResponse
from app.security import require_role

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

@router.get("/pending-users", response_model=List[UserResponse])
async def get_pending_users(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role("Administrator"))
):
    stmt = (
        select(User)
        .where(User.status == "PENDING")
        .options(selectinload(User.roles))
        .order_by(User.created_at.desc())
    )
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            status=u.status,
            roles=[r.name for r in u.roles],
            created_at=u.created_at
        )
        for u in users
    ]

@router.get("/all-users", response_model=List[UserResponse])
async def get_all_users(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role("Administrator"))
):
    stmt = (
        select(User)
        .options(selectinload(User.roles))
        .order_by(User.created_at.desc())
    )
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            status=u.status,
            roles=[r.name for r in u.roles],
            created_at=u.created_at
        )
        for u in users
    ]

@router.post("/users/{user_id}/approve", response_model=MessageResponse)
async def approve_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role("Administrator"))
):
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.status = "APPROVED"
    await db.commit()

    # Best-effort email + SMS — non-blocking, failures are logged not raised
    from app.email_service import send_vendor_approval_email
    from app.sms_service import send_vendor_approval_sms
    send_vendor_approval_email(user.email, user.full_name, "approved")
    send_vendor_approval_sms("", user.full_name, "approved")  # no phone stored on User; logs "skipping"

    return MessageResponse(message=f"User {user.email} has been approved successfully")

@router.post("/users/{user_id}/reject", response_model=MessageResponse)
async def reject_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_role("Administrator"))
):
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.status = "REJECTED"
    await db.commit()

    # Best-effort email + SMS
    from app.email_service import send_vendor_approval_email
    from app.sms_service import send_vendor_approval_sms
    send_vendor_approval_email(user.email, user.full_name, "rejected")
    send_vendor_approval_sms("", user.full_name, "rejected")

    return MessageResponse(message=f"User {user.email} has been rejected")
