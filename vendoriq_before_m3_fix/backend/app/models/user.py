import enum
import uuid
from sqlalchemy import String, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin


class UserRole(str, enum.Enum):
    ADMIN = "administrator"
    PROCUREMENT_MANAGER = "procurement_manager"
    SUPPLY_CHAIN_MANAGER = "supply_chain_manager"
    VENDOR = "vendor"
    FINANCE_OFFICER = "finance_officer"
    AUDITOR = "auditor"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.PROCUREMENT_MANAGER, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    department: Mapped[str] = mapped_column(String(100), nullable=True)
