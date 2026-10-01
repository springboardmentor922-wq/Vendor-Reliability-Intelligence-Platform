from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import (
    get_current_user,
    get_current_vendor,
    require_admin,
    require_analytics,
    require_operations_read,
)
from app.db.session_dep import get_db
from app.models.user import User
from app.models.vendor import Vendor, VendorStatus
from app.models.procurement import ProcurementRequest, ProcurementStatus
from app.models.purchase_order import PurchaseOrder, POStatus
from app.models.contract import Contract, ContractStatus, Certification, CertificationStatus
from app.models.communication import Message
from app.services import reliability_service, performance_service

router = APIRouter()


# ============================================================
# PROCUREMENT DASHBOARD
# ============================================================

@router.get("/procurement-dashboard")
def procurement_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analytics),
):
    """Procurement dashboard with live procurement, PO,
    vendor performance and delivery metrics."""

    total_requests = (
        db.query(func.count(ProcurementRequest.id)).scalar() or 0
    )

    by_status = dict(
        db.query(
            ProcurementRequest.status,
            func.count(ProcurementRequest.id),
        )
        .group_by(ProcurementRequest.status)
        .all()
    )

    completed = by_status.get(ProcurementStatus.COMPLETED, 0)

    completion_rate = (
        round((completed / total_requests) * 100, 2)
        if total_requests
        else 0.0
    )

    procurement_value = (
        db.query(
            func.coalesce(
                func.sum(PurchaseOrder.total_amount),
                0.0,
            )
        ).scalar()
        or 0.0
    )

    total_pos = (
        db.query(func.count(PurchaseOrder.id)).scalar() or 0
    )

    active_pos = (
        db.query(func.count(PurchaseOrder.id))
        .filter(
            PurchaseOrder.status.in_(
                [POStatus.APPROVED, POStatus.ORDERED]
            )
        )
        .scalar()
        or 0
    )

    pending_pos = (
        db.query(func.count(PurchaseOrder.id))
        .filter(
            PurchaseOrder.status == POStatus.PENDING
        )
        .scalar()
        or 0
    )

    in_transit_pos = (
        db.query(func.count(PurchaseOrder.id))
        .filter(
            PurchaseOrder.status == POStatus.ORDERED
        )
        .scalar()
        or 0
    )

    from datetime import datetime

    overdue_pos = (
        db.query(func.count(PurchaseOrder.id))
        .filter(
            PurchaseOrder.status.in_(
                [POStatus.ORDERED, POStatus.APPROVED]
            ),
            PurchaseOrder.expected_delivery_date.isnot(None),
            PurchaseOrder.expected_delivery_date < datetime.utcnow(),
        )
        .scalar()
        or 0
    )

    po_value = (
        db.query(
            func.coalesce(
                func.sum(PurchaseOrder.total_amount),
                0.0,
            )
        ).scalar()
        or 0.0
    )

    delivered_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status.in_(
                [POStatus.DELIVERED, POStatus.COMPLETED]
            ),
            PurchaseOrder.actual_delivery_date.isnot(None),
            PurchaseOrder.expected_delivery_date.isnot(None),
        )
        .all()
    )

    on_time = sum(
        1
        for order in delivered_orders
        if order.actual_delivery_date <= order.expected_delivery_date
    )

    delayed = len(delivered_orders) - on_time

    pending_delivery = (
        db.query(func.count(PurchaseOrder.id))
        .filter(
            PurchaseOrder.status == POStatus.ORDERED
        )
        .scalar()
        or 0
    )

    vendors = (
        db.query(Vendor)
        .filter(
            Vendor.status.in_(
                [VendorStatus.APPROVED, VendorStatus.ACTIVE]
            )
        )
        .all()
    )

    scores = [
        reliability_service.get_latest_score(db, vendor.id)
        for vendor in vendors
    ]

    scores = [score for score in scores if score]

    avg_perf = (
        round(
            sum(score.score for score in scores)
            / len(scores),
            2,
        )
        if scores
        else 0.0
    )

    avg_quality = (
        round(
            sum(score.quality_score for score in scores)
            / len(scores),
            2,
        )
        if scores
        else 0.0
    )

    avg_on_time_rate = (
        round(
            (on_time / len(delivered_orders)) * 100,
            2,
        )
        if delivered_orders
        else 0.0
    )

    response_values = [
        performance_service.compute_response_time_hours(
            db,
            vendor.id,
        )
        for vendor in vendors
    ]

    response_values = [
        value for value in response_values
        if value is not None
    ]

    avg_response = (
        round(
            sum(response_values) / len(response_values),
            2,
        )
        if response_values
        else None
    )

    cost_by_category = {}

    for po in db.query(PurchaseOrder).all():

        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == po.vendor_id)
            .first()
        )

        category = (
            vendor.category.value
            if vendor
            else "unknown"
        )

        cost_by_category[category] = (
            cost_by_category.get(category, 0.0)
            + po.total_amount
        )

    return {
        "procurement_overview": {
            "total_requests": total_requests,
            "pending_requests": by_status.get(
                ProcurementStatus.PENDING,
                0,
            ),
            "approved_requests": by_status.get(
                ProcurementStatus.APPROVED,
                0,
            ),
            "completed_requests": completed,
            "procurement_value": procurement_value,
            "completion_rate": completion_rate,
        },

        "active_purchase_orders": {
            "total": total_pos,
            "active": active_pos,
            "pending": pending_pos,
            "in_transit": in_transit_pos,
            "overdue": overdue_pos,
            "total_po_value": po_value,
        },

        "vendor_performance_summary": {
            "avg_performance_score": avg_perf,
            "avg_quality_rating": avg_quality,
            "avg_on_time_delivery_rate": avg_on_time_rate,
            "avg_response_time_hours": avg_response,
        },

        "procurement_cost_analysis": {
            "total_cost": po_value,
            "cost_by_category": cost_by_category,
        },

        "delivery_status": {
            "total_deliveries": len(delivered_orders),
            "on_time_deliveries": on_time,
            "delayed_deliveries": delayed,
            "pending_deliveries": pending_delivery,
            "delivery_rate": avg_on_time_rate,
        },
    }


