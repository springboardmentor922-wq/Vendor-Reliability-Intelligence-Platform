from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class ProcurementStatus:
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    ORDERED = "Ordered"
    DELIVERED = "Delivered"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

    ALL = [
        PENDING, APPROVED, REJECTED,
        ORDERED, DELIVERED, COMPLETED, CANCELLED
    ]


class ProcurementRequest(Base):
    __tablename__ = "procurement_requests"

    id = Column(BigInteger, primary_key=True, index=True)

    request_number = Column(String(50), unique=True, nullable=False, index=True)
    requested_by = Column(BigInteger, ForeignKey("users.id"), nullable=False)

    item = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)

    quantity = Column(Numeric(12, 2), nullable=False, default=1)
    unit = Column(String(30), nullable=False, default="Units")
    estimated_cost = Column(Numeric(15, 2), nullable=False, default=0)
    currency = Column(String(10), nullable=False, default="USD")

    required_date = Column(Date, nullable=True)
    priority = Column(String(20), nullable=False, default="Medium")
    department = Column(String(100), nullable=True)
    justification = Column(Text, nullable=True)

    status = Column(
        String(50),
        nullable=False,
        default=ProcurementStatus.PENDING,
        index=True
    )

    assigned_vendor_id = Column(
        BigInteger,
        ForeignKey("vendors.id"),
        nullable=True
    )

    approved_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

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

    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
    assigned_vendor = relationship("Vendor", foreign_keys=[assigned_vendor_id])

    approvals = relationship(
        "ProcurementApproval",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="ProcurementApproval.id.desc()"
    )


class ProcurementApproval(Base):
    """Audit trail of every procurement approval / assignment action."""

    __tablename__ = "procurement_approvals"

    id = Column(BigInteger, primary_key=True, index=True)

    request_id = Column(
        BigInteger,
        ForeignKey("procurement_requests.id", ondelete="CASCADE"),
        nullable=False
    )

    action = Column(String(50), nullable=False)
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)

    performed_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    comments = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    request = relationship("ProcurementRequest", back_populates="approvals")
    performer = relationship("User")
