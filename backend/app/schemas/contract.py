from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
from app.models.enums import ContractStatus
from app.schemas.vendor import VendorResponse

class CertificationCreate(BaseModel):
    contract_id: Optional[int] = None
    vendor_id: int
    name: str
    issued_date: date
    expiry_date: date
    document_path: Optional[str] = None

class CertificationResponse(BaseModel):
    id: int
    contract_id: Optional[int] = None
    vendor_id: int
    name: str
    issued_date: date
    expiry_date: date
    document_path: Optional[str] = None
    created_at: datetime
    vendor: Optional[VendorResponse] = None

    class Config:
        from_attributes = True


class ContractCreate(BaseModel):
    vendor_id: int
    title: str
    start_date: date
    end_date: date
    file_path: Optional[str] = None

class ContractResponse(BaseModel):
    id: int
    contract_number: str
    vendor_id: int
    title: str
    start_date: date
    end_date: date
    status: ContractStatus
    file_path: Optional[str] = None
    created_at: datetime
    vendor: Optional[VendorResponse] = None
    certifications: List[CertificationResponse] = []

    class Config:
        from_attributes = True
