from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.deps import get_current_user
from app.core.utils import log_activity
from app.db.session_dep import get_db
from app.models.user import User, UserRole
from app.models.vendor import (
    Vendor,
    VendorCategory,
    VendorStatus,
)
from app.schemas.token import Token
from app.schemas.user import RegisterRequest, UserOut, LoginRequest

router = APIRouter()


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED
)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db)
):
    existing = (
        db.query(User)
        .filter(User.email == payload.email)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists"
        )

    # ---------------------------------------------------------
    # CREATE USER
    # ---------------------------------------------------------

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        phone=payload.phone,
        department=payload.department,
        role=payload.role,
    )

    db.add(user)
    db.flush()

    # ---------------------------------------------------------
    # CREATE VENDOR PROFILE FOR VENDOR USERS
    # ---------------------------------------------------------

    if payload.role == UserRole.VENDOR:

        vendor = Vendor(
            user_id=user.id,
            company_name=payload.full_name,
            category=VendorCategory.SERVICE,
            contact_person=payload.full_name,
            email=payload.email,
            phone=payload.phone or "Not provided",
            status=VendorStatus.PENDING,
            is_active=True,
            rating=0.0,
        )

        db.add(vendor)

    # ---------------------------------------------------------
    # COMMIT EVERYTHING
    # ---------------------------------------------------------

    db.commit()
    db.refresh(user)

    log_activity(
        db,
        user.id,
        "user_registered",
        "user",
        user.id,
        f"User {user.email} registered"
    )

    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")

    token = create_access_token(subject=user.id, extra_claims={"role": user.role.value, "email": user.email})
    log_activity(db, user.id, "user_login", "user", user.id, f"User {user.email} logged in")
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login-json", response_model=Token)
def login_json(payload: LoginRequest, db: Session = Depends(get_db)):
    """JSON login alternative for the Angular client (avoids form-encoding)."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")

    token = create_access_token(subject=user.id, extra_claims={"role": user.role.value, "email": user.email})
    log_activity(db, user.id, "user_login", "user", user.id, f"User {user.email} logged in")
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user
