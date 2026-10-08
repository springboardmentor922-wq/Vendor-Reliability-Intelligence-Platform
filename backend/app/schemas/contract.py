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

class ContractInvoiceSummary(BaseModel):
    id: int
    invoice_number: str
    amount: float
    status: str
    created_at: datetime
    due_date: Optional[date] = None
    purchase_order_id: Optional[int] = None

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
    total_purchase_amount: Optional[float] = 0.0
    invoices: Optional[List[ContractInvoiceSummary]] = []

    class Config:
        from_attributes = True
