from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.schemas.auth import UserResponse

class MessageCreate(BaseModel):
    vendor_id: int
    body: str
    file_path: Optional[str] = None

class MessageResponse(BaseModel):
    id: int
    vendor_id: int
    sender_id: int
    body: str
    file_path: Optional[str] = None
    is_read: bool
    timestamp: datetime
    sender: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class DirectEmailCreate(BaseModel):
    vendor_id: int
    recipient_email: str
    subject: str
    priority: str = "Standard"
    reference_type: Optional[str] = "General"
    reference_id: Optional[str] = None
    body: str
    attachment_name: Optional[str] = None

class DirectEmailResponse(BaseModel):
    message_id: int
    vendor_id: int
    recipient_email: str
    subject: str
    priority: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    body: str
    attachment_name: Optional[str] = None
    sender_name: str
    sender_email: str
    sent_at: datetime
    delivery_status: str

class InternalMessageCreate(BaseModel):
    channel: str
    body: str
    file_path: Optional[str] = None

class InternalMessageResponse(BaseModel):
    id: int
    channel: str
    sender_id: int
    body: str
    file_path: Optional[str] = None
    is_read: bool
    timestamp: datetime
    sender: Optional[UserResponse] = None

    class Config:
        from_attributes = True


