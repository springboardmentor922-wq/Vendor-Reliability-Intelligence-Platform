"""Milestone-3: Analytics engine + endpoints.

Analytics are computed live from the database tables:
  - dataset_suppliers / dataset_orders : real historical delivery data
    (product-as-supplier proxy)
  - vendors / purchase_orders / procurement_requests / contracts : app data

Everything here is derived from the DB - nothing is hardcoded.
"""
from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

import models
from database import engine
from deps import get_current_user, get_db

router = APIRouter(prefix="/api", tags=["analytics"])


# --------------------------------------------------------------------------
# Reliability scoring module
# --------------------------------------------------------------------------

def _reliability_components(row) -> dict:
    """Expose the six reliability factors + the weighted sub-scores."""
    on_time = row.on_time_rate
    late = row.late_rate
    cancel = row.cancel_rate
    complete = row.complete_rate
    overdue = row.avg_overdue_days
    n_orders = row.order_count

    delivery = min(100, on_time * 1.7)
    quality = min(100, complete * 1.35)
    cancel_s = max(0, 100 - cancel * 3)
    history = min(100, 35 + 10 * (n_orders + 1) ** 0.5 / 5)
    punct = max(0, 100 - (overdue - 0.5) * 40)

    return {
        "delivery_history": delivery,
        "product_quality": quality,
        "communication_efficiency": 0.0,   # not present in dataset -> neutral
        "contract_compliance": 0.0,        # not present in dataset -> neutral
        "purchase_history": history,
        "issue_resolution": punct,
        "weights": {
            "delivery_history": 0.30,
            "product_quality": 0.20,
            "purchase_history": 0.15,
            "issue_resolution": 0.15,
            "communication_efficiency": 0.10,
            "contract_compliance": 0.10,
        },
    }


def _recommendations(row) -> list[dict]:
    recs = []
    if row.on_time_rate < 70:
        recs.append({
            "factor": "Delivery History",
            "severity": "high" if row.on_time_rate < 55 else "medium",
            "message": (
                f"On-time delivery is only {row.on_time_rate:.1f}%. "
                f"Investigate late-shipment causes and renegotiate lead times."),
        })
    if row.cancel_rate > 10:
        recs.append({
            "factor": "Issue Resolution",
            "severity": "high" if row.cancel_rate > 20 else "medium",
            "message": (
                f"Cancellation rate of {row.cancel_rate:.1f}% is elevated. "
                f"Review order-acceptance and inventory availability."),
        })
    if row.complete_rate < 50:
        recs.append({
            "factor": "Product Quality",
            "severity": "high" if row.complete_rate < 40 else "medium",
            "message": (
                f"Order completion rate is {row.complete_rate:.1f}%. "
                f"Verify fulfillment capacity and product quality."),
        })
    if row.avg_overdue_days > 1:
        recs.append({
            "factor": "Purchase History",
            "severity": "medium",
            "message": (
                f"Average overdue of {row.avg_overdue_days:.2f} days extends "
                f"delivery windows. Optimize shipping SLAs."),
        })
    if row.order_count < 100:
        recs.append({
            "factor": "Purchase History",
            "severity": "low",
            "message": (
                f"Only {row.order_count} order(s) on record. Build volume "
                f"before relying on this supplier for critical buys."),
        })
    if row.reliability_score >= 80:
        recs.append({
            "factor": "Contract Compliance",
            "severity": "low",
            "message": "Reliable performer - consider preferential status and "
                       "multi-year contract renewal.",
        })
    if not recs:
        recs.append({
            "factor": "Overall",
            "severity": "low",
            "message": "No material risk factors detected.",
        })
    return recs


@router.get("/suppliers")
def list_suppliers(
    category: str | None = None,
    risk: str | None = None,
    q: str | None = None,
    limit: int = Query(200, ge=1, le=1000),
    current_user: models.User = Depends(get_current_user),
):
    """All dataset suppliers with reliability metrics, filterable."""
    sql = """
        SELECT product_card_id, product_name, category_name,
               order_count, total_sales, on_time_rate, late_rate,
               cancel_rate, complete_rate, avg_overdue_days,
               reliability_score, risk_level
        FROM dataset_suppliers
        WHERE 1 = 1
    """
    params = {}
    if category:
        sql += " AND category_name = :cat"
        params["cat"] = category
    if risk:
        sql += " AND risk_level = :risk"
        params["risk"] = risk
    if q:
        sql += " AND product_name LIKE :q"
        params["q"] = f"%{q}%"
    sql += " ORDER BY reliability_score DESC LIMIT :lim"
    params["lim"] = limit

    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/suppliers/ranking")
def supplier_ranking(
    category: str | None = None,
    risk: str | None = None,
    limit: int = Query(20, ge=1, le=200),
    current_user: models.User = Depends(get_current_user),
):
    """Ranked supplier leaderboard for reliability scoring module."""
    sql = """
        SELECT product_card_id, product_name, category_name,
               order_count, total_sales, on_time_rate, late_rate,
               cancel_rate, complete_rate, avg_overdue_days,
               reliability_score, risk_level
        FROM dataset_suppliers
        WHERE 1 = 1
    """
    params = {}
    if category:
        sql += " AND category_name = :cat"
        params["cat"] = category
    if risk:
        sql += " AND risk_level = :risk"
        params["risk"] = risk
    sql += " ORDER BY reliability_score DESC LIMIT :lim"
    params["lim"] = limit

    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()

    result = []
    for idx, r in enumerate(rows, start=1):
        item = dict(r._mapping)
        item["rank"] = idx
        item["components"] = _reliability_components(r)
        result.append(item)
    return result


@router.get("/suppliers/categories")
def supplier_categories(current_user: models.User = Depends(get_current_user)):
    """Distinct supplier categories for filters."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""SELECT category_name, COUNT(*) AS supplier_count
                    FROM dataset_suppliers
                    GROUP BY category_name ORDER BY category_name""")).fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/suppliers/{product_card_id}")
def supplier_detail(
    product_card_id: str,
    current_user: models.User = Depends(get_current_user),
):
    """Full reliability profile + trend + recommendations for one supplier."""
    with engine.connect() as conn:
        row = conn.execute(
            text("""SELECT product_card_id, product_name, category_name,
                           order_count, total_sales, on_time_rate, late_rate,
                           cancel_rate, complete_rate, avg_overdue_days,
                           reliability_score, risk_level
                    FROM dataset_suppliers
                    WHERE product_card_id = :id"""),
            {"id": product_card_id},
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Supplier not found")

        trend_rows = conn.execute(
            text("""SELECT DATE_FORMAT(order_date, '%Y-%m') AS period,
                           COUNT(*) AS n,
                           ROUND(100 * SUM(CASE WHEN late_delivery_risk = 0
                               THEN 1 ELSE 0 END) / COUNT(*), 2) AS on_time_rate,
                           ROUND(SUM(sales), 2) AS sales
                    FROM dataset_orders
                    WHERE product_card_id = :id
                    GROUP BY DATE_FORMAT(order_date, '%Y-%m')
                    ORDER BY period"""),
            {"id": product_card_id},
        ).fetchall()

    trend = [dict(t._mapping) for t in trend_rows]
    data = dict(row._mapping)
    data["components"] = _reliability_components(row)
    data["recommendations"] = _recommendations(row)
    data["trend"] = trend
    return data


# In-memory caching for compute-heavy DataCo aggregations (60s TTL)
_dash_cache = {"data": None, "ts": 0}
_proc_cache = {"data": None, "ts": 0}

@router.get("/analytics/dashboard")
def analytics_dashboard(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import time
    now = time.time()
    if _dash_cache["data"] is not None and (now - _dash_cache["ts"]) < 60:
        # Refresh lightweight dynamic app KPIs
        res = dict(_dash_cache["data"])
        res["kpis"] = {
            "app_vendors": db.query(models.Vendor).count(),
            "app_purchase_orders": db.query(models.PurchaseOrder).count(),
            "app_requests": db.query(models.ProcurementRequest).count(),
            "app_contracts": db.query(models.Contract).count(),
            "contracts_expiring_soon": db.query(models.Contract).filter(
                models.Contract.end_date >= datetime.now(),
                models.Contract.end_date <= datetime.now() + timedelta(days=90),
            ).count(),
        }
        res["generated_at"] = datetime.now().isoformat()
        return res

    with engine.connect() as conn:
        risk_dist = [dict(r._mapping) for r in conn.execute(text("""
            SELECT risk_level, COUNT(*) AS n FROM dataset_suppliers
            GROUP BY risk_level
            ORDER BY FIELD(risk_level, 'Low', 'Medium', 'High')""")).fetchall()]

        spend_by_category = [dict(r._mapping) for r in conn.execute(text("""
            SELECT category_name, ROUND(SUM(sales), 2) AS sales,
                   COUNT(*) AS orders
            FROM dataset_orders GROUP BY category_name
            ORDER BY sales DESC LIMIT 10""")).fetchall()]

        spend_by_market = [dict(r._mapping) for r in conn.execute(text("""
            SELECT market, ROUND(SUM(sales), 2) AS sales, COUNT(*) AS orders
            FROM dataset_orders GROUP BY market ORDER BY sales DESC""")).fetchall()]

        delivery_status = [dict(r._mapping) for r in conn.execute(text("""
            SELECT delivery_status, COUNT(*) AS n FROM dataset_orders
            GROUP BY delivery_status ORDER BY n DESC""")).fetchall()]

        order_status = [dict(r._mapping) for r in conn.execute(text("""
            SELECT order_status, COUNT(*) AS n FROM dataset_orders
            GROUP BY order_status ORDER BY n DESC""")).fetchall()]

        monthly = [dict(r._mapping) for r in conn.execute(text("""
            SELECT DATE_FORMAT(order_date, '%Y-%m') AS period,
                   COUNT(*) AS orders,
                   ROUND(SUM(sales), 2) AS sales,
                   ROUND(100 * SUM(CASE WHEN late_delivery_risk = 0
                       THEN 1 ELSE 0 END) / COUNT(*), 2) AS on_time_rate
            FROM dataset_orders
            GROUP BY DATE_FORMAT(order_date, '%Y-%m')
            ORDER BY period""")).fetchall()]

        top_suppliers = [dict(r._mapping) for r in conn.execute(text("""
            SELECT product_name, category_name, ROUND(total_sales, 2) AS sales,
                   on_time_rate, reliability_score, risk_level
            FROM dataset_suppliers
            ORDER BY total_sales DESC LIMIT 10""")).fetchall()]

        totals = conn.execute(text("""
            SELECT COUNT(*) AS total_orders,
                   ROUND(SUM(sales), 2) AS total_sales,
                   ROUND(AVG(sales), 2) AS avg_order_value,
                   ROUND(100 * SUM(CASE WHEN late_delivery_risk = 0
                       THEN 1 ELSE 0 END) / COUNT(*), 2) AS on_time_rate
            FROM dataset_orders""")).fetchone()

    # App-data KPIs (vendors, POs, PRs, contracts) - over the DB tables
    kpis = {
        "app_vendors": db.query(models.Vendor).count(),
        "app_purchase_orders": db.query(models.PurchaseOrder).count(),
        "app_requests": db.query(models.ProcurementRequest).count(),
        "app_contracts": db.query(models.Contract).count(),
        "contracts_expiring_soon": db.query(models.Contract).filter(
            models.Contract.end_date >= datetime.now(),
            models.Contract.end_date <= datetime.now() + timedelta(days=90),
        ).count(),
    }

    result = {
        "generated_at": datetime.now().isoformat(),
        "totals": dict(totals._mapping),
        "kpis": kpis,
        "risk_distribution": risk_dist,
        "spend_by_category": spend_by_category,
        "spend_by_market": spend_by_market,
        "delivery_status": delivery_status,
        "order_status": order_status,
        "monthly_trend": monthly,
        "top_suppliers": top_suppliers,
    }
    _dash_cache["data"] = result
    _dash_cache["ts"] = now
    return result


# --------------------------------------------------------------------------
# Procurement analytics
# --------------------------------------------------------------------------

@router.get("/analytics/procurement")
def procurement_analytics(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import time
    now = time.time()
    
    if _proc_cache["data"] is not None and (now - _proc_cache["ts"]) < 60:
        res = dict(_proc_cache["data"])
        # Live PO statuses from app DB
        rows = db.query(models.PurchaseOrder.status).all()
        counter = Counter(r[0] for r in rows)
        res["app_purchase_order_status"] = [{"status": k, "n": v} for k, v in counter.items()]
        res["generated_at"] = datetime.now().isoformat()
        return res

    with engine.connect() as conn:
        spend = conn.execute(text("""
            SELECT COUNT(*) AS total_orders,
                   ROUND(SUM(sales), 2) AS total_spend,
                   ROUND(AVG(order_item_total), 2) AS avg_item_total,
                   ROUND(SUM(late_delivery_risk), 0) AS late_orders,
                   ROUND(100 * SUM(CASE WHEN late_delivery_risk = 0
                       THEN 1 ELSE 0 END) / COUNT(*), 2) AS on_time_rate
            FROM dataset_orders""")).fetchone()

        by_category = [dict(r._mapping) for r in conn.execute(text("""
            SELECT category_name, ROUND(SUM(sales), 2) AS spend,
                   COUNT(*) AS orders
            FROM dataset_orders GROUP BY category_name
            ORDER BY spend DESC LIMIT 10""")).fetchall()]

        by_shipping = [dict(r._mapping) for r in conn.execute(text("""
            SELECT shipping_mode, ROUND(SUM(sales), 2) AS spend,
                   COUNT(*) AS orders,
                   ROUND(100 * SUM(CASE WHEN late_delivery_risk = 1
                       THEN 1 ELSE 0 END) / COUNT(*), 2) AS late_rate
            FROM dataset_orders GROUP BY shipping_mode ORDER BY spend DESC""")).fetchall()]

        by_delivery = [dict(r._mapping) for r in conn.execute(text("""
            SELECT delivery_status, COUNT(*) AS n FROM dataset_orders
            GROUP BY delivery_status ORDER BY n DESC""")).fetchall()]

    # Live PO statuses from app DB
    rows = db.query(models.PurchaseOrder.status).all()
    counter = Counter(r[0] for r in rows)
    po_status = [{"status": k, "n": v} for k, v in counter.items()]

    result = {
        "spend_summary": dict(spend._mapping),
        "spend_by_category": by_category,
        "spend_by_shipping_mode": by_shipping,
        "delivery_status": by_delivery,
        "app_purchase_order_status": po_status,
        "generated_at": datetime.now().isoformat(),
    }
    _proc_cache["data"] = result
    _proc_cache["ts"] = now
    return result