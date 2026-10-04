from typing import List, Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
import jwt

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception

    user = db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        if user.approval_status == "APPROVED":
            user.is_active = True
            db.commit()
            db.refresh(user)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive or pending administrator verification."
            )
    return user

def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db)
) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            return None
    except Exception:
        return None

    user = db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()
    if user is None:
        return None
    if not user.is_active:
        if user.approval_status == "APPROVED":
            user.is_active = True
            db.commit()
            db.refresh(user)
        else:
            return None
    return user

def normalize_role(role: str) -> str:
    r = (role or "").strip()
    r_lower = r.lower()
    if r_lower in ["admin", "administrator"]:
        return "Administrator"
    if r_lower in ["procurement", "procurement manager", "requesting user", "department user", "requester"]:
        return "Procurement Manager"
    if r_lower in ["finance", "finance officer"]:
        return "Finance Officer"
    if r_lower in ["supply chain", "supply chain manager", "supplychain"]:
        return "Supply Chain Manager"
    if r_lower in ["vendor"]:
        return "Vendor"
    if r_lower in ["auditor", "audit"]:
        return "Auditor"
    return r

def require_roles_strict(allowed_roles: List[str]):
    """
    Strict Role Verification:
    NO automatic admin bypass.
    Only the explicitly listed roles can access this operational action.
    """
    normalized_allowed = [normalize_role(r) for r in allowed_roles]
    
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = normalize_role(current_user.role)
        if user_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Role '{current_user.role}' is not authorized for this action. Authorized roles: {allowed_roles}"
            )
        return current_user
    return role_checker

def require_roles(allowed_roles: List[str]):
    """
    Standard Role Verification:
    Allows listed roles, plus Administrator for supervisory read/audit access.
    """
    normalized_allowed = [normalize_role(r) for r in allowed_roles]
    
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = normalize_role(current_user.role)
        if user_role not in normalized_allowed and user_role != "Administrator":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Role '{current_user.role}' is not authorized. Authorized roles: {allowed_roles}"
            )
        return current_user
    return role_checker

def block_vendor_role(current_user: User = Depends(get_current_user)) -> User:
    """Blocks Vendor role from internal endpoints."""
    if normalize_role(current_user.role) == "Vendor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Vendors are not authorized to access internal directory or operational endpoints."
        )
    return current_user

def get_vendor_for_user(db: Session, user: User):
    from app.models.vendor import Vendor
    from sqlalchemy import func

    # 1. Direct user_id match
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if vendor:
        return vendor

    # 2. Match by company
    if user.company:
        c_name = user.company.strip()
        vendor = db.query(Vendor).filter(
            (func.lower(Vendor.company) == func.lower(c_name)) |
            (func.lower(Vendor.name) == func.lower(c_name))
        ).first()
        if vendor:
            vendor.user_id = user.id
            db.commit()
            return vendor

    # 3. Match by email
    if user.email:
        vendor = db.query(Vendor).filter(func.lower(Vendor.email) == func.lower(user.email.strip())).first()
        if vendor:
            vendor.user_id = user.id
            db.commit()
            return vendor

    return None

ROLE_VENDOR_PERMISSIONS = {
    "Administrator": {
        "can_view_all": True,
        "can_create": True,
        "can_delete": True,
        "can_approve_reject": True,
        "editable_fields": [
            "name", "company", "email", "phone", "address", "website",
            "product", "category", "status", "deliveryRate", "quality_rating",
            "response_time_hours", "risk_level", "business_reg_number", "gst_tax_id",
            "bank_details", "notes"
        ],
        "description": "System administration and audit visibility."
    },
    "Procurement Manager": {
        "can_view_all": True,
        "can_create": True,
        "can_delete": False,
        "can_approve_reject": True,
        "editable_fields": [
            "name", "company", "category", "risk_level", "status", "notes",
            "product", "business_reg_number", "gst_tax_id", "address", "phone", "email", "website"
        ],
        "description": "Evaluate and select qualified vendors for requisitions."
    },
    "Supply Chain Manager": {
        "can_view_all": True,
        "can_create": False,
        "can_delete": False,
        "can_approve_reject": False,
        "editable_fields": [
            "deliveryRate", "quality_rating", "response_time_hours", "risk_level", "notes"
        ],
        "description": "Manage operational delivery performance and track shipments."
    },
    "Vendor": {
        "can_view_all": False,
        "can_create": False,
        "can_delete": False,
        "can_approve_reject": False,
        "editable_fields": [
            "name", "company", "email", "phone", "address", "website", "product",
            "business_reg_number", "gst_tax_id", "bank_details", "notes"
        ],
        "description": "View and manage own company profile and orders only."
    },
    "Finance Officer": {
        "can_view_all": True,
        "can_create": False,
        "can_delete": False,
        "can_approve_reject": False,
        "editable_fields": ["bank_details", "notes"],
        "description": "View vendor directory for invoice matching."
    },
    "Auditor": {
        "can_view_all": True,
        "can_create": False,
        "can_delete": False,
        "can_approve_reject": False,
        "editable_fields": ["notes"],
        "description": "Read-only access across compliance and transaction history."
    }
}

def get_role_vendor_permissions(role: str) -> dict:
    return ROLE_VENDOR_PERMISSIONS.get(role, {
        "can_view_all": False,
        "can_create": False,
        "can_delete": False,
        "can_approve_reject": False,
        "description": "Read-only access."
    })

