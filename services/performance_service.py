"""
services/performance_service.py
--------------------------------
Vendor Performance Intelligence Service — Milestone 3.

Computes:
  - Delivery accuracy, delays, quality proxy, response time proxy,
    issue resolution proxy, completion rate from existing DataCo-backed
    vendor and delivery collections.
  - Transparent composite reliability score (0–100).
  - Risk tier classification: Low / Medium / High.
  - Monthly trend data for sparklines.

Collections used: vendors, deliveries (EXISTING — no new collections).
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from database.connection import get_database
from config.settings import COLLECTION_VENDORS, COLLECTION_DELIVERIES

logger = logging.getLogger(__name__)


# ── Reliability Score Formula ─────────────────────────────────────────────────
# Score = on_time_rate*40 + completion_rate*30 + quality_index*20 + response_score*10
# All components are 0–1 fractions, score is 0–100.

SCORE_WEIGHTS = {
    "on_time_rate": 0.40,
    "completion_rate": 0.30,
    "quality_index": 0.20,
    "response_score": 0.10,
}


def compute_reliability_score(
    on_time_rate: float,
    completion_rate: float,
    quality_index: float,
    response_score: float,
) -> float:
    """
    Transparent composite reliability score (0–100).

    Formula:
        score = on_time_rate×40 + completion_rate×30 + quality_index×20 + response_score×10

    All inputs are fractions in [0.0, 1.0].
    """
    score = (
        on_time_rate * 40.0
        + completion_rate * 30.0
        + quality_index * 20.0
        + response_score * 10.0
    )
    return round(min(max(score, 0.0), 100.0), 2)


def get_risk_tier(score: float) -> str:
    """
    Map reliability score to a risk tier.

    Low  : score >= 70   (reliable supplier)
    Medium : 40 <= score < 70
    High : score < 40    (unreliable / high risk)
    """
    if score >= 70.0:
        return "Low"
    if score >= 40.0:
        return "Medium"
    return "High"


def get_risk_tier_color(tier: str) -> str:
    """Return hex color for a risk tier badge."""
    return {"Low": "#2D6A4A", "Medium": "#B08D57", "High": "#8B3038"}.get(tier, "#68707C")


# ── Performance Ranked List ───────────────────────────────────────────────────

def get_vendor_performance_ranked(
    page: int = 1,
    page_size: int = 20,
    risk_filter: Optional[str] = None,
    market_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Return paginated, ranked vendor performance table.

    Each row includes:
      vendor_code, company_name, department, market, category,
      total_orders, on_time_count, late_delivery_count,
      delivery_accuracy_pct, delay_rate_pct,
      quality_index, response_score, completion_rate,
      reliability_score, risk_tier
    """
    try:
        db = get_database()
        col = db[COLLECTION_VENDORS]

        query: Dict[str, Any] = {}
        if market_filter and market_filter != "All":
            query["market"] = market_filter
        if search:
            s = search.strip()
            query["$or"] = [
                {"vendor_code": {"$regex": s, "$options": "i"}},
                {"company_name": {"$regex": s, "$options": "i"}},
                {"department": {"$regex": s, "$options": "i"}},
            ]

        total_count = col.count_documents(query)
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        page = max(1, min(page, total_pages)) if total_count > 0 else 1
        skip = (page - 1) * page_size

        docs = list(
            col.find(query)
            .sort("reliability_score", -1)
            .skip(skip)
            .limit(page_size)
        )

        rows = []
        for v in docs:
            total_ord = v.get("total_orders", 0) or 0
            on_time = v.get("on_time_count", 0) or 0
            late = v.get("late_delivery_count", 0) or 0

            # Delivery accuracy (on-time rate)
            on_time_rate = (on_time / total_ord) if total_ord > 0 else 0.0
            delivery_accuracy_pct = round(on_time_rate * 100, 1)
            delay_rate_pct = round((late / total_ord * 100) if total_ord > 0 else 0.0, 1)

            # Completion rate: orders not cancelled — proxy via on_time + late counts
            completion_rate = min(((on_time + late) / total_ord) if total_ord > 0 else 0.0, 1.0)

            # Quality index: inverse of late_delivery_rate (stored as fraction)
            raw_late_rate = v.get("late_delivery_rate") or 0.0
            quality_index = max(0.0, 1.0 - float(raw_late_rate))

            # Response score: proxy from avg_shipping_days_real vs avg_shipping_days_scheduled
            avg_real = float(v.get("avg_shipping_days_real") or 5.0)
            avg_sched = float(v.get("avg_shipping_days_scheduled") or 5.0)
            if avg_sched > 0:
                ratio = avg_real / avg_sched
                response_score = max(0.0, min(1.0, 2.0 - ratio))
            else:
                response_score = 0.5

            # Use stored reliability_score if present, else compute
            stored_score = v.get("reliability_score")
            if stored_score is not None and stored_score > 0:
                reliability_score = float(stored_score)
            else:
                reliability_score = compute_reliability_score(
                    on_time_rate, completion_rate, quality_index, response_score
                )

            tier = get_risk_tier(reliability_score)

            # Apply risk filter after computing tier
            if risk_filter and risk_filter != "All" and tier != risk_filter:
                continue

            rows.append({
                "vendor_code": v.get("vendor_code", "N/A"),
                "company_name": v.get("company_name", "Unknown"),
                "department": v.get("department", ""),
                "market": v.get("market", ""),
                "category": v.get("category", ""),
                "total_orders": total_ord,
                "on_time_count": on_time,
                "late_delivery_count": late,
                "delivery_accuracy_pct": delivery_accuracy_pct,
                "delay_rate_pct": delay_rate_pct,
                "quality_index": round(quality_index * 100, 1),
                "response_score": round(response_score * 100, 1),
                "completion_rate": round(completion_rate * 100, 1),
                "reliability_score": reliability_score,
                "risk_tier": tier,
                "_id": str(v.get("_id", "")),
            })

        return {
            "items": rows,
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }
    except Exception as exc:
        logger.error("Error in get_vendor_performance_ranked: %s", exc)
        return {"items": [], "total": 0, "page": 1, "page_size": page_size, "total_pages": 1}


