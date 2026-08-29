import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.password_reset import PasswordReset
from app.schemas.auth import (
    UserRegister,
    UserOut,
    Token,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

RESET_TOKEN_EXPIRE_MINUTES = 30


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        phone=payload.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    # Always return the same generic message, whether or not the email exists —
    # avoids leaking which emails are registered.
    generic_response = {"message": "If that email is registered, a reset link has been generated."}

    if not user:
        return generic_response

    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)

    password_reset = PasswordReset(user_id=user.id, token=reset_token, expires_at=expires_at)
    db.add(password_reset)
    db.commit()

    # NOTE: no email service configured yet (SMTP module comes later in the spec).
    # For now, the token is returned directly so you can test the reset flow.
    # Once SMTP is wired up, stop returning reset_token and email it instead.
    generic_response["reset_token"] = reset_token
    generic_response["expires_in_minutes"] = RESET_TOKEN_EXPIRE_MINUTES
    return generic_response


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_entry = (
        db.query(PasswordReset)
        .filter(PasswordReset.token == payload.token)
        .order_by(PasswordReset.created_at.desc())
        .first()
    )

    if not reset_entry:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    expires_at = reset_entry.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")

    user = db.query(User).filter(User.id == reset_entry.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user.password_hash = hash_password(payload.new_password)
    db.delete(reset_entry)
    db.commit()

    return {"message": "Password has been reset successfully. You can now log in."}
