from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PerformanceRecordCreate(BaseModel):
    vendor_id: int
    purchase_order_id: Optional[int] = None
    on_time_delivery: Optional[bool] = None
    quality_rating: Optional[float] = Field(default=None, ge=1, le=5)
    communication_rating: Optional[float] = Field(default=None, ge=1, le=5)
    response_time_hours: Optional[float] = None
    issue_resolution_hours: Optional[float] = None
    notes: Optional[str] = None


class PerformanceRecordOut(BaseModel):
    id: int
    vendor_id: int
    purchase_order_id: Optional[int]
    on_time_delivery: Optional[bool]
    quality_rating: Optional[float]
    communication_rating: Optional[float]
    response_time_hours: Optional[float]
    issue_resolution_hours: Optional[float]
    notes: Optional[str]
    recorded_at: datetime

    class Config:
        from_attributes = True


class ReliabilityScoreOut(BaseModel):
    vendor_id: int
    reliability_score: float
    total_records: int
    on_time_delivery_rate: Optional[float]
    avg_quality_rating: Optional[float]
    avg_communication_rating: Optional[float]
    avg_response_time_hours: Optional[float]