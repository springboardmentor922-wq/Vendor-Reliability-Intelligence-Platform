import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, Float, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class VendorCategory(str, enum.Enum):
    RAW_MATERIAL = "raw_material_supplier"
    EQUIPMENT = "equipment_vendor"
    IT = "it_vendor"
    SERVICE = "service_provider"
    LOGISTICS = "logistics_partner"
    MAINTENANCE = "maintenance_vendor"


class VendorStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    SUSPENDED = "suspended"
    REJECTED = "rejected"


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(200), nullable=False)
    contact_person = Column(String(150), nullable=True)
    email = Column(String(150), unique=True, index=True, nullable=False)
    phone = Column(String(30), nullable=True)
    address = Column(Text, nullable=True)

    category = Column(Enum(VendorCategory), nullable=False)
    status = Column(Enum(VendorStatus), default=VendorStatus.PENDING)

    # Reliability score, computed/updated later by the scoring engine (0-100)
    reliability_score = Column(Float, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    purchase_orders = relationship("PurchaseOrder", back_populates="vendor")
    contracts = relationship("Contract", back_populates="vendor")
    performance_records = relationship("PerformanceRecord", back_populates="vendor")