from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.session import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse
from app.api import deps
from app.models.user import User

router = APIRouter()

def create_system_notification(
    db: Session,
    target_role: str,
    title: str,
    message: str,
    notif_type: str = "Order",
    link: str = "procurement.html"
):
    notif = Notification(
        target_role=target_role,
        title=title,
        message=message,
        type=notif_type,
        link=link,
        is_read=False
    )
    db.add(notif)
    db.commit()
    return notif

@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Fetch notifications targeted to user's role or to 'All'
    notifs = db.query(Notification).filter(
        or_(
            Notification.target_role == current_user.role,
            Notification.target_role == "All"
        )
    ).order_by(Notification.id.desc()).limit(50).all()
    return notifs

@router.patch("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    db.query(Notification).filter(
        or_(
            Notification.target_role == current_user.role,
            Notification.target_role == "All"
        )
    ).update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read"}
