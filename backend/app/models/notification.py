from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.db.session import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    target_role = Column(String, nullable=False, default="All")  # Procurement Manager, Vendor, etc. or 'All'
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, default="Order", nullable=False)  # Urgent, Delivery, Compliance, Order, Scoring
    is_read = Column(Boolean, default=False, nullable=False)
    link = Column(String, default="procurement.html", nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
