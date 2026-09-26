from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class VendorPerformance(Base):
    """Per-order performance record. Scoring logic lands in Milestone 3."""

    __tablename__ = "vendor_performance"

    id = Column(BigInteger, primary_key=True, index=True)

    vendor_id = Column(
        BigInteger,
        ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False
    )

    purchase_order_id = Column(
        BigInteger,
        ForeignKey("purchase_orders.id", ondelete="SET NULL"),
        nullable=True
    )

    evaluation_date = Column(
        Date,
        nullable=False,
        server_default=func.current_date()
    )

    on_time_delivery = Column(Numeric(5, 2), nullable=True)
    delayed_delivery = Column(Numeric(5, 2), nullable=True)
    quality_rating = Column(Numeric(3, 2), nullable=True)
    response_time = Column(Numeric(10, 2), nullable=True)
    issue_resolution_time = Column(Numeric(10, 2), nullable=True)
    order_completion_rate = Column(Numeric(5, 2), nullable=True)
    service_rating = Column(Numeric(3, 2), nullable=True)

    remarks = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    vendor = relationship("Vendor")
    purchase_order = relationship("PurchaseOrder")
