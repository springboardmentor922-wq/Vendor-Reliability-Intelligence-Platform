from datetime import datetime, timedelta
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.password_reset import PasswordResetToken
from app.models.user import User, UserRole
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


# ---------------------------------------------------------
# REGISTER
# ---------------------------------------------------------

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: UserRegister,
    db: Session = Depends(get_db),
):
    email = payload.email.lower().strip()
    full_name = payload.full_name.strip()

    if len(full_name) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name must contain at least 2 characters.",
        )

    existing_user = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        full_name=full_name,
        email=email,
        hashed_password=hash_password(payload.password),
        role=UserRole.VENDOR,
        is_active=True,
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create the account. Please try again.",
        )

    return user


# ---------------------------------------------------------
# LOGIN
# ---------------------------------------------------------

@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    payload: UserLogin,
    db: Session = Depends(get_db),
):
    email = payload.email.lower().strip()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    if not user or not verify_password(
        payload.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    token = create_access_token(str(user.id))

    return TokenResponse(
        access_token=token,
        token_type="bearer",
    )


# ---------------------------------------------------------
# FORGOT PASSWORD
# ---------------------------------------------------------

@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    email = payload.email.lower().strip()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    # Don't expose whether an email exists.
    if not user:
        return ForgotPasswordResponse(
            message=(
                "If an account exists for this email, "
                "a password reset request has been created."
            )
        )

    # Invalidate previous unused tokens for this user.
    previous_tokens = db.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used.is_(False),
        )
    ).all()

    for old_token in previous_tokens:
        old_token.used = True

    reset_token = secrets.token_urlsafe(48)

    reset_record = PasswordResetToken(
        user_id=user.id,
        token=reset_token,
        expires_at=datetime.utcnow() + timedelta(minutes=30),
        used=False,
    )

    db.add(reset_record)
    db.commit()

    return ForgotPasswordResponse(
        message=(
            "Password reset request created. "
            "Use the reset token to create a new password."
        ),
        reset_token=reset_token,
    )


# ---------------------------------------------------------
# RESET PASSWORD
# ---------------------------------------------------------

@router.post(
    "/reset-password",
)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    reset_record = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token == payload.token
        )
    )

    if not reset_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset token.",
        )

    if reset_record.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset token has already been used.",
        )

    if reset_record.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset token has expired.",
        )

    user = db.get(User, reset_record.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    user.hashed_password = hash_password(
        payload.new_password
    )

    reset_record.used = True

    db.commit()

    return {
        "message": "Password reset successful. You can now sign in."
    }