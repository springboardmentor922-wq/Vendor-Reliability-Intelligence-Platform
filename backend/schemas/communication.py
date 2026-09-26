from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from models import ThreadStatus

PRIORITIES = ["Low", "Medium", "High", "Urgent"]


class AttachmentResponse(BaseModel):
    id: int
    message_id: int
    file_name: str
    file_path: str
    file_size: Optional[int] = None
    content_type: Optional[str] = None
    uploaded_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class MessageCreate(BaseModel):
    body: str = Field(min_length=1)


class MessageResponse(BaseModel):
    id: int
    thread_id: int
    sender_id: int
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None
    body: str
    is_read: bool
    created_at: Optional[datetime] = None
    attachments: list[AttachmentResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ThreadCreate(BaseModel):
    subject: str = Field(min_length=2, max_length=200)
    vendor_id: Optional[int] = None
    purchase_order_id: Optional[int] = None
    procurement_request_id: Optional[int] = None
    contract_id: Optional[int] = None
    priority: str = "Medium"
    # First message posted alongside the thread.
    body: str = Field(min_length=1)

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: str) -> str:
        if value not in PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(PRIORITIES)}")
        return value


class ThreadUpdate(BaseModel):
    subject: Optional[str] = Field(default=None, min_length=2, max_length=200)
    status: Optional[str] = None
    priority: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in ThreadStatus.ALL:
            raise ValueError(
                f"status must be one of: {', '.join(ThreadStatus.ALL)}"
            )
        return value

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in PRIORITIES:
            raise ValueError(f"priority must be one of: {', '.join(PRIORITIES)}")
        return value


class ThreadResponse(BaseModel):
    id: int
    subject: str
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    purchase_order_id: Optional[int] = None
    po_number: Optional[str] = None
    procurement_request_id: Optional[int] = None
    request_number: Optional[str] = None
    contract_id: Optional[int] = None
    contract_number: Optional[str] = None
    created_by: int
    created_by_name: Optional[str] = None
    status: str
    priority: str
    last_message_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    message_count: int = 0
    unread_count: int = 0
    last_message_preview: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ThreadDetail(ThreadResponse):
    messages: list[MessageResponse] = []


class ActivityLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    entity_type: str
    entity_id: Optional[int] = None
    action: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


THREAD_STATUSES = ThreadStatus.ALL
