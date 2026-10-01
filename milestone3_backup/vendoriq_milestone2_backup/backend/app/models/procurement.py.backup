import enum
from sqlalchemy import String, Enum, Float, ForeignKey, Text, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin


class ProcurementStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ORDERED = "ordered"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProcurementPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ProcurementRequest(Base, TimestampMixin):
    __tablename__ = "procurement_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    request_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    department: Mapped[str] = mapped_column(String(100), nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=True)

    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit: Mapped[str] = mapped_column(String(50), nullable=True)
    estimated_budget: Mapped[float] = mapped_column(Float, default=0.0)
    priority: Mapped[ProcurementPriority] = mapped_column(Enum(ProcurementPriority), default=ProcurementPriority.MEDIUM)

    status: Mapped[ProcurementStatus] = mapped_column(Enum(ProcurementStatus), default=ProcurementStatus.PENDING)

    requested_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    approved_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    approval_notes: Mapped[str] = mapped_column(Text, nullable=True)

    assigned_vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), nullable=True)
    required_date: Mapped[DateTime] = mapped_column(DateTime, nullable=True)
