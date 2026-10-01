from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.models.performance import IssueStatus


class QualityEvaluationBase(BaseModel):
    vendor_id: int
    purchase_order_id: Optional[int] = None
    rating: float
    defects_count: int = 0
    rejected_items_count: int = 0
    complaints: Optional[str] = None
    notes: Optional[str] = None


class QualityEvaluationCreate(QualityEvaluationBase):
    pass


class QualityEvaluationOut(QualityEvaluationBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    evaluated_by_id: int
    created_at: datetime


class IssueBase(BaseModel):
    vendor_id: int
    purchase_order_id: Optional[int] = None
    title: str
    description: Optional[str] = None


class IssueCreate(IssueBase):
    pass


class IssueResolve(BaseModel):
    resolution_notes: Optional[str] = None


class IssueOut(IssueBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: IssueStatus
    raised_by_id: int
    raised_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None


class PerformanceSnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vendor_id: int
    period: str
    on_time_deliveries: int
    delayed_deliveries: int
    quality_rating: float
    response_time_hours: Optional[float] = None
    issue_resolution_hours: Optional[float] = None
    completion_rate: float
    created_at: datetime


class VendorMetrics(BaseModel):
    vendor_id: int
    on_time_deliveries: int
    delayed_deliveries: int
    total_delivered: int
    on_time_rate: float
    quality_rating: float
    avg_response_time_hours: Optional[float] = None
    avg_issue_resolution_hours: Optional[float] = None
    order_completion_rate: float
    total_orders: int
    open_issues: int
