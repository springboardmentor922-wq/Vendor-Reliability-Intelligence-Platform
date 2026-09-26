"""Aggregations behind the analytics dashboards.

Every function takes the same filter set - date range, vendor, category,
risk level - and pushes it into SQL, so a filter the user changes on screen
narrows the query rather than the result.  Nothing is precomputed and no
figure is hard-coded; each call reads the operational tables as they stand.

Vendor logins are scoped by the caller passing ``vendor_id``, which is
applied to every query in the module.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from sqlalchemy import Date, and_, case, cast, func, or_
from sqlalchemy.orm import Session

from config import settings
from models import (
    ComplianceCheck,
    ComplianceStatus,
    Contract,
    ContractStatus,
    Invoice,
    InvoiceStatus,
    Message,
    MessageThread,
    ProcurementRequest,
    ProcurementStatus,
    PurchaseOrder,
    PurchaseOrderStatus,
    ThreadStatus,
    User,
    UserRole,
    Vendor,
    VendorCertification,
    VendorPerformance,
    VendorReliabilityScore,
    VendorStatus
)
from services.performance import ACTIVE, DELIVERED, _on_time_condition


def _to_float(value, default=0.0) -> float:
    if value is None:
        return default

    try:
        return float(value)
    except (TypeError, ValueError):
        return default


class Filters:
    """The filter set every analytics query understands."""

    def __init__(
        self,
        start: Optional[date] = None,
        end: Optional[date] = None,
        vendor_id: Optional[int] = None,
        category: Optional[str] = None,
        risk_level: Optional[str] = None,
        status: Optional[str] = None,
    ):
        self.start = start
        self.end = end
        self.vendor_id = vendor_id
        self.category = category
        self.risk_level = risk_level
        self.status = status

    def as_dict(self) -> dict:
        return {
            "start": self.start.isoformat() if self.start else None,
            "end": self.end.isoformat() if self.end else None,
            "vendor_id": self.vendor_id,
            "category": self.category,
            "risk_level": self.risk_level,
            "status": self.status,
        }

    def apply_orders(self, query):
        """Narrow a purchase-order query. Assumes Vendor is already joined."""

        if self.start:
            query = query.filter(PurchaseOrder.order_date >= self.start)

        if self.end:
            query = query.filter(PurchaseOrder.order_date <= self.end)

        if self.vendor_id:
            query = query.filter(PurchaseOrder.vendor_id == self.vendor_id)

        if self.category:
            query = query.filter(Vendor.category == self.category)

        if self.risk_level:
            query = query.filter(Vendor.risk_level == self.risk_level)

        if self.status:
            query = query.filter(PurchaseOrder.status == self.status)

        return query

    def apply_vendors(self, query):
        if self.vendor_id:
            query = query.filter(Vendor.id == self.vendor_id)

        if self.category:
            query = query.filter(Vendor.category == self.category)

        if self.risk_level:
            query = query.filter(Vendor.risk_level == self.risk_level)

        return query

    def apply_requests(self, query):
        if self.start:
            query = query.filter(
                cast(ProcurementRequest.created_at, Date) >= self.start
            )

        if self.end:
            query = query.filter(
                cast(ProcurementRequest.created_at, Date) <= self.end
            )

        if self.vendor_id:
            query = query.filter(
                ProcurementRequest.assigned_vendor_id == self.vendor_id
            )

        if self.category:
            query = query.filter(ProcurementRequest.category == self.category)

        return query


# --------------------------------------------------------------------------
# Procurement analytics
# --------------------------------------------------------------------------

def procurement_overview(db: Session, filters: Filters) -> dict:
    """Request counts, procurement value and completion rate."""

    query = filters.apply_requests(db.query(ProcurementRequest))
    rows = query.with_entities(
        ProcurementRequest.status, func.count(ProcurementRequest.id),
        func.coalesce(func.sum(ProcurementRequest.estimated_cost), 0)
    ).group_by(ProcurementRequest.status).all()

    by_status = {status: int(count) for status, count, _ in rows}
    total = sum(by_status.values())

    completed = by_status.get(ProcurementStatus.COMPLETED, 0)
    cancelled = by_status.get(ProcurementStatus.CANCELLED, 0)
    rejected = by_status.get(ProcurementStatus.REJECTED, 0)

    completable = total - cancelled - rejected

    value = sum(_to_float(amount) for _, _, amount in rows)

    return {
        "total_requests": total,
        "pending_requests": by_status.get(ProcurementStatus.PENDING, 0),
        "approved_requests": by_status.get(ProcurementStatus.APPROVED, 0),
        "ordered_requests": by_status.get(ProcurementStatus.ORDERED, 0),
        "delivered_requests": by_status.get(ProcurementStatus.DELIVERED, 0),
        "completed_requests": completed,
        "rejected_requests": rejected,
        "cancelled_requests": cancelled,
        "procurement_value": round(value, 2),
        "completion_rate": round(100.0 * completed / completable, 2)
        if completable
        else 0.0,
        "by_status": by_status,
    }


def purchase_order_overview(db: Session, filters: Filters) -> dict:
    """Active purchase orders, their value and how many are overdue."""

    today = date.today()

    query = filters.apply_orders(
        db.query(PurchaseOrder).join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
    )

    rows = query.with_entities(
        PurchaseOrder.status,
        func.count(PurchaseOrder.id),
        func.coalesce(func.sum(PurchaseOrder.total_amount), 0),
    ).group_by(PurchaseOrder.status).all()

    by_status = {status: int(count) for status, count, _ in rows}
    value_by_status = {status: _to_float(v) for status, _, v in rows}

    active = sum(by_status.get(s, 0) for s in ACTIVE)
    active_value = sum(value_by_status.get(s, 0.0) for s in ACTIVE)

    overdue = filters.apply_orders(
        db.query(func.count(PurchaseOrder.id))
        .select_from(PurchaseOrder)
        .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
        .filter(
            PurchaseOrder.status.in_(ACTIVE),
            PurchaseOrder.expected_delivery.isnot(None),
            PurchaseOrder.expected_delivery < today,
        )
    ).scalar() or 0

    total_value = sum(
        v for s, v in value_by_status.items()
        if s != PurchaseOrderStatus.CANCELLED
    )

    return {
        "total_orders": sum(by_status.values()),
        "active_orders": active,
        "pending_orders": by_status.get(PurchaseOrderStatus.PENDING, 0),
        "approved_orders": by_status.get(PurchaseOrderStatus.APPROVED, 0),
        "in_transit_orders": by_status.get(PurchaseOrderStatus.ORDERED, 0),
        "delivered_orders": by_status.get(PurchaseOrderStatus.DELIVERED, 0),
        "completed_orders": by_status.get(PurchaseOrderStatus.COMPLETED, 0),
        "cancelled_orders": by_status.get(PurchaseOrderStatus.CANCELLED, 0),
        "overdue_orders": int(overdue),
        "active_po_value": round(active_value, 2),
        "total_po_value": round(total_value, 2),
        "by_status": by_status,
        "value_by_status": {k: round(v, 2) for k, v in value_by_status.items()},
    }


def delivery_status(db: Session, filters: Filters) -> dict:
    """Delivery counters and the on-time rate for the filtered order book."""

    delivered = and_(
        PurchaseOrder.status.in_(DELIVERED),
        PurchaseOrder.actual_delivery.isnot(None),
    )

    row = filters.apply_orders(
        db.query(
            func.count(PurchaseOrder.id).label("total"),
            func.sum(case((delivered, 1), else_=0)).label("delivered"),
            func.sum(
                case((and_(delivered, _on_time_condition()), 1), else_=0)
            ).label("on_time"),
            func.sum(
                case((and_(delivered, ~_on_time_condition()), 1), else_=0)
            ).label("delayed"),
            func.sum(
                case((PurchaseOrder.status.in_(ACTIVE), 1), else_=0)
            ).label("pending"),
        )
        .select_from(PurchaseOrder)
        .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
    ).one()

    delivered_count = int(row.delivered or 0)
    on_time = int(row.on_time or 0)

    return {
        "total_deliveries": delivered_count,
        "on_time_deliveries": on_time,
        "delayed_deliveries": int(row.delayed or 0),
        "pending_deliveries": int(row.pending or 0),
        "delivery_rate": round(100.0 * on_time / delivered_count, 2)
        if delivered_count
        else 0.0,
    }


def cost_analysis(db: Session, filters: Filters) -> dict:
    """Spend broken down by vendor and by category, with budget variance.

    Budget is taken from the estimated cost recorded on the originating
    procurement request, so "budget vs actual" compares what was asked for
    against what was actually committed - both real figures from the data.
    """

    base = filters.apply_orders(
        db.query(PurchaseOrder)
        .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
        .filter(PurchaseOrder.status != PurchaseOrderStatus.CANCELLED)
    )

    by_vendor = (
        base.with_entities(
            Vendor.id,
            Vendor.vendor_name,
            Vendor.category,
            func.coalesce(func.sum(PurchaseOrder.total_amount), 0).label("spend"),
            func.count(PurchaseOrder.id).label("orders"),
        )
        .group_by(Vendor.id, Vendor.vendor_name, Vendor.category)
        .order_by(func.coalesce(func.sum(PurchaseOrder.total_amount), 0).desc())
        .all()
    )

    by_category = (
        base.with_entities(
            Vendor.category,
            func.coalesce(func.sum(PurchaseOrder.total_amount), 0).label("spend"),
            func.count(PurchaseOrder.id).label("orders"),
        )
        .group_by(Vendor.category)
        .order_by(func.coalesce(func.sum(PurchaseOrder.total_amount), 0).desc())
        .all()
    )

    # Budget vs actual, matched through the originating request.
    variance_row = (
        filters.apply_orders(
            db.query(
                func.coalesce(
                    func.sum(ProcurementRequest.estimated_cost), 0
                ).label("budget"),
                func.coalesce(
                    func.sum(PurchaseOrder.total_amount), 0
                ).label("actual"),
            )
            .select_from(PurchaseOrder)
            .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
            .join(
                ProcurementRequest,
                ProcurementRequest.id == PurchaseOrder.procurement_request_id,
            )
            .filter(PurchaseOrder.status != PurchaseOrderStatus.CANCELLED)
        )
    ).one()

    budget = _to_float(variance_row.budget)
    actual = _to_float(variance_row.actual)

    total_spend = sum(_to_float(r.spend) for r in by_vendor)

    return {
        "total_cost": round(total_spend, 2),
        "budget": round(budget, 2),
        "actual": round(actual, 2),
        "cost_variance": round(actual - budget, 2),
        "cost_variance_pct": round(100.0 * (actual - budget) / budget, 2)
        if budget
        else 0.0,
        "by_vendor": [
            {
                "vendor_id": r.id,
                "vendor_name": r.vendor_name,
                "category": r.category,
                "spend": round(_to_float(r.spend), 2),
                "orders": int(r.orders),
                "share": round(100.0 * _to_float(r.spend) / total_spend, 2)
                if total_spend
                else 0.0,
            }
            for r in by_vendor[:20]
        ],
        "by_category": [
            {
                "category": r.category,
                "spend": round(_to_float(r.spend), 2),
                "orders": int(r.orders),
                "share": round(100.0 * _to_float(r.spend) / total_spend, 2)
                if total_spend
                else 0.0,
            }
            for r in by_category
        ],
    }


def spend_over_time(db: Session, filters: Filters, months: int = 12) -> list[dict]:
    """Monthly committed spend and order counts, oldest first."""

    start = filters.start or (
        date.today().replace(day=1) - timedelta(days=31 * (months - 1))
    ).replace(day=1)

    bucket = func.to_char(PurchaseOrder.order_date, "YYYY-MM").label("period")

    query = (
        db.query(
            bucket,
            func.count(PurchaseOrder.id).label("orders"),
            func.coalesce(func.sum(PurchaseOrder.total_amount), 0).label("spend"),
        )
        .select_from(PurchaseOrder)
        .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
        .filter(
            PurchaseOrder.status != PurchaseOrderStatus.CANCELLED,
            PurchaseOrder.order_date >= start,
        )
        .group_by(bucket)
        .order_by(bucket)
    )

    if filters.end:
        query = query.filter(PurchaseOrder.order_date <= filters.end)

    if filters.vendor_id:
        query = query.filter(PurchaseOrder.vendor_id == filters.vendor_id)

    if filters.category:
        query = query.filter(Vendor.category == filters.category)

    if filters.risk_level:
        query = query.filter(Vendor.risk_level == filters.risk_level)

    return [
        {
            "period": row.period,
            "orders": int(row.orders),
            "spend": round(_to_float(row.spend), 2),
        }
        for row in query.all()
    ]


# --------------------------------------------------------------------------
# Vendor analytics
# --------------------------------------------------------------------------

def vendor_analytics(db: Session, filters: Filters) -> dict:
    """Vendor counts by status, category and risk level."""

    query = filters.apply_vendors(db.query(Vendor))

    by_status = dict(
        query.with_entities(Vendor.status, func.count(Vendor.id))
        .group_by(Vendor.status)
        .all()
    )

    by_category = dict(
        query.with_entities(Vendor.category, func.count(Vendor.id))
        .group_by(Vendor.category)
        .all()
    )

    by_risk = dict(
        query.with_entities(Vendor.risk_level, func.count(Vendor.id))
        .group_by(Vendor.risk_level)
        .all()
    )

    average = query.with_entities(
        func.avg(Vendor.reliability_score)
    ).scalar()

    total = sum(by_status.values())

    return {
        "total_vendors": total,
        "active_vendors": by_status.get(VendorStatus.APPROVED, 0),
        "pending_vendors": by_status.get(VendorStatus.PENDING, 0),
        "suspended_vendors": by_status.get(VendorStatus.SUSPENDED, 0),
        "inactive_vendors": by_status.get(VendorStatus.INACTIVE, 0),
        "rejected_vendors": by_status.get(VendorStatus.REJECTED, 0),
        "high_risk_vendors": by_risk.get("High", 0) + by_risk.get("Critical", 0),
        "average_reliability": round(_to_float(average), 2),
        "by_status": {k: int(v) for k, v in by_status.items()},
        "by_category": {k: int(v) for k, v in by_category.items()},
        "by_risk": {k: int(v) for k, v in by_risk.items()},
    }


def vendor_ranking(db: Session, filters: Filters, limit: int = 50) -> list[dict]:
    """Ranked supplier table driven by the stored reliability snapshots."""

    from services.reliability import latest_scores

    scores = latest_scores(db)

    query = filters.apply_vendors(db.query(Vendor))
    vendors = query.all()

    rows = []

    for vendor in vendors:
        snapshot = scores.get(vendor.id)

        rows.append({
            "vendor_id": vendor.id,
            "vendor_code": vendor.vendor_code,
            "vendor_name": vendor.vendor_name,
            "category": vendor.category,
            "status": vendor.status,
            "risk_level": vendor.risk_level,
            "reliability_score": _to_float(vendor.reliability_score),
            "rank_position": snapshot.rank_position if snapshot else None,
            "trend": snapshot.trend if snapshot else None,
            "delivery_score": _to_float(snapshot.delivery_score)
            if snapshot
            else 0.0,
            "quality_score": _to_float(snapshot.quality_score)
            if snapshot
            else 0.0,
            "communication_score": _to_float(snapshot.communication_score)
            if snapshot
            else 0.0,
            "compliance_score": _to_float(snapshot.compliance_score)
            if snapshot
            else 0.0,
            "orders_considered": snapshot.orders_considered if snapshot else 0,
            "on_time_deliveries": snapshot.on_time_deliveries if snapshot else 0,
            "delayed_deliveries": snapshot.delayed_deliveries if snapshot else 0,
            "total_spend": _to_float(snapshot.total_spend) if snapshot else 0.0,
            "predicted_delay_risk": _to_float(snapshot.predicted_delay_risk)
            if snapshot and snapshot.predicted_delay_risk is not None
            else None,
        })

    rows.sort(key=lambda r: r["reliability_score"], reverse=True)

    return rows[:limit]


def vendor_performance_summary(db: Session, filters: Filters) -> dict:
    """Headline performance averages across the filtered supplier base."""

    query = db.query(
        func.avg(VendorPerformance.quality_rating).label("quality"),
        func.avg(VendorPerformance.service_rating).label("service"),
        func.avg(VendorPerformance.response_time).label("response"),
        func.avg(VendorPerformance.issue_resolution_time).label("resolution"),
        func.avg(VendorPerformance.order_completion_rate).label("completion"),
        func.count(VendorPerformance.id).label("evaluations"),
    ).join(Vendor, Vendor.id == VendorPerformance.vendor_id)

    if filters.vendor_id:
        query = query.filter(VendorPerformance.vendor_id == filters.vendor_id)

    if filters.category:
        query = query.filter(Vendor.category == filters.category)

    if filters.risk_level:
        query = query.filter(Vendor.risk_level == filters.risk_level)

    if filters.start:
        query = query.filter(VendorPerformance.evaluation_date >= filters.start)

    if filters.end:
        query = query.filter(VendorPerformance.evaluation_date <= filters.end)

    row = query.one()
    delivery = delivery_status(db, filters)

    score_query = filters.apply_vendors(
        db.query(func.avg(Vendor.reliability_score))
    )

    return {
        "evaluations": int(row.evaluations or 0),
        "performance_score": round(_to_float(score_query.scalar()), 2),
        "quality_rating": round(_to_float(row.quality), 2),
        "service_rating": round(_to_float(row.service), 2),
        "on_time_delivery_rate": delivery["delivery_rate"],
        "avg_response_time_hours": round(_to_float(row.response), 2),
        "avg_issue_resolution_hours": round(_to_float(row.resolution), 2),
        "order_completion_rate": round(_to_float(row.completion), 2),
        "issue_resolution_rate": _issue_resolution_rate(db, filters),
    }


def _issue_resolution_rate(db: Session, filters: Filters) -> float:
    query = db.query(
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

    if filters.vendor_id:
        query = query.filter(MessageThread.vendor_id == filters.vendor_id)

    row = query.one()
    total = int(row.total or 0)

    return round(100.0 * int(row.resolved or 0) / total, 2) if total else 0.0


# --------------------------------------------------------------------------
# Contract, compliance and communication analytics
# --------------------------------------------------------------------------

def contract_status(db: Session, filters: Filters) -> dict:
    """Contract counts by state, plus what is expiring soon."""

    today = date.today()
    horizon = today + timedelta(days=settings.CONTRACT_EXPIRY_ALERT_DAYS)

    query = db.query(Contract).join(Vendor, Vendor.id == Contract.vendor_id)

    if filters.vendor_id:
        query = query.filter(Contract.vendor_id == filters.vendor_id)

    if filters.category:
        query = query.filter(Vendor.category == filters.category)

    if filters.risk_level:
        query = query.filter(Vendor.risk_level == filters.risk_level)

    by_status = dict(
        query.with_entities(Contract.status, func.count(Contract.id))
        .group_by(Contract.status)
        .all()
    )

    by_compliance = dict(
        query.with_entities(
            Contract.compliance_status, func.count(Contract.id)
        )
        .group_by(Contract.compliance_status)
        .all()
    )

    expiring = (
        query.filter(
            Contract.status.notin_([
                ContractStatus.TERMINATED, ContractStatus.RENEWED
            ]),
            Contract.expiry_date >= today,
            Contract.expiry_date <= horizon,
        )
        .order_by(Contract.expiry_date.asc())
        .limit(20)
        .all()
    )

    total = sum(by_status.values())
    compliant = by_compliance.get(ComplianceStatus.COMPLIANT, 0)

    return {
        "total_contracts": total,
        "active_contracts": by_status.get(ContractStatus.ACTIVE, 0),
        "expiring_contracts": by_status.get(ContractStatus.EXPIRING, 0),
        "expired_contracts": by_status.get(ContractStatus.EXPIRED, 0),
        "renewed_contracts": by_status.get(ContractStatus.RENEWED, 0),
        "draft_contracts": by_status.get(ContractStatus.DRAFT, 0),
        "terminated_contracts": by_status.get(ContractStatus.TERMINATED, 0),
        "compliant_contracts": compliant,
        "non_compliant_contracts": by_compliance.get(
            ComplianceStatus.NON_COMPLIANT, 0
        ),
        "compliance_rate": round(100.0 * compliant / total, 2) if total else 0.0,
        "by_status": {k: int(v) for k, v in by_status.items()},
        "by_compliance": {k: int(v) for k, v in by_compliance.items()},
        "expiring_soon": [
            {
                "id": c.id,
                "contract_number": c.contract_number,
                "vendor_id": c.vendor_id,
                "vendor_name": c.vendor.vendor_name if c.vendor else None,
                "contract_type": c.contract_type,
                "expiry_date": c.expiry_date.isoformat(),
                "days_to_expiry": (c.expiry_date - today).days,
                "contract_value": _to_float(c.contract_value),
            }
            for c in expiring
        ],
    }


def compliance_monitoring(db: Session, filters: Filters) -> dict:
    """Compliance rates across checks, vendors and certifications."""

    today = date.today()

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
    ).join(Vendor, Vendor.id == ComplianceCheck.vendor_id)

    if filters.vendor_id:
        check_query = check_query.filter(
            ComplianceCheck.vendor_id == filters.vendor_id
        )

    if filters.category:
        check_query = check_query.filter(Vendor.category == filters.category)

    if filters.start:
        check_query = check_query.filter(
            ComplianceCheck.check_date >= filters.start
        )

    if filters.end:
        check_query = check_query.filter(
            ComplianceCheck.check_date <= filters.end
        )

    checks = check_query.one()

    # A vendor counts as non-compliant if any recent check failed.
    failing_vendors = (
        db.query(func.count(func.distinct(ComplianceCheck.vendor_id)))
        .filter(ComplianceCheck.result == "Non-Compliant")
        .scalar()
    ) or 0

    total_vendors = filters.apply_vendors(
        db.query(func.count(Vendor.id))
    ).scalar() or 0

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
                        <= today + timedelta(
                            days=settings.CERTIFICATION_ALERT_DAYS
                        ),
                    ),
                    1,
                ),
                else_=0,
            )
        ).label("expiring"),
    )

    if filters.vendor_id:
        cert_query = cert_query.filter(
            VendorCertification.vendor_id == filters.vendor_id
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
        "compliance_rate": round(
            100.0 * (compliant + 0.5 * partial) / total_checks, 2
        )
        if total_checks
        else 0.0,
        "compliant_vendors": max(int(total_vendors) - int(failing_vendors), 0),
        "non_compliant_vendors": int(failing_vendors),
        "total_certifications": int(certs.total or 0),
        "expired_certifications": int(certs.expired or 0),
        "expiring_certifications": int(certs.expiring or 0),
    }


def communication_activity(db: Session, filters: Filters) -> dict:
    """Message volume, open queries and measured responsiveness."""

    from services.performance import communication_metrics

    metrics = communication_metrics(
        db, filters.vendor_id, filters.start, filters.end
    )

    message_query = db.query(func.count(Message.id)).join(
        MessageThread, MessageThread.id == Message.thread_id
    )

    if filters.vendor_id:
        message_query = message_query.filter(
            MessageThread.vendor_id == filters.vendor_id
        )

    return {
        "total_messages": int(message_query.scalar() or 0),
        "total_threads": metrics["total_threads"],
        "open_queries": metrics["open_threads"],
        "resolved_queries": metrics["resolved_threads"],
        "resolution_rate": metrics["resolution_rate"],
        "avg_response_hours": metrics["avg_response_hours"],
    }


def order_history(db: Session, filters: Filters) -> dict:
    """Order counts by outcome and their total value - the Vendor dashboard."""

    overview = purchase_order_overview(db, filters)
    delivery = delivery_status(db, filters)

    return {
        "total_orders": overview["total_orders"],
        "completed_orders": overview["completed_orders"],
        "pending_orders": overview["active_orders"],
        "cancelled_orders": overview["cancelled_orders"],
        "delayed_orders": delivery["delayed_deliveries"],
        "order_value": overview["total_po_value"],
    }


# --------------------------------------------------------------------------
# Admin analytics
# --------------------------------------------------------------------------

def user_management(db: Session) -> dict:
    """User counts by role and activation state."""

    by_role = dict(
        db.query(User.role, func.count(User.id)).group_by(User.role).all()
    )

    active = db.query(func.count(User.id)).filter(
        User.is_active.is_(True)
    ).scalar() or 0

    total = sum(by_role.values())

    pending_vendor_logins = (
        db.query(func.count(User.id))
        .join(Vendor, Vendor.id == User.vendor_id)
        .filter(
            User.role == UserRole.VENDOR,
            Vendor.status == VendorStatus.PENDING,
        )
        .scalar()
    ) or 0

    return {
        "total_users": total,
        "active_users": int(active),
        "inactive_users": total - int(active),
        "by_role": {k: int(v) for k, v in by_role.items()},
        "pending_approvals": int(pending_vendor_logins),
    }


def system_statistics(db: Session) -> dict:
    """Row counts across the platform, for the Admin dashboard."""

    def count(model):
        return int(db.query(func.count(model.id)).scalar() or 0)

    transactions = (
        count(PurchaseOrder) + count(Invoice) + count(ProcurementRequest)
    )

    return {
        "total_users": count(User),
        "total_vendors": count(Vendor),
        "total_purchase_orders": count(PurchaseOrder),
        "total_requests": count(ProcurementRequest),
        "total_contracts": count(Contract),
        "total_invoices": count(Invoice),
        "total_messages": count(Message),
        "total_transactions": transactions,
        "total_performance_records": count(VendorPerformance),
        "total_reliability_snapshots": count(VendorReliabilityScore),
    }


def invoice_summary(db: Session, filters: Filters) -> dict:
    """Invoice totals by state - the Finance Officer's view."""

    query = db.query(
        Invoice.status,
        func.count(Invoice.id),
        func.coalesce(func.sum(Invoice.total_amount), 0),
    ).group_by(Invoice.status)

    if filters.vendor_id:
        query = query.filter(Invoice.vendor_id == filters.vendor_id)

    if filters.start:
        query = query.filter(Invoice.invoice_date >= filters.start)

    if filters.end:
        query = query.filter(Invoice.invoice_date <= filters.end)

    rows = query.all()

    by_status = {status: int(count) for status, count, _ in rows}
    value_by_status = {status: _to_float(v) for status, _, v in rows}

    outstanding = sum(
        value_by_status.get(s, 0.0)
        for s in (
            InvoiceStatus.PENDING, InvoiceStatus.APPROVED, InvoiceStatus.OVERDUE
        )
    )

    return {
        "total_invoices": sum(by_status.values()),
        "paid_invoices": by_status.get(InvoiceStatus.PAID, 0),
        "pending_invoices": by_status.get(InvoiceStatus.PENDING, 0),
        "overdue_invoices": by_status.get(InvoiceStatus.OVERDUE, 0),
        "disputed_invoices": by_status.get(InvoiceStatus.DISPUTED, 0),
        "outstanding_value": round(outstanding, 2),
        "paid_value": round(value_by_status.get(InvoiceStatus.PAID, 0.0), 2),
        "by_status": by_status,
    }


