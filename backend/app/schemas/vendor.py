from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.enums import VendorCategory, VendorStatus

class VendorBase(BaseModel):
    company_name: str
    category: VendorCategory
    contact_person: str
    contact_role: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    payment_terms: Optional[str] = "Net 15"
    notes: Optional[str] = None

class VendorCreate(VendorBase):
    pass

class VendorUpdate(BaseModel):
    company_name: Optional[str] = None
    category: Optional[VendorCategory] = None
    contact_person: Optional[str] = None
    contact_role: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None

class VendorStatusUpdate(BaseModel):
    status: VendorStatus
    notes: Optional[str] = None

class VendorResponse(VendorBase):
    id: int
    status: VendorStatus
    reliability_score: Optional[float] = 0.0
    approved_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PublicVendorShowcase(BaseModel):
    id: int
    company_name: str
    category: str
    status: str
    contact_person: str
    email: str
    city_region: str
    tier: str
    rating: float
    reliability_score: float
    priority: Optional[str] = "medium"

    class Config:
        from_attributes = True

