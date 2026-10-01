import random
import string
from datetime import datetime


def generate_code(prefix: str) -> str:
    """Generate a human-readable unique code like REQ-20260922-4F7K."""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{prefix}-{timestamp}-{suffix}"


def log_activity(db, user_id, action, entity_type=None, entity_id=None, description=None):
    from app.models.communication import ActivityLog

    entry = ActivityLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
    )
    db.add(entry)
    db.commit()


def notify_user(db, user_id, type_, title, message=None, related_entity_type=None, related_entity_id=None):
    from app.models.communication import Notification

    entry = Notification(
        user_id=user_id,
        type=type_,
        title=title,
        message=message,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
    )
    db.add(entry)
    db.commit()
