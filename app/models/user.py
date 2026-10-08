import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PROCUREMENT_MANAGER = "procurement_manager"
    SUPPLY_CHAIN_MANAGER = "supply_chain_manager"
    VENDOR = "vendor"
    FINANCE_OFFICER = "finance_officer"
    AUDITOR = "auditor"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.PROCUREMENT_MANAGER)
    is_active = Column(Boolean, default=True)

    # If this user IS a vendor (role=VENDOR), link to their vendor profile
    vendor_id = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())