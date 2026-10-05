from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user

from app.models.user import User
from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder
from app.models.contract import Contract
from app.models.communication import Communication
from app.models.vendor_performance import VendorPerformance

from app.schemas.analytics import (
    DashboardAnalytics,
    VendorPerformanceDashboard,
    ContractSummary,
    OrderSummary,
    CommunicationSummary,
    ProcurementDashboard,
    AdminDashboard,
    DeliveryStatusSummary,
)


router = APIRouter(
    prefix="/api/analytics",
    tags=["Analytics"],
)


# ============================================================
# HELPERS
# ============================================================

def normalize_role(role) -> str:
    if hasattr(role, "value"):
        role = role.value

    return str(role or "").strip().upper().replace(" ", "_")


def decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")

    return Decimal(str(value))


def rounded(value: Decimal) -> Decimal:
    return value.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def average(values):
    values = [
        decimal(value)
        for value in values
        if value is not None
    ]

    if not values:
        return None

    return rounded(
        sum(values, Decimal("0"))
        / Decimal(len(values))
    )


# ============================================================
# VENDOR PERFORMANCE
# ============================================================

def performance_score(
    vendor_id: int,
    db: Session,
):
    evaluations = (
        db.query(VendorPerformance)
        .filter(
            VendorPerformance.vendor_id == vendor_id
        )
        .all()
    )

    if not evaluations:
        return None

    quality_values = [
        decimal(item.quality_rating)
        / Decimal("5")
        * Decimal("100")
        for item in evaluations
        if item.quality_rating is not None
    ]

    service_values = [
        decimal(item.service_rating)
        / Decimal("5")
        * Decimal("100")
        for item in evaluations
        if item.service_rating is not None
    ]

    response_values = [
        max(
            Decimal("0"),
            Decimal("100")
            - decimal(item.response_time_hours)
            * Decimal("5"),
        )
        for item in evaluations
        if item.response_time_hours is not None
    ]

    resolution_values = [
        max(
            Decimal("0"),
            Decimal("100")
            - decimal(item.issue_resolution_time_hours)
            * Decimal("2"),
        )
        for item in evaluations
        if item.issue_resolution_time_hours is not None
    ]

    scores = []

    for values, weight in [
        (quality_values, Decimal("0.25")),
        (service_values, Decimal("0.20")),
        (response_values, Decimal("0.15")),
        (resolution_values, Decimal("0.15")),
    ]:
        if values:
            avg = (
                sum(values, Decimal("0"))
                / Decimal(len(values))
            )

            scores.append(avg * weight)

    delivery_values = []

    for evaluation in evaluations:

        if (
            evaluation.actual_delivery_date is None
            or evaluation.purchase_order_id is None
        ):
            continue

        po = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.id
                == evaluation.purchase_order_id
            )
            .first()
        )

        if not po:
            continue

        if (
            evaluation.actual_delivery_date
            <= po.expected_delivery_date
        ):
            delivery_values.append(
                Decimal("100")
            )
        else:
            delivery_values.append(
                Decimal("0")
            )

    if delivery_values:

        avg_delivery = (
            sum(
                delivery_values,
                Decimal("0"),
            )
            / Decimal(len(delivery_values))
        )

        scores.append(
            avg_delivery * Decimal("0.25")
        )

    if not scores:
        return None

    return rounded(
        sum(scores, Decimal("0"))
    )


# ============================================================
# VENDOR RELIABILITY
# ============================================================

