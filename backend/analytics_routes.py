from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import (
    User,
    Vendor,
    PurchaseOrder,
    VendorPerformance,
    ProcurementRequest,
)
from auth import get_current_user, require_role

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


# ============================================================
# ANALYTICS SUMMARY
# ============================================================

@router.get("/summary")
def get_analytics_summary(
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
            "finance_officer",
            "auditor",
        )
    ),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # VENDOR COUNTS
    # --------------------------------------------------------

    total_vendors = (
        db.query(Vendor)
        .count()
    )

    approved_vendors = (
        db.query(Vendor)
        .filter(
            Vendor.approval_status == "approved"
        )
        .count()
    )

    active_vendors = (
        db.query(Vendor)
        .filter(
            Vendor.vendor_status == "active"
        )
        .count()
    )

    inactive_vendors = (
        db.query(Vendor)
        .filter(
            Vendor.vendor_status == "inactive"
        )
        .count()
    )

    # --------------------------------------------------------
    # PURCHASE ORDER COUNTS
    # --------------------------------------------------------

    total_purchase_orders = (
        db.query(PurchaseOrder)
        .count()
    )

    pending_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "pending"
        )
        .count()
    )

    approved_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "approved"
        )
        .count()
    )

    shipped_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "shipped"
        )
        .count()
    )

    delivered_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "delivered"
        )
        .count()
    )

    cancelled_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "cancelled"
        )
        .count()
    )

    # --------------------------------------------------------
    # DELIVERY ANALYSIS
    # --------------------------------------------------------

    delivered_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "delivered"
        )
        .all()
    )

    on_time_deliveries = 0
    delayed_deliveries = 0

    for order in delivered_orders:
        if (
            order.actual_delivery_date
            and order.expected_delivery_date
        ):
            if (
                order.actual_delivery_date
                <= order.expected_delivery_date
            ):
                on_time_deliveries += 1
            else:
                delayed_deliveries += 1

    if delivered_orders:
        on_time_percentage = round(
            (
                on_time_deliveries
                / len(delivered_orders)
            ) * 100,
            2,
        )
    else:
        on_time_percentage = 0.00

    # --------------------------------------------------------
    # RELIABILITY ANALYSIS
    # --------------------------------------------------------

    vendors_with_scores = (
        db.query(Vendor)
        .filter(
            Vendor.reliability_score.isnot(None)
        )
        .all()
    )

    reliability_scores = [
        float(vendor.reliability_score or 0)
        for vendor in vendors_with_scores
    ]

    if reliability_scores:
        average_reliability = round(
            sum(reliability_scores)
            / len(reliability_scores),
            2,
        )
    else:
        average_reliability = 0.00

    # --------------------------------------------------------
    # RISK DISTRIBUTION
    #
    # Good       >= 80
    # Medium     60 - 79.99
    # High       < 60
    # --------------------------------------------------------

    good_risk = 0
    medium_risk = 0
    high_risk = 0

    for score in reliability_scores:
        if score >= 80:
            good_risk += 1
        elif score >= 60:
            medium_risk += 1
        else:
            high_risk += 1

    # --------------------------------------------------------
    # VENDOR RELIABILITY LIST
    # --------------------------------------------------------

    vendor_reliability = []

    vendors = (
        db.query(Vendor)
        .order_by(
            Vendor.reliability_score.desc()
        )
        .all()
    )

    for vendor in vendors:
        score = float(
            vendor.reliability_score or 0
        )

        if score >= 80:
            level = "Good"
        elif score >= 60:
            level = "Medium"
        else:
            level = "Needs Attention"

        vendor_reliability.append(
            {
                "vendor_id": vendor.id,
                "company_name": vendor.company_name,
                "category": vendor.category,
                "reliability_score": score,
                "risk_level": level,
            }
        )

    # --------------------------------------------------------
    # PURCHASE ORDER VALUE
    # --------------------------------------------------------

    total_po_value = (
        db.query(
            func.coalesce(
                func.sum(
                    PurchaseOrder.total_amount
                ),
                0,
            )
        )
        .scalar()
    )

    # --------------------------------------------------------
    # FINAL RESPONSE
    # --------------------------------------------------------

    return {
        "summary": {
            "total_vendors": total_vendors,
            "approved_vendors": approved_vendors,
            "active_vendors": active_vendors,
            "inactive_vendors": inactive_vendors,

            "total_purchase_orders":
                total_purchase_orders,

            "pending_purchase_orders":
                pending_purchase_orders,

            "approved_purchase_orders":
                approved_purchase_orders,

            "shipped_purchase_orders":
                shipped_purchase_orders,

            "delivered_purchase_orders":
                delivered_purchase_orders,

            "cancelled_purchase_orders":
                cancelled_purchase_orders,

            "on_time_deliveries":
                on_time_deliveries,

            "delayed_deliveries":
                delayed_deliveries,

            "on_time_percentage":
                on_time_percentage,

            "average_reliability":
                average_reliability,

            "total_po_value":
                float(total_po_value or 0),
        },

        "risk_distribution": {
            "good": good_risk,
            "medium": medium_risk,
            "high": high_risk,
        },

        "vendor_reliability":
            vendor_reliability,

        "purchase_order_status": {
            "pending":
                pending_purchase_orders,
            "approved":
                approved_purchase_orders,
            "shipped":
                shipped_purchase_orders,
            "delivered":
                delivered_purchase_orders,
            "cancelled":
                cancelled_purchase_orders,
        },
    }
