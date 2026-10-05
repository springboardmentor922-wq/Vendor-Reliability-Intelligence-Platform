from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CommunicationBase(BaseModel):
    vendor_id: int | None = None
    communication_type: str
    subject: str
    message: str
    recipient: str | None = None
    attachment_name: str | None = None
    status: str = "OPEN"


class CommunicationCreate(CommunicationBase):
    pass


class CommunicationResponse(CommunicationBase):
    id: int
    user_id: int | None = None
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class CommunicationStatusUpdate(BaseModel):
    status: str