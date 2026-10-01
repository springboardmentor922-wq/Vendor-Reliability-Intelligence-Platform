from typing import Optional
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.contract import ContractStatus, CertificationStatus


class ContractBase(BaseModel):
    vendor_id: UUID
    title: str
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    value: float = 0.0


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    value: Optional[float] = None
    status: Optional[ContractStatus] = None


class ContractOut(ContractBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contract_number: str
    status: ContractStatus
    file_path: Optional[str] = None
    created_by_id: UUID
    created_at: datetime


class CertificationBase(BaseModel):
    vendor_id: UUID
    contract_id: Optional[int] = None
    name: str
    issuing_body: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class CertificationCreate(CertificationBase):
    pass


class CertificationOut(CertificationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: CertificationStatus
    file_path: Optional[str] = None
    created_at: datetime