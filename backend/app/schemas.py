from uuid import UUID
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

# --- Auth Schemas ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)
    role: Optional[str] = "Procurement Manager"
    role_names: Optional[List[str]] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str = Field(..., min_length=6)

class RoleResponse(BaseModel):
    id: UUID
    name: str

    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    status: str
    roles: List[str] = []
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    user: UserResponse

class RefreshTokenRequest(BaseModel):
    refresh_token: Optional[str] = ""

class MessageResponse(BaseModel):
    message: str

# --- Admin Schemas ---
class UserApprovalAction(BaseModel):
    action: str = "approve" # approve or reject

# --- Vendor Schemas ---
class VendorContactCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None

class VendorContactResponse(BaseModel):
    id: UUID
    name: str
    email: str
    phone: Optional[str] = None

    class Config:
        from_attributes = True

class VendorCreate(BaseModel):
    company_name: str
    registration_no: str
    category: str
    status: str = "ACTIVE"
    review_notes: Optional[str] = None
    contacts: Optional[List[VendorContactCreate]] = []

class VendorUpdate(BaseModel):
    company_name: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    review_notes: Optional[str] = None

class VendorStatusUpdate(BaseModel):
    status: str # pending, under_review, approved, rejected
    review_notes: Optional[str] = None

class VendorResponse(BaseModel):
    id: UUID
    company_name: str
    registration_no: str
    category: str
    status: str
    review_notes: Optional[str] = None
    created_at: datetime
    contacts: List[VendorContactResponse] = []

    class Config:
        from_attributes = True

# --- Procurement Schemas ---
class PRLineItemCreate(BaseModel):
    item_name: str
    quantity: float = 1.0
    estimated_cost: float = 0.0

class PRLineItemResponse(BaseModel):
    id: UUID
    item_name: str
    quantity: float
    estimated_cost: float

    class Config:
        from_attributes = True

class ProcurementRequestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    budget_amount: Optional[float] = None
    line_items: Optional[List[PRLineItemCreate]] = []

class ProcurementRequestStatusUpdate(BaseModel):
    status: str # pending, approved, ordered, delivered, completed, cancelled, REJECTED
    notes: Optional[str] = None

class ProcurementRequestResponse(BaseModel):
    id: UUID
    requester_id: Optional[UUID] = None
    requester_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    budget_amount: Optional[float] = None
    status: str
    total_estimated_cost: float = 0.0
    created_at: datetime
    line_items: List[PRLineItemResponse] = []

    class Config:
        from_attributes = True

class POItemCreate(BaseModel):
    item_name: str
    quantity: float = 1.0
    unit_price: float = 0.0

class POItemResponse(BaseModel):
    id: UUID
    item_name: str
    quantity: float
    unit_price: float

    class Config:
        from_attributes = True

class PODocumentResponse(BaseModel):
    id: UUID
    po_id: UUID
    file_name: str
    doc_type: str
    uploaded_by: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PurchaseOrderCreate(BaseModel):
    pr_id: Optional[UUID] = None
    vendor_id: UUID
    po_number: Optional[str] = None
    items: List[POItemCreate] = []

class PurchaseOrderFromPRCreate(BaseModel):
    vendor_id: Optional[UUID] = None

class PurchaseOrderUpdateStatus(BaseModel):
    status: str # SENT_TO_VENDOR, IN_FULFILLMENT, DELIVERED, COMPLETED, CANCELLED
    notes: Optional[str] = None

class PODeliveryStatusUpdate(BaseModel):
    delivery_status: str # in_progress, shipped, partial_delivery, delivered

class POInvoiceUpdate(BaseModel):
    invoice_amount: float
    invoice_received_at: Optional[datetime] = None

class PurchaseOrderResponse(BaseModel):
    id: UUID
    pr_id: Optional[UUID] = None
    vendor_id: UUID
    vendor_name: Optional[str] = None
    po_number: str
    status: str
    delivery_status: str = "in_progress"
    invoice_amount: Optional[float] = None
    invoice_received_at: Optional[datetime] = None
    total_amount: float
    created_at: datetime
    items: List[POItemResponse] = []
    documents: List[PODocumentResponse] = []

    class Config:
        from_attributes = True