def vendor_reliability(
    vendor_id: int,
    db: Session,
):

    evaluations = (
        db.query(VendorPerformance)
        .filter(
            VendorPerformance.vendor_id == vendor_id
        )
        .all()
    )

    factors: dict[str, Decimal | None] = {}

    # --------------------------------------------------------
    # Delivery History
    # --------------------------------------------------------

    delivery_values = []

    for evaluation in evaluations:

        if (
            evaluation.actual_delivery_date is None
            or evaluation.purchase_order_id is None
        ):
            continue

        po = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.id
                == evaluation.purchase_order_id
            )
            .first()
        )

        if not po:
            continue

        delivery_values.append(
            Decimal("100")
            if evaluation.actual_delivery_date
            <= po.expected_delivery_date
            else Decimal("0")
        )

    factors["Delivery"] = average(
        delivery_values
    )

    # --------------------------------------------------------
    # Product Quality
    # --------------------------------------------------------

    factors["Quality"] = average(
        [
            decimal(item.quality_rating)
            / Decimal("5")
            * Decimal("100")
            for item in evaluations
            if item.quality_rating is not None
        ]
    )

    # --------------------------------------------------------
    # Communication
    # --------------------------------------------------------

    factors["Communication"] = average(
        [
            max(
                Decimal("0"),
                Decimal("100")
                - decimal(item.response_time_hours)
                * Decimal("5"),
            )
            for item in evaluations
            if item.response_time_hours is not None
        ]
    )

    # --------------------------------------------------------
    # Contract Compliance
    # --------------------------------------------------------

    contracts = (
        db.query(Contract)
        .filter(
            Contract.vendor_id == vendor_id
        )
        .all()
    )

    if contracts:

        compliant = sum(
            1
            for contract in contracts
            if str(
                contract.compliance_status or ""
            ).strip().upper()
            in {
                "COMPLIANT",
                "APPROVED",
                "ACTIVE",
            }
        )

        factors["Compliance"] = rounded(
            Decimal(compliant)
            / Decimal(len(contracts))
            * Decimal("100")
        )

    else:

        factors["Compliance"] = None

    # --------------------------------------------------------
    # Purchase History
    # --------------------------------------------------------

    orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.vendor_id == vendor_id
        )
        .all()
    )

    if orders:

        completed = sum(
            1
            for order in orders
            if str(order.status or "")
            .strip()
            .upper()
            in {
                "DELIVERED",
                "COMPLETED",
            }
        )

        factors["Purchase History"] = rounded(
            Decimal(completed)
            / Decimal(len(orders))
            * Decimal("100")
        )

    else:

        factors["Purchase History"] = None

    # --------------------------------------------------------
    # Issue Resolution
    # --------------------------------------------------------

    factors["Issue Resolution"] = average(
        [
            max(
                Decimal("0"),
                Decimal("100")
                - decimal(
                    item.issue_resolution_time_hours
                )
                * Decimal("2"),
            )
            for item in evaluations
            if item.issue_resolution_time_hours
            is not None
        ]
    )

    available = [
        value
        for value in factors.values()
        if value is not None
    ]

    if not available:
        return None, factors

    score = rounded(
        sum(
            available,
            Decimal("0"),
        )
        / Decimal(len(available))
    )

    return score, factors


# ============================================================
# VENDOR RESOLUTION
# ============================================================

def get_vendor_for_user(
    current_user: User,
    db: Session,
):

    role = normalize_role(
        current_user.role
    )

    if role != "VENDOR":
        return None

    return (
        db.query(Vendor)
        .filter(
            Vendor.email == current_user.email
        )
        .first()
    )


# ============================================================
# VENDOR METRICS
# ============================================================

def build_vendor_metrics(
    vendor: Vendor | None,
    db: Session,
):

    if vendor is None:

        return VendorPerformanceDashboard(
            performance_score=None,
            delivery_rate=None,
            quality_rating=None,
            response_time_hours=None,
            reliability_score=None,
            reliability_factors={
                "Delivery": None,
                "Quality": None,
                "Communication": None,
                "Compliance": None,
            },
        )

    evaluations = (
        db.query(VendorPerformance)
        .filter(
            VendorPerformance.vendor_id
            == vendor.id
        )
        .all()
    )

    quality = average(
        [
            item.quality_rating
            for item in evaluations
        ]
    )

    response = average(
        [
            item.response_time_hours
            for item in evaluations
        ]
    )

    delivery_values = []

    for evaluation in evaluations:

        if (
            evaluation.actual_delivery_date is None
            or evaluation.purchase_order_id is None
        ):
            continue

        po = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.id
                == evaluation.purchase_order_id
            )
            .first()
        )

        if po:

            delivery_values.append(
                Decimal("100")
                if evaluation.actual_delivery_date
                <= po.expected_delivery_date
                else Decimal("0")
            )

    delivery_rate = average(
        delivery_values
    )

    reliability, factors = vendor_reliability(
        vendor.id,
        db,
    )

    return VendorPerformanceDashboard(
        performance_score=performance_score(
            vendor.id,
            db,
        ),
        delivery_rate=delivery_rate,
        quality_rating=quality,
        response_time_hours=response,
        reliability_score=reliability,
        reliability_factors={
            "Delivery": factors.get("Delivery"),
            "Quality": factors.get("Quality"),
            "Communication": factors.get("Communication"),
            "Compliance": factors.get("Compliance"),
        },
    )


# ============================================================
# ORGANIZATION VENDOR PERFORMANCE
# ============================================================

def build_organization_vendor_metrics(db: Session):
    """
    Build organization-level vendor performance for management/admin
    dashboards. Vendor users continue to receive vendor-specific data.

    Values are calculated only from records that actually exist in the
    VendorPerformance table and related application tables. No demo or
    hard-coded performance values are introduced here.
    """

    evaluations = db.query(VendorPerformance).all()

    quality = average(
        [
            decimal(item.quality_rating)
            for item in evaluations
            if item.quality_rating is not None
        ]
    )

    service = average(
        [
            decimal(item.service_rating)
            for item in evaluations
            if item.service_rating is not None
        ]
    )

    response = average(
        [
            decimal(item.response_time_hours)
            for item in evaluations
            if item.response_time_hours is not None
        ]
    )

    resolution = average(
        [
            decimal(item.issue_resolution_time_hours)
            for item in evaluations
            if item.issue_resolution_time_hours is not None
        ]
    )

    delivery_values = []

    for evaluation in evaluations:
        if (
            evaluation.actual_delivery_date is None
            or evaluation.purchase_order_id is None
        ):
            continue

        po = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.id == evaluation.purchase_order_id
            )
            .first()
        )

        if not po or po.expected_delivery_date is None:
            continue

        delivery_values.append(
            Decimal("100")
            if evaluation.actual_delivery_date
            <= po.expected_delivery_date
            else Decimal("0")
        )

    delivery_rate = average(delivery_values)

    # Performance score uses the same metric weights as the existing
    # vendor-level performance calculation.
    score_parts = []

    if quality is not None:
        score_parts.append(
            (quality / Decimal("100")) * Decimal("25")
        )

    if service is not None:
        score_parts.append(
            (service / Decimal("100")) * Decimal("20")
        )

    if response is not None:
        response_score = max(
            Decimal("0"),
            Decimal("100") - response * Decimal("5"),
        )
        score_parts.append(
            (response_score / Decimal("100")) * Decimal("15")
        )

    if resolution is not None:
        resolution_score = max(
            Decimal("0"),
            Decimal("100") - resolution * Decimal("2"),
        )
        score_parts.append(
            (resolution_score / Decimal("100")) * Decimal("15")
        )

    if delivery_rate is not None:
        score_parts.append(
            (delivery_rate / Decimal("100")) * Decimal("25")
        )

    performance_score = (
        rounded(sum(score_parts, Decimal("0")))
        if score_parts
        else None
    )

    # Reliability factors shown on the dashboard. These are derived
    # from the same underlying application records, at organization
    # level for management/admin users.
    factors: dict[str, Decimal | None] = {
        "Delivery": delivery_rate,
        "Quality": (
            rounded(
                quality / Decimal("5") * Decimal("100")
            )
            if quality is not None
            else None
        ),
        "Communication": (
            rounded(
                max(
                    Decimal("0"),
                    Decimal("100") - response * Decimal("5"),
                )
            )
            if response is not None
            else None
        ),
        "Compliance": None,
    }

    all_contracts = db.query(Contract).all()

    if all_contracts:
        compliant = sum(
            1
            for contract in all_contracts
            if str(
                contract.compliance_status or ""
            ).strip().upper()
            in {
                "COMPLIANT",
                "APPROVED",
                "ACTIVE",
            }
        )

        factors["Compliance"] = rounded(
            Decimal(compliant)
            / Decimal(len(all_contracts))
            * Decimal("100")
        )

    available_factors = [
        value
        for value in factors.values()
        if value is not None
    ]

    reliability_score = (
        rounded(
            sum(available_factors, Decimal("0"))
            / Decimal(len(available_factors))
        )
        if available_factors
        else None
    )

    return VendorPerformanceDashboard(
        performance_score=performance_score,
        delivery_rate=delivery_rate,
        quality_rating=quality,
        response_time_hours=response,
        reliability_score=reliability_score,
        reliability_factors=factors,
    )


# ============================================================
# CONTRACT SUMMARY
# ============================================================

def build_contract_summary(
    vendor_id: int | None,
    db: Session,
):

    query = db.query(Contract)

    if vendor_id is not None:
        query = query.filter(
            Contract.vendor_id == vendor_id
        )

    contracts = query.all()

    today = date.today()

    active = 0
    expiring = 0
    expired = 0
    renewed = 0

    for contract in contracts:

        status = str(
            contract.status or ""
        ).strip().upper()

        if status == "RENEWED":
            renewed += 1

        if (
            contract.end_date
            and contract.end_date < today
        ) or status == "EXPIRED":

            expired += 1

        elif (
            contract.end_date
            and contract.end_date
            <= today + timedelta(days=30)
        ):

            expiring += 1

        else:

            active += 1

    return ContractSummary(
        active=active,
        expiring=expiring,
        expired=expired,
        renewed=renewed,
    )


# ============================================================
# ORDER SUMMARY
# ============================================================

def build_order_summary(
    vendor_id: int | None,
    db: Session,
):

    query = db.query(PurchaseOrder)

    if vendor_id is not None:

        query = query.filter(
            PurchaseOrder.vendor_id
            == vendor_id
        )

    orders = query.all()

    total = len(orders)

    completed = sum(
        1
        for order in orders
        if str(order.status or "")
        .strip()
        .upper()
        in {
            "DELIVERED",
            "COMPLETED",
        }
    )

    pending = sum(
        1
        for order in orders
        if str(order.status or "")
        .strip()
        .upper()
        in {
            "PENDING",
            "APPROVED",
        }
    )

    delayed = sum(
        1
        for order in orders
        if (
            order.expected_delivery_date
            and order.expected_delivery_date
            < date.today()
            and str(order.status or "")
            .strip()
            .upper()
            not in {
                "DELIVERED",
                "COMPLETED",
                "CANCELLED",
            }
        )
    )

    return OrderSummary(
        total=total,
        completed=completed,
        pending=pending,
        delayed=delayed,
    )


# ============================================================
# COMMUNICATION SUMMARY
# ============================================================

def build_communication_summary(
    vendor_id: int | None,
    db: Session,
):

    query = db.query(Communication)

    if vendor_id is not None:

        query = query.filter(
            Communication.vendor_id
            == vendor_id
        )

    messages = query.all()

    total = len(messages)

    open_queries = sum(
        1
        for item in messages
        if str(item.status or "")
        .strip()
        .upper()
        in {
            "OPEN",
            "PENDING",
        }
    )

    resolved_queries = sum(
        1
        for item in messages
        if str(item.status or "")
        .strip()
        .upper()
        in {
            "RESOLVED",
            "CLOSED",
            "COMPLETED",
        }
    )

    return CommunicationSummary(
        messages=total,
        open_queries=open_queries,
        resolved_queries=resolved_queries,
        response_activity=total,
    )


# ============================================================
# DELIVERY STATUS
# ============================================================

def build_delivery_status(
    vendor_id: int | None,
    db: Session,
):

    query = db.query(PurchaseOrder)

    if vendor_id is not None:

        query = query.filter(
            PurchaseOrder.vendor_id
            == vendor_id
        )

    orders = query.all()

    values = {
        "pending": 0,
        "approved": 0,
        "ordered": 0,
        "delivered": 0,
        "completed": 0,
        "cancelled": 0,
        "delayed": 0,
    }

    for order in orders:

        status = str(
            order.status or ""
        ).strip().upper()

        if status == "PENDING":

            values["pending"] += 1

        elif status == "APPROVED":

            values["approved"] += 1

        elif status == "ORDERED":

            values["ordered"] += 1

        elif status == "DELIVERED":

            values["delivered"] += 1

        elif status == "COMPLETED":

            values["completed"] += 1

        elif status == "CANCELLED":

            values["cancelled"] += 1

        if (
            order.expected_delivery_date
            and order.expected_delivery_date
            < date.today()
            and status not in {
                "DELIVERED",
                "COMPLETED",
                "CANCELLED",
            }
        ):

            values["delayed"] += 1

    return DeliveryStatusSummary(
        **values
    )


# ============================================================
# MAIN ANALYTICS DASHBOARD
# ============================================================

