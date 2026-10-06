from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func

from app.database.base import Base


class Communication(Base):
    __tablename__ = "communications"

    id = Column(Integer, primary_key=True, index=True)

    sender = Column(String, nullable=False)

    receiver = Column(String, nullable=False)

    subject = Column(String, nullable=False)

    message = Column(Text, nullable=False)

    communication_type = Column(
        String,
        default="MESSAGE",
        nullable=False
    )

    related_record = Column(
        String,
        nullable=True
    )

    attachment = Column(
        String,
        nullable=True
    )

    status = Column(
        String,
        default="UNREAD",
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )