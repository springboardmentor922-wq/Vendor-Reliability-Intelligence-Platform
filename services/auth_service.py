"""
services/auth_service.py
------------------------
Authentication service — user registration, login, retrieval, and audit.
Coordinates between database, password handler, and JWT handler.
"""

import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from database.connection import get_database
from auth.password_handler import hash_password, verify_password, validate_password_strength
from auth.jwt_handler import create_access_token
from models.user import User, user_from_mongo
from utils.validators import validate_email_format
from utils.logger import log_audit
from config.settings import COLLECTION_USERS, COLLECTION_AUDIT_LOGS

logger = logging.getLogger(__name__)


def register_user(
    name: str,
    email: str,
    password: str,
    confirm_password: str,
    role: str,
    phone: Optional[str] = None,
    department: Optional[str] = None,
    vendor_id: Optional[str] = None,
    vendor_category: Optional[str] = None,
) -> Tuple[bool, str, Optional[Dict]]:
    """
    Register a new user.

    vendor_id and vendor_category are set for Vendor role accounts to link
    them to a specific vendor organization for data isolation.

    Returns:
        (success: bool, message: str, user_dict: Optional[dict])
    """
    # ── Validation ────────────────────────────────────────────────────────────
    if not all([name.strip(), email.strip(), password, confirm_password, role]):
        return False, "All required fields must be filled in.", None

    if not validate_email_format(email):
        return False, "Please enter a valid email address.", None

    if password != confirm_password:
        return False, "Passwords do not match.", None

    pw_valid, pw_msg = validate_password_strength(password)
    if not pw_valid:
        return False, pw_msg, None

    # ── Duplicate check ───────────────────────────────────────────────────────
    db = get_database()
    existing = db[COLLECTION_USERS].find_one({"email": email.lower().strip()})
    if existing:
        return False, "An account with this email address already exists.", None

    # ── Create user document ──────────────────────────────────────────────────
    user = User(
        name=name.strip(),
        email=email.lower().strip(),
        password_hash=hash_password(password),
        role=role,
        phone=phone,
        department=department,
        vendor_id=vendor_id or None,
        vendor_category=vendor_category or None,
    )
    doc = user.to_mongo_doc()

    try:
        result = db[COLLECTION_USERS].insert_one(doc)
        user_id = str(result.inserted_id)
        logger.info("New user registered: %s  role: %s  id: %s", email, role, user_id)

        # Audit log
        log_audit(
            user_id=user_id,
            action="REGISTER",
            entity="User",
            entity_id=user_id,
            details={"email": email, "role": role},
        )

        safe_user = user.to_safe_dict()
        safe_user["_id"] = user_id
        return True, "Registration successful! You can now log in.", safe_user

    except DuplicateKeyError:
        return False, "An account with this email address already exists.", None
    except Exception as exc:
        logger.error("Registration failed for %s: %s", email, exc)
        return False, "Registration failed due to a server error. Please try again.", None


def login_user(email: str, password: str) -> Tuple[bool, str, Optional[str], Optional[Dict]]:
    """
    Authenticate a user and return a JWT token.

    Returns:
        (success: bool, message: str, token: Optional[str], user_dict: Optional[dict])
    """
    if not email or not password:
        return False, "Email and password are required.", None, None

    if not validate_email_format(email):
        return False, "Please enter a valid email address.", None, None

    db = get_database()
    user_doc = db[COLLECTION_USERS].find_one({"email": email.lower().strip()})

    if not user_doc:
        # Use the same message to avoid email enumeration
        return False, "Invalid email or password.", None, None

    if not verify_password(password, user_doc.get("password_hash", "")):
        logger.warning("Failed login attempt for: %s", email)
        return False, "Invalid email or password.", None, None

    if user_doc.get("status") != "Active":
        return False, "Your account is not active. Please contact an administrator.", None, None

    # Update last_login
    user_id = str(user_doc["_id"])
    db[COLLECTION_USERS].update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}},
    )

    # Generate JWT — include vendor_id in token claims for Vendor role data isolation
    token = create_access_token(
        user_id=user_id,
        email=user_doc["email"],
        role=user_doc["role"],
        vendor_id=str(user_doc.get("vendor_id") or "") or None,
        vendor_category=user_doc.get("vendor_category"),
    )

    logger.info("User logged in: %s  role: %s", email, user_doc["role"])
    log_audit(
        user_id=user_id,
        action="LOGIN",
        entity="User",
        entity_id=user_id,
        details={"email": email},
    )

    safe = user_from_mongo(user_doc)
    return True, "Login successful.", token, safe


def get_user_by_id(user_id: str) -> Optional[Dict]:
    """Retrieve a user by their MongoDB ObjectId string."""
    try:
        db = get_database()
        doc = db[COLLECTION_USERS].find_one({"_id": ObjectId(user_id)})
        return user_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("Error fetching user %s: %s", user_id, exc)
        return None


def get_user_by_email(email: str) -> Optional[Dict]:
    """Retrieve a user by email (safe — no password_hash)."""
    try:
        db = get_database()
        doc = db[COLLECTION_USERS].find_one({"email": email.lower().strip()})
        return user_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("Error fetching user by email %s: %s", email, exc)
        return None


def update_user_profile(user_id: str, updates: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Update non-sensitive user profile fields.
    Prevents updating password_hash, role, or _id through this method.
    """
    forbidden = {"password_hash", "role", "_id", "email"}
    safe_updates = {k: v for k, v in updates.items() if k not in forbidden}
    safe_updates["updated_at"] = datetime.now(timezone.utc)

    try:
        db = get_database()
        result = db[COLLECTION_USERS].update_one(
            {"_id": ObjectId(user_id)},
            {"$set": safe_updates},
        )
        if result.matched_count == 0:
            return False, "User not found."
        logger.info("Profile updated for user: %s", user_id)
        return True, "Profile updated successfully."
    except Exception as exc:
        logger.error("Profile update failed for %s: %s", user_id, exc)
        return False, "Failed to update profile."


def get_all_users() -> list:
    """Admin-only: Return all users (safe — no password_hashes)."""
    try:
        db = get_database()
        docs = db[COLLECTION_USERS].find({}, {"password_hash": 0})
        return [user_from_mongo(d) for d in docs]
    except Exception as exc:
        logger.error("Error fetching all users: %s", exc)
        return []
