from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class PurchaseOrderStatus:
    PENDING = "Pending"
    APPROVED = "Approved"
    ORDERED = "Ordered"
    DELIVERED = "Delivered"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

    ALL = [PENDING, APPROVED, ORDERED, DELIVERED, COMPLETED, CANCELLED]


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(BigInteger, primary_key=True, index=True)

    po_number = Column(String(50), nullable=False, unique=True, index=True)
    vendor_id = Column(BigInteger, ForeignKey("vendors.id"), nullable=False)

    procurement_request_id = Column(
        BigInteger,
        ForeignKey("procurement_requests.id"),
        nullable=True
    )

    created_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)

    title = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)

    order_date = Column(Date, nullable=False, server_default=func.current_date())
    expected_delivery = Column(Date, nullable=True)
    actual_delivery = Column(Date, nullable=True)

    currency = Column(String(10), nullable=False, default="USD")
    subtotal = Column(Numeric(15, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(15, 2), nullable=False, default=0)
    shipping_amount = Column(Numeric(15, 2), nullable=False, default=0)
    total_amount = Column(Numeric(15, 2), nullable=False, default=0)

    # Lane attributes. These are the order-time features the delivery-delay
    # classifier consumes, and they mirror the columns of the DataCo supply
    # chain dataset the model is trained on.
    shipping_mode = Column(String(40), nullable=True)
    market = Column(String(40), nullable=True)
    order_region = Column(String(60), nullable=True)
    source_ref = Column(String(60), nullable=True)

    payment_terms = Column(String(100), nullable=True)
    shipping_address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    status = Column(
        String(50),
        nullable=False,
        default=PurchaseOrderStatus.PENDING,
        index=True
    )

    approved_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    vendor = relationship("Vendor", foreign_keys=[vendor_id])
    request = relationship("ProcurementRequest", foreign_keys=[procurement_request_id])
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])

    items = relationship(
        "PurchaseOrderItem",
        back_populates="purchase_order",
        cascade="all, delete-orphan",
        order_by="PurchaseOrderItem.id"
    )

    invoices = relationship(
        "Invoice",
        back_populates="purchase_order",
        cascade="all, delete-orphan",
        order_by="Invoice.id"
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(BigInteger, primary_key=True, index=True)

    purchase_order_id = Column(
        BigInteger,
        ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False
    )

    item_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    quantity = Column(Numeric(12, 2), nullable=False, default=1)
    unit = Column(String(30), nullable=False, default="Units")
    unit_price = Column(Numeric(15, 2), nullable=False, default=0)
    line_total = Column(Numeric(15, 2), nullable=False, default=0)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
