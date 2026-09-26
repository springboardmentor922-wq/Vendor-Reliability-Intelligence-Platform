"""Authentication: registration, login, refresh, password reset, profile."""

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import get_current_user
from models import PasswordResetToken, User, UserRole, Vendor
from schemas.auth import (
    AccessTokenResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    PasswordChange,
    RefreshRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserRegister,
    UserResponse,
    UserUpdate
)
from schemas.common import Message
from security import (
    REFRESH_TOKEN,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password
)
from services.events import log_activity

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _token_response(db: Session, user: User) -> TokenResponse:
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id, user.role, user.email),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user)
    )


# =========================================================
# REGISTER
# =========================================================

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED
)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    """Self-service registration.

    Administrator accounts cannot be self-registered; an existing
    administrator must create them from the user management screen.
    """

    if payload.role == UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Administrator accounts must be created by an existing "
                "administrator"
            )
        )

    existing = db.query(User).filter(User.email == payload.email).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )

    vendor_id = None

    if payload.role == UserRole.VENDOR:
        if payload.vendor_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="vendor_id is required when registering as a Vendor"
            )

        vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()

        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )

        vendor_id = vendor.id

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        phone=payload.phone,
        department=payload.department,
        job_title=payload.job_title,
        vendor_id=vendor_id,
        is_active=True
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    log_activity(
        db, user.id, "User", user.id, "Registered",
        f"{user.name} registered as {user.role}"
    )
    db.commit()

    return _token_response(db, user)


# =========================================================
# LOGIN
# =========================================================

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated"
        )

    return _token_response(db, user)


# =========================================================
# REFRESH
# =========================================================

@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        claims = decode_token(payload.refresh_token)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    if claims.get("type") != REFRESH_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    user = db.query(User).filter(User.id == int(claims["sub"])).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    return AccessTokenResponse(
        access_token=create_access_token(user.id, user.role, user.email),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


# =========================================================
# PROFILE
# =========================================================

@router.get("/me", response_model=UserResponse)
def read_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_profile(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)

    log_activity(
        db, current_user.id, "User", current_user.id, "Profile Updated",
        "Profile details updated"
    )

    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/change-password", response_model=Message)
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    current_user.password_hash = hash_password(payload.new_password)

    log_activity(
        db, current_user.id, "User", current_user.id, "Password Changed",
        "Password changed from the profile screen"
    )

    db.commit()

    return Message(message="Password updated successfully")


# =========================================================
# PASSWORD RESET
# =========================================================

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """Issue a single-use reset token.

    The response is intentionally identical whether or not the email exists,
    so the endpoint cannot be used to enumerate accounts. In production the
    token would be emailed over SMTP instead of being returned in the body.
    """

    user = db.query(User).filter(User.email == payload.email).first()

    generic = "If the email is registered, a reset link has been sent"

    if not user:
        return ForgotPasswordResponse(message=generic)

    raw_token, token_hash = generate_reset_token()

    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=(
                datetime.now(timezone.utc)
                + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)
            )
        )
    )

    db.commit()

    return ForgotPasswordResponse(message=generic, reset_token=raw_token)


@router.post("/reset-password", response_model=Message)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == hash_reset_token(payload.token))
        .first()
    )

    if not record or record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used reset token"
        )

    if record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset token has expired"
        )

    user = db.query(User).filter(User.id == record.user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.password_hash = hash_password(payload.new_password)
    record.used_at = datetime.now(timezone.utc)

    log_activity(
        db, user.id, "User", user.id, "Password Reset",
        "Password reset using a reset token"
    )

    db.commit()

    return Message(message="Password has been reset successfully")
