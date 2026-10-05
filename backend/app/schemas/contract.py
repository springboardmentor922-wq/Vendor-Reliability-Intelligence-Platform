from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


CONTRACT_STATUSES = [
    "Active",
    "Expiring Soon",
    "Expired",
    "Renewed",
    "Terminated",
]

COMPLIANCE_STATUSES = [
    "Compliant",
    "Non-Compliant",
    "Under Review",
]

CERTIFICATION_STATUSES = [
    "Active",
    "Expired",
    "Pending",
]

DOCUMENT_STATUSES = [
    "Active",
    "Expired",
    "Pending",
]


class ContractCreate(BaseModel):
    contract_number: str = Field(
        ..., min_length=2, max_length=100
    )

    title: str = Field(
        ..., min_length=2, max_length=200
    )

    contract_type: str = Field(
        ..., min_length=2, max_length=100
    )

    vendor_id: int

    start_date: date
    end_date: date
    renewal_date: date | None = None

    contract_value: Decimal = Field(
        default=0, ge=0
    )

    payment_terms: str = Field(
        default="", max_length=200
    )

    notes: str | None = None


class ContractUpdate(BaseModel):
    title: str | None = Field(
        default=None, min_length=2, max_length=200
    )

    contract_type: str | None = Field(
        default=None, min_length=2, max_length=100
    )

    vendor_id: int | None = None

    start_date: date | None = None
    end_date: date | None = None
    renewal_date: date | None = None

    contract_value: Decimal | None = Field(
        default=None, ge=0
    )

    payment_terms: str | None = Field(
        default=None, max_length=200
    )

    notes: str | None = None


class ContractStatusUpdate(BaseModel):
    status: str


class ContractComplianceUpdate(BaseModel):
    compliance_status: str


class ContractResponse(BaseModel):
    id: int
    contract_number: str
    title: str
    contract_type: str
    vendor_id: int

    start_date: date
    end_date: date
    renewal_date: date | None

    status: str
    compliance_status: str

    contract_value: Decimal
    payment_terms: str
    notes: str | None

    created_by: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class CertificationCreate(BaseModel):
    vendor_id: int

    name: str = Field(
        ..., min_length=2, max_length=200
    )

    certificate_number: str = Field(
        ..., min_length=2, max_length=100
    )

    issue_date: date
    expiry_date: date


class CertificationStatusUpdate(BaseModel):
    status: str


class CertificationResponse(BaseModel):
    id: int
    vendor_id: int
    name: str
    certificate_number: str
    issue_date: date
    expiry_date: date
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class VendorDocumentCreate(BaseModel):
    vendor_id: int

    document_type: str = Field(
        ..., min_length=2, max_length=100
    )

    document_name: str = Field(
        ..., min_length=2, max_length=200
    )

    document_number: str | None = Field(
        default=None, max_length=100
    )

    issue_date: date | None = None
    expiry_date: date | None = None

    status: str = "Active"

    notes: str | None = None


class VendorDocumentResponse(BaseModel):
    id: int
    vendor_id: int
    document_type: str
    document_name: str
    document_number: str | None
    issue_date: date | None
    expiry_date: date | None
    status: str
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True