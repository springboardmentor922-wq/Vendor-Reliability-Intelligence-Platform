from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


PROCUREMENT_PRIORITIES = [
    "Low",
    "Normal",
    "High",
    "Urgent",
]

PROCUREMENT_STATUSES = [
    "Pending",
    "Approved",
    "Ordered",
    "Delivered",
    "Completed",
    "Cancelled",
    "Rejected",
]


class ProcurementCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    vendor_id: int | None = None
    category: str = Field(..., min_length=2, max_length=100)
    quantity: int = Field(..., gt=0)
    estimated_cost: Decimal = Field(..., ge=0)
    priority: str = "Normal"


class ProcurementUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=2,
        max_length=200
    )

    vendor_id: int | None = None

    category: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )

    quantity: int | None = Field(
        default=None,
        gt=0
    )

    estimated_cost: Decimal | None = Field(
        default=None,
        ge=0
    )

    priority: str | None = None


class ProcurementStatusUpdate(BaseModel):
    status: str


class ProcurementResponse(BaseModel):
    id: int
    title: str
    vendor_id: int | None
    category: str
    quantity: int
    estimated_cost: Decimal
    priority: str
    status: str
    created_by: int | None
    created_at: datetime

    class Config:
        from_attributes = True