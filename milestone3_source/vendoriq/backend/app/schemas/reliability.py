from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.models.reliability import RiskLevel, TrendDirection


class ReliabilityScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vendor_id: int
    score: float
    risk_level: RiskLevel
    trend: TrendDirection
    recommendation: Optional[str] = None
    delivery_score: float
    quality_score: float
    communication_score: float
    compliance_score: float
    purchase_history_score: float
    issue_resolution_score: float
    calculated_at: datetime


class VendorRankingEntry(BaseModel):
    vendor_id: int
    company_name: str
    category: str
    score: float
    risk_level: RiskLevel
    recommendation: Optional[str] = None


class RiskSummary(BaseModel):
    low: int
    medium: int
    high: int
    not_yet_scored: int
