from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.sql import func
from app.database.base import Base


class ReliabilityScore(Base):
    __tablename__ = "reliability_scores"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, nullable=False)

    # Six mandatory reliability factors
    delivery_score = Column(Float, default=0)
    quality_score = Column(Float, default=0)
    communication_score = Column(Float, default=0)
    contract_compliance_score = Column(Float, default=0)
    purchase_history_score = Column(Float, default=0)
    issue_resolution_score = Column(Float, default=0)

    # Final calculated score and risk
    overall_score = Column(Float, default=0)
    risk_level = Column(String, default="LOW")

    # Trend information
    trend = Column(String, default="STABLE")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )