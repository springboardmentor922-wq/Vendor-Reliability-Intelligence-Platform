import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class RiskLevel(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    category = Column(String, index=True)
    contact_email = Column(String)
    reliability_score = Column(Float, default=0.0)
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.MEDIUM)

    evaluations = relationship("Evaluation", back_populates="vendor")

class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    delivery_score = Column(Float, nullable=False)
    quality_score = Column(Float, nullable=False)
    compliance_score = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    vendor = relationship("Vendor", back_populates="evaluations")