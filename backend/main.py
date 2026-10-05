from datetime import date

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db

from models import (
    User,
    Vendor,
    Supplier,
    PurchaseOrder,
    Communication,
)

from schemas import (
    UserRegister,
    UserLogin,
    UserResponse,
    TokenResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserAdminCreate,
    UserAdminUpdate,
    VendorCreate,
    VendorUpdate,
    VendorResponse,
    SupplierCreate,
    SupplierAdminCreate,
    SupplierUpdate,
    SupplierResponse,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    PurchaseOrderResponse,
    CommunicationCreate,
    CommunicationUpdate,
    CommunicationResponse,
)

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_role,
)

from procurement_routes import router as procurement_router
from contract_compliance import router as contract_compliance_router
from vendor_routes import router as vendor_router
from performance_routes import router as performance_router
from analytics_routes import router as analytics_router
from notification_routes import router as notification_router
from reports_routes import router as reports_router
from invoice_routes import router as invoice_router
from payment_routes import router as payment_router


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="VRIPRM API",
    description="Vendor Reliability Intelligence & Procurement Risk Management API",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROOT / HEALTH
# ============================================================

@app.get("/")
def root():
    return {
        "message": "VRIPRM Backend is running",
        "status": "success",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "VRIPRM Backend",
    }


# ============================================================
# AUTHENTICATION
# ============================================================

@app.post("/register", response_model=UserResponse)
def register(
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    # Only vendor and supplier can self-register.
    if user_data.role not in ["vendor", "supplier"]:
        raise HTTPException(
            status_code=400,
            detail="Only vendor or supplier registration is allowed",
        )

    # Self-registered accounts remain inactive
    # until an administrator approves them.
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        is_active=False,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create pending vendor profile.
    if user_data.role == "vendor":
        vendor = Vendor(
            user_id=new_user.id,
            company_name=user_data.name,
            contact_person=user_data.name,
            email=user_data.email,
            vendor_status="inactive",
            approval_status="pending",
            reliability_score=0.00,
        )

        db.add(vendor)
        db.commit()

    # Create pending supplier profile.
    elif user_data.role == "supplier":
        supplier = Supplier(
            user_id=new_user.id,
            company_name=user_data.name,
            contact_person=user_data.name,
            email=user_data.email,
            supplier_status="inactive",
            approval_status="pending",
        )

        db.add(supplier)
        db.commit()

    return new_user


@app.post("/login", response_model=TokenResponse)
def login(
    login_data: UserLogin,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == login_data.email)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not verify_password(
        login_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    # ========================================================
    # SUPPLIER APPROVAL CHECK
    # ========================================================

    if user.role == "supplier":
        supplier = (
            db.query(Supplier)
            .filter(Supplier.user_id == user.id)
            .first()
        )

        if supplier is None:
            raise HTTPException(
                status_code=403,
                detail="Supplier profile not found",
            )

        if supplier.approval_status == "pending":
            raise HTTPException(
                status_code=403,
                detail="Supplier account is pending admin approval",
            )

        if supplier.approval_status == "rejected":
            raise HTTPException(
                status_code=403,
                detail="Supplier registration was rejected by admin",
            )

        if supplier.supplier_status != "active":
            raise HTTPException(
                status_code=403,
                detail="Supplier account is inactive",
            )

    # ========================================================
    # VENDOR APPROVAL CHECK
    # ========================================================

    if user.role == "vendor":
        vendor = (
            db.query(Vendor)
            .filter(Vendor.user_id == user.id)
            .first()
        )

        if vendor is None:
            raise HTTPException(
                status_code=403,
                detail="Vendor profile not found",
            )

        if vendor.approval_status == "pending":
            raise HTTPException(
                status_code=403,
                detail="Vendor account is pending admin approval",
            )

        if vendor.approval_status == "rejected":
            raise HTTPException(
                status_code=403,
                detail="Vendor registration was rejected by admin",
            )

        if vendor.vendor_status != "active":
            raise HTTPException(
                status_code=403,
                detail="Vendor account is inactive",
            )

    # ========================================================
    # GENERAL ACTIVE USER CHECK
    # ========================================================

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive",
        )

    token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role,
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
    }


@app.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="Email address not registered",
        )

    return {
        "message": "Password reset request received successfully."
    }


@app.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    return {
        "message": "Password reset functionality is ready for implementation."
    }


@app.get("/me")
def me(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }


# ============================================================
# ROLE TEST ROUTES
# ============================================================

@app.get("/admin/test")
def admin_test(
    current_user: User = Depends(
        require_role("administrator")
    ),
):
    return {
        "message": "Administrator access granted",
        "user": current_user.name,
        "role": current_user.role,
    }


@app.get("/procurement/test")
def procurement_test(
    current_user: User = Depends(
        require_role("procurement_manager")
    ),
):
    return {
        "message": "Procurement Manager access granted",
        "user": current_user.name,
        "role": current_user.role,
    }


@app.get("/supply-chain/test")
def supply_chain_test(
    current_user: User = Depends(
        require_role("supply_chain_manager")
    ),
):
    return {
        "message": "Supply Chain Manager access granted",
        "user": current_user.name,
        "role": current_user.role,
    }


@app.get("/vendor/test")
def vendor_test(
    current_user: User = Depends(
        require_role("vendor")
    ),
):
    return {
        "message": "Vendor access granted",
        "user": current_user.name,
        "role": current_user.role,
    }


@app.get("/supplier/test")
def supplier_test(
    current_user: User = Depends(
        require_role("supplier")
    ),
):
    return {
        "message": "Supplier access granted",
        "user": current_user.name,
        "role": current_user.role,
    }


@app.get("/finance/test")
def finance_test(
    current_user: User = Depends(
        require_role("finance_officer")
    ),
):
    return {
        "message": "Finance Officer access granted",
        "user": current_user.name,
        "role": current_user.role,
    }


@app.get("/auditor/test")
def auditor_test(
    current_user: User = Depends(
        require_role("auditor")
    ),
):
    return {
        "message": "Auditor access granted",
        "user": current_user.name,
        "role": current_user.role,
    }


# ============================================================
# USER MANAGEMENT
# ============================================================

@app.get(
    "/users",
    response_model=list[UserResponse],
)
def get_users(
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    return (
        db.query(User)
        .order_by(User.id.desc())
        .all()
    )


@app.get(
    "/users/{user_id}",
    response_model=UserResponse,
)
def get_user(
    user_id: int,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user


@app.post(
    "/users",
    response_model=UserResponse,
)
def create_user(
    user_data: UserAdminCreate,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        is_active=user_data.is_active,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@app.put(
    "/users/{user_id}",
    response_model=UserResponse,
)
def update_user(
    user_id: int,
    user_data: UserAdminUpdate,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    data = user_data.model_dump(
        exclude_unset=True
    )

    if "password" in data:
        data["password_hash"] = hash_password(
            data.pop("password")
        )

    for field, value in data.items():
        if hasattr(user, field):
            setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


@app.put(
    "/users/{user_id}/activate",
    response_model=UserResponse,
)
def activate_user(
    user_id: int,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    user.is_active = True

    db.commit()
    db.refresh(user)

    return user


@app.put(
    "/users/{user_id}/deactivate",
    response_model=UserResponse,
)
def deactivate_user(
    user_id: int,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    user.is_active = False

    db.commit()
    db.refresh(user)

    return user


@app.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    db.query(Vendor).filter(
        Vendor.user_id == user_id
    ).update(
        {"user_id": None},
        synchronize_session=False,
    )

    db.query(Supplier).filter(
        Supplier.user_id == user_id
    ).update(
        {"user_id": None},
        synchronize_session=False,
    )

    db.delete(user)
    db.commit()

    return {
        "message": "User deleted successfully",
        "user_id": user_id,
    }


# ============================================================
# SUPPLIER MANAGEMENT
# ============================================================

@app.get(
    "/suppliers",
    response_model=list[SupplierResponse],
)
def get_suppliers(
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
            "finance_officer",
            "auditor",
        )
    ),
    db: Session = Depends(get_db),
):
    return (
        db.query(Supplier)
        .order_by(Supplier.id.desc())
        .all()
    )


@app.get(
    "/suppliers/{supplier_id}",
    response_model=SupplierResponse,
)
def get_supplier(
    supplier_id: int,
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
            "finance_officer",
            "auditor",
        )
    ),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id)
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    return supplier


@app.get(
    "/supplier/profile",
    response_model=SupplierResponse,
)
def get_my_supplier_profile(
    current_user: User = Depends(
        require_role("supplier")
    ),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.user_id == current_user.id)
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier profile not found",
        )

    return supplier


@app.post(
    "/suppliers",
    response_model=SupplierResponse,
)
def create_supplier(
    supplier_data: SupplierAdminCreate,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(User)
        .filter(User.email == supplier_data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    # Create the supplier's login account.
    new_user = User(
        name=(
            supplier_data.contact_person
            or supplier_data.company_name
        ),
        email=supplier_data.email,
        password_hash=hash_password(
            supplier_data.password
        ),
        role="supplier",
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create the supplier profile and link it
    # to the newly created user.
    supplier = Supplier(
        user_id=new_user.id,
        company_name=supplier_data.company_name,
        contact_person=supplier_data.contact_person,
        email=supplier_data.email,
        phone=supplier_data.phone,
        address=supplier_data.address,
        category=supplier_data.category,
        supplier_status="active",
        approval_status="approved",
    )

    db.add(supplier)
    db.commit()
    db.refresh(supplier)

    return supplier


@app.put(
    "/suppliers/{supplier_id}/approve",
    response_model=SupplierResponse,
)
def approve_supplier(
    supplier_id: int,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id)
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    supplier.approval_status = "approved"
    supplier.supplier_status = "active"

    if supplier.user_id is not None:
        user = (
            db.query(User)
            .filter(User.id == supplier.user_id)
            .first()
        )

        if user:
            user.is_active = True

    db.commit()
    db.refresh(supplier)

    return supplier


@app.put(
    "/suppliers/{supplier_id}/reject",
    response_model=SupplierResponse,
)
def reject_supplier(
    supplier_id: int,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id)
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    supplier.approval_status = "rejected"
    supplier.supplier_status = "inactive"

    if supplier.user_id is not None:
        user = (
            db.query(User)
            .filter(User.id == supplier.user_id)
            .first()
        )

        if user:
            user.is_active = False

    db.commit()
    db.refresh(supplier)

    return supplier


@app.put(
    "/suppliers/{supplier_id}",
    response_model=SupplierResponse,
)
def update_supplier(
    supplier_id: int,
    supplier_data: SupplierUpdate,
    current_user: User = Depends(
        require_role(
            "administrator",
            "supply_chain_manager",
        )
    ),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id)
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    data = supplier_data.model_dump(
        exclude_unset=True
    )

    for field, value in data.items():
        setattr(supplier, field, value)

    db.commit()
    db.refresh(supplier)

    return supplier


@app.put(
    "/suppliers/{supplier_id}/activate",
    response_model=SupplierResponse,
)
def activate_supplier(
    supplier_id: int,
    current_user: User = Depends(
        require_role(
            "administrator",
            "supply_chain_manager",
        )
    ),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id)
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    if supplier.approval_status != "approved":
        raise HTTPException(
            status_code=400,
            detail="Supplier must be approved before activation",
        )

    supplier.supplier_status = "active"

    if supplier.user_id is not None:
        user = (
            db.query(User)
            .filter(User.id == supplier.user_id)
            .first()
        )

        if user:
            user.is_active = True

    db.commit()
    db.refresh(supplier)

    return supplier


@app.put(
    "/suppliers/{supplier_id}/deactivate",
    response_model=SupplierResponse,
)
def deactivate_supplier(
    supplier_id: int,
    current_user: User = Depends(
        require_role(
            "administrator",
            "supply_chain_manager",
        )
    ),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id)
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    supplier.supplier_status = "inactive"

    if supplier.user_id is not None:
        user = (
            db.query(User)
            .filter(User.id == supplier.user_id)
            .first()
        )

        if user:
            user.is_active = False

    db.commit()
    db.refresh(supplier)

    return supplier


@app.delete("/suppliers/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    current_user: User = Depends(
        require_role("administrator")
    ),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id)
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier not found",
        )

    linked_po = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.supplier_id == supplier_id
        )
        .first()
    )

    if linked_po:
        raise HTTPException(
            status_code=400,
            detail="Supplier cannot be deleted because purchase orders are linked to it",
        )

    linked_user_id = supplier.user_id

    db.delete(supplier)

    if linked_user_id is not None:
        linked_user = (
            db.query(User)
            .filter(User.id == linked_user_id)
            .first()
        )

        if linked_user and linked_user.role == "supplier":
            db.delete(linked_user)

    db.commit()

    return {
        "message": "Supplier deleted successfully",
        "supplier_id": supplier_id,
    }


# ============================================================
# PURCHASE ORDERS
# ============================================================

@app.get(
    "/purchase-orders",
    response_model=list[PurchaseOrderResponse],
)
def get_purchase_orders(
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
            "finance_officer",
            "auditor",
        )
    ),
    db: Session = Depends(get_db),
):
    return (
        db.query(PurchaseOrder)
        .order_by(PurchaseOrder.id.desc())
        .all()
    )


@app.get(
    "/vendor/purchase-orders",
    response_model=list[PurchaseOrderResponse],
)
def get_vendor_purchase_orders(
    current_user: User = Depends(
        require_role("vendor")
    ),
    db: Session = Depends(get_db),
):
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

    return (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.vendor_id == vendor.id
        )
        .order_by(PurchaseOrder.id.desc())
        .all()
    )


@app.get(
    "/supplier/purchase-orders",
    response_model=list[PurchaseOrderResponse],
)
def get_supplier_purchase_orders(
    current_user: User = Depends(
        require_role("supplier")
    ),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.user_id == current_user.id)
        .first()
    )

    if supplier is None:
        raise HTTPException(
            status_code=404,
            detail="Supplier profile not found",
        )

    return (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.supplier_id == supplier.id
        )
        .order_by(PurchaseOrder.id.desc())
        .all()
    )


@app.get(
    "/purchase-orders/{purchase_order_id}",
    response_model=PurchaseOrderResponse,
)
def get_purchase_order(
    purchase_order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == purchase_order_id)
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    # Vendor can only access its own POs.
    if current_user.role == "vendor":
        vendor = (
            db.query(Vendor)
            .filter(Vendor.user_id == current_user.id)
            .first()
        )

        if vendor is None or order.vendor_id != vendor.id:
            raise HTTPException(
                status_code=403,
                detail="You can only access your own purchase orders",
            )

    # Supplier can only access its own POs.
    elif current_user.role == "supplier":
        supplier = (
            db.query(Supplier)
            .filter(Supplier.user_id == current_user.id)
            .first()
        )

        if supplier is None or order.supplier_id != supplier.id:
            raise HTTPException(
                status_code=403,
                detail="You can only access your own purchase orders",
            )

    return order


@app.post(
    "/purchase-orders",
    response_model=PurchaseOrderResponse,
)
def create_purchase_order(
    order_data: PurchaseOrderCreate,
    current_user: User = Depends(
        require_role("procurement_manager")
    ),
    db: Session = Depends(get_db),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == order_data.vendor_id)
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
            detail="Vendor is not approved",
        )

    if vendor.vendor_status != "active":
        raise HTTPException(
            status_code=400,
            detail="Vendor is not active",
        )

    # Optional supplier validation.
    if order_data.supplier_id is not None:
        supplier = (
            db.query(Supplier)
            .filter(
                Supplier.id == order_data.supplier_id
            )
            .first()
        )

        if supplier is None:
            raise HTTPException(
                status_code=404,
                detail="Supplier not found",
            )

        if supplier.approval_status != "approved":
            raise HTTPException(
                status_code=400,
                detail="Supplier is not approved",
            )

        if supplier.supplier_status != "active":
            raise HTTPException(
                status_code=400,
                detail="Supplier is not active",
            )

    existing_order = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.order_number
            == order_data.order_number
        )
        .first()
    )

    if existing_order:
        raise HTTPException(
            status_code=400,
            detail="Order number already exists",
        )

    order = PurchaseOrder(
        vendor_id=order_data.vendor_id,
        supplier_id=order_data.supplier_id,
        order_number=order_data.order_number,
        order_date=order_data.order_date,
        expected_delivery_date=order_data.expected_delivery_date,
        total_amount=order_data.total_amount,
        status="pending",
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    return order


@app.put(
    "/purchase-orders/{purchase_order_id}",
    response_model=PurchaseOrderResponse,
)
def update_purchase_order(
    purchase_order_id: int,
    order_data: PurchaseOrderUpdate,
    current_user: User = Depends(
        require_role("procurement_manager")
    ),
    db: Session = Depends(get_db),
):
    order = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == purchase_order_id)
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    if order.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Only pending purchase orders can be edited",
        )

    data = order_data.model_dump(
        exclude_unset=True
    )

    data.pop("status", None)

    for field, value in data.items():
        setattr(order, field, value)

    db.commit()
    db.refresh(order)

    return order


# ============================================================
# PURCHASE ORDER SHIPPING
# ============================================================

@app.put(
    "/purchase-orders/{purchase_order_id}/ship",
    response_model=PurchaseOrderResponse,
)
def ship_purchase_order(
    purchase_order_id: int,
    current_user: User = Depends(
        require_role("supply_chain_manager")
    ),
    db: Session = Depends(get_db),
):
    order = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == purchase_order_id)
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    if order.status != "accepted":
        raise HTTPException(
            status_code=400,
            detail="Only accepted purchase orders can be shipped",
        )

    order.status = "shipped"

    db.commit()
    db.refresh(order)

    return order


@app.put(
    "/purchase-orders/{purchase_order_id}/deliver",
    response_model=PurchaseOrderResponse,
)
def deliver_purchase_order(
    purchase_order_id: int,
    current_user: User = Depends(
        require_role("supply_chain_manager")
    ),
    db: Session = Depends(get_db),
):
    order = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == purchase_order_id)
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    if order.status != "shipped":
        raise HTTPException(
            status_code=400,
            detail="Only shipped purchase orders can be delivered",
        )

    order.status = "delivered"
    order.actual_delivery_date = date.today()

    db.commit()
    db.refresh(order)

    return order


@app.put(
    "/purchase-orders/{purchase_order_id}/cancel",
    response_model=PurchaseOrderResponse,
)
def cancel_purchase_order(
    purchase_order_id: int,
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
        )
    ),
    db: Session = Depends(get_db),
):
    order = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == purchase_order_id)
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    if order.status in [
        "delivered",
        "cancelled",
    ]:
        raise HTTPException(
            status_code=400,
            detail="This purchase order cannot be cancelled",
        )

    order.status = "cancelled"

    db.commit()
    db.refresh(order)

    return order


# ============================================================
# COMMUNICATION MANAGEMENT
# ============================================================

@app.get(
    "/communications",
    response_model=list[CommunicationResponse],
)
def get_communications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed_roles = [
        "administrator",
        "procurement_manager",
        "supply_chain_manager",
        "vendor",
        "supplier",
        "finance_officer",
        "auditor",
    ]

    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view communications",
        )

    # Vendor and supplier can only see their own conversations.
    if current_user.role in ["vendor", "supplier"]:
        messages = (
            db.query(Communication)
            .filter(
                or_(
                    Communication.sender_id
                    == current_user.id,
                    Communication.receiver_id
                    == current_user.id,
                )
            )
            .order_by(
                Communication.created_at.desc()
            )
            .all()
        )

    else:
        messages = (
            db.query(Communication)
            .order_by(
                Communication.created_at.desc()
            )
            .all()
        )

    return messages


