from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.models.procurement import ProcurementStatus, ProcurementPriority


class ProcurementRequestBase(BaseModel):
    title: str
    description: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    quantity: int = 1
    unit: Optional[str] = None
    estimated_budget: float = 0.0
    priority: ProcurementPriority = ProcurementPriority.MEDIUM
    required_date: Optional[datetime] = None


class ProcurementRequestCreate(ProcurementRequestBase):
    assigned_vendor_id: Optional[int] = None


class ProcurementRequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    estimated_budget: Optional[float] = None
    priority: Optional[ProcurementPriority] = None
    required_date: Optional[datetime] = None
    assigned_vendor_id: Optional[int] = None


class ProcurementApproval(BaseModel):
    status: ProcurementStatus
    approval_notes: Optional[str] = None


class ProcurementRequestOut(ProcurementRequestBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_number: str
    status: ProcurementStatus
    requested_by_id: int
    approved_by_id: Optional[int] = None
    approval_notes: Optional[str] = None
    assigned_vendor_id: Optional[int] = None
    created_at: datetime
