from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import (
    get_current_user,
    require_procurement_team,
    require_operations_read,
)
from app.core.utils import log_activity
from app.db.session_dep import get_db

from app.models.user import User, UserRole
from app.models.vendor import Vendor, VendorCategory
from app.models.reliability import ReliabilityScore, RiskLevel

from app.schemas.reliability import (
    ReliabilityScoreOut,
    VendorRankingEntry,
    RiskSummary,
)

from app.services import reliability_service


router = APIRouter()


# ============================================================
# CALCULATE RELIABILITY SCORE
# ============================================================

@router.post(
    "/vendors/{vendor_id}/calculate",
    response_model=ReliabilityScoreOut,
)
def calculate_reliability_score(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_team),
):
    """
    Calculate and store the latest reliability score for a vendor.

    Allowed roles:
    - administrator
    - procurement_manager
    - supply_chain_manager
    """

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    score = reliability_service.calculate_reliability_score(
        db=db,
        vendor_id=vendor_id,
    )

    if score is None:
        raise HTTPException(
            status_code=404,
            detail="Unable to calculate reliability score",
        )

    log_activity(
        db=db,
        user_id=current_user.id,
        action="CALCULATE_RELIABILITY_SCORE",
        entity_type="vendor",
        entity_id=str(vendor_id),
        description=(
            f"Reliability score calculated for vendor "
            f"{vendor.company_name}"
        ),
    )

    db.commit()

    return score


# ============================================================
# GET VENDOR RELIABILITY
# ============================================================

@router.get(
    "/vendors/{vendor_id}",
    response_model=ReliabilityScoreOut,
)
def get_vendor_reliability(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the latest reliability score for a vendor.

    Vendor users can only access their own vendor profile.
    Other authenticated roles can access vendor reliability data.
    """

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    # Vendor can access only their own vendor record
    if current_user.role == UserRole.VENDOR:
        if vendor.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only access your own vendor reliability",
            )

    score = (
        db.query(ReliabilityScore)
        .filter(
            ReliabilityScore.vendor_id == vendor_id
        )
        .order_by(
            ReliabilityScore.calculated_at.desc()
        )
        .first()
    )

    if not score:
        raise HTTPException(
            status_code=404,
            detail="Reliability score not found",
        )

    return score


# ============================================================
# GET VENDOR RELIABILITY HISTORY
# ============================================================

@router.get(
    "/vendors/{vendor_id}/history",
    response_model=List[ReliabilityScoreOut],
)
def get_vendor_reliability_history(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get reliability score history for a vendor.

    Vendor users can only access their own history.
    """

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    # Vendor ownership check
    if current_user.role == UserRole.VENDOR:
        if vendor.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only access your own vendor history",
            )

    scores = (
        db.query(ReliabilityScore)
        .filter(
            ReliabilityScore.vendor_id == vendor_id
        )
        .order_by(
            ReliabilityScore.calculated_at.desc()
        )
        .all()
    )

    return scores


# ============================================================
# VENDOR RELIABILITY RANKING
# ============================================================

@router.get(
    "/ranking",
    response_model=List[VendorRankingEntry],
)
def get_vendor_reliability_ranking(
    category: Optional[VendorCategory] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operations_read),
):
    """
    Get vendor reliability ranking.

    Allowed roles:
    - administrator
    - procurement_manager
    - supply_chain_manager
    - auditor
    """

    if limit < 1:
        raise HTTPException(
            status_code=400,
            detail="Limit must be greater than 0",
        )

    if limit > 100:
        raise HTTPException(
            status_code=400,
            detail="Limit cannot exceed 100",
        )

    query = (
        db.query(
            Vendor,
            ReliabilityScore,
        )
        .join(
            ReliabilityScore,
            ReliabilityScore.vendor_id == Vendor.id,
        )
    )

    if category is not None:
        query = query.filter(
            Vendor.category == category
        )

    results = (
        query
        .order_by(
            ReliabilityScore.overall_score.desc()
        )
        .limit(limit)
        .all()
    )

    ranking = []

    for vendor, score in results:
        ranking.append(
            VendorRankingEntry(
                vendor_id=vendor.id,
                company_name=vendor.company_name,
                category=vendor.category,
                overall_score=score.overall_score,
                risk_level=score.risk_level,
            )
        )

    return ranking


# ============================================================
# RISK SUMMARY
# ============================================================

# ============================================================
# RISK SUMMARY
# ============================================================

@router.get(
    "/risk-summary",
    response_model=RiskSummary,
)
def get_risk_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operations_read),
):
    """
    Get vendor risk distribution.

    Allowed roles:
    - administrator
    - procurement_manager
    - supply_chain_manager
    - auditor
    """

    vendors = db.query(Vendor).all()

    low = 0
    medium = 0
    high = 0
    critical = 0

    for vendor in vendors:

        latest_score = (
            db.query(ReliabilityScore)
            .filter(
                ReliabilityScore.vendor_id == vendor.id
            )
            .order_by(
                ReliabilityScore.calculated_at.desc()
            )
            .first()
        )

        if not latest_score:
            continue

        if latest_score.risk_level == RiskLevel.LOW:
            low += 1

        elif latest_score.risk_level == RiskLevel.MEDIUM:
            medium += 1

        elif latest_score.risk_level == RiskLevel.HIGH:
            high += 1

        else:
            critical += 1

    return RiskSummary(
        total_vendors=len(vendors),
        low_risk=low,
        medium_risk=medium,
        high_risk=high,
        critical_risk=critical,
    )
