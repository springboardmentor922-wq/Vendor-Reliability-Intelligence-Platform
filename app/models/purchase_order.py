import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    ORDERED = "ordered"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)

    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    item_description = Column(Text, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)

    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)

    expected_delivery_date = Column(DateTime(timezone=True), nullable=True)
    actual_delivery_date = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    vendor = relationship("Vendor", back_populates="purchase_orders")