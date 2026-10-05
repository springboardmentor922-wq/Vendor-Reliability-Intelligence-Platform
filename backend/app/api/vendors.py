from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.vendor import Vendor, VendorStatusHistory
from app.schemas.vendor import (
    VendorCreate,
    VendorResponse,
    VendorUpdate,
)


router = APIRouter(
    prefix="/api/vendors",
    tags=["Vendors"],
)


VENDOR_CATEGORIES = [
    "Raw Material Suppliers",
    "Equipment Vendors",
    "IT Vendors",
    "Service Providers",
    "Logistics Partners",
    "Maintenance Vendors",
]


VENDOR_STATUSES = [
    "Pending",
    "Approved",
    "Rejected",
]


MANAGEMENT_ROLES = (
    UserRole.ADMINISTRATOR,
    UserRole.PROCUREMENT_MANAGER,
    UserRole.SUPPLY_CHAIN_MANAGER,
)


ADMIN_ROLE = (
    UserRole.ADMINISTRATOR,
)


HISTORY_ROLES = (
    UserRole.ADMINISTRATOR,
    UserRole.PROCUREMENT_MANAGER,
    UserRole.SUPPLY_CHAIN_MANAGER,
    UserRole.AUDITOR,
)


def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    cleaned = value.strip()
    return cleaned if cleaned else None


def normalize_email(value: str) -> str:
    return value.strip().lower()


def validate_category(category: str) -> str:
    cleaned = category.strip()

    if cleaned not in VENDOR_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid vendor category. Allowed categories are: "
                + ", ".join(VENDOR_CATEGORIES)
            ),
        )

    return cleaned


def validate_status_value(value: str) -> str:
    cleaned = value.strip()

    if cleaned not in VENDOR_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Invalid vendor status. Allowed statuses are: "
                + ", ".join(VENDOR_STATUSES)
            ),
        )

    return cleaned


def check_duplicate_email(
    db: Session,
    email: str,
    exclude_vendor_id: Optional[int] = None,
) -> None:
    normalized = normalize_email(email)

    query = db.query(Vendor).filter(
        Vendor.email.ilike(normalized)
    )

    if exclude_vendor_id is not None:
        query = query.filter(
            Vendor.id != exclude_vendor_id
        )

    if query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A vendor with this email address already exists.",
        )


def add_status_history(
    db: Session,
    vendor_id: int,
    previous_status: Optional[str],
    new_status: str,
    current_user: User,
    remarks: Optional[str] = None,
) -> None:
    history = VendorStatusHistory(
        vendor_id=vendor_id,
        previous_status=previous_status,
        new_status=new_status,
        changed_by_user_id=current_user.id,
        remarks=normalize_text(remarks),
    )

    db.add(history)


@router.get("/categories")
def get_vendor_categories(
    current_user: User = Depends(get_current_user),
):
    return {
        "categories": VENDOR_CATEGORIES
    }


@router.get("/statuses")
def get_vendor_statuses(
    current_user: User = Depends(get_current_user),
):
    return {
        "statuses": VENDOR_STATUSES
    }


@router.get(
    "",
    response_model=list[VendorResponse],
)
def get_vendors(
    category: Optional[str] = Query(
        default=None,
        description="Filter vendors by category",
    ),
    status: Optional[str] = Query(
        default=None,
        description="Filter vendors by status",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Vendor)

    category = normalize_text(category)
    status = normalize_text(status)

    if category:
        category = validate_category(category)
        query = query.filter(
            Vendor.category == category
        )

    if status:
        status = validate_status_value(status)
        query = query.filter(
            Vendor.status == status
        )

    return (
        query
        .order_by(Vendor.id.desc())
        .all()
    )


@router.get(
    "/{vendor_id}/history",
)
def get_vendor_status_history(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(*HISTORY_ROLES)
    ),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    history = (
        db.query(VendorStatusHistory)
        .filter(
            VendorStatusHistory.vendor_id == vendor_id
        )
        .order_by(
            VendorStatusHistory.changed_at.desc(),
            VendorStatusHistory.id.desc(),
        )
        .all()
    )

    return [
        {
            "id": item.id,
            "vendor_id": item.vendor_id,
            "previous_status": item.previous_status,
            "new_status": item.new_status,
            "changed_by_user_id": item.changed_by_user_id,
            "changed_at": item.changed_at,
            "remarks": item.remarks,
        }
        for item in history
    ]


@router.get(
    "/{vendor_id}",
    response_model=VendorResponse,
)
def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    return vendor


@router.post(
    "",
    response_model=VendorResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_vendor(
    vendor: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    category = validate_category(vendor.category)
    email = normalize_email(str(vendor.email))

    check_duplicate_email(
        db=db,
        email=email,
    )

    new_vendor = Vendor(
        name=vendor.name.strip(),
        category=category,
        contact_person=vendor.contact_person.strip(),
        email=email,
        phone=vendor.phone.strip(),
        status="Pending",
        location=normalize_text(vendor.location),
        contract_details=normalize_text(
            vendor.contract_details
        ),
        performance_score=None,
        reliability_score=None,
    )

    try:
        db.add(new_vendor)
        db.flush()

        add_status_history(
            db=db,
            vendor_id=new_vendor.id,
            previous_status=None,
            new_status="Pending",
            current_user=current_user,
            remarks="Vendor registered",
        )

        db.commit()
        db.refresh(new_vendor)

    except Exception:
        db.rollback()
        raise

    return new_vendor


@router.put(
    "/{vendor_id}",
    response_model=VendorResponse,
)
def update_vendor(
    vendor_id: int,
    vendor: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    existing_vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not existing_vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    if vendor.name is not None:
        existing_vendor.name = vendor.name.strip()

    if vendor.category is not None:
        existing_vendor.category = validate_category(
            vendor.category
        )

    if vendor.contact_person is not None:
        existing_vendor.contact_person = (
            vendor.contact_person.strip()
        )

    if vendor.email is not None:
        email = normalize_email(str(vendor.email))

        check_duplicate_email(
            db=db,
            email=email,
            exclude_vendor_id=vendor_id,
        )

        existing_vendor.email = email

    if vendor.phone is not None:
        existing_vendor.phone = vendor.phone.strip()

    if vendor.location is not None:
        existing_vendor.location = normalize_text(
            vendor.location
        )

    if vendor.contract_details is not None:
        existing_vendor.contract_details = normalize_text(
            vendor.contract_details
        )

    try:
        db.commit()
        db.refresh(existing_vendor)

    except Exception:
        db.rollback()
        raise

    return existing_vendor


@router.patch(
    "/{vendor_id}/status",
    response_model=VendorResponse,
)
def update_vendor_status(
    vendor_id: int,
    new_status: str = Query(
        ...,
        description="New vendor status",
    ),
    remarks: Optional[str] = Query(
        default=None,
        max_length=500,
        description="Reason for the status change",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    existing_vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not existing_vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    validated_status = validate_status_value(new_status)
    previous_status = existing_vendor.status

    if previous_status == validated_status:
        return existing_vendor

    existing_vendor.status = validated_status

    try:
        add_status_history(
            db=db,
            vendor_id=existing_vendor.id,
            previous_status=previous_status,
            new_status=validated_status,
            current_user=current_user,
            remarks=remarks,
        )

        db.commit()
        db.refresh(existing_vendor)

    except Exception:
        db.rollback()
        raise

    return existing_vendor


@router.delete(
    "/{vendor_id}",
)
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(*ADMIN_ROLE)
    ),
):
    existing_vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not existing_vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    db.delete(existing_vendor)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Vendor deleted successfully"
    }