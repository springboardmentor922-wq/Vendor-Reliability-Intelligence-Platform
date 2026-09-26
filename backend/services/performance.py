"""Vendor performance measurement.

Every figure here is aggregated in SQL straight from the operational tables -
purchase orders, performance evaluations, message threads, compliance checks.
Nothing is cached or precomputed, so a dashboard reading these functions
reflects the database as it stands at the moment of the request.

The six metrics the Vendor Performance module is required to report:

  on-time deliveries      purchase orders delivered on or before the
                          committed date
  delayed deliveries      purchase orders delivered after it
  quality rating          mean of the recorded per-order quality scores
  response time           hours between an internal message and the
                          supplier's reply, measured on the message rows
  issue resolution time   hours to close out a raised issue
  order completion rate   share of non-cancelled orders reaching Completed
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from sqlalchemy import Numeric, and_, case, cast, func, or_
from sqlalchemy.orm import Session

from config import settings
from models import (
    ComplianceCheck,
    Contract,
    ComplianceStatus,
    Message,
    MessageThread,
    PurchaseOrder,
    PurchaseOrderStatus,
    ThreadStatus,
    User,
    UserRole,
    Vendor,
    VendorCertification,
    VendorPerformance
)

#: Statuses that mean the goods arrived.
DELIVERED = (PurchaseOrderStatus.DELIVERED, PurchaseOrderStatus.COMPLETED)

#: Statuses that still count as live procurement commitments.
ACTIVE = (
    PurchaseOrderStatus.PENDING,
    PurchaseOrderStatus.APPROVED,
    PurchaseOrderStatus.ORDERED,
)


def _to_float(value, default=0.0) -> float:
    if value is None:
        return default

    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _delay_days_expression():
    """SQL expression for how many days late a delivery was (0 if on time)."""

    return func.greatest(
        PurchaseOrder.actual_delivery
        - PurchaseOrder.expected_delivery
        - settings.DELIVERY_GRACE_DAYS,
        0,
    )


def _on_time_condition():
    return (
        PurchaseOrder.actual_delivery
        <= PurchaseOrder.expected_delivery + settings.DELIVERY_GRACE_DAYS
    )


def _apply_order_filters(query, vendor_id=None, start=None, end=None,
                         category=None):
    if vendor_id is not None:
        query = query.filter(PurchaseOrder.vendor_id == vendor_id)

    if start is not None:
        query = query.filter(PurchaseOrder.order_date >= start)

    if end is not None:
        query = query.filter(PurchaseOrder.order_date <= end)

    if category:
        query = query.filter(Vendor.category == category)

    return query


# --------------------------------------------------------------------------
# Delivery metrics
# --------------------------------------------------------------------------

def delivery_metrics(
    db: Session,
    vendor_id: Optional[int] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
    category: Optional[str] = None,
) -> dict:
    """Delivery counters and rates for one vendor, or the whole book."""

    delivered = and_(
        PurchaseOrder.status.in_(DELIVERED),
        PurchaseOrder.actual_delivery.isnot(None),
    )

    query = (
        db.query(
            func.count(PurchaseOrder.id).label("total"),
            func.sum(case((delivered, 1), else_=0)).label("delivered"),
            func.sum(
                case((and_(delivered, _on_time_condition()), 1), else_=0)
            ).label("on_time"),
            func.sum(
                case(
                    (and_(delivered, ~_on_time_condition()), 1),
                    else_=0,
                )
            ).label("delayed"),
            func.sum(
                case(
                    (PurchaseOrder.status == PurchaseOrderStatus.CANCELLED, 1),
                    else_=0,
                )
            ).label("cancelled"),
            func.sum(
                case(
                    (PurchaseOrder.status == PurchaseOrderStatus.COMPLETED, 1),
                    else_=0,
                )
            ).label("completed"),
            func.sum(
                case((PurchaseOrder.status.in_(ACTIVE), 1), else_=0)
            ).label("active"),
            func.avg(
                case((delivered, _delay_days_expression()))
            ).label("avg_delay"),
            func.max(
                case((delivered, _delay_days_expression()))
            ).label("max_delay"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            PurchaseOrder.status != PurchaseOrderStatus.CANCELLED,
                            PurchaseOrder.total_amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("spend"),
        )
        .select_from(PurchaseOrder)
        .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
    )

    row = _apply_order_filters(
        query, vendor_id, start, end, category
    ).one()

    total = int(row.total or 0)
    delivered_count = int(row.delivered or 0)
    on_time = int(row.on_time or 0)
    delayed = int(row.delayed or 0)
    cancelled = int(row.cancelled or 0)
    completed = int(row.completed or 0)

    # Orders past their committed date that have still not arrived.
    overdue = (
        _apply_order_filters(
            db.query(func.count(PurchaseOrder.id))
            .select_from(PurchaseOrder)
            .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
            .filter(
                PurchaseOrder.status.in_(ACTIVE),
                PurchaseOrder.expected_delivery.isnot(None),
                PurchaseOrder.expected_delivery < date.today(),
            ),
            vendor_id,
            start,
            end,
            category,
        ).scalar()
        or 0
    )

    completable = total - cancelled

    return {
        "total_orders": total,
        "delivered_orders": delivered_count,
        "on_time_deliveries": on_time,
        "delayed_deliveries": delayed,
        "cancelled_orders": cancelled,
        "completed_orders": completed,
        "active_orders": int(row.active or 0),
        "pending_deliveries": int(row.active or 0),
        "overdue_orders": int(overdue),
        "on_time_rate": round(100.0 * on_time / delivered_count, 2)
        if delivered_count
        else 0.0,
        "delay_rate": round(100.0 * delayed / delivered_count, 2)
        if delivered_count
        else 0.0,
        "delivery_rate": round(100.0 * delivered_count / total, 2)
        if total
        else 0.0,
        "order_completion_rate": round(100.0 * completed / completable, 2)
        if completable
        else 0.0,
        "avg_delay_days": round(_to_float(row.avg_delay), 2),
        "max_delay_days": round(_to_float(row.max_delay), 2),
        "total_spend": round(_to_float(row.spend), 2),
        "avg_order_value": round(_to_float(row.spend) / total, 2)
        if total
        else 0.0,
    }


# --------------------------------------------------------------------------
# Quality metrics
# --------------------------------------------------------------------------

def quality_metrics(
    db: Session,
    vendor_id: Optional[int] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
    category: Optional[str] = None,
) -> dict:
    """Averages over the per-order performance evaluations."""

    query = (
        db.query(
            func.count(VendorPerformance.id).label("evaluations"),
            func.avg(VendorPerformance.quality_rating).label("quality"),
            func.avg(VendorPerformance.service_rating).label("service"),
            func.avg(VendorPerformance.response_time).label("response"),
            func.avg(VendorPerformance.issue_resolution_time).label("resolution"),
            func.avg(VendorPerformance.order_completion_rate).label("completion"),
        )
        .select_from(VendorPerformance)
        .join(Vendor, Vendor.id == VendorPerformance.vendor_id)
    )

    if vendor_id is not None:
        query = query.filter(VendorPerformance.vendor_id == vendor_id)

    if start is not None:
        query = query.filter(VendorPerformance.evaluation_date >= start)

    if end is not None:
        query = query.filter(VendorPerformance.evaluation_date <= end)

    if category:
        query = query.filter(Vendor.category == category)

    row = query.one()

    return {
        "evaluations": int(row.evaluations or 0),
        "quality_rating": round(_to_float(row.quality), 2),
        "service_rating": round(_to_float(row.service), 2),
        "avg_response_time_hours": round(_to_float(row.response), 2),
        "avg_issue_resolution_hours": round(_to_float(row.resolution), 2),
        "avg_order_completion_rate": round(_to_float(row.completion), 2),
    }


# --------------------------------------------------------------------------
# Communication metrics
# --------------------------------------------------------------------------

def communication_metrics(
    db: Session,
    vendor_id: Optional[int] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
) -> dict:
    """Responsiveness measured from the message rows themselves.

    Response time is the gap between an internal message and the supplier's
    next reply on the same thread, so it is derived from real timestamps
    rather than read out of a stored summary column.
    """

    thread_query = db.query(
        func.count(MessageThread.id).label("total"),
        func.sum(
            case(
                (
                    MessageThread.status.in_(
                        [ThreadStatus.RESOLVED, ThreadStatus.CLOSED]
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("resolved"),
        func.sum(
            case(
                (
                    MessageThread.status.notin_(
                        [ThreadStatus.RESOLVED, ThreadStatus.CLOSED]
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("open"),
    )

    if vendor_id is not None:
        thread_query = thread_query.filter(MessageThread.vendor_id == vendor_id)

    if start is not None:
        thread_query = thread_query.filter(MessageThread.created_at >= start)

    if end is not None:
        thread_query = thread_query.filter(
            MessageThread.created_at <= end + timedelta(days=1)
        )

    threads = thread_query.one()

    # First internal message and first supplier reply per thread; the gap
    # between them is the supplier's response time on that thread.
    vendor_message = (
        db.query(
            Message.thread_id.label("thread_id"),
            func.min(Message.created_at).label("replied_at"),
        )
        .join(User, User.id == Message.sender_id)
        .filter(User.role == UserRole.VENDOR)
        .group_by(Message.thread_id)
        .subquery()
    )

    internal_message = (
        db.query(
            Message.thread_id.label("thread_id"),
            func.min(Message.created_at).label("asked_at"),
        )
        .join(User, User.id == Message.sender_id)
        .filter(User.role != UserRole.VENDOR)
        .group_by(Message.thread_id)
        .subquery()
    )

    gap_query = (
        db.query(
            func.avg(
                func.extract(
                    "epoch", vendor_message.c.replied_at - internal_message.c.asked_at
                )
                / 3600.0
            ).label("hours"),
            func.count().label("measured"),
        )
        .select_from(MessageThread)
        .join(vendor_message, vendor_message.c.thread_id == MessageThread.id)
        .join(internal_message, internal_message.c.thread_id == MessageThread.id)
        .filter(vendor_message.c.replied_at > internal_message.c.asked_at)
    )

    if vendor_id is not None:
        gap_query = gap_query.filter(MessageThread.vendor_id == vendor_id)

    gap = gap_query.one()

    measured = int(gap.measured or 0)
    response_hours = round(_to_float(gap.hours), 2) if measured else None

    # Where no supplier has replied yet, the recorded per-order response
    # figure is the next best evidence.
    if response_hours is None:
        fallback = db.query(func.avg(VendorPerformance.response_time))

        if vendor_id is not None:
            fallback = fallback.filter(VendorPerformance.vendor_id == vendor_id)

        response_hours = round(_to_float(fallback.scalar()), 2)

    total = int(threads.total or 0)
    resolved = int(threads.resolved or 0)

    return {
        "total_threads": total,
        "open_threads": int(threads.open or 0),
        "resolved_threads": resolved,
        "resolution_rate": round(100.0 * resolved / total, 2) if total else 0.0,
        "avg_response_hours": response_hours,
        "threads_measured": measured,
    }


# --------------------------------------------------------------------------
# Compliance metrics
# --------------------------------------------------------------------------

def compliance_metrics(db: Session, vendor_id: Optional[int] = None) -> dict:
    """Compliance checks, contract compliance state and certificate validity."""

    check_query = db.query(
        func.count(ComplianceCheck.id).label("total"),
        func.sum(
            case((ComplianceCheck.result == "Compliant", 1), else_=0)
        ).label("compliant"),
        func.sum(
            case((ComplianceCheck.result == "Partial", 1), else_=0)
        ).label("partial"),
        func.sum(
            case((ComplianceCheck.result == "Non-Compliant", 1), else_=0)
        ).label("failed"),
    )

    if vendor_id is not None:
        check_query = check_query.filter(ComplianceCheck.vendor_id == vendor_id)

    checks = check_query.one()

    contract_query = db.query(
        func.count(Contract.id).label("total"),
        func.sum(
            case(
                (Contract.compliance_status == ComplianceStatus.COMPLIANT, 1),
                else_=0,
            )
        ).label("compliant"),
        func.sum(
            case(
                (
                    Contract.compliance_status == ComplianceStatus.NON_COMPLIANT,
                    1,
                ),
                else_=0,
            )
        ).label("non_compliant"),
    )

    if vendor_id is not None:
        contract_query = contract_query.filter(Contract.vendor_id == vendor_id)

    contracts = contract_query.one()

    today = date.today()

    cert_query = db.query(
        func.count(VendorCertification.id).label("total"),
        func.sum(
            case((VendorCertification.expiry_date < today, 1), else_=0)
        ).label("expired"),
        func.sum(
            case(
                (
                    and_(
                        VendorCertification.expiry_date >= today,
                        VendorCertification.expiry_date
                        <= today + timedelta(days=settings.CERTIFICATION_ALERT_DAYS),
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("expiring"),
    )

    if vendor_id is not None:
        cert_query = cert_query.filter(
            VendorCertification.vendor_id == vendor_id
        )

    certs = cert_query.one()

    total_checks = int(checks.total or 0)
    compliant = int(checks.compliant or 0)
    partial = int(checks.partial or 0)

    return {
        "total_checks": total_checks,
        "compliant_checks": compliant,
        "partial_checks": partial,
        "failed_checks": int(checks.failed or 0),
        # A partial result earns half credit.
        "compliance_rate": round(
            100.0 * (compliant + 0.5 * partial) / total_checks, 2
        )
        if total_checks
        else 0.0,
        "total_contracts": int(contracts.total or 0),
        "compliant_contracts": int(contracts.compliant or 0),
        "non_compliant_contracts": int(contracts.non_compliant or 0),
        "total_certifications": int(certs.total or 0),
        "expired_certifications": int(certs.expired or 0),
        "expiring_certifications": int(certs.expiring or 0),
    }


# --------------------------------------------------------------------------
# Combined view
# --------------------------------------------------------------------------

def vendor_metrics(
    db: Session,
    vendor_id: int,
    start: Optional[date] = None,
    end: Optional[date] = None,
) -> dict:
    """Everything the Vendor Performance module reports for one supplier."""

    delivery = delivery_metrics(db, vendor_id, start, end)
    quality = quality_metrics(db, vendor_id, start, end)
    communication = communication_metrics(db, vendor_id, start, end)
    compliance = compliance_metrics(db, vendor_id)

    return {
        "vendor_id": vendor_id,
        **delivery,
        **quality,
        **{f"comm_{k}": v for k, v in communication.items()},
        **{f"compliance_{k}": v for k, v in compliance.items()},
        "communication": communication,
        "compliance": compliance,
    }


def performance_trend(
    db: Session,
    vendor_id: Optional[int] = None,
    months: int = 12,
    category: Optional[str] = None,
) -> list[dict]:
    """Month-by-month delivery performance, oldest first.

    Delivery outcomes are bucketed by **when the delivery happened**, not by
    when the order was raised. Bucketing by order date makes the recent
    months incomplete cohorts - most of their orders are still inside their
    lead time - so a month would report an on-time rate computed from a
    handful of early arrivals and read as a collapse in performance. Grouping
    by delivery date asks the question a buyer actually asks: of everything
    that arrived in September, how much of it was on time.

    Order volume and spend stay bucketed by order date, because that is when
    the commitment was made.
    """

    start = (
        date.today().replace(day=1) - timedelta(days=31 * (months - 1))
    ).replace(day=1)

    delivered = and_(
        PurchaseOrder.status.in_(DELIVERED),
        PurchaseOrder.actual_delivery.isnot(None),
    )

    # ---- commitments, by order date ------------------------------
    order_bucket = func.to_char(PurchaseOrder.order_date, "YYYY-MM").label("period")

    order_query = (
        db.query(
            order_bucket,
            func.count(PurchaseOrder.id).label("orders"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            PurchaseOrder.status != PurchaseOrderStatus.CANCELLED,
                            PurchaseOrder.total_amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("spend"),
        )
        .select_from(PurchaseOrder)
        .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
        .filter(PurchaseOrder.order_date >= start)
        .group_by(order_bucket)
    )

    # ---- outcomes, by delivery date ------------------------------
    delivery_bucket = func.to_char(
        PurchaseOrder.actual_delivery, "YYYY-MM"
    ).label("period")

    delivery_query = (
        db.query(
            delivery_bucket,
            func.count(PurchaseOrder.id).label("delivered"),
            func.sum(case((_on_time_condition(), 1), else_=0)).label("on_time"),
            func.sum(case((~_on_time_condition(), 1), else_=0)).label("delayed"),
            func.avg(_delay_days_expression()).label("avg_delay"),
        )
        .select_from(PurchaseOrder)
        .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
        # A delivery dated in the future is a data error, not a result, and
        # would otherwise open a spurious bucket beyond the current month.
        .filter(
            delivered,
            PurchaseOrder.actual_delivery >= start,
            PurchaseOrder.actual_delivery <= date.today(),
        )
        .group_by(delivery_bucket)
    )

    if vendor_id is not None:
        order_query = order_query.filter(PurchaseOrder.vendor_id == vendor_id)
        delivery_query = delivery_query.filter(
            PurchaseOrder.vendor_id == vendor_id
        )

    if category:
        order_query = order_query.filter(Vendor.category == category)
        delivery_query = delivery_query.filter(Vendor.category == category)

    orders_by_period = {row.period: row for row in order_query.all()}
    delivery_by_period = {row.period: row for row in delivery_query.all()}

    # ---- quality, by evaluation date -----------------------------
    quality_bucket = func.to_char(
        VendorPerformance.evaluation_date, "YYYY-MM"
    ).label("period")

    quality_query = (
        db.query(
            quality_bucket,
            func.avg(VendorPerformance.quality_rating).label("quality"),
            func.avg(VendorPerformance.response_time).label("response"),
        )
        .filter(VendorPerformance.evaluation_date >= start)
        .group_by(quality_bucket)
    )

    if vendor_id is not None:
        quality_query = quality_query.filter(
            VendorPerformance.vendor_id == vendor_id
        )

    quality_by_period = {row.period: row for row in quality_query.all()}

    periods = sorted(
        set(orders_by_period) | set(delivery_by_period) | set(quality_by_period)
    )

    results = []

    for period in periods:
        order_row = orders_by_period.get(period)
        delivery_row = delivery_by_period.get(period)
        quality_row = quality_by_period.get(period)

        delivered_count = int(delivery_row.delivered or 0) if delivery_row else 0
        on_time = int(delivery_row.on_time or 0) if delivery_row else 0

        results.append({
            "period": period,
            "orders": int(order_row.orders or 0) if order_row else 0,
            "delivered": delivered_count,
            "on_time": on_time,
            "delayed": int(delivery_row.delayed or 0) if delivery_row else 0,
            "on_time_rate": round(100.0 * on_time / delivered_count, 2)
            if delivered_count
            else 0.0,
            "avg_delay_days": round(_to_float(delivery_row.avg_delay), 2)
            if delivery_row
            else 0.0,
            "spend": round(_to_float(order_row.spend), 2) if order_row else 0.0,
            "quality_rating": round(_to_float(quality_row.quality), 2)
            if quality_row
            else 0.0,
            "avg_response_hours": round(_to_float(quality_row.response), 2)
            if quality_row
            else 0.0,
        })

    return results


def vendor_delivery_summary(
    db: Session,
    start: Optional[date] = None,
    end: Optional[date] = None,
    category: Optional[str] = None,
) -> list[dict]:
    """One delivery summary row per vendor - the basis of the ranking table."""

    delivered = and_(
        PurchaseOrder.status.in_(DELIVERED),
        PurchaseOrder.actual_delivery.isnot(None),
    )

    query = (
        db.query(
            Vendor.id.label("vendor_id"),
            Vendor.vendor_name.label("vendor_name"),
            Vendor.vendor_code.label("vendor_code"),
            Vendor.category.label("category"),
            Vendor.status.label("status"),
            func.count(PurchaseOrder.id).label("orders"),
            func.sum(case((delivered, 1), else_=0)).label("delivered"),
            func.sum(
                case((and_(delivered, _on_time_condition()), 1), else_=0)
            ).label("on_time"),
            func.sum(
                case((and_(delivered, ~_on_time_condition()), 1), else_=0)
            ).label("delayed"),
            func.avg(case((delivered, _delay_days_expression()))).label("avg_delay"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            PurchaseOrder.status != PurchaseOrderStatus.CANCELLED,
                            PurchaseOrder.total_amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("spend"),
        )
        .select_from(Vendor)
        .outerjoin(PurchaseOrder, PurchaseOrder.vendor_id == Vendor.id)
        .group_by(Vendor.id, Vendor.vendor_name, Vendor.vendor_code,
                  Vendor.category, Vendor.status)
    )

    if start is not None:
        query = query.filter(
            or_(PurchaseOrder.id.is_(None), PurchaseOrder.order_date >= start)
        )

    if end is not None:
        query = query.filter(
            or_(PurchaseOrder.id.is_(None), PurchaseOrder.order_date <= end)
        )

    if category:
        query = query.filter(Vendor.category == category)

    results = []

    for row in query.all():
        delivered_count = int(row.delivered or 0)
        on_time = int(row.on_time or 0)

        results.append({
            "vendor_id": row.vendor_id,
            "vendor_name": row.vendor_name,
            "vendor_code": row.vendor_code,
            "category": row.category,
            "status": row.status,
            "orders": int(row.orders or 0),
            "delivered": delivered_count,
            "on_time_deliveries": on_time,
            "delayed_deliveries": int(row.delayed or 0),
            "on_time_rate": round(100.0 * on_time / delivered_count, 2)
            if delivered_count
            else 0.0,
            "avg_delay_days": round(_to_float(row.avg_delay), 2),
            "total_spend": round(_to_float(row.spend), 2),
        })

    return results


def quality_by_vendor(db: Session) -> dict[int, dict]:
    """Quality / service / responsiveness averages keyed by vendor id."""

    rows = (
        db.query(
            VendorPerformance.vendor_id.label("vendor_id"),
            func.count(VendorPerformance.id).label("evaluations"),
            func.avg(VendorPerformance.quality_rating).label("quality"),
            func.avg(VendorPerformance.service_rating).label("service"),
            func.avg(VendorPerformance.response_time).label("response"),
            func.avg(VendorPerformance.issue_resolution_time).label("resolution"),
            func.avg(VendorPerformance.order_completion_rate).label("completion"),
        )
        .group_by(VendorPerformance.vendor_id)
        .all()
    )

    return {
        row.vendor_id: {
            "evaluations": int(row.evaluations or 0),
            "quality_rating": round(_to_float(row.quality), 2),
            "service_rating": round(_to_float(row.service), 2),
            "avg_response_time_hours": round(_to_float(row.response), 2),
            "avg_issue_resolution_hours": round(_to_float(row.resolution), 2),
            "avg_order_completion_rate": round(_to_float(row.completion), 2),
        }
        for row in rows
    }


def compliance_by_vendor(db: Session) -> dict[int, dict]:
    """Compliance check tallies keyed by vendor id."""

    rows = (
        db.query(
            ComplianceCheck.vendor_id.label("vendor_id"),
            func.count(ComplianceCheck.id).label("total"),
            func.sum(
                case((ComplianceCheck.result == "Compliant", 1), else_=0)
            ).label("compliant"),
            func.sum(
                case((ComplianceCheck.result == "Partial", 1), else_=0)
            ).label("partial"),
            func.sum(
                case((ComplianceCheck.result == "Non-Compliant", 1), else_=0)
            ).label("failed"),
        )
        .group_by(ComplianceCheck.vendor_id)
        .all()
    )

    summary = {}

    for row in rows:
        total = int(row.total or 0)
        compliant = int(row.compliant or 0)
        partial = int(row.partial or 0)

        summary[row.vendor_id] = {
            "total_checks": total,
            "compliant_checks": compliant,
            "partial_checks": partial,
            "failed_checks": int(row.failed or 0),
            "compliance_rate": round(
                100.0 * (compliant + 0.5 * partial) / total, 2
            )
            if total
            else 0.0,
        }

    return summary


def communication_by_vendor(db: Session) -> dict[int, dict]:
    """Thread counts and measured response gaps keyed by vendor id."""

    thread_rows = (
        db.query(
            MessageThread.vendor_id.label("vendor_id"),
            func.count(MessageThread.id).label("total"),
            func.sum(
                case(
                    (
                        MessageThread.status.in_(
                            [ThreadStatus.RESOLVED, ThreadStatus.CLOSED]
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("resolved"),
        )
        .filter(MessageThread.vendor_id.isnot(None))
        .group_by(MessageThread.vendor_id)
        .all()
    )

    vendor_message = (
        db.query(
            Message.thread_id.label("thread_id"),
            func.min(Message.created_at).label("replied_at"),
        )
        .join(User, User.id == Message.sender_id)
        .filter(User.role == UserRole.VENDOR)
        .group_by(Message.thread_id)
        .subquery()
    )

    internal_message = (
        db.query(
            Message.thread_id.label("thread_id"),
            func.min(Message.created_at).label("asked_at"),
        )
        .join(User, User.id == Message.sender_id)
        .filter(User.role != UserRole.VENDOR)
        .group_by(Message.thread_id)
        .subquery()
    )

    gap_rows = (
        db.query(
            MessageThread.vendor_id.label("vendor_id"),
            func.avg(
                func.extract(
                    "epoch",
                    vendor_message.c.replied_at - internal_message.c.asked_at,
                )
                / 3600.0
            ).label("hours"),
            func.count().label("measured"),
        )
        .select_from(MessageThread)
        .join(vendor_message, vendor_message.c.thread_id == MessageThread.id)
        .join(internal_message, internal_message.c.thread_id == MessageThread.id)
        .filter(
            MessageThread.vendor_id.isnot(None),
            vendor_message.c.replied_at > internal_message.c.asked_at,
        )
        .group_by(MessageThread.vendor_id)
        .all()
    )

    gaps = {
        row.vendor_id: (round(_to_float(row.hours), 2), int(row.measured or 0))
        for row in gap_rows
    }

    summary = {}

    for row in thread_rows:
        total = int(row.total or 0)
        resolved = int(row.resolved or 0)
        hours, measured = gaps.get(row.vendor_id, (None, 0))

        summary[row.vendor_id] = {
            "total_threads": total,
            "resolved_threads": resolved,
            "open_threads": total - resolved,
            "resolution_rate": round(100.0 * resolved / total, 2)
            if total
            else 0.0,
            "avg_response_hours": hours,
            "threads_measured": measured,
        }

    return summary
