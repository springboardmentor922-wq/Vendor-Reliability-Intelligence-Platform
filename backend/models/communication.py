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


class ThreadStatus:
    OPEN = "Open"
    AWAITING_VENDOR = "Awaiting Vendor"
    AWAITING_INTERNAL = "Awaiting Internal"
    RESOLVED = "Resolved"
    CLOSED = "Closed"

    ALL = [OPEN, AWAITING_VENDOR, AWAITING_INTERNAL, RESOLVED, CLOSED]


class MessageThread(Base):
    """A conversation between the procurement team and a vendor."""

    __tablename__ = "message_threads"

    id = Column(BigInteger, primary_key=True, index=True)

    subject = Column(String(200), nullable=False)

    vendor_id = Column(
        BigInteger,
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=True
    )

    purchase_order_id = Column(
        BigInteger,
        ForeignKey("purchase_orders.id", ondelete="SET NULL"),
        nullable=True
    )

    procurement_request_id = Column(
        BigInteger,
        ForeignKey("procurement_requests.id", ondelete="SET NULL"),
        nullable=True
    )

    contract_id = Column(
        BigInteger,
        ForeignKey("contracts.id", ondelete="SET NULL"),
        nullable=True
    )

    created_by = Column(BigInteger, ForeignKey("users.id"), nullable=False)

    status = Column(String(50), nullable=False, default=ThreadStatus.OPEN)
    priority = Column(String(20), nullable=False, default="Medium")

    last_message_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    vendor = relationship("Vendor")
    purchase_order = relationship("PurchaseOrder")
    request = relationship("ProcurementRequest")
    contract = relationship("Contract")
    creator = relationship("User", foreign_keys=[created_by])

    messages = relationship(
        "Message",
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="Message.id"
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(BigInteger, primary_key=True, index=True)

    thread_id = Column(
        BigInteger,
        ForeignKey("message_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    sender_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)

    body = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    thread = relationship("MessageThread", back_populates="messages")
    sender = relationship("User")

    attachments = relationship(
        "MessageAttachment",
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="MessageAttachment.id"
    )


class MessageAttachment(Base):
    __tablename__ = "message_attachments"

    id = Column(BigInteger, primary_key=True, index=True)

    message_id = Column(
        BigInteger,
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False
    )

    file_name = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size = Column(BigInteger, nullable=True)
    content_type = Column(String(120), nullable=True)

    uploaded_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    message = relationship("Message", back_populates="attachments")


class ActivityLog(Base):
    """Every state-changing action recorded for the audit trail."""

    __tablename__ = "activity_logs"

    id = Column(BigInteger, primary_key=True, index=True)

    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    entity_type = Column(String(60), nullable=False, index=True)
    entity_id = Column(BigInteger, nullable=True)
    action = Column(String(80), nullable=False)
    description = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    user = relationship("User")
