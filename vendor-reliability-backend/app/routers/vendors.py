from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.dependencies import (
    get_db, get_current_user, get_optional_current_user,
    require_roles, get_vendor_for_user, get_role_vendor_permissions
)
from app.core.security import hash_password
from app.models.user import User
from app.models.vendor import Vendor, VendorCategory, VendorContact
from app.models.notification import Notification
from app.models.communication import AuditLog
from app.schemas.vendor import (
    VendorCreate, VendorUpdate, VendorApproval, VendorResponse,
    VendorCategoryResponse, VendorContactCreate, VendorContactResponse,
    VendorRegisterRequest, VendorCredentialsUpdate, VendorCredentialsResponse
)

router = APIRouter(prefix="/vendors", tags=["Vendors"])

@router.get("/permissions/me")
def get_my_vendor_permissions(
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Return current user's role-based vendor capabilities and editable fields."""
    role = current_user.role if current_user else "Public"
    perms = get_role_vendor_permissions(role)
    return {
        "role": role,
        "is_authenticated": current_user is not None,
        "user_id": current_user.id if current_user else None,
        **perms
    }

@router.get("/categories/list", response_model=List[VendorCategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    return db.query(VendorCategory).filter(VendorCategory.is_active == True).all()

@router.get("/my-profile", response_model=VendorResponse)
def get_my_vendor_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Vendor retrieves exclusively their own organization profile."""
    vendor = get_vendor_for_user(db, current_user)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not linked to this user account.")
    return vendor

@router.get("/compare")
def compare_vendors(
    vendor_ids: str = Query(..., description="Comma-separated list of vendor IDs to compare, e.g. '1,2,3'"),
    db: Session = Depends(get_db),
    proc_user: User = Depends(require_roles(["Procurement Manager", "Administrator"]))
):
    """Procurement Manager evaluates and compares vendors side-by-side."""
    try:
        ids = [int(i.strip()) for i in vendor_ids.split(",") if i.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vendor IDs parameter.")

    vendors = db.query(Vendor).filter(Vendor.id.in_(ids)).all()
    comparison = []
    for v in vendors:
        comparison.append({
            "id": v.id,
            "name": v.name,
            "company": v.company,
            "category": v.category,
            "product": v.product,
            "deliveryRate": v.deliveryRate,
            "quality_rating": v.quality_rating,
            "risk_level": v.risk_level,
            "response_time_hours": v.response_time_hours,
            "status": v.status,
            "notes": v.notes
        })
    return comparison

@router.get("", response_model=List[VendorResponse])
def get_vendors(
    vendor_status: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List organizational vendors with optional filters.
    Centralized directory visible to all registered roles.
    """
    query = db.query(Vendor)

    if vendor_status and vendor_status.lower() != "all":
        query = query.filter(Vendor.status == vendor_status)
    if category and category.lower() != "all":
        query = query.filter(Vendor.category == category)
    if search:
        s = f"%{search}%"
        query = query.filter((Vendor.name.ilike(s)) | (Vendor.company.ilike(s)) | (Vendor.product.ilike(s)))
    return query.order_by(Vendor.id.desc()).all()

@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor(
    vendor: VendorCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Register a new vendor with optional login password.
    Automatically creates/links an approved User login account so the vendor can log in.
    """
    v_email = vendor.email.strip().lower()

    # Determine or create user for this vendor
    user_id = None
    if current_user and current_user.role == "Vendor":
        user_id = current_user.id
    else:
        # Check if user already exists with this email
        existing_user = db.query(User).filter(func.lower(User.email) == v_email).first()
        if existing_user:
            user_id = existing_user.id
            if vendor.password:
                existing_user.hashed_password = hash_password(vendor.password)
            existing_user.approval_status = "APPROVED"
            existing_user.is_active = True
        else:
            # Create a new login account for this vendor
            pwd_to_hash = vendor.password if vendor.password else "vendor123"
            new_user = User(
                full_name=vendor.name.strip(),
                email=v_email,
                hashed_password=hash_password(pwd_to_hash),
                role="Vendor",
                company=vendor.company.strip(),
                phone=vendor.phone.strip(),
                department="External Vendor",
                vendor_category=vendor.category or "Raw Material Suppliers",
                product_service=vendor.product.strip(),
                approval_status="APPROVED",
                is_active=True
            )
            db.add(new_user)
            db.flush()
            user_id = new_user.id

    new_vendor = Vendor(
        user_id=user_id,
        name=vendor.name.strip(),
        company=vendor.company.strip(),
        email=v_email,
        phone=vendor.phone.strip(),
        address=vendor.address.strip() if vendor.address else None,
        website=vendor.website.strip() if vendor.website else None,
        product=vendor.product.strip(),
        category=vendor.category or "Raw Material Suppliers",
        status=vendor.status or "Pending",
        deliveryRate=float(vendor.deliveryRate),
        quality_rating=float(vendor.quality_rating),
        response_time_hours=float(vendor.response_time_hours),
        risk_level=vendor.risk_level or "Low",
        notes=vendor.notes
    )
    db.add(new_vendor)
    db.commit()
    db.refresh(new_vendor)

    # Automatically add primary contact
    primary_contact = VendorContact(
        vendor_id=new_vendor.id,
        contact_name=new_vendor.name,
        title="Primary Representative",
        email=new_vendor.email,
        phone=new_vendor.phone,
        is_primary=True
    )
    db.add(primary_contact)

    # Notify administrators & procurement managers
    managers = db.query(User).filter(User.role.in_(["Administrator", "Procurement Manager"])).all()
    for m in managers:
        notif = Notification(
            user_id=m.id,
            title="New Vendor Registration",
            message=f"Vendor '{new_vendor.name}' ({new_vendor.company}) registered with login account ({v_email}).",
            type="approval",
            reference_id=new_vendor.id,
            reference_type="vendor"
        )
        db.add(notif)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id if current_user else user_id,
        action="VENDOR_CREATED",
        entity_type="Vendor",
        entity_id=new_vendor.id,
        details=f"Vendor '{new_vendor.name}' registered with login account '{v_email}'."
    )
    db.add(audit)
    db.commit()
    db.refresh(new_vendor)

    return new_vendor

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_vendor(
    payload: VendorRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Dedicated Vendor Registration endpoint:
    Registers a Vendor with email, password, and organizational details.
    Creates an active, approved User account for login and a linked Vendor profile.
    """
    email_clean = payload.email.strip().lower()

    # 1. Check if user already exists
    existing_user = db.query(User).filter(func.lower(User.email) == email_clean).first()
    if existing_user and existing_user.role != "Vendor":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{payload.email}' already exists with role '{existing_user.role}'."
        )

    company_clean = (payload.company or payload.name).strip()
    category_clean = payload.category or "Raw Material Suppliers"

    # 2. Create or update User
    if existing_user:
        user = existing_user
        user.hashed_password = hash_password(payload.password)
        user.approval_status = "APPROVED"
        user.is_active = True
        user.company = company_clean
        user.phone = payload.phone.strip() if payload.phone else user.phone
        user.vendor_category = category_clean
    else:
        user = User(
            full_name=payload.name.strip(),
            email=email_clean,
            hashed_password=hash_password(payload.password),
            role="Vendor",
            company=company_clean,
            phone=payload.phone.strip() if payload.phone else None,
            department="External Vendor",
            vendor_category=category_clean,
            product_service=payload.product or "General Supplies",
            business_reg_number=payload.business_reg_number,
            gst_tax_id=payload.gst_tax_id,
            approval_status="APPROVED",
            is_active=True
        )
        db.add(user)
        db.flush()

    # 3. Create or update Vendor profile
    existing_vendor = db.query(Vendor).filter(
        (func.lower(Vendor.email) == email_clean) |
        (Vendor.user_id == user.id)
    ).first()

    if existing_vendor:
        vendor = existing_vendor
        vendor.user_id = user.id
        vendor.name = payload.name.strip()
        vendor.company = company_clean
        vendor.email = email_clean
        vendor.phone = payload.phone.strip() if payload.phone else vendor.phone
        vendor.category = category_clean
        vendor.product = payload.product or vendor.product
        vendor.address = payload.address or vendor.address
        vendor.website = payload.website or vendor.website
        vendor.status = "Pending"
    else:
        vendor = Vendor(
            user_id=user.id,
            name=payload.name.strip(),
            company=company_clean,
            email=email_clean,
            phone=payload.phone.strip() if payload.phone else "+1 800-555-0100",
            address=payload.address,
            website=payload.website,
            product=payload.product or "General Supplies",
            category=category_clean,
            status="Active",
            deliveryRate=0.0,
            quality_rating=0.0,
            response_time_hours=24.0,
            risk_level="Low",
            business_reg_number=payload.business_reg_number,
            gst_tax_id=payload.gst_tax_id,
            notes=payload.notes or "Self-registered vendor profile. Awaiting Administrator verification and approval."
        )
        db.add(vendor)
        db.flush()

        # Primary contact
        primary_contact = VendorContact(
            vendor_id=vendor.id,
            contact_name=vendor.name,
            title="Primary Representative",
            email=vendor.email,
            phone=vendor.phone,
            is_primary=True
        )
        db.add(primary_contact)

    # Audit log
    audit = AuditLog(
        user_id=user.id,
        user_name=user.full_name,
        user_role="Vendor",
        action="VENDOR_REGISTERED_WITH_CREDENTIALS",
        entity_type="Vendor",
        entity_id=vendor.id,
        previous_status="NONE",
        new_status="APPROVED",
        details=f"Vendor '{vendor.name}' registered with login email '{email_clean}'."
    )
    db.add(audit)
    db.commit()
    db.refresh(vendor)
    db.refresh(user)

    return {
        "status": "success",
        "message": f"Vendor '{vendor.name}' registered successfully! You can now log in with {email_clean}.",
        "vendor": {
            "id": vendor.id,
            "name": vendor.name,
            "company": vendor.company,
            "email": vendor.email,
            "category": vendor.category,
            "status": vendor.status
        },
        "credentials": {
            "email": user.email,
            "role": user.role,
            "user_id": user.id,
            "approval_status": user.approval_status,
            "is_active": user.is_active
        }
    }

@router.post("/provision-all-credentials")
def provision_all_vendor_credentials(
    default_password: str = Query("vendor123", description="Default password for unprovisioned vendors"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Mass-provisions active login credentials (email & password) for all vendors
    currently missing a linked User account in the database.
    """
    vendors = db.query(Vendor).all()
    provisioned = []

    for v in vendors:
        v_email = v.email.strip().lower()
        user = None
        if v.user_id:
            user = db.query(User).filter(User.id == v.user_id).first()

        if not user:
            user = db.query(User).filter(func.lower(User.email) == v_email).first()

        if not user:
            user = User(
                full_name=v.name,
                email=v_email,
                hashed_password=hash_password(default_password),
                role="Vendor",
                company=v.company,
                phone=v.phone,
                department="External Vendor",
                vendor_category=v.category,
                product_service=v.product,
                business_reg_number=v.business_reg_number,
                gst_tax_id=v.gst_tax_id,
                approval_status="APPROVED",
                is_active=True
            )
            db.add(user)
            db.flush()

        # Ensure user is active & approved
        user.approval_status = "APPROVED"
        user.is_active = True
        v.user_id = user.id
        provisioned.append({
            "vendor_id": v.id,
            "name": v.name,
            "email": user.email,
            "user_id": user.id,
            "login_ready": True
        })

    db.commit()
    return {
        "status": "success",
        "message": f"Successfully verified/provisioned login credentials for {len(provisioned)} vendors.",
        "default_password": default_password,
        "vendors": provisioned
    }

@router.post("/{vendor_id}/credentials", response_model=VendorCredentialsResponse)
def set_vendor_credentials(
    vendor_id: int,
    payload: VendorCredentialsUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Register or update login credentials (email and password) for a specific vendor.
    """
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    target_email = payload.email.strip().lower() if payload.email else vendor.email.strip().lower()

    user = None
    if vendor.user_id:
        user = db.query(User).filter(User.id == vendor.user_id).first()

    if not user:
        user = db.query(User).filter(func.lower(User.email) == target_email).first()

    if user:
        user.email = target_email
        user.hashed_password = hash_password(payload.password)
        user.approval_status = "APPROVED"
        user.is_active = True
    else:
        user = User(
            full_name=vendor.name,
            email=target_email,
            hashed_password=hash_password(payload.password),
            role="Vendor",
            company=vendor.company,
            phone=vendor.phone,
            department="External Vendor",
            vendor_category=vendor.category,
            product_service=vendor.product,
            approval_status="APPROVED",
            is_active=True
        )
        db.add(user)
        db.flush()

    vendor.user_id = user.id
    vendor.email = target_email
    db.commit()
    db.refresh(vendor)
    db.refresh(user)

    return {
        "vendor_id": vendor.id,
        "vendor_name": vendor.name,
        "company": vendor.company,
        "email": user.email,
        "role": user.role,
        "user_id": user.id,
        "approval_status": user.approval_status,
        "is_active": user.is_active,
        "message": f"Login credentials for {vendor.name} successfully registered. Can now log in with {user.email}."
    }

@router.get("/{vendor_id}/credentials-status")
def get_vendor_credentials_status(
    vendor_id: int,
    db: Session = Depends(get_db)
):
    """
    Check if a vendor has registered login credentials and active account status.
    """
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    user = None
    if vendor.user_id:
        user = db.query(User).filter(User.id == vendor.user_id).first()
    if not user:
        user = db.query(User).filter(func.lower(User.email) == vendor.email.strip().lower()).first()

    return {
        "vendor_id": vendor.id,
        "vendor_name": vendor.name,
        "vendor_email": vendor.email,
        "has_login_account": user is not None,
        "login_email": user.email if user else None,
        "user_id": user.id if user else None,
        "approval_status": user.approval_status if user else "UNREGISTERED",
        "is_active": user.is_active if user else False
    }

@router.get("/{vendor_id}", response_model=VendorResponse)
def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail=f"Vendor with ID {vendor_id} not found")
    return vendor

@router.put("/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: int,
    data: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        "Administrator",
        "Procurement Manager",
        "Supply Chain Manager",
        "Vendor",
        "Finance Officer",
        "Auditor"
    ]))
):
    """
    Update vendor fields according to caller's role permissions:
    - Administrator: Full update access to all fields.
    - Procurement Manager: Profile, category, risk level, status, notes.
    - Supply Chain Manager: Operational metrics (deliveryRate, quality_rating, response_time_hours, risk_level, notes).
    - Vendor: Own profile details only (name, company, email, phone, address, website, product, notes).
    - Finance Officer / Auditor: Financial & compliance notes.
    """
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    perms = get_role_vendor_permissions(current_user.role)
    allowed_fields = set(perms.get("editable_fields", []))

    # Vendor role check: can only update their own profile
    if current_user.role == "Vendor":
        user_vendor = get_vendor_for_user(db, current_user)
        is_own = (vendor.user_id == current_user.id) or (user_vendor and vendor.id == user_vendor.id)
        if not is_own:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only edit your own vendor profile."
            )

    update_dict = data.dict(exclude_unset=True)
    if not update_dict:
        return vendor

    # Validate field permissions for non-administrators
    if current_user.role != "Administrator":
        disallowed_fields = [k for k in update_dict.keys() if k not in allowed_fields]
        if disallowed_fields:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorized to edit field(s): {', '.join(disallowed_fields)}. Allowed fields: {', '.join(sorted(allowed_fields))}"
            )

    updated_fields = []
    for field, value in update_dict.items():
        if field in allowed_fields or current_user.role == "Administrator":
            setattr(vendor, field, value)
            updated_fields.append(field)

    vendor.updated_at = datetime.utcnow()

    # Log audit
    audit = AuditLog(
        user_id=current_user.id,
        action="VENDOR_UPDATED",
        entity_type="Vendor",
        entity_id=vendor.id,
        details=f"Vendor '{vendor.name}' updated by {current_user.full_name} ({current_user.role}). Fields: {', '.join(updated_fields)}"
    )
    db.add(audit)
    db.commit()
    db.refresh(vendor)
    return vendor

