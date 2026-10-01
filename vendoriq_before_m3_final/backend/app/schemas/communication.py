from typing import Optional
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.communication import MessageCategory


class MessageBase(BaseModel):
    receiver_id: Optional[UUID] = None
    vendor_id: Optional[UUID] = None
    category: MessageCategory = MessageCategory.GENERAL
    subject: Optional[str] = None
    body: str
    related_procurement_id: Optional[int] = None
    related_po_id: Optional[int] = None


class MessageCreate(MessageBase):
    pass


class MessageOut(MessageBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_id: UUID
    is_read: bool
    attachment_path: Optional[str] = None
    created_at: datetime


class ActivityLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[UUID] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: UUID
    type: str
    title: str
    message: Optional[str] = None
    is_read: bool
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None
    created_at: datetime