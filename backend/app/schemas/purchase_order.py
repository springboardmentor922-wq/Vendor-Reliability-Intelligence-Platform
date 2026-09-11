from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class PurchaseOrderBase(BaseModel):
    vendor_id: int
    order_number: str
    title: str
    total_amount: float
    expected_delivery_date: date
    status: Optional[str] = "Pending"
    department: Optional[str] = "Supply Chain & Logistics"
    shipping_mode: Optional[str] = "Standard Class"
    destination_country: Optional[str] = "United States"
    destination_city: Optional[str] = None
    items_count: Optional[int] = 1
    unit_price: Optional[float] = None
    product_category: Optional[str] = None
    priority: Optional[str] = "Standard"
    notes: Optional[str] = None

class PurchaseOrderCreate(BaseModel):
    vendor_id: int
    title: str
    total_amount: float
    expected_delivery_date: date
    order_number: Optional[str] = None
    department: Optional[str] = "Supply Chain & Logistics"
    shipping_mode: Optional[str] = "Standard Class"
    destination_country: Optional[str] = "United States"
    destination_city: Optional[str] = None
    items_count: Optional[int] = 1
    unit_price: Optional[float] = None
    product_category: Optional[str] = None
    priority: Optional[str] = "Standard"
    notes: Optional[str] = None

class PurchaseOrderStatusUpdate(BaseModel):
    status: str

class PurchaseOrderDispatch(BaseModel):
    carrier_name: str
    tracking_number: str

class PurchaseOrderQA(BaseModel):
    quality_rating: float
    qa_notes: Optional[str] = None

class PurchaseOrderInvoice(BaseModel):
    invoice_number: str
    invoice_amount: float

class PurchaseOrderPayment(BaseModel):
    payment_notes: Optional[str] = None

class PurchaseOrderResponse(PurchaseOrderBase):
    id: int
    created_at: Optional[datetime] = None
    actual_delivery_date: Optional[date] = None
    quality_rating: Optional[float] = None
    issue_flag: Optional[bool] = False
    issue_resolved: Optional[bool] = True
    response_time_hours: Optional[float] = None
    vendor_name: Optional[str] = None
    carrier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    dispatch_date: Optional[date] = None
    qa_notes: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_amount: Optional[float] = None
    invoice_status: Optional[str] = "None"
    payment_date: Optional[date] = None
    payment_notes: Optional[str] = None

    class Config:
        from_attributes = True
