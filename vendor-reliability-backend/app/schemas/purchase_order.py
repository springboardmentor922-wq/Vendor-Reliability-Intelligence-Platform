from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.vendor import VendorResponse
from app.schemas.auth import UserResponse

class POItemCreate(BaseModel):
    item_name: str
    description: Optional[str] = None
    quantity: float = 1.0
    unit_price: float = 0.0
    sku: Optional[str] = None

class POItemResponse(POItemCreate):
    id: int
    purchase_order_id: int
    total_price: float

    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderCreate(BaseModel):
    procurement_request_id: Optional[int] = None
    vendor_id: int
    currency: str = "USD"
    expected_delivery_date: Optional[datetime] = None
    shipping_address: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    items: List[POItemCreate] = []

class PurchaseOrderStatusUpdate(BaseModel):
    status: str # Draft, Pending Approval, Approved, Issued, Delivered, Completed, Cancelled
    actual_delivery_date: Optional[datetime] = None

class PurchaseOrderResponse(BaseModel):
    id: int
    po_number: str
    procurement_request_id: Optional[int] = None
    vendor_id: int
    created_by_id: Optional[int] = None
    total_amount: float
    currency: str
    status: str
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    terms_and_conditions: Optional[str] = None
    shipping_address: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: List[POItemResponse] = []
    vendor: Optional[VendorResponse] = None
    created_by: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)
