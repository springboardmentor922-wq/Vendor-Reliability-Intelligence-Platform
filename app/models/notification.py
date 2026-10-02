import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class NotificationType(str, enum.Enum):
    PROCUREMENT_ALERT = "procurement_alert"
    DELIVERY_DELAY = "delivery_delay"
    VENDOR_APPROVAL = "vendor_approval"
    CONTRACT_EXPIRY = "contract_expiry"
    COMPLIANCE_ALERT = "compliance_alert"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # who should see this (null = all admins/managers)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)

    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())