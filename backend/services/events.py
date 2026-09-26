"""Notification fan-out and activity logging.

Both helpers only stage rows on the session; the calling route owns the commit.
"""

from typing import Iterable, Optional

from sqlalchemy.orm import Session

from models import ActivityLog, Notification, User, UserRole


def log_activity(
    db: Session,
    user_id: Optional[int],
    entity_type: str,
    entity_id: Optional[int],
    action: str,
    description: str = ""
) -> ActivityLog:
    entry = ActivityLog(
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        description=description
    )

    db.add(entry)

    return entry


def notify_user(
    db: Session,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    priority: str = "Medium"
) -> Notification:
    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
        priority=priority
    )

    db.add(notification)

    return notification


def notify_roles(
    db: Session,
    roles: Iterable[str],
    notification_type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    priority: str = "Medium",
    exclude_user_id: Optional[int] = None
) -> list[Notification]:
    """Send one notification to every active user holding any of ``roles``."""

    query = db.query(User).filter(
        User.role.in_(list(roles)),
        User.is_active.is_(True)
    )

    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)

    return [
        notify_user(
            db, user.id, notification_type,
            title, message, link, priority
        )
        for user in query.all()
    ]


def notify_vendor_users(
    db: Session,
    vendor_id: int,
    notification_type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    priority: str = "Medium"
) -> list[Notification]:
    """Notify the supplier-side logins attached to ``vendor_id``."""

    users = (
        db.query(User)
        .filter(
            User.role == UserRole.VENDOR,
            User.vendor_id == vendor_id,
            User.is_active.is_(True)
        )
        .all()
    )

    return [
        notify_user(
            db, user.id, notification_type,
            title, message, link, priority
        )
        for user in users
    ]
