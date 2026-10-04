from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.models.enums import UserRole

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.VENDOR)
    phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="SET NULL", use_alter=True, name="fk_user_vendor"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    vendor = relationship("Vendor", back_populates="users", foreign_keys=[vendor_id])
    procurement_requests = relationship("ProcurementRequest", back_populates="requested_by", foreign_keys="ProcurementRequest.requested_by_id")
    created_orders = relationship("PurchaseOrder", back_populates="created_by", foreign_keys="PurchaseOrder.created_by_id")
    approved_orders = relationship("PurchaseOrder", back_populates="approved_by", foreign_keys="PurchaseOrder.approved_by_id")
    approved_vendors = relationship("Vendor", back_populates="approved_by", foreign_keys="Vendor.approved_by_id")
    sent_messages = relationship("Message", back_populates="sender")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
