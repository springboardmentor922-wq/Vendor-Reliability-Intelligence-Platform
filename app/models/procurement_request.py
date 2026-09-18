import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONVERTED_TO_PO = "converted_to_po"


class ProcurementRequest(Base):
    __tablename__ = "procurement_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String(50), unique=True, index=True, nullable=False)  # e.g. PR-2025-0123
    title = Column(String(200), nullable=False)  # e.g. "Laptops for IT Team"
    department = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING)

    created_at = Column(DateTime(timezone=True), server_default=func.now())