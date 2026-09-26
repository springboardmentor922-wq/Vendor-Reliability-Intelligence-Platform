from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from models import VendorCategory, VendorStatus


class VendorContactBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    designation: Optional[str] = Field(default=None, max_length=100)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=30)
    is_primary: bool = False


class VendorContactCreate(VendorContactBase):
    pass


class VendorContactResponse(VendorContactBase):
    id: int
    vendor_id: int

    model_config = ConfigDict(from_attributes=True)


class VendorBase(BaseModel):
    vendor_name: str = Field(min_length=2, max_length=150)
    category: str
    contact_person: Optional[str] = Field(default=None, max_length=120)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=30)
    website: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=100)
    country: Optional[str] = Field(default=None, max_length=100)
    tax_id: Optional[str] = Field(default=None, max_length=60)
    registration_number: Optional[str] = Field(default=None, max_length=60)
    notes: Optional[str] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        if value not in VendorCategory.ALL:
            raise ValueError(
                f"category must be one of: {', '.join(VendorCategory.ALL)}"
            )
        return value


class VendorCreate(VendorBase):
    # Optional; generated as VND-0001 when omitted.
    vendor_code: Optional[str] = Field(default=None, max_length=30)
    risk_level: str = "Medium"
    contacts: list[VendorContactCreate] = []


class VendorUpdate(BaseModel):
    vendor_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    category: Optional[str] = None
    contact_person: Optional[str] = Field(default=None, max_length=120)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=30)
    website: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=100)
    country: Optional[str] = Field(default=None, max_length=100)
    tax_id: Optional[str] = Field(default=None, max_length=60)
    registration_number: Optional[str] = Field(default=None, max_length=60)
    risk_level: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VendorCategory.ALL:
            raise ValueError(
                f"category must be one of: {', '.join(VendorCategory.ALL)}"
            )
        return value


class VendorApprovalAction(BaseModel):
    """Payload for approve / reject / suspend / reactivate."""

    comments: Optional[str] = None
    # Required by the reject action.
    reason: Optional[str] = None


class VendorApprovalResponse(BaseModel):
    id: int
    vendor_id: int
    action: str
    previous_status: Optional[str] = None
    new_status: str
    performed_by: Optional[int] = None
    performed_by_name: Optional[str] = None
    comments: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class VendorResponse(BaseModel):
    id: int
    vendor_code: str
    vendor_name: str
    category: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    tax_id: Optional[str] = None
    registration_number: Optional[str] = None
    status: str
    risk_level: str
    reliability_score: Optional[Decimal] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    onboarded_on: Optional[date] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class VendorDetailResponse(VendorResponse):
    contacts: list[VendorContactResponse] = []
    approvals: list[VendorApprovalResponse] = []
    open_purchase_orders: int = 0
    total_purchase_orders: int = 0
    active_contracts: int = 0
    total_spend: Decimal = Decimal("0")


class VendorDirectoryEntry(BaseModel):
    """Public, non-sensitive vendor identity used by the registration form."""

    id: int
    vendor_code: str
    vendor_name: str

    model_config = ConfigDict(from_attributes=True)


class VendorStatsResponse(BaseModel):
    total: int
    approved: int
    pending: int
    rejected: int
    suspended: int
    inactive: int
    by_category: dict[str, int]
    by_risk_level: dict[str, int]


VENDOR_STATUSES = VendorStatus.ALL
VENDOR_CATEGORIES = VendorCategory.ALL
