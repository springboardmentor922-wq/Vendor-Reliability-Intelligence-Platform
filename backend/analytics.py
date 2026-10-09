"""Live analytics and supplier reliability intelligence."""

from __future__ import annotations

import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, text
from sqlalchemy.orm import Session

import models
from database import engine
from deps import (
    ensure_vendor_scope,
    get_current_user,
    get_db,
    normalize_role,
)

router = APIRouter(prefix="/api", tags=["analytics"])


# DataCo supplier proxy model:
# the source dataset has product identifiers, not vendor identities.
# The UI labels this data explicitly as historical proxy intelligence.
def _reliability_components(row) -> dict:
    on_time = float(row.on_time_rate or 0)
    cancel = float(row.cancel_rate or 0)
    complete = float(row.complete_rate or 0)
    overdue = float(row.avg_overdue_days or 0)
    n_orders = int(row.order_count or 0)

    delivery = min(100.0, on_time * 1.7)
    quality = min(100.0, complete * 1.35)
    cancellation = max(0.0, 100.0 - cancel * 3.0)
    history = min(100.0, 35.0 + 2.0 * ((n_orders + 1) ** 0.5))
    punctuality = max(
        0.0,
        min(
            100.0,
            100.0 - max(0.0, overdue - 0.5) * 40.0,
        ),
    )

    score = (
        delivery * 0.35
        + quality * 0.20
        + cancellation * 0.15
        + history * 0.15
        + punctuality * 0.15
    )

    return {
        "delivery_history": round(delivery, 2),
        "product_quality": round(quality, 2),
        "cancellation_control": round(cancellation, 2),
        "purchase_history": round(history, 2),
        "punctuality": round(punctuality, 2),
        "weighted_score": round(score, 2),
        "communication_efficiency": None,
        "contract_compliance": None,
        "weights": {
            "delivery_history": 0.35,
            "product_quality": 0.20,
            "cancellation_control": 0.15,
            "purchase_history": 0.15,
            "punctuality": 0.15,
        },
        "unavailable_factors": [
            "communication_efficiency",
            "contract_compliance",
        ],
    }


def _recommendations(row) -> list[dict]:
    recs = []

    if (row.on_time_rate or 0) < 70:
        recs.append(
            {
                "factor": "Delivery History",
                "severity": ("high" if row.on_time_rate < 55 else "medium"),
                "message": (
                    f"On-time delivery is {row.on_time_rate:.1f}%. "
                    "Investigate late shipment causes and SLA assumptions."
                ),
            }
        )

    if (row.cancel_rate or 0) > 10:
        recs.append(
            {
                "factor": "Cancellation Control",
                "severity": ("high" if row.cancel_rate > 20 else "medium"),
                "message": (
                    f"Cancellation rate is {row.cancel_rate:.1f}%. "
                    "Review inventory and order acceptance controls."
                ),
            }
        )

    if (row.complete_rate or 0) < 50:
        recs.append(
            {
                "factor": "Product Quality",
                "severity": ("high" if row.complete_rate < 40 else "medium"),
                "message": (
                    f"Completion rate is {row.complete_rate:.1f}%. "
                    "Verify fulfillment capacity and quality checks."
                ),
            }
        )

    if (row.avg_overdue_days or 0) > 1:
        recs.append(
            {
                "factor": "Punctuality",
                "severity": "medium",
                "message": (
                    f"Average overdue duration is "
                    f"{row.avg_overdue_days:.2f} days. "
                    "Review logistics lead times."
                ),
            }
        )

    if (row.order_count or 0) < 100:
        recs.append(
            {
                "factor": "Purchase History",
                "severity": "low",
                "message": (
                    f"Only {row.order_count} historical records are "
                    "available; treat the score as lower-confidence intelligence."
                ),
            }
        )

    if not recs:
        recs.append(
            {
                "factor": "Overall",
                "severity": "low",
                "message": (
                    "No material historical risk signals detected "
                    "in the available dataset."
                ),
            }
        )

    return recs


def _dataset_available() -> bool:
    try:
        with engine.connect() as conn:
            return (
                conn.execute(
                    text("SELECT to_regclass('public.dataset_orders')")
                ).scalar()
                is not None
            )
    except Exception:
        return False


@router.get("/suppliers")
def list_suppliers(
    category: str | None = None,
    risk: str | None = None,
    q: str | None = None,
    limit: int = Query(200, ge=1, le=1000),
    current_user: models.User = Depends(get_current_user),
):
    if not _dataset_available():
        return []

    sql = """
        SELECT
            product_card_id,
            product_name,
            category_name,
            order_count,
            total_sales,
            on_time_rate,
            late_rate,
            cancel_rate,
            complete_rate,
            avg_overdue_days,
            reliability_score,
            risk_level
        FROM dataset_suppliers
        WHERE TRUE
    """

    params = {}

    if category:
        sql += " AND category_name = :category"
        params["category"] = category

    if risk:
        sql += " AND risk_level = :risk"
        params["risk"] = risk

    if q:
        sql += " AND product_name ILIKE :q"
        params["q"] = f"%{q.strip()}%"

    sql += """
        ORDER BY reliability_score DESC NULLS LAST
        LIMIT :limit
    """
    params["limit"] = limit

    with engine.connect() as conn:
        rows = conn.execute(
            text(sql),
            params,
        ).fetchall()

    return [dict(row._mapping) for row in rows]


@router.get("/suppliers/ranking")
def supplier_ranking(
    category: str | None = None,
    risk: str | None = None,
    limit: int = Query(20, ge=1, le=200),
    current_user: models.User = Depends(get_current_user),
):
    rows = list_suppliers(
        category,
        risk,
        None,
        limit,
        current_user,
    )

    result = []

    for idx, item in enumerate(rows, 1):

        class Row:
            pass

        row = Row()

        for key, value in item.items():
            setattr(row, key, value)

        item["rank"] = idx
        item["components"] = _reliability_components(row)
        item["recommendations"] = _recommendations(row)

        result.append(item)

    return result


@router.get("/suppliers/categories")
def supplier_categories(
    current_user: models.User = Depends(get_current_user),
):
    if not _dataset_available():
        return []

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    category_name,
                    COUNT(*) AS supplier_count
                FROM dataset_suppliers
                GROUP BY category_name
                ORDER BY category_name
                """
            )
        ).fetchall()

    return [dict(row._mapping) for row in rows]


@router.get("/suppliers/{product_card_id}")
def supplier_detail(
    product_card_id: str,
    current_user: models.User = Depends(get_current_user),
):
    if not _dataset_available():
        raise HTTPException(
            status_code=404,
            detail="Historical supplier intelligence is not loaded",
        )

    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                    product_card_id,
                    product_name,
                    category_name,
                    order_count,
                    total_sales,
                    on_time_rate,
                    late_rate,
                    cancel_rate,
                    complete_rate,
                    avg_overdue_days,
                    reliability_score,
                    risk_level
                FROM dataset_suppliers
                WHERE product_card_id = :id
                """
            ),
            {"id": product_card_id},
        ).fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Supplier intelligence record not found",
            )

        trend_rows = conn.execute(
            text(
                """
                SELECT
                    TO_CHAR(order_date, 'YYYY-MM') AS period,
                    COUNT(*) AS n,
                    ROUND(
                        100.0 * SUM(
                            CASE
                                WHEN late_delivery_risk = 0
                                THEN 1
                                ELSE 0
                            END
                        ) / NULLIF(COUNT(*), 0),
                        2
                    ) AS on_time_rate,
                    ROUND(
                        SUM(sales)::numeric,
                        2
                    ) AS sales
                FROM dataset_orders
                WHERE product_card_id = :id
                GROUP BY TO_CHAR(order_date, 'YYYY-MM')
                ORDER BY period
                """
            ),
            {"id": product_card_id},
        ).fetchall()

    data = dict(row._mapping)

    data["components"] = _reliability_components(row)
    data["recommendations"] = _recommendations(row)
    data["trend"] = [dict(item._mapping) for item in trend_rows]

    data["provenance"] = (
        "DataCo historical dataset; product-level records used as "
        "supplier proxies because the source does not contain vendor identities."
    )

    return data


_dash_cache = {
    "data": None,
    "ts": 0.0,
}

_proc_cache = {
    "data": None,
    "ts": 0.0,
}


