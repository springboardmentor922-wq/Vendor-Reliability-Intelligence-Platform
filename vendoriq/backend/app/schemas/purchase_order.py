from typing import Optional, List
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.purchase_order import POStatus, InvoiceStatus


class POItemBase(BaseModel):
    item_name: str
    description: Optional[str] = None
    quantity: int = 1
    unit_price: float = 0.0


class POItemCreate(POItemBase):
    pass


class POItemOut(POItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    total_price: float


class PurchaseOrderBase(BaseModel):
    procurement_request_id: Optional[int] = None
    vendor_id: UUID
    expected_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None


class PurchaseOrderCreate(PurchaseOrderBase):
    items: List[POItemCreate]


class PurchaseOrderUpdate(BaseModel):
    expected_delivery_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None


class PurchaseOrderStatusUpdate(BaseModel):
    status: POStatus


class PurchaseOrderOut(PurchaseOrderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    po_number: str
    status: POStatus
    total_amount: float
    order_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    created_by_id: UUID
    created_at: datetime
    items: List[POItemOut] = []


class InvoiceBase(BaseModel):
    purchase_order_id: int
    invoice_number: str
    amount: float
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceStatusUpdate(BaseModel):
    status: InvoiceStatus


class InvoiceOut(InvoiceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: InvoiceStatus
    file_path: Optional[str] = None
    created_at: datetime