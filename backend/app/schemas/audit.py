from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.schemas.auth import UserResponse

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    entity: str
    details: Optional[str] = None
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True