# ============================================================
# PUBLIC HOME PAGE SUMMARY
# ============================================================

@router.get("/public-summary")
def get_public_home_summary(
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # VENDOR COUNT
    # --------------------------------------------------------

    total_vendors = (
        db.query(Vendor)
        .count()
    )

    # --------------------------------------------------------
    # PURCHASE ORDER COUNTS
    # --------------------------------------------------------

    total_purchase_orders = (
        db.query(PurchaseOrder)
        .count()
    )

    approved_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "approved"
        )
        .count()
    )

    pending_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "pending"
        )
        .count()
    )

    shipped_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "shipped"
        )
        .count()
    )

    delivered_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "delivered"
        )
        .count()
    )

    # --------------------------------------------------------
    # ACTIVE PURCHASE ORDERS
    # --------------------------------------------------------
    # Pending + Approved + Shipped are considered active.

    active_purchase_orders = (
        pending_purchase_orders
        + approved_purchase_orders
        + shipped_purchase_orders
    )

    # --------------------------------------------------------
    # VENDOR RELIABILITY
    # --------------------------------------------------------

    vendors_with_scores = (
        db.query(Vendor)
        .filter(
            Vendor.reliability_score.isnot(None)
        )
        .all()
    )

    reliability_scores = [
        float(vendor.reliability_score or 0)
        for vendor in vendors_with_scores
    ]

    if reliability_scores:
        average_reliability = round(
            sum(reliability_scores)
            / len(reliability_scores),
            2,
        )
    else:
        average_reliability = 0.00

    # --------------------------------------------------------
    # RISK COUNT
    # --------------------------------------------------------
    # Medium and High vendors are considered "At Risk".
    #
    # Good    >= 80
    # Medium  60 - 79.99
    # High    < 60
    # --------------------------------------------------------

    at_risk_vendors = 0

    for score in reliability_scores:
        if score < 80:
            at_risk_vendors += 1

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {
        "total_vendors": total_vendors,
        "active_purchase_orders": active_purchase_orders,
        "at_risk_vendors": at_risk_vendors,
        "average_reliability": average_reliability,

        "total_purchase_orders": total_purchase_orders,
        "pending_purchase_orders": pending_purchase_orders,
        "approved_purchase_orders": approved_purchase_orders,
        "shipped_purchase_orders": shipped_purchase_orders,
        "delivered_purchase_orders": delivered_purchase_orders,
    }
# ============================================================
# PROCUREMENT ANALYTICS             
# ============================================================

# ============================================================
# PUBLIC HOME PAGE SUMMARY
# ============================================================

@router.get("/public-summary")
def get_public_home_summary(
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # TOTAL VENDORS
    # --------------------------------------------------------

    total_vendors = (
        db.query(Vendor)
        .count()
    )

    # --------------------------------------------------------
    # PURCHASE ORDER COUNTS
    # --------------------------------------------------------

    pending_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "pending"
        )
        .count()
    )

    approved_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "approved"
        )
        .count()
    )

    shipped_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "shipped"
        )
        .count()
    )

    delivered_purchase_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "delivered"
        )
        .count()
    )

    total_purchase_orders = (
        db.query(PurchaseOrder)
        .count()
    )

    # --------------------------------------------------------
    # ACTIVE PURCHASE ORDERS
    # --------------------------------------------------------
    # Pending + Approved + Shipped

    active_purchase_orders = (
        pending_purchase_orders
        + approved_purchase_orders
        + shipped_purchase_orders
    )

    # --------------------------------------------------------
    # AVERAGE VENDOR RELIABILITY
    # --------------------------------------------------------

    vendors_with_scores = (
        db.query(Vendor)
        .filter(
            Vendor.reliability_score.isnot(None)
        )
        .all()
    )

    reliability_scores = [
        float(vendor.reliability_score or 0)
        for vendor in vendors_with_scores
    ]

    if reliability_scores:
        average_reliability = round(
            sum(reliability_scores)
            / len(reliability_scores),
            2,
        )
    else:
        average_reliability = 0.00

    # --------------------------------------------------------
    # AT-RISK VENDORS
    # --------------------------------------------------------
    # Medium + High = reliability below 80%

    at_risk_vendors = sum(
        1
        for score in reliability_scores
        if score < 80
    )

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {
        "total_vendors": total_vendors,
        "active_purchase_orders": active_purchase_orders,
        "at_risk_vendors": at_risk_vendors,
        "average_reliability": average_reliability,
        "total_purchase_orders": total_purchase_orders,
        "pending_purchase_orders": pending_purchase_orders,
        "approved_purchase_orders": approved_purchase_orders,
        "shipped_purchase_orders": shipped_purchase_orders,
        "delivered_purchase_orders": delivered_purchase_orders,
    }

