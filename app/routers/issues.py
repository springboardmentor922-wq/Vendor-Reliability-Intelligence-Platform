from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.audit import log_action
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.models.issue import Issue, IssueStatus
from app.schemas.issue import IssueCreate, IssueOut

router = APIRouter(prefix="/issues", tags=["Issues"])

MANAGE_ROLES = (UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER, UserRole.SUPPLY_CHAIN_MANAGER)


@router.post("/", response_model=IssueOut, status_code=status.HTTP_201_CREATED)
def create_issue(
    payload: IssueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    issue = Issue(**payload.model_dump())
    db.add(issue)
    db.commit()
    db.refresh(issue)

    log_action(db, current_user.id, f"Raised issue '{issue.title}' for vendor {vendor.company_name}", "issue", issue.id)

    return issue


@router.get("/", response_model=List[IssueOut])
def list_issues(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Issue).all()


@router.get("/vendor/{vendor_id}", response_model=List[IssueOut])
def get_vendor_issues(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Issue).filter(Issue.vendor_id == vendor_id).all()


@router.put("/{issue_id}/resolve", response_model=IssueOut)
def resolve_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue.status = IssueStatus.RESOLVED
    issue.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(issue)

    log_action(db, current_user.id, f"Resolved issue '{issue.title}'", "issue", issue.id)

    return issue