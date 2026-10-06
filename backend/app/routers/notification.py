from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.notification import Notification
from app.models.contract import Contract
from app.models.certification import Certification
from app.dependencies.authorization import require_roles

router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"]
)


ALL_ROLES = [
    "ADMINISTRATOR",
    "PROCUREMENT_MANAGER",
    "SUPPLY_CHAIN_MANAGER",
    "FINANCE_OFFICER",
    "AUDITOR",
    "VENDOR"
]


@router.get("/")
def get_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*ALL_ROLES))
):
    return (
        db.query(Notification)
        .order_by(Notification.created_at.desc())
        .all()
    )


@router.post("/")
def create_notification(
    notification_type: str,
    title: str,
    message: str,
    related_record: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    notification = Notification(
        notification_type=notification_type,
        title=title,
        message=message,
        related_record=related_record,
        status="UNREAD"
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return notification


@router.post("/generate-automatic")
def generate_automatic_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    today = date.today()
    created_notifications = []

    contracts = db.query(Contract).all()

    for contract in contracts:
        days_remaining = (contract.end_date - today).days

        if days_remaining < 0:
            notification_type = "CONTRACT_EXPIRY"
            title = "Contract Expired"
            message = (
                f"Contract {contract.contract_number} has expired."
            )

        elif days_remaining <= 30:
            notification_type = "CONTRACT_EXPIRY"
            title = "Contract Expiring Soon"
            message = (
                f"Contract {contract.contract_number} "
                f"will expire in {days_remaining} days."
            )
        else:
            continue

        existing = db.query(Notification).filter(
            Notification.notification_type == notification_type,
            Notification.related_record == contract.contract_number
        ).first()

        if not existing:
            notification = Notification(
                notification_type=notification_type,
                title=title,
                message=message,
                related_record=contract.contract_number,
                status="UNREAD"
            )

            db.add(notification)
            created_notifications.append(notification)

    certifications = db.query(Certification).all()

    for certification in certifications:
        days_remaining = (
            certification.expiry_date - today
        ).days

        if days_remaining < 0:
            notification_type = "COMPLIANCE_EXPIRY"
            title = "Certification Expired"
            message = (
                f"Certification "
                f"{certification.certificate_number} has expired."
            )

        elif days_remaining <= 30:
            notification_type = "COMPLIANCE_EXPIRY"
            title = "Certification Expiring Soon"
            message = (
                f"Certification "
                f"{certification.certificate_number} "
                f"will expire in {days_remaining} days."
            )
        else:
            continue

        existing = db.query(Notification).filter(
            Notification.notification_type == notification_type,
            Notification.related_record == certification.certificate_number
        ).first()

        if not existing:
            notification = Notification(
                notification_type=notification_type,
                title=title,
                message=message,
                related_record=certification.certificate_number,
                status="UNREAD"
            )

            db.add(notification)
            created_notifications.append(notification)

    db.commit()

    for notification in created_notifications:
        db.refresh(notification)

    return {
        "message": "Automatic notifications generated successfully",
        "created_count": len(created_notifications),
        "notifications": created_notifications
    }


@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*ALL_ROLES))
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id)
        .first()
    )

    if not notification:
        return {"detail": "Notification not found"}

    notification.status = "READ"

    db.commit()
    db.refresh(notification)

    return notification