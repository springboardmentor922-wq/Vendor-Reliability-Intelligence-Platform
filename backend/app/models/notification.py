from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    notification_type = Column(String, nullable=False)

    title = Column(String, nullable=False)

    message = Column(String, nullable=False)

    related_record = Column(String, nullable=True)

    status = Column(String, default="UNREAD", nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )