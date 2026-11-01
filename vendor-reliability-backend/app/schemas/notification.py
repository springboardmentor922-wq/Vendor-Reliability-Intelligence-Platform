from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class NotificationCreate(BaseModel):
    user_id: Optional[int] = None
    title: str
    message: str
    type: str = "system"
    reference_id: Optional[int] = None
    reference_type: Optional[str] = None

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str
    is_read: bool
    reference_id: Optional[int] = None
    reference_type: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
