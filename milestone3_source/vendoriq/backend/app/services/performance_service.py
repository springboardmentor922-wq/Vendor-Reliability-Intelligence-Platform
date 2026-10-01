"""Vendor Performance module: every metric here is computed live from stored
procurement, quality-evaluation, issue and message records — never typed in
by hand, per the project's non-negotiable requirements."""
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.purchase_order import PurchaseOrder, POStatus
from app.models.performance import QualityEvaluation, Issue, IssueStatus
from app.models.communication import Message
from app.models.user import User, UserRole
from app.models.vendor import Vendor


def _delivered_orders_query(db: Session, vendor_id: int):
    return db.query(PurchaseOrder).filter(
        PurchaseOrder.vendor_id == vendor_id,
        PurchaseOrder.status.in_([POStatus.DELIVERED, POStatus.COMPLETED]),
        PurchaseOrder.actual_delivery_date.isnot(None),
        PurchaseOrder.expected_delivery_date.isnot(None),
    )


def compute_delivery_metrics(db: Session, vendor_id: int) -> tuple[int, int]:
    """Delivery Performance Monitoring: compare expected vs actual dates."""
    orders = _delivered_orders_query(db, vendor_id).all()
    on_time = sum(1 for o in orders if o.actual_delivery_date <= o.expected_delivery_date)
    delayed = len(orders) - on_time
    return on_time, delayed


def compute_quality_rating(db: Session, vendor_id: int) -> float:
    """Product Quality Evaluation average, 0-5 scale."""
    avg = db.query(func.avg(QualityEvaluation.rating)).filter(QualityEvaluation.vendor_id == vendor_id).scalar()
    return round(float(avg), 2) if avg is not None else 0.0


def compute_response_time_hours(db: Session, vendor_id: int) -> Optional[float]:
    """Communication Response Tracking: average time between a message sent
    to the vendor thread by organization staff and the vendor's next reply
    in that same thread."""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor or not vendor.user_id:
        return None

    messages = (
        db.query(Message)
        .filter(Message.vendor_id == vendor_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    if len(messages) < 2:
        return None

    deltas = []
    pending_staff_message_time = None
    for m in messages:
        if m.sender_id == vendor.user_id:
            if pending_staff_message_time is not None:
                delta = (m.created_at - pending_staff_message_time).total_seconds() / 3600.0
                if delta >= 0:
                    deltas.append(delta)
                pending_staff_message_time = None
        else:
            pending_staff_message_time = m.created_at

    if not deltas:
        return None
    return round(sum(deltas) / len(deltas), 2)


def compute_issue_resolution_hours(db: Session, vendor_id: int) -> Optional[float]:
    """Average time from an issue being raised to being resolved."""
    issues = (
        db.query(Issue)
        .filter(Issue.vendor_id == vendor_id, Issue.status == IssueStatus.RESOLVED, Issue.resolved_at.isnot(None))
        .all()
    )
    if not issues:
        return None
    hours = [(i.resolved_at - i.raised_at).total_seconds() / 3600.0 for i in issues]
    return round(sum(hours) / len(hours), 2)


def compute_order_completion_rate(db: Session, vendor_id: int) -> tuple[float, int]:
    total = db.query(func.count(PurchaseOrder.id)).filter(
        PurchaseOrder.vendor_id == vendor_id, PurchaseOrder.status != POStatus.CANCELLED
    ).scalar() or 0
    completed = db.query(func.count(PurchaseOrder.id)).filter(
        PurchaseOrder.vendor_id == vendor_id, PurchaseOrder.status == POStatus.COMPLETED
    ).scalar() or 0
    rate = round((completed / total) * 100, 2) if total else 0.0
    return rate, total


def get_vendor_metrics(db: Session, vendor_id: int) -> dict:
    on_time, delayed = compute_delivery_metrics(db, vendor_id)
    total_delivered = on_time + delayed
    on_time_rate = round((on_time / total_delivered) * 100, 2) if total_delivered else 0.0
    completion_rate, total_orders = compute_order_completion_rate(db, vendor_id)
    open_issues = db.query(func.count(Issue.id)).filter(
        Issue.vendor_id == vendor_id, Issue.status != IssueStatus.RESOLVED
    ).scalar() or 0

    return {
        "vendor_id": vendor_id,
        "on_time_deliveries": on_time,
        "delayed_deliveries": delayed,
        "total_delivered": total_delivered,
        "on_time_rate": on_time_rate,
        "quality_rating": compute_quality_rating(db, vendor_id),
        "avg_response_time_hours": compute_response_time_hours(db, vendor_id),
        "avg_issue_resolution_hours": compute_issue_resolution_hours(db, vendor_id),
        "order_completion_rate": completion_rate,
        "total_orders": total_orders,
        "open_issues": open_issues,
    }


def create_snapshot(db: Session, vendor_id: int, period: Optional[str] = None):
    """Persist the current computed metrics as a dated snapshot, so
    Performance Trend Analysis has real history to compare against.
    In production this would be invoked by a scheduled job (e.g. Celery
    beat, monthly); here it is triggered on demand via the API."""
    from app.models.performance import PerformanceSnapshot

    period = period or datetime.utcnow().strftime("%Y-%m")
    metrics = get_vendor_metrics(db, vendor_id)

    snapshot = PerformanceSnapshot(
        vendor_id=vendor_id,
        period=period,
        on_time_deliveries=metrics["on_time_deliveries"],
        delayed_deliveries=metrics["delayed_deliveries"],
        quality_rating=metrics["quality_rating"],
        response_time_hours=metrics["avg_response_time_hours"],
        issue_resolution_hours=metrics["avg_issue_resolution_hours"],
        completion_rate=metrics["order_completion_rate"],
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot
