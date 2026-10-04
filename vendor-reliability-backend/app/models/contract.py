from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    contract_number = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    start_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=False)
    renewal_terms = Column(String(255), nullable=True)
    status = Column(String(50), default="Active", nullable=False) # Active, Pending Review, Renewed, Expired, Terminated
    compliance_status = Column(String(50), default="Compliant", nullable=False) # Compliant, Under Review, Non-Compliant
    document_url = Column(String(255), nullable=True)
    document_name = Column(String(255), nullable=True)
    contract_value = Column(Float, default=0.0)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    vendor = relationship("Vendor", back_populates="contracts")
    created_by = relationship("User", foreign_keys=[created_by_id])
