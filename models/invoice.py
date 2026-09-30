"""
models/invoice.py
-----------------
Invoice data model for VendorPulse procurement workflow.

Lifecycle:
  1. PO created → Invoice auto-stub created (status: Pending)
  2. Vendor submits invoice details (status: Submitted)
  3. Finance Officer performs 3-way verification → Approved | Rejected | Correction Required
  4. After delivery confirmed: Finance Officer settles payment → Paid/Settled

Legacy field support:
  - Existing docs may have invoice_status='Verified' → treated as 'Approved'
  - Existing docs may have no line_items, grand_total, payment_status → safe defaults
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, List


@dataclass
class Invoice:
    """Represents a vendor invoice linked to a Purchase Order."""

    # ── Core identifiers ──────────────────────────────────────────────────────
    invoice_number: str
    po_id: str
    po_number: str
    vendor_id: str
    vendor_name: str
    procurement_request_id: Optional[str] = None
    procurement_request_number: Optional[str] = None

    # ── Item summary (from PO stub) ──────────────────────────────────────────
    product_name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None

    # ── Vendor-submitted line items ───────────────────────────────────────────
    line_items: List[dict] = field(default_factory=list)

    # ── Vendor-submitted financial breakdown ──────────────────────────────────
    subtotal: float = 0.0
    tax_amount: float = 0.0
    discount_amount: float = 0.0
    shipping_freight: float = 0.0
    other_charges: float = 0.0
    invoice_amount: float = 0.0        # Grand total (legacy field name)
    grand_total: float = 0.0           # Canonical grand total

    # ── PO reference amounts (snapshot at invoice creation) ──────────────────
    po_amount: float = 0.0
    po_tax: float = 0.0
    po_discount: float = 0.0
    po_shipping: float = 0.0
    po_other_charges: float = 0.0
    po_subtotal: float = 0.0
    po_unit_price: float = 0.0
    po_quantity: float = 0.0

    # ── Supporting document ───────────────────────────────────────────────────
    support_doc_name: Optional[str] = None
    support_doc_note: Optional[str] = None

    # ── Dates ─────────────────────────────────────────────────────────────────
    invoice_date: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    due_date: Optional[datetime] = None
    submitted_at: Optional[datetime] = None

    # ── Status ────────────────────────────────────────────────────────────────
    invoice_status: str = "Pending"
    # Statuses: Pending / Submitted / Approved / Rejected / Correction Required / Paid

    # ── Finance Verification fields ───────────────────────────────────────────
    verification_id: Optional[str] = None
    verification_status: Optional[str] = None
    verified_by: Optional[str] = None
    verified_by_name: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_remarks: Optional[str] = None
    verification_notes: Optional[str] = None   # Legacy field alias
    rejection_reason: Optional[str] = None
    discrepancy_details: Optional[dict] = None
    match_result: Optional[str] = None
    comparison_result: Optional[dict] = None

    # ── Payment fields ────────────────────────────────────────────────────────
    payment_status: str = "Unpaid"
    # Statuses: Unpaid / Approved for Payment / Settled / On Hold
    payment_id: Optional[str] = None           # Unique payment reference ID
    payment_amount: Optional[float] = None     # Actual settled amount
    payment_date: Optional[datetime] = None
    payment_settled_by: Optional[str] = None   # user_id
    payment_settled_by_name: Optional[str] = None
    payment_remarks: Optional[str] = None

    # ── Submission tracking ───────────────────────────────────────────────────
    submitted_by: Optional[str] = None

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_by: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_mongo_doc(self) -> dict:
        doc = asdict(self)
        doc["invoice_date"] = self.invoice_date
        doc["created_at"] = self.created_at
        doc["updated_at"] = self.updated_at
        return doc


def invoice_from_mongo(doc: dict) -> dict:
    """Normalize a raw MongoDB invoice doc — handles ALL legacy field shapes."""
    if doc is None:
        return {}
    safe = dict(doc)
    if "_id" in safe:
        safe["_id"] = str(safe["_id"])

    # ── Legacy status migration ───────────────────────────────────────────────
    status = safe.get("invoice_status", "Pending")
    if status == "Verified":
        safe["invoice_status"] = "Approved"
        if not safe.get("verification_status"):
            safe["verification_status"] = "Approved"

    # ── Financial defaults ────────────────────────────────────────────────────
    safe.setdefault("line_items", [])
    safe.setdefault("subtotal", 0.0)
    safe.setdefault("tax_amount", 0.0)
    safe.setdefault("discount_amount", 0.0)
    safe.setdefault("shipping_freight", 0.0)
    safe.setdefault("other_charges", 0.0)
    # grand_total canonical — fall back to invoice_amount
    inv_amt = safe.get("invoice_amount") or 0.0
    safe.setdefault("grand_total", inv_amt)
    if not safe.get("grand_total"):
        safe["grand_total"] = inv_amt

    # ── PO reference defaults ─────────────────────────────────────────────────
    safe.setdefault("po_tax", 0.0)
    safe.setdefault("po_discount", 0.0)
    safe.setdefault("po_shipping", 0.0)
    safe.setdefault("po_other_charges", 0.0)
    safe.setdefault("po_subtotal", 0.0)
    safe.setdefault("po_unit_price", safe.get("unit_price") or 0.0)
    safe.setdefault("po_quantity", safe.get("quantity") or 0.0)
    safe.setdefault("po_amount", inv_amt)

    # ── Verification defaults ─────────────────────────────────────────────────
    safe.setdefault("verification_id", None)
    safe.setdefault("verification_status", None)
    safe.setdefault("comparison_result", None)
    safe.setdefault("verification_remarks",
                    safe.get("verification_notes"))  # legacy alias

    # ── Payment defaults ──────────────────────────────────────────────────────
    safe.setdefault("payment_status", "Unpaid")
    safe.setdefault("payment_id", None)
    safe.setdefault("payment_amount", None)
    safe.setdefault("payment_date", None)
    safe.setdefault("payment_settled_by_name", None)
    safe.setdefault("payment_remarks", None)

    return safe
