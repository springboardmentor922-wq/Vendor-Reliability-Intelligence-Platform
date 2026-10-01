import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Role
from app.schemas import (
    RegisterRequest, LoginRequest, TokenResponse,
    RefreshTokenRequest, UserResponse, ResetPasswordRequest, MessageResponse
)
from app.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    blacklist_token,
    is_token_blacklisted,
    get_current_user
)
from app.telemetry import increment_sessions, decrement_sessions

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if user already exists
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # Fetch requested role from role_names or role
    requested_role_name = "Procurement Manager"
    if payload.role_names and len(payload.role_names) > 0 and payload.role_names[0].strip():
        requested_role_name = payload.role_names[0].strip()
    elif payload.role and payload.role.strip():
        requested_role_name = payload.role.strip()

    role_res = await db.execute(select(Role).where(Role.name == requested_role_name))
    role_obj = role_res.scalar_one_or_none()
    if not role_obj:
        # Fallback to Procurement Manager or create
        role_res = await db.execute(select(Role).where(Role.name == "Procurement Manager"))
        role_obj = role_res.scalar_one_or_none()
        if not role_obj:
            role_obj = Role(name="Procurement Manager")
            db.add(role_obj)
            await db.flush()

    new_user = User(
        email=payload.email.lower(),
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        status="PENDING", # Pending Administrator approval
        roles=[role_obj]
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        status=new_user.status,
        roles=[r.name for r in new_user.roles],
        created_at=new_user.created_at
    )

@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == payload.email.lower()).options(selectinload(User.roles))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.status != "APPROVED":
        raise HTTPException(
            status_code=403,
            detail=f"Account is {user.status.lower()}. Please wait for Administrator approval."
        )

    user_data = {
        "sub": str(user.id),
        "email": user.email,
        "roles": [r.name for r in user.roles]
    }
    access_token = create_access_token(user_data)
    refresh_token = create_refresh_token(user_data)

    increment_sessions()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            status=user.status,
            roles=[r.name for r in user.roles],
            created_at=user.created_at
        )
    )

@router.post("/refresh-token", response_model=TokenResponse)
async def refresh_token(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    token = payload.refresh_token
    if not token or await is_token_blacklisted(token):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked or missing")

    data = decode_token(token)
    if not data or data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id_str = data.get("sub")
    try:
        user_id = uuid.UUID(user_id_str)
    except Exception:
        raise HTTPException(status_code=401, detail="Malformed token")

    stmt = select(User).where(User.id == user_id).options(selectinload(User.roles))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or user.status != "APPROVED":
        raise HTTPException(status_code=403, detail="User account is inactive or not found")

    user_data = {
        "sub": str(user.id),
        "email": user.email,
        "roles": [r.name for r in user.roles]
    }
    new_access_token = create_access_token(user_data)
    new_refresh_token = create_refresh_token(user_data)

    # Blacklist the old refresh token to prevent replay
    await blacklist_token(token)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            status=user.status,
            roles=[r.name for r in user.roles],
            created_at=user.created_at
        )
    )

@router.post("/logout", response_model=MessageResponse)
async def logout(
    payload: Optional[RefreshTokenRequest] = None,
    authorization: str = Header(None)
):
    decrement_sessions()
    if payload and payload.refresh_token:
        await blacklist_token(payload.refresh_token)
    if authorization and authorization.startswith("Bearer "):
        access_tok = authorization.split(" ")[1]
        await blacklist_token(access_tok)
    return MessageResponse(message="Successfully logged out")

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        status=current_user.status,
        roles=[r.name for r in current_user.roles],
        created_at=current_user.created_at
    )

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == payload.email.lower())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        # Return generic message to avoid email enumeration
        return MessageResponse(message="If this account exists, password has been updated.")

    user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()
    return MessageResponse(message="Password reset successfully. You can now log in.")
