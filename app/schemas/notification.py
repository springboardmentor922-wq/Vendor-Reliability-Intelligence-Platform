from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.notification import NotificationType


class NotificationCreate(BaseModel):
    user_id: Optional[int] = None
    vendor_id: Optional[int] = None
    type: NotificationType
    title: str
    message: str


class NotificationOut(BaseModel):
    id: int
    user_id: Optional[int]
    vendor_id: Optional[int]
    type: NotificationType
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True