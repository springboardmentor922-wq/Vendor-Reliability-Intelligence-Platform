from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    expected_delivery_date = Column(DateTime, nullable=False)
    actual_delivery_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    ordered_quantity = Column(Float, nullable=False, default=1.0)
    delivered_quantity = Column(Float, nullable=False, default=1.0)
    delay_days = Column(Integer, nullable=False, default=0)
    delivery_status = Column(String(50), default="Delivered", nullable=False, index=True) # Delivered, Delayed, Partially Delivered, Completed
    carrier = Column(String(100), nullable=True)
    tracking_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    
    # Non-blocking Blockchain Audit Integrity Fields
    blockchain_status = Column(String(50), default="PENDING", index=True)
    blockchain_tx_hash = Column(String(100), nullable=True)
    blockchain_confirmed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    purchase_order = relationship("PurchaseOrder", foreign_keys=[purchase_order_id])
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])
