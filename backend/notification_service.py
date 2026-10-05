from sqlalchemy.orm import Session

from models import Notification, User


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "general"
):
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        is_read=False
    )

    db.add(notification)

    return notification


def notify_role(
    db: Session,
    role: str,
    title: str,
    message: str,
    notification_type: str = "general"
):
    users = (
        db.query(User)
        .filter(User.role == role)
        .all()
    )

    for user in users:
        create_notification(
            db=db,
            user_id=user.id,
            title=title,
            message=message,
            notification_type=notification_type
        )


def notify_roles(
    db: Session,
    roles: list[str],
    title: str,
    message: str,
    notification_type: str = "general"
):
    users = (
        db.query(User)
        .filter(User.role.in_(roles))
        .all()
    )

    for user in users:
        create_notification(
            db=db,
            user_id=user.id,
            title=title,
            message=message,
            notification_type=notification_type
        )


def notify_user(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "general"
):
    create_notification(
        db=db,
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type
    )