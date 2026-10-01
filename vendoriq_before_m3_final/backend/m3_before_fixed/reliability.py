from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_procurement_team
from app.core.utils import log_activity
from app.db.session_dep import get_db
from app.models.user import User
from app.models.vendor import Vendor, VendorCategory
from app.models.reliability import ReliabilityScore, RiskLevel
from app.schemas.reliability import ReliabilityScoreOut, VendorRankingEntry, RiskSummary
from app.services import reliability_service

router = APIRouter()


@router.post("/vendors/{vendor_id}/calculate", response_model=ReliabilityScoreOut, status_code=201)
def calculate_reliability(vendor_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(require_procurement_team)):
    """Vendor Reliability Score: recompute from the six weighted factors and
    store a new history row (never overwritten in place)."""
    try:
        record = reliability_service.calculate_reliability(db, vendor_id, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Vendor not found")

    log_activity(
        db, current_user.id, "reliability_score_calculated", "vendor", vendor_id,
        f"Score {record.score} — {record.risk_level.value} risk",
    )
    return record


@router.get("/vendors/{vendor_id}", response_model=ReliabilityScoreOut)
def get_latest_reliability(vendor_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    record = reliability_service.get_latest_score(db, vendor_id)
    if not record:
        raise HTTPException(status_code=404, detail="No reliability score calculated yet for this vendor")
    return record


@router.get("/vendors/{vendor_id}/history", response_model=List[ReliabilityScoreOut])
def reliability_history(vendor_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Performance Trend Analysis backing data: full score history."""
    return (
        db.query(ReliabilityScore)
        .filter(ReliabilityScore.vendor_id == vendor_id)
        .order_by(ReliabilityScore.calculated_at.asc())
        .all()
    )


@router.get("/ranking", response_model=List[VendorRankingEntry])
def supplier_ranking(
    category: Optional[VendorCategory] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Supplier Ranking, optionally within a category — uses each vendor's
    latest reliability score."""
    query = db.query(Vendor)
    if category:
        query = query.filter(Vendor.category == category)
    vendors = query.all()

    entries = []
    for v in vendors:
        latest = reliability_service.get_latest_score(db, v.id)
        if latest:
            entries.append(
                VendorRankingEntry(
                    vendor_id=v.id, company_name=v.company_name, category=v.category.value,
                    score=latest.score, risk_level=latest.risk_level, recommendation=latest.recommendation,
                )
            )
    entries.sort(key=lambda e: e.score, reverse=True)
    return entries


@router.get("/risk-summary", response_model=RiskSummary)
def risk_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Vendor Risk Dashboard: counts of vendors by their latest risk level."""
    vendors = db.query(Vendor).all()
    counts = {"low": 0, "medium": 0, "high": 0, "not_yet_scored": 0}
    for v in vendors:
        latest = reliability_service.get_latest_score(db, v.id)
        if not latest:
            counts["not_yet_scored"] += 1
        else:
            counts[latest.risk_level.value] += 1
    return RiskSummary(low=counts["low"], medium=counts["medium"], high=counts["high"], not_yet_scored=counts["not_yet_scored"])
