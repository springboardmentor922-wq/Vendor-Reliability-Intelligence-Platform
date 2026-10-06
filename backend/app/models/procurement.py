from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database.base import Base


class Procurement(Base):
    __tablename__ = "procurements"

    id = Column(Integer, primary_key=True, index=True)

    item_name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)

    estimated_cost = Column(Float, nullable=False)

    # Vendor assignment
    vendor_id = Column(Integer, nullable=True)

    # Procurement status
    status = Column(String, default="PENDING", nullable=False)

    # Delivery tracking
    expected_delivery_date = Column(DateTime(timezone=True), nullable=True)
    actual_delivery_date = Column(DateTime(timezone=True), nullable=True)

    # Invoice information
    invoice_number = Column(String, nullable=True)
    invoice_amount = Column(Float, nullable=True)
    invoice_status = Column(
        String,
        default="PENDING",
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )