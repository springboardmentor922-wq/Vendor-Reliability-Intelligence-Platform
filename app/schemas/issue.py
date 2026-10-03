from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.issue import IssueStatus


class IssueCreate(BaseModel):
    vendor_id: int
    purchase_order_id: Optional[int] = None
    title: str
    description: Optional[str] = None


class IssueOut(BaseModel):
    id: int
    vendor_id: int
    purchase_order_id: Optional[int]
    title: str
    description: Optional[str]
    status: IssueStatus
    raised_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True