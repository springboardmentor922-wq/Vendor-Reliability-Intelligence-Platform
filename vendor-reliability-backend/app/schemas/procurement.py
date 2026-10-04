from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.schemas.vendor import VendorResponse
from app.schemas.auth import UserResponse

class ProcurementCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    assigned_vendor_id: Optional[int] = None
    estimated_budget: float = 0.0
    priority: str = "Medium"
    delivery_deadline: Optional[datetime] = None

class ProcurementUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    assigned_vendor_id: Optional[int] = None
    estimated_budget: Optional[float] = None
    priority: Optional[str] = None
    delivery_deadline: Optional[datetime] = None

class ProcurementStatusUpdate(BaseModel):
    status: str # Pending, Approved, Ordered, Delivered, Completed, Cancelled
    rejection_reason: Optional[str] = None

class ProcurementResponse(BaseModel):
    id: int
    request_number: str
    title: str
    description: Optional[str] = None
    category: str
    requested_by_id: Optional[int] = None
    assigned_vendor_id: Optional[int] = None
    estimated_budget: float
    priority: str
    status: str
    approved_by_id: Optional[int] = None
    approval_date: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    delivery_deadline: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    requested_by: Optional[UserResponse] = None
    vendor: Optional[VendorResponse] = None

    model_config = ConfigDict(from_attributes=True)
