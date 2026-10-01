from datetime import datetime
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin


class EmailLog(Base, TimestampMixin):
    """Records every email the system would send. In this environment there
    is no live SMTP relay configured, so delivery is simulated and logged
    here — swap in a real SMTP/Twilio call inside
    app/services/notification_service.py for production use."""
    