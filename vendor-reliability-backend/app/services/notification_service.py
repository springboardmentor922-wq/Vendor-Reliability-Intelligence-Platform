from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.user import User

def send_notification(
    db: Session,
    title: str,
    message: str,
    target_role: str = None,
    user_id: int = None,
    ref_id: int = None,
    ref_type: str = None,
    notif_type: str = "system"
):
    """
    Role-specific notification dispatcher.
    Ensures confidentiality: notifications are delivered only to the target role or user.
    """
    if user_id:
        notif = Notification(
            user_id=user_id,
            target_role=target_role,
            title=title,
            message=message,
            reference_id=ref_id,
            reference_type=ref_type,
            type=notif_type
        )
        db.add(notif)
    elif target_role:
        # Deliver to all active users with this role
        users = db.query(User).filter(User.role == target_role, User.is_active == True).all()
        for u in users:
            notif = Notification(
                user_id=u.id,
                target_role=target_role,
                title=title,
                message=message,
                reference_id=ref_id,
                reference_type=ref_type,
                type=notif_type
            )
            db.add(notif)
    db.commit()

def send_notification_async(
    title: str,
    message: str,
    target_role: str = None,
    user_id: int = None,
    ref_id: int = None,
    ref_type: str = None,
    notif_type: str = "system"
):
    """
    Non-blocking notification dispatcher for background tasks.
    Creates and commits notifications in a dedicated background session.
    """
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        if user_id:
            notif = Notification(
                user_id=user_id,
                target_role=target_role,
                title=title,
                message=message,
                reference_id=ref_id,
                reference_type=ref_type,
                type=notif_type
            )
            db.add(notif)
        elif target_role:
            users = db.query(User).filter(User.role == target_role, User.is_active == True).all()
            for u in users:
                notif = Notification(
                    user_id=u.id,
                    target_role=target_role,
                    title=title,
                    message=message,
                    reference_id=ref_id,
                    reference_type=ref_type,
                    type=notif_type
                )
                db.add(notif)
        db.commit()
    except Exception as e:
        try:
            db.rollback()
        except:
            pass
    finally:
        db.close()

