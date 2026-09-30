"""
services/invoice_service.py
----------------------------
Complete Finance workflow: Verification + Payment Settlement + Reports.

Lifecycle:
  1. PO created → Invoice auto-stub (status: Pending)
  2. Vendor submits invoice details → status: Submitted
  3. Finance Officer 3-way verify (PR vs PO vs Invoice) → Approved / Rejected / Correction Required
  4. Delivery completed → Finance Officer settles payment → status: Paid / Settled

Performance rules (strictly enforced):
  - Every function fetches ONLY the needed document(s) via targeted find_one / find
  - DataCo CSV is NEVER touched in this module
  - PDF/Excel are LAZY — only generated when explicitly called
  - Notifications wrapped in try/except (non-blocking)
  - No full-collection scans in hot paths
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple

from bson import ObjectId

from database.connection import get_database
from models.invoice import Invoice, invoice_from_mongo
from models.purchase_order import po_from_mongo
from utils.logger import log_audit
from config.settings import (
    COLLECTION_INVOICES,
    COLLECTION_PURCHASE_ORDERS,
    COLLECTION_PROCUREMENT_REQUESTS,
    COLLECTION_DELIVERIES,
    COLLECTION_PAYMENTS,
    COLLECTION_USERS,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _generate_invoice_number() -> str:
    import time
    ts = int(time.time() * 1000) % 100000000
    return f"INV-{ts:08d}"


def _generate_verification_id() -> str:
    uid = uuid.uuid4().hex[:8].upper()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    return f"VFY-{ts}-{uid}"


def _generate_payment_id() -> str:
    uid = uuid.uuid4().hex[:8].upper()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    return f"PAY-{ts}-{uid}"


def _safe_float(val, default: float = 0.0) -> float:
    try:
        return float(val) if val is not None else default
    except (TypeError, ValueError):
        return default


def _ts_str(val) -> str:
    if not val:
        return "N/A"
    if isinstance(val, datetime):
        return val.strftime("%d %b %Y %H:%M UTC")
    try:
        return str(val)[:19].replace("T", " ")
    except Exception:
        return str(val)


def _f_str(val, prefix="USD ") -> str:
    try:
        return f"{prefix}{float(val):,.2f}"
    except Exception:
        return "N/A"


def _s(val, default="N/A") -> str:
    return str(val) if val else default



# ─────────────────────────────────────────────────────────────────────────────
# Mismatch Constants
# ─────────────────────────────────────────────────────────────────────────────

MATCH             = "✓ MATCHED"
MISMATCH          = "⚠ MISMATCH"
CRITICAL_MISMATCH = "✕ CRITICAL MISMATCH"
NA_STATUS         = "— N/A"
AMOUNT_TOLERANCE  = 0.01   # Within 1 cent = MATCHED

# Legacy aliases (kept for backward compatibility)
MATCHED = MATCH
CHANGED = MISMATCH


def _field_status(diff: float, label: str = "", is_qty: bool = False) -> str:
    """
    Determine MATCHED / MISMATCH / CRITICAL MISMATCH for a single numeric diff.
    Grand Total and product mismatches are always CRITICAL.
    """
    if abs(diff) <= AMOUNT_TOLERANCE:
        return MATCH
    if label in ("Grand Total",) or abs(diff) > 100.0:
        return CRITICAL_MISMATCH
    if is_qty and abs(diff) > 0.001:
        return MISMATCH
    return MISMATCH


def _worst(statuses: list) -> str:
    if CRITICAL_MISMATCH in statuses:
        return CRITICAL_MISMATCH
    if MISMATCH in statuses:
        return MISMATCH
    # Filter out N/A before deciding MATCHED
    real = [s for s in statuses if s and s != NA_STATUS]
    if not real:
        return NA_STATUS
    return MATCH


# ─────────────────────────────────────────────────────────────────────────────
# Comparison Engine 1: PR Snapshot → PO
# ─────────────────────────────────────────────────────────────────────────────

def _compare_pr_to_po(pr_snapshot: dict, po_doc: dict) -> dict:
    """
    Compare the immutable PR snapshot (captured at PO creation) against
    the actual PO values.

    If the PR snapshot does not exist or has no meaningful expected data
    (e.g. DataCo-imported PRs with all-zero expected_* fields), the
    comparison is skipped and all rows return NA_STATUS so that Finance
    never sees a false mismatch just because a PR had no budget breakdown.

    Returns:
        rows           — list of field comparison dicts
        overall        — MATCHED | MISMATCH | CRITICAL MISMATCH | N/A
        has_changes    — True only when an actual field changed
        changed_fields — list of changed fields with old/new values and diff
        skipped        — True when comparison was not possible
    """
    rows = []
    skipped = False

    # Prefer the embedded pr_snapshot on the PO doc over a full PR doc
    snap = po_doc.get("pr_snapshot") or pr_snapshot or {}

    has_expected_data = snap.get("has_expected_data", False)
    # Also check if any meaningful values exist (not all zero)
    if not has_expected_data:
        has_expected_data = any(
            _safe_float(snap.get(f)) > 0
            for f in ("grand_total", "unit_price", "quantity")
        )

    if not snap or not has_expected_data:
        skipped = True

    FIELDS = [
        ("Quantity",          "quantity",         "quantity",         False),
        ("Unit Price",        "unit_price",       "unit_price",       True),
        ("Tax",               "tax_amount",       "tax_amount",       True),
        ("Discount",          "discount_amount",  "discount_amount",  True),
        ("Shipping / Freight","shipping_freight", "shipping_freight", True),
        ("Other Charges",     "other_charges",    "other_charges",    True),
        ("Grand Total",       "grand_total",      "grand_total",      True),
    ]

    for label, snap_key, po_key, is_amount in FIELDS:
        pr_val = _safe_float(snap.get(snap_key)) if snap else 0.0
        po_val = _safe_float(po_doc.get(po_key))
        diff   = round(po_val - pr_val, 4)

        if skipped:
            status = NA_STATUS
        else:
            status = _field_status(diff, label, is_qty=(not is_amount))

        rows.append({
            "label":    label,
            "pr_value": pr_val,
            "po_value": po_val,
            "diff":     diff,
            "status":   status,
        })

    statuses = [r["status"] for r in rows]
    changed_fields = []

    if skipped:
        overall = NA_STATUS
    else:
        # Check product name change if both are specified
        pr_prod = str(snap.get("product_name") or "").strip()
        po_prod = str(po_doc.get("product_name") or (po_doc.get("items", [{}])[0].get("description") if po_doc.get("items") else "")).strip()
        if pr_prod and po_prod and pr_prod.lower() != po_prod.lower():
            statuses.append(CRITICAL_MISMATCH)
            changed_fields.append({
                "field": "Product Name",
                "source": "Requisition → PO",
                "old_value": pr_prod,
                "new_value": po_prod,
                "diff": 0.0,
                "status": CRITICAL_MISMATCH,
            })

        for r in rows:
            if r["status"] not in (MATCH, NA_STATUS):
                changed_fields.append({
                    "field": r["label"],
                    "source": "Requisition → PO",
                    "old_value": r["pr_value"],
                    "new_value": r["po_value"],
                    "diff": r["diff"],
                    "status": r["status"],
                })

        real_statuses = [s for s in statuses if s != NA_STATUS]
        overall = _worst(real_statuses)

    return {
        "rows":           rows,
        "overall":        overall,
        "has_changes":    (overall not in (MATCH, NA_STATUS)),
        "changed_fields": changed_fields,
        "skipped":        skipped,
        "label":          "Requisition → PO",
        "computed_at":    datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Comparison Engine 2: PO → Invoice   (Vendor Billing Verification)
# ─────────────────────────────────────────────────────────────────────────────

def _compare_po_to_invoice(po_doc: dict, inv_doc: dict) -> dict:
    """
    Compare the AGREED PO values against the VENDOR-SUBMITTED invoice values.
    This is used by Finance to detect if the vendor billed different amounts.

    MATCHED  → values identical within $0.01 tolerance
    MISMATCH → difference exists
    CRITICAL MISMATCH → Grand Total differs, or diff > $100, or products differ

    Never returns MISMATCH just because an invoice does not exist or payment is pending.
    """
    # Baseline PO values
    po_qty   = _safe_float(po_doc.get("quantity") or 0)
    po_up    = _safe_float(po_doc.get("unit_price") or 0)
    po_sub   = _safe_float(po_doc.get("subtotal") or 0)
    if po_sub <= 0 and po_qty > 0 and po_up > 0:
        po_sub = round(po_qty * po_up, 2)
    po_tax   = _safe_float(po_doc.get("tax_amount") or 0)
    po_disc  = _safe_float(po_doc.get("discount_amount") or 0)
    po_ship  = _safe_float(po_doc.get("shipping_freight") or 0)
    po_other = _safe_float(po_doc.get("other_charges") or 0)
    po_grand = _safe_float(po_doc.get("grand_total") or po_doc.get("total_amount") or 0)
    if po_grand <= 0 and po_sub > 0:
        po_grand = round(po_sub + po_tax - po_disc + po_ship + po_other, 2)

    # If no invoice exists or invoice has not been submitted with separate amounts,
    # default invoice values to PO agreed values so no false mismatch is generated.
    has_real_invoice = bool(inv_doc and inv_doc.get("invoice_number"))
    is_submitted = (inv_doc.get("invoice_status") in ("Submitted", "Approved", "Verified", "Correction Required")) if inv_doc else False

    if not has_real_invoice:
        # No invoice exists: comparison is matched / baseline
        rows = [
            {"label": "Quantity", "po_value": po_qty, "inv_value": po_qty, "diff": 0.0, "status": MATCH},
            {"label": "Unit Price", "po_value": po_up, "inv_value": po_up, "diff": 0.0, "status": MATCH},
            {"label": "Subtotal", "po_value": po_sub, "inv_value": po_sub, "diff": 0.0, "status": MATCH},
            {"label": "Tax", "po_value": po_tax, "inv_value": po_tax, "diff": 0.0, "status": MATCH},
            {"label": "Discount", "po_value": po_disc, "inv_value": po_disc, "diff": 0.0, "status": MATCH},
            {"label": "Shipping / Freight", "po_value": po_ship, "inv_value": po_ship, "diff": 0.0, "status": MATCH},
            {"label": "Other Charges", "po_value": po_other, "inv_value": po_other, "diff": 0.0, "status": MATCH},
            {"label": "Grand Total", "po_value": po_grand, "inv_value": po_grand, "diff": 0.0, "status": MATCH},
        ]
        return {
            "rows":             rows,
            "overall":          MATCH,
            "has_mismatch":     False,
            "added_products":   [],
            "removed_products": [],
            "changed_fields":   [],
            "skipped":          True,
            "label":            "PO → Invoice",
            "computed_at":      datetime.now(timezone.utc).isoformat(),
        }

    # Invoice exists — extract values, falling back to PO values if unsubmitted/unset
    inv_items = inv_doc.get("line_items") or []

    inv_qty = _safe_float(inv_doc.get("quantity"))
    if inv_qty <= 0 and not is_submitted:
        inv_qty = po_qty

    inv_up = _safe_float(inv_doc.get("unit_price"))
    if inv_up <= 0 and not is_submitted:
        inv_up = po_up

    inv_sub = _safe_float(inv_doc.get("subtotal"))
    if inv_sub <= 0 and inv_items:
        inv_sub = round(sum(_safe_float(i.get("line_total") or
            (_safe_float(i.get("quantity")) * _safe_float(i.get("unit_price")))) for i in inv_items), 2)
    if inv_sub <= 0:
        inv_sub = round(inv_qty * inv_up, 2) if (inv_qty > 0 and inv_up > 0) else po_sub

    inv_tax = _safe_float(inv_doc.get("tax_amount"))
    if inv_tax <= 0 and not is_submitted:
        inv_tax = po_tax

    inv_disc = _safe_float(inv_doc.get("discount_amount"))
    if inv_disc <= 0 and not is_submitted:
        inv_disc = po_disc

    inv_ship = _safe_float(inv_doc.get("shipping_freight"))
    if inv_ship <= 0 and not is_submitted:
        inv_ship = po_ship

    inv_other = _safe_float(inv_doc.get("other_charges"))
    if inv_other <= 0 and not is_submitted:
        inv_other = po_other

    inv_grand = _safe_float(inv_doc.get("grand_total") or inv_doc.get("invoice_amount"))
    if inv_grand <= 0 and not is_submitted:
        inv_grand = po_grand
    elif inv_grand <= 0 and inv_sub > 0:
        inv_grand = round(inv_sub + inv_tax - inv_disc + inv_ship + inv_other, 2)

    rows = []
    # 1. Quantity
    qty_diff = round(inv_qty - po_qty, 4)
    qty_status = MATCH if abs(qty_diff) < 0.001 else MISMATCH
    rows.append({"label": "Quantity", "po_value": po_qty, "inv_value": inv_qty, "diff": qty_diff, "status": qty_status})

    # 2. Unit Price
    up_diff = round(inv_up - po_up, 4)
    rows.append({"label": "Unit Price", "po_value": po_up, "inv_value": inv_up, "diff": up_diff, "status": _field_status(up_diff, "Unit Price")})

    # 3. Subtotal
    sub_diff = round(inv_sub - po_sub, 4)
    rows.append({"label": "Subtotal", "po_value": po_sub, "inv_value": inv_sub, "diff": sub_diff, "status": _field_status(sub_diff, "Subtotal")})

    # 4. Tax
    tax_diff = round(inv_tax - po_tax, 4)
    rows.append({"label": "Tax", "po_value": po_tax, "inv_value": inv_tax, "diff": tax_diff, "status": _field_status(tax_diff, "Tax")})

    # 5. Discount
    disc_diff = round(inv_disc - po_disc, 4)
    rows.append({"label": "Discount", "po_value": po_disc, "inv_value": inv_disc, "diff": disc_diff, "status": _field_status(disc_diff, "Discount")})

    # 6. Shipping / Freight
    ship_diff = round(inv_ship - po_ship, 4)
    rows.append({"label": "Shipping / Freight", "po_value": po_ship, "inv_value": inv_ship, "diff": ship_diff, "status": _field_status(ship_diff, "Shipping / Freight")})

    # 7. Other Charges
    other_diff = round(inv_other - po_other, 4)
    rows.append({"label": "Other Charges", "po_value": po_other, "inv_value": inv_other, "diff": other_diff, "status": _field_status(other_diff, "Other Charges")})

    # 8. Grand Total
    grand_diff = round(inv_grand - po_grand, 4)
    grand_status = MATCH if abs(grand_diff) <= AMOUNT_TOLERANCE else CRITICAL_MISMATCH
    rows.append({"label": "Grand Total", "po_value": po_grand, "inv_value": inv_grand, "diff": grand_diff, "status": grand_status})

    # Product-level check (only if vendor invoice explicitly specified line items)
    po_items  = po_doc.get("items") or []
    added_products   = []
    removed_products = []
    if inv_items and po_items:
        inv_prods = {str(i.get("product_name", "")).strip().lower() for i in inv_items if i.get("product_name")}
        po_prods  = {str(i.get("description", "") or i.get("product_name", "")).strip().lower() for i in po_items if (i.get("description") or i.get("product_name"))}
        added_products   = [p for p in inv_prods if p not in po_prods and p]
        removed_products = [p for p in po_prods if p not in inv_prods and p]

    statuses = [r["status"] for r in rows]
    if CRITICAL_MISMATCH in statuses or added_products or removed_products:
        overall = CRITICAL_MISMATCH
    elif MISMATCH in statuses:
        overall = MISMATCH
    else:
        overall = MATCH

    changed_fields = [
        {"field": r["label"], "source": "PO → Invoice", "old_value": r["po_value"],
         "new_value": r["inv_value"], "diff": r["diff"], "status": r["status"]}
        for r in rows if r["status"] != MATCH
    ]
    if added_products:
        changed_fields.append({
            "field": "Products Added", "source": "PO → Invoice", "old_value": "—",
            "new_value": ", ".join(added_products), "diff": 0.0, "status": CRITICAL_MISMATCH
        })
    if removed_products:
        changed_fields.append({
            "field": "Products Removed", "source": "PO → Invoice", "old_value": ", ".join(removed_products),
            "new_value": "—", "diff": 0.0, "status": CRITICAL_MISMATCH
        })

    return {
        "rows":             rows,
        "overall":          overall,
        "has_mismatch":     (overall != MATCH),
        "added_products":   added_products,
        "removed_products": removed_products,
        "changed_fields":   changed_fields,
        "label":            "PO → Invoice",
        "computed_at":      datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Comparison Engine 3: Invoice → Delivery
# ─────────────────────────────────────────────────────────────────────────────

def _compare_delivery_to_invoice(po_doc: dict, inv_doc: dict, del_doc: dict) -> dict:
    """
    Compare delivery quantity against invoiced quantity.
    Returns a simple single-row comparison plus overall.
    """
    if not del_doc:
        return {"rows": [], "overall": NA_STATUS, "has_mismatch": False,
                "label": "Delivery", "skipped": True,
                "computed_at": datetime.now(timezone.utc).isoformat()}

    inv_qty = _safe_float(inv_doc.get("quantity") or po_doc.get("quantity") or 0)
    del_qty = _safe_float(del_doc.get("quantity") or del_doc.get("delivered_quantity") or 0)
    diff    = round(del_qty - inv_qty, 4)
    status  = MATCH if abs(diff) < 0.001 else (CRITICAL_MISMATCH if abs(diff) > inv_qty * 0.05 else MISMATCH)

    rows = [{"label": "Delivered Quantity", "inv_value": inv_qty,
              "del_value": del_qty, "diff": diff, "status": status}]

    del_status = del_doc.get("status", "")
    is_delivered = del_status in ("Delivered", "Completed")
    delivery_status_row = {
        "label": "Delivery Status",
        "del_value": del_status,
        "status": MATCH if is_delivered else MISMATCH,
    }
    rows.append(delivery_status_row)

    overall = _worst([r["status"] for r in rows])
    return {
        "rows":        rows,
        "overall":     overall,
        "has_mismatch": (overall != MATCH),
        "is_delivered": is_delivered,
        "delivery_status": del_status,
        "label":       "Delivery",
        "skipped":     False,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Master Comparison Builder (Three-Way Reconciliation)
# ─────────────────────────────────────────────────────────────────────────────

def _build_comparison_matrix(pr_doc: dict, po_doc: dict, inv_doc: dict,
                              del_doc: dict = None) -> dict:
    """
    Build three focused comparison matrices and combine them:

    Leg 1 (PR→PO):   Uses pr_snapshot embedded in po_doc if available,
                     otherwise falls back to pr_doc expected_* fields.
                     SKIPPED (N/A) when no meaningful baseline exists (e.g. DataCo).
    Leg 2 (PO→Inv):  Agreed PO values vs vendor invoice billing.
    Leg 3 (Delivery): Delivery qty vs Invoice qty.

    Mismatch rule:
      - Compare FINAL PO against ORIGINAL APPROVED REQUISITION (Leg 1).
      - Compare VENDOR INVOICE against AGREED PO (Leg 2).
      - If NO values were changed on either leg, status is MATCHED.
      - Legacy DataCo POs with no PR baseline skip Leg 1 (N/A) without false mismatch.
    """
    # Use pr_snapshot from PO doc as first priority
    pr_snap = po_doc.get("pr_snapshot") or {}

    # If no embedded snapshot, build one from pr_doc for the comparison
    if not pr_snap and pr_doc:
        has_data = bool(pr_doc.get("expected_grand_total") or pr_doc.get("expected_unit_price") or pr_doc.get("expected_quantity"))
        pr_snap = {
            "quantity":         _safe_float(pr_doc.get("expected_quantity") or pr_doc.get("quantity")),
            "unit_price":       _safe_float(pr_doc.get("expected_unit_price") or pr_doc.get("unit_price")),
            "tax_amount":       _safe_float(pr_doc.get("expected_tax")),
            "discount_amount":  _safe_float(pr_doc.get("expected_discount")),
            "shipping_freight": _safe_float(pr_doc.get("expected_shipping")),
            "other_charges":    _safe_float(pr_doc.get("expected_other_charges")),
            "grand_total":      _safe_float(pr_doc.get("expected_grand_total") or pr_doc.get("estimated_cost")),
            "product_name":     pr_doc.get("product_name") or pr_doc.get("title"),
            "has_expected_data": has_data,
        }

    pr_po_comp  = _compare_pr_to_po(pr_snap, po_doc)
    po_inv_comp = _compare_po_to_invoice(po_doc, inv_doc or {})
    del_comp    = _compare_delivery_to_invoice(po_doc, inv_doc or {}, del_doc or {})

    # Determine overall mismatch and status across both financial comparisons
    pr_po_mismatch = (not pr_po_comp.get("skipped", False)) and (pr_po_comp.get("overall") in (MISMATCH, CRITICAL_MISMATCH))
    po_inv_mismatch = po_inv_comp.get("has_mismatch", False)

    has_mismatch = pr_po_mismatch or po_inv_mismatch

    if (not pr_po_comp.get("skipped", False) and pr_po_comp.get("overall") == CRITICAL_MISMATCH) or po_inv_comp.get("overall") == CRITICAL_MISMATCH:
        overall = CRITICAL_MISMATCH
    elif pr_po_mismatch or po_inv_mismatch:
        overall = MISMATCH
    else:
        overall = MATCH

    # Collect all changed fields across both comparisons
    all_changed_fields = []
    if not pr_po_comp.get("skipped", False):
        all_changed_fields.extend(pr_po_comp.get("changed_fields", []))
    all_changed_fields.extend(po_inv_comp.get("changed_fields", []))

    # Combined row list for comprehensive view
    combined_rows = []
    inv_row_map = {r["label"]: r for r in po_inv_comp["rows"]}
    for pr_row in pr_po_comp["rows"]:
        label = pr_row["label"]
        inv_r = inv_row_map.get(label, {})
        del_r = next((r for r in del_comp["rows"] if r.get("label") == label), {})

        # Row-level status: worst of inv_status and pr_status
        pr_st = pr_row.get("status", NA_STATUS)
        inv_st = inv_r.get("status", MATCH)
        if inv_st in (CRITICAL_MISMATCH, MISMATCH):
            row_status = inv_st
        elif not pr_po_comp.get("skipped", False) and pr_st in (CRITICAL_MISMATCH, MISMATCH):
            row_status = pr_st
        else:
            row_status = MATCH

        combined_rows.append({
            "label":        label,
            "pr_value":     pr_row.get("pr_value", 0),
            "po_value":     pr_row.get("po_value", 0),
            "inv_value":    inv_r.get("inv_value", 0),
            "pr_po_diff":   pr_row.get("diff", 0),
            "po_inv_diff":  inv_r.get("diff", 0),
            "del_value":    del_r.get("del_value"),
            "status":       row_status,
            "pr_po_status": pr_row.get("status", NA_STATUS),
        })

    return {
        # Three focused sub-comparisons
        "pr_po_comparison":  pr_po_comp,
        "po_inv_comparison": po_inv_comp,
        "del_comparison":    del_comp,
        # Legacy combined rows
        "rows":              combined_rows,
        "added_products":    po_inv_comp.get("added_products", []),
        "removed_products":  po_inv_comp.get("removed_products", []),
        # Consolidated flags
        "overall":           overall,
        "has_mismatch":      has_mismatch,
        "changed_fields":    all_changed_fields,
        "computed_at":       datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Invoice CRUD helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_invoices(po_id: str = None, vendor_id: str = None,
                 status: str = None, limit: int = 50) -> List[Dict]:
    try:
        db  = get_database()
        q: Dict[str, Any] = {}
        if po_id:
            q["po_id"] = po_id
        if vendor_id:
            q["vendor_id"] = vendor_id
        if status and status != "All":
            # "Approved" must also match legacy "Verified" in DB
            if status == "Approved":
                q["invoice_status"] = {"$in": ["Approved", "Verified"]}
            elif status == "Verified":
                q["invoice_status"] = {"$in": ["Approved", "Verified"]}
            else:
                q["invoice_status"] = status
        docs = list(db[COLLECTION_INVOICES].find(q).sort("created_at", -1).limit(limit))
        return [invoice_from_mongo(d) for d in docs]
    except Exception as exc:
        logger.error("get_invoices failed: %s", exc)
        return []


def get_invoice_by_id(invoice_id: str) -> Optional[Dict]:
    try:
        db  = get_database()
        doc = db[COLLECTION_INVOICES].find_one({"_id": ObjectId(invoice_id)})
        return invoice_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("get_invoice_by_id %s: %s", invoice_id, exc)
        return None


def get_invoice_by_po_id(po_id: str) -> Optional[Dict]:
    try:
        db  = get_database()
        doc = db[COLLECTION_INVOICES].find_one({"po_id": po_id})
        return invoice_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("get_invoice_by_po_id %s: %s", po_id, exc)
        return None


def get_invoice_stats() -> Dict[str, Any]:
    try:
        db  = get_database()
        col = db[COLLECTION_INVOICES]
        pipeline = [{"$facet": {
            "total":      [{"$count": "n"}],
            "pending":    [{"$match": {"invoice_status": "Pending"}}, {"$count": "n"}],
            "submitted":  [{"$match": {"invoice_status": "Submitted"}}, {"$count": "n"}],
            "approved":   [{"$match": {"invoice_status": {"$in": ["Approved", "Verified"]}}}, {"$count": "n"}],
            "rejected":   [{"$match": {"invoice_status": "Rejected"}}, {"$count": "n"}],
            "correction": [{"$match": {"invoice_status": "Correction Required"}}, {"$count": "n"}],
            "settled":    [{"$match": {"payment_status": "Settled"}}, {"$count": "n"}],
            "pay_pending":[{"$match": {"payment_status": "Approved for Payment"}}, {"$count": "n"}],
        }}]
        result = list(col.aggregate(pipeline))
        r = result[0] if result else {}
        def _n(arr): return arr[0]["n"] if arr else 0
        approved = _n(r.get("approved", []))
        settled  = _n(r.get("settled", []))
        return {
            "total":      _n(r.get("total", [])),
            "pending":    _n(r.get("pending", [])),
            "submitted":  _n(r.get("submitted", [])),
            "approved":   approved,
            "rejected":   _n(r.get("rejected", [])),
            "correction": _n(r.get("correction", [])),
            "settled":    settled,
            "pay_pending":_n(r.get("pay_pending", [])),
            # Legacy aliases
            "verified":    approved,
            "discrepancy": _n(r.get("rejected", [])),
        }
    except Exception as exc:
        logger.error("get_invoice_stats failed: %s", exc)
        return {"total": 0, "pending": 0, "submitted": 0, "approved": 0,
                "rejected": 0, "correction": 0, "settled": 0, "pay_pending": 0,
                "verified": 0, "discrepancy": 0}


def get_recent_invoices(limit: int = 10) -> List[Dict]:
    try:
        db  = get_database()
        docs = list(db[COLLECTION_INVOICES].find({}).sort("created_at", -1).limit(limit))
        return [invoice_from_mongo(d) for d in docs]
    except Exception as exc:
        logger.error("get_recent_invoices: %s", exc)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Create Invoice Stub (auto-called at PO creation)
# ─────────────────────────────────────────────────────────────────────────────

def create_invoice_for_po(po_id: str, po_doc: dict,
                           created_by: str = "system") -> Tuple[bool, str, Optional[Dict]]:
    try:
        db  = get_database()
        col = db[COLLECTION_INVOICES]

        existing = col.find_one({"po_id": po_id})
        if existing:
            return True, "Invoice already exists for this PO.", invoice_from_mongo(existing)

        invoice_number = _generate_invoice_number()
        total_amount   = _safe_float(po_doc.get("grand_total") or po_doc.get("total_amount"))

        invoice = Invoice(
            invoice_number=invoice_number,
            po_id=po_id,
            po_number=po_doc.get("po_number", ""),
            vendor_id=po_doc.get("vendor_id", ""),
            vendor_name=po_doc.get("vendor_name", ""),
            procurement_request_id=po_doc.get("request_id"),
            procurement_request_number=po_doc.get("procurement_request_number"),
            product_name=po_doc.get("product_name"),
            category=po_doc.get("category"),
            quantity=_safe_float(po_doc.get("quantity")),
            unit_price=_safe_float(po_doc.get("unit_price")),
            subtotal=_safe_float(po_doc.get("subtotal")),
            tax_amount=_safe_float(po_doc.get("tax_amount")),
            discount_amount=_safe_float(po_doc.get("discount_amount")),
            shipping_freight=_safe_float(po_doc.get("shipping_freight")),
            other_charges=_safe_float(po_doc.get("other_charges")),
            invoice_amount=total_amount,
            grand_total=total_amount,
            po_amount=total_amount,
            po_tax=_safe_float(po_doc.get("tax_amount")),
            po_discount=_safe_float(po_doc.get("discount_amount")),
            po_shipping=_safe_float(po_doc.get("shipping_freight")),
            po_other_charges=_safe_float(po_doc.get("other_charges")),
            po_subtotal=_safe_float(po_doc.get("subtotal")),
            po_unit_price=_safe_float(po_doc.get("unit_price")),
            po_quantity=_safe_float(po_doc.get("quantity")),
            invoice_status="Pending",
            payment_status="Unpaid",
            created_by=created_by,
        )

        doc    = invoice.to_mongo_doc()
        result = db[COLLECTION_INVOICES].insert_one(doc)
        inv_id = str(result.inserted_id)
        doc["_id"] = inv_id

        log_audit(created_by or "system", "CREATE_INVOICE", "Invoice", inv_id,
                  {"invoice_number": invoice_number, "po_id": po_id})
        return True, f"Invoice {invoice_number} created.", doc

    except Exception as exc:
        logger.error("create_invoice_for_po failed: %s", exc)
        return False, "Failed to create invoice.", None


# ─────────────────────────────────────────────────────────────────────────────
# Vendor Invoice Submission
# ─────────────────────────────────────────────────────────────────────────────

def submit_vendor_invoice(
    invoice_id: str,
    line_items: List[dict],
    tax_amount: float,
    discount_amount: float,
    shipping_freight: float,
    other_charges: float,
    grand_total: float,
    support_doc_name: str = None,
    support_doc_note: str = None,
    submitted_by: str = None,
) -> Tuple[bool, str]:
    try:
        db  = get_database()
        col = db[COLLECTION_INVOICES]
        doc = col.find_one({"_id": ObjectId(invoice_id)})
        if not doc:
            return False, "Invoice not found."
        if doc.get("invoice_status") not in ("Pending", "Correction Required"):
            return False, f"Cannot submit — current status: {doc.get('invoice_status')}."

        subtotal = sum(_safe_float(i.get("line_total")) for i in line_items)
        now      = datetime.now(timezone.utc)

        col.update_one(
            {"_id": ObjectId(invoice_id)},
            {"$set": {
                "line_items":       line_items,
                "subtotal":         round(subtotal, 2),
                "tax_amount":       round(_safe_float(tax_amount), 2),
                "discount_amount":  round(_safe_float(discount_amount), 2),
                "shipping_freight": round(_safe_float(shipping_freight), 2),
                "other_charges":    round(_safe_float(other_charges), 2),
                "grand_total":      round(_safe_float(grand_total), 2),
                "invoice_amount":   round(_safe_float(grand_total), 2),
                "support_doc_name": support_doc_name,
                "support_doc_note": support_doc_note,
                "invoice_status":   "Submitted",
                "submitted_by":     submitted_by,
                "submitted_at":     now,
                "updated_at":       now,
                "quantity":   _safe_float(line_items[0].get("quantity")) if line_items else doc.get("quantity"),
                "unit_price": _safe_float(line_items[0].get("unit_price")) if line_items else doc.get("unit_price"),
            }},
        )

        log_audit(submitted_by or "vendor", "SUBMIT_INVOICE", "Invoice", invoice_id,
                  {"grand_total": grand_total, "items": len(line_items)})

        try:
            from services.notification_service import notify_users_by_role
            notify_users_by_role(
                role="Finance Officer",
                title=f"Invoice Submitted: {doc.get('invoice_number', invoice_id)}",
                message=(f"Vendor submitted invoice {doc.get('invoice_number')} "
                         f"for PO {doc.get('po_number', '')}. Please verify."),
                notification_type="invoice_verification",
                reference_id=invoice_id,
                reference_entity="Invoice",
            )
        except Exception:
            pass

        return True, "Invoice submitted. Awaiting Finance Officer verification."

    except Exception as exc:
        logger.error("submit_vendor_invoice failed: %s", exc)
        return False, "Failed to submit invoice."


# ─────────────────────────────────────────────────────────────────────────────
# Finance Officer 3-Way Verification
# ─────────────────────────────────────────────────────────────────────────────

def finance_verify_invoice(
    invoice_id: str,
    action: str,           # approve | reject | require_correction
    remarks: str,
    verified_by_user_id: str,
    verified_by_name: str,
) -> Tuple[bool, str, Optional[Dict]]:
    """3-way verification. Fetches invoice + PO + PR (3 targeted find_one calls)."""
    if action not in ("approve", "reject", "require_correction"):
        return False, "Invalid action.", None
    if action in ("reject", "require_correction") and not remarks.strip():
        return False, "Remarks/reason is mandatory for rejection or correction.", None

    try:
        db = get_database()

        inv_doc = db[COLLECTION_INVOICES].find_one({"_id": ObjectId(invoice_id)})
        if not inv_doc:
            return False, "Invoice not found.", None
        if inv_doc.get("invoice_status") == "Settled":
            return False, "Cannot modify — invoice is already settled.", None

        po_id  = inv_doc.get("po_id", "")
        po_doc = {}
        if po_id:
            try:
                po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": ObjectId(po_id)}) or {}
            except Exception:
                pass

        pr_id  = inv_doc.get("procurement_request_id") or po_doc.get("request_id", "")
        pr_doc = {}
        if pr_id:
            try:
                pr_doc = db[COLLECTION_PROCUREMENT_REQUESTS].find_one({"_id": ObjectId(pr_id)}) or {}
            except Exception:
                pass

        comparison = _build_comparison_matrix(pr_doc, po_doc, inv_doc)
        overall    = comparison["overall"]

        status_map = {
            "approve":            ("Approved",           "Approved",           "Approved for Payment"),
            "reject":             ("Rejected",            "Rejected",           "On Hold"),
            "require_correction": ("Correction Required", "Correction Required","On Hold"),
        }
        new_inv, new_verif, new_pay = status_map[action]
        match_result  = overall if action == "approve" else "Mismatch"
        verification_id = _generate_verification_id()
        now = datetime.now(timezone.utc)

        db[COLLECTION_INVOICES].update_one(
            {"_id": ObjectId(invoice_id)},
            {"$set": {
                "invoice_status":      new_inv,
                "verification_status": new_verif,
                "verification_id":     verification_id,
                "verified_by":         verified_by_user_id,
                "verified_by_name":    verified_by_name,
                "verified_at":         now,
                "verification_remarks": remarks,
                "rejection_reason":    remarks if action != "approve" else None,
                "match_result":        match_result,
                "comparison_result":   comparison,
                "payment_status":      new_pay,
                "discrepancy_details": {
                    row["label"]: {"pr": row["pr_value"], "po": row["po_value"],
                                   "invoice": row["inv_value"], "status": row["status"]}
                    for row in comparison["rows"] if row["status"] != MATCH
                } or None,
                "updated_at": now,
            }},
        )

        log_audit(verified_by_user_id, f"FINANCE_VERIFY_{action.upper()}", "Invoice", invoice_id,
                  {"verification_id": verification_id, "action": action,
                   "result": new_verif, "overall_match": overall, "remarks": remarks})

        try:
            from services.notification_service import notify_users_by_role, create_typed_notification
            action_label = {"approve": "Approved", "reject": "Rejected",
                            "require_correction": "Correction Required"}.get(action)
            inv_num    = inv_doc.get("invoice_number", invoice_id)
            vendor_id  = inv_doc.get("vendor_id", "")
            notify_users_by_role(
                role="Procurement Manager",
                title=f"Invoice {action_label}: {inv_num}",
                message=(f"Finance Officer {action_label.lower()} invoice {inv_num}. "
                         f"ID: {verification_id}." + (f" Remarks: {remarks}" if remarks else "")),
                notification_type="invoice_verification",
                reference_id=invoice_id, reference_entity="Invoice",
            )
            for vu in db[COLLECTION_USERS].find({"vendor_id": vendor_id}, {"_id": 1}):
                create_typed_notification(
                    user_id=str(vu["_id"]), notif_type="invoice_verification",
                    title=f"Invoice {inv_num} — {action_label}",
                    message=(f"Your invoice {inv_num} has been {action_label.lower()}. "
                             + (f"Remarks: {remarks}" if remarks else "No remarks.")),
                    reference_id=invoice_id, reference_entity="Invoice",
                )
        except Exception:
            pass

        action_label = {"approve": "Approved", "reject": "Rejected",
                        "require_correction": "Correction Required"}.get(action)
        return True, f"Invoice {action_label}. Verification ID: {verification_id}", {
            "verification_id": verification_id, "action": action,
            "invoice_status": new_inv, "payment_status": new_pay,
            "overall_match": overall, "comparison": comparison,
        }

    except Exception as exc:
        logger.error("finance_verify_invoice failed: %s", exc)
        return False, "Verification failed.", None


# ─────────────────────────────────────────────────────────────────────────────
# Delivery Check Helper
# ─────────────────────────────────────────────────────────────────────────────

def get_delivery_for_po(po_id: str) -> Optional[Dict]:
    """
    Fetch the delivery record for a PO.

    Lookup order (first match wins):
      Strategy 1: deliveries.po_id == po_id  (string)
      Strategy 2: deliveries.po_id == ObjectId(po_id)
      Strategy 3: PO lookup → deliveries.po_number
      Strategy 4: PO's own status field fallback
                  If the purchase_orders document has status "Delivered"
                  or "Completed" but no delivery record exists yet, synthesise
                  a delivery dict from the PO.  This ensures Finance is never
                  blocked by a missing deliveries record when the PO status
                  already reflects delivery completion — the authoritative DB
                  value (PO.status) is used directly, no hardcoding.
    """
    try:
        db = get_database()

        # Strategy 1: string po_id (Finance workflow / po_status_sync records)
        doc = db[COLLECTION_DELIVERIES].find_one({"po_id": po_id})
        if doc:
            d = dict(doc); d["_id"] = str(d["_id"]); return d

        # Strategy 2: ObjectId po_id (DataCo dataset uses these)
        try:
            doc = db[COLLECTION_DELIVERIES].find_one({"po_id": ObjectId(po_id)})
            if doc:
                d = dict(doc); d["_id"] = str(d["_id"]); return d
        except Exception:
            pass

        # Strategy 3: find PO by _id, then look up delivery by po_number
        po_doc = None
        try:
            po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": ObjectId(po_id)})
            if po_doc and po_doc.get("po_number"):
                doc = db[COLLECTION_DELIVERIES].find_one({"po_number": po_doc["po_number"]})
                if doc:
                    d = dict(doc); d["_id"] = str(d["_id"]); return d
        except Exception:
            pass

        # Strategy 4: PO-status fallback — use the PO's own status as delivery truth.
        # This handles POs that were marked Delivered/Completed via update_po_status()
        # before the delivery-upsert fix was deployed, or any edge case where the
        # deliveries document was not yet written.
        try:
            if po_doc is None:
                try:
                    po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": ObjectId(po_id)})
                except Exception:
                    po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"po_number": po_id})
            if po_doc:
                po_status = po_doc.get("status", "")
                if po_status in ("Delivered", "Completed"):
                    # Build a synthetic delivery record from the PO document.
                    # This is a read-only representation — nothing is written here.
                    # The next call to update_po_status will write a real record.
                    actual_date = (
                        po_doc.get("actual_delivery_date")
                        or po_doc.get("updated_at")
                        or po_doc.get("created_at")
                    )
                    logger.info(
                        "get_delivery_for_po: no delivery record found for PO %s — "
                        "synthesising from PO status '%s' (Strategy 4 fallback).",
                        po_doc.get("po_number", po_id), po_status,
                    )
                    return {
                        "_id":         None,
                        "po_id":       str(po_doc["_id"]),
                        "po_number":   po_doc.get("po_number", ""),
                        "vendor_id":   po_doc.get("vendor_id", ""),
                        "status":      po_status,          # "Delivered" or "Completed"
                        "actual_date": actual_date,
                        "source":      "po_status_fallback",  # Marks it as synthesised
                        "synthesised": True,
                    }
        except Exception as fb_exc:
            logger.warning("get_delivery_for_po strategy-4 error for %s: %s", po_id, fb_exc)

        return None
    except Exception as exc:
        logger.error("get_delivery_for_po %s: %s", po_id, exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Payment Settlement
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# PO-Wise Payment Settlement Engine
# ─────────────────────────────────────────────────────────────────────────────

def get_po_payment_preflight(po_id: str) -> Dict[str, Any]:
    """
    Independent PO-wise payment preflight analysis.
    Fetches PO, Delivery, Invoice, and PR records.
    Determines delivery status, finance verification, mismatch status, and payment eligibility.
    """
    try:
        db = get_database()
        po_doc = None
        try:
            po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": ObjectId(po_id)})
        except Exception:
            pass
        if not po_doc:
            po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": po_id})
        if not po_doc:
            po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"po_number": po_id})

        if not po_doc:
            return {"error": f"Purchase Order '{po_id}' not found."}

        po = po_from_mongo(po_doc)
        po_str_id = str(po.get("_id", po_id))
        po_number = po.get("po_number", "")

        # 1. Delivery Check
        del_doc = get_delivery_for_po(po_str_id) or {}
        del_status = del_doc.get("status", "Not Dispatched")
        is_delivered = del_status in ("Delivered", "Completed")

        # 2. Invoice Check
        inv_doc = db[COLLECTION_INVOICES].find_one({"po_id": po_str_id})
        if not inv_doc and po_number:
            inv_doc = db[COLLECTION_INVOICES].find_one({"po_number": po_number})

        inv = invoice_from_mongo(inv_doc) if inv_doc else {}
        inv_id = str(inv.get("_id", "")) if inv else ""
        inv_status = inv.get("invoice_status", "Not Available") if inv else "Not Available"
        is_verified = inv_status in ("Approved", "Verified")

        # 3. Procurement Request Check
        pr_id = po.get("request_id") or (inv.get("procurement_request_id") if inv else None)
        pr_doc = {}
        if pr_id:
            try:
                raw_pr = db[COLLECTION_PROCUREMENT_REQUESTS].find_one({"_id": ObjectId(pr_id)})
                if raw_pr:
                    from models.procurement import procurement_from_mongo
                    pr_doc = procurement_from_mongo(raw_pr)
            except Exception:
                pass

        # 4. 4-Way Comparison Matrix
        comparison = _build_comparison_matrix(pr_doc, po, inv if inv else {}, del_doc)
        has_mismatch = comparison.get("has_mismatch", False)
        overall_match = comparison.get("overall", MATCH)

        # 5. Payment Status
        po_pay_status = po.get("payment_status", "Pending")
        inv_pay_status = inv.get("payment_status", "Unpaid") if inv else "Unpaid"

        is_paid = (po_pay_status in ("Paid", "Settled") or inv_pay_status == "Settled")
        is_on_hold = (po_pay_status == "On Hold" or inv_pay_status == "On Hold")

        # 6. Payable Amount (Never 0 if valid data exists)
        payable_amount = _safe_float(inv.get("grand_total") or inv.get("invoice_amount"))
        if payable_amount <= 0:
            payable_amount = _safe_float(po.get("grand_total") or po.get("total_amount"))
        if payable_amount <= 0:
            qty = _safe_float(po.get("quantity") or 1)
            up = _safe_float(po.get("unit_price") or 0)
            payable_amount = round(qty * up, 2)

        # 7. Blockers & Gating
        blockers = []
        if is_paid:
            blockers.append("Payment already completed and settled for this PO.")
        elif not is_delivered:
            blockers.append(f"Delivery not completed (Current status: {del_status}). Payment locked until delivery is complete.")
        elif not inv:
            blockers.append("Invoice has not been generated or submitted for this PO.")
        elif not is_verified and not is_on_hold:
            blockers.append(f"Invoice is awaiting Finance verification (Current status: {inv_status}).")

        # Delivery gating: payment strictly allowed only if delivery is complete!
        can_pay = (is_delivered and bool(inv) and is_verified and not is_paid and not is_on_hold)

        # Status badge string
        if is_paid:
            curr_state = "Paid"
        elif is_on_hold:
            curr_state = "On Hold"
        elif not is_delivered:
            curr_state = "Payment Locked"
        elif has_mismatch:
            curr_state = "Mismatch Detected"
        elif can_pay:
            curr_state = "Ready to Pay"
        else:
            curr_state = "Pending Verification"

        return {
            "po_id": po_str_id,
            "po_number": po_number,
            "po": po,
            "delivery": del_doc,
            "delivery_status": del_status,
            "is_delivered": is_delivered,
            "invoice": inv,
            "invoice_id": inv_id,
            "invoice_status": inv_status,
            "is_verified": is_verified,
            "pr": pr_doc,
            "comparison": comparison,
            "has_mismatch": has_mismatch,
            "overall_match": overall_match,
            "is_paid": is_paid,
            "is_on_hold": is_on_hold,
            "payment_status": curr_state,
            "payable_amount": payable_amount,
            "can_pay": can_pay,
            "blockers": blockers,
        }
    except Exception as exc:
        logger.error("get_po_payment_preflight error: %s", exc)
        return {"error": str(exc)}


def get_settlement_preflight(invoice_id: str) -> Dict:
    """
    Fetch all data needed for the Settle Payment screen by invoice_id.
    Delegates to get_po_payment_preflight when PO is available, ensuring consistency.
    """
    try:
        db = get_database()
        inv_doc = db[COLLECTION_INVOICES].find_one({"_id": ObjectId(invoice_id)})
        if not inv_doc:
            return {"error": "Invoice not found."}

        inv = invoice_from_mongo(inv_doc)
        po_id = inv.get("po_id", "")
        if po_id:
            preflight = get_po_payment_preflight(po_id)
            if not preflight.get("error"):
                preflight["can_settle"] = preflight["can_pay"] and not preflight["has_mismatch"]
                return preflight

        # Fallback for standalone invoice
        po_doc = {}
        pr_doc = {}
        del_doc = get_delivery_for_po(po_id) or {}
        comparison = inv.get("comparison_result") or _build_comparison_matrix(pr_doc, po_doc, inv_doc, del_doc)

        blockers = []
        if inv.get("payment_status") == "Settled":
            blockers.append("DUPLICATE: This invoice has already been settled.")
        del_status = del_doc.get("status", "")
        if del_status not in ("Delivered", "Completed"):
            blockers.append(f"DELIVERY NOT COMPLETE: Current delivery status is '{del_status or 'Not Found'}'.")
        inv_status = inv.get("invoice_status", "")
        if inv_status not in ("Approved", "Verified"):
            blockers.append(f"INVOICE NOT VERIFIED: Current status is '{inv_status}'.")

        return {
            "invoice": inv,
            "po": po_doc,
            "pr": pr_doc,
            "delivery": del_doc,
            "comparison": comparison,
            "blockers": blockers,
            "can_settle": len(blockers) == 0,
            "can_pay": len(blockers) == 0,
            "has_mismatch": comparison.get("has_mismatch", False),
            "payable_amount": _safe_float(inv.get("grand_total") or inv.get("invoice_amount", 0)),
        }
    except Exception as exc:
        logger.error("get_settlement_preflight failed: %s", exc)
        return {"error": str(exc)}


def execute_po_payment(
    po_id: str,
    invoice_id: Optional[str],
    finance_officer_id: str,
    finance_officer_name: str,
    payment_amount: float,
    payment_method: str = "Bank Transfer",
    payment_reference: Optional[str] = None,
    remarks: Optional[str] = None,
    is_mismatch_approved: bool = False,
) -> Tuple[bool, str, Optional[str]]:
    """
    Executes payment for an individual PO and its linked invoice.
    Enforces delivery completion and prevents duplicate payment.
    Generates unique Payment Reference ID, updates PO & Invoice status,
    logs immutable audit record, and sends notifications.
    """
    try:
        db = get_database()
        po_doc = None
        try:
            po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": ObjectId(po_id)})
        except Exception:
            pass
        if not po_doc:
            po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": po_id})
        if not po_doc:
            po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"po_number": po_id})
        if not po_doc:
            return False, "Purchase Order not found.", None

        po_str_id = str(po_doc["_id"])
        po_num = po_doc.get("po_number", "PO-N/A")
        vendor_id = po_doc.get("vendor_id", "")
        vendor_name = po_doc.get("vendor_name", "")

        # Prevent duplicate payment
        if po_doc.get("payment_status") in ("Paid", "Settled"):
            return False, f"Duplicate payment prevented. PO {po_num} is already paid.", None

        # Delivery check: MUST be Delivered or Completed.
        # get_delivery_for_po() now includes a PO-status fallback (Strategy 4)
        # so it returns a synthetic delivery dict if no delivery record exists
        # but the PO itself is Delivered/Completed.  A secondary guard on the
        # PO status prevents an erroneous block if the delivery lookup fails.
        del_doc = get_delivery_for_po(po_str_id)
        del_stat_from_doc = del_doc.get("status", "") if del_doc else ""
        po_status_direct   = po_doc.get("status", "")
        delivery_confirmed = (
            del_stat_from_doc in ("Delivered", "Completed")
            or po_status_direct  in ("Delivered", "Completed")
        )
        if not delivery_confirmed:
            del_stat = del_stat_from_doc or po_status_direct or "Not Found"
            return False, (
                f"Cannot pay PO {po_num} — delivery status is '{del_stat}'. "
                "Delivery must be completed before payment."
            ), None

        # Check linked invoice
        inv_doc = None
        if invoice_id:
            try:
                inv_doc = db[COLLECTION_INVOICES].find_one({"_id": ObjectId(invoice_id)})
            except Exception:
                pass
        if not inv_doc:
            inv_doc = db[COLLECTION_INVOICES].find_one({"po_id": po_str_id})

        inv_id_str = str(inv_doc["_id"]) if inv_doc else (invoice_id or "")
        inv_num = inv_doc.get("invoice_number", "N/A") if inv_doc else "N/A"

        if inv_doc and inv_doc.get("payment_status") == "Settled":
            return False, f"Duplicate payment prevented. Invoice {inv_num} is already settled.", None

        payment_id = _generate_payment_id()
        now = datetime.now(timezone.utc)
        final_amount = round(float(payment_amount), 2)
        ref_code = payment_reference or payment_id

        # Update Purchase Order
        db[COLLECTION_PURCHASE_ORDERS].update_one(
            {"_id": po_doc["_id"]},
            {"$set": {
                "payment_status": "Paid",
                "payment_id": payment_id,
                "payment_amount": final_amount,
                "payment_date": now,
                "paid_by": finance_officer_name,
                "paid_by_id": finance_officer_id,
                "payment_method": payment_method,
                "payment_reference": ref_code,
                "payment_remarks": remarks or ("Mismatch reviewed & approved by Finance" if is_mismatch_approved else "Payment settled"),
                "mismatch_approved": is_mismatch_approved,
                "updated_at": now,
            }}
        )

        # Update Invoice
        if inv_doc:
            db[COLLECTION_INVOICES].update_one(
                {"_id": inv_doc["_id"]},
                {"$set": {
                    "payment_status": "Settled",
                    "invoice_status": "Paid",
                    "payment_id": payment_id,
                    "payment_amount": final_amount,
                    "payment_date": now,
                    "payment_settled_by": finance_officer_id,
                    "payment_settled_by_name": finance_officer_name,
                    "payment_method": payment_method,
                    "payment_reference": ref_code,
                    "payment_remarks": remarks or ("Mismatch approved by Finance" if is_mismatch_approved else "Payment settled"),
                    "updated_at": now,
                }}
            )

        # Insert Payment Record into payments collection
        payment_record = {
            "payment_id": payment_id,
            "po_id": po_str_id,
            "po_number": po_num,
            "invoice_id": inv_id_str,
            "invoice_number": inv_num,
            "vendor_id": vendor_id,
            "vendor_name": vendor_name,
            "amount": final_amount,
            "currency": "USD",
            "payment_method": payment_method,
            "payment_reference": ref_code,
            "settled_by": finance_officer_id,
            "settled_by_name": finance_officer_name,
            "remarks": remarks,
            "mismatch_approved": is_mismatch_approved,
            "settled_at": now,
            "created_at": now,
        }
        try:
            db[COLLECTION_PAYMENTS].insert_one(payment_record)
        except Exception as pe:
            logger.warning("Payment record insert failed (non-fatal): %s", pe)

        # Audit Log
        log_audit(
            finance_officer_id, "PO_PAYMENT_EXECUTED", "PurchaseOrder", po_str_id,
            {"po_number": po_num, "invoice_number": inv_num, "payment_id": payment_id,
             "amount": final_amount, "vendor_id": vendor_id, "mismatch_approved": is_mismatch_approved}
        )

        # Role-based notifications (non-blocking)
        try:
            from services.notification_service import notify_users_by_role, create_typed_notification
            msg_body = (
                f"Payment Completed — USD {final_amount:,.2f} settled for PO {po_num} "
                f"(Invoice: {inv_num}). Payment Reference: {payment_id}."
                + (f" Remarks: {remarks}" if remarks else "")
            )

            # 1. Procurement Manager
            notify_users_by_role(
                role="Procurement Manager",
                title=f"Payment Completed: {po_num}",
                message=msg_body,
                notification_type="po_update",
                reference_id=po_str_id, reference_entity="PurchaseOrder",
            )
            # 2. Supply Chain Manager
            notify_users_by_role(
                role="Supply Chain Manager",
                title=f"Payment Completed: {po_num}",
                message=msg_body,
                notification_type="po_update",
                reference_id=po_str_id, reference_entity="PurchaseOrder",
            )
            # 3. Vendor Manager
            notify_users_by_role(
                role="Vendor Manager",
                title=f"Payment Completed: {po_num}",
                message=msg_body,
                notification_type="po_update",
                reference_id=po_str_id, reference_entity="PurchaseOrder",
            )
            # 4. Vendor (direct, linked by vendor_id)
            if vendor_id:
                _vendor_pay_msg = (
                    f"Payment Disbursed — USD {final_amount:,.2f} for PO {po_num}.\n"
                    f"Payment Reference: {payment_id}. Invoice: {inv_num}."
                )
                for vu in db[COLLECTION_USERS].find({"vendor_id": vendor_id}, {"_id": 1}):
                    create_typed_notification(
                        user_id=str(vu["_id"]), notif_type="po_update",
                        title=f"Payment Received: {po_num}",
                        message=_vendor_pay_msg,
                        reference_id=po_str_id, reference_entity="PurchaseOrder",
                    )
        except Exception:
            pass


        return True, f"Payment of USD {final_amount:,.2f} settled successfully for PO {po_num}. Payment Ref: {payment_id}", payment_id

    except Exception as exc:
        logger.error("execute_po_payment error: %s", exc)
        return False, f"Payment execution failed: {exc}", None


def hold_po_payment(
    po_id: str,
    invoice_id: Optional[str],
    reason: str,
    finance_officer_id: str,
    finance_officer_name: str,
) -> Tuple[bool, str]:
    """
    Put an individual PO and its invoice payment on hold due to mismatch or review.
    Enforces mandatory reason, notifies Procurement Manager, and records audit trail.
    """
    try:
        db = get_database()
        now = datetime.now(timezone.utc)
        po_doc = None
        if po_id:
            try:
                po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": ObjectId(po_id)})
            except Exception:
                pass
            if not po_doc:
                po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": po_id})
            if not po_doc:
                po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"po_number": po_id})

            if po_doc:
                db[COLLECTION_PURCHASE_ORDERS].update_one(
                    {"_id": po_doc["_id"]},
                    {"$set": {
                        "payment_status": "On Hold",
                        "payment_remarks": f"On Hold: {reason}",
                        "on_hold_by": finance_officer_name,
                        "updated_at": now,
                    }}
                )

        if invoice_id:
            try:
                db[COLLECTION_INVOICES].update_one(
                    {"_id": ObjectId(invoice_id)},
                    {"$set": {
                        "payment_status": "On Hold",
                        "verification_remarks": f"Payment On Hold: {reason}",
                        "updated_at": now,
                    }}
                )
            except Exception:
                pass

        log_audit(
            finance_officer_id, "PO_PAYMENT_HELD", "PurchaseOrder", str(po_id),
            {"po_id": str(po_id), "invoice_id": invoice_id, "reason": reason, "officer": finance_officer_name}
        )

        try:
            from services.notification_service import notify_users_by_role
            po_num = po_doc.get("po_number", po_id) if po_doc else po_id
            notify_users_by_role(
                role="Procurement Manager",
                title=f"Payment On Hold: {po_num}",
                message=f"Finance Officer {finance_officer_name} placed payment for PO {po_num} ON HOLD. Reason: {reason}",
                notification_type="po_update",
                reference_id=str(po_id),
                reference_entity="PurchaseOrder",
            )
        except Exception:
            pass

        return True, "Payment status updated to ON HOLD. Procurement Manager has been notified."
    except Exception as exc:
        logger.error("hold_po_payment failed: %s", exc)
        return False, f"Failed to hold payment: {exc}"


def settle_payment(
    invoice_id: str,
    settled_by_user_id: str,
    settled_by_name: str,
    payment_remarks: str = "",
    override_amount: float = None,
) -> Tuple[bool, str, Optional[str]]:
    """
    Settle payment for an invoice (calls execute_po_payment to ensure PO and Invoice both update).
    """
    try:
        db = get_database()
        inv_doc = db[COLLECTION_INVOICES].find_one({"_id": ObjectId(invoice_id)})
        if not inv_doc:
            return False, "Invoice not found.", None

        po_id = inv_doc.get("po_id", "")
        amount = override_amount or _safe_float(inv_doc.get("grand_total") or inv_doc.get("invoice_amount", 0))

        return execute_po_payment(
            po_id=po_id,
            invoice_id=invoice_id,
            finance_officer_id=settled_by_user_id,
            finance_officer_name=settled_by_name,
            payment_amount=amount,
            remarks=payment_remarks,
            is_mismatch_approved=False,
        )
    except Exception as exc:
        logger.error("settle_payment failed: %s", exc)
        return False, f"Settlement failed: {exc}", None


def get_finance_dashboard_stats() -> Dict[str, Any]:
    """
    Returns separate counts and totals for Finance Dashboard:
    - Pending Verification
    - Mismatch Detected
    - Payment On Hold
    - Ready to Pay
    - Paid
    - Total Payable
    - Total Paid
    """
    try:
        db = get_database()
        inv_col = db[COLLECTION_INVOICES]
        po_col = db[COLLECTION_PURCHASE_ORDERS]

        pending_verification = inv_col.count_documents({"invoice_status": "Submitted"})

        mismatch_detected = inv_col.count_documents({
            "invoice_status": {"$in": ["Submitted", "Approved", "Verified", "Correction Required"]},
            "match_result": {"$in": ["Mismatch", "MISMATCH", "⚠ MISMATCH", "✕ CRITICAL MISMATCH", "Changed", "CHANGED"]},
            "payment_status": {"$ne": "Settled"}
        })

        payment_on_hold = max(
            po_col.count_documents({"payment_status": "On Hold"}),
            inv_col.count_documents({"payment_status": "On Hold"})
        )

        paid_count = max(
            po_col.count_documents({"payment_status": {"$in": ["Paid", "Settled"]}}),
            inv_col.count_documents({"payment_status": "Settled"})
        )

        ready_to_pay = inv_col.count_documents({
            "invoice_status": {"$in": ["Approved", "Verified"]},
            "payment_status": {"$nin": ["Settled", "On Hold"]}
        })

        payable_agg = list(inv_col.aggregate([
            {"$match": {
                "invoice_status": {"$in": ["Approved", "Verified", "Submitted"]},
                "payment_status": {"$nin": ["Settled", "Paid"]}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$grand_total"}}}
        ]))
        total_payable = payable_agg[0]["total"] if payable_agg else 0.0

        paid_agg = list(inv_col.aggregate([
            {"$match": {"payment_status": "Settled"}},
            {"$group": {"_id": None, "total": {"$sum": "$payment_amount"}}}
        ]))
        total_paid = paid_agg[0]["total"] if paid_agg else 0.0

        return {
            "pending_verification": pending_verification,
            "mismatch_detected": mismatch_detected,
            "payment_on_hold": payment_on_hold,
            "ready_to_pay": ready_to_pay,
            "paid": paid_count,
            "total_payable": total_payable,
            "total_paid": total_paid,
        }
    except Exception as exc:
        logger.error("get_finance_dashboard_stats failed: %s", exc)
        return {
            "pending_verification": 0,
            "mismatch_detected": 0,
            "payment_on_hold": 0,
            "ready_to_pay": 0,
            "paid": 0,
            "total_payable": 0.0,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Report data aggregator
# ─────────────────────────────────────────────────────────────────────────────

def get_finance_verification_report_data(invoice_id: str, po_id: Optional[str] = None) -> Optional[Dict]:
    """Fetch complete PR + PO + Invoice + Delivery for reports. 4 find_one calls max."""
    try:
        db = get_database()
        inv_doc = None
        if invoice_id:
            try:
                inv_doc = db[COLLECTION_INVOICES].find_one({"_id": ObjectId(invoice_id)})
            except Exception:
                pass
            if not inv_doc:
                inv_doc = db[COLLECTION_INVOICES].find_one({"po_id": invoice_id})
        if not inv_doc and po_id:
            inv_doc = db[COLLECTION_INVOICES].find_one({"po_id": po_id})

        inv = invoice_from_mongo(inv_doc) if inv_doc else {}

        po_doc = {}
        target_po_id = inv.get("po_id") or po_id or (invoice_id if not inv_doc else "")
        if target_po_id:
            try:
                raw = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": ObjectId(target_po_id)})
                if not raw:
                    raw = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": target_po_id})
                if not raw:
                    raw = db[COLLECTION_PURCHASE_ORDERS].find_one({"po_number": target_po_id})
                if raw:
                    po_doc = dict(raw)
                    po_doc["_id"] = str(po_doc["_id"])
            except Exception:
                pass

        pr_doc = {}
        pr_id = inv.get("procurement_request_id") or po_doc.get("request_id", "")
        if pr_id:
            try:
                raw = db[COLLECTION_PROCUREMENT_REQUESTS].find_one({"_id": ObjectId(pr_id)})
                if raw:
                    pr_doc = dict(raw)
                    pr_doc["_id"] = str(pr_doc["_id"])
            except Exception:
                pass

        del_doc = get_delivery_for_po(target_po_id) or {}
        comparison = inv.get("comparison_result") or _build_comparison_matrix(pr_doc, po_doc, inv, del_doc)

        return {
            "invoice":    inv,
            "po":         po_doc,
            "pr":         pr_doc,
            "delivery":   del_doc,
            "comparison": comparison,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        logger.error("get_finance_verification_report_data: %s", exc)
        return None



# ─────────────────────────────────────────────────────────────────────────────
# Invoice PDF Generator (WORKING — real DB data only)
# ─────────────────────────────────────────────────────────────────────────────

def generate_invoice_pdf(invoice_id: str = "", po_id: Optional[str] = None) -> Optional[bytes]:
    """
    Generate a standalone Invoice PDF.
    Contains: vendor details, invoice header, product table with line items,
    financial breakdown, verification status, payment status.
    All data from MongoDB — zero fake data.
    """
    data = get_finance_verification_report_data(invoice_id, po_id=po_id)

    if not data:
        return None
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.lib.colors import HexColor, white
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        )
        from io import BytesIO

        inv = data["invoice"]
        po  = data["po"]
        pr  = data["pr"]
        del_doc = data.get("delivery", {})

        NAVY  = HexColor("#172033")
        GOLD  = HexColor("#B08D57")
        GREEN = HexColor("#2D6A4A")
        RED   = HexColor("#8B3038")
        AMBER = HexColor("#A67C32")
        LIGHT = HexColor("#F7F5F0")
        MID   = HexColor("#D9D6CF")

        body  = ParagraphStyle("body",  fontName="Helvetica",      fontSize=9,  textColor=HexColor("#20242A"), spaceAfter=2)
        bold  = ParagraphStyle("bold",  fontName="Helvetica-Bold",  fontSize=9,  textColor=NAVY,              spaceAfter=2)
        title = ParagraphStyle("title", fontName="Helvetica-Bold",  fontSize=20, textColor=NAVY,              spaceAfter=4)
        h2    = ParagraphStyle("h2",    fontName="Helvetica-Bold",  fontSize=12, textColor=NAVY, spaceBefore=8, spaceAfter=4)
        small = ParagraphStyle("small", fontName="Helvetica",       fontSize=8,  textColor=HexColor("#68707C"), spaceAfter=2)

        buf = BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
            leftMargin=15*mm, rightMargin=15*mm, topMargin=18*mm, bottomMargin=18*mm)
        story = []

        # ── Invoice Header ──────────────────────────────────────────────────────
        story.append(Paragraph("INVOICE", title))
        story.append(HRFlowable(width="100%", thickness=2, color=GOLD))
        story.append(Spacer(1, 3*mm))

        # Status banner
        inv_status = inv.get("invoice_status", "Pending")
        pay_status = inv.get("payment_status", "Unpaid")
        banner_color = GREEN if inv_status in ("Approved", "Verified", "Paid") else (
            RED if inv_status == "Rejected" else AMBER)
        story.append(Table(
            [[Paragraph(f"<b>Status: {inv_status}  |  Payment: {pay_status}</b>",
                ParagraphStyle("ban", fontName="Helvetica-Bold", fontSize=11, textColor=white)),
              Paragraph(f"Invoice No: <b>{_s(inv.get('invoice_number'))}</b>",
                ParagraphStyle("inv", fontName="Helvetica", fontSize=9, textColor=white))]],
            colWidths=["60%", "40%"],
            style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), banner_color),
                              ("PADDING", (0, 0), (-1, -1), 7),
                              ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]),
        ))
        story.append(Spacer(1, 4*mm))

        # ── Header Info Table ─────────────────────────────────────────────────
        def _kv(rows_data, col_widths=None):
            cw = col_widths or ["35%", "65%"]
            t  = Table(rows_data, colWidths=cw, style=TableStyle([
                ("BACKGROUND", (0, 0), (0, -1), LIGHT),
                ("FONTNAME",   (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE",   (0, 0), (-1, -1), 9),
                ("GRID",       (0, 0), (-1, -1), 0.4, MID),
                ("PADDING",    (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [white, LIGHT]),
            ]))
            story.append(t)
            story.append(Spacer(1, 3*mm))

        story.append(Paragraph("Invoice Details", h2))
        _kv([
            ["Invoice Number",    _s(inv.get("invoice_number"))],
            ["Invoice Date",      _ts_str(inv.get("invoice_date") or inv.get("submitted_at") or inv.get("created_at"))],
            ["PO Number",         _s(inv.get("po_number"))],
            ["PR Number",         _s(inv.get("procurement_request_number") or pr.get("request_number"))],
            ["Due Date",          _ts_str(inv.get("due_date"))],
            ["Supporting Doc",    _s(inv.get("support_doc_name"))],
        ])

        story.append(Paragraph("Vendor Information", h2))
        _kv([
            ["Vendor Name",  _s(inv.get("vendor_name"))],
            ["Vendor ID",    _s(inv.get("vendor_id"))],
            ["PO Grand Total", _f_str(po.get("grand_total") or po.get("total_amount"))],
        ])

        story.append(Paragraph("Procurement Request", h2))
        _kv([
            ["Request Number",   _s(pr.get("request_number") or inv.get("procurement_request_number"))],
            ["Department",       _s(pr.get("department"))],
            ["Product",          _s(pr.get("product_name") or inv.get("product_name"))],
            ["Expected Grand Total", _f_str(pr.get("expected_grand_total") or pr.get("estimated_cost") or inv.get("po_amount"))],
        ])

        # ── Product Line Items ────────────────────────────────────────────────
        story.append(Paragraph("Product / Line Items", h2))
        line_items = inv.get("line_items") or []
        if line_items:
            li_data = [["Product", "Qty", "Unit Price (USD)", "Line Total (USD)"]]
            for item in line_items:
                li_data.append([
                    _s(item.get("product_name")),
                    str(item.get("quantity", "")),
                    _f_str(item.get("unit_price"), ""),
                    _f_str(item.get("line_total"), ""),
                ])
            li_table = Table(li_data, colWidths=["40%", "15%", "22%", "23%"],
                style=TableStyle([
                    ("BACKGROUND",   (0, 0), (-1, 0), NAVY),
                    ("TEXTCOLOR",    (0, 0), (-1, 0), white),
                    ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE",     (0, 0), (-1, -1), 9),
                    ("GRID",         (0, 0), (-1, -1), 0.4, MID),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT]),
                    ("PADDING",      (0, 0), (-1, -1), 5),
                    ("ALIGN",        (1, 0), (-1, -1), "RIGHT"),
                ]))
            story.append(li_table)
        else:
            # Legacy single-product display
            prod  = inv.get("product_name") or po.get("product_name") or "N/A"
            qty   = inv.get("quantity") or 0
            up    = inv.get("unit_price") or 0
            total = _safe_float(qty) * _safe_float(up)
            legacy_data = [
                ["Product", "Qty", "Unit Price (USD)", "Line Total (USD)"],
                [prod, str(qty), _f_str(up, ""), _f_str(total, "")],
            ]
            li_table = Table(legacy_data, colWidths=["40%", "15%", "22%", "23%"],
                style=TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                    ("TEXTCOLOR",  (0, 0), (-1, 0), white),
                    ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE",   (0, 0), (-1, -1), 9),
                    ("GRID",       (0, 0), (-1, -1), 0.4, MID),
                    ("PADDING",    (0, 0), (-1, -1), 5),
                    ("ALIGN",      (1, 0), (-1, -1), "RIGHT"),
                ]))
            story.append(li_table)
        story.append(Spacer(1, 3*mm))

        # ── Financial Summary ─────────────────────────────────────────────────
        story.append(Paragraph("Financial Summary", h2))
        subtotal = _safe_float(inv.get("subtotal"))
        tax      = _safe_float(inv.get("tax_amount"))
        disc     = _safe_float(inv.get("discount_amount"))
        ship     = _safe_float(inv.get("shipping_freight"))
        other    = _safe_float(inv.get("other_charges"))
        grand    = _safe_float(inv.get("grand_total") or inv.get("invoice_amount"))
        # If subtotal 0 and we have a legacy single-product
        if subtotal == 0:
            subtotal = _safe_float(inv.get("quantity", 0)) * _safe_float(inv.get("unit_price", 0))
        if grand == 0:
            grand = subtotal + tax - disc + ship + other

        fin_data = [
            ["Subtotal",             _f_str(subtotal)],
            ["Tax",                  _f_str(tax)],
            ["Discount",             f"- {_f_str(disc)}"],
            ["Shipping / Freight",   _f_str(ship)],
            ["Other / Extra Charges",_f_str(other)],
            ["GRAND TOTAL",          _f_str(grand)],
        ]
        fin_table = Table(fin_data, colWidths=["55%", "45%"],
            style=TableStyle([
                ("BACKGROUND",    (0, 0), (-1, -2), LIGHT),
                ("BACKGROUND",    (0, -1), (-1, -1), NAVY),
                ("TEXTCOLOR",     (0, -1), (-1, -1), white),
                ("FONTNAME",      (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE",      (0, 0), (-1, -1), 10),
                ("GRID",          (0, 0), (-1, -1), 0.5, MID),
                ("ALIGN",         (1, 0), (1, -1), "RIGHT"),
                ("PADDING",       (0, 0), (-1, -1), 5),
            ]))
        story.append(fin_table)
        story.append(Spacer(1, 4*mm))

        # ── Verification & Payment ────────────────────────────────────────────
        story.append(Paragraph("Verification & Payment Details", h2))
        _kv([
            ["Verification ID",   _s(inv.get("verification_id"))],
            ["Verification Status", _s(inv.get("verification_status") or inv.get("invoice_status"))],
            ["Finance Officer",   _s(inv.get("verified_by_name"))],
            ["Verified On",       _ts_str(inv.get("verified_at"))],
            ["Verification Remarks", _s(inv.get("verification_remarks") or inv.get("verification_notes"))],
            ["Overall Match",     _s(inv.get("match_result"))],
            ["Payment ID",        _s(inv.get("payment_id"))],
            ["Payment Status",    _s(inv.get("payment_status"))],
            ["Settlement Amount", _f_str(inv.get("payment_amount") or grand)],
            ["Settlement Date",   _ts_str(inv.get("payment_date"))],
            ["Settled By",        _s(inv.get("payment_settled_by_name"))],
            ["Payment Remarks",   _s(inv.get("payment_remarks"))],
        ])

        # ── Delivery ─────────────────────────────────────────────────────────
        if del_doc:
            story.append(Paragraph("Delivery Information", h2))
            _kv([
                ["Delivery Number", _s(del_doc.get("delivery_number"))],
                ["Status",          _s(del_doc.get("status"))],
                ["Carrier",         _s(del_doc.get("carrier"))],
                ["Expected Date",   _ts_str(del_doc.get("expected_date"))],
                ["Actual Date",     _ts_str(del_doc.get("actual_date"))],
                ["Tracking Number", _s(del_doc.get("tracking_number"))],
            ])

        doc.build(story)
        return buf.getvalue()

    except Exception as exc:
        logger.error("generate_invoice_pdf failed: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Finance Verification Report (PDF)
# ─────────────────────────────────────────────────────────────────────────────

def generate_verification_pdf(invoice_id: str) -> Optional[bytes]:
    """Full finance verification report PDF with 4-way comparison table."""
    data = get_finance_verification_report_data(invoice_id)
    if not data:
        return None
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.lib.colors import HexColor, white
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        )
        from io import BytesIO

        inv = data["invoice"]
        po  = data["po"]
        pr  = data["pr"]
        comp = data["comparison"]
        del_doc = data.get("delivery", {})

        NAVY  = HexColor("#172033"); GOLD = HexColor("#B08D57")
        GREEN = HexColor("#2D6A4A"); RED  = HexColor("#8B3038")
        AMBER = HexColor("#A67C32"); LIGHT = HexColor("#F7F5F0")
        MID   = HexColor("#D9D6CF")

        title_s = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=18, textColor=NAVY, spaceAfter=4)
        h2_s    = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=11, textColor=NAVY, spaceBefore=8, spaceAfter=3)
        sm_s    = ParagraphStyle("s", fontName="Helvetica",      fontSize=8,  textColor=HexColor("#68707C"), spaceAfter=2)

        buf = BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
            leftMargin=12*mm, rightMargin=12*mm, topMargin=18*mm, bottomMargin=18*mm)
        story = []

        story.append(Paragraph("VendorPulse — Finance Verification & Settlement Report", title_s))
        story.append(HRFlowable(width="100%", thickness=2, color=GOLD))
        story.append(Spacer(1, 3*mm))

        verif_status = inv.get("verification_status") or inv.get("invoice_status", "Pending")
        sc = GREEN if verif_status in ("Approved","Verified") else (RED if verif_status=="Rejected" else AMBER)
        story.append(Table([[
            Paragraph(f"<b>Verification: {verif_status}</b>",
                ParagraphStyle("b", fontName="Helvetica-Bold", fontSize=12, textColor=white)),
            Paragraph(f"ID: {_s(inv.get('verification_id'))}  |  Invoice: {_s(inv.get('invoice_number'))}",
                ParagraphStyle("s2", fontName="Helvetica", fontSize=9, textColor=white)),
        ]], colWidths=["50%","50%"],
            style=TableStyle([("BACKGROUND",(0,0),(-1,-1),sc),
                              ("PADDING",(0,0),(-1,-1),7),("VALIGN",(0,0),(-1,-1),"MIDDLE")])))
        story.append(Spacer(1, 4*mm))

        def _section_table(title, rows):
            story.append(Paragraph(title, h2_s))
            t = Table(rows, colWidths=["38%","62%"], style=TableStyle([
                ("BACKGROUND",(0,0),(0,-1),LIGHT),("FONTNAME",(0,0),(0,-1),"Helvetica-Bold"),
                ("FONTSIZE",(0,0),(-1,-1),9),("GRID",(0,0),(-1,-1),0.4,MID),
                ("ROWBACKGROUNDS",(0,0),(-1,-1),[white,LIGHT]),("PADDING",(0,0),(-1,-1),4)]))
            story.append(t); story.append(Spacer(1, 3*mm))

        _section_table("1. Procurement Request", [
            ["Request Number", _s(pr.get("request_number"))],
            ["Department",     _s(pr.get("department"))],
            ["Product",        _s(pr.get("product_name") or inv.get("product_name"))],
            ["Approved Qty",   str(pr.get("expected_quantity") or pr.get("quantity") or "N/A")],
            ["Expected Unit Price", _f_str(pr.get("expected_unit_price") or pr.get("unit_price"))],
            ["Expected Tax",       _f_str(pr.get("expected_tax"))],
            ["Expected Discount",  _f_str(pr.get("expected_discount"))],
            ["Expected Shipping",  _f_str(pr.get("expected_shipping"))],
            ["Expected Grand Total", _f_str(pr.get("expected_grand_total") or pr.get("estimated_cost"))],
        ])

        _section_table("2. Purchase Order", [
            ["PO Number",    _s(po.get("po_number") or inv.get("po_number"))],
            ["Vendor",       _s(po.get("vendor_name") or inv.get("vendor_name"))],
            ["Quantity",     str(po.get("quantity") or inv.get("po_quantity") or "N/A")],
            ["Unit Price",   _f_str(po.get("unit_price") or inv.get("po_unit_price"))],
            ["Tax",          _f_str(po.get("tax_amount") or inv.get("po_tax"))],
            ["Discount",     _f_str(po.get("discount_amount") or inv.get("po_discount"))],
            ["Shipping",     _f_str(po.get("shipping_freight") or inv.get("po_shipping"))],
            ["Grand Total",  _f_str(po.get("grand_total") or po.get("total_amount") or inv.get("po_amount"))],
        ])

        _section_table("3. Invoice (Vendor Submitted)", [
            ["Invoice Number", _s(inv.get("invoice_number"))],
            ["Invoice Date",   _ts_str(inv.get("submitted_at") or inv.get("invoice_date"))],
            ["Vendor",         _s(inv.get("vendor_name"))],
            ["Quantity",       str(inv.get("quantity") or "N/A")],
            ["Unit Price",     _f_str(inv.get("unit_price"))],
            ["Subtotal",       _f_str(inv.get("subtotal"))],
            ["Tax",            _f_str(inv.get("tax_amount"))],
            ["Discount",       _f_str(inv.get("discount_amount"))],
            ["Shipping",       _f_str(inv.get("shipping_freight"))],
            ["Other Charges",  _f_str(inv.get("other_charges"))],
            ["Grand Total",    _f_str(inv.get("grand_total") or inv.get("invoice_amount"))],
            ["Supporting Doc", _s(inv.get("support_doc_name"))],
        ])

        if del_doc:
            _section_table("4. Delivery", [
                ["Delivery Number", _s(del_doc.get("delivery_number"))],
                ["Status",          _s(del_doc.get("status"))],
                ["Carrier",         _s(del_doc.get("carrier"))],
                ["Expected Date",   _ts_str(del_doc.get("expected_date"))],
                ["Actual Date",     _ts_str(del_doc.get("actual_date"))],
            ])

        # ── Comparison Matrix ─────────────────────────────────────────────────
        story.append(Paragraph("5. Product-wise Comparison: Request vs PO vs Invoice", h2_s))
        STATUS_C = {MATCH: "#EAF5F0", CHANGED: "#FEF8E7", MISMATCH: "#FDECEC"}
        STATUS_T = {MATCH: "MATCHED ✓", CHANGED: "CHANGED ⚠", MISMATCH: "MISMATCH ✕"}

        hdrs = ["Field", "Request", "PO", "Invoice", "PO vs Inv Diff", "Status"]
        comp_data = [hdrs]
        for row in comp.get("rows", []):
            comp_data.append([
                row.get("label",""),
                _f_str(row.get("pr_value"), ""),
                _f_str(row.get("po_value"), ""),
                _f_str(row.get("inv_value"), ""),
                _f_str(row.get("po_inv_diff"), ""),
                STATUS_T.get(row.get("status",""), row.get("status","")),
            ])

        STATUS_C = {MATCH: "#EAF5F0", CHANGED: "#FEF8E7", MISMATCH: "#FDECEC"}

        comp_style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR",  (0, 0), (-1, 0), white),
            ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, -1), 8),
            ("GRID",       (0, 0), (-1, -1), 0.4, MID),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT]),
            ("PADDING",    (0, 0), (-1, -1), 4),
            ("ALIGN",      (1, 0), (-1, -1), "RIGHT"),
        ]
        for i, row in enumerate(comp.get("rows", []), start=1):
            bg = HexColor(STATUS_C.get(row.get("status", ""), "#FFFFFF"))
            comp_style_cmds.append(("BACKGROUND", (5, i), (5, i), bg))
            comp_style_cmds.append(("FONTNAME",   (5, i), (5, i), "Helvetica-Bold"))

        ct = Table(comp_data, colWidths=["22%","13%","13%","13%","14%","25%"],
            style=TableStyle(comp_style_cmds))
        story.append(ct)
        story.append(Spacer(1, 3*mm))

        # ── Verification & Payment ────────────────────────────────────────────
        _section_table("6. Verification & Payment", [
            ["Overall Match",      STATUS_T.get(comp.get("overall",""), comp.get("overall",""))],
            ["Verification Status", verif_status],
            ["Finance Officer",    _s(inv.get("verified_by_name"))],
            ["Verified On",        _ts_str(inv.get("verified_at"))],
            ["Verification ID",    _s(inv.get("verification_id"))],
            ["Payment ID",         _s(inv.get("payment_id"))],
            ["Payment Status",     _s(inv.get("payment_status"))],
            ["Settlement Amount",  _f_str(inv.get("payment_amount") or inv.get("grand_total") or inv.get("invoice_amount"))],
            ["Settlement Date",    _ts_str(inv.get("payment_date"))],
            ["Settled By",         _s(inv.get("payment_settled_by_name"))],
            ["Remarks",            _s(inv.get("payment_remarks") or inv.get("verification_remarks"))],
        ])

        story.append(Paragraph(
            f"Generated by VendorPulse Finance Module  |  {_ts_str(datetime.now(timezone.utc))}",
            sm_s))

        doc.build(story)
        return buf.getvalue()

    except Exception as exc:
        logger.error("generate_verification_pdf failed: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Finance Verification Report (Excel)
# ─────────────────────────────────────────────────────────────────────────────

def generate_verification_excel(invoice_id: str) -> Optional[bytes]:
    """Multi-sheet Excel: Summary, Comparison Matrix, Line Items, Full Details."""
    data = get_finance_verification_report_data(invoice_id)
    if not data:
        return None
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
        from io import BytesIO

        inv  = data["invoice"]
        po   = data["po"]
        pr   = data["pr"]
        comp = data["comparison"]

        wb = Workbook()
        NAVY_H  = "172033"; GOLD_H  = "B08D57"; GREEN_H = "2D6A4A"
        RED_H   = "8B3038"; LIGHT_H = "F7F5F0"

        def _border():
            s = Side(border_style="thin", color="D9D6CF")
            return Border(left=s, right=s, top=s, bottom=s)

        def _hdr_fill(h): return PatternFill("solid", fgColor=h)
        def _ff(v):
            try: return float(v) if v is not None else 0.0
            except: return 0.0

        def _style_hdr(ws, row, ncols, fill=NAVY_H):
            for c in range(1, ncols+1):
                cell = ws.cell(row=row, column=c)
                cell.fill = _hdr_fill(fill)
                cell.font = Font(bold=True, color="FFFFFF", size=10)
                cell.alignment = Alignment(horizontal="center", vertical="center")
                cell.border = _border()

        def _style_row(ws, row, ncols, odd=True):
            for c in range(1, ncols+1):
                cell = ws.cell(row=row, column=c)
                cell.fill = _hdr_fill(LIGHT_H if odd else "FFFFFF")
                cell.font = Font(size=9)
                cell.border = _border()

        # ── Sheet 1: Summary ──────────────────────────────────────────────────
        ws1 = wb.active; ws1.title = "Summary"
        ws1["A1"] = "VendorPulse — Finance Verification & Settlement Report"
        ws1["A1"].font = Font(bold=True, size=14, color=NAVY_H)
        ws1.merge_cells("A1:D1")

        rows_s = [
            ("Verification ID",  inv.get("verification_id", "")),
            ("Invoice Number",   inv.get("invoice_number", "")),
            ("PO Number",        inv.get("po_number", "")),
            ("Vendor",           inv.get("vendor_name", "")),
            ("Invoice Status",   inv.get("invoice_status", "")),
            ("Overall Match",    comp.get("overall", "")),
            ("Finance Officer",  inv.get("verified_by_name", "")),
            ("Verified On",      _ts_str(inv.get("verified_at"))),
            ("Payment ID",       inv.get("payment_id", "")),
            ("Payment Status",   inv.get("payment_status", "")),
            ("Settlement Amount",_ff(inv.get("payment_amount") or inv.get("grand_total") or inv.get("invoice_amount"))),
            ("Settlement Date",  _ts_str(inv.get("payment_date"))),
            ("Settled By",       inv.get("payment_settled_by_name", "")),
            ("Remarks",          inv.get("payment_remarks") or inv.get("verification_remarks") or ""),
        ]
        for i, (k, v) in enumerate(rows_s, start=3):
            ws1.cell(row=i, column=1, value=k).font = Font(bold=True, size=10)
            ws1.cell(row=i, column=1).fill = _hdr_fill(LIGHT_H)
            ws1.cell(row=i, column=2, value=v)
            for c in range(1, 3):
                ws1.cell(row=i, column=c).border = _border()
        ws1.column_dimensions["A"].width = 28
        ws1.column_dimensions["B"].width = 42

        # ── Sheet 2: Comparison Matrix ────────────────────────────────────────
        ws2 = wb.create_sheet("Comparison Matrix")
        hdrs2 = ["Field", "Request Value", "PO Value", "Invoice Value",
                 "PR-PO Diff", "PO-Inv Diff", "Status"]
        for c, h in enumerate(hdrs2, 1):
            ws2.cell(row=1, column=c, value=h)
        _style_hdr(ws2, 1, len(hdrs2))
        STATUS_C = {"MATCHED":"EAF5F0","CHANGED":"FEF8E7","MISMATCH":"FDECEC"}
        STATUS_T = {"MATCHED":"MATCHED ✓","CHANGED":"CHANGED ⚠","MISMATCH":"MISMATCH ✕"}
        for ri, row in enumerate(comp.get("rows",[]), start=2):
            status = row.get("status","")
            vals = [row.get("label",""), _ff(row.get("pr_value")), _ff(row.get("po_value")),
                    _ff(row.get("inv_value")), _ff(row.get("pr_po_diff")),
                    _ff(row.get("po_inv_diff")), STATUS_T.get(status, status)]
            for c, v in enumerate(vals, 1):
                ws2.cell(row=ri, column=c, value=v)
            _style_row(ws2, ri, len(hdrs2), odd=(ri%2==0))
            ws2.cell(row=ri, column=7).fill = _hdr_fill(STATUS_C.get(status,"FFFFFF"))
            ws2.cell(row=ri, column=7).font = Font(bold=True, size=9)
        for c in range(1, len(hdrs2)+1):
            ws2.column_dimensions[get_column_letter(c)].width = 20

        # ── Sheet 3: Line Items ───────────────────────────────────────────────
        ws3 = wb.create_sheet("Invoice Line Items")
        hdrs3 = ["Product", "Quantity", "Unit Price (USD)", "Line Total (USD)", "Unit", "Notes"]
        for c, h in enumerate(hdrs3, 1):
            ws3.cell(row=1, column=c, value=h)
        _style_hdr(ws3, 1, len(hdrs3))
        items = inv.get("line_items") or []
        if not items and inv.get("product_name"):
            qty = _ff(inv.get("quantity")); up = _ff(inv.get("unit_price"))
            items = [{"product_name": inv.get("product_name"), "quantity": qty,
                      "unit_price": up, "line_total": qty*up, "unit":"units","notes":""}]
        for ri, item in enumerate(items, start=2):
            row_vals = [item.get("product_name",""), _ff(item.get("quantity")),
                        _ff(item.get("unit_price")), _ff(item.get("line_total")),
                        item.get("unit","units"), item.get("notes","")]
            for c, v in enumerate(row_vals, 1):
                ws3.cell(row=ri, column=c, value=v)
            _style_row(ws3, ri, len(hdrs3), odd=(ri%2==0))
        for c in range(1, len(hdrs3)+1):
            ws3.column_dimensions[get_column_letter(c)].width = 22

        # ── Sheet 4: Full Details ─────────────────────────────────────────────
        ws4 = wb.create_sheet("Full Details")
        detail_rows = [
            ("PROCUREMENT REQUEST", None),
            ("Request Number", pr.get("request_number","")),
            ("Department", pr.get("department","")),
            ("Product", pr.get("product_name") or inv.get("product_name","")),
            ("Expected Grand Total", _ff(pr.get("expected_grand_total") or pr.get("estimated_cost"))),
            ("", None),
            ("PURCHASE ORDER", None),
            ("PO Number", po.get("po_number") or inv.get("po_number","")),
            ("Vendor", po.get("vendor_name") or inv.get("vendor_name","")),
            ("Grand Total", _ff(po.get("grand_total") or po.get("total_amount") or inv.get("po_amount"))),
            ("", None),
            ("INVOICE", None),
            ("Invoice Number", inv.get("invoice_number","")),
            ("Grand Total", _ff(inv.get("grand_total") or inv.get("invoice_amount"))),
            ("Tax", _ff(inv.get("tax_amount"))),
            ("Discount", _ff(inv.get("discount_amount"))),
            ("Shipping", _ff(inv.get("shipping_freight"))),
            ("Other Charges", _ff(inv.get("other_charges"))),
            ("", None),
            ("PAYMENT SETTLEMENT", None),
            ("Payment ID", inv.get("payment_id","")),
            ("Payment Status", inv.get("payment_status","")),
            ("Settlement Amount", _ff(inv.get("payment_amount") or inv.get("grand_total"))),
            ("Settlement Date", _ts_str(inv.get("payment_date"))),
            ("Settled By", inv.get("payment_settled_by_name","")),
            ("Remarks", inv.get("payment_remarks","")),
        ]
        for ri, (k, v) in enumerate(detail_rows, start=1):
            ws4.cell(row=ri, column=1, value=k)
            if v is not None:
                ws4.cell(row=ri, column=2, value=v)
            if k in ("PROCUREMENT REQUEST","PURCHASE ORDER","INVOICE","PAYMENT SETTLEMENT"):
                ws4.cell(row=ri, column=1).fill = _hdr_fill(NAVY_H)
                ws4.cell(row=ri, column=1).font = Font(bold=True, color="FFFFFF")
                ws4.merge_cells(f"A{ri}:B{ri}")
            else:
                ws4.cell(row=ri, column=1).font = Font(bold=True, size=9)
                ws4.cell(row=ri, column=1).fill = _hdr_fill(LIGHT_H)
                for c in range(1,3): ws4.cell(row=ri, column=c).border = _border()
        ws4.column_dimensions["A"].width = 28; ws4.column_dimensions["B"].width = 40

        buf = BytesIO(); wb.save(buf)
        return buf.getvalue()

    except Exception as exc:
        logger.error("generate_verification_excel failed: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Legacy shim
# ─────────────────────────────────────────────────────────────────────────────

def verify_invoice(invoice_id: str, verified_by: str) -> Tuple[bool, str, Optional[Dict]]:
    """Legacy shim — routes to finance_verify_invoice."""
    return finance_verify_invoice(invoice_id=invoice_id, action="approve",
                                   remarks="", verified_by_user_id=verified_by,
                                   verified_by_name="")
