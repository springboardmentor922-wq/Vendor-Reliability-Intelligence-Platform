from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class PerformanceRecord(Base):
    __tablename__ = "performance_records"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True)
    on_time = Column(Boolean, nullable=False, default=True)
    quality_rating = Column(Float, nullable=False, default=5.0)
    response_time_hours = Column(Float, nullable=False, default=2.0)
    issue_resolution_hours = Column(Float, nullable=False, default=12.0)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    vendor = relationship("Vendor", back_populates="performance_records")
    purchase_order = relationship("PurchaseOrder", back_populates="performance_records")


class ReliabilityScore(Base):
    __tablename__ = "reliability_scores"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, nullable=False, default=100.0)
    risk_level = Column(String(50), nullable=False, default="Low")
    calculated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    vendor = relationship("Vendor", back_populates="reliability_scores")
