from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user, require_roles
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.models.communication import AuditLog
from app.schemas.auth import UserResponse, UserProfileUpdate

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=List[UserResponse])
def get_users(
    role: Optional[str] = None,
    approval_status: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Administrator", "Procurement Manager", "Auditor"]))
):
    query = db.query(User)
    if role and role != "All":
        query = query.filter(User.role == role)
    if approval_status and approval_status != "All":
        query = query.filter(User.approval_status == approval_status)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    return query.order_by(User.id.desc()).all()

@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}/profile", response_model=UserResponse)
def update_profile(
    user_id: int,
    data: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only self or Administrator can update profile
    if current_user.id != user_id and current_user.role != "Administrator":
        raise HTTPException(status_code=403, detail="Not authorized to edit this profile")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.full_name is not None:
        user.full_name = data.full_name.strip()
    if data.phone is not None:
        user.phone = data.phone.strip()
    if data.company is not None:
        user.company = data.company.strip()

    if data.new_password:
        if current_user.role != "Administrator":
            if not data.current_password or not verify_password(data.current_password, user.hashed_password):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
        user.hashed_password = hash_password(data.new_password)

    db.commit()
    db.refresh(user)
    return user

class UserStatusUpdate(BaseModel):
    is_active: bool

class UserRoleUpdate(BaseModel):
    role: str

@router.put("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    data: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Administrator"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id and not data.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrator cannot deactivate their own account."
        )
    user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    
    audit = AuditLog(
        user_id=current_user.id,
        action="USER_STATUS_UPDATED",
        entity_type="User",
        entity_id=user.id,
        details=f"Admin {current_user.email} updated user {user.email} status to {'Active' if user.is_active else 'Inactive'}"
    )
    db.add(audit)
    db.commit()
    return user

@router.put("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    data: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Administrator"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    old_role = user.role
    user.role = data.role
    db.commit()
    db.refresh(user)
    
    audit = AuditLog(
        user_id=current_user.id,
        action="USER_ROLE_UPDATED",
        entity_type="User",
        entity_id=user.id,
        details=f"Admin {current_user.email} changed user {user.email} role from {old_role} to {data.role}"
    )
    db.add(audit)
    db.commit()
    return user

