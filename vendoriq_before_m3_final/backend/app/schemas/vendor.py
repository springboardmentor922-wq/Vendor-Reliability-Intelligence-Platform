from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.vendor import VendorCategory, VendorStatus


# ============================================================
# VENDOR CONTACT SCHEMAS
# ============================================================

class VendorContactBase(BaseModel):
    name: str
    designation: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_primary: bool = False


class VendorContactCreate(VendorContactBase):
    pass


class VendorContactOut(VendorContactBase):
    id: UUID
    vendor_id: UUID

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# VENDOR SCHEMAS
# ============================================================

class VendorBase(BaseModel):
    company_name: str
    category: VendorCategory

    registration_number: Optional[str] = None
    tax_id: Optional[str] = None

    contact_person: str
    email: str
    phone: str

    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None


class VendorCreate(VendorBase):
    contacts: Optional[List[VendorContactCreate]] = Field(
        default=None
    )


class VendorUpdate(BaseModel):
    company_name: Optional[str] = None
    category: Optional[VendorCategory] = None

    registration_number: Optional[str] = None
    tax_id: Optional[str] = None

    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None


class VendorApproval(BaseModel):
    status: VendorStatus
    approval_notes: Optional[str] = None


class VendorOut(VendorBase):
    id: UUID
    user_id: Optional[UUID] = None

    status: VendorStatus
    approved_by_id: Optional[UUID] = None
    approval_notes: Optional[str] = None

    rating: float
    is_active: bool

    contacts: List[VendorContactOut] = Field(
        default_factory=list
    )

    model_config = ConfigDict(from_attributes=True)