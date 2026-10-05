from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Vendor, User, PurchaseOrder
from auth import get_current_user, require_role, hash_password

from notification_service import notify_user, notify_role, notify_roles


router = APIRouter(
    prefix="/vendors",
    tags=["Vendor Management"],
)


# ============================================================
# GET ALL VENDORS
# ============================================================
@router.get("")
def get_vendors(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vendors = (
        db.query(Vendor)
        .order_by(Vendor.id.desc())
        .all()
    )

    return [
        {
            "id": vendor.id,
            "user_id": vendor.user_id,
            "requested_by": vendor.requested_by,
            "company_name": vendor.company_name,
            "category": vendor.category,
            "contact_person": vendor.contact_person,
            "email": vendor.email,
            "phone": vendor.phone,
            "address": vendor.address,
            "vendor_status": vendor.vendor_status,
            "approval_status": vendor.approval_status,
            "reliability_score": float(
                vendor.reliability_score or 0
            ),
            "created_at": (
                vendor.created_at.isoformat()
                if vendor.created_at
                else None
            ),
        }
        for vendor in vendors
    ]


# ============================================================
# GET MY VENDOR PROFILE
# ============================================================
@router.get("/me")
def get_my_vendor_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "vendor":
        raise HTTPException(
            status_code=403,
            detail="Only vendor users can access this profile",
        )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.user_id == current_user.id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor profile not found",
        )

    return {
        "id": vendor.id,
        "user_id": vendor.user_id,
        "requested_by": vendor.requested_by,
        "company_name": vendor.company_name,
        "category": vendor.category,
        "contact_person": vendor.contact_person,
        "email": vendor.email,
        "phone": vendor.phone,
        "address": vendor.address,
        "vendor_status": vendor.vendor_status,
        "approval_status": vendor.approval_status,
        "reliability_score": float(
            vendor.reliability_score or 0
        ),
        "created_at": (
            vendor.created_at.isoformat()
            if vendor.created_at
            else None
        ),
    }


# ============================================================
# VENDOR PURCHASE ORDERS
# ============================================================
@router.get("/purchase-orders")
def get_vendor_purchase_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Only vendor users can access vendor purchase orders
    if current_user.role != "vendor":
        raise HTTPException(
            status_code=403,
            detail="Only vendor users can access purchase orders",
        )

    # Find vendor profile linked to logged-in user
    vendor = (
        db.query(Vendor)
        .filter(Vendor.user_id == current_user.id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor profile not found",
        )

    # Return only purchase orders belonging to this vendor
    purchase_orders = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.vendor_id == vendor.id)
        .order_by(PurchaseOrder.id.desc())
        .all()
    )

    return [
        {
            "id": po.id,
            "vendor_id": po.vendor_id,
            "supplier_id": po.supplier_id,
            "order_number": po.order_number,
            "order_date": (
                po.order_date.isoformat()
                if po.order_date
                else None
            ),
            "expected_delivery_date": (
                po.expected_delivery_date.isoformat()
                if po.expected_delivery_date
                else None
            ),
            "actual_delivery_date": (
                po.actual_delivery_date.isoformat()
                if po.actual_delivery_date
                else None
            ),
            "total_amount": float(
                po.total_amount or 0
            ),
            "status": po.status,
            "created_at": (
                po.created_at.isoformat()
                if po.created_at
                else None
            ),
        }
        for po in purchase_orders
    ]


# ============================================================
# VENDOR ACCEPT PURCHASE ORDER
# ============================================================
@router.put("/purchase-orders/{po_id}/accept")
def vendor_accept_purchase_order(
    po_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Only vendor users can accept purchase orders
    if current_user.role != "vendor":
        raise HTTPException(
            status_code=403,
            detail="Only vendor users can accept purchase orders",
        )

    # Find vendor linked to logged-in user
    vendor = (
        db.query(Vendor)
        .filter(Vendor.user_id == current_user.id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor profile not found",
        )

    # Find purchase order
    po = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == po_id)
        .first()
    )

    if po is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    # Security check:
    # Vendor can only accept its own purchase order
    if po.vendor_id != vendor.id:
        raise HTTPException(
            status_code=403,
            detail="You can only accept purchase orders assigned to your vendor account",
        )

    # Only pending purchase orders can be accepted
    if po.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only pending purchase orders can be accepted. "
                f"Current status: {po.status}"
            ),
        )

    po.status = "accepted"

    # --------------------------------------------------------
    # NOTIFICATION
    # --------------------------------------------------------
    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
            "supply_chain_manager"
        ],
        "Purchase Order Accepted",
        f"Vendor {vendor.company_name} has accepted purchase order {po.order_number}.",
        "purchase_order"
    )

    db.commit()
    db.refresh(po)

    return {
        "message": "Purchase order accepted successfully",
        "purchase_order": {
            "id": po.id,
            "order_number": po.order_number,
            "status": po.status,
        },
    }


