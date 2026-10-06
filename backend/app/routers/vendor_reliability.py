from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.vendor_reliability import VendorReliability
from app.models.vendor_performance import VendorPerformance
from app.models.vendor import Vendor
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/vendor-reliability",
    tags=["Vendor Reliability"]
)


@router.post("/calculate/{vendor_id}")
def calculate_vendor_reliability(
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

    performance = db.query(VendorPerformance).filter(
        VendorPerformance.vendor_id == vendor_id
    ).first()

    if not performance:
        raise HTTPException(
            status_code=404,
            detail="Vendor performance record not found. Calculate performance first."
        )

    performance_score = performance.overall_performance_score

    reliability_score = round(
        performance_score,
        2
    )

    if reliability_score >= 80:
        risk_score = 20
    elif reliability_score >= 60:
        risk_score = 50
    else:
        risk_score = 80

    reliability = db.query(VendorReliability).filter(
        VendorReliability.vendor_id == vendor_id
    ).first()

    if not reliability:
        reliability = VendorReliability(
            vendor_id=vendor_id
        )
        db.add(reliability)

    reliability.performance_score = performance_score
    reliability.reliability_score = reliability_score
    reliability.risk_score = risk_score

    db.commit()
    db.refresh(reliability)

    return {
        "vendor_id": vendor_id,
        "vendor_name": vendor.vendor_name,
        "performance_score": performance_score,
        "reliability_score": reliability_score,
        "risk_score": risk_score
    }


@router.get("/")
def get_vendor_reliability(
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
    return db.query(VendorReliability).all()


@router.get("/{reliability_id}")
def get_reliability(
    reliability_id: int,
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
    reliability = db.query(VendorReliability).filter(
        VendorReliability.id == reliability_id
    ).first()

    if not reliability:
        raise HTTPException(
            status_code=404,
            detail="Vendor reliability record not found"
        )

    return reliability