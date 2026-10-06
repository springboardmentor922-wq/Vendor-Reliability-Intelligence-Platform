from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.vendor_performance import VendorPerformance
from app.models.procurement import Procurement
from app.models.vendor import Vendor
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/vendor-performance",
    tags=["Vendor Performance"]
)


@router.post("/calculate/{vendor_id}")
def calculate_vendor_performance(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER",
            "SUPPLY_CHAIN_MANAGER"
        )
    )
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    procurements = (
        db.query(Procurement)
        .filter(
            Procurement.vendor_id == vendor_id
        )
        .all()
    )

    if not procurements:
        raise HTTPException(
            status_code=404,
            detail="No procurement records found for this vendor."
        )

    total_orders = len(procurements)

    completed_orders = sum(
        1 for p in procurements
        if p.status == "COMPLETED"
    )

    delivered_orders = [
        p for p in procurements
        if p.actual_delivery_date is not None
    ]

    on_time_deliveries = sum(
        1
        for p in delivered_orders
        if (
            p.expected_delivery_date is not None
            and p.actual_delivery_date <= p.expected_delivery_date
        )
    )

    delayed_deliveries = sum(
        1
        for p in delivered_orders
        if (
            p.expected_delivery_date is not None
            and p.actual_delivery_date > p.expected_delivery_date
        )
    )

    if delivered_orders:
        delivery_score = (
            on_time_deliveries / len(delivered_orders)
        ) * 100
    else:
        delivery_score = 0

    completion_score = (
        completed_orders / total_orders
    ) * 100

    quality_score = 0

    overall_performance_score = (
        delivery_score * 0.50
        + quality_score * 0.25
        + completion_score * 0.25
    )

    reliability_score = round(
        overall_performance_score,
        2
    )

    if overall_performance_score >= 80:
        status = "GOOD"
    elif overall_performance_score >= 60:
        status = "AVERAGE"
    else:
        status = "POOR"

    performance = (
        db.query(VendorPerformance)
        .filter(
            VendorPerformance.vendor_id == vendor_id
        )
        .first()
    )

    if not performance:
        performance = VendorPerformance(
            vendor_id=vendor_id,
            vendor_name=vendor.vendor_name
        )
        db.add(performance)
    else:
        performance.vendor_name = vendor.vendor_name

    performance.total_orders = total_orders
    performance.completed_orders = completed_orders
    performance.on_time_deliveries = on_time_deliveries
    performance.delayed_deliveries = delayed_deliveries
    performance.delivery_score = round(
        delivery_score,
        2
    )
    performance.quality_score = quality_score
    performance.completion_score = round(
        completion_score,
        2
    )
    performance.overall_performance_score = round(
        overall_performance_score,
        2
    )
    performance.reliability_score = reliability_score
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
            overall_performance_score,
            2
        ),
        "reliability_score": reliability_score,
        "status": status
    }


@router.get("/")
def get_performances(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER",
            "SUPPLY_CHAIN_MANAGER",
            "FINANCE_OFFICER",
            "AUDITOR"
        )
    )
):
    return db.query(VendorPerformance).all()


@router.get("/{performance_id}")
def get_performance(
    performance_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER",
            "SUPPLY_CHAIN_MANAGER",
            "FINANCE_OFFICER",
            "AUDITOR"
        )
    )
):
    performance = (
        db.query(VendorPerformance)
        .filter(
            VendorPerformance.id == performance_id
        )
        .first()
    )

    if not performance:
        raise HTTPException(
            status_code=404,
            detail="Performance record not found"
        )

    return performance