@router.get("/procurement")
def get_procurement_analytics(
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
            "finance_officer",
            "auditor",
        )
    ),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # PROCUREMENT REQUEST COUNTS
    # --------------------------------------------------------

    total_prs = (
        db.query(ProcurementRequest)
        .count()
    )

    pending_prs = (
        db.query(ProcurementRequest)
        .filter(
            ProcurementRequest.status == "pending"
        )
        .count()
    )

    approved_prs = (
        db.query(ProcurementRequest)
        .filter(
            ProcurementRequest.status == "approved"
        )
        .count()
    )

    rejected_prs = (
        db.query(ProcurementRequest)
        .filter(
            ProcurementRequest.status == "rejected"
        )
        .count()
    )

    converted_prs = (
        db.query(ProcurementRequest)
        .filter(
            ProcurementRequest.status == "converted"
        )
        .count()
    )

    # --------------------------------------------------------
    # PURCHASE ORDER COUNTS
    # --------------------------------------------------------

    total_pos = (
        db.query(PurchaseOrder)
        .count()
    )

    pending_pos = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "pending"
        )
        .count()
    )

    approved_pos = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "approved"
        )
        .count()
    )

    shipped_pos = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "shipped"
        )
        .count()
    )

    delivered_pos = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "delivered"
        )
        .count()
    )

    cancelled_pos = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "cancelled"
        )
        .count()
    )

    # --------------------------------------------------------
    # TOTAL PO VALUE
    # --------------------------------------------------------

    total_po_value = (
        db.query(
            func.coalesce(
                func.sum(
                    PurchaseOrder.total_amount
                ),
                0,
            )
        )
        .scalar()
    )

    # --------------------------------------------------------
    # DELIVERY ANALYSIS
    # --------------------------------------------------------

    delivered_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.status == "delivered"
        )
        .all()
    )

    on_time_deliveries = 0
    delayed_deliveries = 0
    total_delivery_days = 0
    delivery_records = 0

    for order in delivered_orders:

        if (
            order.actual_delivery_date
            and order.expected_delivery_date
        ):

            if (
                order.actual_delivery_date
                <= order.expected_delivery_date
            ):
                on_time_deliveries += 1
            else:
                delayed_deliveries += 1

            if order.order_date:
                delivery_days = (
                    order.actual_delivery_date
                    - order.order_date
                ).days

                if delivery_days >= 0:
                    total_delivery_days += delivery_days
                    delivery_records += 1

    if delivered_orders:
        on_time_percentage = round(
            (
                on_time_deliveries
                / len(delivered_orders)
            ) * 100,
            2,
        )
    else:
        on_time_percentage = 0.00

    if delivery_records:
        average_delivery_days = round(
            total_delivery_days
            / delivery_records,
            2,
        )
    else:
        average_delivery_days = 0.00

    # --------------------------------------------------------
    # PROCUREMENT COMPLETION RATE
    # --------------------------------------------------------

    if total_pos > 0:
        completion_rate = round(
            (
                delivered_pos
                / total_pos
            ) * 100,
            2,
        )
    else:
        completion_rate = 0.00

    # --------------------------------------------------------
    # VENDOR-WISE PROCUREMENT
    # --------------------------------------------------------

    vendor_procurement = []

    vendors = (
        db.query(Vendor)
        .order_by(Vendor.company_name.asc())
        .all()
    )

    for vendor in vendors:

        vendor_pos = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.vendor_id == vendor.id
            )
            .all()
        )

        order_count = len(vendor_pos)

        total_amount = sum(
            float(po.total_amount or 0)
            for po in vendor_pos
        )

        delivered_count = sum(
            1
            for po in vendor_pos
            if po.status == "delivered"
        )

        vendor_procurement.append(
            {
                "vendor_id": vendor.id,
                "company_name": vendor.company_name,
                "category": vendor.category,
                "order_count": order_count,
                "total_amount": round(
                    total_amount,
                    2,
                ),
                "delivered_orders": delivered_count,
            }
        )

    # --------------------------------------------------------
    # FINAL RESPONSE
    # --------------------------------------------------------

    return {
        "procurement_summary": {
            "total_prs": total_prs,
            "pending_prs": pending_prs,
            "approved_prs": approved_prs,
            "rejected_prs": rejected_prs,
            "converted_prs": converted_prs,

            "total_pos": total_pos,
            "pending_pos": pending_pos,
            "approved_pos": approved_pos,
            "shipped_pos": shipped_pos,
            "delivered_pos": delivered_pos,
            "cancelled_pos": cancelled_pos,

            "total_po_value": float(
                total_po_value or 0
            ),

            "on_time_deliveries":
                on_time_deliveries,

            "delayed_deliveries":
                delayed_deliveries,

            "on_time_percentage":
                on_time_percentage,

            "average_delivery_days":
                average_delivery_days,

            "completion_rate":
                completion_rate,
        },

        "pr_status": {
            "pending": pending_prs,
            "approved": approved_prs,
            "rejected": rejected_prs,
            "converted": converted_prs,
        },

        "po_status": {
            "pending": pending_pos,
            "approved": approved_pos,
            "shipped": shipped_pos,
            "delivered": delivered_pos,
            "cancelled": cancelled_pos,
        },

        "vendor_procurement":
            vendor_procurement,
    }