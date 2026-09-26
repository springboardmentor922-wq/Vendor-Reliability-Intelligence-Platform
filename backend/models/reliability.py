"""Milestone 3 persistence: reliability snapshots, predictions, report runs."""

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


class RiskLevel:
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

    ALL = [LOW, MEDIUM, HIGH, CRITICAL]


class PerformanceTrend:
    IMPROVING = "Improving"
    STABLE = "Stable"
    DECLINING = "Declining"

    ALL = [IMPROVING, STABLE, DECLINING]


class VendorReliabilityScore(Base):
    """One snapshot of the six-factor reliability calculation for a vendor.

    A row is written per vendor per calendar day, which is what makes the
    trend charts possible: the history is the sequence of snapshots.
    """

    __tablename__ = "vendor_reliability_scores"

    id = Column(BigInteger, primary_key=True, index=True)

    vendor_id = Column(
        BigInteger,
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    score_date = Column(
        Date,
        nullable=False,
        server_default=func.current_date()
    )

    # ---- the six reliability factors, each 0-100 ----------------
    delivery_score = Column(Numeric(5, 2), nullable=False, default=0)
    quality_score = Column(Numeric(5, 2), nullable=False, default=0)
    communication_score = Column(Numeric(5, 2), nullable=False, default=0)
    compliance_score = Column(Numeric(5, 2), nullable=False, default=0)
    purchase_history_score = Column(Numeric(5, 2), nullable=False, default=0)
    issue_resolution_score = Column(Numeric(5, 2), nullable=False, default=0)

    overall_score = Column(Numeric(5, 2), nullable=False, default=0)
    risk_level = Column(String(20), nullable=False, default=RiskLevel.MEDIUM)
    rank_position = Column(Integer, nullable=True)

    # ---- supporting evidence, kept so a score can be explained ---
    orders_considered = Column(Integer, nullable=False, default=0)
    on_time_deliveries = Column(Integer, nullable=False, default=0)
    delayed_deliveries = Column(Integer, nullable=False, default=0)
    avg_delay_days = Column(Numeric(8, 2), nullable=True)
    total_spend = Column(Numeric(18, 2), nullable=False, default=0)

    predicted_delay_risk = Column(Numeric(5, 4), nullable=True)
    trend = Column(String(20), nullable=True)
    recommendation = Column(Text, nullable=True)

    calculated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    vendor = relationship("Vendor")


class DelayPrediction(Base):
    """A stored delivery-delay prediction for one purchase order."""

    __tablename__ = "delay_predictions"

    id = Column(BigInteger, primary_key=True, index=True)

    purchase_order_id = Column(
        BigInteger,
        ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    vendor_id = Column(
        BigInteger,
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False
    )

    delay_probability = Column(Numeric(5, 4), nullable=False)
    predicted_late = Column(Boolean, nullable=False, default=False)
    risk_band = Column(String(20), nullable=False, default=RiskLevel.LOW)
    model_version = Column(String(40), nullable=True)
    features = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    purchase_order = relationship("PurchaseOrder")
    vendor = relationship("Vendor")


class ReportRun(Base):
    """Audit row written every time a report is generated or exported."""

    __tablename__ = "report_runs"

    id = Column(BigInteger, primary_key=True, index=True)

    report_key = Column(String(60), nullable=False)
    export_format = Column(String(10), nullable=False, default="json")
    filters = Column(Text, nullable=True)
    row_count = Column(Integer, nullable=False, default=0)

    generated_by = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    user = relationship("User")