# ============================================================
# VENDOR DASHBOARD
# ============================================================
@router.get("/vendor-dashboard/me")
def vendor_dashboard_me(
    db: Session = Depends(get_db),
    current_vendor: Vendor = Depends(get_current_vendor),
):
    """
    Return dashboard data for the currently authenticated vendor.
    """

    vendor_id = current_vendor.id

    metrics = performance_service.get_vendor_metrics(
        db,
        vendor_id,
    )

    latest_score = reliability_service.get_latest_score(
        db,
        vendor_id,
    )

    contracts = (
        db.query(Contract)
        .filter(Contract.vendor_id == vendor_id)
        .all()
    )

    contract_status_counts = {}

    for contract in contracts:
        status = contract.status.value

        contract_status_counts[status] = (
            contract_status_counts.get(status, 0) + 1
        )

    orders = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.vendor_id == vendor_id)
        .all()
    )

    order_value = sum(
        order.total_amount
        for order in orders
    )

    order_status_counts = {}

    for order in orders:
        status = order.status.value

        order_status_counts[status] = (
            order_status_counts.get(status, 0) + 1
        )

    total_messages = (
        db.query(func.count(Message.id))
        .filter(Message.vendor_id == vendor_id)
        .scalar()
        or 0
    )

    return {
        "vendor": {
            "id": current_vendor.id,
            "company_name": current_vendor.company_name,
            "category": current_vendor.category.value,
            "status": current_vendor.status.value,
        },

        "vendor_performance": metrics,

        "reliability_score": (
            {
                "score": latest_score.score,
                "risk_level": latest_score.risk_level.value,
                "trend": latest_score.trend.value,
                "recommendation": latest_score.recommendation,
                "delivery_score": latest_score.delivery_score,
                "quality_score": latest_score.quality_score,
                "communication_score": latest_score.communication_score,
                "compliance_score": latest_score.compliance_score,
                "purchase_history_score": latest_score.purchase_history_score,
                "issue_resolution_score": latest_score.issue_resolution_score,
            }
            if latest_score
            else None
        ),

        "contract_status": contract_status_counts,

        "order_history": {
            "total_orders": len(orders),
            "total_value": order_value,
            "by_status": order_status_counts,
        },

        "communication_activity": {
            "total_messages": total_messages,
        },
    }


