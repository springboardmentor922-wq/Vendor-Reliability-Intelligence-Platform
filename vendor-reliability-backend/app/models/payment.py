from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    processed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    amount = Column(Float, nullable=False, default=0.0)
    payment_method = Column(String(50), default="Electronic Funds Transfer", nullable=False) # EFT, Wire Transfer, Corporate Card, Check
    transaction_reference = Column(String(100), unique=True, index=True, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    status = Column(String(50), default="PAID", nullable=False, index=True)
    notes = Column(Text, nullable=True)
    
    # Non-blocking Blockchain Audit Integrity Fields
    blockchain_status = Column(String(50), default="PENDING", index=True)
    blockchain_tx_hash = Column(String(100), nullable=True)
    blockchain_confirmed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    invoice = relationship("Invoice", foreign_keys=[invoice_id])
    purchase_order = relationship("PurchaseOrder", foreign_keys=[purchase_order_id])
    processed_by = relationship("User", foreign_keys=[processed_by_id])
