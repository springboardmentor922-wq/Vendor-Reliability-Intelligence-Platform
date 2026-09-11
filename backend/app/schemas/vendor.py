from pydantic import BaseModel, EmailStr
from typing import Optional

class VendorBase(BaseModel):
    company_name: str
    contact_name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    category: str
    tax_id: Optional[str] = None
    country: Optional[str] = "United States"
    city: Optional[str] = None
    payment_terms: Optional[str] = "Net 30"
    bank_account: Optional[str] = None
    certifications: Optional[str] = None
    website: Optional[str] = None
    risk_tier: Optional[str] = "Low Risk"

class VendorCreate(VendorBase):
    pass

class VendorUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None
    tax_id: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    payment_terms: Optional[str] = None
    bank_account: Optional[str] = None
    certifications: Optional[str] = None
    website: Optional[str] = None
    risk_tier: Optional[str] = None
    status: Optional[str] = None

class VendorResponse(VendorBase):
    id: int
    status: str
    reliability_score: float
    delivery_accuracy: float
    response_time: float

    class Config:
        from_attributes = True
