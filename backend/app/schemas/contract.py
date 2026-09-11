from pydantic import BaseModel
from typing import Optional
from datetime import date

class ContractBase(BaseModel):
    vendor_id: int
    contract_number: str
    title: str
    start_date: date
    end_date: date
    value: float
    compliance_status: Optional[str] = "Compliant"
    document_url: Optional[str] = None

class ContractCreate(BaseModel):
    vendor_id: int
    contract_number: Optional[str] = None
    title: str
    start_date: date
    end_date: date
    value: float
    compliance_status: Optional[str] = "Compliant"

class ContractResponse(ContractBase):
    id: int
    vendor_name: Optional[str] = None

    class Config:
        from_attributes = True
