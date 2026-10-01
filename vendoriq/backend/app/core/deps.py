import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session_dep import get_db
from app.models.user import User, UserRole
from app.models.vendor import Vendor


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)

    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")

    if user_id is None:
        raise credentials_exception

    try:
        user_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise credentials_exception

    user = (
        db.query(User)
        .filter(User.id == user_uuid)
        .first()
    )

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    return current_user


def require_roles(*allowed_roles: UserRole):

    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:

        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Operation not permitted for role "
                    f"'{current_user.role.value}'"
                ),
            )

        return current_user

    return role_checker


# ============================================================
# ROLE GROUPS
# ============================================================

# Administrator only
require_admin = require_roles(
    UserRole.ADMIN
)


# Procurement and Supply Chain operations
require_procurement_team = require_roles(
    UserRole.ADMIN,
    UserRole.PROCUREMENT_MANAGER,
    UserRole.SUPPLY_CHAIN_MANAGER,
)


# Users allowed to approve procurement requests
require_approvers = require_roles(
    UserRole.ADMIN,
    UserRole.PROCUREMENT_MANAGER,
)


# Finance operations
require_finance = require_roles(
    UserRole.ADMIN,
    UserRole.FINANCE_OFFICER,
)


# Analytics access
require_analytics = require_roles(
    UserRole.ADMIN,
    UserRole.PROCUREMENT_MANAGER,
    UserRole.SUPPLY_CHAIN_MANAGER,
    UserRole.FINANCE_OFFICER,
    UserRole.AUDITOR,
)


# Vendor management
require_vendor_management = require_roles(
    UserRole.ADMIN,
    UserRole.PROCUREMENT_MANAGER,
    UserRole.SUPPLY_CHAIN_MANAGER,
    UserRole.AUDITOR,
)


# Read-only operational information
require_operations_read = require_roles(
    UserRole.ADMIN,
    UserRole.PROCUREMENT_MANAGER,
    UserRole.SUPPLY_CHAIN_MANAGER,
    UserRole.AUDITOR,
)


# Any authenticated application role
require_all_authenticated = require_roles(
    UserRole.ADMIN,
    UserRole.PROCUREMENT_MANAGER,
    UserRole.SUPPLY_CHAIN_MANAGER,
    UserRole.VENDOR,
    UserRole.FINANCE_OFFICER,
    UserRole.AUDITOR,
)


# ============================================================
# VENDOR OWNERSHIP
# ============================================================

def get_current_vendor(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Vendor:

    # Only VENDOR users can use this dependency
    if current_user.role != UserRole.VENDOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vendor access required",
        )

    # Find the vendor profile linked to this user
    vendor = (
        db.query(Vendor)
        .filter(Vendor.user_id == current_user.id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No vendor profile is associated with this account",
        )

    # Vendor must be active
    if not vendor.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vendor account is inactive",
        )

    return vendor
