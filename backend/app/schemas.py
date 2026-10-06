from datetime import date
from pydantic import BaseModel, EmailStr, ConfigDict

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "Vendor"

class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str

class VendorIn(BaseModel):
    name: str
    category: str
    contact_name: str
    email: EmailStr
    phone: str

class POIn(BaseModel):
    vendor_id: int
    item: str
    quantity: int
    unit_price: float
    expected_delivery: date

class StatusIn(BaseModel):
    status: str

class ContractIn(BaseModel):
    vendor_id: int
    contract_number: str
    expiry_date: date
    value: float
    compliance_status: str = "Compliant"
    document_status: str = "Complete"

class PerformanceIn(BaseModel):
    vendor_id: int
    period: str
    on_time_deliveries: int
    total_deliveries: int
    quality_rating: float
    response_hours: float
    contracts_passed: int
    contracts_checked: int
    orders_completed: int
    orders_total: int
    issues_resolved_on_time: int
    issues_total: int

class MessageIn(BaseModel):
    vendor_id: int
    body: str

class ModelBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
