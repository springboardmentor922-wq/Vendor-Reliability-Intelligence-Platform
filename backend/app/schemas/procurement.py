from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime
from app.models.enums import RequestStatus, POStatus, InvoiceStatus
from app.schemas.auth import UserResponse
from app.schemas.vendor import VendorResponse

class ProcurementRequestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    department: Optional[str] = "Production"
    requested_by_name: Optional[str] = None
    quantity: Optional[str] = None
    needed_by: Optional[date] = None
    priority: Optional[str] = "Medium"
    category: Optional[str] = None
    justification: Optional[str] = None

class ProcurementRequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    requested_by_name: Optional[str] = None
    quantity: Optional[str] = None
    needed_by: Optional[date] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    justification: Optional[str] = None

class ProcurementRequestStatusUpdate(BaseModel):
    status: RequestStatus

class ProcurementRequestResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    department: Optional[str] = "Production"
    requested_by_name: Optional[str] = None
    quantity: Optional[str] = None
    needed_by: Optional[date] = None
    priority: Optional[str] = "Medium"
    category: Optional[str] = None
    justification: Optional[str] = None
    requested_by_id: int
    status: RequestStatus
    created_at: datetime
    updated_at: datetime
    requested_by: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class PurchaseOrderItemCreate(BaseModel):
    item_name: str
    quantity: float = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)

class PurchaseOrderItemResponse(BaseModel):
    id: int
    purchase_order_id: int
    item_name: str
    quantity: float
    unit_price: float

    class Config:
        from_attributes = True


class PurchaseOrderCreate(BaseModel):
    procurement_request_id: Optional[int] = None
    vendor_id: int
    expected_delivery_date: date
    payment_terms: Optional[str] = "Net 15"
    items: List[PurchaseOrderItemCreate]

class PurchaseOrderStatusUpdate(BaseModel):
    status: POStatus
    actual_delivery_date: Optional[date] = None

class PurchaseOrderResponse(BaseModel):
    id: int
    po_number: str
    procurement_request_id: Optional[int] = None
    vendor_id: int
    status: POStatus
    total_amount: float
    expected_delivery_date: date
    actual_delivery_date: Optional[date] = None
    payment_terms: Optional[str] = "Net 15"
    created_by_id: Optional[int] = None
    approved_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    vendor: Optional[VendorResponse] = None
    created_by: Optional[UserResponse] = None
    approved_by: Optional[UserResponse] = None
    items: List[PurchaseOrderItemResponse] = []

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    purchase_order_id: int
    amount: float = Field(..., gt=0)
    due_date: date

class InvoiceStatusUpdate(BaseModel):
    status: InvoiceStatus
    paid_date: Optional[date] = None

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    purchase_order_id: int
    amount: float
    status: InvoiceStatus
    due_date: date
    paid_date: Optional[date] = None
    created_at: datetime
    purchase_order: Optional[PurchaseOrderResponse] = None

    class Config:
        from_attributes = True
