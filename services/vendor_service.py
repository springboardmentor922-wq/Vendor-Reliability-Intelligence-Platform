"""
services/vendor_service.py
--------------------------
Vendor & Supplier management service.
Data sourced from DataCo Supply Chain Dataset (Department + Market entities).
"""

import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from database.connection import get_database
from models.vendor import Vendor, vendor_from_mongo
from utils.helpers import generate_vendor_code
from utils.logger import log_audit
from config.settings import COLLECTION_VENDORS, VENDOR_CATEGORIES as _CANONICAL_CATEGORIES

logger = logging.getLogger(__name__)


def create_vendor(
    company_name: str,
    category: str,
    contact_information: dict,
    address: dict,
    created_by: str,
    **kwargs,
) -> Tuple[bool, str, Optional[Dict]]:
    """
    Register a new vendor. Auto-generates vendor_code.
    Returns (success, message, vendor_dict).
    """
    if not company_name.strip():
        return False, "Company name is required.", None

    vendor_code = kwargs.get("vendor_code") or generate_vendor_code()
    vendor = Vendor(
        vendor_code=vendor_code,
        company_name=company_name.strip(),
        category=category,
        contact_information=contact_information,
        address=address,
        created_by=created_by,
        **{k: v for k, v in kwargs.items() if hasattr(Vendor, k) and k not in ("vendor_code", "company_name", "category", "contact_information", "address", "created_by")},
    )

    try:
        db = get_database()
        result = db[COLLECTION_VENDORS].insert_one(vendor.to_mongo_doc())
        vendor_id = str(result.inserted_id)
        logger.info("Vendor created: %s  code: %s", company_name, vendor_code)
        log_audit(
            user_id=created_by,
            action="CREATE_VENDOR",
            entity="Vendor",
            entity_id=vendor_id,
            details={"company_name": company_name, "vendor_code": vendor_code},
        )
        doc = vendor.to_mongo_doc()
        doc["_id"] = vendor_id
        return True, f"Vendor '{company_name}' registered successfully.", doc
    except DuplicateKeyError:
        return False, "A vendor with this code already exists.", None
    except Exception as exc:
        logger.error("Vendor creation failed: %s", exc)
        return False, "Failed to create vendor.", None


def get_vendors_paginated(
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    approval_status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "company_name",
    sort_order: int = 1,
    risk_label: Optional[str] = None,
    canonical_only: bool = False,
    **kwargs,
) -> Dict[str, Any]:
    """
    MongoDB paginated query for vendor/supplier records.

    canonical_only=True restricts results to the 6 canonical vendor categories
    (Raw Material Suppliers, Equipment Vendors, IT Vendors, Service Providers,
    Logistics Partners, Maintenance Vendors), excluding legacy DataCo entries.
    """

    try:
        db = get_database()
        col = db[COLLECTION_VENDORS]
        query: Dict[str, Any] = {}

        # Restrict to canonical categories when requested (Vendor Manager views)
        if canonical_only:
            if category and category != "All":
                query["category"] = category
            else:
                query["category"] = {"$in": list(_CANONICAL_CATEGORIES)}
        else:
            if category and category != "All":
                query["category"] = category

        if status and status != "All":
            query["status"] = status
        if approval_status and approval_status != "All":
            query["approval_status"] = approval_status
        if risk_label and risk_label != "All":
            query["risk_label"] = risk_label
        if search:
            s = search.strip()
            query["$or"] = [
                {"vendor_code": {"$regex": s, "$options": "i"}},
                {"company_name": {"$regex": s, "$options": "i"}},
                {"department": {"$regex": s, "$options": "i"}},
                {"market": {"$regex": s, "$options": "i"}},
            ]

        total_count = col.count_documents(query)
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        page = max(1, min(page, total_pages)) if total_count > 0 else 1
        skip = (page - 1) * page_size

        allowed_sorts = {
            "company_name", "vendor_code", "category",
            "department", "market", "total_orders",
            "late_delivery_rate", "reliability_score", "created_at"
        }
        actual_sort = sort_by if sort_by in allowed_sorts else "company_name"

        docs = list(
            col.find(query)
            .sort(actual_sort, sort_order)
            .skip(skip)
            .limit(page_size)
        )

        items = [vendor_from_mongo(d) for d in docs]

        return {
            "items": items,
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        }
    except Exception as exc:
        logger.error("Error in get_vendors_paginated: %s", exc)
        return {
            "items": [],
            "total": 0,
            "page": 1,
            "page_size": page_size,
            "total_pages": 1,
            "has_next": False,
            "has_prev": False,
        }


def get_all_vendors(
    status: Optional[str] = None,
    approval_status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 200,
    canonical_only: bool = False,
) -> List[Dict]:
    """Return vendors with optional filters, capped to protect memory."""
    res = get_vendors_paginated(
        page=1,
        page_size=limit,
        status=status,
        approval_status=approval_status,
        category=category,
        search=search,
        canonical_only=canonical_only,
    )
    return res.get("items", [])


def get_vendor_by_id(vendor_id: str) -> Optional[Dict]:
    """Retrieve a single vendor by ObjectId string."""
    try:
        db = get_database()
        doc = db[COLLECTION_VENDORS].find_one({"_id": ObjectId(vendor_id)})
        return vendor_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("Error fetching vendor %s: %s", vendor_id, exc)
        return None


def get_supplier_by_id_or_code(identifier: str) -> Optional[Dict]:
    """Retrieve a supplier by vendor_code or ObjectId string."""
    try:
        db = get_database()
        col = db[COLLECTION_VENDORS]
        query = {"$or": [{"vendor_code": identifier}]}
        if ObjectId.is_valid(identifier):
            query["$or"].append({"_id": ObjectId(identifier)})
        doc = col.find_one(query)
        return vendor_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("Error fetching supplier by identifier %s: %s", identifier, exc)
        return None


def update_vendor_status(
    vendor_id: str,
    new_status: str,
    updated_by: str,
) -> Tuple[bool, str]:
    """Update a vendor's status (Active/Inactive/Suspended)."""
    try:
        db = get_database()
        oid = ObjectId(vendor_id) if ObjectId.is_valid(vendor_id) else None
        filter_q = {"_id": oid} if oid else {"vendor_code": vendor_id}
        result = db[COLLECTION_VENDORS].update_one(
            filter_q,
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
        )
        if result.matched_count == 0:
            return False, "Vendor not found."
        log_audit(updated_by, "UPDATE_VENDOR_STATUS", "Vendor", vendor_id,
                  {"new_status": new_status})
        return True, f"Vendor status updated to {new_status}."
    except Exception as exc:
        logger.error("Status update failed: %s", exc)
        return False, "Failed to update vendor status."


