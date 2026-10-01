from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.deps import (
    get_current_user,
    require_admin,
    require_procurement_team,
)
from app.core.utils import log_activity, notify_user
from app.db.session_dep import get_db
from app.models.user import User, UserRole
from app.models.vendor import (
    Vendor,
    VendorContact,
    VendorStatus,
    VendorCategory,
)
from app.schemas.vendor import (
    VendorCreate,
    VendorUpdate,
    VendorOut,
    VendorApproval,
    VendorContactCreate,
    VendorContactOut,
)

router = APIRouter()


@router.post("", response_model=VendorOut, status_code=201)
def register_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a vendor for onboarding."""

    existing = db.query(Vendor).filter(
        Vendor.email == payload.email
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="A vendor with this email is already registered",
        )

    vendor = Vendor(
        company_name=payload.company_name,
        category=payload.category,
        registration_number=payload.registration_number,
        tax_id=payload.tax_id,
        contact_person=payload.contact_person,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        country=payload.country,
        status=VendorStatus.PENDING,
        user_id=(
            current_user.id
            if current_user.role == UserRole.VENDOR
            else None
        ),
    )

    db.add(vendor)
    db.flush()

    for contact in payload.contacts or []:
        db.add(
            VendorContact(
                vendor_id=vendor.id,
                **contact.model_dump(),
            )
        )

    db.commit()
    db.refresh(vendor)

    log_activity(
        db,
        current_user.id,
        "vendor_registered",
        "vendor",
        vendor.id,
        f"Vendor {vendor.company_name} registered",
    )

    approvers = db.query(User).filter(
        User.role.in_(
            [
                UserRole.ADMIN,
                UserRole.PROCUREMENT_MANAGER,
            ]
        )
    ).all()

    for approver in approvers:
        notify_user(
            db,
            approver.id,
            "vendor_approval",
            "New Vendor Pending Approval",
            f"{vendor.company_name} has registered and is awaiting approval.",
            "vendor",
            vendor.id,
        )

    return vendor


@router.get("", response_model=List[VendorOut])
def list_vendors(
    category: Optional[VendorCategory] = None,
    status_filter: Optional[VendorStatus] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List vendors with filtering and search."""

    query = db.query(Vendor).options(
        joinedload(Vendor.contacts)
    )

    if category:
        query = query.filter(Vendor.category == category)

    if status_filter:
        query = query.filter(Vendor.status == status_filter)

    if search:
        like = f"%{search}%"
        query = query.filter(
            Vendor.company_name.ilike(like)
        )

    if current_user.role == UserRole.VENDOR:
        query = query.filter(
            Vendor.user_id == current_user.id
        )

    return query.order_by(
        Vendor.created_at.desc()
    ).all()


@router.get("/{vendor_id}", response_model=VendorOut)
def get_vendor(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = (
        db.query(Vendor)
        .options(joinedload(Vendor.contacts))
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    return vendor


@router.put("/{vendor_id}", response_model=VendorOut)
def update_vendor(
    vendor_id: UUID,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update vendor profile."""

    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    if (
        current_user.role == UserRole.VENDOR
        and vendor.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only edit your own vendor profile",
        )

    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(vendor, field, value)

    db.commit()
    db.refresh(vendor)

    log_activity(
        db,
        current_user.id,
        "vendor_updated",
        "vendor",
        vendor.id,
        f"Vendor {vendor.company_name} profile updated",
    )

    return vendor


@router.put("/{vendor_id}/approval", response_model=VendorOut)
def approve_or_reject_vendor(
    vendor_id: UUID,
    payload: VendorApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_team),
):
    """Approve, reject, suspend, or reactivate a vendor."""

    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    vendor.status = payload.status
    vendor.approval_notes = payload.approval_notes
    vendor.approved_by_id = current_user.id

    db.commit()
    db.refresh(vendor)

    log_activity(
        db,
        current_user.id,
        "vendor_status_changed",
        "vendor",
        vendor.id,
        f"Vendor {vendor.company_name} status set to {payload.status.value}",
    )

    if vendor.user_id:
        notify_user(
            db,
            vendor.user_id,
            "vendor_approval",
            f"Your vendor profile is now {payload.status.value}",
            payload.approval_notes,
            "vendor",
            vendor.id,
        )

    return vendor


@router.delete("/{vendor_id}", status_code=204)
def deactivate_vendor(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Deactivate a vendor."""

    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    vendor.is_active = False
    vendor.status = VendorStatus.INACTIVE

    db.commit()

    return None


@router.post(
    "/{vendor_id}/contacts",
    response_model=VendorContactOut,
    status_code=201,
)
def add_vendor_contact(
    vendor_id: UUID,
    payload: VendorContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a vendor contact."""

    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    contact = VendorContact(
        vendor_id=vendor_id,
        **payload.model_dump(),
    )

    db.add(contact)
    db.commit()
    db.refresh(contact)

    return contact


@router.delete(
    "/{vendor_id}/contacts/{contact_id}",
    status_code=204,
)
def delete_vendor_contact(
    vendor_id: UUID,
    contact_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a vendor contact."""

    contact = (
        db.query(VendorContact)
        .filter(
            VendorContact.id == contact_id,
            VendorContact.vendor_id == vendor_id,
        )
        .first()
    )

    if not contact:
        raise HTTPException(
            status_code=404,
            detail="Contact not found",
        )

    db.delete(contact)
    db.commit()

    return None