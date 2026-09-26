from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class ContractStatus:
    DRAFT = "Draft"
    ACTIVE = "Active"
    EXPIRING = "Expiring"
    EXPIRED = "Expired"
    TERMINATED = "Terminated"
    RENEWED = "Renewed"

    ALL = [DRAFT, ACTIVE, EXPIRING, EXPIRED, TERMINATED, RENEWED]


class ComplianceStatus:
    COMPLIANT = "Compliant"
    PENDING = "Pending"
    NON_COMPLIANT = "Non-Compliant"
    UNDER_REVIEW = "Under Review"

    ALL = [COMPLIANT, PENDING, NON_COMPLIANT, UNDER_REVIEW]


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(BigInteger, primary_key=True, index=True)

    contract_number = Column(String(50), nullable=False, unique=True, index=True)
    vendor_id = Column(BigInteger, ForeignKey("vendors.id"), nullable=False)

    title = Column(String(200), nullable=True)
    contract_type = Column(String(80), nullable=False, default="Supply Agreement")

    start_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False, index=True)

    contract_value = Column(Numeric(15, 2), nullable=True)
    currency = Column(String(10), nullable=False, default="USD")

    auto_renew = Column(Boolean, nullable=False, default=False)
    renewal_notice_days = Column(Integer, nullable=False, default=30)
    renewed_from_id = Column(BigInteger, ForeignKey("contracts.id"), nullable=True)

    status = Column(
        String(50),
        nullable=False,
        default=ContractStatus.DRAFT,
        index=True
    )

    compliance_status = Column(
        String(50),
        nullable=False,
        default=ComplianceStatus.PENDING
    )

    document_path = Column(Text, nullable=True)
    owner_id = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    terms = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

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
    owner = relationship("User", foreign_keys=[owner_id])
    renewed_from = relationship("Contract", remote_side=[id])

    compliance_checks = relationship(
        "ComplianceCheck",
        back_populates="contract",
        cascade="all, delete-orphan",
        order_by="ComplianceCheck.id.desc()"
    )


class VendorCertification(Base):
    __tablename__ = "vendor_certifications"

    id = Column(BigInteger, primary_key=True, index=True)

    vendor_id = Column(
        BigInteger,
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False
    )

    certification_name = Column(String(150), nullable=False)
    issuing_authority = Column(String(150), nullable=True)
    certificate_number = Column(String(80), nullable=True)

    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)

    status = Column(String(50), nullable=False, default="Valid")
    document_path = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    vendor = relationship("Vendor")


class ComplianceCheck(Base):
    __tablename__ = "compliance_checks"

    id = Column(BigInteger, primary_key=True, index=True)

    vendor_id = Column(
        BigInteger,
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False
    )

    contract_id = Column(
        BigInteger,
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=True
    )

    check_type = Column(String(80), nullable=False)
    check_date = Column(Date, nullable=False, server_default=func.current_date())
    result = Column(String(50), nullable=False, default=ComplianceStatus.COMPLIANT)
    remarks = Column(Text, nullable=True)

    checked_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    vendor = relationship("Vendor")
    contract = relationship("Contract", back_populates="compliance_checks")
    checker = relationship("User")
