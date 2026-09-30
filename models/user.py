"""
models/user.py
--------------
User data model for the Vendor Reliability Intelligence Platform.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional
from enum import Enum


class UserStatus(str, Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"
    SUSPENDED = "Suspended"


class UserRole(str, Enum):
    ADMINISTRATOR = "Administrator"
    PROCUREMENT_MANAGER = "Procurement Manager"
    SUPPLY_CHAIN_MANAGER = "Supply Chain Manager"
    VENDOR_MANAGER = "Vendor Manager"   # manages all 6 vendor categories
    VENDOR = "Vendor"                   # individual vendor account (tied to one vendor_id)
    FINANCE_OFFICER = "Finance Officer"
    AUDITOR = "Auditor"


@dataclass
class User:
    """
    Represents a platform user.  password_hash is stored in MongoDB
    but NEVER returned to the UI layer.
    """
    name: str
    email: str
    password_hash: str
    role: str
    status: str = UserStatus.ACTIVE
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    profile_picture: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    # For Vendor role: links to the vendor entity and the vendor's category
    vendor_id: Optional[str] = None
    vendor_category: Optional[str] = None  # e.g. "Raw Material Suppliers"

    def to_mongo_doc(self) -> dict:
        """Convert to a MongoDB-ready dictionary."""
        doc = asdict(self)
        # Ensure datetimes are stored as UTC
        doc["created_at"] = self.created_at
        doc["updated_at"] = self.updated_at
        doc["last_login"] = self.last_login
        return doc

    def to_safe_dict(self) -> dict:
        """Return user data safe for display — password_hash excluded."""
        doc = self.to_mongo_doc()
        doc.pop("password_hash", None)
        return doc


def user_from_mongo(doc: dict) -> dict:
    """
    Convert a raw MongoDB user document to a safe display dict.
    Converts ObjectId to string and strips password_hash.
    """
    if doc is None:
        return {}
    safe = {k: v for k, v in doc.items() if k != "password_hash"}
    if "_id" in safe:
        safe["_id"] = str(safe["_id"])
    return safe
