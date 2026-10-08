from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.purchase_order import OrderStatus


class PurchaseOrderItemCreate(BaseModel):
    item_description: str
    quantity: int
    unit_price: float
    tax_percent: float = 0.0


class PurchaseOrderItemOut(BaseModel):
    id: int
    item_description: str
    quantity: int
    unit_price: float
    tax_percent: float
    line_total: float

    class Config:
        from_attributes = True


class PurchaseOrderCreate(BaseModel):
    order_number: str
    vendor_id: int
    procurement_request_id: Optional[int] = None
    department: Optional[str] = None
    payment_terms: Optional[str] = None
    shipping_address: Optional[str] = None
    billing_address: Optional[str] = None
    remarks: Optional[str] = None
    expected_delivery_date: Optional[datetime] = None
    items: List[PurchaseOrderItemCreate]
    save_as_draft: bool = False  # True = draft, False = submit for approval


class PurchaseOrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None
    actual_delivery_date: Optional[datetime] = None
    remarks: Optional[str] = None


class PurchaseOrderOut(BaseModel):
    id: int
    order_number: str
    vendor_id: int
    created_by_id: int
    procurement_request_id: Optional[int]
    department: Optional[str]
    payment_terms: Optional[str]
    shipping_address: Optional[str]
    billing_address: Optional[str]
    remarks: Optional[str]
    order_date: datetime
    expected_delivery_date: Optional[datetime]
    actual_delivery_date: Optional[datetime]
    subtotal: float
    tax_amount: float
    total_amount: float
    status: OrderStatus
    items: List[PurchaseOrderItemOut]
    created_at: datetime

    class Config:
        from_attributes = True