from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


VENDOR_CATEGORIES = [
    "Raw Material Suppliers",
    "Equipment Vendors",
    "IT Vendors",
    "Service Providers",
    "Logistics Partners",
    "Maintenance Vendors",
]


VENDOR_STATUSES = [
    "Pending",
    "Approved",
    "Rejected",
]


class VendorCreate(BaseModel):

    name: str = Field(
        ...,
        min_length=2,
        max_length=150,
    )

    category: str = Field(
        ...,
        min_length=2,
        max_length=100,
    )

    contact_person: str = Field(
        ...,
        min_length=2,
        max_length=100,
    )

    email: EmailStr

    phone: str = Field(
        ...,
        min_length=5,
        max_length=30,
    )

    location: str | None = Field(
        default=None,
        max_length=150,
    )

    contract_details: str | None = Field(
        default=None,
        max_length=500,
    )


class VendorUpdate(BaseModel):

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    category: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    contact_person: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    email: EmailStr | None = None

    phone: str | None = Field(
        default=None,
        min_length=5,
        max_length=30,
    )

    location: str | None = Field(
        default=None,
        max_length=150,
    )

    contract_details: str | None = Field(
        default=None,
        max_length=500,
    )


class VendorStatusUpdate(BaseModel):

    status: str


class VendorResponse(BaseModel):

    id: int
    name: str
    category: str
    contact_person: str
    email: EmailStr
    phone: str
    status: str

    location: str | None = None
    contract_details: str | None = None

    performance_score: float | None = None
    reliability_score: float | None = None

    created_at: datetime

    class Config:
        from_attributes = True