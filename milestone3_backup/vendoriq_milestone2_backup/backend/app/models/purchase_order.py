import uuid
import enum
from sqlalchemy import String, Enum, Float, ForeignKey, Text, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class POStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    ORDERED = "ordered"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class InvoiceStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    DISPUTED = "disputed"


class PurchaseOrder(Base, TimestampMixin):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    po_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)

    procurement_request_id: Mapped[int] = mapped_column(ForeignKey("procurement_requests.id"), nullable=True)
    vendor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False)
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    status: Mapped[POStatus] = mapped_column(Enum(POStatus), default=POStatus.PENDING)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)

    order_date: Mapped[DateTime] = mapped_column(DateTime, nullable=True)
    expected_delivery_date: Mapped[DateTime] = mapped_column(DateTime, nullable=True)
    actual_delivery_date: Mapped[DateTime] = mapped_column(DateTime, nullable=True)

    notes: Mapped[str] = mapped_column(Text, nullable=True)

    items: Mapped[list["PurchaseOrderItem"]] = relationship(
        "PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan"
    )
    invoices: Mapped[list["Invoice"]] = relationship(
        "Invoice", back_populates="purchase_order", cascade="all, delete-orphan"
    )


class PurchaseOrderItem(Base, TimestampMixin):
    __tablename__ = "purchase_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    total_price: Mapped[float] = mapped_column(Float, default=0.0)

    purchase_order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="items")


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    invoice_date: Mapped[DateTime] = mapped_column(DateTime, nullable=True)
    due_date: Mapped[DateTime] = mapped_column(DateTime, nullable=True)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.PENDING)
    file_path: Mapped[str] = mapped_column(String(500), nullable=True)

    purchase_order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="invoices")
