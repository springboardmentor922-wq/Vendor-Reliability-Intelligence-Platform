from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.enums import VendorCategory, NotificationType

class VendorMetrics(BaseModel):
    vendor_id: int
    company_name: str
    category: str
    status: str
    total_orders: int
    delivered_orders: int
    on_time_orders: int
    delayed_orders: int
    on_time_delivery_rate: float
    average_quality_rating: float
    rating: Optional[float] = 0.0
    average_response_hours: float
    issue_resolution_hours: float
    order_completion_rate: float
    total_spend: float
    active_contracts: int
    completed_contracts: Optional[int] = 0
    active_certifications: int
    reliability_score: float
    reliability_index: Optional[float] = 0.0
    risk_level: str
    supplier_tier: str
    performance_trend: str
    recommendations: List[str]
    monthly_trend: List[Dict[str, Any]]
    factor_breakdown: Optional[Dict[str, Any]] = None

class GlobalAnalyticsOverview(BaseModel):
    total_vendors: int
    average_reliability_score: float
    platform_on_time_rate: float
    high_risk_vendors_count: int
    total_spend: float
    active_orders_count: int
    delayed_orders_count: int
    category_breakdown: List[Dict[str, Any]]
    monthly_delivery_trend: List[Dict[str, Any]]
    risk_tier_distribution: Dict[str, int]
    top_ranked_suppliers: List[Dict[str, Any]]

class POPredictionRequest(BaseModel):
    vendor_id: int
    category: Optional[str] = None
    item_count: int = 1
    total_amount: float = 1000.0
    scheduled_days: int = 7
    shipping_mode: str = "Standard Class"

class POPredictionResponse(BaseModel):
    vendor_id: int
    company_name: str
    late_delivery_risk: bool
    risk_probability: float
    risk_level: str
    predicted_delay_days: float
    reliability_score: float
    key_risk_factors: List[str]
    mitigation_recommendations: List[str]

class NotificationCreate(BaseModel):
    user_id: int
    type: NotificationType = NotificationType.GENERAL
    message: str

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: NotificationType
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
