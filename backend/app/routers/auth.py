from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.vendor import Vendor
from app.models.enums import UserRole, VendorStatus, VendorCategory
from app.schemas.auth import Token, UserRegister, UserLogin, UserResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.dependencies import get_current_user, require_roles
from app.core.audit import log_audit_event

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    assigned_vendor_id = user_in.vendor_id

    # If user is registering as a Vendor and didn't specify an existing vendor_id, create a new Vendor company
    if user_in.role == UserRole.VENDOR and not assigned_vendor_id:
        comp_name = user_in.company_name or f"{user_in.full_name}'s Enterprise"
        
        # Check if vendor company already exists
        existing_vendor = db.query(Vendor).filter(Vendor.company_name.ilike(comp_name)).first()
        if existing_vendor:
            assigned_vendor_id = existing_vendor.id
        else:
            cat = user_in.category or VendorCategory.RAW_MATERIAL
            new_vendor = Vendor(
                company_name=comp_name,
                category=cat,
                status=VendorStatus.PENDING,
                contact_person=user_in.contact_person or user_in.full_name,
                email=user_in.email,
                phone=user_in.phone,
                address=user_in.address,
                gst_number=user_in.gst_number,
                notes=user_in.notes or "Self-registered supplier onboarding. Pending review & approval by Procurement.",
                approved_by_id=None
            )
            db.add(new_vendor)
            db.flush()
            assigned_vendor_id = new_vendor.id

    user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        role=user_in.role,
        phone=user_in.phone,
        vendor_id=assigned_vendor_id if user_in.role == UserRole.VENDOR else None,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_audit_event(
        db, user.id, "REGISTER", "User",
        f"User registered with role '{user.role.value}'" + (f" and created vendor ID {assigned_vendor_id}" if assigned_vendor_id else "")
    )

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role.value})
    return Token(access_token=access_token, token_type="bearer", user=user)

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated"
        )

    log_audit_event(db, user.id, "LOGIN", "User", f"User logged in from web")

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role.value})
    return Token(access_token=access_token, token_type="bearer", user=user)

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

from app.schemas.auth import Token, UserRegister, UserLogin, UserResponse, UserRoleUpdate

@router.put("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    role_in: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR]))
):
    """
    Administrator endpoint to promote or reassign roles for internal staff:
    (Administrator, Procurement Manager, Supply Chain Manager, Finance Officer, Auditor).
    Vendor users and Vendor role assignments are protected.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Rule: Cannot reassign Vendor accounts or assign Vendor role
    if target_user.role == UserRole.VENDOR:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reassign external Vendor users. Vendor accounts are tied to supplier entities."
        )

    if role_in.new_role == UserRole.VENDOR:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign internal staff to external Vendor role. Vendor accounts require supplier registration."
        )

    old_role = target_user.role.value
    target_user.role = role_in.new_role
    db.commit()
    db.refresh(target_user)

    log_audit_event(
        db, current_user.id, "UPDATE_USER_ROLE", "User",
        f"Admin promoted/reassigned role for '{target_user.full_name}' from '{old_role}' to '{target_user.role.value}'"
    )

    return target_user

@router.get("/users", response_model=List[UserResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.AUDITOR]))
):
    return db.query(User).order_by(User.id.desc()).all()