@router.get(
    "/dashboard",
    response_model=DashboardAnalytics,
)
def get_dashboard_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    role = normalize_role(
        current_user.role
    )

    vendor = get_vendor_for_user(
        current_user,
        db,
    )

    vendor_id = (
        vendor.id
        if vendor is not None
        else None
    )

    # Vendor-specific data when the
    # logged-in vendor can be resolved.
    #
    # If a Vendor login has no matching
    # vendor master record, keep the
    # organization-level procurement scope
    # instead of producing inconsistent
    # zero/one values.

    if role == "VENDOR" and vendor is not None:

        performance_data = build_vendor_metrics(
            vendor,
            db,
        )

    else:

        # Management/admin dashboards show organization-level vendor
        # intelligence instead of hiding the performance section.
        performance_data = build_organization_vendor_metrics(
            db
        )

    # --------------------------------------------------------
    # Contract analytics
    # --------------------------------------------------------

    contracts = build_contract_summary(
        vendor_id,
        db,
    )

    # --------------------------------------------------------
    # Order analytics
    # --------------------------------------------------------

    orders = build_order_summary(
        vendor_id,
        db,
    )

    # --------------------------------------------------------
    # Communication analytics
    # --------------------------------------------------------

    communication = build_communication_summary(
        vendor_id,
        db,
    )

    # ========================================================
    # PROCUREMENT ANALYTICS
    # ========================================================

    # IMPORTANT:
    # Use exactly the same vendor scope as
    # build_order_summary().
    #
    # This prevents:
    #
    #   total_purchase_orders = 0
    #
    # while:
    #
    #   pending = 1
    #   delayed = 1
    #
    # from being returned in the same response.

    all_orders_query = db.query(
        PurchaseOrder
    )

    if vendor_id is not None:

        all_orders_query = all_orders_query.filter(
            PurchaseOrder.vendor_id
            == vendor_id
        )

    all_orders = all_orders_query.all()

    total_cost = sum(
        (
            decimal(order.total_amount)
            for order in all_orders
        ),
        Decimal("0"),
    )

    average_order_value = (
        rounded(
            total_cost
            / Decimal(len(all_orders))
        )
        if all_orders
        else Decimal("0")
    )

    # --------------------------------------------------------
    # Vendor count
    # --------------------------------------------------------

    vendor_query = db.query(Vendor)

    if vendor_id is not None:

        vendor_query = vendor_query.filter(
            Vendor.id == vendor_id
        )

    relevant_vendors = vendor_query.all()

    # --------------------------------------------------------
    # Active purchase orders
    # --------------------------------------------------------

    active_po_count = sum(
        1
        for order in all_orders
        if str(order.status or "")
        .strip()
        .upper()
        in {
            "PENDING",
            "APPROVED",
            "ORDERED",
        }
    )

    # --------------------------------------------------------
    # Procurement dashboard
    # --------------------------------------------------------

    procurement = ProcurementDashboard(
        # Use the same order collection that
        # is used for the other procurement
        # metrics.
        total_purchase_orders=len(
            all_orders
        ),

        active_purchase_orders=active_po_count,

        total_procurement_cost=rounded(
            total_cost
        ),

        average_order_value=average_order_value,

        vendor_count=len(
            relevant_vendors
        ),

        delivery_status=build_delivery_status(
            vendor_id,
            db,
        ),
    )

    # ========================================================
    # ADMIN / SYSTEM ANALYTICS
    # ========================================================

    users = db.query(User).all()

    vendors = db.query(Vendor).all()

    all_contracts = db.query(
        Contract
    ).all()

    all_communications = db.query(
        Communication
    ).all()

    compliant_contracts = sum(
        1
        for contract in all_contracts
        if str(
            contract.compliance_status or ""
        ).strip().upper()
        in {
            "COMPLIANT",
            "APPROVED",
            "ACTIVE",
        }
    )

    today = date.today()

    expiring_contracts = sum(
        1
        for contract in all_contracts
        if (
            contract.end_date
            and today
            <= contract.end_date
            <= today + timedelta(days=30)
        )
    )

    admin = AdminDashboard(
        total_users=len(users),

        active_users=sum(
            1
            for user in users
            if bool(user.is_active)
        ),

        total_vendors=len(vendors),

        approved_vendors=sum(
            1
            for vendor_item in vendors
            if str(
                vendor_item.status or ""
            ).strip().upper()
            == "APPROVED"
        ),

        pending_vendors=sum(
            1
            for vendor_item in vendors
            if str(
                vendor_item.status or ""
            ).strip().upper()
            == "PENDING"
        ),

        total_purchase_orders=len(
            db.query(PurchaseOrder).all()
        ),

        total_contracts=len(
            all_contracts
        ),

        compliant_contracts=compliant_contracts,

        expiring_contracts=expiring_contracts,

        total_communications=len(
            all_communications
        ),
    )

    # ========================================================
    # FINAL RESPONSE
    # ========================================================

    return DashboardAnalytics(
        role=role,

        vendor_name=(
            vendor.name
            if vendor
            else None
        ),

        vendor_performance=performance_data,

        contracts=contracts,

        orders=orders,

        communication=communication,

        procurement=procurement,

        admin=admin,
    )