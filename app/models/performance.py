from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class PerformanceRecord(Base):
    __tablename__ = "performance_records"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=True)

    # Delivery performance
    on_time_delivery = Column(Boolean, nullable=True)  # True/False for this order

    # Ratings (scale 1-5)
    quality_rating = Column(Float, nullable=True)
    communication_rating = Column(Float, nullable=True)

    # Time-based metrics (in hours)
    response_time_hours = Column(Float, nullable=True)
    issue_resolution_hours = Column(Float, nullable=True)

    notes = Column(Text, nullable=True)

    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    vendor = relationship("Vendor", back_populates="performance_records")