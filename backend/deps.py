"""Shared FastAPI dependencies: DB session, auth, RBAC and auditing."""

from __future__ import annotations

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from auth import verify_token
from database import SessionLocal
import models

security = HTTPBearer(auto_error=True)

CANONICAL_ROLES = {
    "admin": "administrator",
    "administrator": "administrator",
    "procurement": "procurement_manager",
    "procurement_manager": "procurement_manager",
    "scm": "supply_chain_manager",
    "supply_chain_manager": "supply_chain_manager",
    "manager": "supply_chain_manager",
    "finance": "finance_officer",
    "finance_officer": "finance_officer",
    "vendor": "vendor",
    "auditor": "auditor",
    "user": "vendor",
}

ROLE_ACCESS = {
    "administrator": {
        "administrator",
        "procurement_manager",
        "supply_chain_manager",
        "vendor",
        "finance_officer",
        "auditor",
    },
    "procurement_manager": {"procurement_manager", "supply_chain_manager"},
    "supply_chain_manager": {"supply_chain_manager"},
    "vendor": {"vendor"},
    "finance_officer": {"finance_officer"},
    "auditor": {"auditor"},
}


def normalize_role(role: str | None) -> str:
    return CANONICAL_ROLES.get((role or "vendor").strip().lower(), "vendor")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    payload = verify_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    user.role = normalize_role(user.role)
    return user


def require_role(required_roles: list[str]):
    allowed = {normalize_role(r) for r in required_roles}

    def role_checker(current_user: models.User = Depends(get_current_user)):
        role = normalize_role(current_user.role)
        if role not in allowed and role != "administrator":
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this resource",
            )
        return current_user

    return role_checker


def ensure_vendor_scope(current_user: models.User, vendor_id: int | None):
    if (
        normalize_role(current_user.role) == "vendor"
        and current_user.vendor_id != vendor_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Vendors can only access records for their assigned vendor",
        )


def log_activity(
    db: Session,
    user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    details: str | None = None,
):
    log_entry = models.AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(log_entry)
    db.flush()
