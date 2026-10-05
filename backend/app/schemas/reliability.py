from datetime import date
from decimal import Decimal
from pydantic import BaseModel


class ReliabilityFactor(BaseModel):
    name: str
    score: Decimal | None
    description: str
    status: str


class ReliabilityTrend(BaseModel):
    evaluation_date: date
    performance_score: Decimal
    reliability_score: Decimal


class VendorReliabilitySummary(BaseModel):
    vendor_id: int
    vendor_name: str
    category: str
    vendor_status: str

    reliability_score: Decimal | None
    supplier_ranking: int | None
    procurement_risk_level: str

    data_completeness: Decimal
    available_factor_count: int
    total_factor_count: int

    factors: list[ReliabilityFactor]
    trend: list[ReliabilityTrend]
    recommendations: list[str]