from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class NotificationType:
    PROCUREMENT = "Procurement"
    DELIVERY = "Delivery"
    VENDOR_APPROVAL = "Vendor Approval"
    CONTRACT_EXPIRY = "Contract Expiry"
    COMPLIANCE = "Compliance"
    MESSAGE = "Message"
    SYSTEM = "System"

    ALL = [
        PROCUREMENT, DELIVERY, VENDOR_APPROVAL,
        CONTRACT_EXPIRY, COMPLIANCE, MESSAGE, SYSTEM
    ]


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(BigInteger, primary_key=True, index=True)

    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    notification_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)
    priority = Column(String(20), nullable=False, default="Medium")

    is_read = Column(Boolean, nullable=False, default=False)

    # Delivery channel bookkeeping for the Notification module: an alert can
    # be raised in-app and additionally dispatched over email / SMS.
    channel = Column(String(20), nullable=False, default="In-App")
    email_sent = Column(Boolean, nullable=False, default=False)
    sms_sent = Column(Boolean, nullable=False, default=False)

    # Stable key for a real-world event ("contract-expiry:14"), used to keep
    # the recurring alert sweep idempotent.
    event_key = Column(String(120), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    user = relationship("User")
