from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.vendor import VendorCategory, VendorStatus


class VendorContactBase(BaseModel):
    name: str
    designation: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_primary: bool = False


class VendorContactCreate(VendorContactBase):
    pass


class VendorContactOut(VendorContactBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vendor_id: int


class VendorBase(BaseModel):
    company_name: str
    category: VendorCategory
    registration_number: Optional[str] = None
    tax_id: Optional[str] = None
    contact_person: str
    email: EmailStr
    phone: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None


class VendorCreate(VendorBase):
    contacts: Optional[List[VendorContactCreate]] = []


class VendorUpdate(BaseModel):
    company_name: Optional[str] = None
    category: Optional[VendorCategory] = None
    registration_number: Optional[str] = None
    tax_id: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    is_active: Optional[bool] = None


class VendorApproval(BaseModel):
    status: VendorStatus
    approval_notes: Optional[str] = None


class VendorOut(VendorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: VendorStatus
    rating: float
    is_active: bool
    approved_by_id: Optional[int] = None
    approval_notes: Optional[str] = None
    created_at: datetime
    contacts: List[VendorContactOut] = []
