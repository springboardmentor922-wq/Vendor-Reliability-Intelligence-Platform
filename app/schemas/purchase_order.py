from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.purchase_order import OrderStatus


class PurchaseOrderCreate(BaseModel):
    vendor_id: int
    order_number: str
    item_description: str
    quantity: int
    unit_price: float
    expected_delivery_date: Optional[datetime] = None


class PurchaseOrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None
    actual_delivery_date: Optional[datetime] = None


class PurchaseOrderOut(BaseModel):
    id: int
    order_number: str
    vendor_id: int
    created_by_id: int
    item_description: str
    quantity: int
    unit_price: float
    total_amount: float
    status: OrderStatus
    expected_delivery_date: Optional[datetime]
    actual_delivery_date: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True