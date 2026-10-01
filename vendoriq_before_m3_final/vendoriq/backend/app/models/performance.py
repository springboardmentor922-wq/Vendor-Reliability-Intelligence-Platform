import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Enum, Float, ForeignKey, Text, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin


class IssueStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class QualityEvaluation(Base, TimestampMixin):
    """Product Quality Evaluation records (Vendor Performance module)."""
    __tablename__ = "quality_evaluations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vendor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"), nullable=True)

    rating: Mapped[float] = mapped_column(Float, nullable=False)  # 0.0 - 5.0
    defects_count: Mapped[int] = mapped_column(Integer, default=0)
    rejected_items_count: Mapped[int] = mapped_column(Integer, default=0)
    complaints: Mapped[str] = mapped_column(Text, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    evaluated_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class Issue(Base, TimestampMixin):
    """Issue tracking that feeds Issue Resolution Time / Communication metrics."""
    __tablename__ = "issues"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vendor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"), nullable=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[IssueStatus] = mapped_column(Enum(IssueStatus), default=IssueStatus.OPEN)

    raised_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    raised_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    resolution_notes: Mapped[str] = mapped_column(Text, nullable=True)


class PerformanceSnapshot(Base, TimestampMixin):
    """Periodic (e.g. monthly) computed metrics per vendor — kept so trends
    can be plotted over time instead of only showing the latest value."""
    __tablename__ = "performance_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vendor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False)
    period: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g. "2026-09"

    on_time_deliveries: Mapped[int] = mapped_column(Integer, default=0)
    delayed_deliveries: Mapped[int] = mapped_column(Integer, default=0)
    quality_rating: Mapped[float] = mapped_column(Float, default=0.0)
    response_time_hours: Mapped[float] = mapped_column(Float, nullable=True)
    issue_resolution_hours: Mapped[float] = mapped_column(Float, nullable=True)
    completion_rate: Mapped[float] = mapped_column(Float, default=0.0)