def approve_vendor(vendor_id: str, approved_by: str) -> Tuple[bool, str]:
    """Approve a pending vendor."""
    try:
        db = get_database()
        oid = ObjectId(vendor_id) if ObjectId.is_valid(vendor_id) else None
        filter_q = {"_id": oid} if oid else {"vendor_code": vendor_id}
        result = db[COLLECTION_VENDORS].update_one(
            filter_q,
            {"$set": {
                "approval_status": "Approved",
                "status": "Active",
                "approved_by": approved_by,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            return False, "Vendor not found."
        log_audit(approved_by, "APPROVE_VENDOR", "Vendor", vendor_id, {})
        return True, "Vendor approved successfully."
    except Exception as exc:
        logger.error("Vendor approval failed: %s", exc)
        return False, "Failed to approve vendor."


def reject_vendor(vendor_id: str, rejected_by: str, reason: str = "") -> Tuple[bool, str]:
    """Reject a pending vendor application."""
    try:
        db = get_database()
        oid = ObjectId(vendor_id) if ObjectId.is_valid(vendor_id) else None
        filter_q = {"_id": oid} if oid else {"vendor_code": vendor_id}
        result = db[COLLECTION_VENDORS].update_one(
            filter_q,
            {"$set": {
                "approval_status": "Rejected",
                "status": "Suspended",
                "rejected_by": rejected_by,
                "rejection_reason": reason,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            return False, "Vendor not found."
        log_audit(rejected_by, "REJECT_VENDOR", "Vendor", vendor_id, {"reason": reason})
        return True, "Vendor application rejected."
    except Exception as exc:
        logger.error("Vendor rejection failed: %s", exc)
        return False, "Failed to reject vendor."


def update_vendor(vendor_id: str, updates: dict, updated_by: str) -> Tuple[bool, str]:
    """Update vendor fields."""
    try:
        db = get_database()
        oid = ObjectId(vendor_id) if ObjectId.is_valid(vendor_id) else None
        filter_q = {"_id": oid} if oid else {"vendor_code": vendor_id}
        updates["updated_at"] = datetime.now(timezone.utc)
        result = db[COLLECTION_VENDORS].update_one(
            filter_q,
            {"$set": updates},
        )
        if result.matched_count == 0:
            return False, "Vendor not found."
        log_audit(updated_by, "UPDATE_VENDOR", "Vendor", vendor_id, {})
        return True, "Vendor updated successfully."
    except Exception as exc:
        logger.error("Vendor update failed: %s", exc)
        return False, "Failed to update vendor."


def delete_vendor(vendor_id: str, deleted_by: str) -> Tuple[bool, str]:
    """Soft-delete a vendor by setting status to Inactive."""
    try:
        db = get_database()
        oid = ObjectId(vendor_id) if ObjectId.is_valid(vendor_id) else None
        filter_q = {"_id": oid} if oid else {"vendor_code": vendor_id}
        result = db[COLLECTION_VENDORS].update_one(
            filter_q,
            {"$set": {
                "status": "Inactive",
                "deleted_by": deleted_by,
                "deleted_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            return False, "Vendor not found."
        log_audit(deleted_by, "DELETE_VENDOR", "Vendor", vendor_id, {})
        return True, "Vendor deactivated successfully."
    except Exception as exc:
        logger.error("Vendor delete failed: %s", exc)
        return False, "Failed to deactivate vendor."


def get_vendor_stats() -> Dict[str, Any]:
    """Return fast aggregate counts for Vendor Manager KPI cards.
    Scoped to canonical categories only (the 6 real vendor categories).
    Legacy DataCo vendor entries are excluded.
    Uses a single $facet aggregate to minimise MongoDB round-trips.
    """
    try:
        db = get_database()
        col = db[COLLECTION_VENDORS]
        canonical_filter = {"category": {"$in": list(_CANONICAL_CATEGORIES)}}

        pipeline = [
            {"$match": canonical_filter},
            {"$facet": {
                "total": [{"$count": "n"}],
                "active": [{"$match": {"status": "Active"}}, {"$count": "n"}],
                "pending": [{"$match": {"approval_status": "Pending"}}, {"$count": "n"}],
                "suspended": [{"$match": {"status": "Suspended"}}, {"$count": "n"}],
                "high_risk": [
                    {"$match": {"reliability_score": {"$lt": 40, "$exists": True}}},
                    {"$count": "n"},
                ],
                "perf": [
                    {"$match": {"late_delivery_rate": {"$exists": True, "$ne": None}}},
                    {"$group": {
                        "_id": None,
                        "avg_late_rate": {"$avg": "$late_delivery_rate"},
                        "total_orders": {"$sum": "$total_orders"},
                    }},
                ],
            }}
        ]
        result = list(col.aggregate(pipeline))
        r = result[0] if result else {}

        def _n(arr): return arr[0]["n"] if arr else 0
        def _first(arr): return arr[0] if arr else {}

        total = _n(r.get("total", []))
        active = _n(r.get("active", []))
        pending = _n(r.get("pending", []))
        suspended = _n(r.get("suspended", []))
        high_risk = _n(r.get("high_risk", []))
        perf = _first(r.get("perf", []))
        avg_late_rate = round(float(perf.get("avg_late_rate") or 0) * 100, 1)
        total_dataset_orders = perf.get("total_orders", 0) or 0

        return {
            "total": total,
            "active": active,
            "pending_approval": pending,
            "inactive": max(0, total - active - pending),
            "suspended": suspended,
            "high_risk": high_risk,
            "avg_late_delivery_rate": avg_late_rate,
            "total_dataset_orders": total_dataset_orders,
        }
    except Exception as exc:
        logger.error("Error getting vendor stats: %s", exc)
        return {
            "total": 0,
            "active": 0,
            "pending_approval": 0,
            "inactive": 0,
            "suspended": 0,
            "high_risk": 0,
            "avg_late_delivery_rate": 0.0,
            "total_dataset_orders": 0,
        }


def get_delivery_performance_distribution() -> Dict[str, Any]:
    """
    Return delivery performance distribution from DataCo dataset.
    Based on: Delivery Status values from DataCo orders.
    """
    try:
        db = get_database()
        from config.settings import COLLECTION_DELIVERIES
        col = db[COLLECTION_DELIVERIES]
        pipeline = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        results = list(col.aggregate(pipeline))
        dist = {}
        for r in results:
            if r["_id"]:
                dist[r["_id"]] = r["count"]
        return dist
    except Exception as exc:
        logger.error("Error getting delivery distribution: %s", exc)
        return {}


# Backward-compatible alias
get_risk_distribution = get_delivery_performance_distribution


def get_vendor_name_map() -> dict:
    """Return a mapping of vendor_id (string) to company_name for selectboxes."""
    try:
        db = get_database()
        col = db[COLLECTION_VENDORS]
        docs = col.find({}, {"company_name": 1, "vendor_code": 1}).limit(500)
        res = {}
        for d in docs:
            sid = str(d["_id"])
            name = d.get("company_name") or d.get("vendor_code") or "Unknown"
            res[sid] = name
        return res
    except Exception as exc:
        logger.error("Error building vendor name map: %s", exc)
        return {}


def get_vendors_for_select(
    active_only: bool = True,
    category: Optional[str] = None,
) -> List[Dict]:
    """
    Return minimal vendor list for selectboxes.
    When `category` is provided, only vendors in that category are returned.
    This enforces the category→vendor isolation rule in Procurement:
      Raw Material Suppliers PR → only Raw Material Supplier vendors shown.

    Always restricted to the 6 canonical categories — legacy DataCo vendor
    entries (Packaging, Manufacturing, Electronics, etc.) are never shown
    in procurement assignment dropdowns.
    """
    try:
        db = get_database()
        query: Dict[str, Any] = {}
        if active_only:
            query["status"] = "Active"
            query["approval_status"] = "Approved"
        if category and category != "All":
            # Pin to the specific canonical category
            query["category"] = category
        else:
            # Restrict to canonical categories only — exclude legacy DataCo entries
            query["category"] = {"$in": list(_CANONICAL_CATEGORIES)}
        docs = db[COLLECTION_VENDORS].find(
            query,
            {"company_name": 1, "category": 1, "vendor_code": 1, "department": 1, "market": 1},
        ).sort("company_name", 1).limit(500)
        return [
            {
                "_id": str(d["_id"]),
                "company_name": d.get("company_name", "Unknown"),
                "category": d.get("category", ""),
                "vendor_code": d.get("vendor_code", ""),
                "department": d.get("department", ""),
                "market": d.get("market", ""),
            }
            for d in docs
        ]
    except Exception as exc:
        logger.error("Error fetching vendors for select: %s", exc)
        return []


# ── Vendor-Scoped Queries (Individual Vendor Portal) ─────────────────────────
# All functions below enforce data isolation at the database query level.
# They MUST only be called with the vendor_id extracted from the authenticated
# JWT session — never trust a vendor_id supplied by the frontend.

def get_vendor_own_record(vendor_id: str):
    """
    Return the single vendor record that belongs to the authenticated vendor account.
    Used exclusively by the individual vendor portal — never for cross-vendor access.
    """
    if not vendor_id or str(vendor_id) in ("", "None", "null"):
        return None
    try:
        db = get_database()
        doc = db[COLLECTION_VENDORS].find_one({"_id": ObjectId(vendor_id)})
        return vendor_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("Error in get_vendor_own_record vendor_id=%s: %s", vendor_id, exc)
        return None


def get_vendor_own_purchase_orders(vendor_id: str, limit: int = 100):
    """
    Return purchase orders belonging ONLY to the authenticated vendor.
    Injects the vendor_id filter at DB level — never returns other vendors POs.
    """
    if not vendor_id or str(vendor_id) in ("", "None", "null"):
        return []
    try:
        from config.settings import COLLECTION_PURCHASE_ORDERS
        db = get_database()
        col = db[COLLECTION_PURCHASE_ORDERS]
        # Match by vendor_id string field on PO documents
        docs = list(col.find({"vendor_id": str(vendor_id)}).sort("created_at", -1).limit(limit))
        result = []
        for d in docs:
            safe = dict(d)
            if "_id" in safe:
                safe["_id"] = str(safe["_id"])
            result.append(safe)
        return result
    except Exception as exc:
        logger.error("Error in get_vendor_own_purchase_orders vendor_id=%s: %s", vendor_id, exc)
        return []


def get_vendor_own_contracts(vendor_id: str, limit: int = 50):
    """
    Return contracts belonging ONLY to the authenticated vendor.
    Enforces vendor isolation at the DB query level.
    """
    if not vendor_id or str(vendor_id) in ("", "None", "null"):
        return []
    try:
        from config.settings import COLLECTION_CONTRACTS
        db = get_database()
        col = db[COLLECTION_CONTRACTS]
        docs = list(col.find({"vendor_id": str(vendor_id)}).sort("created_at", -1).limit(limit))
        result = []
        for d in docs:
            safe = dict(d)
            if "_id" in safe:
                safe["_id"] = str(safe["_id"])
            result.append(safe)
        return result
    except Exception as exc:
        logger.error("Error in get_vendor_own_contracts vendor_id=%s: %s", vendor_id, exc)
        return []


def get_vendor_own_communications(vendor_id: str, user_id: str, limit: int = 50):
    """
    Return communication threads for ONLY the authenticated vendor.
    Uses both vendor_id and user_id to ensure isolation.
    """
    if not vendor_id or str(vendor_id) in ("", "None", "null"):
        return []
    try:
        from config.settings import COLLECTION_COMMUNICATIONS
        db = get_database()
        col = db[COLLECTION_COMMUNICATIONS]
        # Match threads where this vendor is a participant
        query = {
            "$or": [
                {"vendor_id": str(vendor_id)},
                {"participants": str(user_id)},
            ]
        }
        docs = list(col.find(query).sort("last_message_at", -1).limit(limit))
        result = []
        for d in docs:
            safe = dict(d)
            if "_id" in safe:
                safe["_id"] = str(safe["_id"])
            result.append(safe)
        return result
    except Exception as exc:
        logger.error("Error in get_vendor_own_communications vendor_id=%s: %s", vendor_id, exc)
        return []
