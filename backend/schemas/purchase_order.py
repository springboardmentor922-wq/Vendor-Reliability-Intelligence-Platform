from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from models import InvoiceStatus, PurchaseOrderStatus


class PurchaseOrderItemBase(BaseModel):
    item_name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    unit: str = Field(default="Units", max_length=30)
    unit_price: Decimal = Field(default=Decimal("0"), ge=0)


class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    pass


class PurchaseOrderItemResponse(PurchaseOrderItemBase):
    id: int
    purchase_order_id: int
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderBase(BaseModel):
    vendor_id: int
    procurement_request_id: Optional[int] = None
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    order_date: Optional[date] = None
    expected_delivery: Optional[date] = None
    currency: str = Field(default="USD", max_length=10)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0)
    shipping_amount: Decimal = Field(default=Decimal("0"), ge=0)
    payment_terms: Optional[str] = Field(default=None, max_length=100)
    shipping_address: Optional[str] = None
    notes: Optional[str] = None


class PurchaseOrderCreate(PurchaseOrderBase):
    # Optional; generated as PO-2026-0001 when omitted.
    po_number: Optional[str] = Field(default=None, max_length=50)
    items: list[PurchaseOrderItemCreate] = Field(min_length=1)


class PurchaseOrderUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    expected_delivery: Optional[date] = None
    currency: Optional[str] = Field(default=None, max_length=10)
    tax_amount: Optional[Decimal] = Field(default=None, ge=0)
    shipping_amount: Optional[Decimal] = Field(default=None, ge=0)
    payment_terms: Optional[str] = Field(default=None, max_length=100)
    shipping_address: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[list[PurchaseOrderItemCreate]] = None


class PurchaseOrderStatusUpdate(BaseModel):
    status: str
    actual_delivery: Optional[date] = None
    comments: Optional[str] = None


class PurchaseOrderResponse(BaseModel):
    id: int
    po_number: str
    vendor_id: int
    vendor_name: Optional[str] = None
    procurement_request_id: Optional[int] = None
    request_number: Optional[str] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    order_date: Optional[date] = None
    expected_delivery: Optional[date] = None
    actual_delivery: Optional[date] = None
    currency: str
    subtotal: Decimal
    tax_amount: Decimal
    shipping_amount: Decimal
    total_amount: Decimal
    payment_terms: Optional[str] = None
    shipping_address: Optional[str] = None
    notes: Optional[str] = None
    status: str
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    # True once actual_delivery is later than expected_delivery.
    is_delayed: bool = False
    days_late: int = 0

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderDetail(PurchaseOrderResponse):
    items: list[PurchaseOrderItemResponse] = []
    invoices: list["InvoiceResponse"] = []


class PurchaseOrderStats(BaseModel):
    total: int
    pending: int
    approved: int
    ordered: int
    delivered: int
    completed: int
    cancelled: int
    total_value: Decimal
    open_value: Decimal
    delayed: int
    on_time_rate: float


# ---------------------------------------------------------
# Invoices
# ---------------------------------------------------------

class InvoiceCreate(BaseModel):
    invoice_number: Optional[str] = Field(default=None, max_length=50)
    purchase_order_id: Optional[int] = None
    vendor_id: Optional[int] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    amount: Decimal = Field(ge=0)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = Field(default="USD", max_length=10)
    document_path: Optional[str] = None
    notes: Optional[str] = None


class InvoiceUpdate(BaseModel):
    due_date: Optional[date] = None
    amount: Optional[Decimal] = Field(default=None, ge=0)
    tax_amount: Optional[Decimal] = Field(default=None, ge=0)
    status: Optional[str] = None
    payment_date: Optional[date] = None
    document_path: Optional[str] = None
    notes: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    purchase_order_id: Optional[int] = None
    po_number: Optional[str] = None
    vendor_id: int
    vendor_name: Optional[str] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    currency: str
    status: str
    payment_date: Optional[date] = None
    document_path: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


PurchaseOrderDetail.model_rebuild()

PURCHASE_ORDER_STATUSES = PurchaseOrderStatus.ALL
INVOICE_STATUSES = InvoiceStatus.ALL