@router.get("/analytics/dashboard")
def analytics_dashboard(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = time.time()

    if _dash_cache["data"] is not None and now - _dash_cache["ts"] < 30:
        return _dash_cache["data"]

    data = {
        "source": "live_database",
        "dataset_loaded": _dataset_available(),
        "historical": {},
        "operational": {},
    }

    if _dataset_available():
        with engine.connect() as conn:
            # dataset_suppliers does not have a `sales` column.
            # It stores aggregate sales in `total_sales` and
            # historical order volume in `order_count`.
            historical = (
                conn.execute(
                    text(
                        """
                        SELECT
                            COALESCE(
                                SUM(order_count),
                                0
                            ) AS total_orders,

                            COALESCE(
                                SUM(total_sales),
                                0
                            ) AS total_sales,

                            COALESCE(
                                SUM(total_sales)
                                / NULLIF(SUM(order_count), 0),
                                0
                            ) AS average_order_value,

                            COALESCE(
                                AVG(on_time_rate),
                                0
                            ) AS avg_on_time_rate,

                            COALESCE(
                                AVG(reliability_score),
                                0
                            ) AS avg_reliability

                        FROM dataset_suppliers
                        """
                    )
                )
                .mappings()
                .first()
                or {}
            )

            monthly = (
                conn.execute(
                    text(
                        """
                        SELECT
                            TO_CHAR(
                                order_date,
                                'YYYY-MM'
                            ) AS month,

                            COUNT(*) AS orders,

                            ROUND(
                                100.0 * SUM(
                                    CASE
                                        WHEN late_delivery_risk = 0
                                        THEN 1
                                        ELSE 0
                                    END
                                )
                                / NULLIF(COUNT(*), 0),
                                2
                            ) AS on_time_rate,

                            ROUND(
                                COALESCE(
                                    SUM(sales),
                                    0
                                )::numeric,
                                2
                            ) AS sales

                        FROM dataset_orders

                        GROUP BY TO_CHAR(
                            order_date,
                            'YYYY-MM'
                        )

                        ORDER BY month
                        """
                    )
                )
                .mappings()
                .all()
            )

            risk = (
                conn.execute(
                    text(
                        """
                        SELECT
                            risk_level,
                            COUNT(*) AS count
                        FROM dataset_suppliers
                        GROUP BY risk_level
                        ORDER BY risk_level
                        """
                    )
                )
                .mappings()
                .all()
            )

            categories = (
                conn.execute(
                    text(
                        """
                        SELECT
                            category_name,
                            ROUND(
                                COALESCE(
                                    SUM(total_sales),
                                    0
                                )::numeric,
                                2
                            ) AS sales
                        FROM dataset_suppliers
                        GROUP BY category_name
                        ORDER BY sales DESC
                        LIMIT 8
                        """
                    )
                )
                .mappings()
                .all()
            )

            data["historical"] = dict(historical)

            data["historical"]["monthly"] = [dict(row) for row in monthly]

            data["historical"]["risk_distribution"] = [dict(row) for row in risk]

            data["historical"]["category_spend"] = [dict(row) for row in categories]

    po_query = db.query(models.PurchaseOrder)

    if normalize_role(current_user.role) == "vendor":
        po_query = po_query.filter(
            models.PurchaseOrder.vendor_id == current_user.vendor_id
        )

    data["operational"] = {
        "purchase_orders": po_query.count(),
        "spend": float(
            po_query.with_entities(
                func.coalesce(
                    func.sum(models.PurchaseOrder.total_amount),
                    0,
                )
            ).scalar()
            or 0
        ),
    }

    data["generated_at"] = datetime.utcnow().isoformat()

    _dash_cache.update(
        {
            "data": data,
            "ts": now,
        }
    )

    return data


@router.get("/analytics/procurement")
def procurement_analytics(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = time.time()

    if _proc_cache["data"] is not None and now - _proc_cache["ts"] < 30:
        return _proc_cache["data"]

    role = normalize_role(current_user.role)

    po = db.query(models.PurchaseOrder)

    if role == "vendor":
        po = po.filter(models.PurchaseOrder.vendor_id == current_user.vendor_id)

    requests = db.query(models.ProcurementRequest)

    if role not in {
        "administrator",
        "procurement_manager",
        "supply_chain_manager",
        "auditor",
    }:
        requests = requests.filter(
            models.ProcurementRequest.requested_by == current_user.id
        )

    statuses = db.query(
        models.PurchaseOrder.status,
        text("COUNT(*)"),
    ).group_by(models.PurchaseOrder.status)

    if role == "vendor":
        statuses = statuses.filter(
            models.PurchaseOrder.vendor_id == current_user.vendor_id
        )

    lifecycle = [
        {
            "status": row[0],
            "count": row[1],
        }
        for row in statuses.all()
    ]

    monthly = (
        db.execute(
            text(
                """
                SELECT
                    TO_CHAR(
                        order_date,
                        'YYYY-MM'
                    ) AS month,

                    COUNT(*) AS orders,

                    COALESCE(
                        SUM(total_amount),
                        0
                    ) AS spend

                FROM purchase_orders

                GROUP BY TO_CHAR(
                    order_date,
                    'YYYY-MM'
                )

                ORDER BY month
                """
            )
        )
        .mappings()
        .all()
    )

    data = {
        "requests": requests.count(),
        "purchase_orders": po.count(),
        "spend": float(
            po.with_entities(
                func.coalesce(
                    func.sum(models.PurchaseOrder.total_amount),
                    0,
                )
            ).scalar()
            or 0
        ),
        "approval_backlog": po.filter(models.PurchaseOrder.status == "Pending").count(),
        "lifecycle": lifecycle,
        "monthly": [dict(row) for row in monthly],
        "generated_at": datetime.utcnow().isoformat(),
    }

    _proc_cache.update(
        {
            "data": data,
            "ts": now,
        }
    )

    return data
