from sqlalchemy import Column, Integer, String, Date, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    contract_number = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    value = Column(Float, default=0.0)
    compliance_status = Column(String, default="Compliant", nullable=False) # Compliant, Non-Compliant, Expired
    document_url = Column(String, nullable=True)

    vendor = relationship("Vendor", back_populates="contracts")
