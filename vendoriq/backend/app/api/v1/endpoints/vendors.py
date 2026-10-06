from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.deps import (
    get_current_user,
    require_admin,
    require_procurement_team,
    require_vendor_management,
    require_operations_read,
)
from app.core.utils import log_activity, notify_user
from app.services.notification_service import notify_event
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


# ============================================================
# REGISTER VENDOR
# ============================================================

@router.post("", response_model=VendorOut, status_code=201)
def register_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_vendor_management),
):
    """
    Register a vendor for onboarding.

    Allowed roles:
    - Administrator
    - Procurement Manager
    - Supply Chain Manager
    - Auditor

    Vendor accounts cannot register additional vendor profiles.
    """

    existing = (
        db.query(Vendor)
        .filter(Vendor.email == payload.email)
        .first()
    )

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
        user_id=None,
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

    approvers = (
        db.query(User)
        .filter(
            User.role.in_(
                [
                    UserRole.ADMIN,
                    UserRole.PROCUREMENT_MANAGER,
                ]
            )
        )
        .all()
    )

    for approver in approvers:
        notify_event(
            db,
            approver,
            "vendor_approval",
            "New Vendor Pending Approval",
            f"{vendor.company_name} has registered and is awaiting approval.",
            "vendor",
            vendor.id,
        )

    return vendor


# ============================================================
# LIST VENDORS
# ============================================================

@router.get("", response_model=List[VendorOut])
def list_vendors(
    category: Optional[VendorCategory] = None,
    status_filter: Optional[VendorStatus] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List vendors with filtering and search.

    Vendor users only see their own vendor profile.

    Read access:
    - Administrator
    - Procurement Manager
    - Supply Chain Manager
    - Vendor
    - Auditor

    Finance Officer does not have vendor-management access.
    """

    if current_user.role == UserRole.FINANCE_OFFICER:
        raise HTTPException(
            status_code=403,
            detail="Vendor access is not permitted for finance officers",
        )

    query = db.query(Vendor).options(
        joinedload(Vendor.contacts)
    )

    if category:
        query = query.filter(
            Vendor.category == category
        )

    if status_filter:
        query = query.filter(
            Vendor.status == status_filter
        )

    if search:
        like = f"%{search}%"

        query = query.filter(
            Vendor.company_name.ilike(like)
        )

    if current_user.role == UserRole.VENDOR:
        query = query.filter(
            Vendor.user_id == current_user.id
        )

    return (
        query
        .order_by(Vendor.created_at.desc())
        .all()
    )


# ============================================================
# GET SINGLE VENDOR
# ============================================================

@router.get("/{vendor_id}", response_model=VendorOut)
def get_vendor(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get vendor details.

    Vendor users can only access their own vendor profile.
    """

    if current_user.role == UserRole.FINANCE_OFFICER:
        raise HTTPException(
            status_code=403,
            detail="Vendor access is not permitted for finance officers",
        )

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

    if (
        current_user.role == UserRole.VENDOR
        and vendor.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only access your own vendor profile",
        )

    return vendor


# ============================================================
# UPDATE VENDOR
# ============================================================

@router.put("/{vendor_id}", response_model=VendorOut)
def update_vendor(
    vendor_id: UUID,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update vendor profile.

    Vendor:
        Can update only their own vendor profile.

    Procurement/Supply Chain/Admin:
        Can update vendor profiles.

    Auditor:
        Read-only.

    Finance:
        No vendor access.
    """

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

    # Vendor ownership
    if current_user.role == UserRole.VENDOR:

        if vendor.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only edit your own vendor profile",
            )

    # Roles that cannot modify vendors
    elif current_user.role in (
        UserRole.AUDITOR,
        UserRole.FINANCE_OFFICER,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                f"Role '{current_user.role.value}' "
                "cannot update vendor profiles"
            ),
        )

    # Only Admin / Procurement / Supply Chain reach here

    data = payload.model_dump(
        exclude_unset=True
    )

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


# ============================================================
# APPROVE / REJECT / SUSPEND / REACTIVATE VENDOR
# ============================================================

@router.put(
    "/{vendor_id}/approval",
    response_model=VendorOut,
)
def approve_or_reject_vendor(
    vendor_id: UUID,
    payload: VendorApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_team),
):
    """
    Approve, reject, suspend, or reactivate a vendor.

    Allowed roles:
    - Administrator
    - Procurement Manager
    - Supply Chain Manager
    """

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
        (
            f"Vendor {vendor.company_name} status set to "
            f"{payload.status.value}"
        ),
    )

    if vendor.user_id:

        vendor_user = (
            db.query(User)
            .filter(User.id == vendor.user_id)
            .first()
        )

        if vendor_user:

            notify_event(
                db,
                vendor_user,
                "vendor_approval",
                f"Your vendor profile is now {payload.status.value}",
                (
                    payload.approval_notes
                    or (
                        "Vendor status changed to "
                        f"{payload.status.value}."
                    )
                ),
                "vendor",
                vendor.id,
            )

    return vendor


# ============================================================
# DEACTIVATE VENDOR
# ============================================================

@router.delete("/{vendor_id}", status_code=204)
def deactivate_vendor(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Deactivate a vendor.

    Allowed role:
    - Administrator
    """

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

    vendor.is_active = False
    vendor.status = VendorStatus.INACTIVE

    db.commit()

    return None


# ============================================================
# ADD VENDOR CONTACT
# ============================================================

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
    """
    Add a vendor contact.

    Vendor users can add contacts only to their own vendor profile.
    Admin, Procurement Manager and Supply Chain Manager can add contacts.
    Auditors and Finance Officers cannot modify contacts.
    """

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

    if current_user.role == UserRole.VENDOR:

        if vendor.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only manage contacts for your own vendor",
            )

    elif current_user.role in (
        UserRole.AUDITOR,
        UserRole.FINANCE_OFFICER,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                f"Role '{current_user.role.value}' "
                "cannot add vendor contacts"
            ),
        )

    contact = VendorContact(
        vendor_id=vendor_id,
        **payload.model_dump(),
    )

    db.add(contact)
    db.commit()
    db.refresh(contact)

    log_activity(
        db,
        current_user.id,
        "vendor_contact_added",
        "vendor_contact",
        contact.id,
        f"Contact added to vendor {vendor.company_name}",
    )

    return contact


# ============================================================
# DELETE VENDOR CONTACT
# ============================================================

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
    """
    Delete a vendor contact.

    Vendor users can delete contacts only from their own vendor profile.
    Admin, Procurement Manager and Supply Chain Manager can delete contacts.
    Auditors and Finance Officers are read-only/no-access.
    """

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

    if current_user.role == UserRole.VENDOR:

        if vendor.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail=(
                    "You can only manage contacts "
                    "for your own vendor"
                ),
            )

    elif current_user.role in (
        UserRole.AUDITOR,
        UserRole.FINANCE_OFFICER,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                f"Role '{current_user.role.value}' "
                "cannot delete vendor contacts"
            ),
        )

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

    log_activity(
        db,
        current_user.id,
        "vendor_contact_deleted",
        "vendor_contact",
        contact_id,
        f"Contact deleted from vendor {vendor.company_name}",
    )

    return None