@router.post("/{vendor_id}/approve", response_model=VendorResponse)
def approve_vendor(
    vendor_id: int,
    approval: VendorApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Administrator", "Procurement Manager"]))
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    vendor.status = "Approved" if approval.status.lower() == "approved" else "Rejected"
    vendor.reviewed_by_id = current_user.id
    vendor.review_notes = approval.review_notes
    vendor.reviewed_at = datetime.utcnow()
    vendor.updated_at = datetime.utcnow()

    if vendor.status == "Approved":
        from app.models.delivery import Delivery
        del_count = db.query(Delivery).filter(Delivery.vendor_id == vendor.id).count()
        if del_count == 0:
            vendor.deliveryRate = 0.0
            from app.models.vendor_metrics import VendorPerformance
            perf = db.query(VendorPerformance).filter(VendorPerformance.vendor_id == vendor.id).first()
            if perf:
                perf.reliability_score = 0.0
                perf.on_time_rate = 0.0
                perf.fulfillment_rate = 0.0
                perf.quality_rating = 0.0
            else:
                perf = VendorPerformance(
                    vendor_id=vendor.id,
                    total_orders=0,
                    completed_orders=0,
                    on_time_deliveries=0,
                    delayed_deliveries=0,
                    partial_deliveries=0,
                    cancelled_orders=0,
                    delay_frequency=0.0,
                    on_time_rate=0.0,
                    fulfillment_rate=0.0,
                    quality_rating=0.0,
                    reliability_score=0.0,
                    average_delay_days=0.0
                )
                db.add(perf)

    # Automatically activate or reject linked User account
    user = None
    if vendor.user_id:
        user = db.query(User).filter(User.id == vendor.user_id).first()
    if not user and vendor.email:
        user = db.query(User).filter(func.lower(User.email) == vendor.email.strip().lower()).first()

    if user:
        if vendor.status == "Approved":
            user.approval_status = "APPROVED"
            user.is_active = True
        else:
            user.approval_status = "REJECTED"
            user.is_active = False
            user.rejection_reason = approval.review_notes or "Vendor registration was rejected by Administrator."
        if not vendor.user_id:
            vendor.user_id = user.id

    # Log audit
    audit = AuditLog(
        user_id=current_user.id,
        action=f"VENDOR_{vendor.status.upper()}",
        entity_type="Vendor",
        entity_id=vendor.id,
        details=f"Vendor {vendor.name} was {vendor.status} by {current_user.full_name}. Notes: {approval.review_notes or 'None'}"
    )
    db.add(audit)

    # Notify vendor user if linked
    if vendor.user_id:
        notif = Notification(
            user_id=vendor.user_id,
            title=f"Vendor Registration {vendor.status}",
            message=f"Your vendor profile has been {vendor.status.lower()} by procurement team. Notes: {approval.review_notes or 'No notes provided.'}",
            type="approval",
            reference_id=vendor.id,
            reference_type="vendor"
        )
        db.add(notif)

    db.commit()
    db.refresh(vendor)
    return vendor

@router.post("/{vendor_id}/reject", response_model=VendorResponse)
def reject_vendor(
    vendor_id: int,
    approval: VendorApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Administrator", "Procurement Manager"]))
):
    approval.status = "Rejected"
    return approve_vendor(vendor_id, approval, db, current_user)

@router.post("/{vendor_id}/contacts", response_model=VendorContactResponse, status_code=status.HTTP_201_CREATED)
def add_contact(
    vendor_id: int,
    contact: VendorContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        "Administrator",
        "Procurement Manager",
        "Supply Chain Manager",
        "Finance Officer",
        "Vendor"
    ]))
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if current_user.role == "Vendor":
        user_vendor = get_vendor_for_user(db, current_user)
        is_own = (vendor.user_id == current_user.id) or (user_vendor and vendor.id == user_vendor.id)
        if not is_own:
            raise HTTPException(status_code=403, detail="Access denied: You can only add contacts to your own vendor profile.")

    new_contact = VendorContact(
        vendor_id=vendor_id,
        contact_name=contact.contact_name,
        title=contact.title,
        email=contact.email,
        phone=contact.phone,
        is_primary=contact.is_primary
    )
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact

