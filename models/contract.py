"""
models/contract.py
------------------
Contract & Compliance data model.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, List


@dataclass
class Contract:
    """Represents a contract between the organization and a vendor."""
    contract_number: str
    vendor_id: str
    title: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    contract_value: float = 0.0
    currency: str = "USD"
    compliance_status: str = "Compliant"   # Compliant, Non-Compliant, Under Review, Expired
    document_reference: Optional[str] = None
    description: Optional[str] = None
    payment_schedule: Optional[str] = None
    renewal_terms: Optional[str] = None
    auto_renew: bool = False
    notification_days_before_expiry: int = 30
    certifications_required: List[str] = field(default_factory=list)
    created_by: Optional[str] = None       # user_id
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_mongo_doc(self) -> dict:
        doc = asdict(self)
        doc["created_at"] = self.created_at
        doc["updated_at"] = self.updated_at
        return doc

    def days_until_expiry(self) -> Optional[int]:
        """Return the number of days until contract expiry, or None if no end date."""
        if self.end_date is None:
            return None
        now = datetime.now(timezone.utc)
        end = self.end_date if self.end_date.tzinfo else self.end_date.replace(tzinfo=timezone.utc)
        delta = end - now
        return delta.days


def contract_from_mongo(doc: dict) -> dict:
    if doc is None:
        return {}
    safe = dict(doc)
    if "_id" in safe:
        safe["_id"] = str(safe["_id"])
    return safe
