"""
VendorIQ Pydantic Models & Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class LoginRequest(BaseModel):
    email: str
    password: str

class DemoLoginRequest(BaseModel):
    role: str

class UserRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    company_name: str
    category: str
    contact_person: str
    phone: str
    address: str
    products_services: Optional[str] = None
    tax_id: Optional[str] = None

class VendorStatusUpdateRequest(BaseModel):
    status: str # Pending Approval, Active, Inactive, Suspended, Rejected
    notes: Optional[str] = None

class ProcurementRequestCreate(BaseModel):
    title: str
    department: str
    category: str
    description: Optional[str] = None
    quantity: int = 1
    estimated_cost: float
    priority: str = "Medium" # Low, Medium, High, Urgent
    required_date: str # YYYY-MM-DD

class ProcurementRequestDecision(BaseModel):
    status: str # Approved, Rejected
    comments: Optional[str] = None

class VendorAssignCreatePO(BaseModel):
    request_id: int
    vendor_id: int
    expected_delivery_date: str
    total_amount: float
    shipping_mode: Optional[str] = "Standard Class"
    items: List[dict] # [{"product_name": str, "quantity": int, "unit_price": float}]
    notes: Optional[str] = None

class PODeliveryUpdate(BaseModel):
    actual_delivery_date: str # YYYY-MM-DD
    quality_rating: Optional[float] = 4.5 # 1.0 to 5.0
    inspected_quantity: Optional[int] = 100
    defective_quantity: Optional[int] = 0
    evaluator_comments: Optional[str] = None

class InvoiceCreate(BaseModel):
    po_id: int
    invoice_date: str
    due_date: str
    amount: float

class InvoicePaymentUpdate(BaseModel):
    payment_status: str # Paid, Pending, Overdue
    payment_reference: Optional[str] = None

class CommunicationLogRequest(BaseModel):
    vendor_id: int
    communication_type: str # EMAIL, SMS
    recipient_contact: str
    subject: Optional[str] = None
    message_body: Optional[str] = None
    related_record_type: Optional[str] = None
    related_record_id: Optional[str] = None
    response_time_hours: Optional[float] = None

class ContractCreate(BaseModel):
    contract_number: str
    vendor_id: int
    contract_type: str
    start_date: str
    end_date: str
    contract_value: float
    terms: Optional[str] = None

class CertificationCreate(BaseModel):
    vendor_id: int
    certification_name: str
    issuing_body: str
    issue_date: str
    expiry_date: str
    compliance_status: Optional[str] = "Compliant"

class IssueCreate(BaseModel):
    vendor_id: int
    po_id: Optional[int] = None
    title: str
    description: str
    severity: str = "Medium"

class IssueResolve(BaseModel):
    resolution_notes: str
    resolution_time_hours: Optional[float] = 24.0