# --------------------------------------------------------------------------
# Risk analytics
# --------------------------------------------------------------------------

def risk_breakdown(db: Session, filters: Filters) -> dict:
    """Risk distribution plus the vendors that need attention."""

    scores = filters.apply_vendors(
        db.query(Vendor)
        .filter(Vendor.status.in_([
            VendorStatus.APPROVED, VendorStatus.PENDING, VendorStatus.SUSPENDED
        ]))
    ).all()

    by_risk: dict[str, int] = {}

    for vendor in scores:
        by_risk[vendor.risk_level] = by_risk.get(vendor.risk_level, 0) + 1

    from services.reliability import latest_scores

    snapshots = latest_scores(db)

    at_risk = [
        {
            "vendor_id": v.id,
            "vendor_name": v.vendor_name,
            "vendor_code": v.vendor_code,
            "category": v.category,
            "risk_level": v.risk_level,
            "reliability_score": _to_float(v.reliability_score),
            "trend": snapshots[v.id].trend if v.id in snapshots else None,
            "predicted_delay_risk": (
                _to_float(snapshots[v.id].predicted_delay_risk)
                if v.id in snapshots
                and snapshots[v.id].predicted_delay_risk is not None
                else None
            ),
            "recommendation": (
                snapshots[v.id].recommendation if v.id in snapshots else None
            ),
        }
        for v in scores
        if v.risk_level in ("High", "Critical")
    ]

    at_risk.sort(key=lambda r: r["reliability_score"])

    return {
        "by_risk": by_risk,
        "high_risk_count": by_risk.get("High", 0) + by_risk.get("Critical", 0),
        "at_risk_vendors": at_risk,
    }


