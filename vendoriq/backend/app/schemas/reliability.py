from uuid import UUID
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.models.reliability import RiskLevel, TrendDirection


class ReliabilityScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vendor_id: UUID
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
    vendor_id: UUID
    company_name: str
    category: str
    score: float
    risk_level: RiskLevel
    recommendation: Optional[str] = None


class RiskSummary(BaseModel):
    total_vendors: int
    low_risk: int
    medium_risk: int
    high_risk: int
    critical_risk: int
