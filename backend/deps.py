"""Shared FastAPI dependencies (database session, auth, RBAC).

Kept separate from main.py so Milestone-3 routers can reuse the same
auth/RBAC logic without creating import cycles.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import SessionLocal
import models
from auth import verify_token

security = HTTPBearer()


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
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user


ROLE_ALIASES = {
    "admin": ["admin", "administrator"],
    "administrator": ["admin", "administrator"],
    "procurement": ["admin", "administrator", "procurement", "procurement_manager"],
    "procurement_manager": ["admin", "administrator", "procurement", "procurement_manager"],
    "manager": ["admin", "administrator", "procurement", "procurement_manager", "manager", "scm", "supply_chain_manager"],
    "scm": ["admin", "administrator", "scm", "supply_chain_manager", "manager"],
    "supply_chain_manager": ["admin", "administrator", "scm", "supply_chain_manager", "manager"],
    "finance": ["admin", "administrator", "finance", "finance_officer"],
    "finance_officer": ["admin", "administrator", "finance", "finance_officer"],
    "auditor": ["admin", "administrator", "auditor"],
    "vendor": ["vendor"],
    "user": ["admin", "administrator", "procurement", "procurement_manager", "manager", "scm", "supply_chain_manager", "finance", "finance_officer", "auditor", "vendor", "user"],
}


def require_role(required_roles: list):
    """Check if the user's role satisfies any of the required roles (with alias support)."""
    # Build expanded set of permitted role strings
    allowed_set = set()
    for req in required_roles:
        req_norm = req.strip().lower()
        allowed_set.add(req_norm)
        if req_norm in ROLE_ALIASES:
            allowed_set.update(ROLE_ALIASES[req_norm])

    def role_checker(current_user: models.User = Depends(get_current_user)):
        user_role_norm = current_user.role.strip().lower()
        if user_role_norm not in allowed_set and "admin" not in user_role_norm:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this resource",
            )
        return current_user

    return role_checker


def log_activity(db: Session, user_id: int | None, action: str, entity_type: str,
                 entity_id: int | None = None, details: str | None = None):
    """Helper to record audit trail entries in the database."""
    try:
        log_entry = models.AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
        )
        db.add(log_entry)
        db.commit()
    except Exception:
        db.rollback()