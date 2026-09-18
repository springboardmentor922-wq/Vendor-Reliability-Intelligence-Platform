from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.procurement_request import RequestStatus


class ProcurementRequestCreate(BaseModel):
    request_number: str
    title: str
    department: str
    description: Optional[str] = None


class ProcurementRequestUpdate(BaseModel):
    status: Optional[RequestStatus] = None


class ProcurementRequestOut(BaseModel):
    id: int
    request_number: str
    title: str
    department: str
    description: Optional[str]
    requested_by_id: int
    status: RequestStatus
    created_at: datetime

    class Config:
        from_attributes = True