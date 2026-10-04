from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime

class VendorContactBase(BaseModel):
    contact_name: str
    title: Optional[str] = None
    email: EmailStr
    phone: str
    is_primary: bool = False

class VendorContactCreate(VendorContactBase):
    pass

class VendorContactResponse(VendorContactBase):
    id: int
    vendor_id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class VendorBase(BaseModel):
    name: str
    company: str
    email: EmailStr
    phone: str
    address: Optional[str] = None
    website: Optional[str] = None
    product: str
    category: str = "Raw Material Suppliers"
    status: Optional[str] = "Pending"
    deliveryRate: float = 0.0
    quality_rating: float = 4.0
    response_time_hours: float = 24.0
    risk_level: str = "Low"
    business_reg_number: Optional[str] = None
    gst_tax_id: Optional[str] = None
    bank_details: Optional[str] = None
    notes: Optional[str] = None

class VendorCreate(VendorBase):
    password: Optional[str] = None

class VendorRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    company: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    product: Optional[str] = "General Supplies"
    category: Optional[str] = "Raw Material Suppliers"
    business_reg_number: Optional[str] = None
    gst_tax_id: Optional[str] = None
    notes: Optional[str] = None

class VendorCredentialsUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: str

class VendorCredentialsResponse(BaseModel):
    vendor_id: int
    vendor_name: str
    company: str
    email: str
    role: str = "Vendor"
    user_id: int
    approval_status: str
    is_active: bool
    message: str

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    product: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    deliveryRate: Optional[float] = None
    quality_rating: Optional[float] = None
    response_time_hours: Optional[float] = None
    risk_level: Optional[str] = None
    business_reg_number: Optional[str] = None
    gst_tax_id: Optional[str] = None
    bank_details: Optional[str] = None
    notes: Optional[str] = None

class VendorApproval(BaseModel):
    status: str # "Approved" or "Rejected"
    review_notes: Optional[str] = None

class VendorResponse(VendorBase):
    id: int
    user_id: Optional[int] = None
    reviewed_by_id: Optional[int] = None
    review_notes: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    contacts: List[VendorContactResponse] = []

    model_config = ConfigDict(from_attributes=True)

class VendorCategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
