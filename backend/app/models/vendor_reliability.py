from sqlalchemy import Column, Integer, Float, DateTime
from sqlalchemy.sql import func
from app.database.base import Base


class VendorReliability(Base):
    __tablename__ = "vendor_reliability"

    id = Column(Integer, primary_key=True, index=True)

    vendor_id = Column(Integer, nullable=False)

    performance_score = Column(Float, default=0)
    reliability_score = Column(Float, default=0)

    risk_score = Column(Float, default=0)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )