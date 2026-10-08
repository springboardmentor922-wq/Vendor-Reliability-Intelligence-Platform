from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.vendor import Vendor
from app.models.user import User
from app.models.notification import Notification
from app.models.enums import UserRole, VendorStatus, VendorCategory, NotificationType
from app.schemas.vendor import VendorCreate, VendorUpdate, VendorStatusUpdate, VendorResponse, PublicVendorShowcase
from app.core.dependencies import get_current_user, require_roles
from app.core.audit import log_audit_event
from app.routers.analytics import compute_vendor_intelligence

router = APIRouter(prefix="/vendors", tags=["Vendor Management"])

@router.get("/public-showcase", response_model=List[PublicVendorShowcase])
def get_public_vendors_showcase(db: Session = Depends(get_db)):
    """
    Public Vendor Portal endpoint accessible before login/registration.
    Returns basic showcase profile details for suppliers across all categories.
    """
    vendors = db.query(Vendor).all()
    showcase_items = []
    for v in vendors:
        intel = compute_vendor_intelligence(v, db)
        city_region = "Regional HQ"
        if v.address:
            parts = [p.strip() for p in v.address.split(",") if p.strip()]
            city_region = parts[-1] if parts else "National"
        
        cat_str = v.category.value if hasattr(v.category, "value") else str(v.category)
        stat_str = v.status.value if hasattr(v.status, "value") else str(v.status)
        
        score = intel.get("reliability_score", 0.0)
        if stat_str == "suspended" or score < 60:
            priority = "low"
        elif score >= 80:
            priority = "high"
        elif score >= 60:
            priority = "medium"
        else:
            priority = "low"
        
        showcase_items.append({
            "id": v.id,
            "company_name": v.company_name,
            "category": cat_str,
            "status": stat_str,
            "contact_person": v.contact_person,
            "email": v.email,
            "city_region": city_region,
            "tier": intel.get("supplier_tier", "New Vendor (Score: 0)"),
            "rating": intel.get("average_quality_rating", 0.0),
            "reliability_score": score,
            "priority": priority
        })
    return showcase_items

