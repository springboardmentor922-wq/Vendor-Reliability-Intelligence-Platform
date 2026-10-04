from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, index=True, nullable=False)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, default=0.0, nullable=False)
    
    # State machine: PENDING -> INVOICE_RECEIVED -> VERIFIED -> APPROVED -> PAID (or DISPUTED, CANCELLED)
    status = Column(String(50), default="INVOICE_RECEIVED", nullable=False, index=True)
    
    three_way_match_status = Column(String(50), default="PENDING", nullable=False, index=True) # PENDING, MATCHED, DISCREPANCY
    verified_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    issue_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    due_date = Column(DateTime, nullable=True)
    paid_date = Column(DateTime, nullable=True)
    payment_method = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Non-blocking Blockchain Audit Integrity Fields
    blockchain_status = Column(String(50), default="PENDING", index=True)
    blockchain_tx_hash = Column(String(100), nullable=True)
    blockchain_confirmed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="invoices")
    vendor = relationship("Vendor", back_populates="invoices")
    verified_by = relationship("User", foreign_keys=[verified_by_id])
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")
