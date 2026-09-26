from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from models import ComplianceStatus, ContractStatus

CONTRACT_TYPES = [
    "Supply Agreement",
    "Service Agreement",
    "Master Agreement",
    "Service Level Agreement",
    "Non-Disclosure Agreement",
    "Maintenance Agreement"
]

CHECK_TYPES = [
    "Documentation",
    "Certification",
    "Delivery Terms",
    "Payment Terms",
    "Quality",
    "Regulatory"
]


class ContractBase(BaseModel):
    vendor_id: int
    title: Optional[str] = Field(default=None, max_length=200)
    contract_type: str = "Supply Agreement"
    start_date: date
    expiry_date: date
    contract_value: Optional[Decimal] = Field(default=None, ge=0)
    currency: str = Field(default="USD", max_length=10)
    auto_renew: bool = False
    renewal_notice_days: int = Field(default=30, ge=0, le=365)
    document_path: Optional[str] = None
    terms: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("contract_type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        if value not in CONTRACT_TYPES:
            raise ValueError(
                f"contract_type must be one of: {', '.join(CONTRACT_TYPES)}"
            )
        return value

    @field_validator("expiry_date")
    @classmethod
    def validate_dates(cls, value: date, info) -> date:
        start = info.data.get("start_date")
        if start and value <= start:
            raise ValueError("expiry_date must be after start_date")
        return value


class ContractCreate(ContractBase):
    # Optional; generated as CT-2026-0001 when omitted.
    contract_number: Optional[str] = Field(default=None, max_length=50)
    status: str = ContractStatus.DRAFT


class ContractUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    contract_type: Optional[str] = None
    start_date: Optional[date] = None
    expiry_date: Optional[date] = None
    contract_value: Optional[Decimal] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, max_length=10)
    auto_renew: Optional[bool] = None
    renewal_notice_days: Optional[int] = Field(default=None, ge=0, le=365)
    status: Optional[str] = None
    compliance_status: Optional[str] = None
    document_path: Optional[str] = None
    terms: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in ContractStatus.ALL:
            raise ValueError(
                f"status must be one of: {', '.join(ContractStatus.ALL)}"
            )
        return value

    @field_validator("compliance_status")
    @classmethod
    def validate_compliance(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in ComplianceStatus.ALL:
            raise ValueError(
                f"compliance_status must be one of: "
                f"{', '.join(ComplianceStatus.ALL)}"
            )
        return value


class ContractRenewal(BaseModel):
    """Create a successor contract from an existing one."""

    start_date: date
    expiry_date: date
    contract_value: Optional[Decimal] = Field(default=None, ge=0)
    notes: Optional[str] = None


class ContractResponse(BaseModel):
    id: int
    contract_number: str
    vendor_id: int
    vendor_name: Optional[str] = None
    title: Optional[str] = None
    contract_type: str
    start_date: date
    expiry_date: date
    contract_value: Optional[Decimal] = None
    currency: str
    auto_renew: bool
    renewal_notice_days: int
    renewed_from_id: Optional[int] = None
    status: str
    compliance_status: str
    document_path: Optional[str] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    terms: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    days_to_expiry: int = 0
    is_expiring_soon: bool = False

    model_config = ConfigDict(from_attributes=True)


class ComplianceCheckCreate(BaseModel):
    check_type: str
    check_date: Optional[date] = None
    result: str = ComplianceStatus.COMPLIANT
    remarks: Optional[str] = None

    @field_validator("check_type")
    @classmethod
    def validate_check_type(cls, value: str) -> str:
        if value not in CHECK_TYPES:
            raise ValueError(
                f"check_type must be one of: {', '.join(CHECK_TYPES)}"
            )
        return value

    @field_validator("result")
    @classmethod
    def validate_result(cls, value: str) -> str:
        allowed = ["Compliant", "Partial", "Non-Compliant"]
        if value not in allowed:
            raise ValueError(f"result must be one of: {', '.join(allowed)}")
        return value


class ComplianceCheckResponse(BaseModel):
    id: int
    vendor_id: int
    contract_id: Optional[int] = None
    check_type: str
    check_date: date
    result: str
    remarks: Optional[str] = None
    checked_by: Optional[int] = None
    checked_by_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ContractDetail(ContractResponse):
    compliance_checks: list[ComplianceCheckResponse] = []


class CertificationCreate(BaseModel):
    certification_name: str = Field(min_length=2, max_length=150)
    issuing_authority: Optional[str] = Field(default=None, max_length=150)
    certificate_number: Optional[str] = Field(default=None, max_length=80)
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    document_path: Optional[str] = None


class CertificationResponse(CertificationCreate):
    id: int
    vendor_id: int
    status: str
    days_to_expiry: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ContractStatsResponse(BaseModel):
    total: int
    draft: int
    active: int
    expiring: int
    expired: int
    terminated: int
    renewed: int
    total_value: Decimal
    compliant: int
    non_compliant: int
    expiring_within_30_days: int