@router.post("/public-register", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def public_vendor_registration(vendor_in: VendorCreate, db: Session = Depends(get_db)):
    """
    Public Vendor Registration form on the Vendor Portal Gateway.
    Sets status to 'pending' verification.
    """
    existing = db.query(Vendor).filter(Vendor.company_name.ilike(vendor_in.company_name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A vendor with this company name already exists."
        )

    new_vendor = Vendor(
        company_name=vendor_in.company_name,
        category=vendor_in.category,
        contact_person=vendor_in.contact_person,
        contact_role=vendor_in.contact_role or "Sales Manager",
        email=vendor_in.email,
        phone=vendor_in.phone,
        address=vendor_in.address,
        gst_number=vendor_in.gst_number,
        payment_terms=vendor_in.payment_terms or "Net 15",
        notes=vendor_in.notes or "Registered via Public Vendor Portal Gateway",
        status=VendorStatus.PENDING,
        approved_by_id=None
    )
    db.add(new_vendor)
    db.commit()
    db.refresh(new_vendor)

    # Send approval request notification to all administrators
    admins = db.query(User).filter(User.role == UserRole.ADMINISTRATOR).all()
    for admin in admins:
        db.add(Notification(
            user_id=admin.id,
            type=NotificationType.VENDOR_APPROVAL,
            message=f"New vendor onboarding request: '{new_vendor.company_name}' requires Admin approval.",
            is_read=False
        ))
    db.commit()

    return new_vendor

@router.get("", response_model=List[VendorResponse])
def get_vendors(
    category: Optional[VendorCategory] = None,
    status_filter: Optional[VendorStatus] = Query(None, alias="status"),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Restrict vendor role to their own assigned company
    if current_user.role == UserRole.VENDOR:
        if not current_user.vendor_id:
            return []
        vendor = db.query(Vendor).filter(Vendor.id == current_user.vendor_id).first()
        return [vendor] if vendor else []

    query = db.query(Vendor)
    if category:
        query = query.filter(Vendor.category == category)
    if status_filter:
        query = query.filter(Vendor.status == status_filter)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Vendor.company_name.ilike(s)) |
            (Vendor.contact_person.ilike(s)) |
            (Vendor.email.ilike(s)) |
            (Vendor.gst_number.ilike(s))
        )
    vendors = query.order_by(Vendor.id.desc()).all()
    for v in vendors:
        intel = compute_vendor_intelligence(v, db)
        v.reliability_score = intel.get("reliability_score", 0.0)
    return vendors

@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor(
    vendor_in: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(Vendor).filter(Vendor.company_name.ilike(vendor_in.company_name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A vendor with this company name already exists."
        )

    # Newly created vendors start in Pending status awaiting confirmation
    initial_status = VendorStatus.PENDING
    approved_by = None

    vendor = Vendor(
        company_name=vendor_in.company_name,
        category=vendor_in.category,
        status=initial_status,
        contact_person=vendor_in.contact_person,
        contact_role=vendor_in.contact_role or "Sales Manager",
        email=vendor_in.email,
        phone=vendor_in.phone,
        address=vendor_in.address,
        gst_number=vendor_in.gst_number,
        payment_terms=vendor_in.payment_terms or "Net 15",
        notes=vendor_in.notes,
        approved_by_id=approved_by
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)

    # Link user to vendor if registering vendor user
    if current_user.role == UserRole.VENDOR and not current_user.vendor_id:
        current_user.vendor_id = vendor.id
        db.commit()

    # Notify all Administrators about the new vendor approval request
    admins = db.query(User).filter(User.role == UserRole.ADMINISTRATOR).all()
    for admin in admins:
        db.add(Notification(
            user_id=admin.id,
            type=NotificationType.VENDOR_APPROVAL,
            message=f"New vendor registration: '{vendor.company_name}' requires Admin review and approval.",
            is_read=False
        ))
    db.commit()

    log_audit_event(
        db, current_user.id, "CREATE_VENDOR", "Vendor",
        f"Vendor '{vendor.company_name}' registered with status {vendor.status.value}"
    )
    return vendor

@router.get("/{vendor_id}", response_model=VendorResponse)
def get_vendor_by_id(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.VENDOR and current_user.vendor_id != vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden to other vendor records")

    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    return vendor

@router.put("/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: int,
    vendor_in: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.VENDOR and current_user.vendor_id != vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    update_data = vendor_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(vendor, key, value)

    vendor.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(vendor)

    log_audit_event(db, current_user.id, "UPDATE_VENDOR", "Vendor", f"Updated details for vendor ID {vendor.id}")
    return vendor

@router.patch("/{vendor_id}/status", response_model=VendorResponse)
def update_vendor_status(
    vendor_id: int,
    status_in: VendorStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    # If approving or rejecting a pending vendor:
    if vendor.status == VendorStatus.PENDING:
        # Strictly restricted to Administrator
        if current_user.role != UserRole.ADMINISTRATOR:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only an Administrator can review and approve/reject new vendor registrations."
            )
    else:
        # Administrative lifecycle actions (suspend, reactivate)
        if current_user.role not in [UserRole.ADMINISTRATOR, UserRole.SUPPLY_CHAIN_MANAGER, UserRole.PROCUREMENT_MANAGER]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to change vendor lifecycle status."
            )

    vendor.status = status_in.status
    if status_in.notes:
        vendor.notes = f"{vendor.notes or ''}\n[Status Change Note]: {status_in.notes}".strip()
    
    if status_in.status in [VendorStatus.APPROVED, VendorStatus.ACTIVE]:
        vendor.approved_by_id = current_user.id
        vendor_users = db.query(User).filter(User.vendor_id == vendor.id).all()
        for vu in vendor_users:
            db.add(Notification(
                user_id=vu.id,
                type=NotificationType.VENDOR_APPROVAL,
                message=f"Vendor profile '{vendor.company_name}' approved by Administrator. Initial reliability score is 0.0.",
                is_read=False
            ))
    elif status_in.status == VendorStatus.REJECTED:
        vendor_users = db.query(User).filter(User.vendor_id == vendor.id).all()
        for vu in vendor_users:
            db.add(Notification(
                user_id=vu.id,
                type=NotificationType.VENDOR_APPROVAL,
                message=f"Vendor registration for '{vendor.company_name}' was rejected by Administrator.",
                is_read=False
            ))

    vendor.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(vendor)

    log_audit_event(
        db, current_user.id, "VENDOR_STATUS_CHANGE", "Vendor",
        f"Changed status of vendor '{vendor.company_name}' to {vendor.status.value}"
    )
    return vendor
