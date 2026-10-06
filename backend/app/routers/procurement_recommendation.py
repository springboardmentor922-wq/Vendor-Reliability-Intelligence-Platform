from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.procurement_recommendation import ProcurementRecommendation
from app.models.risk_analysis import RiskAnalysis
from app.models.vendor import Vendor
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/procurement-recommendations",
    tags=["Procurement Recommendations"]
)


@router.post("/generate/{vendor_id}")
def generate_recommendation(
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

    risk = db.query(RiskAnalysis).filter(
        RiskAnalysis.vendor_id == vendor_id
    ).first()

    if not risk:
        raise HTTPException(
            status_code=404,
            detail="Risk analysis not found. Calculate risk first."
        )

    reliability_score = risk.reliability_score
    risk_score = risk.risk_score

    if risk_score <= 20:
        recommendation = "PREFERRED"
        reason = "High reliability and low procurement risk."
    elif risk_score <= 40:
        recommendation = "APPROVED_WITH_MONITORING"
        reason = "Vendor can be used with regular performance monitoring."
    elif risk_score <= 60:
        recommendation = "LIMITED_USE"
        reason = "Vendor should be used selectively and monitored closely."
    else:
        recommendation = "AVOID_FOR_NEW_ORDERS"
        reason = "High procurement risk based on vendor reliability."

    existing = db.query(
        ProcurementRecommendation
    ).filter(
        ProcurementRecommendation.vendor_id == vendor_id
    ).first()

    if not existing:
        existing = ProcurementRecommendation(
            vendor_id=vendor_id
        )
        db.add(existing)

    existing.reliability_score = reliability_score
    existing.risk_score = risk_score
    existing.recommendation = recommendation
    existing.reason = reason

    db.commit()
    db.refresh(existing)

    return {
        "vendor_id": vendor_id,
        "vendor_name": vendor.vendor_name,
        "reliability_score": reliability_score,
        "risk_score": risk_score,
        "recommendation": recommendation,
        "reason": reason
    }


@router.get("/")
def get_recommendations(
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
    return db.query(ProcurementRecommendation).all()


@router.get("/{recommendation_id}")
def get_recommendation(
    recommendation_id: int,
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
    recommendation = db.query(
        ProcurementRecommendation
    ).filter(
        ProcurementRecommendation.id == recommendation_id
    ).first()

    if not recommendation:
        raise HTTPException(
            status_code=404,
            detail="Recommendation not found"
        )

    return recommendation