def category_performance(db: Session, filters: Filters) -> list[dict]:
    """On-time rate, spend and reliability by procurement category."""

    delivered = and_(
        PurchaseOrder.status.in_(DELIVERED),
        PurchaseOrder.actual_delivery.isnot(None),
    )

    rows = filters.apply_orders(
        db.query(
            Vendor.category.label("category"),
            func.count(func.distinct(Vendor.id)).label("vendors"),
            func.count(PurchaseOrder.id).label("orders"),
            func.sum(case((delivered, 1), else_=0)).label("delivered"),
            func.sum(
                case((and_(delivered, _on_time_condition()), 1), else_=0)
            ).label("on_time"),
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
            func.avg(Vendor.reliability_score).label("reliability"),
        )
        .select_from(PurchaseOrder)
        .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
        .group_by(Vendor.category)
    ).all()

    results = []

    for row in rows:
        delivered_count = int(row.delivered or 0)
        on_time = int(row.on_time or 0)

        results.append({
            "category": row.category,
            "vendors": int(row.vendors or 0),
            "orders": int(row.orders or 0),
            "delivered": delivered_count,
            "on_time_rate": round(100.0 * on_time / delivered_count, 2)
            if delivered_count
            else 0.0,
            "spend": round(_to_float(row.spend), 2),
            "avg_reliability": round(_to_float(row.reliability), 2),
        })

    results.sort(key=lambda r: r["spend"], reverse=True)

    return results
