from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PerformanceRecordResponse(BaseModel):
    id: int
    vendor_id: int
    purchase_order_id: Optional[int] = None
    on_time: bool
    quality_rating: float
    response_time_hours: float
    issue_resolution_hours: float
    recorded_at: datetime

    class Config:
        from_attributes = True


class ReliabilityScoreResponse(BaseModel):
    id: int
    vendor_id: int
    score: float
    risk_level: str
    calculated_at: datetime

    class Config:
        from_attributes = True