# ============================================================
# VENDOR REJECT PURCHASE ORDER
# ============================================================
@router.put("/purchase-orders/{po_id}/reject")
def vendor_reject_purchase_order(
    po_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Only vendor users can reject purchase orders
    if current_user.role != "vendor":
        raise HTTPException(
            status_code=403,
            detail="Only vendor users can reject purchase orders",
        )

    # Find vendor linked to logged-in user
    vendor = (
        db.query(Vendor)
        .filter(Vendor.user_id == current_user.id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor profile not found",
        )

    # Find purchase order
    po = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == po_id)
        .first()
    )

    if po is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    # Security check:
    # Vendor can only reject its own purchase order
    if po.vendor_id != vendor.id:
        raise HTTPException(
            status_code=403,
            detail="You can only reject purchase orders assigned to your vendor account",
        )

    # Only pending purchase orders can be rejected
    if po.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only pending purchase orders can be rejected. "
                f"Current status: {po.status}"
            ),
        )

    # Rejected PO is stored as cancelled
    po.status = "cancelled"

    # --------------------------------------------------------
    # NOTIFICATION
    # --------------------------------------------------------
    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
            "supply_chain_manager"
        ],
        "Purchase Order Rejected",
        f"Vendor {vendor.company_name} has rejected purchase order {po.order_number}.",
        "purchase_order"
    )

    db.commit()
    db.refresh(po)

    return {
        "message": "Purchase order rejected successfully",
        "purchase_order": {
            "id": po.id,
            "order_number": po.order_number,
            "status": po.status,
        },
    }


# ============================================================
# GET SINGLE VENDOR
# ============================================================
@router.get("/{vendor_id}")
def get_vendor(
    vendor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    # Vendor users can only view their own profile
    if current_user.role == "vendor":
        if vendor.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only access your own vendor profile",
            )

    return {
        "id": vendor.id,
        "user_id": vendor.user_id,
        "requested_by": vendor.requested_by,
        "company_name": vendor.company_name,
        "category": vendor.category,
        "contact_person": vendor.contact_person,
        "email": vendor.email,
        "phone": vendor.phone,
        "address": vendor.address,
        "vendor_status": vendor.vendor_status,
        "approval_status": vendor.approval_status,
        "reliability_score": float(
            vendor.reliability_score or 0
        ),
        "created_at": (
            vendor.created_at.isoformat()
            if vendor.created_at
            else None
        ),
    }


# ============================================================
# CREATE VENDOR
# ADMINISTRATOR ONLY
# ============================================================
@router.post("")
def create_vendor(
    data: dict,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    company_name = str(
        data.get("company_name", "")
    ).strip()

    if not company_name:
        raise HTTPException(
            status_code=400,
            detail="Company name is required",
        )

    category = data.get("category")

    allowed_categories = [
        "Raw Material Suppliers",
        "Equipment Vendors",
        "IT Vendors",
        "Service Providers",
        "Logistics Partners",
        "Maintenance Vendors",
    ]

    if category not in allowed_categories:
        raise HTTPException(
            status_code=400,
            detail="Invalid vendor category",
        )

    email = str(
        data.get("email", "")
    ).strip().lower()

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Email is required for vendor login",
        )

    password = str(
        data.get("password", "")
    )

    if not password:
        raise HTTPException(
            status_code=400,
            detail="Password is required for vendor login",
        )

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email is already registered",
        )

    try:
        new_user = User(
            name=data.get("contact_person") or company_name,
            email=email,
            password_hash=hash_password(password),
            role="vendor",
            is_active=True,
        )

        db.add(new_user)
        db.flush()

        vendor = Vendor(
            user_id=new_user.id,
            company_name=company_name,
            category=category,
            contact_person=data.get("contact_person"),
            email=email,
            phone=data.get("phone"),
            address=data.get("address"),
            requested_by=current_user.id,
            vendor_status="active",
            approval_status="pending",
            reliability_score=0.00,
        )

        db.add(vendor)

        # ----------------------------------------------------
        # NOTIFICATION
        # ----------------------------------------------------
        notify_roles(
            db,
            [
                "administrator",
                "procurement_manager"
            ],
            "New Vendor Registered",
            f"Vendor {company_name} has been registered and is awaiting approval.",
            "vendor"
        )

        db.commit()

        db.refresh(new_user)
        db.refresh(vendor)

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Unable to create vendor: {str(exc)}",
        )

    return {
        "message": "Vendor created successfully",
        "vendor": {
            "id": vendor.id,
            "user_id": vendor.user_id,
            "company_name": vendor.company_name,
            "category": vendor.category,
            "email": vendor.email,
            "approval_status": vendor.approval_status,
            "vendor_status": vendor.vendor_status,
            "reliability_score": float(
                vendor.reliability_score or 0
            ),
        },
    }


