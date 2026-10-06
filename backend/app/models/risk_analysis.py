from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.sql import func
from app.database.base import Base


class RiskAnalysis(Base):
    __tablename__ = "risk_analysis"

    id = Column(Integer, primary_key=True, index=True)

    vendor_id = Column(Integer, nullable=False)

    reliability_score = Column(Float, default=0)
    risk_score = Column(Float, default=0)

    risk_level = Column(
        String,
        default="LOW",
        nullable=False
    )

    risk_reason = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )