"""
models/vendor.py
----------------
Vendor & Supplier data model for VendorPulse.
Sourced from DataCo Supply Chain Dataset (Department + Market entities).
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum


class VendorStatus(str, Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"
    SUSPENDED = "Suspended"
    PENDING = "Pending"


class ApprovalStatus(str, Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"


@dataclass
class ContactInformation:
    primary_contact_name: str = ""
    primary_email: str = ""
    primary_phone: str = ""
    secondary_contact_name: Optional[str] = None
    secondary_email: Optional[str] = None
    secondary_phone: Optional[str] = None
    website: Optional[str] = None


@dataclass
class Address:
    street: str = ""
    city: str = ""
    state: str = ""
    country: str = ""
    postal_code: str = ""


@dataclass
class Vendor:
    """Represents a vendor/supplier in the platform."""
    vendor_code: str
    company_name: str
    category: str
    contact_information: dict = field(default_factory=dict)
    address: dict = field(default_factory=dict)
    status: str = VendorStatus.PENDING
    approval_status: str = ApprovalStatus.PENDING
    description: Optional[str] = None
    tax_id: Optional[str] = None
    payment_terms: Optional[str] = None
    credit_limit: Optional[float] = None
    rating: float = 0.0
    reliability_score: float = 0.0
    source: Optional[str] = None       # e.g. "dataco"

    # DataCo-sourced delivery performance fields
    department: Optional[str] = None           # DataCo Department Name
    market: Optional[str] = None               # DataCo Market
    region: Optional[str] = None               # DataCo Order Region
    total_orders: Optional[int] = None         # Total orders from DataCo
    late_delivery_count: Optional[int] = None  # Late deliveries from DataCo
    on_time_count: Optional[int] = None        # On-time deliveries from DataCo
    avg_shipping_days_real: Optional[float] = None       # Avg actual shipping days
    avg_shipping_days_scheduled: Optional[float] = None  # Avg scheduled shipping days
    late_delivery_rate: Optional[float] = None  # Calculated: late/total
    categories_supplied: Optional[List[str]] = None  # Product categories supplied
    shipping_modes: Optional[List[str]] = None   # Available shipping modes

    created_by: Optional[str] = None   # user_id of creator
    approved_by: Optional[str] = None  # user_id of approver
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_mongo_doc(self) -> dict:
        doc = asdict(self)
        doc["created_at"] = self.created_at
        doc["updated_at"] = self.updated_at
        return doc


def vendor_from_mongo(doc: dict) -> dict:
    """Convert a raw MongoDB vendor document for display."""
    if doc is None:
        return {}
    safe = dict(doc)
    if "_id" in safe:
        safe["_id"] = str(safe["_id"])
    return safe
