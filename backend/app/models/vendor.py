from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.models.enums import VendorCategory, VendorStatus

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), unique=True, index=True, nullable=False)
    category = Column(SQLEnum(VendorCategory), nullable=False)
    status = Column(SQLEnum(VendorStatus), nullable=False, default=VendorStatus.PENDING)
    contact_person = Column(String(255), nullable=False)
    contact_role = Column(String(100), nullable=True)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    gst_number = Column(String(50), nullable=True)
    payment_terms = Column(String(50), nullable=True, default="Net 15")
    notes = Column(Text, nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_vendor_approver"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    users = relationship("User", back_populates="vendor", foreign_keys="User.vendor_id")
    approved_by = relationship("User", back_populates="approved_vendors", foreign_keys=[approved_by_id])
    purchase_orders = relationship("PurchaseOrder", back_populates="vendor", cascade="all, delete-orphan")
    contracts = relationship("Contract", back_populates="vendor", cascade="all, delete-orphan")
    certifications = relationship("Certification", back_populates="vendor", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="vendor", cascade="all, delete-orphan")
    performance_records = relationship("PerformanceRecord", back_populates="vendor", cascade="all, delete-orphan")
    reliability_scores = relationship("ReliabilityScore", back_populates="vendor", cascade="all, delete-orphan")
