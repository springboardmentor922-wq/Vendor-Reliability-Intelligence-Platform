from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import (
    get_current_user,
    get_current_vendor,
    require_procurement_team,
    require_operations_read,
)
from app.core.utils import log_activity
from app.db.session_dep import get_db
from app.models.user import User
from app.models.performance import (
    QualityEvaluation,
    Issue,
    IssueStatus,
    PerformanceSnapshot,
)
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


# ============================================================
# QUALITY EVALUATIONS
# ============================================================

@router.post(
    "/quality-evaluations",
    response_model=QualityEvaluationOut,
    status_code=201,
)
def create_quality_evaluation(
    payload: QualityEvaluationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_team),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == payload.vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    evaluation = QualityEvaluation(
        evaluated_by_id=current_user.id,
        **payload.model_dump(),
    )

    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)

    log_activity(
        db,
        current_user.id,
        "quality_evaluation_recorded",
        "vendor",
        vendor.id,
        f"Rating {payload.rating}/5",
    )

    return evaluation


@router.get(
    "/quality-evaluations",
    response_model=List[QualityEvaluationOut],
)
def list_quality_evaluations(
    vendor_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operations_read),
):
    query = db.query(QualityEvaluation)

    if vendor_id:
        query = query.filter(
            QualityEvaluation.vendor_id == vendor_id
        )

    return (
        query
        .order_by(QualityEvaluation.created_at.desc())
        .all()
    )


# ============================================================
# ISSUES
# ============================================================

@router.post(
    "/issues",
    response_model=IssueOut,
    status_code=201,
)
def raise_issue(
    payload: IssueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == payload.vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    # Vendor users can only raise issues for themselves
    if current_user.role.value == "vendor":

        if vendor.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only raise issues for your own vendor account",
            )

    issue = Issue(
        raised_by_id=current_user.id,
        **payload.model_dump(),
    )

    db.add(issue)
    db.commit()
    db.refresh(issue)

    log_activity(
        db,
        current_user.id,
        "issue_raised",
        "vendor",
        vendor.id,
        payload.title,
    )

    return issue


@router.get(
    "/issues",
    response_model=List[IssueOut],
)
def list_issues(
    vendor_id: Optional[UUID] = None,
    status_filter: Optional[IssueStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Issue)

    # Vendor can only see their own issues
    if current_user.role.value == "vendor":

        vendor = (
            db.query(Vendor)
            .filter(Vendor.user_id == current_user.id)
            .first()
        )

        if not vendor:
            raise HTTPException(
                status_code=403,
                detail="No vendor profile is associated with this account",
            )

        query = query.filter(
            Issue.vendor_id == vendor.id
        )

    elif vendor_id:

        query = query.filter(
            Issue.vendor_id == vendor_id
        )

    if status_filter:

        query = query.filter(
            Issue.status == status_filter
        )

    return (
        query
        .order_by(Issue.raised_at.desc())
        .all()
    )


@router.put(
    "/issues/{issue_id}/resolve",
    response_model=IssueOut,
)
def resolve_issue(
    issue_id: int,
    payload: IssueResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_team),
):
    from datetime import datetime

    issue = (
        db.query(Issue)
        .filter(Issue.id == issue_id)
        .first()
    )

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    issue.status = IssueStatus.RESOLVED
    issue.resolved_at = datetime.utcnow()
    issue.resolution_notes = payload.resolution_notes

    db.commit()
    db.refresh(issue)

    log_activity(
        db,
        current_user.id,
        "issue_resolved",
        "vendor",
        issue.vendor_id,
        f"Issue #{issue.id} resolved",
    )

    return issue


# ============================================================
# VENDOR METRICS
# ============================================================

@router.get(
    "/vendors/{vendor_id}/metrics",
    response_model=VendorMetrics,
)
def vendor_metrics(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Live vendor performance metrics."""

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

    # Vendor can only view their own metrics
    if current_user.role.value == "vendor":

        if vendor.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only access your own vendor metrics",
            )

    return performance_service.get_vendor_metrics(
        db,
        vendor_id,
    )


# ============================================================
# PERFORMANCE SNAPSHOT
# ============================================================

@router.post(
    "/vendors/{vendor_id}/snapshot",
    response_model=PerformanceSnapshotOut,
    status_code=201,
)
def create_snapshot(
    vendor_id: UUID,
    period: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_team),
):
    """Persist current vendor metrics as a performance snapshot."""

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

    return performance_service.create_snapshot(
        db,
        vendor_id,
        period,
    )


@router.get(
    "/vendors/{vendor_id}/history",
    response_model=List[PerformanceSnapshotOut],
)
def performance_history(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Vendor performance history."""

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

    if current_user.role.value == "vendor":

        if vendor.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only access your own performance history",
            )

    return (
        db.query(PerformanceSnapshot)
        .filter(
            PerformanceSnapshot.vendor_id == vendor_id
        )
        .order_by(
            PerformanceSnapshot.period.asc()
        )
        .all()
    )


# ============================================================
# VENDOR RANKING
# ============================================================

@router.get("/ranking")
def vendor_ranking(
    metric: str = "on_time_rate",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operations_read),
):
    """Vendor ranking for authorized internal users."""

    vendors = (
        db.query(Vendor)
        .filter(Vendor.is_active.is_(True))
        .all()
    )

    results = []

    for vendor in vendors:

        metrics = performance_service.get_vendor_metrics(
            db,
            vendor.id,
        )

        results.append(
            {
                "vendor_id": vendor.id,
                "company_name": vendor.company_name,
                "category": vendor.category.value,
                **metrics,
            }
        )

    valid_metrics = {
        "on_time_rate",
        "quality_rating",
        "order_completion_rate",
        "avg_response_time_hours",
        "avg_issue_resolution_hours",
    }

    key = (
        metric
        if metric in valid_metrics
        else "on_time_rate"
    )

    reverse = key not in {
        "avg_response_time_hours",
        "avg_issue_resolution_hours",
    }

    results.sort(
        key=lambda result: (
            result.get(key) is None,
            result.get(key) or 0,
        ),
        reverse=reverse,
    )

    return results