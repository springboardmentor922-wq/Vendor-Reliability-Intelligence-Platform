
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel

from datetime import datetime

from database import engine, Base, SessionLocal
import models
from auth import hash_password, verify_password, create_access_token, verify_token

# Subsystem routers
import analytics
import contracts
import notifications
import reports
import communications
import invoices
import audit

from deps import get_db, get_current_user, require_role, log_activity

security = HTTPBearer()

# Create database tables
Base.metadata.create_all(bind=engine)

# Register routers
app.include_router(analytics.router)
app.include_router(contracts.router)
app.include_router(notifications.router)
app.include_router(reports.router)
app.include_router(communications.router)
app.include_router(invoices.router)
app.include_router(audit.router)


# Request & Response models
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "user"
    vendor_id: int | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class VendorCreate(BaseModel):
    company_name: str
    category: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    status: str | None = None


class VendorResponse(BaseModel):
    id: int
    company_name: str
    category: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    status: str

    class Config:
        from_attributes = True


class ProcurementRequestCreate(BaseModel):
    description: str
    quantity: int
    department: str | None = "Information Technology"
    required_date: datetime | None = None


class ProcurementRequestResponse(BaseModel):
    id: int
    requested_by: int
    description: str
    quantity: int
    department: str | None = "Information Technology"
    required_date: datetime | None = None
    status: str

    class Config:
        from_attributes = True


class PurchaseOrderItemCreate(BaseModel):
    product_name: str
    quantity: int = 1
    unit_price: float = 0.0
    tax_percent: float = 18.0
    total_price: float | None = None


class PurchaseOrderItemResponse(BaseModel):
    id: int
    product_name: str
    quantity: int
    unit_price: float
    tax_percent: float
    total_price: float

    class Config:
        from_attributes = True


class PurchaseOrderCreate(BaseModel):
    vendor_id: int
    total_amount: float | None = None
    subtotal: float | None = None
    tax_amount: float | None = None
    expected_delivery: datetime | None = None
    procurement_request_id: int | None = None
    department: str | None = "Information Technology"
    payment_terms: str | None = "Net 30"
    shipping_address: str | None = None
    billing_address: str | None = None
    remarks: str | None = None
    po_number: str | None = None
    items: list[PurchaseOrderItemCreate] | None = None


class PurchaseOrderResponse(BaseModel):
    id: int
    po_number: str | None = None
    vendor_id: int
    created_by: int
    procurement_request_id: int | None = None
    order_date: datetime | None = None
    expected_delivery: datetime | None = None
    department: str | None = "Information Technology"
    payment_terms: str | None = "Net 30"
    shipping_address: str | None = None
    billing_address: str | None = None
    remarks: str | None = None
    subtotal: float | None = 0.0
    tax_amount: float | None = 0.0
    status: str
    total_amount: float
    created_at: datetime | None = None
    items: list[PurchaseOrderItemResponse] | None = []

    class Config:
        from_attributes = True


@app.get("/")
def home():
    return {
        "message": "Vendor Reliability Platform API is running!"
    }


@app.get("/users/me")
def get_current_user_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vendor_name = None
    if current_user.vendor_id:
        v = db.query(models.Vendor).filter(models.Vendor.id == current_user.vendor_id).first()
        if v:
            vendor_name = v.company_name

    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "vendor_id": current_user.vendor_id,
        "vendor_name": vendor_name,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@app.get("/users")
def list_users(
    current_user: models.User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    users = db.query(models.User).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "vendor_id": u.vendor_id,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]

@app.post("/register")
def register(
    user_data: RegisterRequest,
    db: Session = Depends(get_db)
):
    # Check whether email already exists
    existing_user = db.query(models.User).filter(
        models.User.email == user_data.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Hash password
    hashed_password = hash_password(user_data.password)

    # Create new user
    new_user = models.User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hashed_password,
        role=user_data.role
    )

    # Save user
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User registered successfully",
        "user_id": new_user.id,
        "name": new_user.name,
        "email": new_user.email,
        "role": new_user.role
    }

@app.post("/login")
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    # Find user by email
    user = db.query(models.User).filter(
        models.User.email == login_data.email
    ).first()

    # Check user exists
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Check password
    if not verify_password(
        login_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Create JWT token
    access_token = create_access_token({
        "user_id": user.id,
        "role": user.role
    })

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer"
    }
@app.get("/protected")
def protected_route(
    current_user: models.User = Depends(get_current_user)
):
    return {
        "message": "You have access to this protected endpoint!",
        "user_id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role
    }

@app.get("/admin-only")
def admin_only(
    current_user: models.User = Depends(
        require_role(["admin"])
    )
):
    return {
        "message": "Welcome Admin!",
        "user_id": current_user.id,
        "role": current_user.role
    }

@app.get("/procurement-only")
def procurement_only(
    current_user: models.User = Depends(
        require_role(["admin", "procurement"])
    )
):
    return {
        "message": "Welcome to Procurement!",
        "user_id": current_user.id,
        "role": current_user.role
    }

@app.get("/manager-only")
def manager_only(
    current_user: models.User = Depends(
        require_role(["admin", "manager"])
    )
):
    return {
        "message": "Welcome Manager!",
        "user_id": current_user.id,
        "role": current_user.role
    }

@app.get("/user-area")
def user_area(
    current_user: models.User = Depends(get_current_user)
):
    return {
        "message": "Welcome! You are authenticated.",
        "user_id": current_user.id,
        "name": current_user.name,
        "role": current_user.role
    }

@app.get("/vendors", response_model=list[VendorResponse])
def get_vendors(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vendors = db.query(models.Vendor).all()

    return vendors

@app.post("/vendors", response_model=VendorResponse)
def create_vendor(
    vendor_data: VendorCreate,
    current_user: models.User = Depends(
        require_role(["admin", "procurement"])
    ),
    db: Session = Depends(get_db)
):
    new_vendor = models.Vendor(
        company_name=vendor_data.company_name,
        category=vendor_data.category,
        email=vendor_data.email,
        phone=vendor_data.phone,
        address=vendor_data.address,
        status="Pending"
    )

    db.add(new_vendor)
    db.commit()
    db.refresh(new_vendor)

    return new_vendor

@app.put("/vendors/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: int,
    vendor_data: VendorCreate,
    current_user: models.User = Depends(
        require_role(["admin", "procurement"])
    ),
    db: Session = Depends(get_db)
):
    vendor = db.query(models.Vendor).filter(
        models.Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    vendor.company_name = vendor_data.company_name
    vendor.category = vendor_data.category
    vendor.email = vendor_data.email
    vendor.phone = vendor_data.phone
    vendor.address = vendor_data.address

    if vendor_data.status is not None:
        old_status = vendor.status
        vendor.status = vendor_data.status
        # Event trigger: vendor approval workflow notification
        if vendor_data.status in ("Approved", "Rejected") \
                and old_status != vendor_data.status:
            notifications.notify_roles(
                db, ["admin", "procurement", "manager"],
                "Vendor Approval Update",
                f"Vendor '{vendor.company_name}' was {vendor_data.status.lower()} "
                f"by {current_user.name}.",
                "vendor_approval",
            )

    db.commit()
    db.refresh(vendor)

    return vendor

@app.delete("/vendors/{vendor_id}")
def delete_vendor(
    vendor_id: int,
    current_user: models.User = Depends(
        require_role(["admin"])
    ),
    db: Session = Depends(get_db)
):
    vendor = db.query(models.Vendor).filter(
        models.Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    # Delete related child records first to avoid foreign-key
    # constraint violations when the vendor is deleted.
    db.query(models.VendorPerformance).filter(
        models.VendorPerformance.vendor_id == vendor_id
    ).delete(synchronize_session=False)

    db.query(models.Contract).filter(
        models.Contract.vendor_id == vendor_id
    ).delete(synchronize_session=False)

    db.query(models.VendorContact).filter(
        models.VendorContact.vendor_id == vendor_id
    ).delete(synchronize_session=False)

    # Delete purchase orders and their line items
    orders = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.vendor_id == vendor_id
    ).all()

    for order in orders:
        db.query(models.PurchaseOrderItem).filter(
            models.PurchaseOrderItem.purchase_order_id == order.id
        ).delete(synchronize_session=False)

    db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.vendor_id == vendor_id
    ).delete(synchronize_session=False)

    db.delete(vendor)
    db.commit()

    return {
        "message": "Vendor deleted successfully",
        "vendor_id": vendor_id
    }

@app.get(
    "/procurement-requests",
    response_model=list[ProcurementRequestResponse]
)
def get_procurement_requests(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    requests = db.query(
        models.ProcurementRequest
    ).all()

    return requests


@app.post(
    "/procurement-requests",
    response_model=ProcurementRequestResponse
)
def create_procurement_request(
    request_data: ProcurementRequestCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_request = models.ProcurementRequest(
        requested_by=current_user.id,
        description=request_data.description,
        quantity=request_data.quantity,
        required_date=request_data.required_date,
        status="Pending"
    )

    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    return new_request


class ProcurementStatusUpdate(BaseModel):
    status: str


@app.put(
    "/procurement-requests/{request_id}",
    response_model=ProcurementRequestResponse
)
def update_procurement_request(
    request_id: int,
    status_data: ProcurementStatusUpdate,
    current_user: models.User = Depends(
        require_role(["admin", "procurement", "manager"])
    ),
    db: Session = Depends(get_db)
):
    request = db.query(
        models.ProcurementRequest
    ).filter(
        models.ProcurementRequest.id == request_id
    ).first()

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found"
        )

    allowed_statuses = [
        "Pending",
        "Approved",
        "Rejected",
        "Completed"
    ]

    if status_data.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Invalid status"
        )

    request.status = status_data.status

    db.commit()
    db.refresh(request)

    return request

@app.post(
    "/purchase-orders",
    response_model=PurchaseOrderResponse
)
def create_purchase_order(
    order_data: PurchaseOrderCreate,
    current_user: models.User = Depends(
        require_role(["admin", "procurement", "manager"])
    ),
    db: Session = Depends(get_db)
):
    # Check vendor exists
    vendor = db.query(models.Vendor).filter(
        models.Vendor.id == order_data.vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    # Compute line items if provided
    items_to_add = []
    subtotal = 0.0
    tax_amount = 0.0

    if order_data.items:
        for itm in order_data.items:
            line_sub = round(itm.quantity * itm.unit_price, 2)
            line_tax = round(line_sub * ((itm.tax_percent or 18.0) / 100.0), 2)
            line_tot = line_sub + line_tax
            subtotal += line_sub
            tax_amount += line_tax
            items_to_add.append({
                "product_name": itm.product_name,
                "quantity": itm.quantity,
                "unit_price": itm.unit_price,
                "tax_percent": itm.tax_percent or 18.0,
                "total_price": line_tot,
            })
        total_amount = round(subtotal + tax_amount, 2)
    else:
        total_amount = order_data.total_amount or 0.0
        subtotal = order_data.subtotal or total_amount
        tax_amount = order_data.tax_amount or 0.0

    # Generate PO Number if not provided
    count = db.query(models.PurchaseOrder).count() + 1
    po_num = order_data.po_number or f"PO-{datetime.now().year}-{count:04d}"

    new_order = models.PurchaseOrder(
        po_number=po_num,
        vendor_id=order_data.vendor_id,
        created_by=current_user.id,
        procurement_request_id=order_data.procurement_request_id,
        expected_delivery=order_data.expected_delivery,
        department=order_data.department or "Information Technology",
        payment_terms=order_data.payment_terms or "Net 30",
        shipping_address=order_data.shipping_address,
        billing_address=order_data.billing_address,
        remarks=order_data.remarks,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        status="Pending",
    )

    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    # Add line items
    for itm_data in items_to_add:
        db_item = models.PurchaseOrderItem(
            purchase_order_id=new_order.id,
            product_name=itm_data["product_name"],
            quantity=itm_data["quantity"],
            unit_price=itm_data["unit_price"],
            tax_percent=itm_data["tax_percent"],
            total_price=itm_data["total_price"],
        )
        db.add(db_item)

    if items_to_add:
        db.commit()
        db.refresh(new_order)

    log_activity(
        db, current_user.id, "CREATE_PURCHASE_ORDER", "PurchaseOrder", new_order.id,
        f"Created PO #{new_order.po_number or new_order.id} for Vendor #{new_order.vendor_id} - Total: ${total_amount:.2f}"
    )

    return new_order


@app.get(
    "/purchase-orders",
    response_model=list[PurchaseOrderResponse]
)
def get_purchase_orders(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.PurchaseOrder)

    # If vendor user, scope only to their vendor_id
    if "vendor" in current_user.role.lower():
        if current_user.vendor_id:
            query = query.filter(models.PurchaseOrder.vendor_id == current_user.vendor_id)
        else:
            v = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
            if v:
                query = query.filter(models.PurchaseOrder.vendor_id == v.id)
            else:
                return []

    orders = query.order_by(models.PurchaseOrder.id.desc()).all()
    return orders


@app.get(
    "/purchase-orders/{order_id}",
    response_model=PurchaseOrderResponse
)
def get_purchase_order(
    order_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == order_id
    ).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found"
        )
    return order


class PurchaseOrderStatusUpdate(BaseModel):
    status: str


class VendorPerformanceCreate(BaseModel):
    vendor_id: int
    delivery_score: float
    quality_score: float
    cost_score: float


class VendorPerformanceResponse(BaseModel):
    id: int
    vendor_id: int
    delivery_score: float
    quality_score: float
    cost_score: float
    reliability_score: float
    risk_level: str

    class Config:
        from_attributes = True


@app.put(
    "/purchase-orders/{order_id}",
    response_model=PurchaseOrderResponse
)
@app.put(
    "/purchase-orders/{order_id}/status",
    response_model=PurchaseOrderResponse
)
def update_purchase_order(
    order_id: int,
    status_data: PurchaseOrderStatusUpdate,
    current_user: models.User = Depends(
        require_role(["admin", "procurement", "manager", "scm", "vendor"])
    ),
    db: Session = Depends(get_db)
):
    order = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == order_id
    ).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found"
        )

    # Vendor scoping check
    if "vendor" in current_user.role.lower():
        if current_user.vendor_id and order.vendor_id != current_user.vendor_id:
            raise HTTPException(status_code=403, detail="Vendors can only update status for their assigned orders.")
        if status_data.status not in ["Ordered", "Delivered"]:
            raise HTTPException(status_code=403, detail="Vendors can only update status to Ordered or Delivered.")

    allowed_statuses = [
        "Pending",
        "Approved",
        "Ordered",
        "Delivered",
        "Completed",
        "Rejected",
        "Cancelled"
    ]

    if status_data.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {allowed_statuses}"
        )

    old_status = order.status
    order.status = status_data.status
    db.commit()
    db.refresh(order)

    # Event triggers: PO lifecycle notifications
    if status_data.status == "Approved":
        notifications.notify_user(
            db, order.created_by,
            "Purchase Order Approved",
            f"PO #{order.po_number or order.id} (${order.total_amount:.2f}) was approved.",
            "procurement",
        )
    elif status_data.status == "Rejected":
        notifications.notify_user(
            db, order.created_by,
            "Purchase Order Rejected",
            f"PO #{order.po_number or order.id} was rejected.",
            "procurement",
        )
    elif status_data.status in ("Ordered", "Delivered"):
        notifications.notify_user(
            db, order.created_by,
            f"Purchase Order {status_data.status}",
            f"PO #{order.po_number or order.id} is now {status_data.status}.",
            "delivery_delay" if status_data.status == "Delivered" else "procurement",
        )
    elif status_data.status == "Completed":
        notifications.notify_user(
            db, order.created_by,
            "Purchase Order Completed",
            f"PO #{order.po_number or order.id} has been marked completed.",
            "procurement",
        )
    db.commit()

    log_activity(
        db, current_user.id, "UPDATE_PO_STATUS", "PurchaseOrder", order.id,
        f"PO #{order.po_number or order.id} status changed from {old_status} to {status_data.status}"
    )

    return order


@app.put(
    "/purchase-orders/{order_id}/status",
    response_model=PurchaseOrderResponse
)
def update_purchase_order_status_alias(
    order_id: int,
    status_data: PurchaseOrderStatusUpdate,
    current_user: models.User = Depends(
        require_role(["admin", "procurement", "manager", "scm"])
    ),
    db: Session = Depends(get_db)
):
    return update_purchase_order(order_id, status_data, current_user, db)


@app.put(
    "/purchase-orders/{order_id}/approve",
    response_model=PurchaseOrderResponse
)
def approve_purchase_order(
    order_id: int,
    current_user: models.User = Depends(
        require_role(["admin", "procurement", "manager"])
    ),
    db: Session = Depends(get_db)
):
    return update_purchase_order(order_id, PurchaseOrderStatusUpdate(status="Approved"), current_user, db)



@app.post(
    "/vendor-performance",
    response_model=VendorPerformanceResponse
)


def create_vendor_performance(
    performance_data: VendorPerformanceCreate,
    current_user: models.User = Depends(
        require_role(["admin", "procurement"])
    ),
    db: Session = Depends(get_db)
):
    # Check vendor exists
    vendor = db.query(models.Vendor).filter(
        models.Vendor.id == performance_data.vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    # Validate scores
    scores = [
        performance_data.delivery_score,
        performance_data.quality_score,
        performance_data.cost_score
    ]

    if any(score < 0 or score > 100 for score in scores):
        raise HTTPException(
            status_code=400,
            detail="Scores must be between 0 and 100"
        )

    # Calculate reliability score
    reliability_score = (
        performance_data.delivery_score * 0.4
        + performance_data.quality_score * 0.4
        + performance_data.cost_score * 0.2
    )

    # Determine risk level
    if reliability_score >= 80:
        risk_level = "Low"
    elif reliability_score >= 60:
        risk_level = "Medium"
    else:
        risk_level = "High"

    new_performance = models.VendorPerformance(
        vendor_id=performance_data.vendor_id,
        delivery_score=performance_data.delivery_score,
        quality_score=performance_data.quality_score,
        cost_score=performance_data.cost_score,
        reliability_score=reliability_score,
        risk_level=risk_level
    )

    db.add(new_performance)
    db.commit()
    db.refresh(new_performance)

    return new_performance

@app.get("/vendors/{vendor_id}/risk")
def get_vendor_risk(
    vendor_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check vendor exists
    vendor = db.query(models.Vendor).filter(
        models.Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    # Get latest performance record
    performance = db.query(
        models.VendorPerformance
    ).filter(
        models.VendorPerformance.vendor_id == vendor_id
    ).order_by(
        models.VendorPerformance.id.desc()
    ).first()

    if not performance:
        raise HTTPException(
            status_code=404,
            detail="No performance data found for this vendor"
        )

    return {
        "vendor_id": vendor.id,
        "company_name": vendor.company_name,
        "delivery_score": performance.delivery_score,
        "quality_score": performance.quality_score,
        "cost_score": performance.cost_score,
        "reliability_score": performance.reliability_score,
        "risk_level": performance.risk_level
    }

@app.get("/vendor-performance")
def get_all_vendor_performance(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    performances = db.query(
        models.VendorPerformance
    ).all()

    result = []

    for performance in performances:
        vendor = db.query(models.Vendor).filter(
            models.Vendor.id == performance.vendor_id
        ).first()

        if vendor:
            result.append({
                "vendor_id": vendor.id,
                "company_name": vendor.company_name,
                "delivery_score": performance.delivery_score,
                "quality_score": performance.quality_score,
                "cost_score": performance.cost_score,
                "reliability_score": performance.reliability_score,
                "risk_level": performance.risk_level
            })

    return result

@app.get("/dashboard/summary")
def get_dashboard_summary(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    total_vendors = db.query(models.Vendor).count()

    total_requests = db.query(
        models.ProcurementRequest
    ).count()

    total_orders = db.query(
        models.PurchaseOrder
    ).count()

    low_risk = db.query(
        models.VendorPerformance
    ).filter(
        models.VendorPerformance.risk_level == "Low"
    ).count()

    medium_risk = db.query(
        models.VendorPerformance
    ).filter(
        models.VendorPerformance.risk_level == "Medium"
    ).count()

    high_risk = db.query(
        models.VendorPerformance
    ).filter(
        models.VendorPerformance.risk_level == "High"
    ).count()

    return {
        "total_vendors": total_vendors,
        "total_procurement_requests": total_requests,
        "total_purchase_orders": total_orders,
        "risk_summary": {
            "low": low_risk,
            "medium": medium_risk,
            "high": high_risk
        }
    }

