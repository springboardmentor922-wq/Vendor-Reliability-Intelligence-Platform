from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.contract import ContractStatus


class ContractCreate(BaseModel):
    vendor_id: int
    title: str
    document_url: Optional[str] = None
    start_date: datetime
    end_date: datetime
    compliance_notes: Optional[str] = None


class ContractUpdate(BaseModel):
    title: Optional[str] = None
    document_url: Optional[str] = None
    end_date: Optional[datetime] = None
    status: Optional[ContractStatus] = None
    compliance_notes: Optional[str] = None


class ContractOut(BaseModel):
    id: int
    vendor_id: int
    title: str
    document_url: Optional[str]
    start_date: datetime
    end_date: datetime
    status: ContractStatus
    compliance_notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True