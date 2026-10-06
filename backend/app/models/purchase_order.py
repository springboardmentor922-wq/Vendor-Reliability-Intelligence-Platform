from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database.base import Base


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)

    po_number = Column(String, unique=True, nullable=False)
    vendor_name = Column(String, nullable=False)
    item_name = Column(String, nullable=False)

    quantity = Column(Integer, nullable=False)
    total_amount = Column(Float, nullable=False)

    status = Column(String, default="PENDING", nullable=False)

    # Delivery tracking
    expected_delivery_date = Column(
        DateTime(timezone=True),
        nullable=True
    )

    actual_delivery_date = Column(
        DateTime(timezone=True),
        nullable=True
    )

    # Invoice tracking
    invoice_number = Column(
        String,
        nullable=True
    )

    invoice_amount = Column(
        Float,
        nullable=True
    )

    invoice_status = Column(
        String,
        default="PENDING",
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )