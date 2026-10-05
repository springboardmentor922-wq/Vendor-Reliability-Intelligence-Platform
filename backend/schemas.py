from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


ROLE_VALUES = (
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
    "vendor",
    "supplier",
    "finance_officer",
    "auditor",
)


# ============================================================
# USER SCHEMAS
# ============================================================

class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    role: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


# ============================================================
# PASSWORD SCHEMAS
# ============================================================

class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: Optional[str] = None
    token: Optional[str] = None
    reset_token: Optional[str] = None
    new_password: str


# ============================================================
# ADMIN USER MANAGEMENT
# ============================================================

class UserAdminCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str
    is_active: bool = True
    vendor_id: Optional[int] = None


class UserAdminUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    vendor_id: Optional[int] = None


# ============================================================
# VENDOR SCHEMAS
# ============================================================

class VendorCreate(BaseModel):
    company_name: str
    category: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class VendorUpdate(BaseModel):
    company_name: Optional[str] = None
    category: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    vendor_status: Optional[str] = None
    approval_status: Optional[str] = None


class VendorResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    requested_by: Optional[int] = None
    company_name: str
    category: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    vendor_status: Optional[str] = None
    approval_status: str
    reliability_score: Optional[Decimal] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# SUPPLIER SCHEMAS
# ============================================================

class SupplierCreate(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    email: str
    password: str
    phone: Optional[str] = None
    address: Optional[str] = None
    category: str


class SupplierAdminCreate(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    email: str
    password: str
    phone: Optional[str] = None
    address: Optional[str] = None
    category: str


class SupplierUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None
    supplier_status: Optional[str] = None
    approval_status: Optional[str] = None


class SupplierResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    company_name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None
    supplier_status: Optional[str] = None
    approval_status: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# PURCHASE ORDER SCHEMAS
# ============================================================

class PurchaseOrderCreate(BaseModel):
    vendor_id: int
    supplier_id: Optional[int] = None
    order_number: str
    order_date: date
    expected_delivery_date: Optional[date] = None
    total_amount: Decimal
    status: Optional[str] = None


class PurchaseOrderUpdate(BaseModel):
    vendor_id: Optional[int] = None
    supplier_id: Optional[int] = None
    order_number: Optional[str] = None
    order_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    total_amount: Optional[Decimal] = None
    status: Optional[str] = None


class PurchaseOrderResponse(BaseModel):
    id: int
    vendor_id: int
    supplier_id: Optional[int] = None
    order_number: str
    order_date: date
    expected_delivery_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None
    total_amount: Optional[Decimal] = None
    status: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# PROCUREMENT REQUEST → PURCHASE ORDER
# ============================================================

class ProcurementRequestConvert(BaseModel):
    expected_delivery_date: date
    total_amount: Decimal


# ============================================================
# PROCUREMENT REQUEST SCHEMAS
# ============================================================

class ProcurementRequestCreate(BaseModel):
    vendor_id: Optional[int] = None
    description: str
    quantity: int = 1
    estimated_amount: Decimal
    expected_delivery_date: Optional[date] = None


class ProcurementRequestUpdate(BaseModel):
    vendor_id: Optional[int] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    estimated_amount: Optional[Decimal] = None
    expected_delivery_date: Optional[date] = None
    status: Optional[str] = None


class ProcurementRequestResponse(BaseModel):
    id: int
    request_number: str
    requested_by: Optional[int] = None
    vendor_id: Optional[int] = None
    description: str
    quantity: int
    estimated_amount: Decimal
    expected_delivery_date: Optional[date] = None
    status: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# CONTRACT SCHEMAS
# ============================================================

class ContractCreate(BaseModel):
    vendor_id: int
    title: str
    description: Optional[str] = None
    start_date: date
    end_date: date
    contract_value: Decimal
    status: Optional[str] = "draft"


class ContractUpdate(BaseModel):
    vendor_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    contract_value: Optional[Decimal] = None
    status: Optional[str] = None


class ContractResponse(BaseModel):
    id: int
    contract_number: str
    vendor_id: int
    title: str
    description: Optional[str] = None
    start_date: date
    end_date: date
    contract_value: Decimal
    status: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# COMMUNICATION SCHEMAS
# ============================================================

class CommunicationCreate(BaseModel):
    receiver_id: int
    vendor_id: Optional[int] = None
    subject: str
    message: str
    attachment: Optional[str] = None


class CommunicationUpdate(BaseModel):
    subject: Optional[str] = None
    message: Optional[str] = None
    attachment: Optional[str] = None
    status: Optional[str] = None


class CommunicationResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    vendor_id: Optional[int] = None
    subject: str
    message: str
    attachment: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# NOTIFICATION SCHEMAS
# ============================================================

class NotificationCreate(BaseModel):
    user_id: int
    title: str
    message: str
    notification_type: str = "info"


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# INVOICE SCHEMAS
# ============================================================

class InvoiceCreate(BaseModel):
    purchase_order_id: int
    invoice_date: date
    due_date: Optional[date] = None
    amount: Optional[Decimal] = None


class InvoiceUpdate(BaseModel):
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    amount: Optional[Decimal] = None
    status: Optional[str] = None
    rejection_reason: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    purchase_order_id: int
    vendor_id: int
    invoice_date: date
    due_date: Optional[date] = None
    amount: Decimal
    status: str
    verified_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# PAYMENT SCHEMAS
# ============================================================

class PaymentCreate(BaseModel):
    invoice_id: int
    payment_date: date
    amount: Optional[Decimal] = None
    payment_method: str = "Bank Transfer"
    transaction_reference: Optional[str] = None
    status: str = "pending"
    remarks: Optional[str] = None


class PaymentUpdate(BaseModel):
    payment_date: Optional[date] = None
    amount: Optional[Decimal] = None
    payment_method: Optional[str] = None
    transaction_reference: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    payment_number: str
    invoice_id: int
    purchase_order_id: int
    vendor_id: int
    amount: Decimal
    payment_date: date
    payment_method: str
    transaction_reference: Optional[str] = None
    status: str
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)