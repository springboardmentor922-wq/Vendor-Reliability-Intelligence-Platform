from sqlalchemy import (
    BigInteger,
    Boolean,
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


class VendorStatus:
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    SUSPENDED = "Suspended"
    INACTIVE = "Inactive"

    ALL = [PENDING, APPROVED, REJECTED, SUSPENDED, INACTIVE]


class VendorCategory:
    ALL = [
        "Raw Material Suppliers",
        "Equipment Vendors",
        "IT Vendors",
        "Service Providers",
        "Logistics Partners",
        "Maintenance Vendors"
    ]


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(BigInteger, primary_key=True, index=True)

    vendor_code = Column(String(30), nullable=False, unique=True, index=True)
    vendor_name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False, index=True)

    contact_person = Column(String(120), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    website = Column(String(255), nullable=True)

    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)

    tax_id = Column(String(60), nullable=True)
    registration_number = Column(String(60), nullable=True)

    status = Column(
        String(50),
        nullable=False,
        default=VendorStatus.PENDING,
        index=True
    )

    risk_level = Column(String(20), nullable=False, default="Medium")
    reliability_score = Column(Numeric(5, 2), nullable=True)

    approved_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    onboarded_on = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    created_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)

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

    approver = relationship("User", foreign_keys=[approved_by])
    creator = relationship("User", foreign_keys=[created_by])

    contacts = relationship(
        "VendorContact",
        back_populates="vendor",
        cascade="all, delete-orphan",
        order_by="VendorContact.id"
    )

    approvals = relationship(
        "VendorApproval",
        back_populates="vendor",
        cascade="all, delete-orphan",
        order_by="VendorApproval.id.desc()"
    )


class VendorContact(Base):
    __tablename__ = "vendor_contacts"

    id = Column(BigInteger, primary_key=True, index=True)

    vendor_id = Column(
        BigInteger,
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False
    )

    name = Column(String(120), nullable=False)
    designation = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    is_primary = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    vendor = relationship("Vendor", back_populates="contacts")


class VendorApproval(Base):
    """Immutable audit trail of every vendor approval decision."""

    __tablename__ = "vendor_approvals"

    id = Column(BigInteger, primary_key=True, index=True)

    vendor_id = Column(
        BigInteger,
        ForeignKey("vendors.id", ondelete="CASCADE"),
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

    vendor = relationship("Vendor", back_populates="approvals")
    performer = relationship("User")
