"""Chart-ready payloads for the Procurement, Vendor and Administrator dashboards.

Each endpoint returns exactly what one dashboard renders - KPI tiles with
their period-over-period change, and one block per chart - so the screen can
draw every mandatory chart from a single request. All figures are aggregated
in SQL from the operational tables at request time; nothing is cached or
hard-coded.

``/dashboards/live`` is a cheap change-detection probe. The dashboards poll it
every few seconds and only re-fetch their full payload when the data
underneath has actually changed, which is what makes them live without
hammering the database.
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, case, func, or_, text
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import get_current_user, require_admin, vendor_scope
from models import (
    ActivityLog,
    ComplianceCheck,
    Contract,
    ContractStatus,
    Message,
    MessageAttachment,
    MessageThread,
    Notification,
    ProcurementRequest,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatus,
    User,
    UserRole,
    Vendor,
    VendorCertification,
    VendorReliabilityScore,
    VendorStatus,
)
from services import analytics as A
from services import monitoring
from services.performance import performance_trend
from services.reliability import latest_scores, score_history

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])

OPEN_STATUSES = [
    PurchaseOrderStatus.PENDING,
    PurchaseOrderStatus.APPROVED,
    PurchaseOrderStatus.ORDERED,
]

FACTORS = [
    ("delivery_score", "Delivery"),
    ("quality_score", "Quality"),
    ("communication_score", "Communication"),
    ("compliance_score", "Compliance"),
    ("purchase_history_score", "Purchase History"),
    ("issue_resolution_score", "Issue Resolution"),
]


# --------------------------------------------------------------------------
# Filters and small helpers
# --------------------------------------------------------------------------

def _filters(
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    vendor_id: Optional[int] = Query(default=None),
    category: Optional[str] = Query(default=None),
    risk_level: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
) -> A.Filters:
    scope = vendor_scope(current_user)
    return A.Filters(
        start=start,
        end=end,
        vendor_id=scope if scope is not None else vendor_id,
        category=category,
        risk_level=risk_level,
    )


def _windowed(f: A.Filters, start: date, end: date) -> A.Filters:
    """Same filter set, re-anchored to a different date window."""

    return A.Filters(
        start=start,
        end=end,
        vendor_id=f.vendor_id,
        category=f.category,
        risk_level=f.risk_level,
        status=f.status,
    )


def _windows(f: A.Filters) -> tuple[A.Filters, A.Filters]:
    """The last 30 days of the selection and the 30 days before them."""

    anchor = f.end or date.today()
    current = _windowed(f, anchor - timedelta(days=29), anchor)
    previous = _windowed(f, anchor - timedelta(days=59), anchor - timedelta(days=30))
    return current, previous


def _delta(current: float, previous: float) -> Optional[float]:
    # No prior-period baseline -> no percentage (a jump from zero is not "+100%").
    if not previous:
        return None
    return round(100.0 * (current - previous) / previous, 1)


def _f(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _kpi(key: str, label: str, value, delta: Optional[float], hint: str, fmt: str = "number", good_when_up: bool = True) -> dict:
    return {
        "key": key,
        "label": label,
        "value": value,
        "delta_pct": delta,
        "hint": hint,
        "format": fmt,
        "good_when_up": good_when_up,
    }


def _order_totals(db: Session, f: A.Filters) -> tuple[int, float]:
    query = db.query(
        func.count(PurchaseOrder.id),
        func.coalesce(
            func.sum(
                case(
                    (PurchaseOrder.status == PurchaseOrderStatus.CANCELLED, 0),
                    else_=PurchaseOrder.total_amount,
                )
            ),
            0,
        ),
    ).join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
    count, value = f.apply_orders(query).one()
    return int(count or 0), _f(value)


def _items_procured(db: Session, f: A.Filters) -> float:
    query = (
        db.query(func.coalesce(func.sum(PurchaseOrderItem.quantity), 0))
        .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.purchase_order_id)
        .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
        .filter(PurchaseOrder.status != PurchaseOrderStatus.CANCELLED)
    )
    return _f(f.apply_orders(query).scalar())


def _scoped_vendor_ids(db: Session, f: A.Filters) -> set[int]:
    return {row[0] for row in f.apply_vendors(db.query(Vendor.id)).all()}


def _activity_feed(db: Session, scope: Optional[int], limit: int = 12) -> list[dict]:
    query = db.query(ActivityLog)

    if scope is not None:
        own_orders = [r[0] for r in db.query(PurchaseOrder.id).filter(PurchaseOrder.vendor_id == scope).all()]
        own_contracts = [r[0] for r in db.query(Contract.id).filter(Contract.vendor_id == scope).all()]
        query = query.filter(
            or_(
                and_(ActivityLog.entity_type == "Vendor", ActivityLog.entity_id == scope),
                and_(ActivityLog.entity_type == "PurchaseOrder", ActivityLog.entity_id.in_(own_orders or [-1])),
                and_(ActivityLog.entity_type == "Contract", ActivityLog.entity_id.in_(own_contracts or [-1])),
            )
        )

    return [
        {
            "id": row.id,
            "user_name": row.user.name if row.user else "System",
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "action": row.action,
            "description": row.description,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in query.order_by(ActivityLog.id.desc()).limit(limit).all()
    ]


def _open_orders(db: Session, f: A.Filters, limit: int = 8) -> list[dict]:
    today = date.today()
    query = (
        db.query(PurchaseOrder)
        .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
        .filter(PurchaseOrder.status.in_(OPEN_STATUSES))
    )
    query = f.apply_orders(query)

    rows = query.order_by(PurchaseOrder.expected_delivery.asc().nullslast()).limit(limit).all()

    return [
        {
            "id": po.id,
            "po_number": po.po_number,
            "vendor_id": po.vendor_id,
            "vendor_name": po.vendor.vendor_name if po.vendor else None,
            "title": po.title,
            "total_amount": _f(po.total_amount),
            "currency": po.currency,
            "status": po.status,
            "order_date": po.order_date.isoformat() if po.order_date else None,
            "expected_delivery": po.expected_delivery.isoformat() if po.expected_delivery else None,
            "days_late": max((today - po.expected_delivery).days, 0) if po.expected_delivery else 0,
        }
        for po in rows
    ]


# --------------------------------------------------------------------------
# Procurement dashboard
# --------------------------------------------------------------------------

@router.get("/procurement")
def procurement_dashboard(
    months: int = Query(default=6, ge=3, le=24),
    f: A.Filters = Depends(_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current, previous = _windows(f)

    po_count, po_value = _order_totals(db, f)
    cur_count, cur_value = _order_totals(db, current)
    prev_count, prev_value = _order_totals(db, previous)

    items = _items_procured(db, f)
    items_delta = _delta(_items_procured(db, current), _items_procured(db, previous))

    approved_now = f.apply_vendors(db.query(func.count(Vendor.id)).filter(Vendor.status == VendorStatus.APPROVED)).scalar() or 0
    month_ago = datetime.combine(current.start, datetime.min.time()).replace(tzinfo=timezone.utc)
    approved_before = f.apply_vendors(
        db.query(func.count(Vendor.id)).filter(
            Vendor.status == VendorStatus.APPROVED,
            or_(Vendor.approved_at.is_(None), Vendor.approved_at < month_ago),
        )
    ).scalar() or 0
    ordering_vendors = (
        current.apply_orders(
            db.query(func.count(func.distinct(PurchaseOrder.vendor_id))).join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
        ).scalar()
        or 0
    )

    overview = A.procurement_overview(db, f)
    orders = A.purchase_order_overview(db, f)
    delivery = A.delivery_status(db, f)
    performance = A.vendor_performance_summary(db, f)
    cost = A.cost_analysis(db, f)
    spend = A.spend_over_time(db, f, months=months)

    kpis = [
        _kpi("total_purchase_orders", "Total Purchase Orders", po_count, _delta(cur_count, prev_count),
             f"{cur_count:,} raised in the last 30 days"),
        _kpi("total_procurement_cost", "Total Procurement Cost", round(po_value, 2), _delta(cur_value, prev_value),
             "Excludes cancelled orders", "currency", good_when_up=False),
        _kpi("active_vendors", "Active Vendors", int(approved_now), _delta(approved_now, approved_before),
             f"{ordering_vendors} received orders in the last 30 days"),
        _kpi("items_procured", "Items Procured", round(items), items_delta, "Units across all order lines"),
    ]

    # ---- Active purchase orders donut ---------------------------------
    by_status = orders["by_status"]
    active_po = [
        {"label": "Pending Approval", "value": by_status.get(PurchaseOrderStatus.PENDING, 0), "status": PurchaseOrderStatus.PENDING},
        {"label": "Approved", "value": by_status.get(PurchaseOrderStatus.APPROVED, 0), "status": PurchaseOrderStatus.APPROVED},
        {"label": "In Progress", "value": by_status.get(PurchaseOrderStatus.ORDERED, 0), "status": PurchaseOrderStatus.ORDERED},
        {"label": "Delivered", "value": by_status.get(PurchaseOrderStatus.DELIVERED, 0), "status": PurchaseOrderStatus.DELIVERED},
        {"label": "Completed", "value": by_status.get(PurchaseOrderStatus.COMPLETED, 0), "status": PurchaseOrderStatus.COMPLETED},
        {"label": "Cancelled", "value": by_status.get(PurchaseOrderStatus.CANCELLED, 0), "status": PurchaseOrderStatus.CANCELLED},
    ]

    # ---- Vendor performance radar: top vendor vs average ---------------
    scores = latest_scores(db)
    allowed = _scoped_vendor_ids(db, f)
    approved_ids = {
        row[0] for row in db.query(Vendor.id).filter(Vendor.status == VendorStatus.APPROVED).all()
    }
    pool = [s for vid, s in scores.items() if vid in allowed and vid in approved_ids]
    # Provisional scores (too few orders) are not eligible to be "top vendor".
    ranked_pool = [s for s in pool if s.rank_position is not None]
    names = dict(db.query(Vendor.id, Vendor.vendor_name).all())

    radar = {"axes": [label for _, label in FACTORS], "top_vendor": None, "average": []}
    if pool:
        top = max(ranked_pool or pool, key=lambda s: _f(s.overall_score))
        radar["top_vendor"] = {
            "vendor_id": top.vendor_id,
            "vendor_name": names.get(top.vendor_id),
            "overall_score": _f(top.overall_score),
            "values": [round(_f(getattr(top, attr)), 1) for attr, _ in FACTORS],
        }
        radar["average"] = [
            round(sum(_f(getattr(s, attr)) for s in pool) / len(pool), 1) for attr, _ in FACTORS
        ]

    # ---- Delivery status gauge ----------------------------------------
    delivered_on_time = delivery["on_time_deliveries"]
    delivery_breakdown = [
        {"label": "Delivered On Time", "value": delivered_on_time},
        {"label": "In Transit", "value": delivery["pending_deliveries"]},
        {"label": "Delayed", "value": delivery["delayed_deliveries"]},
        {"label": "Cancelled", "value": orders["cancelled_orders"]},
    ]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filters": f.as_dict(),
        "kpis": kpis,
        "procurement_overview": {
            "series": [
                {"period": row["period"], "cost": round(row["spend"], 2), "orders": row["orders"]}
                for row in spend
            ],
            "total_requests": overview["total_requests"],
            "pending_requests": overview["pending_requests"],
            "approved_requests": overview["approved_requests"],
            "completed_requests": overview["completed_requests"],
            "procurement_value": overview["procurement_value"],
            "completion_rate": overview["completion_rate"],
        },
        "active_purchase_orders": {
            "slices": active_po,
            "active_total": orders["active_orders"],
            "pending": orders["pending_orders"],
            "in_transit": orders["in_transit_orders"],
            "overdue": orders["overdue_orders"],
            "active_value": orders["active_po_value"],
            "list": _open_orders(db, f),
        },
        "vendor_performance": {
            "radar": radar,
            "performance_score": performance["performance_score"],
            "quality_rating": performance["quality_rating"],
            "on_time_delivery_rate": performance["on_time_delivery_rate"],
            "avg_response_time_hours": performance["avg_response_time_hours"],
            "issue_resolution_rate": performance["issue_resolution_rate"],
            "order_completion_rate": performance["order_completion_rate"],
        },
        "cost_analysis": {
            "total_cost": cost["total_cost"],
            "budget": cost["budget"],
            "actual": cost["actual"],
            "variance": cost["cost_variance"],
            "variance_pct": cost["cost_variance_pct"],
            "by_category": cost["by_category"],
            "by_vendor": cost["by_vendor"][:6],
        },
        "delivery_status": {
            "on_time_rate": delivery["delivery_rate"],
            "total_deliveries": delivery["total_deliveries"],
            "on_time": delivered_on_time,
            "delayed": delivery["delayed_deliveries"],
            "pending": delivery["pending_deliveries"],
            "breakdown": delivery_breakdown,
        },
        "recent_activity": _activity_feed(db, vendor_scope(current_user), 10),
    }


# --------------------------------------------------------------------------
# Vendor dashboard
# --------------------------------------------------------------------------

@router.get("/vendor")
def vendor_dashboard(
    f: A.Filters = Depends(_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    scope = vendor_scope(current_user)
    scores = latest_scores(db)
    vendors = {v.id: v for v in db.query(Vendor).all()}

    vendor_id = f.vendor_id
    if vendor_id is None:
        # Internal users land on the best-ranked approved vendor.
        ranked = sorted(
            (s for vid, s in scores.items() if vendors.get(vid) and vendors[vid].status == VendorStatus.APPROVED),
            key=lambda s: _f(s.overall_score),
            reverse=True,
        )
        vendor_id = ranked[0].vendor_id if ranked else next(iter(vendors), None)

    if vendor_id is None or vendor_id not in vendors:
        raise HTTPException(status_code=404, detail="No vendor available for the vendor dashboard")

    vendor = vendors[vendor_id]
    vf = A.Filters(start=f.start, end=f.end, vendor_id=vendor_id)
    current, previous = _windows(vf)

    history = score_history(db, vendor_id, limit=24)
    latest = history[-1] if history else None
    prior = history[-2] if len(history) > 1 else None

    performance = A.vendor_performance_summary(db, vf)
    contracts = A.contract_status(db, vf)
    orders = A.order_history(db, vf)
    communication = A.communication_activity(db, vf)
    delivery = A.delivery_status(db, vf)
    trend = performance_trend(db, vendor_id, months=6)

    cur_orders, _ = _order_totals(db, current)
    prev_orders, _ = _order_totals(db, previous)

    new_contracts_now = db.query(func.count(Contract.id)).filter(
        Contract.vendor_id == vendor_id, Contract.start_date >= current.start
    ).scalar() or 0

    kpis = [
        _kpi("performance_score", "Performance Score", performance["performance_score"],
             _delta(latest["overall_score"], prior["overall_score"]) if latest and prior else None,
             "Composite of delivery, quality, responsiveness", "score"),
        _kpi("reliability_score", "Reliability Score", latest["overall_score"] if latest else None,
             round(latest["overall_score"] - prior["overall_score"], 1) if latest and prior else None,
             f"Risk: {latest['risk_level']} · {latest['trend']}" if latest else "Not scored yet", "score"),
        _kpi("active_contracts", "Active Contracts", contracts["active_contracts"] + contracts["expiring_contracts"],
             None, f"{new_contracts_now} started in the last 30 days"),
        _kpi("total_orders", "Total Orders", orders["total_orders"], _delta(cur_orders, prev_orders),
             f"{cur_orders} in the last 30 days"),
    ]
    # Reliability delta is in points rather than percent.
    kpis[1]["delta_unit"] = "pts"

    # ---- Grouped factor bars ------------------------------------------
    bar_series = [("delivery_score", "Delivery"), ("quality_score", "Quality"),
                  ("communication_score", "Communication"), ("compliance_score", "Compliance")]

    if scope is not None:
        # A supplier only ever sees its own history.
        groups = [
            {
                "label": datetime.fromisoformat(h["score_date"]).strftime("%b %y"),
                "values": [round(h[k], 1) for k, _ in bar_series],
            }
            for h in history[-6:]
        ]
        group_mode = "months"
    else:
        peers = sorted(
            (
                s for vid, s in scores.items()
                if vendors.get(vid) and vendors[vid].category == vendor.category
                and vendors[vid].status == VendorStatus.APPROVED and vid != vendor_id
            ),
            key=lambda s: _f(s.overall_score),
            reverse=True,
        )[:4]
        chosen = ([scores[vendor_id]] if vendor_id in scores else []) + peers
        groups = [
            {
                "label": vendors[s.vendor_id].vendor_name,
                "vendor_id": s.vendor_id,
                "values": [round(_f(getattr(s, k)), 1) for k, _ in bar_series],
            }
            for s in chosen
        ]
        group_mode = "peers"

    # ---- Contract status donut ----------------------------------------
    cs = contracts["by_status"]
    contract_slices = [
        {"label": "Active", "value": cs.get(ContractStatus.ACTIVE, 0)},
        {"label": "Expiring Soon", "value": cs.get(ContractStatus.EXPIRING, 0)},
        {"label": "Renewed", "value": cs.get(ContractStatus.RENEWED, 0)},
        {"label": "Expired", "value": cs.get(ContractStatus.EXPIRED, 0)},
        {"label": "Draft", "value": cs.get(ContractStatus.DRAFT, 0)},
        {"label": "Terminated", "value": cs.get(ContractStatus.TERMINATED, 0)},
    ]

    # ---- Communication activity donut ---------------------------------
    thread_ids = [r[0] for r in db.query(MessageThread.id).filter(MessageThread.vendor_id == vendor_id).all()]
    vendor_user_ids = [r[0] for r in db.query(User.id).filter(User.vendor_id == vendor_id).all()]
    attachments = (
        db.query(func.count(MessageAttachment.id))
        .join(Message, Message.id == MessageAttachment.message_id)
        .filter(Message.thread_id.in_(thread_ids or [-1]))
        .scalar()
        or 0
    )
    vendor_replies = (
        db.query(func.count(Message.id))
        .filter(Message.thread_id.in_(thread_ids or [-1]), Message.sender_id.in_(vendor_user_ids or [-1]))
        .scalar()
        or 0
    )
    notifications = (
        db.query(func.count(Notification.id)).filter(Notification.user_id.in_(vendor_user_ids or [-1])).scalar() or 0
    )
    comm_slices = [
        {"label": "Messages from Buyer", "value": max(communication["total_messages"] - vendor_replies, 0)},
        {"label": "Vendor Replies", "value": int(vendor_replies)},
        {"label": "Open Queries", "value": communication["open_queries"]},
        {"label": "Resolved Queries", "value": communication["resolved_queries"]},
        {"label": "Files Shared", "value": int(attachments)},
        {"label": "Notifications", "value": int(notifications)},
    ]

    snapshot = scores.get(vendor_id)

    recent_orders = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.vendor_id == vendor_id)
        .order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.id.desc())
        .limit(8)
        .all()
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "vendor": {
            "id": vendor.id,
            "vendor_code": vendor.vendor_code,
            "vendor_name": vendor.vendor_name,
            "category": vendor.category,
            "status": vendor.status,
            "risk_level": vendor.risk_level,
            "city": vendor.city,
            "country": vendor.country,
        },
        "kpis": kpis,
        "vendor_performance": {
            "mode": group_mode,
            "series": [label for _, label in bar_series],
            "groups": groups,
            "on_time_delivery_rate": performance["on_time_delivery_rate"],
            "quality_rating": performance["quality_rating"],
            "avg_response_time_hours": performance["avg_response_time_hours"],
            "avg_issue_resolution_hours": performance["avg_issue_resolution_hours"],
            "order_completion_rate": performance["order_completion_rate"],
        },
        "reliability": {
            "trend": [
                {"date": h["score_date"], "score": round(h["overall_score"], 1), "risk_level": h["risk_level"]}
                for h in history[-12:]
            ],
            "current": {
                "overall": _f(snapshot.overall_score) if snapshot else None,
                "factors": [
                    {"label": label, "value": round(_f(getattr(snapshot, attr)), 1)} for attr, label in FACTORS
                ] if snapshot else [],
                "risk_level": snapshot.risk_level if snapshot else vendor.risk_level,
                "trend": snapshot.trend if snapshot else None,
                "rank_position": snapshot.rank_position if snapshot else None,
                "recommendation": snapshot.recommendation if snapshot else None,
                "predicted_delay_risk": _f(snapshot.predicted_delay_risk) if snapshot and snapshot.predicted_delay_risk is not None else None,
            },
        },
        "contract_status": {
            "slices": contract_slices,
            "total": contracts["total_contracts"],
            "compliance_rate": contracts["compliance_rate"],
            "compliant": contracts["compliant_contracts"],
            "non_compliant": contracts["non_compliant_contracts"],
            "expiring_soon": contracts["expiring_soon"][:5],
        },
        "order_history": {
            "series": [
                {"period": row["period"], "value": round(_f(row.get("spend")), 2), "orders": row.get("orders", 0)}
                for row in trend
            ],
            "total_orders": orders["total_orders"],
            "completed": orders["completed_orders"],
            "pending": orders["pending_orders"],
            "cancelled": orders["cancelled_orders"],
            "delayed": orders["delayed_orders"],
            "order_value": orders["order_value"],
            "recent": [
                {
                    "id": po.id,
                    "po_number": po.po_number,
                    "title": po.title,
                    "status": po.status,
                    "total_amount": _f(po.total_amount),
                    "currency": po.currency,
                    "order_date": po.order_date.isoformat() if po.order_date else None,
                    "expected_delivery": po.expected_delivery.isoformat() if po.expected_delivery else None,
                }
                for po in recent_orders
            ],
        },
        "communication": {
            "slices": comm_slices,
            "total_messages": communication["total_messages"],
            "open_queries": communication["open_queries"],
            "resolved_queries": communication["resolved_queries"],
            "avg_response_hours": communication["avg_response_hours"],
            "resolution_rate": communication["resolution_rate"],
        },
        "delivery": delivery,
        "recent_activity": _vendor_events(db, vendor_id, 8),
    }


def _vendor_events(db: Session, vendor_id: int, limit: int = 8) -> list[dict]:
    """Activity-log entries for a vendor, topped up with its order milestones.

    Orders loaded from the dataset history carry dates but no activity-log
    rows, so the most recent order placements and deliveries are added as
    events (dated by the order / delivery date) to keep the feed meaningful.
    """

    events = _activity_feed(db, vendor_id, limit)
    if len(events) >= limit:
        return events

    orders = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.vendor_id == vendor_id)
        .order_by(func.coalesce(PurchaseOrder.actual_delivery, PurchaseOrder.order_date).desc())
        .limit(limit)
        .all()
    )
    for po in orders:
        delivered = po.actual_delivery is not None
        when = po.actual_delivery if delivered else po.order_date
        late = delivered and po.expected_delivery and po.actual_delivery > po.expected_delivery
        events.append({
            "id": -po.id,
            "user_name": "Order tracking",
            "entity_type": "PurchaseOrder",
            "entity_id": po.id,
            "action": ("Delivered late" if late else "Delivered") if delivered else f"Order {po.status.lower()}",
            "description": f"{po.po_number} · {po.title or 'order'} · {po.currency} {_f(po.total_amount):,.2f}",
            "created_at": datetime.combine(when, datetime.min.time()).replace(tzinfo=timezone.utc).isoformat() if when else None,
        })

    events.sort(key=lambda e: e["created_at"] or "", reverse=True)
    return events[:limit]


# --------------------------------------------------------------------------
# Administrator dashboard
# --------------------------------------------------------------------------

def _compliance_classes(db: Session, f: A.Filters) -> tuple[list[dict], list[dict]]:
    today = date.today()
    horizon = today + timedelta(days=settings.CERTIFICATION_ALERT_DAYS)
    vendor_rows = f.apply_vendors(db.query(Vendor)).filter(Vendor.status != VendorStatus.REJECTED).all()

    latest_check_date = (
        db.query(ComplianceCheck.vendor_id, func.max(ComplianceCheck.check_date).label("d"))
        .group_by(ComplianceCheck.vendor_id)
        .subquery()
    )
    latest_results = dict(
        db.query(ComplianceCheck.vendor_id, ComplianceCheck.result)
        .join(
            latest_check_date,
            and_(
                ComplianceCheck.vendor_id == latest_check_date.c.vendor_id,
                ComplianceCheck.check_date == latest_check_date.c.d,
            ),
        )
        .all()
    )
    expired = {
        r[0] for r in db.query(VendorCertification.vendor_id).filter(VendorCertification.expiry_date < today).all()
    }
    expiring = {
        r[0]
        for r in db.query(VendorCertification.vendor_id)
        .filter(VendorCertification.expiry_date >= today, VendorCertification.expiry_date <= horizon)
        .all()
    }
    bad_contracts = {
        r[0] for r in db.query(Contract.vendor_id).filter(Contract.compliance_status == "Non-Compliant").all()
    }
    has_certs = {r[0] for r in db.query(VendorCertification.vendor_id).distinct().all()}

    buckets = {"Compliant": 0, "Minor Issues": 0, "Major Issues": 0, "Non-Compliant": 0, "Not Assessed": 0}
    flagged = []

    for v in vendor_rows:
        result = latest_results.get(v.id)
        if result == "Non-Compliant":
            bucket, reason = "Non-Compliant", "Latest compliance check failed"
        elif v.id in expired or v.id in bad_contracts:
            bucket = "Major Issues"
            reason = "Certification expired" if v.id in expired else "Contract marked non-compliant"
        elif result == "Partial" or v.id in expiring:
            bucket = "Minor Issues"
            reason = "Partial compliance on latest check" if result == "Partial" else "Certification expiring soon"
        elif result is None and v.id not in has_certs:
            bucket, reason = "Not Assessed", "No checks or certifications on file"
        else:
            bucket, reason = "Compliant", ""

        buckets[bucket] += 1
        if bucket in ("Non-Compliant", "Major Issues"):
            flagged.append({"vendor_id": v.id, "vendor_name": v.vendor_name, "status": bucket, "reason": reason})

    slices = [{"label": k, "value": v} for k, v in buckets.items() if k != "Not Assessed" or v]
    return slices, flagged[:8]


@router.get("/admin")
def admin_dashboard(
    months: int = Query(default=6, ge=3, le=24),
    f: A.Filters = Depends(_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    anchor = f.end or date.today()
    cutoff = datetime.combine(anchor - timedelta(days=29), datetime.min.time()).replace(tzinfo=timezone.utc)
    prev_cutoff = cutoff - timedelta(days=30)

    def created_delta(model):
        now = db.query(func.count(model.id)).filter(model.created_at >= cutoff).scalar() or 0
        before = db.query(func.count(model.id)).filter(model.created_at >= prev_cutoff, model.created_at < cutoff).scalar() or 0
        return int(now), _delta(now, before)

    users = A.user_management(db)
    vendors = A.vendor_analytics(db, f)
    procurement = A.procurement_overview(db, f)
    orders = A.purchase_order_overview(db, f)
    compliance = A.compliance_monitoring(db, f)
    system = A.system_statistics(db)
    risk = A.risk_breakdown(db, f)
    spend = A.spend_over_time(db, f, months=months)
    live = monitoring.snapshot(settings.UPLOAD_DIR)

    new_users, users_delta = created_delta(User)
    new_vendors, vendors_delta = created_delta(Vendor)
    new_contracts, contracts_delta = created_delta(Contract)

    kpis = [
        _kpi("total_users", "Total Users", users["total_users"], users_delta,
             f"{users['active_users']} active · {new_users} new in 30 days"),
        _kpi("total_vendors", "Total Vendors", vendors["total_vendors"], vendors_delta,
             f"{vendors['active_vendors']} approved · {vendors['pending_vendors']} pending"),
        _kpi("total_contracts", "Total Contracts", system["total_contracts"], contracts_delta,
             f"{new_contracts} created in 30 days"),
        _kpi("system_uptime", "System Availability", live["availability_pct"], None,
             f"API up {live['uptime_seconds'] // 3600}h {(live['uptime_seconds'] % 3600) // 60}m", "percent"),
    ]

    db_bytes = db.execute(text("SELECT pg_database_size(current_database())")).scalar() or 0
    db_quota = getattr(settings, "DB_QUOTA_BYTES", 1024 ** 3)

    risk_order = ["Low", "Medium", "High", "Critical"]
    compliance_slices, flagged = _compliance_classes(db, f)

    # Average reliability across vendors, month by month, from the stored history.
    trend_rows = (
        db.query(
            func.to_char(VendorReliabilityScore.score_date, "YYYY-MM").label("period"),
            func.avg(VendorReliabilityScore.overall_score),
            func.count(func.distinct(VendorReliabilityScore.vendor_id)),
        )
        .group_by("period")
        .order_by("period")
        .all()
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "kpis": kpis,
        "user_management": {
            "slices": [{"label": role, "value": count} for role, count in sorted(users["by_role"].items(), key=lambda x: -x[1])],
            "total": users["total_users"],
            "active": users["active_users"],
            "inactive": users["inactive_users"],
            "pending_approvals": vendors["pending_vendors"],
            "pending_vendor_logins": users["pending_approvals"],
        },
        "vendor_analytics": {
            "risk": [{"label": level, "value": int(risk["by_risk"].get(level, 0))} for level in risk_order],
            "by_category": vendors["by_category"],
            "by_status": vendors["by_status"],
            "total": vendors["total_vendors"],
            "active": vendors["active_vendors"],
            "high_risk": risk["high_risk_count"],
            "average_reliability": vendors["average_reliability"],
            "at_risk": risk["at_risk_vendors"][:6],
            "reliability_trend": [
                {"period": p, "average": round(_f(a), 1), "vendors": int(n)} for p, a, n in trend_rows[-12:]
            ],
        },
        "procurement_reports": {
            "series": [{"period": r["period"], "value": round(r["spend"], 2), "orders": r["orders"]} for r in spend],
            "total_requests": procurement["total_requests"],
            "total_orders": orders["total_orders"],
            "procurement_value": orders["total_po_value"],
            "pending_approvals": procurement["pending_requests"] + orders["pending_orders"],
            "completion_rate": procurement["completion_rate"],
        },
        "compliance": {
            "slices": compliance_slices,
            "compliance_rate": compliance["compliance_rate"],
            "compliant_vendors": compliance["compliant_vendors"],
            "non_compliant_vendors": compliance["non_compliant_vendors"],
            "expired_certifications": compliance["expired_certifications"],
            "expiring_certifications": compliance["expiring_certifications"],
            "flagged": flagged,
        },
        "system": {
            **system,
            "database_bytes": int(db_bytes),
            "database_quota_bytes": int(db_quota),
            "api_avg_ms": live["api_avg_ms"],
            "api_p95_ms": live["api_p95_ms"],
            "requests_last_minute": live["requests_last_minute"],
            "active_sessions": live["active_sessions"],
            "session_window_minutes": live["session_window_minutes"],
            "storage_bytes": live["storage_bytes"],
            "uptime_seconds": live["uptime_seconds"],
            "availability_pct": live["availability_pct"],
            "total_requests": live["total_requests"],
            "latency_series": live["latency_series"],
        },
        "recent_activity": _activity_feed(db, None, 12),
    }


# --------------------------------------------------------------------------
# Live change detection
# --------------------------------------------------------------------------

@router.get("/live")
def live(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A fingerprint of the data behind the dashboards, plus the newest events.

    The screens poll this and re-fetch only when ``version`` changes.
    """

    scope = vendor_scope(current_user)

    parts = db.execute(
        text(
            """
            SELECT
              (SELECT COALESCE(MAX(id), 0) FROM activity_logs),
              (SELECT COUNT(*) FROM purchase_orders),
              (SELECT COALESCE(EXTRACT(EPOCH FROM MAX(updated_at)), 0) FROM purchase_orders),
              (SELECT COUNT(*) FROM vendors),
              (SELECT COALESCE(EXTRACT(EPOCH FROM MAX(updated_at)), 0) FROM vendors),
              (SELECT COUNT(*) FROM contracts),
              (SELECT COALESCE(EXTRACT(EPOCH FROM MAX(updated_at)), 0) FROM contracts),
              (SELECT COUNT(*) FROM users),
              (SELECT COALESCE(MAX(id), 0) FROM vendor_reliability_scores),
              (SELECT COALESCE(MAX(id), 0) FROM messages),
              (SELECT COALESCE(MAX(id), 0) FROM invoices)
            """
        )
    ).one()

    version = hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:16]

    unread = (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .scalar()
        or 0
    )

    latest_alert = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.id.desc())
        .first()
    )

    return {
        "server_time": datetime.now(timezone.utc).isoformat(),
        "version": version,
        "unread_notifications": int(unread),
        "latest_notification": {
            "id": latest_alert.id,
            "title": latest_alert.title,
            "message": latest_alert.message,
            "type": latest_alert.notification_type,
            "priority": latest_alert.priority,
            "link": latest_alert.link,
            "created_at": latest_alert.created_at.isoformat() if latest_alert.created_at else None,
        }
        if latest_alert
        else None,
        "activity": _activity_feed(db, scope, 6),
    }


@router.get("/system")
def system_monitor(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    live_stats = monitoring.snapshot(settings.UPLOAD_DIR)
    live_stats["database_bytes"] = int(db.execute(text("SELECT pg_database_size(current_database())")).scalar() or 0)
    return live_stats
