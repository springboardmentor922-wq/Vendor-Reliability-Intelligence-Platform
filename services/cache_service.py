"""
services/cache_service.py
--------------------------
Centralized caching layer for expensive MongoDB aggregate queries.

Uses Streamlit's @st.cache_data with appropriate TTLs so that heavy
computations run at most once per interval per Streamlit worker.

All functions here are thin wrappers around real service calls.
Import from here (not directly from the underlying services) in views
that need cached results for fast page loads.
"""

import streamlit as st


# ── Vendor Stats ──────────────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def get_cached_vendor_stats():
    """Cached vendor aggregate KPI counts (single $facet query)."""
    from services.vendor_service import get_vendor_stats
    return get_vendor_stats()


# ── Performance Summary ───────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def get_cached_performance_summary():
    """Cached performance headline KPIs."""
    from services.performance_service import get_performance_summary
    return get_performance_summary()


@st.cache_data(ttl=300, show_spinner=False)
def get_cached_risk_distribution():
    """Cached risk tier distribution counts."""
    from services.performance_service import get_risk_distribution_counts
    return get_risk_distribution_counts()


@st.cache_data(ttl=300, show_spinner=False)
def get_cached_market_risk_summary():
    """Cached per-market risk summary."""
    from services.performance_service import get_market_risk_summary
    return get_market_risk_summary()


@st.cache_data(ttl=300, show_spinner=False)
def get_cached_delivery_trend():
    """Cached monthly delivery trend (on-time vs late)."""
    from services.performance_service import get_delivery_trend_by_market
    return get_delivery_trend_by_market()


@st.cache_data(ttl=300, show_spinner=False)
def get_cached_vendor_performance_ranked(page: int = 1, page_size: int = 20):
    """Cached paginated vendor performance ranking (no filters — use for overview)."""
    from services.performance_service import get_vendor_performance_ranked
    return get_vendor_performance_ranked(page=page, page_size=page_size)


@st.cache_data(ttl=300, show_spinner=False)
def get_cached_bottom_vendors(limit: int = 10):
    """Cached bottom performers by reliability score for analytics page."""
    from database.connection import get_database
    from config.settings import COLLECTION_VENDORS
    try:
        db = get_database()
        docs = list(
            db[COLLECTION_VENDORS]
            .find(
                {"total_orders": {"$gt": 0}},
                {"company_name": 1, "market": 1, "reliability_score": 1},
            )
            .sort("reliability_score", 1)
            .limit(limit)
        )
        return [
            {
                "company_name": d.get("company_name", ""),
                "market": d.get("market", ""),
                "reliability_score": float(d.get("reliability_score") or 0),
            }
            for d in docs
        ]
    except Exception:
        return []


@st.cache_data(ttl=300, show_spinner=False)
def get_cached_carrier_stats():
    """Cached carrier/shipping-mode delivery stats for delivery analytics tab."""
    from database.connection import get_database
    from config.settings import COLLECTION_DELIVERIES
    try:
        db = get_database()
        pipeline = [
            {"$match": {"carrier": {"$ne": None, "$ne": ""}}},
            {"$group": {
                "_id": "$carrier",
                "total": {"$sum": 1},
                "late": {"$sum": {"$cond": [{"$eq": ["$status", "Pending"]}, 1, 0]}},
            }},
            {"$sort": {"total": -1}},
            {"$limit": 8},
        ]
        return list(db[COLLECTION_DELIVERIES].aggregate(pipeline))
    except Exception:
        return []


# ── Analytics ─────────────────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def get_cached_po_spend_by_month():
    """Cached monthly PO spend trend."""
    from services.procurement_service import get_po_spend_by_month
    return get_po_spend_by_month()


@st.cache_data(ttl=300, show_spinner=False)
def get_cached_total_po_value():
    """Cached total PO value."""
    from services.procurement_service import get_total_po_value
    return get_total_po_value()


@st.cache_data(ttl=300, show_spinner=False)
def get_cached_procurement_stats():
    """Cached procurement KPI stats."""
    from services.procurement_service import get_procurement_stats
    return get_procurement_stats()


@st.cache_data(ttl=300, show_spinner=False)
def get_cached_vendor_po_summary():
    """Cached per-vendor PO summary."""
    from services.procurement_service import get_vendor_po_summary
    return get_vendor_po_summary()


@st.cache_data(ttl=300, show_spinner=False)
def get_cached_delivery_performance_by_month():
    """Cached monthly delivery performance breakdown."""
    from services.procurement_service import get_delivery_performance_by_month
    return get_delivery_performance_by_month()


# ── Delivery Risk Analytics ───────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def get_cached_delivery_status_distribution():
    """Cached delivery status pie breakdown."""
    from services.vendor_service import get_delivery_performance_distribution
    return get_delivery_performance_distribution()


# ── Audit KPIs ────────────────────────────────────────────────────────────────

@st.cache_data(ttl=120, show_spinner=False)
def get_cached_audit_kpis():
    """Cached audit trail KPI counts (shorter TTL = 2 min for freshness)."""
    from database.connection import get_database
    from config.settings import COLLECTION_AUDIT_LOGS
    from datetime import datetime, timezone
    try:
        db = get_database()
        col = db[COLLECTION_AUDIT_LOGS]

        pipeline = [
            {"$facet": {
                "total": [{"$count": "n"}],
                "today": [
                    {"$match": {
                        "timestamp": {
                            "$gte": datetime.now(timezone.utc).replace(
                                hour=0, minute=0, second=0, microsecond=0
                            )
                        }
                    }},
                    {"$count": "n"},
                ],
                "users": [
                    {"$group": {"_id": "$user_id"}},
                    {"$count": "n"},
                ],
                "actions": [
                    {"$group": {"_id": "$action"}},
                    {"$count": "n"},
                ],
            }}
        ]
        result = list(col.aggregate(pipeline))
        r = result[0] if result else {}

        def _n(arr): return arr[0]["n"] if arr else 0

        return {
            "total_events": _n(r.get("total", [])),
            "today_events": _n(r.get("today", [])),
            "unique_users": _n(r.get("users", [])),
            "unique_actions": _n(r.get("actions", [])),
        }
    except Exception:
        return {"total_events": 0, "today_events": 0, "unique_users": 0, "unique_actions": 0}


# ── Communication ─────────────────────────────────────────────────────────────

@st.cache_data(ttl=120, show_spinner=False)
def get_cached_vendors_for_comms():
    """
    Lightweight cached vendor list for Communication page dropdowns.
    Fetches only required fields — name, code, _id. TTL 2 min.
    """
    from database.connection import get_database
    from config.settings import COLLECTION_VENDORS
    try:
        db = get_database()
        docs = list(
            db[COLLECTION_VENDORS]
            .find(
                {},
                {"company_name": 1, "vendor_code": 1},
            )
            .sort("company_name", 1)
            .limit(500)
        )
        return [
            {
                "_id": str(d["_id"]),
                "company_name": d.get("company_name", "Unknown"),
                "vendor_code": d.get("vendor_code", ""),
            }
            for d in docs
        ]
    except Exception:
        return []


# ── Purchase Orders Page ──────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def get_cached_vendor_name_map() -> dict:
    """
    Cached vendor id→name mapping used by the PO page dropdowns and cards.
    Replaces the uncached get_vendor_name_map() call that ran on every rerun.
    TTL 5 min — vendor names rarely change.
    """
    from services.vendor_service import get_vendor_name_map
    return get_vendor_name_map()


@st.cache_data(ttl=60, show_spinner=False)
def get_cached_po_stats() -> dict:
    """
    Cached PO KPI stats (6 count_documents calls collapsed to one cached result).
    TTL 60s — short enough to reflect recent PO creation/approval.
    """
    from services.procurement_service import get_po_stats
    return get_po_stats()


@st.cache_data(ttl=30, show_spinner=False)
def get_cached_open_prs_for_po() -> list:
    """
    Fetch all PRs eligible for PO creation in a single query, then bulk-check
    which ones already have a PO — eliminates the N+1 get_po_by_request_id loop.

    Returns a list of PR dicts that have no existing PO yet.
    TTL 30s — short so newly created POs are reflected quickly.
    """
    from database.connection import get_database
    from config.settings import COLLECTION_PROCUREMENT_REQUESTS, COLLECTION_PURCHASE_ORDERS
    from models.procurement import procurement_from_mongo
    try:
        db = get_database()
        # Single query: all PRs in the three eligible statuses
        prs = list(
            db[COLLECTION_PROCUREMENT_REQUESTS]
            .find(
                {"status": {"$in": ["Vendor Assigned", "Approved", "Vendor Accepted"]}},
                sort=[("created_at", -1)],
            )
            .limit(200)
        )
        if not prs:
            return []

        pr_ids = [str(p["_id"]) for p in prs]

        # Bulk fetch existing PO request_ids — one query instead of N
        existing_po_request_ids = set(
            doc["request_id"]
            for doc in db[COLLECTION_PURCHASE_ORDERS].find(
                {"request_id": {"$in": pr_ids}},
                {"request_id": 1, "_id": 0},
            )
        )

        open_prs = [
            procurement_from_mongo(p)
            for p in prs
            if str(p["_id"]) not in existing_po_request_ids
        ]
        return open_prs
    except Exception:
        return []


@st.cache_data(ttl=30, show_spinner=False)
def get_cached_active_pos() -> list:
    """
    Fetch Approved + Ordered POs in a single $in query instead of two separate calls.
    TTL 30s — active orders change frequently.
    """
    from database.connection import get_database
    from config.settings import COLLECTION_PURCHASE_ORDERS
    from models.purchase_order import po_from_mongo
    try:
        db = get_database()
        docs = list(
            db[COLLECTION_PURCHASE_ORDERS]
            .find({"status": {"$in": ["Approved", "Ordered"]}})
            .sort("created_at", -1)
            .limit(100)
        )
        return [po_from_mongo(d) for d in docs]
    except Exception:
        return []


def invalidate_po_caches() -> None:
    """
    Clear PO-related caches after a write operation (PO creation, status update).
    Also clears Finance payment caches because a PO delivery-status change
    directly affects payment eligibility displayed in the Finance module.
    Call this before st.rerun() so the next render sees fresh data.
    """
    get_cached_po_stats.clear()
    get_cached_total_po_value.clear()
    get_cached_open_prs_for_po.clear()
    get_cached_active_pos.clear()
    # Finance caches: delivery status change unlocks payment eligibility
    get_cached_finance_dashboard_stats.clear()
    get_cached_invoice_stats.clear()


# ── Invoice Page ──────────────────────────────────────────────────────────────

@st.cache_data(ttl=60, show_spinner=False)
def get_cached_invoice_stats() -> dict:
    """
    Cached invoice KPI stats (single $facet aggregation).
    TTL 60s — short enough to reflect recent submissions/verifications.
    """
    from services.invoice_service import get_invoice_stats
    return get_invoice_stats()


@st.cache_data(ttl=30, show_spinner=False)
def get_cached_finance_dashboard_stats() -> dict:
    """
    Cached finance dashboard metrics (7 key counts and values).
    TTL 30s.
    """
    from services.invoice_service import get_finance_dashboard_stats
    return get_finance_dashboard_stats()


def invalidate_invoice_caches() -> None:
    """Clear invoice-related caches after a write (submission, verification, settlement)."""
    get_cached_invoice_stats.clear()
    get_cached_finance_dashboard_stats.clear()

