from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.scoring import calculate_reliability_score
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.models.performance import PerformanceRecord
from app.models.score_history import ScoreHistory
from app.schemas.performance import PerformanceRecordCreate, PerformanceRecordOut

router = APIRouter(prefix="/performance", tags=["Vendor Performance"])

MANAGE_ROLES = (UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER, UserRole.SUPPLY_CHAIN_MANAGER)


@router.post("/", response_model=PerformanceRecordOut, status_code=status.HTTP_201_CREATED)
def log_performance(
    payload: PerformanceRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    record = PerformanceRecord(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)

    score_data = calculate_reliability_score(db, vendor.id)
    vendor.previous_reliability_score = vendor.reliability_score
    vendor.reliability_score = score_data["reliability_score"]
    db.add(ScoreHistory(vendor_id=vendor.id, score=score_data["reliability_score"]))
    db.commit()

    return record


@router.get("/vendor/{vendor_id}", response_model=List[PerformanceRecordOut])
def get_vendor_performance_history(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    return db.query(PerformanceRecord).filter(PerformanceRecord.vendor_id == vendor_id).all()


@router.get("/vendor/{vendor_id}/score")
def get_vendor_reliability_score(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    score_data = calculate_reliability_score(db, vendor_id)
    return {"vendor_id": vendor_id, **score_data}


@router.get("/vendor/{vendor_id}/trend")
def get_vendor_score_trend(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = db.query(ScoreHistory).filter(ScoreHistory.vendor_id == vendor_id).order_by(ScoreHistory.recorded_at).all()
    return [{"date": h.recorded_at, "score": h.score} for h in history]


@router.get("/vendor/{vendor_id}/forecast")
def forecast_vendor_score(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = db.query(ScoreHistory).filter(ScoreHistory.vendor_id == vendor_id).order_by(ScoreHistory.recorded_at).all()

    if len(history) < 2:
        return {"projected_score": None, "direction": "insufficient_data", "message": "Need at least 2 performance records to forecast a trend"}

    scores = [h.score for h in history]
    n = len(scores)
    x_vals = list(range(n))
    x_mean = sum(x_vals) / n
    y_mean = sum(scores) / n

    numerator = sum((x_vals[i] - x_mean) * (scores[i] - y_mean) for i in range(n))
    denominator = sum((x_vals[i] - x_mean) ** 2 for i in range(n))
    slope = numerator / denominator if denominator != 0 else 0

    next_x = n
    projected = y_mean + slope * (next_x - x_mean)
    projected = max(0, min(100, round(projected, 2)))

    direction = "improving" if slope > 0.5 else "declining" if slope < -0.5 else "stable"

    return {
        "current_score": scores[-1],
        "projected_score": projected,
        "direction": direction,
        "slope_per_entry": round(slope, 3),
    }