@router.get("/vendor-dashboard/{vendor_id}")
def vendor_dashboard(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Vendor dashboard.

    Administrators and authorized internal users can inspect
    vendor dashboards. Vendor users are restricted to their
    own vendor profile.
    """

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    # Vendor users can only access their own vendor
    if current_user.role.value == "vendor":

        if vendor.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only access your own vendor dashboard",
            )

    metrics = performance_service.get_vendor_metrics(
        db,
        vendor_id,
    )

    latest_score = reliability_service.get_latest_score(
        db,
        vendor_id,
    )

    contracts = (
        db.query(Contract)
        .filter(Contract.vendor_id == vendor_id)
        .all()
    )

    contract_status_counts = {}

    for contract in contracts:
        status = contract.status.value

        contract_status_counts[status] = (
            contract_status_counts.get(status, 0) + 1
        )

    orders = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.vendor_id == vendor_id)
        .all()
    )

    order_value = sum(
        order.total_amount
        for order in orders
    )

    order_status_counts = {}

    for order in orders:

        status = order.status.value

        order_status_counts[status] = (
            order_status_counts.get(status, 0) + 1
        )

    total_messages = (
        db.query(func.count(Message.id))
        .filter(Message.vendor_id == vendor_id)
        .scalar()
        or 0
    )

    return {
        "vendor": {
            "id": vendor.id,
            "company_name": vendor.company_name,
            "category": vendor.category.value,
            "status": vendor.status.value,
        },

        "vendor_performance": metrics,

        "reliability_score": (
            {
                "score": latest_score.score,
                "risk_level": latest_score.risk_level.value,
                "trend": latest_score.trend.value,
                "recommendation": latest_score.recommendation,
                "delivery_score": latest_score.delivery_score,
                "quality_score": latest_score.quality_score,
                "communication_score": latest_score.communication_score,
                "compliance_score": latest_score.compliance_score,
                "purchase_history_score": latest_score.purchase_history_score,
                "issue_resolution_score": latest_score.issue_resolution_score,
            }
            if latest_score
            else None
        ),

        "contract_status": contract_status_counts,

        "order_history": {
            "total_orders": len(orders),
            "total_value": order_value,
            "by_status": order_status_counts,
        },

        "communication_activity": {
            "total_messages": total_messages,
        },
    }


# ============================================================
# ADMIN DASHBOARD
# ============================================================

@router.get("/admin-dashboard")
def admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analytics),
):
    """Administrator-only dashboard."""

    total_users = (
        db.query(func.count(User.id)).scalar() or 0
    )

    active_users = (
        db.query(func.count(User.id))
        .filter(User.is_active.is_(True))
        .scalar()
        or 0
    )

    users_by_role = dict(
        db.query(
            User.role,
            func.count(User.id),
        )
        .group_by(User.role)
        .all()
    )

    total_vendors = (
        db.query(func.count(Vendor.id)).scalar() or 0
    )

    active_vendors = (
        db.query(func.count(Vendor.id))
        .filter(
            Vendor.status.in_(
                [VendorStatus.APPROVED, VendorStatus.ACTIVE]
            )
        )
        .scalar()
        or 0
    )

    vendors_by_category = dict(
        db.query(
            Vendor.category,
            func.count(Vendor.id),
        )
        .group_by(Vendor.category)
        .all()
    )

    high_risk = 0

    for vendor in db.query(Vendor).all():

        latest = reliability_service.get_latest_score(
            db,
            vendor.id,
        )

        if latest and latest.risk_level.value == "high":
            high_risk += 1

    total_requests = (
        db.query(func.count(ProcurementRequest.id))
        .scalar()
        or 0
    )

    pending_approvals = (
        db.query(func.count(ProcurementRequest.id))
        .filter(
            ProcurementRequest.status
            == ProcurementStatus.PENDING
        )
        .scalar()
        or 0
    )

    total_pos = (
        db.query(func.count(PurchaseOrder.id))
        .scalar()
        or 0
    )

    procurement_value = (
        db.query(
            func.coalesce(
                func.sum(PurchaseOrder.total_amount),
                0.0,
            )
        )
        .scalar()
        or 0.0
    )

    total_certs = (
        db.query(func.count(Certification.id))
        .scalar()
        or 0
    )

    compliant_certs = (
        db.query(func.count(Certification.id))
        .filter(
            Certification.status
            == CertificationStatus.VALID
        )
        .scalar()
        or 0
    )

    expired_certs = (
        db.query(func.count(Certification.id))
        .filter(
            Certification.status
            == CertificationStatus.EXPIRED
        )
        .scalar()
        or 0
    )

    expiring_certs = (
        db.query(func.count(Certification.id))
        .filter(
            Certification.status
            == CertificationStatus.EXPIRING
        )
        .scalar()
        or 0
    )

    compliance_rate = (
        round(
            (compliant_certs / total_certs) * 100,
            2,
        )
        if total_certs
        else 0.0
    )

    total_contracts = (
        db.query(func.count(Contract.id))
        .scalar()
        or 0
    )

    total_messages = (
        db.query(func.count(Message.id))
        .scalar()
        or 0
    )

    return {
        "user_management": {
            "total": total_users,
            "active": active_users,
            "inactive": total_users - active_users,
            "by_role": {
                key.value: value
                for key, value in users_by_role.items()
            },
        },

        "vendor_analytics": {
            "total": total_vendors,
            "active": active_vendors,
            "by_category": {
                key.value: value
                for key, value in vendors_by_category.items()
            },
            "high_risk_vendors": high_risk,
        },

        "procurement_reports": {
            "requests": total_requests,
            "purchase_orders": total_pos,
            "procurement_value": procurement_value,
            "pending_approvals": pending_approvals,
        },

        "compliance_monitoring": {
            "compliance_rate": compliance_rate,
            "compliant_certifications": compliant_certs,
            "expired_certifications": expired_certs,
            "expiring_certifications": expiring_certs,
        },

        "system_statistics": {
            "total_users": total_users,
            "total_vendors": total_vendors,
            "total_purchase_orders": total_pos,
            "total_requests": total_requests,
            "total_contracts": total_contracts,
            "total_messages": total_messages,
        },
    }


# ============================================================
# VENDOR RISK DASHBOARD
# ============================================================

@router.get("/vendor-risk-dashboard")
def vendor_risk_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operations_read),
):
    """Vendor risk dashboard for authorized internal users."""

    vendors = db.query(Vendor).all()

    risk_buckets = {
        "low": [],
        "medium": [],
        "high": [],
    }

    alerts = []

    for vendor in vendors:

        latest = reliability_service.get_latest_score(
            db,
            vendor.id,
        )

        if not latest:
            continue

        risk_level = latest.risk_level.value

        if risk_level in risk_buckets:

            risk_buckets[risk_level].append(
                {
                    "vendor_id": vendor.id,
                    "company_name": vendor.company_name,
                    "score": latest.score,
                    "trend": latest.trend.value,
                }
            )

        if risk_level == "high":

            alerts.append(
                f"{vendor.company_name} is High risk "
                f"(score {latest.score})."
            )

        if latest.trend.value == "declining":

            alerts.append(
                f"{vendor.company_name}'s reliability "
                f"trend is declining."
            )

    expiring_contracts = (
        db.query(Contract)
        .filter(
            Contract.status == ContractStatus.EXPIRING
        )
        .count()
    )

    if expiring_contracts:

        alerts.append(
            f"{expiring_contracts} contract(s) are expiring soon."
        )

    return {
        "risk_buckets": risk_buckets,
        "alerts": alerts,
    }


# ============================================================
# PROCUREMENT SPEND
# ============================================================

@router.get("/procurement-spend")
def procurement_spend(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analytics),
):
    """Procurement spend analytics."""

    pos = db.query(PurchaseOrder).all()

    total_spend = sum(
        po.total_amount
        for po in pos
    )

    by_month = {}

    for po in pos:

        key = (
            po.order_date or po.created_at
        ).strftime("%Y-%m")

        by_month[key] = (
            by_month.get(key, 0.0)
            + po.total_amount
        )

    by_vendor = {}

    for po in pos:

        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == po.vendor_id)
            .first()
        )

        name = (
            vendor.company_name
            if vendor
            else f"Vendor #{po.vendor_id}"
        )

        by_vendor[name] = (
            by_vendor.get(name, 0.0)
            + po.total_amount
        )

    by_category = {}

    for po in pos:

        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == po.vendor_id)
            .first()
        )

        category = (
            vendor.category.value
            if vendor
            else "unknown"
        )

        by_category[category] = (
            by_category.get(category, 0.0)
            + po.total_amount
        )

    budget_total = sum(
        request.estimated_budget
        for request in db.query(
            ProcurementRequest
        ).all()
    )

    return {
        "total_spend": total_spend,
        "spend_by_month": by_month,
        "spend_by_vendor": by_vendor,
        "spend_by_category": by_category,

        "budget_vs_actual": {
            "estimated_budget": budget_total,
            "actual_spend": total_spend,
            "variance": budget_total - total_spend,
        },

        "purchase_volume": len(pos),

        "average_purchase_value": (
            round(
                total_spend / len(pos),
                2,
            )
            if pos
            else 0.0
        ),
    }


# ============================================================
# PROCUREMENT ANALYTICS
# ============================================================

@router.get("/procurement-analytics")
def procurement_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analytics),
):
    """Higher-level procurement analytics."""

    requests = (
        db.query(ProcurementRequest).all()
    )

    pos = (
        db.query(PurchaseOrder).all()
    )

    # Request -> PO cycle time
    cycle_times = []

    for po in pos:

        if not po.procurement_request_id:
            continue

        request = (
            db.query(ProcurementRequest)
            .filter(
                ProcurementRequest.id
                == po.procurement_request_id
            )
            .first()
        )

        if request and po.order_date:

            cycle_times.append(
                (
                    po.order_date
                    - request.created_at
                ).total_seconds()
                / 3600.0
            )

    avg_cycle_hours = (
        round(
            sum(cycle_times)
            / len(cycle_times),
            2,
        )
        if cycle_times
        else None
    )

    # PO processing time
    processing_times = [
        (
            po.actual_delivery_date
            - po.order_date
        ).total_seconds()
        / 3600.0

        for po in pos

        if po.order_date
        and po.actual_delivery_date
    ]

    avg_po_processing_hours = (
        round(
            sum(processing_times)
            / len(processing_times),
            2,
        )
        if processing_times
        else None
    )

    # Supplier concentration
    spend_by_vendor = {}

    for po in pos:

        spend_by_vendor[po.vendor_id] = (
            spend_by_vendor.get(
                po.vendor_id,
                0.0,
            )
            + po.total_amount
        )

    total_spend = sum(
        spend_by_vendor.values()
    )

    top_vendor_share = (
        round(
            (
                max(spend_by_vendor.values())
                / total_spend
            ) * 100,
            2,
        )
        if spend_by_vendor and total_spend
        else 0.0
    )

    # Delivery performance
    delivered = [
        po

        for po in pos

        if po.status.value in (
            "delivered",
            "completed",
        )

        and po.actual_delivery_date
        and po.expected_delivery_date
    ]

    on_time = sum(
        1
        for po in delivered
        if po.actual_delivery_date
        <= po.expected_delivery_date
    )

    delivery_rate = (
        round(
            (on_time / len(delivered)) * 100,
            2,
        )
        if delivered
        else 0.0
    )

    completed = sum(
        1
        for request in requests
        if request.status
        == ProcurementStatus.COMPLETED
    )

    cancelled = sum(
        1
        for request in requests
        if request.status
        == ProcurementStatus.CANCELLED
    )

    return {
        "avg_request_to_order_cycle_hours": avg_cycle_hours,

        "avg_po_processing_hours": avg_po_processing_hours,

        "supplier_concentration_top_vendor_pct": (
            top_vendor_share
        ),

        "purchase_volume": len(pos),

        "delivery_performance_rate": delivery_rate,

        "request_completion_rate": (
            round(
                (completed / len(requests)) * 100,
                2,
            )
            if requests
            else 0.0
        ),

        "request_cancellation_rate": (
            round(
                (cancelled / len(requests)) * 100,
                2,
            )
            if requests
            else 0.0
        ),
    }