"""Administrator user management."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from deps import require_admin
from models import User, UserRole, Vendor
from schemas.auth import UserAdminUpdate, UserCreateByAdmin, UserResponse
from schemas.common import Message
from security import hash_password
from services.events import log_activity

router = APIRouter(prefix="/users", tags=["User Management"])


def _get_user(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


@router.get("/meta/roles", response_model=list[str])
def list_roles(current_user: User = Depends(require_admin)):
    return UserRole.ALL


@router.get("", response_model=list[UserResponse])
@router.get("/", response_model=list[UserResponse], include_in_schema=False)
def list_users(
    search: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    query = db.query(User)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.name.ilike(pattern),
                User.email.ilike(pattern),
                User.department.ilike(pattern)
            )
        )

    if role:
        query = query.filter(User.role == role)

    if is_active is not None:
        query = query.filter(User.is_active.is_(is_active))

    return query.order_by(User.id.asc()).all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    return _get_user(db, user_id)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False
)
def create_user(
    payload: UserCreateByAdmin,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )

    if payload.role == UserRole.VENDOR:
        if payload.vendor_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="vendor_id is required for a Vendor account"
            )

        if not db.query(Vendor).filter(Vendor.id == payload.vendor_id).first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        phone=payload.phone,
        department=payload.department,
        job_title=payload.job_title,
        vendor_id=payload.vendor_id if payload.role == UserRole.VENDOR else None,
        is_active=payload.is_active
    )

    db.add(user)
    db.flush()

    log_activity(
        db, current_user.id, "User", user.id, "Created",
        f"Account for {user.email} created with role {user.role}"
    )

    db.commit()
    db.refresh(user)

    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user = _get_user(db, user_id)

    data = payload.model_dump(exclude_unset=True)

    if "email" in data and data["email"] != user.email:
        if db.query(User).filter(User.email == data["email"]).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists"
            )

    # Don't let the last active administrator lock everyone out.
    if user.id == current_user.id:
        if data.get("is_active") is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own account"
            )

        if "role" in data and data["role"] != UserRole.ADMINISTRATOR:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot remove your own administrator role"
            )

    for field, value in data.items():
        setattr(user, field, value)

    if user.role != UserRole.VENDOR:
        user.vendor_id = None

    log_activity(
        db, current_user.id, "User", user.id, "Updated",
        f"Account {user.email} updated"
    )

    db.commit()
    db.refresh(user)

    return user


@router.post("/{user_id}/deactivate", response_model=UserResponse)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account"
        )

    user = _get_user(db, user_id)
    user.is_active = False

    log_activity(
        db, current_user.id, "User", user.id, "Deactivated",
        f"Account {user.email} deactivated"
    )

    db.commit()
    db.refresh(user)

    return user


@router.post("/{user_id}/activate", response_model=UserResponse)
def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user = _get_user(db, user_id)
    user.is_active = True

    log_activity(
        db, current_user.id, "User", user.id, "Activated",
        f"Account {user.email} activated"
    )

    db.commit()
    db.refresh(user)

    return user


@router.delete("/{user_id}", response_model=Message)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )

    user = _get_user(db, user_id)
    email = user.email

    # Users are referenced by requests, orders and audit rows; deactivate
    # rather than break those foreign keys.
    user.is_active = False

    log_activity(
        db, current_user.id, "User", user.id, "Deactivated",
        f"Account {email} deactivated in place of deletion"
    )

    db.commit()

    return Message(
        message=(
            f"Account {email} has transaction history and was deactivated "
            f"instead of deleted"
        )
    )
