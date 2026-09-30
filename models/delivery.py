"""
models/delivery.py
------------------
Delivery tracking data model.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional


@dataclass
class Delivery:
    """Tracks a physical delivery associated with a Purchase Order."""
    delivery_number: str
    po_id: str
    vendor_id: str
    expected_date: Optional[datetime] = None
    actual_date: Optional[datetime] = None
    status: str = "Pending"         # Pending, In Transit, Delivered, Delayed, Returned
    quality_rating: Optional[float] = None   # 1.0–5.0
    delay_days: int = 0
    remarks: Optional[str] = None
    received_by: Optional[str] = None        # user_id
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    source: Optional[str] = None              # e.g. "dataco"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_mongo_doc(self) -> dict:
        doc = asdict(self)
        doc["created_at"] = self.created_at
        return doc


def delivery_from_mongo(doc: dict) -> dict:
    if doc is None:
        return {}
    safe = dict(doc)
    if "_id" in safe:
        safe["_id"] = str(safe["_id"])
    return safe