# ── Performance Summary KPIs ──────────────────────────────────────────────────

def get_performance_summary() -> Dict[str, Any]:
    """
    Aggregate KPIs for the performance page header.
    Uses precomputed fields on vendor documents.
    """
    try:
        db = get_database()
        col = db[COLLECTION_VENDORS]

        pipeline = [
            {"$match": {"total_orders": {"$gt": 0}}},
            {"$group": {
                "_id": None,
                "avg_reliability": {"$avg": "$reliability_score"},
                "total_vendors": {"$sum": 1},
                "total_orders": {"$sum": "$total_orders"},
                "total_late": {"$sum": "$late_delivery_count"},
                "total_on_time": {"$sum": "$on_time_count"},
                "avg_transit": {"$avg": "$avg_shipping_days_real"},
            }},
        ]
        agg = list(col.aggregate(pipeline))
        if not agg:
            return _empty_perf_summary()

        r = agg[0]
        total_ord = r.get("total_orders", 1) or 1
        total_late = r.get("total_late", 0) or 0
        total_on_time = r.get("total_on_time", 0) or 0

        # Risk tier counts
        high_risk = col.count_documents({"reliability_score": {"$lt": 40}})
        medium_risk = col.count_documents({"reliability_score": {"$gte": 40, "$lt": 70}})
        low_risk = col.count_documents({"reliability_score": {"$gte": 70}})

        return {
            "avg_reliability": round(float(r.get("avg_reliability") or 0), 1),
            "total_vendors": r.get("total_vendors", 0),
            "total_orders": total_ord,
            "overall_on_time_pct": round(total_on_time / total_ord * 100, 1),
            "overall_late_pct": round(total_late / total_ord * 100, 1),
            "avg_transit_days": round(float(r.get("avg_transit") or 0), 1),
            "high_risk_count": high_risk,
            "medium_risk_count": medium_risk,
            "low_risk_count": low_risk,
        }
    except Exception as exc:
        logger.error("Error in get_performance_summary: %s", exc)
        return _empty_perf_summary()


