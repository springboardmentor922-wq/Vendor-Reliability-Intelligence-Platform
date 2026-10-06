from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.sql import func
from app.database.base import Base


class VendorPerformance(Base):
    __tablename__ = "vendor_performance"

    id = Column(Integer, primary_key=True, index=True)

    vendor_id = Column(Integer, nullable=False)
    vendor_name = Column(String, nullable=False)

    total_orders = Column(Integer, default=0)
    completed_orders = Column(Integer, default=0)

    on_time_deliveries = Column(Integer, default=0)
    delayed_deliveries = Column(Integer, default=0)

    delivery_score = Column(Float, default=0)
    quality_score = Column(Float, default=0)
    completion_score = Column(Float, default=0)

    overall_performance_score = Column(Float, default=0)

    reliability_score = Column(Float, default=0, nullable=False)

    status = Column(
        String,
        default="GOOD",
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )