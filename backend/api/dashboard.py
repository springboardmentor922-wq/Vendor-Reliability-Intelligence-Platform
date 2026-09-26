"""Role-aware dashboard aggregates.

Everything here is aggregated in SQL. An earlier version pulled the whole
order book into Python and summed it in a loop, which was fine against a
handful of demo rows and far too slow once the dataset history was loaded -
the order table now carries thousands of rows per vendor.

The response keeps the Milestone 2 shape and adds the Milestone 3 blocks
(performance, reliability, risk, predictions) so the existing screens keep
working unchanged.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import get_current_user, vendor_scope
from models import (
    ActivityLog,
    Contract,
    ContractStatus,
    MessageThread,
    Notification,
    ProcurementStatus,
    PurchaseOrder,
    ThreadStatus,
    User,
    UserRole,
    Vendor,
    VendorStatus
)
from services import analytics as A

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class DashboardCard(BaseModel):
    label: str
    value: str
    hint: str = ""


class RecentActivity(BaseModel):
    id: int
    user_name: str | None = None
    entity_type: str
    action: str
    description: str | None = None
    created_at: str | None = None


class DashboardOverview(BaseModel):
    role: str
    cards: list[DashboardCard]
    vendors_by_status: dict[str, int]
    vendors_by_category: dict[str, int]
    vendors_by_risk: dict[str, int]
    orders_by_status: dict[str, int]
    requests_by_status: dict[str, int]
    monthly_spend: dict[str, float]
    top_vendors_by_spend: list[dict]
    contracts_expiring: list[dict]
    open_conversations: int
    unread_notifications: int
    recent_activity: list[RecentActivity]

    # ---- Milestone 3 ------------------------------------------
    performance: dict
    delivery: dict
    reliability_leaders: list[dict]
    at_risk_vendors: list[dict]
    category_performance: list[dict]


def _money(value) -> str:
    return f"{Decimal(str(value or 0)):,.2f}"


@router.get("/overview", response_model=DashboardOverview)
def overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    scope = vendor_scope(current_user)
    filters = A.Filters(vendor_id=scope)

    vendors = A.vendor_analytics(db, filters)
    orders = A.purchase_order_overview(db, filters)
    requests = A.procurement_overview(db, filters)
    delivery = A.delivery_status(db, filters)
    performance = A.vendor_performance_summary(db, filters)
    contracts = A.contract_status(db, filters)
    invoices = A.invoice_summary(db, filters)
    communication = A.communication_activity(db, filters)
    risk = A.risk_breakdown(db, filters)
    cost = A.cost_analysis(db, filters)

    monthly = {
        row["period"]: row["spend"]
        for row in A.spend_over_time(db, filters, months=12)
    }

    unread = (
        db.query(func.count(Notification.id))
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .scalar()
    ) or 0

    # ---- headline cards -----------------------------------------
    cards = [
        DashboardCard(
            label="Total Vendors",
            value=str(vendors["total_vendors"]),
            hint=f"{vendors['active_vendors']} approved",
        ),
        DashboardCard(
            label="Pending Vendor Approvals",
            value=str(vendors["pending_vendors"]),
            hint="Awaiting a decision",
        ),
        DashboardCard(
            label="Active Purchase Orders",
            value=str(orders["active_orders"]),
            hint=f"{orders['overdue_orders']} past the expected delivery date",
        ),
        DashboardCard(
            label="Pending Requests",
            value=str(requests["pending_requests"]),
            hint=f"{requests['total_requests']} requests in total",
        ),
        DashboardCard(
            label="Procurement Spend",
            value=_money(orders["total_po_value"]),
            hint="Across all non-cancelled orders",
        ),
        DashboardCard(
            label="On-Time Delivery",
            value=f"{delivery['delivery_rate']}%",
            hint=(
                f"{delivery['on_time_deliveries']} on time, "
                f"{delivery['delayed_deliveries']} late"
            ),
        ),
        DashboardCard(
            label="Average Reliability",
            value=f"{vendors['average_reliability']:.1f}",
            hint=f"{vendors['high_risk_vendors']} vendor(s) at high risk",
        ),
        DashboardCard(
            label="Outstanding Invoices",
            value=_money(invoices["outstanding_value"]),
            hint="Pending, approved or overdue",
        ),
        DashboardCard(
            label="Contracts Expiring",
            value=str(len(contracts["expiring_soon"])),
            hint=f"Within {settings.CONTRACT_EXPIRY_ALERT_DAYS} days",
        ),
        DashboardCard(
            label="Open Conversations",
            value=str(communication["open_queries"]),
            hint="Vendor discussions still open",
        ),
    ]

    # ---- recent activity ----------------------------------------
    # A supplier login must never see activity belonging to other vendors,
    # so the feed is narrowed to rows about its own records.
    activity_query = db.query(ActivityLog)

    if scope is not None:
        own_orders = [
            r[0]
            for r in db.query(PurchaseOrder.id)
            .filter(PurchaseOrder.vendor_id == scope)
            .all()
        ]

        own_contracts = [
            r[0]
            for r in db.query(Contract.id)
            .filter(Contract.vendor_id == scope)
            .all()
        ]

        activity_query = activity_query.filter(
            or_(
                and_(
                    ActivityLog.entity_type == "Vendor",
                    ActivityLog.entity_id == scope,
                ),
                and_(
                    ActivityLog.entity_type == "PurchaseOrder",
                    ActivityLog.entity_id.in_(own_orders or [-1]),
                ),
                and_(
                    ActivityLog.entity_type == "Contract",
                    ActivityLog.entity_id.in_(own_contracts or [-1]),
                ),
            )
        )

    recent = [
        RecentActivity(
            id=row.id,
            user_name=row.user.name if row.user else None,
            entity_type=row.entity_type,
            action=row.action,
            description=row.description,
            created_at=row.created_at.isoformat() if row.created_at else None,
        )
        for row in activity_query.order_by(ActivityLog.id.desc()).limit(12).all()
    ]

    # ---- reliability leaders ------------------------------------
    leaders = [
        {
            "vendor_id": row["vendor_id"],
            "vendor_name": row["vendor_name"],
            "category": row["category"],
            "reliability_score": row["reliability_score"],
            "risk_level": row["risk_level"],
            "rank_position": row["rank_position"],
            "trend": row["trend"],
        }
        for row in A.vendor_ranking(db, filters, limit=5)
    ]

    return DashboardOverview(
        role=current_user.role,
        cards=cards,
        vendors_by_status=vendors["by_status"],
        vendors_by_category=vendors["by_category"],
        vendors_by_risk=vendors["by_risk"],
        orders_by_status=orders["by_status"],
        requests_by_status=requests["by_status"],
        monthly_spend=monthly,
        top_vendors_by_spend=[
            {
                "vendor_id": row["vendor_id"],
                "vendor_name": row["vendor_name"],
                "spend": row["spend"],
            }
            for row in cost["by_vendor"][:5]
        ],
        contracts_expiring=contracts["expiring_soon"][:10],
        open_conversations=communication["open_queries"],
        unread_notifications=int(unread),
        recent_activity=recent,
        performance=performance,
        delivery=delivery,
        reliability_leaders=leaders,
        at_risk_vendors=risk["at_risk_vendors"][:5],
        category_performance=A.category_performance(db, filters),
    )
