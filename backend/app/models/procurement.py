import enum
from sqlalchemy import Column, Integer, String, Float, Enum, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class POStatus(str, enum.Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    ORDERED = "Ordered"
    DELIVERED = "Delivered"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_reference = Column(String, unique=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    amount = Column(Float, nullable=False)
    status = Column(Enum(POStatus), default=POStatus.PENDING)
    delivery_status = Column(String, default="Pending")

class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    on_time_delivery = Column(Boolean, default=True)
    quality_score = Column(Float, default=100.0)
    response_time_hrs = Column(Float, default=12.0)
    contract_compliant = Column(Boolean, default=True)