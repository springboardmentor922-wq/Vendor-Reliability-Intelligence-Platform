from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.scoring import calculate_reliability_score
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.models.performance import PerformanceRecord
from app.schemas.performance import PerformanceRecordCreate, PerformanceRecordOut, ReliabilityScoreOut

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

    # Recalculate and update the vendor's stored reliability score
    all_records = db.query(PerformanceRecord).filter(PerformanceRecord.vendor_id == vendor.id).all()
    score_data = calculate_reliability_score(all_records)
    vendor.reliability_score = score_data["reliability_score"]
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


@router.get("/vendor/{vendor_id}/score", response_model=ReliabilityScoreOut)
def get_vendor_reliability_score(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    records = db.query(PerformanceRecord).filter(PerformanceRecord.vendor_id == vendor_id).all()
    score_data = calculate_reliability_score(records)

    return ReliabilityScoreOut(vendor_id=vendor_id, **score_data)