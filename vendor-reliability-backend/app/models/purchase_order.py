from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(50), unique=True, index=True, nullable=False)
    procurement_request_id = Column(Integer, ForeignKey("procurement_requests.id", ondelete="SET NULL"), nullable=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True) # Supply Chain Manager
    issued_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    total_amount = Column(Float, default=0.0, nullable=False)
    currency = Column(String(10), default="USD")
    
    # State machine: DRAFT -> ISSUED -> ACCEPTED -> DISPATCHED -> IN_TRANSIT -> DELIVERED -> COMPLETED (or REJECTED, CANCELLED, DELAYED, PARTIALLY_DELIVERED)
    status = Column(String(50), default="Draft", nullable=False, index=True)
    
    issued_at = Column(DateTime, nullable=True)
    vendor_accepted_at = Column(DateTime, nullable=True)
    vendor_rejection_reason = Column(Text, nullable=True)
    
    dispatch_date = Column(DateTime, nullable=True)
    carrier = Column(String(100), nullable=True)
    tracking_number = Column(String(100), nullable=True)
    
    expected_delivery_date = Column(DateTime, nullable=True)
    actual_delivery_date = Column(DateTime, nullable=True)
    terms_and_conditions = Column(Text, nullable=True)
    shipping_address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Non-blocking Blockchain Audit Integrity Fields
    blockchain_status = Column(String(50), default="PENDING", index=True)
    blockchain_tx_hash = Column(String(100), nullable=True)
    blockchain_confirmed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    procurement_request = relationship("ProcurementRequest", back_populates="purchase_orders")
    vendor = relationship("Vendor", back_populates="purchase_orders")
    created_by = relationship("User", foreign_keys=[created_by_id])
    issued_by = relationship("User", foreign_keys=[issued_by_id])
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="purchase_order")
    deliveries = relationship("Delivery", back_populates="purchase_order", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="purchase_order", cascade="all, delete-orphan")

class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    item_name = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)
    quantity = Column(Float, default=1.0, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False)
    total_price = Column(Float, default=0.0, nullable=False)
    sku = Column(String(50), nullable=True)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