@app.post(
    "/communications",
    response_model=CommunicationResponse,
)
def create_communication(
    communication: CommunicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    receiver = (
        db.query(User)
        .filter(
            User.id == communication.receiver_id
        )
        .first()
    )

    if receiver is None:
        raise HTTPException(
            status_code=404,
            detail="Receiver not found",
        )

    if not receiver.is_active:
        raise HTTPException(
            status_code=400,
            detail="Receiver account is inactive",
        )

    if communication.vendor_id is not None:
        vendor = (
            db.query(Vendor)
            .filter(
                Vendor.id == communication.vendor_id
            )
            .first()
        )

        if vendor is None:
            raise HTTPException(
                status_code=404,
                detail="Vendor not found",
            )

    new_message = Communication(
        sender_id=current_user.id,
        receiver_id=communication.receiver_id,
        vendor_id=communication.vendor_id,
        subject=communication.subject,
        message=communication.message,
        attachment=communication.attachment,
        status="sent",
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return new_message


@app.get(
    "/communications/inbox",
    response_model=list[CommunicationResponse],
)
def get_inbox(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    messages = (
        db.query(Communication)
        .filter(
            Communication.receiver_id
            == current_user.id
        )
        .order_by(
            Communication.created_at.desc()
        )
        .all()
    )

    return messages


@app.get(
    "/communications/sent",
    response_model=list[CommunicationResponse],
)
def get_sent_messages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    messages = (
        db.query(Communication)
        .filter(
            Communication.sender_id
            == current_user.id
        )
        .order_by(
            Communication.created_at.desc()
        )
        .all()
    )

    return messages


@app.get(
    "/communications/{communication_id}",
    response_model=CommunicationResponse,
)
def get_communication(
    communication_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    communication = (
        db.query(Communication)
        .filter(
            Communication.id == communication_id
        )
        .first()
    )

    if communication is None:
        raise HTTPException(
            status_code=404,
            detail="Communication not found",
        )

    privileged_roles = [
        "administrator",
        "procurement_manager",
        "supply_chain_manager",
        "finance_officer",
        "auditor",
    ]

    if current_user.role not in privileged_roles:
        if (
            communication.sender_id != current_user.id
            and communication.receiver_id
            != current_user.id
        ):
            raise HTTPException(
                status_code=403,
                detail="You are not authorized to view this communication",
            )

    return communication


@app.put(
    "/communications/{communication_id}/read",
    response_model=CommunicationResponse,
)
def mark_communication_read(
    communication_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    communication = (
        db.query(Communication)
        .filter(
            Communication.id == communication_id
        )
        .first()
    )

    if communication is None:
        raise HTTPException(
            status_code=404,
            detail="Communication not found",
        )

    if communication.receiver_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the receiver can mark this message as read",
        )

    communication.status = "read"

    db.commit()
    db.refresh(communication)

    return communication


@app.put(
    "/communications/{communication_id}",
    response_model=CommunicationResponse,
)
def update_communication(
    communication_id: int,
    communication_data: CommunicationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    communication = (
        db.query(Communication)
        .filter(
            Communication.id == communication_id
        )
        .first()
    )

    if communication is None:
        raise HTTPException(
            status_code=404,
            detail="Communication not found",
        )

    if communication.sender_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the sender can update this communication",
        )

    data = communication_data.model_dump(
        exclude_unset=True
    )

    data.pop("status", None)

    for field, value in data.items():
        setattr(communication, field, value)

    db.commit()
    db.refresh(communication)

    return communication


@app.delete(
    "/communications/{communication_id}"
)
def delete_communication(
    communication_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    communication = (
        db.query(Communication)
        .filter(
            Communication.id == communication_id
        )
        .first()
    )

    if communication is None:
        raise HTTPException(
            status_code=404,
            detail="Communication not found",
        )

    if (
        communication.sender_id != current_user.id
        and current_user.role != "administrator"
    ):
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to delete this communication",
        )

    db.delete(communication)
    db.commit()

    return {
        "message": "Communication deleted successfully",
        "communication_id": communication_id,
    }


# ============================================================
# ROUTERS
# ============================================================

app.include_router(vendor_router)
app.include_router(procurement_router)
app.include_router(contract_compliance_router)
app.include_router(performance_router)
app.include_router(analytics_router)
app.include_router(notification_router)
app.include_router(reports_router)
app.include_router(invoice_router)
app.include_router(payment_router)