def _empty_perf_summary() -> Dict[str, Any]:
    return {
        "avg_reliability": 0.0,
        "total_vendors": 0,
        "total_orders": 0,
        "overall_on_time_pct": 0.0,
        "overall_late_pct": 0.0,
        "avg_transit_days": 0.0,
        "high_risk_count": 0,
        "medium_risk_count": 0,
        "low_risk_count": 0,
    }


# ── Risk Distribution ─────────────────────────────────────────────────────────

def get_risk_distribution_counts() -> Dict[str, int]:
    """Return count of vendors per risk tier using stored reliability_score."""
    try:
        db = get_database()
        col = db[COLLECTION_VENDORS]
        high = col.count_documents({"reliability_score": {"$lt": 40, "$exists": True}})
        medium = col.count_documents({"reliability_score": {"$gte": 40, "$lt": 70}})
        low = col.count_documents({"reliability_score": {"$gte": 70}})
        return {"High": high, "Medium": medium, "Low": low}
    except Exception as exc:
        logger.error("Error getting risk distribution: %s", exc)
        return {"High": 0, "Medium": 0, "Low": 0}


# ── Vendor Detail ─────────────────────────────────────────────────────────────

def get_vendor_performance_detail(vendor_id: str) -> Optional[Dict[str, Any]]:
    """
    Return full performance detail for a single vendor.
    Includes computed metrics + score breakdown.
    """
    try:
        from bson import ObjectId
        db = get_database()
        col = db[COLLECTION_VENDORS]
        oid = ObjectId(vendor_id) if ObjectId.is_valid(vendor_id) else None
        if not oid:
            return None
        v = col.find_one({"_id": oid})
        if not v:
            return None

        total_ord = v.get("total_orders", 0) or 0
        on_time = v.get("on_time_count", 0) or 0
        late = v.get("late_delivery_count", 0) or 0
        raw_late_rate = float(v.get("late_delivery_rate") or 0.0)

        on_time_rate = (on_time / total_ord) if total_ord > 0 else 0.0
        completion_rate = min(((on_time + late) / total_ord) if total_ord > 0 else 0.0, 1.0)
        quality_index = max(0.0, 1.0 - raw_late_rate)

        avg_real = float(v.get("avg_shipping_days_real") or 5.0)
        avg_sched = float(v.get("avg_shipping_days_scheduled") or 5.0)
        if avg_sched > 0:
            ratio = avg_real / avg_sched
            response_score = max(0.0, min(1.0, 2.0 - ratio))
        else:
            response_score = 0.5

        stored = v.get("reliability_score")
        reliability_score = float(stored) if stored and stored > 0 else compute_reliability_score(
            on_time_rate, completion_rate, quality_index, response_score
        )

        return {
            "_id": str(v["_id"]),
            "vendor_code": v.get("vendor_code", "N/A"),
            "company_name": v.get("company_name", "Unknown"),
            "department": v.get("department", ""),
            "market": v.get("market", ""),
            "category": v.get("category", ""),
            "total_orders": total_ord,
            "on_time_count": on_time,
            "late_delivery_count": late,
            "avg_shipping_days_real": avg_real,
            "avg_shipping_days_scheduled": avg_sched,
            # Score components (0–100 scale for display)
            "delivery_accuracy": round(on_time_rate * 100, 1),
            "completion_rate": round(completion_rate * 100, 1),
            "quality_index": round(quality_index * 100, 1),
            "response_score": round(response_score * 100, 1),
            "reliability_score": reliability_score,
            "risk_tier": get_risk_tier(reliability_score),
            # Weights for transparency display
            "score_breakdown": {
                "Delivery Accuracy (40%)": round(on_time_rate * 40, 1),
                "Completion Rate (30%)": round(completion_rate * 30, 1),
                "Quality Index (20%)": round(quality_index * 20, 1),
                "Response Score (10%)": round(response_score * 10, 1),
            },
        }
    except Exception as exc:
        logger.error("Error in get_vendor_performance_detail: %s", exc)
        return None