# ============================================================
# UPDATE VENDOR
# ADMINISTRATOR ONLY
# ============================================================
@router.put("/{vendor_id}")
def update_vendor(
    vendor_id: int,
    data: dict,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    if "company_name" in data:
        company_name = str(
            data["company_name"]
        ).strip()

        if not company_name:
            raise HTTPException(
                status_code=400,
                detail="Company name cannot be empty",
            )

        vendor.company_name = company_name

    if "category" in data:
        allowed_categories = [
            "Raw Material Suppliers",
            "Equipment Vendors",
            "IT Vendors",
            "Service Providers",
            "Logistics Partners",
            "Maintenance Vendors",
        ]

        if data["category"] not in allowed_categories:
            raise HTTPException(
                status_code=400,
                detail="Invalid vendor category",
            )

        vendor.category = data["category"]

    if "contact_person" in data:
        vendor.contact_person = data["contact_person"]

    if "email" in data:
        new_email = (
            str(data["email"]).strip().lower()
            if data["email"]
            else None
        )

        if new_email and new_email != vendor.email:
            existing_user = (
                db.query(User)
                .filter(
                    User.email == new_email,
                    User.id != vendor.user_id,
                )
                .first()
            )

            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="Email is already registered",
                )

            vendor.email = new_email

            if vendor.user_id:
                linked_user = (
                    db.query(User)
                    .filter(
                        User.id == vendor.user_id
                    )
                    .first()
                )

                if linked_user:
                    linked_user.email = new_email

    if "phone" in data:
        vendor.phone = data["phone"]

    if "address" in data:
        vendor.address = data["address"]

    try:
        db.commit()
        db.refresh(vendor)

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Unable to update vendor: {str(exc)}",
        )

    return {
        "message": "Vendor updated successfully",
        "vendor": {
            "id": vendor.id,
            "user_id": vendor.user_id,
            "company_name": vendor.company_name,
            "category": vendor.category,
            "contact_person": vendor.contact_person,
            "email": vendor.email,
            "phone": vendor.phone,
            "address": vendor.address,
            "vendor_status": vendor.vendor_status,
            "approval_status": vendor.approval_status,
            "reliability_score": float(
                vendor.reliability_score or 0
            ),
        },
    }


# ============================================================
# APPROVE VENDOR
# ============================================================
@router.put("/{vendor_id}/approve")
def approve_vendor(
    vendor_id: int,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    if vendor.approval_status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Only pending vendors can be approved",
        )

    vendor.approval_status = "approved"
    vendor.vendor_status = "active"

    # --------------------------------------------------------
    # NOTIFICATION
    # --------------------------------------------------------
    if vendor.user_id:
        notify_user(
            db,
            vendor.user_id,
            "Vendor Approved",
            f"Your vendor account for {vendor.company_name} has been approved.",
            "vendor"
        )

    notify_role(
        db,
        "procurement_manager",
        "Vendor Approved",
        f"Vendor {vendor.company_name} has been approved and is now active.",
        "vendor"
    )

    db.commit()
    db.refresh(vendor)

    return {
        "message": "Vendor approved successfully",
        "vendor": vendor,
    }


