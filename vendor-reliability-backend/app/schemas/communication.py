from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.schemas.auth import UserResponse

class MessageCreate(BaseModel):
    recipient_id: Optional[int] = None
    vendor_id: Optional[int] = None
    procurement_request_id: Optional[int] = None
    purchase_order_id: Optional[int] = None
    subject: str
    message: str
    attachment_name: Optional[str] = None
    attachment_url: Optional[str] = None

class MessageResponse(BaseModel):
    id: int
    sender_id: Optional[int] = None
    recipient_id: Optional[int] = None
    vendor_id: Optional[int] = None
    procurement_request_id: Optional[int] = None
    purchase_order_id: Optional[int] = None
    subject: str
    message: str
    attachment_name: Optional[str] = None
    attachment_url: Optional[str] = None
    is_read: bool
    created_at: datetime
    sender: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    user: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)
