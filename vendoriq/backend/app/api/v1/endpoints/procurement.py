from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_approvers
from app.core.utils import generate_code, log_activity, notify_user
from app.services.notification_service import notify_event
from app.models.vendor import Vendor, VendorStatus
from app.services import reliability_service
from app.db.session_dep import get_db
from app.models.user import User, UserRole
from app.models.procurement import ProcurementRequest, ProcurementStatus, ProcurementPriority
from app.schemas.procurement import (
    ProcurementRequestCreate,
    ProcurementRequestUpdate,
    ProcurementRequestOut,
    ProcurementApproval,
)

router = APIRouter()


@router.post("", response_model=ProcurementRequestOut, status_code=201)
def create_request(
    payload: ProcurementRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    request = ProcurementRequest(
        request_number=generate_code("REQ"),
        requested_by_id=current_user.id,
        status=ProcurementStatus.PENDING,
        **payload.model_dump(),
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    log_activity(db, current_user.id, "procurement_request_created", "procurement_request", request.id, request.title)
    for approver in db.query(User).filter(User.role.in_([UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER])).all():
        notify_user(
            db, approver.id, "procurement_alert", "New Procurement Request",
            f"{request.title} ({request.request_number}) needs approval.",
            "procurement_request", request.id,
        )
    return request


@router.get("", response_model=List[ProcurementRequestOut])
def list_requests(
    status_filter: Optional[ProcurementStatus] = None,
    priority: Optional[ProcurementPriority] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ProcurementRequest)
    if status_filter:
        query = query.filter(ProcurementRequest.status == status_filter)
    if priority:
        query = query.filter(ProcurementRequest.priority == priority)
    if department:
        query = query.filter(ProcurementRequest.department == department)
    if current_user.role not in (UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER, UserRole.SUPPLY_CHAIN_MANAGER, UserRole.AUDITOR, UserRole.FINANCE_OFFICER):
        query = query.filter(ProcurementRequest.requested_by_id == current_user.id)
    return query.order_by(ProcurementRequest.created_at.desc()).all()


@router.get("/{request_id}", response_model=ProcurementRequestOut)
def get_request(request_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    request = db.query(ProcurementRequest).filter(ProcurementRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Procurement request not found")
    return request


@router.put("/{request_id}", response_model=ProcurementRequestOut)
def update_request(
    request_id: int,
    payload: ProcurementRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = db.query(ProcurementRequest).filter(ProcurementRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Procurement request not found")
    if request.status != ProcurementStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending requests can be edited")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(request, field, value)
    db.commit()
    db.refresh(request)
    return request


@router.put("/{request_id}/approval", response_model=ProcurementRequestOut)
def approve_or_reject_request(
    request_id: int,
    payload: ProcurementApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approvers),
):
    """Procurement Approval Workflow."""
    request = db.query(ProcurementRequest).filter(ProcurementRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Procurement request not found")

    request.status = payload.status
    request.approval_notes = payload.approval_notes
    request.approved_by_id = current_user.id
    db.commit()
    db.refresh(request)

    log_activity(
        db, current_user.id, "procurement_request_reviewed", "procurement_request", request.id,
        f"Request {request.request_number} set to {payload.status.value}",
    )
    requester = (
        db.query(User)
        .filter(User.id == request.requested_by_id)
        .first()
    )

    if requester:
        notify_event(
            db,
            requester,
            "procurement_approval",
            f"Your request '{request.title}' was {payload.status.value}",
            payload.approval_notes
            or f"Procurement request status changed to {payload.status.value}.",
            "procurement_request",
            request.id,
        )
    return request


@router.put("/{request_id}/assign-vendor/{vendor_id}", response_model=ProcurementRequestOut)
def assign_vendor(
    request_id: int,
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approvers),
):
    """Assign only an approved/active vendor, guided by reliability data."""

    request = (
        db.query(ProcurementRequest)
        .filter(ProcurementRequest.id == request_id)
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found",
        )

    if request.status not in (
        ProcurementStatus.APPROVED,
        ProcurementStatus.ORDERED,
    ):
        raise HTTPException(
            status_code=400,
            detail="Only approved or ordered requests can have a vendor assigned",
        )

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

    if (
        vendor.status not in
        (VendorStatus.APPROVED, VendorStatus.ACTIVE)
        or not vendor.is_active
    ):
        raise HTTPException(
            status_code=400,
            detail="Only approved and active vendors can be assigned",
        )

    latest = reliability_service.get_latest_score(db, vendor.id)

    request.assigned_vendor_id = vendor.id

    db.commit()
    db.refresh(request)

    recommendation = (
        latest.recommendation
        if latest
        else "No reliability score calculated yet. Review vendor before assignment."
    )

    log_activity(
        db,
        current_user.id,
        "vendor_assigned",
        "procurement_request",
        request.id,
        f"Assigned {vendor.company_name}; "
        f"reliability={latest.score if latest else 'N/A'}; "
        f"risk={latest.risk_level.value if latest else 'N/A'}; "
        f"recommendation={recommendation}",
    )

    requester = (
        db.query(User)
        .filter(User.id == request.requested_by_id)
        .first()
    )

    if requester and requester.id != current_user.id:
        notify_event(
            db,
            requester,
            "vendor_assignment",
            f"Vendor assigned to {request.request_number}",
            f"{vendor.company_name} was assigned. "
            f"Reliability: {latest.score if latest else 'N/A'}; "
            f"risk: {latest.risk_level.value if latest else 'N/A'}. "
            f"{recommendation}",
            "procurement_request",
            request.id,
        )

    return request
