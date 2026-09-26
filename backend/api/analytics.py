"""Analytics endpoints backing the procurement, vendor and admin dashboards.

Every endpoint accepts the same filter set - ``start``, ``end``,
``vendor_id``, ``category``, ``risk_level``, ``status`` - and pushes it into
SQL. Changing a filter on screen changes the query, not just the rendering.

A supplier login is pinned to its own ``vendor_id`` regardless of what it
asks for.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user, require_admin, vendor_scope
from models import User, UserRole, Vendor, VendorCategory
from services import analytics as A
from services.performance import performance_trend

router = APIRouter(prefix="/analytics", tags=["Analytics"])


class FilterOptions(BaseModel):
    categories: list[str]
    risk_levels: list[str]
    order_statuses: list[str]
    request_statuses: list[str]
    vendors: list[dict]
    default_start: date
    default_end: date


def _filters(
    current_user: User,
    start: Optional[date] = None,
    end: Optional[date] = None,
    vendor_id: Optional[int] = None,
    category: Optional[str] = None,
    risk_level: Optional[str] = None,
    status: Optional[str] = None,
) -> A.Filters:
    """Build the filter set, forcing a supplier login onto its own vendor."""

    scope = vendor_scope(current_user)

    return A.Filters(
        start=start,
        end=end,
        vendor_id=scope if scope is not None else vendor_id,
        category=category,
        risk_level=risk_level,
        status=status,
    )


def _common(
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    vendor_id: Optional[int] = Query(default=None),
    category: Optional[str] = Query(default=None),
    risk_level: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
) -> A.Filters:
    return _filters(
        current_user, start, end, vendor_id, category, risk_level, status
    )


@router.get("/filters", response_model=FilterOptions)
def filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Everything the dashboard filter bar needs to populate itself."""

    from models import ProcurementStatus, PurchaseOrderStatus, RiskLevel

    scope = vendor_scope(current_user)

    vendor_query = db.query(Vendor.id, Vendor.vendor_name, Vendor.category)

    if scope is not None:
        vendor_query = vendor_query.filter(Vendor.id == scope)

    vendors = [
        {"id": v.id, "name": v.vendor_name, "category": v.category}
        for v in vendor_query.order_by(Vendor.vendor_name).all()
    ]

    return FilterOptions(
        categories=VendorCategory.ALL,
        risk_levels=RiskLevel.ALL,
        order_statuses=PurchaseOrderStatus.ALL,
        request_statuses=ProcurementStatus.ALL,
        vendors=vendors,
        default_start=date.today() - timedelta(days=365),
        default_end=date.today(),
    )


# --------------------------------------------------------------------------
# Procurement dashboard
# --------------------------------------------------------------------------

@router.get("/procurement")
def procurement_dashboard(
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Everything on the Procurement dashboard, in one round trip."""

    return {
        "filters": filters.as_dict(),
        "overview": A.procurement_overview(db, filters),
        "purchase_orders": A.purchase_order_overview(db, filters),
        "vendor_performance": A.vendor_performance_summary(db, filters),
        "cost_analysis": A.cost_analysis(db, filters),
        "delivery_status": A.delivery_status(db, filters),
        "spend_over_time": A.spend_over_time(db, filters),
        "category_performance": A.category_performance(db, filters),
        "invoices": A.invoice_summary(db, filters),
    }


# --------------------------------------------------------------------------
# Vendor dashboard
# --------------------------------------------------------------------------

@router.get("/vendor")
def vendor_dashboard(
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The Vendor dashboard: performance, reliability, contracts, activity."""

    from services.reliability import latest_scores

    payload = {
        "filters": filters.as_dict(),
        "performance": A.vendor_performance_summary(db, filters),
        "contract_status": A.contract_status(db, filters),
        "order_history": A.order_history(db, filters),
        "communication": A.communication_activity(db, filters),
        "delivery_status": A.delivery_status(db, filters),
        "trend": performance_trend(
            db, filters.vendor_id, months=12, category=filters.category
        ),
    }

    if filters.vendor_id:
        snapshot = latest_scores(db).get(filters.vendor_id)

        payload["reliability"] = (
            {
                "overall_score": float(snapshot.overall_score or 0),
                "delivery_score": float(snapshot.delivery_score or 0),
                "quality_score": float(snapshot.quality_score or 0),
                "communication_score": float(snapshot.communication_score or 0),
                "compliance_score": float(snapshot.compliance_score or 0),
                "purchase_history_score": float(
                    snapshot.purchase_history_score or 0
                ),
                "issue_resolution_score": float(
                    snapshot.issue_resolution_score or 0
                ),
                "risk_level": snapshot.risk_level,
                "trend": snapshot.trend,
                "rank_position": snapshot.rank_position,
                "recommendation": snapshot.recommendation,
                "predicted_delay_risk": (
                    float(snapshot.predicted_delay_risk)
                    if snapshot.predicted_delay_risk is not None
                    else None
                ),
            }
            if snapshot
            else None
        )
    else:
        payload["reliability"] = None

    return payload


# --------------------------------------------------------------------------
# Admin dashboard
# --------------------------------------------------------------------------

@router.get("/admin")
def admin_dashboard(
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """The Administrator dashboard: users, vendors, compliance, system stats."""

    return {
        "filters": filters.as_dict(),
        "user_management": A.user_management(db),
        "vendor_analytics": A.vendor_analytics(db, filters),
        "procurement": A.procurement_overview(db, filters),
        "purchase_orders": A.purchase_order_overview(db, filters),
        "compliance": A.compliance_monitoring(db, filters),
        "system": A.system_statistics(db),
        "risk": A.risk_breakdown(db, filters),
        "spend_over_time": A.spend_over_time(db, filters),
    }


# --------------------------------------------------------------------------
# Individual slices (used by the interactive charts)
# --------------------------------------------------------------------------

@router.get("/spend")
def spend(
    months: int = Query(default=12, ge=1, le=36),
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
):
    return A.spend_over_time(db, filters, months)


@router.get("/delivery")
def delivery(
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
):
    return A.delivery_status(db, filters)


@router.get("/cost")
def cost(
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
):
    return A.cost_analysis(db, filters)


@router.get("/categories")
def categories(
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
):
    return A.category_performance(db, filters)


@router.get("/vendors")
def vendors(
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
):
    return A.vendor_analytics(db, filters)


@router.get("/risk")
def risk(
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
):
    return A.risk_breakdown(db, filters)


@router.get("/contracts")
def contracts(
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
):
    return A.contract_status(db, filters)


@router.get("/compliance")
def compliance(
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
):
    return A.compliance_monitoring(db, filters)


@router.get("/communication")
def communication(
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
):
    return A.communication_activity(db, filters)


@router.get("/trend")
def trend(
    months: int = Query(default=12, ge=1, le=36),
    filters: A.Filters = Depends(_common),
    db: Session = Depends(get_db),
):
    """Monthly delivery performance for the filtered selection."""

    return performance_trend(
        db, filters.vendor_id, months=months, category=filters.category
    )
