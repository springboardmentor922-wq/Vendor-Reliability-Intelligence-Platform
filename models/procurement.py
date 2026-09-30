"""
models/procurement.py
---------------------
Procurement Request data model — full workflow spec.
Status flow: Pending → Approved → Vendor Assigned → Vendor Accepted/Rejected → Ordered → Completed

Expected budget breakdown fields capture the approved values at request creation time.
These are preserved throughout the workflow and used in 3-way Finance verification
(REQUEST vs PO vs INVOICE) to detect any deviation from original approval.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, List


@dataclass
class ProcurementItem:
    description: str
    quantity: float
    unit: str = "units"
    unit_price: float = 0.0
    total_price: float = 0.0


@dataclass
class ProcurementRequest:
    """Represents a procurement request raised by a Procurement Manager."""
    request_number: str
    requested_by: str          # user_id
    department: str

    # Product / Item fields (from DataCo or manual entry)
    product_name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None

    # Line items (detailed breakdown)
    items: List[dict] = field(default_factory=list)
    estimated_cost: float = 0.0

    # ── Approved budget breakdown (preserved — never mutated after approval) ──
    expected_unit_price: float = 0.0
    expected_quantity: float = 0.0
    expected_subtotal: float = 0.0      # expected_unit_price × expected_quantity
    expected_tax: float = 0.0
    expected_discount: float = 0.0      # Discount (positive = reduction)
    expected_shipping: float = 0.0      # Shipping / freight budget
    expected_other_charges: float = 0.0 # Other approved charges
    expected_grand_total: float = 0.0   # Total budget approved (sum of above)

    # Workflow fields
    status: str = "Pending"          # Pending → Approved → Ordered → Delivered → Completed
    priority: str = "Medium"         # Low / Medium / High / Urgent
    justification: Optional[str] = None
    required_by_date: Optional[datetime] = None

    # Approval fields
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    rejected_by: Optional[str] = None

    # Vendor Assignment fields
    vendor_id: Optional[str] = None
    assigned_vendor_name: Optional[str] = None
    assigned_by: Optional[str] = None
    assigned_at: Optional[datetime] = None

    # Vendor Response fields
    vendor_response_status: Optional[str] = None  # None / Pending / Accepted / Rejected
    vendor_response_date: Optional[datetime] = None
    vendor_rejection_reason: Optional[str] = None
    vendor_response_by: Optional[str] = None   # vendor user_id who responded

    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_mongo_doc(self) -> dict:
        doc = asdict(self)
        doc["created_at"] = self.created_at
        doc["updated_at"] = self.updated_at
        return doc


def procurement_from_mongo(doc: dict) -> dict:
    if doc is None:
        return {}
    safe = dict(doc)
    if "_id" in safe:
        safe["_id"] = str(safe["_id"])
    # Safe defaults for new expected budget fields on legacy documents
    safe.setdefault("expected_unit_price", safe.get("unit_price") or 0.0)
    safe.setdefault("expected_quantity", safe.get("quantity") or 0.0)
    safe.setdefault("expected_subtotal", 0.0)
    safe.setdefault("expected_tax", 0.0)
    safe.setdefault("expected_discount", 0.0)
    safe.setdefault("expected_shipping", 0.0)
    safe.setdefault("expected_other_charges", 0.0)
    # For legacy docs, expected_grand_total falls back to estimated_cost
    safe.setdefault("expected_grand_total", safe.get("estimated_cost", 0.0))
    return safe
