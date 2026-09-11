from sqlalchemy import Column, Integer, String, Text, Float
from sqlalchemy.orm import relationship
from app.db.session import Base

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, unique=True, index=True, nullable=False)
    contact_name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    category = Column(String, nullable=False)  # Raw Material Suppliers, Equipment Vendors, etc.
    status = Column(String, default="Pending Approval", nullable=False)  # Pending Approval, Approved, Suspended
    
    # Enterprise & Compliance Attributes
    tax_id = Column(String, nullable=True)  # EIN / GST / VAT Number
    country = Column(String, default="United States", nullable=True)
    city = Column(String, nullable=True)
    payment_terms = Column(String, default="Net 30", nullable=True)  # Net 30, Net 45, Net 60, Immediate
    bank_account = Column(String, nullable=True)  # Wire / IBAN / Routing info
    certifications = Column(String, nullable=True)  # ISO 9001, ISO 14001, SOC 2, C-TPAT
    website = Column(String, nullable=True)
    risk_tier = Column(String, default="Low Risk", nullable=True)  # Low Risk, Medium Risk, High Risk
    
    # Performance metric caches
    reliability_score = Column(Float, default=100.0, nullable=False)
    delivery_accuracy = Column(Float, default=100.0, nullable=False)
    response_time = Column(Float, default=100.0, nullable=False)

    contracts = relationship("Contract", back_populates="vendor", cascade="all, delete-orphan")
    purchase_orders = relationship("PurchaseOrder", back_populates="vendor", cascade="all, delete-orphan")
