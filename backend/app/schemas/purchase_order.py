
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


PURCHASE_ORDER_STATUSES = [
    "Pending",
    "Approved",
    "Ordered",
    "Delivered",
    "Completed",
    "Cancelled",
]


class PurchaseOrderItemCreate(BaseModel):
    item_description: str = Field(
        ...,
        min_length=2,
        max_length=300
    )

    quantity: int = Field(
        ...,
        gt=0
    )

    unit_price: Decimal = Field(
        ...,
        ge=0
    )

    tax_percent: Decimal = Field(
        default=0,
        ge=0,
        le=100
    )


class PurchaseOrderCreate(BaseModel):
    po_number: str = Field(
        ...,
        min_length=2,
        max_length=50
    )

    order_date: date
    expected_delivery_date: date

    procurement_request_id: int | None = None

    department: str = Field(
        ...,
        min_length=2,
        max_length=100
    )

    vendor_id: int

    payment_terms: str = Field(
        ...,
        min_length=2,
        max_length=200
    )

    shipping_address: str = Field(
        ...,
        min_length=2
    )

    billing_address: str = Field(
        ...,
        min_length=2
    )

    remarks: str | None = None

    items: list[PurchaseOrderItemCreate] = Field(
        ...,
        min_length=1
    )


class PurchaseOrderStatusUpdate(BaseModel):
    status: str


class DeliveryUpdate(BaseModel):
    actual_delivery_date: date
    delivery_notes: str | None = Field(
        default=None,
        max_length=2000
    )


class PurchaseOrderItemResponse(BaseModel):
    id: int
    purchase_order_id: int
    item_description: str
    quantity: int
    unit_price: Decimal
    tax_percent: Decimal
    total: Decimal

    class Config:
        from_attributes = True


class PurchaseOrderResponse(BaseModel):
    id: int
    po_number: str
    order_date: date
    expected_delivery_date: date
    actual_delivery_date: date | None
    delivery_notes: str | None
    procurement_request_id: int | None
    department: str
    vendor_id: int
    payment_terms: str
    shipping_address: str
    billing_address: str
    remarks: str | None
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    status: str
    approved_by: int | None
    approved_at: datetime | None
    created_by: int | None
    created_at: datetime
    items: list[PurchaseOrderItemResponse]

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    purchase_order_id: int
    invoice_number: str = Field(
        ...,
        min_length=2,
        max_length=100
    )
    invoice_date: date
    amount: Decimal = Field(
        ...,
        ge=0
    )


class InvoiceStatusUpdate(BaseModel):
    status: str


class InvoiceResponse(BaseModel):
    id: int
    purchase_order_id: int
    invoice_number: str
    invoice_date: date
    amount: Decimal
    status: str
    created_at: datetime

    class Config:
        from_attributes = True