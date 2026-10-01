from datetime import datetime
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin


class EmailLog(Base, TimestampMixin):
    """Records every email the system would send. In this environment there
    is no live SMTP relay configured, so delivery is simulated and logged
    here — swap in a real SMTP/Twilio call inside
    app/services/notification_service.py for production use."""
    __tablename__ = "email_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    to_email: Mapped[str] = mapped_column(String(150), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="simulated")
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
