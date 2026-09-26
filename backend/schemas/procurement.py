from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from models import ProcurementStatus

PRIORITIES = ["Low", "Medium", "High", "Urgent"]


class ProcurementRequestBase(BaseModel):
    item: str = Field(min_length=2, max_length=150)
    description: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=100)
    quantity: Decimal = Field(gt=0)
    unit: str = Field(default="Units", max_length=30)
    estimated_cost: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = Field(default="USD", max_length=10)
    required_date: Optional[date] = None
    priority: str = "Medium"
    department: Optional[str] = Field(default=None, max_length=100)
    justification: Optional[str] = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: str) -> str:
        if value not in PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(PRIORITIES)}")
        return value


class ProcurementRequestCreate(ProcurementRequestBase):
    # Optional; generated as PR-2026-0001 when omitted.
    request_number: Optional[str] = Field(default=None, max_length=50)
    assigned_vendor_id: Optional[int] = None


class ProcurementRequestUpdate(BaseModel):
    item: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=100)
    quantity: Optional[Decimal] = Field(default=None, gt=0)
    unit: Optional[str] = Field(default=None, max_length=30)
    estimated_cost: Optional[Decimal] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, max_length=10)
    required_date: Optional[date] = None
    priority: Optional[str] = None
    department: Optional[str] = Field(default=None, max_length=100)
    justification: Optional[str] = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(PRIORITIES)}")
        return value


class ProcurementDecision(BaseModel):
    comments: Optional[str] = None
    reason: Optional[str] = None


class VendorAssignment(BaseModel):
    vendor_id: int
    comments: Optional[str] = None


class ProcurementApprovalResponse(BaseModel):
    id: int
    request_id: int
    action: str
    previous_status: Optional[str] = None
    new_status: str
    performed_by: Optional[int] = None
    performed_by_name: Optional[str] = None
    comments: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProcurementRequestResponse(BaseModel):
    id: int
    request_number: str
    requested_by: int
    requester_name: Optional[str] = None
    item: str
    description: Optional[str] = None
    category: Optional[str] = None
    quantity: Decimal
    unit: str
    estimated_cost: Decimal
    currency: str
    required_date: Optional[date] = None
    priority: str
    department: Optional[str] = None
    justification: Optional[str] = None
    status: str
    assigned_vendor_id: Optional[int] = None
    assigned_vendor_name: Optional[str] = None
    approved_by: Optional[int] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProcurementRequestDetail(ProcurementRequestResponse):
    approvals: list[ProcurementApprovalResponse] = []
    purchase_order_ids: list[int] = []


class ProcurementStatsResponse(BaseModel):
    total: int
    pending: int
    approved: int
    rejected: int
    ordered: int
    delivered: int
    completed: int
    cancelled: int
    total_estimated_value: Decimal
    by_priority: dict[str, int]


PROCUREMENT_STATUSES = ProcurementStatus.ALL
