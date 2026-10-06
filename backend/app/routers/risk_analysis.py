from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.risk_analysis import RiskAnalysis
from app.models.vendor_reliability import VendorReliability
from app.models.vendor import Vendor
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/risk-analysis",
    tags=["Risk Analysis"]
)


@router.post("/calculate/{vendor_id}")
def calculate_risk(
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

    reliability = db.query(VendorReliability).filter(
        VendorReliability.vendor_id == vendor_id
    ).first()

    if not reliability:
        raise HTTPException(
            status_code=404,
            detail="Vendor reliability record not found. Calculate reliability first."
        )

    reliability_score = reliability.reliability_score

    risk_score = round(
        100 - reliability_score,
        2
    )

    if reliability_score >= 80:
        risk_level = "LOW"
        risk_reason = "Vendor has strong reliability."
    elif reliability_score >= 60:
        risk_level = "MEDIUM"
        risk_reason = "Vendor reliability requires monitoring."
    else:
        risk_level = "HIGH"
        risk_reason = "Vendor has low reliability and requires attention."

    risk = db.query(RiskAnalysis).filter(
        RiskAnalysis.vendor_id == vendor_id
    ).first()

    if not risk:
        risk = RiskAnalysis(
            vendor_id=vendor_id
        )
        db.add(risk)

    risk.reliability_score = reliability_score
    risk.risk_score = risk_score
    risk.risk_level = risk_level
    risk.risk_reason = risk_reason

    db.commit()
    db.refresh(risk)

    return {
        "vendor_id": vendor_id,
        "vendor_name": vendor.vendor_name,
        "reliability_score": reliability_score,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_reason": risk_reason
    }


@router.get("/")
def get_risk_analysis(
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
    return db.query(RiskAnalysis).all()


@router.get("/{risk_id}")
def get_risk(
    risk_id: int,
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
    risk = db.query(RiskAnalysis).filter(
        RiskAnalysis.id == risk_id
    ).first()

    if not risk:
        raise HTTPException(
            status_code=404,
            detail="Risk analysis record not found"
        )

    return risk