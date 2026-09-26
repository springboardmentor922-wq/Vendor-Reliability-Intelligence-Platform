"""Vendor management: registration, profiles, categorisation, approval workflow."""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from deps import (
    assert_vendor_access,
    get_current_user,
    require_admin,
    require_procurement,
    require_procurement_or_supply_chain,
    vendor_scope
)
from models import (
    Contract,
    ContractStatus,
    NotificationType,
    PurchaseOrder,
    PurchaseOrderStatus,
    User,
    UserRole,
    Vendor,
    VendorApproval,
    VendorCategory,
    VendorContact,
    VendorStatus
)
from schemas.common import Message
from schemas.vendor import (
    VendorApprovalAction,
    VendorApprovalResponse,
    VendorContactCreate,
    VendorContactResponse,
    VendorCreate,
    VendorDetailResponse,
    VendorDirectoryEntry,
    VendorResponse,
    VendorStatsResponse,
    VendorUpdate
)
from services.events import (
    log_activity,
    notify_roles,
    notify_user,
    notify_vendor_users
)
from services.numbering import next_vendor_code

router = APIRouter(prefix="/vendors", tags=["Vendors"])


# =========================================================
# HELPERS
# =========================================================

def _get_vendor(db: Session, vendor_id: int) -> Vendor:
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )

    return vendor


def _record_approval(
    db: Session,
    vendor: Vendor,
    action: str,
    previous_status: str,
    user: User,
    comments: Optional[str]
) -> VendorApproval:
    entry = VendorApproval(
        vendor_id=vendor.id,
        action=action,
        previous_status=previous_status,
        new_status=vendor.status,
        performed_by=user.id,
        comments=comments
    )

    db.add(entry)

    return entry


def _approval_history(vendor: Vendor) -> list[VendorApprovalResponse]:
    return [
        VendorApprovalResponse(
            id=entry.id,
            vendor_id=entry.vendor_id,
            action=entry.action,
            previous_status=entry.previous_status,
            new_status=entry.new_status,
            performed_by=entry.performed_by,
            performed_by_name=entry.performer.name if entry.performer else None,
            comments=entry.comments,
            created_at=entry.created_at
        )
        for entry in vendor.approvals
    ]


# =========================================================
# REFERENCE DATA
# =========================================================

@router.get("/meta/categories", response_model=list[str])
def list_categories(current_user: User = Depends(get_current_user)):
    return VendorCategory.ALL


@router.get("/meta/statuses", response_model=list[str])
def list_statuses(current_user: User = Depends(get_current_user)):
    return VendorStatus.ALL


@router.get("/public-directory", response_model=list[VendorDirectoryEntry])
def public_directory(db: Session = Depends(get_db)):
    """Minimal, unauthenticated vendor list.

    Registration needs it so a supplier can pick the organisation their
    login belongs to. It exposes nothing beyond the id, code and trading
    name of vendors that are already approved.
    """

    rows = (
        db.query(Vendor.id, Vendor.vendor_code, Vendor.vendor_name)
        .filter(Vendor.status == VendorStatus.APPROVED)
        .order_by(Vendor.vendor_name.asc())
        .all()
    )

    return [
        VendorDirectoryEntry(
            id=row.id,
            vendor_code=row.vendor_code,
            vendor_name=row.vendor_name
        )
        for row in rows
    ]


# =========================================================
# STATISTICS
# =========================================================

@router.get("/stats/summary", response_model=VendorStatsResponse)
def vendor_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Vendor)

    scope = vendor_scope(current_user)
    if scope is not None:
        query = query.filter(Vendor.id == scope)

    counts = dict(
        db.query(Vendor.status, func.count(Vendor.id))
        .group_by(Vendor.status)
        .all()
    )

    by_category = dict(
        db.query(Vendor.category, func.count(Vendor.id))
        .group_by(Vendor.category)
        .all()
    )

    by_risk = dict(
        db.query(Vendor.risk_level, func.count(Vendor.id))
        .group_by(Vendor.risk_level)
        .all()
    )

    return VendorStatsResponse(
        total=query.count(),
        approved=counts.get(VendorStatus.APPROVED, 0),
        pending=counts.get(VendorStatus.PENDING, 0),
        rejected=counts.get(VendorStatus.REJECTED, 0),
        suspended=counts.get(VendorStatus.SUSPENDED, 0),
        inactive=counts.get(VendorStatus.INACTIVE, 0),
        by_category={c: n for c, n in by_category.items()},
        by_risk_level={r: n for r, n in by_risk.items()}
    )


# =========================================================
# LIST VENDORS
# =========================================================

@router.get("", response_model=list[VendorResponse])
@router.get("/", response_model=list[VendorResponse], include_in_schema=False)
def list_vendors(
    search: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    category: Optional[str] = Query(default=None),
    risk_level: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Vendor)

    scope = vendor_scope(current_user)
    if scope is not None:
        query = query.filter(Vendor.id == scope)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Vendor.vendor_name.ilike(pattern),
                Vendor.vendor_code.ilike(pattern),
                Vendor.email.ilike(pattern),
                Vendor.contact_person.ilike(pattern),
                Vendor.city.ilike(pattern),
                Vendor.country.ilike(pattern)
            )
        )

    if status_filter:
        query = query.filter(Vendor.status == status_filter)

    if category:
        query = query.filter(Vendor.category == category)

    if risk_level:
        query = query.filter(Vendor.risk_level == risk_level)

    return query.order_by(Vendor.id.desc()).all()


# =========================================================
# PENDING APPROVAL QUEUE
# =========================================================

@router.get("/pending-approvals", response_model=list[VendorResponse])
def pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    return (
        db.query(Vendor)
        .filter(Vendor.status == VendorStatus.PENDING)
        .order_by(Vendor.created_at.asc())
        .all()
    )


# =========================================================
# GET SINGLE VENDOR
# =========================================================

@router.get("/{vendor_id}", response_model=VendorDetailResponse)
def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assert_vendor_access(current_user, vendor_id)

    vendor = _get_vendor(db, vendor_id)

    open_pos = (
        db.query(func.count(PurchaseOrder.id))
        .filter(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status.notin_([
                PurchaseOrderStatus.COMPLETED,
                PurchaseOrderStatus.CANCELLED
            ])
        )
        .scalar()
    ) or 0

    total_pos = (
        db.query(func.count(PurchaseOrder.id))
        .filter(PurchaseOrder.vendor_id == vendor_id)
        .scalar()
    ) or 0

    active_contracts = (
        db.query(func.count(Contract.id))
        .filter(
            Contract.vendor_id == vendor_id,
            Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.EXPIRING])
        )
        .scalar()
    ) or 0

    total_spend = (
        db.query(func.coalesce(func.sum(PurchaseOrder.total_amount), 0))
        .filter(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status != PurchaseOrderStatus.CANCELLED
        )
        .scalar()
    ) or Decimal("0")

    payload = VendorDetailResponse.model_validate(vendor)
    payload.contacts = [
        VendorContactResponse.model_validate(c) for c in vendor.contacts
    ]
    payload.approvals = _approval_history(vendor)
    payload.open_purchase_orders = open_pos
    payload.total_purchase_orders = total_pos
    payload.active_contracts = active_contracts
    payload.total_spend = Decimal(total_spend)

    return payload


# =========================================================
# REGISTER VENDOR
# =========================================================

@router.post(
    "",
    response_model=VendorDetailResponse,
    status_code=status.HTTP_201_CREATED
)
@router.post(
    "/",
    response_model=VendorDetailResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False
)
def create_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    """Register a vendor. New vendors always start in the Pending queue."""

    vendor_code = payload.vendor_code or next_vendor_code(db)

    if db.query(Vendor).filter(Vendor.vendor_code == vendor_code).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vendor code '{vendor_code}' is already in use"
        )

    data = payload.model_dump(exclude={"contacts", "vendor_code"})

    vendor = Vendor(
        **data,
        vendor_code=vendor_code,
        status=VendorStatus.PENDING,
        created_by=current_user.id
    )

    db.add(vendor)
    db.flush()

    for contact in payload.contacts:
        db.add(VendorContact(vendor_id=vendor.id, **contact.model_dump()))

    _record_approval(
        db, vendor, "Submitted", None, current_user,
        "Vendor registration submitted for approval"
    )

    log_activity(
        db, current_user.id, "Vendor", vendor.id, "Registered",
        f"Vendor '{vendor.vendor_name}' ({vendor.vendor_code}) registered"
    )

    notify_roles(
        db,
        [UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER],
        NotificationType.VENDOR_APPROVAL,
        "New vendor awaiting approval",
        f"{vendor.vendor_name} ({vendor.vendor_code}) has been registered "
        f"and is waiting for approval.",
        link=f"/vendors/{vendor.id}",
        priority="High",
        exclude_user_id=current_user.id
    )

    db.commit()
    db.refresh(vendor)

    return get_vendor(vendor.id, db, current_user)


# =========================================================
# UPDATE VENDOR
# =========================================================

@router.put("/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: int,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    vendor = _get_vendor(db, vendor_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vendor, field, value)

    log_activity(
        db, current_user.id, "Vendor", vendor.id, "Updated",
        f"Vendor '{vendor.vendor_name}' profile updated"
    )

    db.commit()
    db.refresh(vendor)

    return vendor


# =========================================================
# APPROVAL WORKFLOW
# =========================================================

@router.post("/{vendor_id}/approve", response_model=VendorResponse)
def approve_vendor(
    vendor_id: int,
    payload: VendorApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement)
):
    vendor = _get_vendor(db, vendor_id)

    if vendor.status == VendorStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vendor is already approved"
        )

    previous = vendor.status

    vendor.status = VendorStatus.APPROVED
    vendor.approved_by = current_user.id
    vendor.approved_at = datetime.now(timezone.utc)
    vendor.rejection_reason = None
    vendor.onboarded_on = vendor.onboarded_on or date.today()

    _record_approval(
        db, vendor, "Approved", previous, current_user, payload.comments
    )

    log_activity(
        db, current_user.id, "Vendor", vendor.id, "Approved",
        f"Vendor '{vendor.vendor_name}' approved"
    )

    notify_vendor_users(
        db, vendor.id, NotificationType.VENDOR_APPROVAL,
        "Vendor registration approved",
        f"Your registration ({vendor.vendor_code}) has been approved. "
        f"You can now receive purchase orders.",
        link=f"/vendors/{vendor.id}",
        priority="High"
    )

    if vendor.created_by and vendor.created_by != current_user.id:
        notify_user(
            db, vendor.created_by, NotificationType.VENDOR_APPROVAL,
            "Vendor approved",
            f"{vendor.vendor_name} ({vendor.vendor_code}) that you registered "
            f"has been approved by {current_user.name}.",
            link=f"/vendors/{vendor.id}"
        )

    db.commit()
    db.refresh(vendor)

    return vendor


@router.post("/{vendor_id}/reject", response_model=VendorResponse)
def reject_vendor(
    vendor_id: int,
    payload: VendorApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement)
):
    if not payload.reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A rejection reason is required"
        )

    vendor = _get_vendor(db, vendor_id)
    previous = vendor.status

    vendor.status = VendorStatus.REJECTED
    vendor.rejection_reason = payload.reason
    vendor.approved_by = None
    vendor.approved_at = None

    _record_approval(
        db, vendor, "Rejected", previous, current_user,
        payload.comments or payload.reason
    )

    log_activity(
        db, current_user.id, "Vendor", vendor.id, "Rejected",
        f"Vendor '{vendor.vendor_name}' rejected: {payload.reason}"
    )

    notify_vendor_users(
        db, vendor.id, NotificationType.VENDOR_APPROVAL,
        "Vendor registration rejected",
        f"Your registration ({vendor.vendor_code}) was rejected. "
        f"Reason: {payload.reason}",
        link=f"/vendors/{vendor.id}",
        priority="High"
    )

    db.commit()
    db.refresh(vendor)

    return vendor


@router.post("/{vendor_id}/suspend", response_model=VendorResponse)
def suspend_vendor(
    vendor_id: int,
    payload: VendorApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement)
):
    vendor = _get_vendor(db, vendor_id)
    previous = vendor.status

    vendor.status = VendorStatus.SUSPENDED

    _record_approval(
        db, vendor, "Suspended", previous, current_user,
        payload.comments or payload.reason
    )

    log_activity(
        db, current_user.id, "Vendor", vendor.id, "Suspended",
        f"Vendor '{vendor.vendor_name}' suspended"
    )

    notify_vendor_users(
        db, vendor.id, NotificationType.VENDOR_APPROVAL,
        "Vendor account suspended",
        f"Your account ({vendor.vendor_code}) has been suspended. "
        f"Please contact the procurement team.",
        link=f"/vendors/{vendor.id}",
        priority="High"
    )

    db.commit()
    db.refresh(vendor)

    return vendor


@router.post("/{vendor_id}/reactivate", response_model=VendorResponse)
def reactivate_vendor(
    vendor_id: int,
    payload: VendorApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement)
):
    vendor = _get_vendor(db, vendor_id)
    previous = vendor.status

    vendor.status = VendorStatus.APPROVED
    vendor.approved_by = current_user.id
    vendor.approved_at = datetime.now(timezone.utc)

    _record_approval(
        db, vendor, "Reactivated", previous, current_user, payload.comments
    )

    log_activity(
        db, current_user.id, "Vendor", vendor.id, "Reactivated",
        f"Vendor '{vendor.vendor_name}' reactivated"
    )

    db.commit()
    db.refresh(vendor)

    return vendor


@router.get(
    "/{vendor_id}/approvals",
    response_model=list[VendorApprovalResponse]
)
def vendor_approval_history(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assert_vendor_access(current_user, vendor_id)

    return _approval_history(_get_vendor(db, vendor_id))


# =========================================================
# CONTACTS
# =========================================================

@router.get(
    "/{vendor_id}/contacts",
    response_model=list[VendorContactResponse]
)
def list_contacts(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assert_vendor_access(current_user, vendor_id)

    return _get_vendor(db, vendor_id).contacts


@router.post(
    "/{vendor_id}/contacts",
    response_model=VendorContactResponse,
    status_code=status.HTTP_201_CREATED
)
def add_contact(
    vendor_id: int,
    payload: VendorContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    vendor = _get_vendor(db, vendor_id)

    if payload.is_primary:
        for contact in vendor.contacts:
            contact.is_primary = False

    contact = VendorContact(vendor_id=vendor.id, **payload.model_dump())

    db.add(contact)

    log_activity(
        db, current_user.id, "Vendor", vendor.id, "Contact Added",
        f"Contact '{payload.name}' added to {vendor.vendor_name}"
    )

    db.commit()
    db.refresh(contact)

    return contact


@router.delete("/{vendor_id}/contacts/{contact_id}", response_model=Message)
def delete_contact(
    vendor_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    contact = (
        db.query(VendorContact)
        .filter(
            VendorContact.id == contact_id,
            VendorContact.vendor_id == vendor_id
        )
        .first()
    )

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    db.delete(contact)
    db.commit()

    return Message(message="Contact removed successfully")


# =========================================================
# DELETE VENDOR
# =========================================================

@router.delete("/{vendor_id}", response_model=Message)
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Administrators only. Vendors with transaction history are deactivated
    instead of deleted so referential history survives."""

    vendor = _get_vendor(db, vendor_id)

    linked_orders = (
        db.query(func.count(PurchaseOrder.id))
        .filter(PurchaseOrder.vendor_id == vendor_id)
        .scalar()
    ) or 0

    linked_contracts = (
        db.query(func.count(Contract.id))
        .filter(Contract.vendor_id == vendor_id)
        .scalar()
    ) or 0

    if linked_orders or linked_contracts:
        previous = vendor.status
        vendor.status = VendorStatus.INACTIVE

        _record_approval(
            db, vendor, "Deactivated", previous, current_user,
            "Vendor has transaction history and was deactivated instead of deleted"
        )

        log_activity(
            db, current_user.id, "Vendor", vendor.id, "Deactivated",
            f"Vendor '{vendor.vendor_name}' deactivated "
            f"({linked_orders} orders, {linked_contracts} contracts on file)"
        )

        db.commit()

        return Message(
            message=(
                "Vendor has linked purchase orders or contracts and was "
                "marked Inactive instead of being deleted"
            )
        )

    name = vendor.vendor_name

    log_activity(
        db, current_user.id, "Vendor", vendor_id, "Deleted",
        f"Vendor '{name}' deleted"
    )

    db.delete(vendor)
    db.commit()

    return Message(message=f"Vendor '{name}' deleted successfully")
