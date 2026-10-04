from sqlalchemy import Column, Integer, String, Text, Float, Date, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.models.enums import RequestStatus, POStatus, InvoiceStatus

class ProcurementRequest(Base):
    __tablename__ = "procurement_requests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    department = Column(String(100), nullable=True, default="Production")
    requested_by_name = Column(String(150), nullable=True)
    quantity = Column(String(100), nullable=True)
    needed_by = Column(Date, nullable=True)
    priority = Column(String(50), nullable=True, default="Medium")
    category = Column(String(100), nullable=True)
    justification = Column(Text, nullable=True)
    requested_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(SQLEnum(RequestStatus), nullable=False, default=RequestStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    requested_by = relationship("User", back_populates="procurement_requests", foreign_keys=[requested_by_id])
    purchase_orders = relationship("PurchaseOrder", back_populates="procurement_request")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(100), unique=True, index=True, nullable=False)
    procurement_request_id = Column(Integer, ForeignKey("procurement_requests.id", ondelete="SET NULL"), nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    status = Column(SQLEnum(POStatus), nullable=False, default=POStatus.PENDING)
    total_amount = Column(Float, nullable=False, default=0.0)
    expected_delivery_date = Column(Date, nullable=False)
    actual_delivery_date = Column(Date, nullable=True)
    payment_terms = Column(String(50), nullable=True, default="Net 15")
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    procurement_request = relationship("ProcurementRequest", back_populates="purchase_orders")
    vendor = relationship("Vendor", back_populates="purchase_orders")
    created_by = relationship("User", back_populates="created_orders", foreign_keys=[created_by_id])
    approved_by = relationship("User", back_populates="approved_orders", foreign_keys=[approved_by_id])
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="purchase_order", cascade="all, delete-orphan")
    performance_records = relationship("PerformanceRecord", back_populates="purchase_order")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    unit_price = Column(Float, nullable=False, default=0.0)

    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="items")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(100), unique=True, index=True, nullable=False)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(SQLEnum(InvoiceStatus), nullable=False, default=InvoiceStatus.PENDING)
    due_date = Column(Date, nullable=False)
    paid_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="invoices")