# ============================================================
# REJECT VENDOR
# ============================================================
@router.put("/{vendor_id}/reject")
def reject_vendor(
    vendor_id: int,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    if vendor.approval_status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Only pending vendors can be rejected",
        )

    vendor.approval_status = "rejected"
    vendor.vendor_status = "inactive"

    # --------------------------------------------------------
    # NOTIFICATION
    # --------------------------------------------------------
    if vendor.user_id:
        notify_user(
            db,
            vendor.user_id,
            "Vendor Application Rejected",
            f"Your vendor application for {vendor.company_name} has been rejected.",
            "vendor"
        )

    notify_role(
        db,
        "procurement_manager",
        "Vendor Rejected",
        f"Vendor {vendor.company_name} has been rejected.",
        "vendor"
    )

    db.commit()
    db.refresh(vendor)

    return {
        "message": "Vendor rejected successfully",
        "vendor": vendor,
    }


# ============================================================
# ACTIVATE VENDOR
# ============================================================
@router.put("/{vendor_id}/activate")
def activate_vendor(
    vendor_id: int,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    if vendor.approval_status != "approved":
        raise HTTPException(
            status_code=400,
            detail="Only approved vendors can be activated",
        )

    vendor.vendor_status = "active"

    if vendor.user_id:
        linked_user = (
            db.query(User)
            .filter(User.id == vendor.user_id)
            .first()
        )

        if linked_user:
            linked_user.is_active = True

    # --------------------------------------------------------
    # NOTIFICATION
    # --------------------------------------------------------
    if vendor.user_id:
        notify_user(
            db,
            vendor.user_id,
            "Vendor Account Activated",
            f"Your vendor account for {vendor.company_name} has been activated.",
            "vendor"
        )

    notify_role(
        db,
        "procurement_manager",
        "Vendor Activated",
        f"Vendor {vendor.company_name} has been activated.",
        "vendor"
    )

    db.commit()
    db.refresh(vendor)

    return {
        "message": "Vendor activated successfully",
        "vendor": vendor,
    }


# ============================================================
# DEACTIVATE VENDOR
# ============================================================
@router.put("/{vendor_id}/deactivate")
def deactivate_vendor(
    vendor_id: int,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    vendor.vendor_status = "inactive"

    if vendor.user_id:
        linked_user = (
            db.query(User)
            .filter(User.id == vendor.user_id)
            .first()
        )

        if linked_user:
            linked_user.is_active = False

    # --------------------------------------------------------
    # NOTIFICATION
    # --------------------------------------------------------
    if vendor.user_id:
        notify_user(
            db,
            vendor.user_id,
            "Vendor Account Deactivated",
            f"Your vendor account for {vendor.company_name} has been deactivated.",
            "vendor"
        )

    notify_roles(
        db,
        [
            "procurement_manager",
            "administrator"
        ],
        "Vendor Deactivated",
        f"Vendor {vendor.company_name} has been deactivated.",
        "vendor"
    )

    db.commit()
    db.refresh(vendor)

    return {
        "message": "Vendor deactivated successfully",
        "vendor": vendor,
    }


# ============================================================
# DELETE VENDOR
# ADMINISTRATOR ONLY
# ============================================================
@router.delete("/{vendor_id}")
def delete_vendor(
    vendor_id: int,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    # --------------------------------------------------------
    # Check Purchase Orders
    # --------------------------------------------------------
    linked_po = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.vendor_id == vendor_id
        )
        .first()
    )

    if linked_po:
        raise HTTPException(
            status_code=400,
            detail=(
                "Vendor cannot be deleted because "
                "purchase orders are linked to it"
            ),
        )

    linked_user_id = vendor.user_id

    try:
        # ----------------------------------------------------
        # Delete Vendor first
        # ----------------------------------------------------
        db.delete(vendor)
        db.flush()

        # ----------------------------------------------------
        # Check if another Vendor uses same User
        # ----------------------------------------------------
        if linked_user_id:
            other_vendor = (
                db.query(Vendor)
                .filter(
                    Vendor.user_id == linked_user_id
                )
                .first()
            )

            # ------------------------------------------------
            # Delete User only when no other Vendor uses it
            # ------------------------------------------------
            if other_vendor is None:
                linked_user = (
                    db.query(User)
                    .filter(
                        User.id == linked_user_id
                    )
                    .first()
                )

                if linked_user:
                    db.delete(linked_user)

        db.commit()

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Unable to delete vendor: {str(exc)}",
        )

    return {
        "message": "Vendor deleted successfully",
        "vendor_id": vendor_id,
    }