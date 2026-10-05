from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

class RoleEnum(str, enum.Enum):
    ADMIN = "Administrator"
    PROCUREMENT_MGR = "Procurement Manager"
    SUPPLY_CHAIN_MGR = "Supply Chain Manager"
    FINANCE_OFFICER = "Finance Officer"
    VENDOR = "Vendor"
    AUDITOR = "Auditor"

class VendorCategoryEnum(str, enum.Enum):
    RAW_MATERIALS = "Raw Material Suppliers"
    EQUIPMENT = "Equipment Vendors"
    IT = "IT Vendors"
    SERVICES = "Service Providers"
    LOGISTICS = "Logistics Partners"
    MAINTENANCE = "Maintenance Vendors"

class VendorStatusEnum(str, enum.Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    SUSPENDED = "Suspended"
    REJECTED = "Rejected"

class POStatusEnum(str, enum.Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    ORDERED = "Ordered"
    DELIVERED = "Delivered"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

class User(Base):
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.PROCUREMENT_MGR, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Vendor(Base):
    __tablename__ = "vendors"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    vendor_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(Enum(VendorCategoryEnum), nullable=False)
    contact_email = Column(String(255), nullable=False)
    phone = Column(String(50))
    status = Column(Enum(VendorStatusEnum), default=VendorStatusEnum.PENDING)
    reliability_score = Column(Float, default=100.0)
    risk_level = Column(String(20), default="Low")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    purchase_orders = relationship("PurchaseOrder", back_populates="vendor")
    contracts = relationship("Contract", back_populates="vendor")
    performance_records = relationship("VendorPerformance", back_populates="vendor")

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    po_number = Column(String(100), unique=True, index=True, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    total_amount = Column(Float, nullable=False)
    status = Column(Enum(POStatusEnum), default=POStatusEnum.PENDING)
    delivery_status = Column(String(50), default="In-Transit")
    order_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    scheduled_delivery_date = Column(DateTime)
    actual_delivery_date = Column(DateTime, nullable=True)

    vendor = relationship("Vendor", back_populates="purchase_orders")

class Contract(Base):
    __tablename__ = "contracts"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    contract_ref = Column(String(100), unique=True, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    contract_value = Column(Float, nullable=False)
    is_compliant = Column(Boolean, default=True)

    vendor = relationship("Vendor", back_populates="contracts")

class VendorPerformance(Base):
    __tablename__ = "vendor_performance"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    total_orders = Column(Integer, default=0)
    on_time_deliveries = Column(Integer, default=0)
    delayed_deliveries = Column(Integer, default=0)
    avg_delay_days = Column(Float, default=0.0)
    profit_margin_avg = Column(Float, default=0.0)

    vendor = relationship("Vendor", back_populates="performance_records")