from pydantic import BaseModel
from datetime import datetime
from app.models.enums import NotificationType

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: NotificationType
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
