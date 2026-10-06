from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.vendor_performance import VendorPerformance
from app.models.procurement import Procurement
from app.models.vendor import Vendor
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/performance",
    tags=["Vendor Performance"]
)


ALL_ROLES = [
    "ADMINISTRATOR",
    "PROCUREMENT_MANAGER",
    "SUPPLY_CHAIN_MANAGER",
    "VENDOR",
    "FINANCE_OFFICER",
    "AUDITOR"
]


# ---------------------------------------------------------
# CALCULATE VENDOR PERFORMANCE
# ---------------------------------------------------------
@router.get("/calculate/{vendor_id}")
def calculate_vendor_performance(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*ALL_ROLES))
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        return {
            "message": "Vendor not found"
        }

    procurements = db.query(Procurement).filter(
        Procurement.vendor_id == vendor_id
    ).all()

    total_orders = len(procurements)

    completed_orders = len([
        p for p in procurements
        if p.status == "COMPLETED"
    ])

    on_time_deliveries = 0
    delayed_deliveries = 0

    for procurement in procurements:

        if (
            procurement.expected_delivery_date
            and procurement.actual_delivery_date
        ):
            if (
                procurement.actual_delivery_date
                <= procurement.expected_delivery_date
            ):
                on_time_deliveries += 1
            else:
                delayed_deliveries += 1

    if total_orders > 0:
        completion_score = (
            completed_orders / total_orders
        ) * 100
    else:
        completion_score = 0

    delivery_total = (
        on_time_deliveries + delayed_deliveries
    )

    if delivery_total > 0:
        delivery_score = (
            on_time_deliveries / delivery_total
        ) * 100
    else:
        delivery_score = 0

    quality_score = 100

    overall_performance_score = (
        delivery_score * 0.40
        + completion_score * 0.40
        + quality_score * 0.20
    )

    if overall_performance_score >= 80:
        status = "GOOD"
    elif overall_performance_score >= 60:
        status = "AVERAGE"
    else:
        status = "POOR"

    performance = db.query(
        VendorPerformance
    ).filter(
        VendorPerformance.vendor_id == vendor_id
    ).first()

    if not performance:
        performance = VendorPerformance(
            vendor_id=vendor_id
        )
        db.add(performance)

    performance.total_orders = total_orders
    performance.completed_orders = completed_orders
    performance.on_time_deliveries = on_time_deliveries
    performance.delayed_deliveries = delayed_deliveries
    performance.delivery_score = round(
        delivery_score, 2
    )
    performance.quality_score = quality_score
    performance.completion_score = round(
        completion_score, 2
    )
    performance.overall_performance_score = round(
        overall_performance_score, 2
    )
    performance.status = status

    db.commit()
    db.refresh(performance)

    return {
        "vendor_id": vendor_id,
        "vendor_name": vendor.vendor_name,
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "on_time_deliveries": on_time_deliveries,
        "delayed_deliveries": delayed_deliveries,
        "delivery_score": round(delivery_score, 2),
        "quality_score": quality_score,
        "completion_score": round(completion_score, 2),
        "overall_performance_score": round(
            overall_performance_score, 2
        ),
        "status": status
    }


# ---------------------------------------------------------
# GET ALL VENDOR PERFORMANCE
# ---------------------------------------------------------
@router.get("/")
def get_all_performance(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*ALL_ROLES))
):
    return db.query(
        VendorPerformance
    ).all()


# ---------------------------------------------------------
# GET PERFORMANCE FOR ONE VENDOR
# ---------------------------------------------------------
@router.get("/{vendor_id}")
def get_vendor_performance(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*ALL_ROLES))
):
    performance = db.query(
        VendorPerformance
    ).filter(
        VendorPerformance.vendor_id == vendor_id
    ).first()

    if not performance:
        return {
            "message": "Performance record not found. Calculate performance first."
        }

    return performance