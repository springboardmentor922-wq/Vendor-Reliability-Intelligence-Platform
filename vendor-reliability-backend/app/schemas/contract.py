from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.schemas.vendor import VendorResponse

class ContractCreate(BaseModel):
    title: str
    vendor_id: int
    start_date: datetime
    expiry_date: datetime
    renewal_terms: Optional[str] = None
    contract_value: float = 0.0
    compliance_status: str = "Compliant"
    document_name: Optional[str] = None
    document_url: Optional[str] = None

class ContractUpdate(BaseModel):
    title: Optional[str] = None
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    renewal_terms: Optional[str] = None
    contract_value: Optional[float] = None
    status: Optional[str] = None
    compliance_status: Optional[str] = None
    document_name: Optional[str] = None
    document_url: Optional[str] = None

class ContractResponse(BaseModel):
    id: int
    contract_number: str
    title: str
    vendor_id: int
    start_date: datetime
    expiry_date: datetime
    renewal_terms: Optional[str] = None
    status: str
    compliance_status: str
    document_url: Optional[str] = None
    document_name: Optional[str] = None
    contract_value: float
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    vendor: Optional[VendorResponse] = None

    model_config = ConfigDict(from_attributes=True)
