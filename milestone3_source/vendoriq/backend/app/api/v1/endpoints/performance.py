from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_procurement_team
from app.core.utils import log_activity
from app.db.session_dep import get_db
from app.models.user import User
from app.models.performance import QualityEvaluation, Issue, IssueStatus, PerformanceSnapshot
from app.models.vendor import Vendor
from app.schemas.performance import (
    QualityEvaluationCreate,
    QualityEvaluationOut,
    IssueCreate,
    IssueResolve,
    IssueOut,
    PerformanceSnapshotOut,
    VendorMetrics,
)
from app.services import performance_service

router = APIRouter()


# ---- Quality Evaluation ----

@router.post("/quality-evaluations", response_model=QualityEvaluationOut, status_code=201)
def create_quality_evaluation(
    payload: QualityEvaluationCreate, db: Session = Depends(get_db), current_user: User = Depends(require_procurement_team)
):
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    evaluation = QualityEvaluation(evaluated_by_id=current_user.id, **payload.model_dump())
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    log_activity(db, current_user.id, "quality_evaluation_recorded", "vendor", vendor.id, f"Rating {payload.rating}/5")
    return evaluation


@router.get("/quality-evaluations", response_model=List[QualityEvaluationOut])
def list_quality_evaluations(vendor_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(QualityEvaluation)
    if vendor_id:
        query = query.filter(QualityEvaluation.vendor_id == vendor_id)
    return query.order_by(QualityEvaluation.created_at.desc()).all()


# ---- Issues ----

@router.post("/issues", response_model=IssueOut, status_code=201)
def raise_issue(payload: IssueCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    issue = Issue(raised_by_id=current_user.id, **payload.model_dump())
    db.add(issue)
    db.commit()
    db.refresh(issue)
    log_activity(db, current_user.id, "issue_raised", "vendor", vendor.id, payload.title)
    return issue


@router.get("/issues", response_model=List[IssueOut])
def list_issues(
    vendor_id: Optional[int] = None,
    status_filter: Optional[IssueStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Issue)
    if vendor_id:
        query = query.filter(Issue.vendor_id == vendor_id)
    if status_filter:
        query = query.filter(Issue.status == status_filter)
    return query.order_by(Issue.raised_at.desc()).all()


@router.put("/issues/{issue_id}/resolve", response_model=IssueOut)
def resolve_issue(
    issue_id: int, payload: IssueResolve, db: Session = Depends(get_db), current_user: User = Depends(require_procurement_team)
):
    from datetime import datetime

    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    issue.status = IssueStatus.RESOLVED
    issue.resolved_at = datetime.utcnow()
    issue.resolution_notes = payload.resolution_notes
    db.commit()
    db.refresh(issue)
    log_activity(db, current_user.id, "issue_resolved", "vendor", issue.vendor_id, f"Issue #{issue.id} resolved")
    return issue


# ---- Computed metrics & history ----

@router.get("/vendors/{vendor_id}/metrics", response_model=VendorMetrics)
def vendor_metrics(vendor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Live-computed metrics: On-Time/Delayed Deliveries, Quality Rating,
    Response Time, Issue Resolution Time, Order Completion Rate."""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return performance_service.get_vendor_metrics(db, vendor_id)


@router.post("/vendors/{vendor_id}/snapshot", response_model=PerformanceSnapshotOut, status_code=201)
def create_snapshot(
    vendor_id: int, period: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(require_procurement_team)
):
    """Persist current metrics as a dated snapshot (Performance History)."""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return performance_service.create_snapshot(db, vendor_id, period)


@router.get("/vendors/{vendor_id}/history", response_model=List[PerformanceSnapshotOut])
def performance_history(vendor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(PerformanceSnapshot)
        .filter(PerformanceSnapshot.vendor_id == vendor_id)
        .order_by(PerformanceSnapshot.period.asc())
        .all()
    )


@router.get("/ranking")
def vendor_ranking(metric: str = "on_time_rate", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Vendor Ranking: compare vendors using the measurable metrics."""
    vendors = db.query(Vendor).filter(Vendor.is_active == True).all()  # noqa: E712
    results = []
    for v in vendors:
        m = performance_service.get_vendor_metrics(db, v.id)
        results.append({"vendor_id": v.id, "company_name": v.company_name, "category": v.category.value, **m})
    valid_metrics = {
        "on_time_rate", "quality_rating", "order_completion_rate", "avg_response_time_hours", "avg_issue_resolution_hours"
    }
    key = metric if metric in valid_metrics else "on_time_rate"
    reverse = key not in {"avg_response_time_hours", "avg_issue_resolution_hours"}
    results.sort(key=lambda r: (r[key] is None, r[key] or 0), reverse=reverse)
    return results
