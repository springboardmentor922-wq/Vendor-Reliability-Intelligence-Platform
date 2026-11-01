from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class InvoiceCreate(BaseModel):
    purchase_order_id: Optional[int] = None
    vendor_id: int
    amount: float
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    payment_method: Optional[str] = "Bank Transfer"
    notes: Optional[str] = None

class InvoiceStatusUpdate(BaseModel):
    status: str # Draft, Submitted, Approved, Paid, Disputed, Cancelled
    paid_date: Optional[datetime] = None
    payment_method: Optional[str] = None

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    purchase_order_id: Optional[int] = None
    vendor_id: int
    amount: float
    status: str
    issue_date: datetime
    due_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    vendor_name: Optional[str] = None
    vendor_company: Optional[str] = None
    vendor: Optional[dict] = None
    three_way_match_status: Optional[str] = None
    blockchain_status: Optional[str] = "CONFIRMED"

    model_config = ConfigDict(from_attributes=True)
