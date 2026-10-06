from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.sql import func
from app.database.base import Base


class ProcurementRecommendation(Base):
    __tablename__ = "procurement_recommendations"

    id = Column(Integer, primary_key=True, index=True)

    vendor_id = Column(Integer, nullable=False)

    reliability_score = Column(Float, default=0)
    risk_score = Column(Float, default=0)

    recommendation = Column(String, nullable=False)
    reason = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )