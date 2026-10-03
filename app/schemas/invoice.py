from datetime import datetime
from pydantic import BaseModel
from app.models.invoice import PaymentStatus


class InvoiceCreate(BaseModel):
    invoice_number: str
    purchase_order_id: int
    vendor_id: int
    invoice_amount: float
    invoice_date: datetime
    payment_status: PaymentStatus = PaymentStatus.UNPAID


class InvoiceUpdate(BaseModel):
    payment_status: PaymentStatus


class InvoiceOut(BaseModel):
    id: int
    invoice_number: str
    purchase_order_id: int
    vendor_id: int
    invoice_amount: float
    invoice_date: datetime
    payment_status: PaymentStatus
    created_at: datetime

    class Config:
        from_attributes = True