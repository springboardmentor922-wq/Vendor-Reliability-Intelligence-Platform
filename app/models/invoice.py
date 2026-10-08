import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, Float, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class PaymentStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, index=True, nullable=False)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)

    invoice_amount = Column(Float, nullable=False)
    invoice_date = Column(DateTime(timezone=True), nullable=False)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.UNPAID)

    created_at = Column(DateTime(timezone=True), server_default=func.now())