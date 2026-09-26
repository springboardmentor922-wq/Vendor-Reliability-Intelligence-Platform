from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class UserRole:
    """The six roles defined by the platform specification."""

    ADMINISTRATOR = "Administrator"
    PROCUREMENT_MANAGER = "Procurement Manager"
    SUPPLY_CHAIN_MANAGER = "Supply Chain Manager"
    VENDOR = "Vendor"
    FINANCE_OFFICER = "Finance Officer"
    AUDITOR = "Auditor"

    ALL = [
        ADMINISTRATOR,
        PROCUREMENT_MANAGER,
        SUPPLY_CHAIN_MANAGER,
        VENDOR,
        FINANCE_OFFICER,
        AUDITOR
    ]

    # Roles allowed to change data (Auditor and Vendor are read-mostly).
    INTERNAL_STAFF = [
        ADMINISTRATOR,
        PROCUREMENT_MANAGER,
        SUPPLY_CHAIN_MANAGER,
        FINANCE_OFFICER
    ]


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)

    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    role = Column(
        String(50),
        nullable=False,
        default=UserRole.PROCUREMENT_MANAGER,
        index=True
    )

    phone = Column(String(30), nullable=True)
    department = Column(String(100), nullable=True)
    job_title = Column(String(100), nullable=True)

    # Set when role == 'Vendor' so a supplier login only sees its own records.
    vendor_id = Column(
        BigInteger,
        ForeignKey("vendors.id"),
        nullable=True
    )

    is_active = Column(Boolean, nullable=False, default=True)

    last_login_at = Column(DateTime(timezone=True), nullable=True)

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

    vendor = relationship("Vendor", foreign_keys=[vendor_id])


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(BigInteger, primary_key=True, index=True)

    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    token_hash = Column(String(255), nullable=False, unique=True, index=True)

    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    user = relationship("User")
