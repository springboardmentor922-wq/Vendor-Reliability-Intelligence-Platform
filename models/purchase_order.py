"""
models/purchase_order.py
------------------------
Purchase Order data model — workflow spec.
PO Status: Pending → Approved → Ordered → Delivered → Completed / Cancelled

A PO can only be created after:
  1. Procurement Request is Approved
  2. Vendor is Assigned
  3. Vendor has Accepted the request (vendor_acceptance_status == "Accepted")

Financial fields (tax, discount, shipping, other_charges, grand_total) store the
agreed final values at PO creation time, used later for 3-way Finance verification.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, List


@dataclass
class POItem:
    description: str
    quantity: float
    unit_price: float
    total_price: float
    unit: str = "units"


@dataclass
class PurchaseOrder:
    """Represents a purchase order issued to a vendor."""
    po_number: str
    vendor_id: str
    vendor_name: Optional[str] = None
    request_id: Optional[str] = None
    procurement_request_number: Optional[str] = None

    # Product / Item fields
    product_name: Optional[str] = None
    category: Optional[str] = None
    items: List[dict] = field(default_factory=list)

    # Core financial fields
    total_amount: float = 0.0          # Legacy alias for grand_total
    unit_price: Optional[float] = None
    quantity: Optional[float] = None
    currency: str = "USD"

    # ── Structured financial breakdown (agreed PO values) ─────────────────────
    subtotal: float = 0.0              # unit_price × quantity
    tax_amount: float = 0.0
    discount_amount: float = 0.0       # Discount (positive = reduction)
    shipping_freight: float = 0.0
    other_charges: float = 0.0
    grand_total: float = 0.0           # Final PO total (subtotal + tax − discount + shipping + other)

    # Dates
    order_date: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    expected_delivery_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None

    # Status
    status: str = "Pending"    # Pending → Approved → Ordered → Delivered → Completed / Cancelled

    # Vendor acceptance (mirrored from PR for PO-level reference)
    vendor_acceptance_status: str = "Accepted"  # Always Accepted when PO is created

    # ── PO-level Payment Tracking ─────────────────────────────────────────────
    payment_status: str = "Pending"  # Payment Locked | Pending Verification | Ready to Pay | On Hold | Paid
    payment_id: Optional[str] = None
    payment_date: Optional[datetime] = None
    payment_amount: Optional[float] = None
    paid_by: Optional[str] = None
    invoice_id: Optional[str] = None
    payment_remarks: Optional[str] = None

    # Audit fields
    created_by: Optional[str] = None   # user_id
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    shipping_address: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    defective_units: Optional[float] = None   # Quality data
    compliance: Optional[bool] = None         # Compliance flag
    source: Optional[str] = None              # e.g. "dataco" or "manual"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_mongo_doc(self) -> dict:
        doc = asdict(self)
        doc["order_date"] = self.order_date
        doc["created_at"] = self.created_at
        doc["updated_at"] = self.updated_at
        if self.payment_date:
            doc["payment_date"] = self.payment_date
        return doc


def po_from_mongo(doc: dict) -> dict:
    if doc is None:
        return {}
    safe = dict(doc)
    if "_id" in safe:
        safe["_id"] = str(safe["_id"])
    # Ensure new financial fields have safe defaults for legacy PO documents
    safe.setdefault("subtotal", 0.0)
    safe.setdefault("tax_amount", 0.0)
    safe.setdefault("discount_amount", 0.0)
    safe.setdefault("shipping_freight", 0.0)
    safe.setdefault("other_charges", 0.0)
    grand = safe.get("grand_total") or safe.get("total_amount", 0.0)
    safe.setdefault("grand_total", grand)
    # Payment fields
    safe.setdefault("payment_status", "Pending")
    safe.setdefault("payment_id", None)
    safe.setdefault("payment_date", None)
    safe.setdefault("payment_amount", None)
    safe.setdefault("paid_by", None)
    safe.setdefault("invoice_id", None)
    safe.setdefault("payment_remarks", None)
    return safe

