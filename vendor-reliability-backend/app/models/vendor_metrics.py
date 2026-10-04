from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class VendorPerformance(Base):
    __tablename__ = "vendor_performance"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), unique=True, nullable=False)
    total_orders = Column(Integer, default=0, nullable=False)
    completed_orders = Column(Integer, default=0, nullable=False)
    on_time_deliveries = Column(Integer, default=0, nullable=False)
    delayed_deliveries = Column(Integer, default=0, nullable=False)
    partial_deliveries = Column(Integer, default=0, nullable=False)
    cancelled_orders = Column(Integer, default=0, nullable=False)
    delay_frequency = Column(Float, default=0.0, nullable=False) # ratio of delayed to completed
    on_time_rate = Column(Float, default=0.0, nullable=False) # Percentage (0-100)
    fulfillment_rate = Column(Float, default=0.0, nullable=False) # Percentage (0-100)
    quality_rating = Column(Float, default=0.0, nullable=False) # Scale 1.0 to 5.0
    reliability_score = Column(Float, default=0.0, nullable=False) # 0 to 100
    average_delay_days = Column(Float, default=0.0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    vendor = relationship("Vendor", foreign_keys=[vendor_id])

class VendorRisk(Base):
    __tablename__ = "vendor_risk"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), unique=True, nullable=False)
    risk_level = Column(String(50), default="Low", nullable=False) # Low, Medium, High
    risk_score = Column(Float, default=15.0, nullable=False) # 0 (lowest risk) to 100 (highest risk)
    delay_risk_factor = Column(Float, default=0.0, nullable=False)
    fulfillment_risk_factor = Column(Float, default=0.0, nullable=False)
    quality_risk_factor = Column(Float, default=0.0, nullable=False)
    risk_reasons = Column(Text, nullable=True) # JSON or newline-separated human-readable reasons
    assessment_notes = Column(Text, nullable=True)
    evaluated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    vendor = relationship("Vendor", foreign_keys=[vendor_id])
