"""Procurement requests: creation, approval workflow and vendor assignment."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from deps import (
    get_current_user,
    require_procurement,
    require_procurement_or_supply_chain,
    vendor_scope
)
from models import (
    NotificationType,
    ProcurementApproval,
    ProcurementRequest,
    ProcurementStatus,
    PurchaseOrder,
    User,
    UserRole,
    Vendor,
    VendorStatus
)
from schemas.common import Message
from schemas.procurement import (
    PRIORITIES,
    ProcurementApprovalResponse,
    ProcurementDecision,
    ProcurementRequestCreate,
    ProcurementRequestDetail,
    ProcurementRequestResponse,
    ProcurementRequestUpdate,
    ProcurementStatsResponse,
    VendorAssignment
)
from services.events import log_activity, notify_roles, notify_user
from services.numbering import next_request_number

router = APIRouter(
    prefix="/procurement-requests",
    tags=["Procurement Requests"]
)


# =========================================================
# HELPERS
# =========================================================

def _get_request(db: Session, request_id: int) -> ProcurementRequest:
    request = (
        db.query(ProcurementRequest)
        .filter(ProcurementRequest.id == request_id)
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Procurement request not found"
        )

    return request


def _to_response(request: ProcurementRequest) -> ProcurementRequestResponse:
    payload = ProcurementRequestResponse.model_validate(request)
    payload.requester_name = request.requester.name if request.requester else None
    payload.approver_name = request.approver.name if request.approver else None
    payload.assigned_vendor_name = (
        request.assigned_vendor.vendor_name if request.assigned_vendor else None
    )
    return payload


def _record_action(
    db: Session,
    request: ProcurementRequest,
    action: str,
    previous_status: str,
    user: User,
    comments: Optional[str]
) -> None:
    db.add(
        ProcurementApproval(
            request_id=request.id,
            action=action,
            previous_status=previous_status,
            new_status=request.status,
            performed_by=user.id,
            comments=comments
        )
    )


def _approval_history(
    request: ProcurementRequest
) -> list[ProcurementApprovalResponse]:
    return [
        ProcurementApprovalResponse(
            id=entry.id,
            request_id=entry.request_id,
            action=entry.action,
            previous_status=entry.previous_status,
            new_status=entry.new_status,
            performed_by=entry.performed_by,
            performed_by_name=entry.performer.name if entry.performer else None,
            comments=entry.comments,
            created_at=entry.created_at
        )
        for entry in request.approvals
    ]


# =========================================================
# REFERENCE DATA & STATS
# =========================================================

@router.get("/meta/statuses", response_model=list[str])
def list_statuses(current_user: User = Depends(get_current_user)):
    return ProcurementStatus.ALL


@router.get("/meta/priorities", response_model=list[str])
def list_priorities(current_user: User = Depends(get_current_user)):
    return PRIORITIES


@router.get("/stats/summary", response_model=ProcurementStatsResponse)
def procurement_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    base = db.query(ProcurementRequest)

    scope = vendor_scope(current_user)
    if scope is not None:
        base = base.filter(ProcurementRequest.assigned_vendor_id == scope)

    rows = base.with_entities(
        ProcurementRequest.status,
        func.count(ProcurementRequest.id)
    ).group_by(ProcurementRequest.status).all()

    counts = dict(rows)

    by_priority = dict(
        base.with_entities(
            ProcurementRequest.priority,
            func.count(ProcurementRequest.id)
        ).group_by(ProcurementRequest.priority).all()
    )

    total_value = (
        base.with_entities(
            func.coalesce(func.sum(ProcurementRequest.estimated_cost), 0)
        ).scalar()
    ) or Decimal("0")

    return ProcurementStatsResponse(
        total=sum(counts.values()),
        pending=counts.get(ProcurementStatus.PENDING, 0),
        approved=counts.get(ProcurementStatus.APPROVED, 0),
        rejected=counts.get(ProcurementStatus.REJECTED, 0),
        ordered=counts.get(ProcurementStatus.ORDERED, 0),
        delivered=counts.get(ProcurementStatus.DELIVERED, 0),
        completed=counts.get(ProcurementStatus.COMPLETED, 0),
        cancelled=counts.get(ProcurementStatus.CANCELLED, 0),
        total_estimated_value=Decimal(total_value),
        by_priority={p: n for p, n in by_priority.items()}
    )


# =========================================================
# LIST
# =========================================================

@router.get("", response_model=list[ProcurementRequestResponse])
@router.get(
    "/",
    response_model=list[ProcurementRequestResponse],
    include_in_schema=False
)
def list_requests(
    search: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    priority: Optional[str] = Query(default=None),
    vendor_id: Optional[int] = Query(default=None),
    mine: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ProcurementRequest)

    scope = vendor_scope(current_user)
    if scope is not None:
        query = query.filter(ProcurementRequest.assigned_vendor_id == scope)

    if mine:
        query = query.filter(ProcurementRequest.requested_by == current_user.id)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                ProcurementRequest.request_number.ilike(pattern),
                ProcurementRequest.item.ilike(pattern),
                ProcurementRequest.description.ilike(pattern),
                ProcurementRequest.department.ilike(pattern)
            )
        )

    if status_filter:
        query = query.filter(ProcurementRequest.status == status_filter)

    if priority:
        query = query.filter(ProcurementRequest.priority == priority)

    if vendor_id:
        query = query.filter(ProcurementRequest.assigned_vendor_id == vendor_id)

    return [
        _to_response(r)
        for r in query.order_by(ProcurementRequest.id.desc()).all()
    ]


@router.get("/pending-approvals", response_model=list[ProcurementRequestResponse])
def pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    requests = (
        db.query(ProcurementRequest)
        .filter(ProcurementRequest.status == ProcurementStatus.PENDING)
        .order_by(ProcurementRequest.created_at.asc())
        .all()
    )

    return [_to_response(r) for r in requests]


# =========================================================
# DETAIL
# =========================================================

@router.get("/{request_id}", response_model=ProcurementRequestDetail)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    request = _get_request(db, request_id)

    scope = vendor_scope(current_user)
    if scope is not None and request.assigned_vendor_id != scope:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access records assigned to your organisation"
        )

    payload = ProcurementRequestDetail.model_validate(request)
    payload.requester_name = request.requester.name if request.requester else None
    payload.approver_name = request.approver.name if request.approver else None
    payload.assigned_vendor_name = (
        request.assigned_vendor.vendor_name if request.assigned_vendor else None
    )
    payload.approvals = _approval_history(request)
    payload.purchase_order_ids = [
        po_id for (po_id,) in db.query(PurchaseOrder.id)
        .filter(PurchaseOrder.procurement_request_id == request.id)
        .all()
    ]

    return payload


# =========================================================
# CREATE
# =========================================================

@router.post(
    "",
    response_model=ProcurementRequestDetail,
    status_code=status.HTTP_201_CREATED
)
@router.post(
    "/",
    response_model=ProcurementRequestDetail,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False
)
def create_request(
    payload: ProcurementRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    request_number = payload.request_number or next_request_number(db)

    exists = (
        db.query(ProcurementRequest)
        .filter(ProcurementRequest.request_number == request_number)
        .first()
    )

    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request number '{request_number}' is already in use"
        )

    if payload.assigned_vendor_id:
        _assert_vendor_approved(db, payload.assigned_vendor_id)

    data = payload.model_dump(exclude={"request_number"})

    request = ProcurementRequest(
        **data,
        request_number=request_number,
        requested_by=current_user.id,
        status=ProcurementStatus.PENDING
    )

    db.add(request)
    db.flush()

    _record_action(
        db, request, "Submitted", None, current_user,
        "Procurement request submitted for approval"
    )

    log_activity(
        db, current_user.id, "ProcurementRequest", request.id, "Created",
        f"Request {request.request_number} for '{request.item}' created"
    )

    notify_roles(
        db,
        [UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER],
        NotificationType.PROCUREMENT,
        "New procurement request",
        f"{request.request_number} - {request.item} "
        f"({request.currency} {request.estimated_cost}) awaits approval.",
        link=f"/procurement/{request.id}",
        priority="High" if request.priority in ("High", "Urgent") else "Medium",
        exclude_user_id=current_user.id
    )

    db.commit()
    db.refresh(request)

    return get_request(request.id, db, current_user)


def _assert_vendor_approved(db: Session, vendor_id: int) -> Vendor:
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )

    if vendor.status != VendorStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Vendor '{vendor.vendor_name}' is {vendor.status} and cannot "
                f"be assigned work. Only approved vendors can be assigned."
            )
        )

    return vendor


# =========================================================
# UPDATE
# =========================================================

@router.put("/{request_id}", response_model=ProcurementRequestResponse)
def update_request(
    request_id: int,
    payload: ProcurementRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    request = _get_request(db, request_id)

    if request.status not in (ProcurementStatus.PENDING, ProcurementStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"A request in status '{request.status}' can no longer be "
                f"edited. Only Pending or Rejected requests are editable."
            )
        )

    if (
        request.requested_by != current_user.id
        and current_user.role not in (
            UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit requests you raised"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(request, field, value)

    log_activity(
        db, current_user.id, "ProcurementRequest", request.id, "Updated",
        f"Request {request.request_number} updated"
    )

    db.commit()
    db.refresh(request)

    return _to_response(request)


# =========================================================
# APPROVAL WORKFLOW
# =========================================================

@router.post("/{request_id}/approve", response_model=ProcurementRequestResponse)
def approve_request(
    request_id: int,
    payload: ProcurementDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement)
):
    request = _get_request(db, request_id)

    if request.status != ProcurementStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only Pending requests can be approved (currently {request.status})"
        )

    request.status = ProcurementStatus.APPROVED
    request.approved_by = current_user.id
    request.approved_at = datetime.now(timezone.utc)
    request.rejection_reason = None

    _record_action(
        db, request, "Approved", ProcurementStatus.PENDING,
        current_user, payload.comments
    )

    log_activity(
        db, current_user.id, "ProcurementRequest", request.id, "Approved",
        f"Request {request.request_number} approved"
    )

    notify_user(
        db, request.requested_by, NotificationType.PROCUREMENT,
        "Procurement request approved",
        f"{request.request_number} ({request.item}) was approved by "
        f"{current_user.name}. A purchase order can now be raised.",
        link=f"/procurement/{request.id}",
        priority="High"
    )

    db.commit()
    db.refresh(request)

    return _to_response(request)


@router.post("/{request_id}/reject", response_model=ProcurementRequestResponse)
def reject_request(
    request_id: int,
    payload: ProcurementDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement)
):
    if not payload.reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A rejection reason is required"
        )

    request = _get_request(db, request_id)

    if request.status != ProcurementStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only Pending requests can be rejected (currently {request.status})"
        )

    request.status = ProcurementStatus.REJECTED
    request.rejection_reason = payload.reason

    _record_action(
        db, request, "Rejected", ProcurementStatus.PENDING,
        current_user, payload.comments or payload.reason
    )

    log_activity(
        db, current_user.id, "ProcurementRequest", request.id, "Rejected",
        f"Request {request.request_number} rejected: {payload.reason}"
    )

    notify_user(
        db, request.requested_by, NotificationType.PROCUREMENT,
        "Procurement request rejected",
        f"{request.request_number} ({request.item}) was rejected. "
        f"Reason: {payload.reason}",
        link=f"/procurement/{request.id}",
        priority="High"
    )

    db.commit()
    db.refresh(request)

    return _to_response(request)


@router.post(
    "/{request_id}/assign-vendor",
    response_model=ProcurementRequestResponse
)
def assign_vendor(
    request_id: int,
    payload: VendorAssignment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    """Attach an approved vendor to a request before the PO is raised."""

    request = _get_request(db, request_id)

    if request.status in (
        ProcurementStatus.CANCELLED,
        ProcurementStatus.COMPLETED,
        ProcurementStatus.REJECTED
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign a vendor to a {request.status} request"
        )

    vendor = _assert_vendor_approved(db, payload.vendor_id)

    request.assigned_vendor_id = vendor.id

    _record_action(
        db, request, "Vendor Assigned", request.status, current_user,
        payload.comments or f"Assigned to {vendor.vendor_name}"
    )

    log_activity(
        db, current_user.id, "ProcurementRequest", request.id, "Vendor Assigned",
        f"Request {request.request_number} assigned to {vendor.vendor_name}"
    )

    db.commit()
    db.refresh(request)

    return _to_response(request)


@router.post("/{request_id}/cancel", response_model=ProcurementRequestResponse)
def cancel_request(
    request_id: int,
    payload: ProcurementDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    request = _get_request(db, request_id)

    if request.status == ProcurementStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A completed request cannot be cancelled"
        )

    previous = request.status
    request.status = ProcurementStatus.CANCELLED

    _record_action(
        db, request, "Cancelled", previous, current_user,
        payload.comments or payload.reason
    )

    log_activity(
        db, current_user.id, "ProcurementRequest", request.id, "Cancelled",
        f"Request {request.request_number} cancelled"
    )

    db.commit()
    db.refresh(request)

    return _to_response(request)


@router.get(
    "/{request_id}/approvals",
    response_model=list[ProcurementApprovalResponse]
)
def request_history(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return _approval_history(_get_request(db, request_id))


# =========================================================
# DELETE
# =========================================================

@router.delete("/{request_id}", response_model=Message)
def delete_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement)
):
    request = _get_request(db, request_id)

    linked_pos = (
        db.query(func.count(PurchaseOrder.id))
        .filter(PurchaseOrder.procurement_request_id == request_id)
        .scalar()
    ) or 0

    if linked_pos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"This request has {linked_pos} linked purchase order(s). "
                f"Cancel it instead of deleting."
            )
        )

    number = request.request_number

    log_activity(
        db, current_user.id, "ProcurementRequest", request_id, "Deleted",
        f"Request {number} deleted"
    )

    db.delete(request)
    db.commit()

    return Message(message=f"Procurement request {number} deleted successfully")
