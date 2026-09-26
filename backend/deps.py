"""Shared FastAPI dependencies: current user resolution and RBAC guards."""

from typing import Iterable, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserRole
from security import ACCESS_TOKEN, decode_token

bearer_scheme = HTTPBearer(auto_error=False)


CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"}
)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> User:
    if credentials is None or not credentials.credentials:
        raise CREDENTIALS_EXCEPTION

    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except jwt.PyJWTError:
        raise CREDENTIALS_EXCEPTION

    if payload.get("type") != ACCESS_TOKEN:
        raise CREDENTIALS_EXCEPTION

    subject = payload.get("sub")

    if not subject:
        raise CREDENTIALS_EXCEPTION

    user = db.query(User).filter(User.id == int(subject)).first()

    if user is None:
        raise CREDENTIALS_EXCEPTION

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated"
        )

    return user


def require_roles(*roles: str):
    """Dependency factory restricting a route to the given roles."""

    allowed = set(roles)

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Role '{current_user.role}' is not permitted to perform "
                    f"this action"
                )
            )

        return current_user

    return dependency


# ---------------------------------------------------------------
# Convenience guards used across the routers
# ---------------------------------------------------------------

require_admin = require_roles(UserRole.ADMINISTRATOR)

require_procurement = require_roles(
    UserRole.ADMINISTRATOR,
    UserRole.PROCUREMENT_MANAGER
)

require_procurement_or_supply_chain = require_roles(
    UserRole.ADMINISTRATOR,
    UserRole.PROCUREMENT_MANAGER,
    UserRole.SUPPLY_CHAIN_MANAGER
)

require_finance = require_roles(
    UserRole.ADMINISTRATOR,
    UserRole.FINANCE_OFFICER
)

require_staff = require_roles(*UserRole.INTERNAL_STAFF)

# Auditors are read-only but must be able to inspect the audit trail.
require_auditor_or_staff = require_roles(
    *UserRole.INTERNAL_STAFF,
    UserRole.AUDITOR
)


def vendor_scope(current_user: User) -> Optional[int]:
    """Vendor id a supplier login is restricted to, or ``None`` for staff."""

    if current_user.role == UserRole.VENDOR:
        return current_user.vendor_id

    return None


def assert_vendor_access(current_user: User, vendor_id: Optional[int]) -> None:
    """Block a supplier login from reading another supplier's records."""

    scope = vendor_scope(current_user)

    if scope is None:
        return

    if vendor_id is None or scope != vendor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access records belonging to your organisation"
        )


def has_any_role(current_user: User, roles: Iterable[str]) -> bool:
    return current_user.role in set(roles)
