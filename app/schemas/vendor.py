from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from app.models.vendor import VendorCategory, VendorStatus


class VendorCreate(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    category: VendorCategory


class VendorUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    category: Optional[VendorCategory] = None
    status: Optional[VendorStatus] = None


class VendorOut(BaseModel):
    id: int
    company_name: str
    contact_person: Optional[str]
    email: EmailStr
    phone: Optional[str]
    address: Optional[str]
    category: VendorCategory
    status: VendorStatus
    reliability_score: float
    created_at: datetime

    class Config:
        from_attributes = True