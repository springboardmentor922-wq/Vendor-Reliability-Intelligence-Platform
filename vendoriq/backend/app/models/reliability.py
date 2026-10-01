import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Enum, Float, ForeignKey, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TrendDirection(str, enum.Enum):
    IMPROVING = "improving"
    STABLE = "stable"
    DECLINING = "declining"
    INSUFFICIENT_DATA = "insufficient_data"


class ReliabilityScore(Base, TimestampMixin):
    """One row per calculation, so history/trend can be shown (never
    overwritten in place)."""
    __tablename__ = "reliability_scores"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vendor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False)

    score: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), nullable=False)
    trend: Mapped[TrendDirection] = mapped_column(Enum(TrendDirection), default=TrendDirection.INSUFFICIENT_DATA)
    recommendation: Mapped[str] = mapped_column(Text, nullable=True)

    # Factor sub-scores (0-100), stored individually for explainability
    delivery_score: Mapped[float] = mapped_column(Float, default=0.0)
    quality_score: Mapped[float] = mapped_column(Float, default=0.0)
    communication_score: Mapped[float] = mapped_column(Float, default=0.0)
    compliance_score: Mapped[float] = mapped_column(Float, default=0.0)
    purchase_history_score: Mapped[float] = mapped_column(Float, default=0.0)
    issue_resolution_score: Mapped[float] = mapped_column(Float, default=0.0)

    calculated_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    calculated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
