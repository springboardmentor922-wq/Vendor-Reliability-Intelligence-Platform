"""VendorIQ FastAPI application.

Business endpoints stay compatible with the existing application while adding
PostgreSQL-ready migrations, production RBAC, search, password reset, contacts,
file upload metadata and a complete PO approval path.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

import analytics
import audit
import communications
import contracts
import invoices
import models
import notifications
import reports
from auth import (
    create_access_token,
    create_password_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
)
from deps import (
    ensure_vendor_scope,
    get_current_user,
    get_db,
    log_activity,
    normalize_role,
    require_role,
)
from notification_providers import send_email

APP_ENV = os.getenv("APP_ENV", "development")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
ALLOWED_ROLES = {
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
    "vendor",
    "finance_officer",
    "auditor",
}

raw_cors = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ORIGINS = [origin.strip() for origin in raw_cors.split(",") if origin.strip()]

app = FastAPI(
    title="VendorIQ API",
    version="2.0.0",
    description="Vendor Reliability Intelligence & Procurement Risk Management Platform",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics.router)
app.include_router(contracts.router)
app.include_router(notifications.router)
app.include_router(reports.router)
app.include_router(communications.router)
app.include_router(invoices.router)
app.include_router(audit.router)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads")).resolve()
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024
ALLOWED_MIME = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".txt", ".xlsx", ".xls"}


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = "vendor"
    vendor_id: int | None = None


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=100)


class UserRoleUpdate(BaseModel):
    role: str
    vendor_id: int | None = None


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class VendorCreate(BaseModel):
    company_name: str = Field(min_length=2, max_length=150)
    category: str | None = None
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = None
    website: str | None = None
    tax_id: str | None = None
    country: str | None = "India"
    status: str | None = None


class VendorResponse(BaseModel):
    id: int
    company_name: str
    category: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    tax_id: str | None = None
    country: str | None = None
    address: str | None = None
    status: str
    risk_level: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class VendorContactCreate(BaseModel):
    contact_name: str = Field(min_length=2, max_length=100)
    email: EmailStr | None = None
    phone: str | None = None
    designation: str | None = None


class ProcurementRequestCreate(BaseModel):
    description: str = Field(min_length=3)
    quantity: int = Field(gt=0, le=1_000_000)
    department: str = "Information Technology"
    priority: str = "Normal"
    estimated_budget: float | None = Field(default=None, ge=0)
    justification: str | None = None
    required_date: datetime | None = None


class ProcurementRequestResponse(BaseModel):
    id: int
    requested_by: int
    description: str
    quantity: int
    department: str
    priority: str
    estimated_budget: float | None
    justification: str | None
    required_date: datetime | None
    status: str
    created_at: datetime | None

    class Config:
        from_attributes = True


class ProcurementStatusUpdate(BaseModel):
    status: str
    comment: str | None = None


class PurchaseOrderItemCreate(BaseModel):
    product_name: str = Field(min_length=1, max_length=150)
    quantity: int = Field(default=1, gt=0)
    unit_price: float = Field(default=0.0, ge=0)
    tax_percent: float = Field(default=18.0, ge=0, le=100)
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
    total_amount: float | None = Field(default=None, ge=0)
    subtotal: float | None = Field(default=None, ge=0)
    tax_amount: float | None = Field(default=None, ge=0)
    requested_delivery: datetime | None = None
    expected_delivery: datetime | None = None
    procurement_request_id: int | None = None
    department: str = "Information Technology"
    payment_terms: str = "Net 30"
    shipping_address: str | None = None
    billing_address: str | None = None
    remarks: str | None = None
    po_number: str | None = None
    items: list[PurchaseOrderItemCreate] = Field(default_factory=list)


class PurchaseOrderResponse(BaseModel):
    id: int
    po_number: str | None
    vendor_id: int
    created_by: int
    procurement_request_id: int | None
    order_date: datetime | None
    requested_delivery: datetime | None
    expected_delivery: datetime | None
    actual_delivery: datetime | None
    department: str
    payment_terms: str
    shipping_address: str | None
    billing_address: str | None
    remarks: str | None
    subtotal: float
    tax_amount: float
    total_amount: float
    status: str
    created_at: datetime | None
    items: list[PurchaseOrderItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class VendorPerformanceCreate(BaseModel):
    vendor_id: int
    delivery_score: float = Field(ge=0, le=100)
    quality_score: float = Field(ge=0, le=100)
    cost_score: float = Field(ge=0, le=100)
    communication_score: float = Field(default=0, ge=0, le=100)
    service_score: float = Field(default=0, ge=0, le=100)
    issue_resolution_score: float = Field(default=0, ge=0, le=100)
    notes: str | None = None


@app.get("/", tags=["system"])
def home():
    return {
        "name": "VendorIQ API",
        "status": "ok",
        "environment": APP_ENV,
        "version": app.version,
    }


@app.get("/health", tags=["system"])
def health(db: Session = Depends(get_db)):
    db.execute(select(func.now()))
    return {"status": "healthy", "database": "reachable"}


def _vendor_name(db: Session, vendor_id: int | None) -> str | None:
    if not vendor_id:
        return None
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    return vendor.company_name if vendor else None


def _user_payload(user: models.User, db: Session) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": normalize_role(user.role),
        "vendor_id": user.vendor_id,
        "vendor_name": _vendor_name(db, user.vendor_id),
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@app.get("/users/me", tags=["auth"])
def get_current_user_profile(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return _user_payload(current_user, db)


@app.put("/users/me", tags=["auth"])
def update_current_user(
    payload: ProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.name = payload.name.strip()
    log_activity(
        db,
        current_user.id,
        "UPDATE_PROFILE",
        "User",
        current_user.id,
        "Updated profile name",
    )
    db.commit()
    db.refresh(current_user)
    return _user_payload(current_user, db)


@app.get("/users", tags=["users"])
def list_users(
    current_user: models.User = Depends(require_role(["administrator"])),
    db: Session = Depends(get_db),
):
    users = db.query(models.User).order_by(models.User.id.desc()).all()
    return [_user_payload(user, db) for user in users]


@app.put("/users/{user_id}/role", tags=["users"])
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    current_user: models.User = Depends(require_role(["administrator"])),
    db: Session = Depends(get_db),
):
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    new_role = normalize_role(payload.role)
    if new_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if target.id == current_user.id and new_role != "administrator":
        raise HTTPException(
            status_code=400,
            detail="Administrators cannot remove their own administrator access",
        )
    if new_role == "vendor":
        if (
            not payload.vendor_id
            or not db.query(models.Vendor)
            .filter(models.Vendor.id == payload.vendor_id)
            .first()
        ):
            raise HTTPException(
                status_code=400,
                detail="A valid vendor_id is required for vendor accounts",
            )
        target.vendor_id = payload.vendor_id
    else:
        target.vendor_id = None
    old_role = normalize_role(target.role)
    target.role = new_role
    log_activity(
        db,
        current_user.id,
        "UPDATE_USER_ROLE",
        "User",
        target.id,
        f"Role {old_role} -> {new_role}",
    )
    db.commit()
    db.refresh(target)
    return _user_payload(target, db)


@app.post("/register", tags=["auth"])
def register(user_data: RegisterRequest, db: Session = Depends(get_db)):
    existing = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == user_data.email.lower())
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    role = normalize_role(user_data.role)
    # Public registration cannot create privileged accounts.
    if role not in {"vendor", "auditor"}:
        role = "vendor"
    vendor = None
    if user_data.vendor_id:
        vendor = (
            db.query(models.Vendor)
            .filter(models.Vendor.id == user_data.vendor_id)
            .first()
        )
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
    user = models.User(
        name=user_data.name.strip(),
        email=user_data.email.lower(),
        password_hash=hash_password(user_data.password),
        role=role,
        vendor_id=vendor.id if vendor else None,
    )
    db.add(user)
    db.flush()
    log_activity(
        db,
        user.id,
        "CREATE_USER",
        "User",
        user.id,
        f"Registered account with role {role}",
    )
    db.commit()
    return {"message": "User registered successfully", **_user_payload(user, db)}


@app.post("/login", tags=["auth"])
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == login_data.email.lower())
        .first()
    )
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user.role = normalize_role(user.role)
    token = create_access_token({"user_id": user.id, "role": user.role})
    db.commit()
    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        **_user_payload(user, db),
    }


@app.post("/auth/password-reset/request", tags=["auth"])
def request_password_reset(
    payload: PasswordResetRequest, db: Session = Depends(get_db)
):
    user = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == payload.email.lower())
        .first()
    )
    # Avoid leaking whether an address exists.
    response = {"message": "If the account exists, a reset link has been prepared."}
    if not user:
        return response
    token = create_password_reset_token()
    user.password_reset_token_hash = hash_reset_token(token)
    user.password_reset_expires = datetime.now(timezone.utc).replace(tzinfo=None)
    from datetime import timedelta

    user.password_reset_expires = datetime.now(timezone.utc).replace(
        tzinfo=None
    ) + timedelta(minutes=int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30")))
    db.commit()
    reset_url = os.getenv(
        "PASSWORD_RESET_URL", "http://localhost:5173/login?mode=reset"
    )
    email_body = (
        "A VendorIQ password reset was requested for this account.\n\n"
        f"Use this one-time token to complete the reset: {token}\n"
        f"Reset page: {reset_url}\n\n"
        "This token expires according to PASSWORD_RESET_EXPIRE_MINUTES. If you did not request this, ignore this message."
    )
    send_email(str(user.email), "VendorIQ password reset", email_body)
    if DEBUG:
        response["dev_reset_token"] = token
    return response


@app.post("/auth/password-reset/confirm", tags=["auth"])
def confirm_password_reset(
    payload: PasswordResetConfirm, db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    user = (
        db.query(models.User)
        .filter(
            models.User.password_reset_token_hash == hash_reset_token(payload.token)
        )
        .first()
    )
    if not user or not user.password_reset_expires or user.password_reset_expires < now:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user.password_hash = hash_password(payload.password)
    user.password_reset_token_hash = None
    user.password_reset_expires = None
    log_activity(
        db, user.id, "PASSWORD_RESET", "User", user.id, "Password reset completed"
    )
    db.commit()
    return {"message": "Password updated successfully"}


@app.get("/vendors", response_model=list[VendorResponse], tags=["vendors"])
def get_vendors(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    query = db.query(models.Vendor).order_by(models.Vendor.created_at.desc())
    if normalize_role(current_user.role) == "vendor":
        query = query.filter(models.Vendor.id == current_user.vendor_id)
    return query.all()


@app.post("/vendors", response_model=VendorResponse, tags=["vendors"])
def create_vendor(
    payload: VendorCreate,
    current_user: models.User = Depends(
        require_role(["administrator", "procurement_manager"])
    ),
    db: Session = Depends(get_db),
):
    vendor = models.Vendor(
        company_name=payload.company_name.strip(),
        category=payload.category,
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
        address=payload.address,
        website=payload.website,
        tax_id=payload.tax_id,
        country=payload.country or "India",
        status=payload.status or "Pending",
        risk_level="Medium",
    )
    db.add(vendor)
    db.flush()
    log_activity(
        db,
        current_user.id,
        "CREATE_VENDOR",
        "Vendor",
        vendor.id,
        f"Created vendor {vendor.company_name}",
    )
    db.commit()
    db.refresh(vendor)
    return vendor


@app.get("/vendors/{vendor_id}/contacts", tags=["vendors"])
def get_vendor_contacts(
    vendor_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_vendor_scope(current_user, vendor_id)
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return [
        {
            "id": c.id,
            "contact_name": c.contact_name,
            "email": c.email,
            "phone": c.phone,
            "designation": c.designation,
        }
        for c in vendor.contacts
    ]


@app.post("/vendors/{vendor_id}/contacts", tags=["vendors"])
def add_vendor_contact(
    vendor_id: int,
    payload: VendorContactCreate,
    current_user: models.User = Depends(
        require_role(["administrator", "procurement_manager", "vendor"])
    ),
    db: Session = Depends(get_db),
):
    ensure_vendor_scope(current_user, vendor_id)
    if not db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first():
        raise HTTPException(status_code=404, detail="Vendor not found")
    contact = models.VendorContact(
        vendor_id=vendor_id,
        contact_name=payload.contact_name.strip(),
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
        designation=payload.designation,
    )
    db.add(contact)
    db.flush()
    log_activity(
        db,
        current_user.id,
        "CREATE_VENDOR_CONTACT",
        "VendorContact",
        contact.id,
        f"Added contact to vendor #{vendor_id}",
    )
    db.commit()
    return {
        "id": contact.id,
        "contact_name": contact.contact_name,
        "email": contact.email,
        "phone": contact.phone,
        "designation": contact.designation,
    }


@app.put("/vendors/{vendor_id}", response_model=VendorResponse, tags=["vendors"])
def update_vendor(
    vendor_id: int,
    payload: VendorCreate,
    current_user: models.User = Depends(
        require_role(["administrator", "procurement_manager"])
    ),
    db: Session = Depends(get_db),
):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    old_status = vendor.status
    vendor.company_name = payload.company_name.strip()
    vendor.category = payload.category
    vendor.email = str(payload.email) if payload.email else None
    vendor.phone = payload.phone
    vendor.address = payload.address
    vendor.website = payload.website
    vendor.tax_id = payload.tax_id
    vendor.country = payload.country
    if payload.status:
        vendor.status = payload.status
        if payload.status == "Approved":
            vendor.approved_at = datetime.utcnow()
            vendor.approved_by = current_user.id
    log_activity(
        db,
        current_user.id,
        "UPDATE_VENDOR",
        "Vendor",
        vendor.id,
        f"Updated vendor; status {old_status} -> {vendor.status}",
    )
    if payload.status in {"Approved", "Rejected"} and payload.status != old_status:
        notifications.notify_roles(
            db,
            ["administrator", "procurement_manager", "supply_chain_manager"],
            "Vendor Approval Update",
            f"{vendor.company_name} was {payload.status.lower()}.",
            "vendor_approval",
        )
    db.commit()
    db.refresh(vendor)
    return vendor


@app.delete("/vendors/{vendor_id}", tags=["vendors"])
def delete_vendor(
    vendor_id: int,
    current_user: models.User = Depends(require_role(["administrator"])),
    db: Session = Depends(get_db),
):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    name = vendor.company_name
    log_activity(
        db,
        current_user.id,
        "DELETE_VENDOR",
        "Vendor",
        vendor_id,
        f"Deleted vendor {name}",
    )
    db.delete(vendor)
    db.commit()
    return {"message": "Vendor deleted successfully", "vendor_id": vendor_id}


@app.get(
    "/procurement-requests",
    response_model=list[ProcurementRequestResponse],
    tags=["procurement"],
)
def get_procurement_requests(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    query = db.query(models.ProcurementRequest).order_by(
        models.ProcurementRequest.created_at.desc()
    )
    if normalize_role(current_user.role) == "vendor":
        return []
    if normalize_role(current_user.role) not in {
        "administrator",
        "procurement_manager",
        "supply_chain_manager",
        "auditor",
    }:
        query = query.filter(models.ProcurementRequest.requested_by == current_user.id)
    return query.all()


@app.post(
    "/procurement-requests",
    response_model=ProcurementRequestResponse,
    tags=["procurement"],
)
def create_procurement_request(
    payload: ProcurementRequestCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = models.ProcurementRequest(
        requested_by=current_user.id,
        description=payload.description.strip(),
        quantity=payload.quantity,
        department=payload.department,
        priority=payload.priority,
        estimated_budget=payload.estimated_budget,
        justification=payload.justification,
        required_date=payload.required_date,
        status="Pending",
    )
    db.add(request)
    db.flush()
    log_activity(
        db,
        current_user.id,
        "CREATE_PROCUREMENT_REQUEST",
        "ProcurementRequest",
        request.id,
        f"Created procurement request: {request.description}",
    )
    db.commit()
    db.refresh(request)
    return request


@app.put(
    "/procurement-requests/{request_id}",
    response_model=ProcurementRequestResponse,
    tags=["procurement"],
)
def update_procurement_request(
    request_id: int,
    payload: ProcurementStatusUpdate,
    current_user: models.User = Depends(
        require_role(["administrator", "procurement_manager", "supply_chain_manager"])
    ),
    db: Session = Depends(get_db),
):
    request = (
        db.query(models.ProcurementRequest)
        .filter(models.ProcurementRequest.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Procurement request not found")
    allowed = {"Pending", "Approved", "Rejected", "Completed", "Cancelled"}
    if payload.status not in allowed:
        raise HTTPException(
            status_code=400, detail="Invalid procurement request status"
        )
    old_status = request.status
    request.status = payload.status
    log_activity(
        db,
        current_user.id,
        "UPDATE_PROCUREMENT_REQUEST",
        "ProcurementRequest",
        request.id,
        f"Status {old_status} -> {payload.status}. {payload.comment or ''}".strip(),
    )
    db.commit()
    db.refresh(request)
    return request


def _new_po_number(db: Session) -> str:
    year = datetime.utcnow().year
    existing = (
        db.query(models.PurchaseOrder)
        .filter(models.PurchaseOrder.po_number.like(f"PO-{year}-%"))
        .count()
    )
    return f"PO-{year}-{existing + 1:04d}"


@app.post(
    "/purchase-orders", response_model=PurchaseOrderResponse, tags=["purchase-orders"]
)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    current_user: models.User = Depends(
        require_role(["administrator", "procurement_manager", "supply_chain_manager"])
    ),
    db: Session = Depends(get_db),
):
    vendor = (
        db.query(models.Vendor).filter(models.Vendor.id == payload.vendor_id).first()
    )
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    if vendor.status not in {"Approved", "Active"}:
        raise HTTPException(
            status_code=409,
            detail="Purchase orders can only be assigned to approved/active vendors",
        )
    subtotal = tax_amount = 0.0
    item_models: list[models.PurchaseOrderItem] = []
    for item in payload.items:
        line_sub = round(item.quantity * item.unit_price, 2)
        line_tax = round(line_sub * item.tax_percent / 100.0, 2)
        subtotal += line_sub
        tax_amount += line_tax
        item_models.append(
            models.PurchaseOrderItem(
                product_name=item.product_name.strip(),
                quantity=item.quantity,
                unit_price=item.unit_price,
                tax_percent=item.tax_percent,
                total_price=line_sub + line_tax,
            )
        )
    if not payload.items:
        subtotal = float(payload.subtotal or payload.total_amount or 0)
        tax_amount = float(payload.tax_amount or 0)
    total = round(
        payload.total_amount
        if payload.total_amount is not None and not payload.items
        else subtotal + tax_amount,
        2,
    )
    if payload.items:
        total = round(subtotal + tax_amount, 2)
    po = models.PurchaseOrder(
        po_number=payload.po_number or _new_po_number(db),
        vendor_id=vendor.id,
        created_by=current_user.id,
        procurement_request_id=payload.procurement_request_id,
        requested_delivery=payload.requested_delivery,
        expected_delivery=payload.expected_delivery,
        department=payload.department,
        payment_terms=payload.payment_terms,
        shipping_address=payload.shipping_address,
        billing_address=payload.billing_address,
        remarks=payload.remarks,
        subtotal=round(subtotal, 2),
        tax_amount=round(tax_amount, 2),
        total_amount=total,
        status="Pending",
    )
    po.items = item_models
    db.add(po)
    db.flush()
    log_activity(
        db,
        current_user.id,
        "CREATE_PURCHASE_ORDER",
        "PurchaseOrder",
        po.id,
        f"Created {po.po_number} for {vendor.company_name} — {total:.2f}",
    )
    db.commit()
    db.refresh(po)
    return po


@app.get(
    "/purchase-orders",
    response_model=list[PurchaseOrderResponse],
    tags=["purchase-orders"],
)
def get_purchase_orders(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: str | None = None,
    vendor_id: int | None = None,
    limit: int = Query(200, ge=1, le=500),
):
    query = (
        db.query(models.PurchaseOrder)
        .options(joinedload(models.PurchaseOrder.items))
        .order_by(models.PurchaseOrder.id.desc())
    )
    role = normalize_role(current_user.role)
    if role == "vendor":
        query = query.filter(models.PurchaseOrder.vendor_id == current_user.vendor_id)
    elif vendor_id:
        query = query.filter(models.PurchaseOrder.vendor_id == vendor_id)
    if status:
        query = query.filter(models.PurchaseOrder.status == status)
    return query.limit(limit).all()


@app.get(
    "/purchase-orders/{order_id}",
    response_model=PurchaseOrderResponse,
    tags=["purchase-orders"],
)
def get_purchase_order(
    order_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = (
        db.query(models.PurchaseOrder)
        .options(joinedload(models.PurchaseOrder.items))
        .filter(models.PurchaseOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    ensure_vendor_scope(current_user, order.vendor_id)
    return order


@app.put(
    "/purchase-orders/{order_id}/status",
    response_model=PurchaseOrderResponse,
    tags=["purchase-orders"],
)
@app.put(
    "/purchase-orders/{order_id}",
    response_model=PurchaseOrderResponse,
    include_in_schema=False,
)
def update_purchase_order(
    order_id: int,
    payload: ProcurementStatusUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = (
        db.query(models.PurchaseOrder)
        .filter(models.PurchaseOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    role = normalize_role(current_user.role)
    ensure_vendor_scope(current_user, order.vendor_id)
    allowed = {
        "Pending",
        "Approved",
        "Rejected",
        "Ordered",
        "Delivered",
        "Completed",
        "Cancelled",
    }
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid purchase order status")
    if role == "vendor" and payload.status not in {"Ordered", "Delivered"}:
        raise HTTPException(
            status_code=403,
            detail="Vendor users can only mark their orders Ordered or Delivered",
        )
    old = order.status
    order.status = payload.status
    if payload.status == "Delivered":
        order.actual_delivery = datetime.utcnow()
    db.add(
        models.PurchaseOrderApproval(
            purchase_order_id=order.id,
            approver_id=current_user.id,
            decision=payload.status,
            comment=payload.comment,
        )
    ) if payload.status in {"Approved", "Rejected"} else None
    log_activity(
        db,
        current_user.id,
        "UPDATE_PO_STATUS",
        "PurchaseOrder",
        order.id,
        f"{old} -> {payload.status}. {payload.comment or ''}".strip(),
    )
    db.commit()
    db.refresh(order)
    return order


@app.put(
    "/purchase-orders/{order_id}/approve",
    response_model=PurchaseOrderResponse,
    tags=["purchase-orders"],
)
def approve_purchase_order(
    order_id: int,
    payload: ProcurementStatusUpdate | None = None,
    current_user: models.User = Depends(
        require_role(["administrator", "procurement_manager", "supply_chain_manager"])
    ),
    db: Session = Depends(get_db),
):
    return update_purchase_order(
        order_id,
        ProcurementStatusUpdate(
            status="Approved", comment=(payload.comment if payload else None)
        ),
        current_user,
        db,
    )


@app.put(
    "/purchase-orders/{order_id}/reject",
    response_model=PurchaseOrderResponse,
    tags=["purchase-orders"],
)
def reject_purchase_order(
    order_id: int,
    payload: ProcurementStatusUpdate | None = None,
    current_user: models.User = Depends(
        require_role(["administrator", "procurement_manager", "supply_chain_manager"])
    ),
    db: Session = Depends(get_db),
):
    return update_purchase_order(
        order_id,
        ProcurementStatusUpdate(
            status="Rejected", comment=(payload.comment if payload else None)
        ),
        current_user,
        db,
    )


@app.post("/vendor-performance", tags=["performance"])
def create_vendor_performance(
    payload: VendorPerformanceCreate,
    current_user: models.User = Depends(
        require_role(["administrator", "procurement_manager", "supply_chain_manager"])
    ),
    db: Session = Depends(get_db),
):
    vendor = (
        db.query(models.Vendor).filter(models.Vendor.id == payload.vendor_id).first()
    )
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    # Transparent weighted model matching the operational module: delivery 30%, quality 25%, cost 15%, communication 10%, service 10%, issue resolution 10%.
    score = round(
        payload.delivery_score * 0.30
        + payload.quality_score * 0.25
        + payload.cost_score * 0.15
        + payload.communication_score * 0.10
        + payload.service_score * 0.10
        + payload.issue_resolution_score * 0.10,
        2,
    )
    risk = "Low" if score >= 80 else "Medium" if score >= 60 else "High"
    performance = models.VendorPerformance(
        vendor_id=vendor.id,
        delivery_score=payload.delivery_score,
        quality_score=payload.quality_score,
        cost_score=payload.cost_score,
        communication_score=payload.communication_score,
        service_score=payload.service_score,
        issue_resolution_score=payload.issue_resolution_score,
        reliability_score=score,
        risk_level=risk,
        notes=payload.notes,
    )
    vendor.risk_level = risk
    db.add(performance)
    db.flush()
    log_activity(
        db,
        current_user.id,
        "CREATE_VENDOR_PERFORMANCE",
        "VendorPerformance",
        performance.id,
        f"Score {score} / 100; risk {risk}",
    )
    db.commit()
    db.refresh(performance)
    return {
        **{
            k: getattr(performance, k)
            for k in [
                "id",
                "vendor_id",
                "delivery_score",
                "quality_score",
                "cost_score",
                "communication_score",
                "service_score",
                "issue_resolution_score",
                "reliability_score",
                "risk_level",
            ]
        },
        "notes": performance.notes,
        "measured_at": performance.measured_at.isoformat()
        if performance.measured_at
        else None,
    }


@app.get("/vendor-performance", tags=["performance"])
def get_all_vendor_performance(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    query = db.query(models.VendorPerformance, models.Vendor).join(
        models.Vendor, models.Vendor.id == models.VendorPerformance.vendor_id
    )
    role = normalize_role(current_user.role)
    if role == "vendor":
        query = query.filter(
            models.VendorPerformance.vendor_id == current_user.vendor_id
        )
    rows = query.order_by(models.VendorPerformance.measured_at.desc()).all()
    return [
        {
            "vendor_id": v.id,
            "company_name": v.company_name,
            "delivery_score": p.delivery_score,
            "quality_score": p.quality_score,
            "cost_score": p.cost_score,
            "communication_score": p.communication_score,
            "service_score": p.service_score,
            "issue_resolution_score": p.issue_resolution_score,
            "reliability_score": p.reliability_score,
            "risk_level": p.risk_level,
            "notes": p.notes,
            "measured_at": p.measured_at.isoformat() if p.measured_at else None,
        }
        for p, v in rows
    ]


@app.get("/vendors/{vendor_id}/risk", tags=["performance"])
def get_vendor_risk(
    vendor_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_vendor_scope(current_user, vendor_id)
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    latest = (
        db.query(models.VendorPerformance)
        .filter(models.VendorPerformance.vendor_id == vendor_id)
        .order_by(models.VendorPerformance.measured_at.desc())
        .first()
    )
    if not latest:
        # Operational fallback derived from PO lifecycle, so a new vendor has a meaningful signal without a hardcoded score.
        orders = (
            db.query(models.PurchaseOrder)
            .filter(models.PurchaseOrder.vendor_id == vendor_id)
            .all()
        )
        total = len(orders)
        on_time = (
            sum(1 for o in orders if o.status in {"Delivered", "Completed"})
            / total
            * 100
            if total
            else 50.0
        )
        score = round(
            on_time * 0.7 + (100.0 if vendor.status == "Approved" else 50.0) * 0.3, 2
        )
        risk = "Low" if score >= 80 else "Medium" if score >= 60 else "High"
        return {
            "vendor_id": vendor.id,
            "company_name": vendor.company_name,
            "reliability_score": score,
            "risk_level": risk,
            "source": "operational_purchase_order_signal",
            "orders_observed": total,
        }
    return {
        "vendor_id": vendor.id,
        "company_name": vendor.company_name,
        "delivery_score": latest.delivery_score,
        "quality_score": latest.quality_score,
        "cost_score": latest.cost_score,
        "communication_score": latest.communication_score,
        "service_score": latest.service_score,
        "issue_resolution_score": latest.issue_resolution_score,
        "reliability_score": latest.reliability_score,
        "risk_level": latest.risk_level,
        "source": "operational_performance_record",
    }


@app.get("/dashboard/summary", tags=["dashboard"])
def get_dashboard_summary(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    role = normalize_role(current_user.role)
    vendor_filter = {"vendor_id": current_user.vendor_id} if role == "vendor" else {}
    total_vendors = (
        db.query(models.Vendor)
        .filter(
            *([models.Vendor.id == current_user.vendor_id] if role == "vendor" else [])
        )
        .count()
    )
    po_query = db.query(models.PurchaseOrder)
    if role == "vendor":
        po_query = po_query.filter(
            models.PurchaseOrder.vendor_id == current_user.vendor_id
        )
    req_query = db.query(models.ProcurementRequest)
    if role not in {
        "administrator",
        "procurement_manager",
        "supply_chain_manager",
        "auditor",
    }:
        req_query = req_query.filter(
            models.ProcurementRequest.requested_by == current_user.id
        )
    performances = db.query(models.VendorPerformance)
    if role == "vendor":
        performances = performances.filter(
            models.VendorPerformance.vendor_id == current_user.vendor_id
        )
    return {
        "total_vendors": total_vendors,
        "total_procurement_requests": req_query.count(),
        "total_purchase_orders": po_query.count(),
        "active_purchase_orders": po_query.filter(
            models.PurchaseOrder.status.in_(["Approved", "Ordered", "Delivered"])
        ).count(),
        "total_spend": po_query.with_entities(
            func.coalesce(func.sum(models.PurchaseOrder.total_amount), 0)
        ).scalar()
        or 0,
        "risk_summary": {
            "low": performances.filter(
                models.VendorPerformance.risk_level == "Low"
            ).count(),
            "medium": performances.filter(
                models.VendorPerformance.risk_level == "Medium"
            ).count(),
            "high": performances.filter(
                models.VendorPerformance.risk_level == "High"
            ).count(),
        },
    }


@app.get("/api/search", tags=["search"])
def global_search(
    q: str = Query(min_length=2, max_length=80),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(5, ge=1, le=20),
):
    qn = q.strip()
    pattern = f"%{qn}%"
    role = normalize_role(current_user.role)
    results: list[dict[str, Any]] = []
    vendor_query = db.query(models.Vendor).filter(
        or_(
            models.Vendor.company_name.ilike(pattern),
            models.Vendor.email.ilike(pattern),
            models.Vendor.category.ilike(pattern),
        )
    )
    if role == "vendor":
        vendor_query = vendor_query.filter(models.Vendor.id == current_user.vendor_id)
    for v in vendor_query.limit(limit).all():
        results.append(
            {
                "type": "vendor",
                "id": v.id,
                "title": v.company_name,
                "subtitle": f"{v.category or 'Supplier'} · {v.status}",
            }
        )

    po_query = db.query(models.PurchaseOrder).filter(
        or_(
            models.PurchaseOrder.po_number.ilike(pattern),
            models.PurchaseOrder.remarks.ilike(pattern),
        )
    )
    if role == "vendor":
        po_query = po_query.filter(
            models.PurchaseOrder.vendor_id == current_user.vendor_id
        )
    for po in po_query.limit(limit).all():
        results.append(
            {
                "type": "purchase_order",
                "id": po.id,
                "title": po.po_number or f"PO #{po.id}",
                "subtitle": f"{po.status} · {po.total_amount:.2f}",
            }
        )

    if role == "vendor":
        req_query = db.query(models.ProcurementRequest).filter(
            models.ProcurementRequest.requested_by == current_user.id,
            models.ProcurementRequest.description.ilike(pattern),
        )
        contract_query = db.query(models.Contract).filter(
            models.Contract.vendor_id == current_user.vendor_id,
            or_(
                models.Contract.contract_name.ilike(pattern),
                models.Contract.contract_reference.ilike(pattern),
            ),
        )
        invoice_query = db.query(models.Invoice).filter(
            models.Invoice.vendor_id == current_user.vendor_id,
            models.Invoice.invoice_number.ilike(pattern),
        )
    else:
        req_query = db.query(models.ProcurementRequest).filter(
            models.ProcurementRequest.description.ilike(pattern)
        )
        contract_query = db.query(models.Contract).filter(
            or_(
                models.Contract.contract_name.ilike(pattern),
                models.Contract.contract_reference.ilike(pattern),
            )
        )
        invoice_query = db.query(models.Invoice).filter(
            models.Invoice.invoice_number.ilike(pattern)
        )
    for r in req_query.limit(limit).all():
        results.append(
            {
                "type": "procurement_request",
                "id": r.id,
                "title": r.description,
                "subtitle": f"PR #{r.id} · {r.status}",
            }
        )
    for c in contract_query.limit(limit).all():
        results.append(
            {
                "type": "contract",
                "id": c.id,
                "title": c.contract_name,
                "subtitle": c.status,
            }
        )
    for i in invoice_query.limit(limit).all():
        results.append(
            {
                "type": "invoice",
                "id": i.id,
                "title": i.invoice_number,
                "subtitle": i.status,
            }
        )

    if role == "administrator":
        for u in (
            db.query(models.User)
            .filter(
                or_(models.User.name.ilike(pattern), models.User.email.ilike(pattern))
            )
            .limit(limit)
            .all()
        ):
            results.append(
                {
                    "type": "user",
                    "id": u.id,
                    "title": u.name,
                    "subtitle": f"{u.email} · {normalize_role(u.role)}",
                }
            )
    else:
        for u in (
            db.query(models.User)
            .filter(
                models.User.id == current_user.id,
                or_(models.User.name.ilike(pattern), models.User.email.ilike(pattern)),
            )
            .limit(limit)
            .all()
        ):
            results.append(
                {
                    "type": "user",
                    "id": u.id,
                    "title": u.name,
                    "subtitle": f"{u.email} · {normalize_role(u.role)}",
                }
            )

    if role in {"administrator", "auditor", "supply_chain_manager"}:
        for m in (
            db.query(models.Communication)
            .filter(models.Communication.message.ilike(pattern))
            .limit(limit)
            .all()
        ):
            results.append(
                {
                    "type": "communication",
                    "id": m.id,
                    "title": m.subject or "Communication",
                    "subtitle": m.message[:90],
                }
            )
    elif role == "vendor":
        for m in (
            db.query(models.Communication)
            .filter(
                models.Communication.vendor_id == current_user.vendor_id,
                models.Communication.message.ilike(pattern),
            )
            .limit(limit)
            .all()
        ):
            results.append(
                {
                    "type": "communication",
                    "id": m.id,
                    "title": m.subject or "Communication",
                    "subtitle": m.message[:90],
                }
            )
    return {"query": qn, "results": results[: limit * 7]}


@app.post("/api/files/upload", tags=["files"])
async def upload_file(
    vendor_id: int = Query(...),
    document_type: str = Query("vendor_document"),
    entity_type: str = Query("vendor"),
    entity_id: int | None = Query(None),
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_vendor_scope(current_user, vendor_id)
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    allowed_entities = {
        "vendor",
        "contract",
        "invoice",
        "communication",
        "certification",
    }
    if entity_type not in allowed_entities:
        raise HTTPException(status_code=400, detail="Unsupported document entity")
    if entity_type == "contract" and entity_id:
        row = (
            db.query(models.Contract)
            .filter(
                models.Contract.id == entity_id, models.Contract.vendor_id == vendor_id
            )
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Contract not found for vendor")
    if entity_type == "invoice" and entity_id:
        row = (
            db.query(models.Invoice)
            .filter(
                models.Invoice.id == entity_id, models.Invoice.vendor_id == vendor_id
            )
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Invoice not found for vendor")
    if entity_type == "communication" and entity_id:
        row = (
            db.query(models.Communication)
            .filter(
                models.Communication.id == entity_id,
                models.Communication.vendor_id == vendor_id,
            )
            .first()
        )
        if not row:
            raise HTTPException(
                status_code=404, detail="Communication not found for vendor"
            )
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=415, detail="Unsupported file type")
    clean_name = Path(file.filename or "upload").name
    suffix = Path(clean_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported file extension")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413, detail="File exceeds configured size limit"
        )
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = (
        f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{os.urandom(8).hex()}{suffix}"
    )
    (UPLOAD_DIR / stored_name).write_bytes(content)
    doc = models.VendorDocument(
        vendor_id=vendor.id,
        document_type=document_type.strip()[:50],
        entity_type=entity_type,
        entity_id=entity_id,
        original_name=clean_name[:255],
        stored_name=stored_name,
        mime_type=file.content_type,
        size_bytes=len(content),
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.flush()
    log_activity(
        db,
        current_user.id,
        "UPLOAD_DOCUMENT",
        "VendorDocument",
        doc.id,
        f"Uploaded {doc.original_name} ({entity_type})",
    )
    db.commit()
    return {
        "id": doc.id,
        "vendor_id": vendor.id,
        "document_type": doc.document_type,
        "entity_type": doc.entity_type,
        "entity_id": doc.entity_id,
        "original_name": doc.original_name,
        "size_bytes": doc.size_bytes,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }


@app.get("/api/files", tags=["files"])
def list_files(
    vendor_id: int | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = normalize_role(current_user.role)
    if role == "vendor":
        vendor_id = current_user.vendor_id
    query = db.query(models.VendorDocument).order_by(
        models.VendorDocument.created_at.desc()
    )
    if vendor_id:
        query = query.filter(models.VendorDocument.vendor_id == vendor_id)
    if entity_type:
        query = query.filter(models.VendorDocument.entity_type == entity_type)
    if entity_id:
        query = query.filter(models.VendorDocument.entity_id == entity_id)
    return [
        {
            "id": d.id,
            "vendor_id": d.vendor_id,
            "document_type": d.document_type,
            "entity_type": d.entity_type,
            "entity_id": d.entity_id,
            "original_name": d.original_name,
            "size_bytes": d.size_bytes,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in query.limit(200).all()
    ]


@app.get("/api/files/{document_id}/download", tags=["files"])
def download_file(
    document_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from fastapi.responses import FileResponse

    doc = (
        db.query(models.VendorDocument)
        .filter(models.VendorDocument.id == document_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    ensure_vendor_scope(current_user, doc.vendor_id)
    path = UPLOAD_DIR / doc.stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Stored file is unavailable")
    return FileResponse(path, media_type=doc.mime_type, filename=doc.original_name)