# --- Contract Schemas ---
class ContractCreate(BaseModel):
    vendor_id: UUID
    title: str
    start_date: datetime
    end_date: datetime
    renewal_notice_period_days: Optional[int] = 30
    terms: Optional[str] = None
    compliance_flags: Optional[str] = None
    status: Optional[str] = "ACTIVE"

    @field_validator("start_date", "end_date", mode="after")
    @classmethod
    def ensure_naive_datetime(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None and v.tzinfo is not None:
            return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v

class ContractUpdate(BaseModel):
    title: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    renewal_notice_period_days: Optional[int] = None
    terms: Optional[str] = None
    compliance_flags: Optional[str] = None
    status: Optional[str] = None

    @field_validator("start_date", "end_date", mode="after")
    @classmethod
    def ensure_naive_datetime(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None and v.tzinfo is not None:
            return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v

class ContractResponse(BaseModel):
    id: UUID
    vendor_id: UUID
    vendor_name: Optional[str] = None
    title: str
    start_date: datetime
    end_date: datetime
    renewal_notice_period_days: int = 30
    terms: Optional[str] = None
    compliance_flags: Optional[str] = None
    document_path: Optional[str] = None
    status: str
    created_at: datetime
    days_remaining: Optional[int] = None
    risk_level: Optional[str] = "green" # green, amber, red
    renewed_from_contract_id: Optional[UUID] = None  # traceability: ID of the contract this was renewed from

    class Config:
        from_attributes = True


class ContractRenewRequest(BaseModel):
    """Payload for POST /contracts/{id}/renew — supply the new contract window."""
    new_start_date: datetime
    new_end_date: datetime
    renewal_notice_period_days: Optional[int] = None  # defaults to predecessor's value
    terms: Optional[str] = None  # defaults to predecessor's terms

    @field_validator("new_start_date", "new_end_date", mode="after")
    @classmethod
    def ensure_naive(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None and v.tzinfo is not None:
            return v.astimezone(__import__('datetime').timezone.utc).replace(tzinfo=None)
        return v

# --- Notification Schemas ---
class NotificationResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    message: str
    is_read: bool
    type: str = "general"
    created_at: datetime

    class Config:
        from_attributes = True

# --- Performance & Reliability Schemas ---
class VendorPerformanceCreate(BaseModel):
    on_time_deliveries: int = Field(0, ge=0)
    delayed_deliveries: int = Field(0, ge=0)
    quality_rating: float = Field(5.0, ge=0.0, le=5.0)
    service_rating: Optional[float] = Field(5.0, ge=0.0, le=5.0)
    response_time_hours: float = Field(24.0, ge=0.0)
    issue_resolution_time_hours: float = Field(48.0, ge=0.0)
    order_completion_rate: float = Field(100.0, ge=0.0, le=100.0)

class VendorPerformanceResponse(BaseModel):
    id: UUID
    vendor_id: UUID
    on_time_deliveries: int
    delayed_deliveries: int
    quality_rating: float
    service_rating: Optional[float] = 5.0
    response_time_hours: float
    issue_resolution_time_hours: float
    order_completion_rate: float
    recorded_at: datetime

    class Config:
        from_attributes = True

class VendorPerformanceSummary(BaseModel):
    vendor_id: UUID
    total_entries: int
    total_deliveries: int
    on_time_deliveries: int
    delayed_deliveries: int
    on_time_delivery_rate: float
    average_quality_rating: float
    average_service_rating: float = 5.0
    average_response_time_hours: float
    average_issue_resolution_time_hours: float
    order_completion_rate: float

class VendorRankingItem(BaseModel):
    vendor_id: UUID
    company_name: str
    registration_no: str
    category: str
    status: str
    performance_score: float
    average_quality_rating: float
    on_time_delivery_rate: float
    order_completion_rate: float
    total_evaluations: int

class ReliabilityFactorBreakdown(BaseModel):
    delivery_score: float
    quality_score: float
    communication_score: float
    compliance_score: float
    purchase_history_score: float
    issue_resolution_score: float

class VendorReliabilityResponse(BaseModel):
    vendor_id: UUID
    company_name: str
    overall_reliability_score: float
    risk_level: str
    delivery_score: float
    quality_score: float
    communication_score: float
    compliance_score: float
    breakdown: ReliabilityFactorBreakdown
    recommendation: Optional[str] = None
    computed_at: datetime

class VendorReliabilityRankingItem(BaseModel):
    vendor_id: UUID
    company_name: str
    registration_no: str
    category: str
    status: str
    overall_reliability_score: float
    risk_level: str
    delivery_score: float
    quality_score: float
    compliance_score: float
    recommendation: Optional[str] = None

class VendorReliabilitySnapshot(BaseModel):
    id: UUID
    vendor_id: UUID
    delivery_score: float
    quality_score: float
    communication_score: float
    compliance_score: float
    overall_reliability_score: float
    risk_level: str
    computed_at: datetime

    class Config:
        from_attributes = True


# --- Communication & Activity Log Schemas ---

class CommunicationCreate(BaseModel):
    message: str
    procurement_request_id: Optional[UUID] = None


class CommunicationResponse(BaseModel):
    id: UUID
    vendor_id: UUID
    procurement_request_id: Optional[UUID] = None
    sender_id: Optional[UUID] = None
    sender_name: Optional[str] = None
    sender_role: str
    message: str
    attachment_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    user_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: UUID
    details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Certification Schemas ---
class CertificationCreate(BaseModel):
    certification_name: str = Field(..., min_length=1, max_length=255)
    issued_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    status: Optional[str] = "Valid"  # Valid, Expired, Pending Renewal

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        allowed = {"Valid", "Expired", "Pending Renewal"}
        if v and v not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        return v


class CertificationUpdate(BaseModel):
    certification_name: Optional[str] = Field(None, min_length=1, max_length=255)
    issued_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    status: Optional[str] = None
    document_path: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        allowed = {"Valid", "Expired", "Pending Renewal"}
        if v and v not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        return v


class CertificationResponse(BaseModel):
    id: UUID
    vendor_id: UUID
    vendor_name: Optional[str] = None
    certification_name: str
    issued_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    status: str
    document_path: Optional[str] = None
    created_at: datetime
    is_expiring_soon: Optional[bool] = False  # expiry within 30 days

    class Config:
        from_attributes = True


# --- Compliance Monitoring Schemas ---
class VendorComplianceSummary(BaseModel):
    vendor_id: UUID
    vendor_name: str
    category: str
    vendor_status: str
    total_certifications: int
    valid_certifications: int
    expired_certifications: int
    pending_renewal_certifications: int
    expiring_soon_certifications: int  # expiry within 30 days
    compliance_flags: Optional[str] = None  # from latest active contract
    contract_status: Optional[str] = None
    overall_compliance_status: str  # Compliant, At Risk, Non-Compliant


class ComplianceSummaryResponse(BaseModel):
    total_vendors: int
    compliant: int
    at_risk: int
    non_compliant: int
    vendors: List[VendorComplianceSummary]
