from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True) # Specific user or null if role-based
    target_role = Column(String(50), nullable=True, index=True) # Role-specific notification routing
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="system") # approval, order, contract, alert, system, registration
    is_read = Column(Boolean, default=False, index=True)
    reference_id = Column(Integer, nullable=True, index=True)
    reference_type = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="notifications")
