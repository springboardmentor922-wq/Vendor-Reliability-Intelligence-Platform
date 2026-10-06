from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.reliability_score import ReliabilityScore
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/reliability",
    tags=["Reliability Score"]
)


# Reliability factor weights
DELIVERY_WEIGHT = 0.25
QUALITY_WEIGHT = 0.25
COMMUNICATION_WEIGHT = 0.10
CONTRACT_WEIGHT = 0.15
PURCHASE_HISTORY_WEIGHT = 0.10
ISSUE_RESOLUTION_WEIGHT = 0.15


def calculate_reliability_score(
    delivery_score: float,
    quality_score: float,
    communication_score: float,
    contract_compliance_score: float,
    purchase_history_score: float,
    issue_resolution_score: float
):
    overall_score = (
        delivery_score * DELIVERY_WEIGHT
        + quality_score * QUALITY_WEIGHT
        + communication_score * COMMUNICATION_WEIGHT
        + contract_compliance_score * CONTRACT_WEIGHT
        + purchase_history_score * PURCHASE_HISTORY_WEIGHT
        + issue_resolution_score * ISSUE_RESOLUTION_WEIGHT
    )

    if overall_score >= 80:
        risk_level = "LOW"
    elif overall_score >= 60:
        risk_level = "MEDIUM"
    else:
        risk_level = "HIGH"

    return round(overall_score, 2), risk_level


def calculate_trend(
    current_score: float,
    previous_score: float | None
):
    if previous_score is None:
        return "STABLE"

    difference = current_score - previous_score

    if difference >= 5:
        return "IMPROVING"
    elif difference <= -5:
        return "DECLINING"
    else:
        return "STABLE"


@router.post("/")
def create_reliability_score(
    vendor_id: int,
    delivery_score: float,
    quality_score: float,
    communication_score: float,
    contract_compliance_score: float,
    purchase_history_score: float,
    issue_resolution_score: float,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER",
            "SUPPLY_CHAIN_MANAGER"
        )
    )
):
    scores = [
        delivery_score,
        quality_score,
        communication_score,
        contract_compliance_score,
        purchase_history_score,
        issue_resolution_score
    ]

    if any(score < 0 or score > 100 for score in scores):
        raise HTTPException(
            status_code=400,
            detail="All reliability scores must be between 0 and 100."
        )

    overall_score, risk_level = calculate_reliability_score(
        delivery_score,
        quality_score,
        communication_score,
        contract_compliance_score,
        purchase_history_score,
        issue_resolution_score
    )

    previous_record = (
        db.query(ReliabilityScore)
        .filter(ReliabilityScore.vendor_id == vendor_id)
        .order_by(ReliabilityScore.created_at.desc())
        .first()
    )

    previous_score = (
        previous_record.overall_score
        if previous_record
        else None
    )

    trend = calculate_trend(
        overall_score,
        previous_score
    )

    reliability = ReliabilityScore(
        vendor_id=vendor_id,
        delivery_score=delivery_score,
        quality_score=quality_score,
        communication_score=communication_score,
        contract_compliance_score=contract_compliance_score,
        purchase_history_score=purchase_history_score,
        issue_resolution_score=issue_resolution_score,
        overall_score=overall_score,
        risk_level=risk_level,
        trend=trend
    )

    db.add(reliability)
    db.commit()
    db.refresh(reliability)

    return reliability


@router.get("/")
def get_reliability_scores(
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
    return db.query(ReliabilityScore).all()


@router.get("/ranking")
def get_reliability_ranking(
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
    return (
        db.query(ReliabilityScore)
        .order_by(ReliabilityScore.overall_score.desc())
        .all()
    )


@router.get("/risk-summary")
def get_risk_summary(
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
    scores = db.query(ReliabilityScore).all()

    return {
        "LOW": sum(
            1 for score in scores
            if score.risk_level == "LOW"
        ),
        "MEDIUM": sum(
            1 for score in scores
            if score.risk_level == "MEDIUM"
        ),
        "HIGH": sum(
            1 for score in scores
            if score.risk_level == "HIGH"
        )
    }


@router.get("/{vendor_id}")
def get_vendor_reliability(
    vendor_id: int,
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
    reliability = (
        db.query(ReliabilityScore)
        .filter(
            ReliabilityScore.vendor_id == vendor_id
        )
        .order_by(
            ReliabilityScore.created_at.desc()
        )
        .first()
    )

    if not reliability:
        raise HTTPException(
            status_code=404,
            detail="Reliability score not found"
        )

    return reliability