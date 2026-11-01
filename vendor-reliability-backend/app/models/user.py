from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="Procurement Manager", nullable=False)
    phone = Column(String(50), nullable=True)
    company = Column(String(150), nullable=True)
    department = Column(String(100), nullable=True)
    vendor_category = Column(String(100), nullable=True)
    product_service = Column(String(150), nullable=True)
    business_reg_number = Column(String(100), nullable=True)
    gst_tax_id = Column(String(100), nullable=True)
    approval_status = Column(String(50), default="APPROVED", nullable=False, index=True) # PENDING, APPROVED, REJECTED
    rejection_reason = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    vendor = relationship("Vendor", primaryjoin="User.id==Vendor.user_id", back_populates="user", uselist=False)
    password_resets = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    @property
    def vendor_id(self):
        if self.vendor:
            return self.vendor.id
        return None

class PasswordResetToken(Base):
    __tablename__ = "password_resets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="password_resets")