# ── Monthly Trend Data ────────────────────────────────────────────────────────

def get_delivery_trend_by_market() -> Dict[str, Any]:
    """
    Return monthly on-time vs late delivery counts aggregated from deliveries collection.
    """
    try:
        db = get_database()
        col = db[COLLECTION_DELIVERIES]
        pipeline = [
            {"$match": {"order_date": {"$exists": True}}},
            {"$group": {
                "_id": {
                    "year": {"$year": "$order_date"},
                    "month": {"$month": "$order_date"},
                    "status": "$status",
                },
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id.year": 1, "_id.month": 1}},
        ]
        results = list(col.aggregate(pipeline))
        if not results:
            return {"months": [], "on_time": [], "late": []}

        import calendar
        monthly: Dict[str, Dict[str, int]] = {}
        for r in results:
            key = f"{calendar.month_abbr[r['_id']['month']]} '{str(r['_id']['year'])[2:]}"
            if key not in monthly:
                monthly[key] = {"on_time": 0, "late": 0}
            status = r["_id"].get("status", "")
            if status == "Delivered":
                monthly[key]["on_time"] += r["count"]
            elif status in ("Pending", "Partially Delivered"):
                monthly[key]["late"] += r["count"]

        months = list(monthly.keys())
        on_time = [monthly[m]["on_time"] for m in months]
        late = [monthly[m]["late"] for m in months]
        return {"months": months, "on_time": on_time, "late": late}
    except Exception as exc:
        logger.error("Error in get_delivery_trend_by_market: %s", exc)
        return {"months": [], "on_time": [], "late": []}


def get_market_risk_summary() -> List[Dict[str, Any]]:
    """Return per-market average reliability and risk breakdown."""
    try:
        db = get_database()
        col = db[COLLECTION_VENDORS]
        pipeline = [
            {"$match": {"market": {"$exists": True, "$ne": None}, "total_orders": {"$gt": 0}}},
            {"$group": {
                "_id": "$market",
                "avg_score": {"$avg": "$reliability_score"},
                "vendor_count": {"$sum": 1},
                "total_orders": {"$sum": "$total_orders"},
                "total_late": {"$sum": "$late_delivery_count"},
                "high_risk": {"$sum": {"$cond": [{"$lt": ["$reliability_score", 40]}, 1, 0]}},
            }},
            {"$sort": {"avg_score": -1}},
        ]
        results = list(col.aggregate(pipeline))
        out = []
        for r in results:
            out.append({
                "market": r["_id"],
                "avg_score": round(float(r.get("avg_score") or 0), 1),
                "vendor_count": r.get("vendor_count", 0),
                "total_orders": r.get("total_orders", 0),
                "high_risk_vendors": r.get("high_risk", 0),
                "risk_tier": get_risk_tier(float(r.get("avg_score") or 0)),
            })
        return out
    except Exception as exc:
        logger.error("Error in get_market_risk_summary: %s", exc)
        return []


# ── Vendor-Scoped Performance (Individual Vendor Portal) ─────────────────────
# All functions below are STRICTLY scoped to a single vendor_id.
# They MUST only be called with the vendor_id from the authenticated JWT session.

def get_vendor_own_performance(vendor_id: str):
    """
    Return complete performance profile for ONE specific vendor.
    Data-isolated: uses vendor_id from authenticated session only.
    Returns all required project-doc metrics:
      On-Time Deliveries, Delayed Deliveries, Quality Rating,
      Response Time, Issue Resolution Time, Order Completion Rate,
      Reliability Score, Risk Tier, Score breakdown.
    """
    if not vendor_id or str(vendor_id) in ("", "None", "null"):
        return None
    try:
        from bson import ObjectId
        db = get_database()
        col = db[COLLECTION_VENDORS]
        oid = ObjectId(vendor_id) if ObjectId.is_valid(str(vendor_id)) else None
        if not oid:
            return None
        v = col.find_one({"_id": oid})
        if not v:
            return None
        total_ord = v.get("total_orders", 0) or 0
        on_time = v.get("on_time_count", 0) or 0
        late = v.get("late_delivery_count", 0) or 0
        raw_late_rate = float(v.get("late_delivery_rate") or 0.0)
        on_time_rate = (on_time / total_ord) if total_ord > 0 else 0.0
        completion_rate = min(((on_time + late) / total_ord) if total_ord > 0 else 0.0, 1.0)
        quality_index = max(0.0, 1.0 - raw_late_rate)
        avg_real = float(v.get("avg_shipping_days_real") or 5.0)
        avg_sched = float(v.get("avg_shipping_days_scheduled") or 5.0)
        if avg_sched > 0:
            ratio = avg_real / avg_sched
            response_score = max(0.0, min(1.0, 2.0 - ratio))
        else:
            response_score = 0.5
        stored = v.get("reliability_score")
        reliability_score = float(stored) if stored and stored > 0 else compute_reliability_score(
            on_time_rate, completion_rate, quality_index, response_score
        )
        return {
            "_id": str(v["_id"]),
            "vendor_code": v.get("vendor_code", "N/A"),
            "company_name": v.get("company_name", "Unknown"),
            "category": v.get("category", ""),
            "department": v.get("department", ""),
            "market": v.get("market", ""),
            "status": v.get("status", ""),
            "approval_status": v.get("approval_status", ""),
            "total_orders": total_ord,
            "on_time_deliveries": on_time,
            "delayed_deliveries": late,
            "on_time_rate": round(on_time_rate * 100, 1),
            "delay_rate": round(raw_late_rate * 100, 1),
            "order_completion_rate": round(completion_rate * 100, 1),
            "quality_rating": round(quality_index * 100, 1),
            "response_time_score": round(response_score * 100, 1),
            "issue_resolution_score": round(response_score * 100, 1),
            "avg_shipping_days_real": round(avg_real, 1),
            "avg_shipping_days_scheduled": round(avg_sched, 1),
            "reliability_score": round(reliability_score, 1),
            "risk_tier": get_risk_tier(reliability_score),
            "score_breakdown": {
                "Delivery Accuracy (40pct)": round(on_time_rate * 40, 1),
                "Completion Rate (30pct)": round(completion_rate * 30, 1),
                "Quality Index (20pct)": round(quality_index * 20, 1),
                "Response Score (10pct)": round(response_score * 10, 1),
            },
        }
    except Exception as exc:
        logger.error("Error in get_vendor_own_performance vendor_id=%s: %s", vendor_id, exc)
        return None


def get_vendor_performance_trend(vendor_id: str):
    """Return monthly on-time vs late delivery counts for a single vendor."""
    if not vendor_id or str(vendor_id) in ("", "None", "null"):
        return {"months": [], "on_time": [], "late": []}
    try:
        from bson import ObjectId
        import calendar as cal_mod
        db = get_database()
        col = db[COLLECTION_DELIVERIES]
        match_q = {"order_date": {"$exists": True}}
        if ObjectId.is_valid(str(vendor_id)):
            match_q["$or"] = [
                {"vendor_id": str(vendor_id)},
                {"vendor_id": ObjectId(vendor_id)},
            ]
        else:
            match_q["vendor_id"] = str(vendor_id)
        pipeline = [
            {"$match": match_q},
            {"$group": {
                "_id": {
                    "year": {"$year": "$order_date"},
                    "month": {"$month": "$order_date"},
                    "status": "$status",
                },
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id.year": 1, "_id.month": 1}},
        ]
        results = list(col.aggregate(pipeline))
        if not results:
            return {"months": [], "on_time": [], "late": []}
        monthly = {}
        for r in results:
            m_abbr = cal_mod.month_abbr[r["_id"]["month"]]
            yr_short = str(r["_id"]["year"])[2:]
            key = f"{m_abbr} '{yr_short}"
            if key not in monthly:
                monthly[key] = {"on_time": 0, "late": 0}
            status = r["_id"].get("status", "")
            if status == "Delivered":
                monthly[key]["on_time"] += r["count"]
            elif status in ("Pending", "Partially Delivered"):
                monthly[key]["late"] += r["count"]
        months = list(monthly.keys())
        return {
            "months": months,
            "on_time": [monthly[m]["on_time"] for m in months],
            "late": [monthly[m]["late"] for m in months],
        }
    except Exception as exc:
        logger.error("Error in get_vendor_performance_trend vendor_id=%s: %s", vendor_id, exc)
        return {"months": [], "on_time": [], "late": []}


# ── Overall Performance Charts (Vendor Manager Only) ──────────────────────────
# These functions power the performance graphs in the Overall Performance tab.
# They aggregate data from the real vendors + deliveries collections.
# NEVER called from individual Vendor Portal — that uses get_vendor_own_* only.

def get_overall_performance_by_category(
    category=None,
    vendor_id=None,
    date_from=None,
    date_to=None,
):
    """
    Return per-category performance metrics for the Overall Performance charts.

    Filters:
        category  — restrict to one canonical category (or None = all 6)
        vendor_id — restrict to one specific vendor (or None = all vendors)
        date_from / date_to — filter deliveries by order_date range

    Returns one dict per category with all 8 required metrics.
    """
    try:
        from config.settings import VENDOR_CATEGORIES, VENDOR_CATEGORY_LABELS, COLLECTION_DELIVERIES
        db = get_database()
        vendor_col = db[COLLECTION_VENDORS]
        delivery_col = db[COLLECTION_DELIVERIES]

        vendor_match = {}
        if category and category != "All":
            vendor_match["category"] = category
        if vendor_id and str(vendor_id) not in ("", "All"):
            try:
                from bson import ObjectId
                if ObjectId.is_valid(str(vendor_id)):
                    vendor_match["_id"] = ObjectId(str(vendor_id))
            except Exception:
                pass

        vendor_pipeline = []
        if vendor_match:
            vendor_pipeline.append({"$match": vendor_match})
        vendor_pipeline += [
            {"$group": {
                "_id":             "$category",
                "total_orders":    {"$sum": "$total_orders"},
                "on_time_total":   {"$sum": "$on_time_count"},
                "late_total":      {"$sum": "$late_delivery_count"},
                "avg_reliability": {"$avg": "$reliability_score"},
                "avg_real":        {"$avg": "$avg_shipping_days_real"},
                "avg_sched":       {"$avg": "$avg_shipping_days_scheduled"},
                "avg_late_rate":   {"$avg": "$late_delivery_rate"},
                "vendor_count":    {"$sum": 1},
                "vendor_ids":      {"$push": "$_id"},
            }},
        ]
        cat_agg = list(vendor_col.aggregate(vendor_pipeline))
        cat_map = {r["_id"]: r for r in cat_agg if r["_id"]}

        target_cats = (
            [category] if (category and category != "All")
            else VENDOR_CATEGORIES
        )

        results = []
        for cat_key in target_cats:
            r = cat_map.get(cat_key, {})
            total_ord = int(r.get("total_orders", 0) or 0)
            on_time   = int(r.get("on_time_total", 0) or 0)
            late_cnt  = int(r.get("late_total", 0) or 0)
            avg_rel   = float(r.get("avg_reliability", 0.0) or 0.0)
            avg_real  = float(r.get("avg_real", 5.0) or 5.0)
            avg_sched = float(r.get("avg_sched", 5.0) or 5.0)
            avg_lr    = float(r.get("avg_late_rate", 0.0) or 0.0)

            on_time_rate = (on_time / total_ord * 100) if total_ord > 0 else 0.0
            delay_rate   = (late_cnt / total_ord * 100) if total_ord > 0 else 0.0
            quality_rat  = max(0.0, 1.0 - avg_lr) * 100
            cr = min(((on_time + late_cnt) / total_ord * 100) if total_ord > 0 else 0.0, 100.0)
            rs_raw = max(0.0, min(1.0, 2.0 - avg_real / avg_sched if avg_sched > 0 else 0.5))
            resp_score = rs_raw * 100
            issue_res  = resp_score  # proxy (same factor as response time)

            monthly_trend = _get_monthly_trend_for_category(
                delivery_col,
                vendor_ids=r.get("vendor_ids", []),
                date_from=date_from,
                date_to=date_to,
            )

            results.append({
                "category":              cat_key,
                "category_label":        VENDOR_CATEGORY_LABELS.get(cat_key, cat_key),
                "vendor_count":          int(r.get("vendor_count", 0) or 0),
                "total_orders":          total_ord,
                "on_time_deliveries":    on_time,
                "delayed_deliveries":    late_cnt,
                "on_time_rate":          round(on_time_rate, 1),
                "delay_rate":            round(delay_rate, 1),
                "quality_rating":        round(quality_rat, 1),
                "response_time":         round(resp_score, 1),
                "issue_resolution_time": round(issue_res, 1),
                "order_completion_rate": round(cr, 1),
                "reliability_score":     round(avg_rel, 1),
                "monthly_trend":         monthly_trend,
            })

        return results
    except Exception as exc:
        logger.error("Error in get_overall_performance_by_category: %s", exc)
        return []


def _get_monthly_trend_for_category(delivery_col, vendor_ids, date_from=None, date_to=None):
    """Monthly on-time vs late delivery counts for a list of vendor ObjectIds."""
    import calendar as cal_mod
    try:
        match_q = {"order_date": {"$exists": True}}
        if vendor_ids:
            match_q["$or"] = [
                {"vendor_id": {"$in": [str(v) for v in vendor_ids]}},
                {"vendor_id": {"$in": vendor_ids}},
            ]
        if date_from or date_to:
            date_filter = {}
            if date_from:
                date_filter["$gte"] = date_from
            if date_to:
                date_filter["$lte"] = date_to
            match_q["order_date"] = date_filter

        pipeline = [
            {"$match": match_q},
            {"$group": {
                "_id": {
                    "year":  {"$year":  "$order_date"},
                    "month": {"$month": "$order_date"},
                    "status": "$status",
                },
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id.year": 1, "_id.month": 1}},
        ]
        results = list(delivery_col.aggregate(pipeline))
        if not results:
            return {"months": [], "on_time": [], "late": []}

        monthly = {}
        for r in results:
            m_abbr   = cal_mod.month_abbr[r["_id"]["month"]]
            yr_short = str(r["_id"]["year"])[2:]
            key = f"{m_abbr} '{yr_short}"
            if key not in monthly:
                monthly[key] = {"on_time": 0, "late": 0}
            status = r["_id"].get("status", "")
            if status == "Delivered":
                monthly[key]["on_time"] += r["count"]
            elif status in ("Pending", "Partially Delivered"):
                monthly[key]["late"] += r["count"]

        months = list(monthly.keys())
        return {
            "months":  months,
            "on_time": [monthly[m]["on_time"] for m in months],
            "late":    [monthly[m]["late"]    for m in months],
        }
    except Exception as exc:
        logger.error("Error in _get_monthly_trend_for_category: %s", exc)
        return {"months": [], "on_time": [], "late": []}


def get_vendors_list_for_filter(category=None):
    """Return vendors for the filter dropdown in the Overall Performance tab."""
    try:
        db = get_database()
        col = db[COLLECTION_VENDORS]
        query = {}
        if category and category != "All":
            query["category"] = category
        docs = list(
            col.find(query, {"company_name": 1, "vendor_code": 1, "category": 1})
            .sort("company_name", 1)
            .limit(500)
        )
        return [
            {
                "_id": str(d["_id"]),
                "company_name": d.get("company_name", "Unknown"),
                "vendor_code": d.get("vendor_code", ""),
                "category": d.get("category", ""),
            }
            for d in docs
        ]
    except Exception as exc:
        logger.error("Error in get_vendors_list_for_filter: %s", exc)
        return []