@router.delete("/{vendor_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    vendor_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        "Administrator",
        "Procurement Manager",
        "Supply Chain Manager",
        "Vendor"
    ]))
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    contact = db.query(VendorContact).filter(VendorContact.id == contact_id, VendorContact.vendor_id == vendor_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if current_user.role == "Vendor":
        user_vendor = get_vendor_for_user(db, current_user)
        is_own = (vendor.user_id == current_user.id) or (user_vendor and vendor.id == user_vendor.id)
        if not is_own:
            raise HTTPException(status_code=403, detail="Access denied: You can only remove contacts from your own profile.")

    db.delete(contact)
    db.commit()
    return None

@router.get("/{vendor_id}/profile")
def get_vendor_profile_detail(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Detailed Vendor Profile Page (Section 8 of specification):
    - Basic Information (Company, Contact person, Email, Phone, Address)
    - Products/Services
    - Documents
    - Purchase History
    - Delivery History
    - Performance (Total, Completed, Delayed, Partial, Cancelled, Delivery Rate)
    - Reliability
    - Risk (Level & specific Reasons)
    - Current Status
    """
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    from app.services.reliability_engine import calculate_vendor_metrics
    import json
    metrics = calculate_vendor_metrics(db, vendor.id)

    # Deliveries
    from app.models.delivery import Delivery
    from app.models.purchase_order import PurchaseOrder
    deliveries = db.query(Delivery).join(PurchaseOrder).filter(PurchaseOrder.vendor_id == vendor.id).all()
    delivery_history = [
        {
            "id": d.id,
            "po_number": d.purchase_order.po_number if d.purchase_order else "N/A",
            "expected_delivery_date": d.expected_delivery_date,
            "actual_delivery_date": d.actual_delivery_date,
            "ordered_quantity": d.ordered_quantity,
            "delivered_quantity": d.delivered_quantity,
            "delay_days": d.delay_days,
            "delivery_status": d.delivery_status,
            "carrier": d.carrier,
            "tracking_number": d.tracking_number,
            "notes": d.notes
        }
        for d in deliveries
    ]

    # Purchase History
    pos = db.query(PurchaseOrder).filter(PurchaseOrder.vendor_id == vendor.id).all()
    purchase_history = [
        {
            "id": p.id,
            "po_number": p.po_number,
            "total_amount": p.total_amount,
            "currency": p.currency,
            "status": p.status,
            "created_at": p.created_at,
            "issued_at": p.issued_at,
            "actual_delivery_date": p.actual_delivery_date
        }
        for p in pos
    ]

    # Documents
    documents = [
        {
            "id": doc.id,
            "document_type": doc.document_type,
            "document_name": doc.document_name,
            "document_url": doc.document_url,
            "status": doc.status,
            "uploaded_at": doc.uploaded_at
        }
        for doc in vendor.documents
    ] if vendor.documents else []

    # Products
    products = [
        {
            "id": prod.id,
            "product_name": prod.product_name,
            "category": prod.category,
            "unit_price": prod.unit_price,
            "lead_time_days": prod.lead_time_days,
            "in_stock": prod.in_stock,
            "description": prod.description
        }
        for prod in vendor.products
    ] if vendor.products else []

    return {
        "id": vendor.id,
        "name": vendor.name,
        "company": vendor.company,
        "email": vendor.email,
        "phone": vendor.phone,
        "address": vendor.address,
        "website": vendor.website,
        "product": vendor.product,
        "category": vendor.category,
        "status": vendor.status,
        "business_reg_number": vendor.business_reg_number or "CIN-9902184-CORP",
        "gst_tax_id": vendor.gst_tax_id or "GSTIN-27AAACG0184A1Z5",
        "bank_details": vendor.bank_details or "HDFC Commercial / AC: 502000881920",
        "notes": vendor.notes,
        "metrics": metrics,
        "performance": {
            "total_orders": metrics.get("total_orders", len(pos)),
            "completed_orders": metrics.get("completed_orders", len([p for p in pos if p.status in ["Delivered", "Completed"]])),
            "on_time_deliveries": sum(1 for d in deliveries if d.delay_days <= 0),
            "delayed_deliveries": sum(1 for d in deliveries if d.delay_days > 0),
            "partial_deliveries": sum(1 for d in deliveries if d.delivered_quantity < d.ordered_quantity),
            "cancelled_orders": len([p for p in pos if p.status == "Cancelled"]),
            "on_time_delivery_rate": metrics.get("on_time_rate", vendor.deliveryRate),
            "fulfillment_rate": metrics.get("fulfillment_rate", 100.0),
            "quality_rating": vendor.quality_rating,
            "reliability_score": metrics.get("reliability_score", vendor.deliveryRate),
            "risk_level": metrics.get("risk_level", vendor.risk_level),
            "risk_reasons": metrics.get("risk_reasons", [])
        },
        "products": products,
        "documents": documents,
        "purchase_history": purchase_history,
        "delivery_history": delivery_history,
        "contacts": [
            {
                "id": c.id,
                "contact_name": c.contact_name,
                "title": c.title,
                "email": c.email,
                "phone": c.phone,
                "is_primary": c.is_primary
            }
            for c in vendor.contacts
        ]
    }

@router.get("/{vendor_id}/purchase-orders")
def get_vendor_purchase_orders(
    vendor_id: int,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all Purchase Orders assigned to a specific vendor with items, delivery, and invoice details.
    Strictly linked by vendor_id.
    """
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    from app.models.purchase_order import PurchaseOrder
    from sqlalchemy.orm import joinedload

    query = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.vendor),
        joinedload(PurchaseOrder.procurement_request),
        joinedload(PurchaseOrder.items),
        joinedload(PurchaseOrder.deliveries),
        joinedload(PurchaseOrder.invoices)
    ).filter(PurchaseOrder.vendor_id == vendor_id)

    if status_filter and status_filter.lower() != "all":
        s = status_filter.strip().lower()
        if s in ["pending", "pending acceptance", "issued"]:
            query = query.filter(PurchaseOrder.status.in_(["Issued", "Draft", "Pending Acceptance"]))
        elif s == "dispatched":
            query = query.filter(PurchaseOrder.status.in_(["Dispatched", "In Transit"]))
        elif s in ["delivered", "delivery confirmed", "completed"]:
            query = query.filter(PurchaseOrder.status.in_(["Delivered", "Completed", "Delivery Confirmed"]))
        else:
            query = query.filter(PurchaseOrder.status.ilike(status_filter.strip()))

    pos = query.order_by(PurchaseOrder.id.desc()).all()
    result = []
    for po in pos:
        delivery = po.deliveries[-1] if po.deliveries else None
        invoice = po.invoices[-1] if po.invoices else None
        v_name = po.vendor.name if po.vendor else vendor.name
        v_comp = po.vendor.company if (po.vendor and po.vendor.company) else vendor.company or v_name
        result.append({
            "id": po.id,
            "po_number": po.po_number,
            "procurement_request_id": po.procurement_request_id,
            "requisition_number": po.procurement_request.request_number if po.procurement_request else "N/A",
            "requirement_title": po.procurement_request.title if po.procurement_request else None,
            "department": po.procurement_request.department if po.procurement_request else "N/A",
            "vendor_id": po.vendor_id,
            "vendor_name": v_name,
            "vendor_company": v_comp,
            "vendor": {
                "id": vendor.id,
                "name": v_name,
                "company": v_comp,
                "category": vendor.category
            },
            "total_amount": po.total_amount,
            "currency": po.currency or "USD",
            "status": po.status,
            "blockchain_status": getattr(po, "blockchain_status", "CONFIRMED"),
            "created_at": po.created_at,
            "issued_at": po.issued_at,
            "vendor_accepted_at": po.vendor_accepted_at,
            "vendor_rejection_reason": po.vendor_rejection_reason,
            "dispatch_date": po.dispatch_date,
            "carrier": po.carrier,
            "tracking_number": po.tracking_number,
            "expected_delivery_date": po.expected_delivery_date,
            "actual_delivery_date": po.actual_delivery_date,
            "terms_and_conditions": po.terms_and_conditions,
            "shipping_address": po.shipping_address,
            "notes": po.notes,
            "items": [
                {
                    "id": item.id,
                    "item_name": item.item_name,
                    "description": item.description,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "total_price": item.total_price,
                    "sku": item.sku
                }
                for item in po.items
            ] if po.items else [],
            "delivery": {
                "delivered_quantity": delivery.delivered_quantity if delivery else None,
                "ordered_quantity": delivery.ordered_quantity if delivery else None,
                "delay_days": delivery.delay_days if delivery else 0,
                "delivery_status": delivery.delivery_status if delivery else None,
                "carrier": delivery.carrier if delivery else None,
                "tracking_number": delivery.tracking_number if delivery else None,
                "notes": delivery.notes if delivery else None
            } if delivery else None,
            "invoice": {
                "id": invoice.id if invoice else None,
                "invoice_number": invoice.invoice_number if invoice else None,
                "status": invoice.status if invoice else None,
                "three_way_match_status": invoice.three_way_match_status if invoice else None
            } if invoice else None
        })
    return result

@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Administrator"]))
):
    """
    Section 7: Do not permanently delete vendors that have historical transactions.
    Historical procurement, delivery, invoice, and payment records must remain available.
    """
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    from app.models.purchase_order import PurchaseOrder
    from app.models.procurement import ProcurementRequest
    from app.models.invoice import Invoice

    has_pos = db.query(PurchaseOrder).filter(PurchaseOrder.vendor_id == vendor_id).count() > 0
    has_prs = db.query(ProcurementRequest).filter(ProcurementRequest.assigned_vendor_id == vendor_id).count() > 0
    has_invs = db.query(Invoice).filter(Invoice.vendor_id == vendor_id).count() > 0

    if has_pos or has_prs or has_invs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot permanently delete vendor with historical transactions. Historical procurement, delivery, invoice, and payment records must remain available. You can change status to 'INACTIVE' or 'SUSPENDED'."
        )

    db.delete(vendor)
    db.commit()
    return None

