from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session_dep import get_db
from app.models.user import User
from app.models.notification_log import EmailLog
from app.services.notification_service import (
    run_expiry_and_compliance_checks,
    run_delivery_delay_checks,
)

router = APIRouter()


@router.post("/run-checks")
def run_checks(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Trigger contract expiry and compliance notification checks."""
    return run_expiry_and_compliance_checks(db, days)


@router.post("/run-delivery-checks")
def run_delivery_checks(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Trigger delivery delay notifications."""
    return run_delivery_delay_checks(db)


@router.get("/email-logs")
def list_email_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Return email notification audit logs."""
    logs = (
        db.query(EmailLog)
        .order_by(EmailLog.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": log.id,
            "to_email": log.to_email,
            "subject": log.subject,
            "event_type": log.event_type,
            "status": log.status,
            "created_at": log.created_at,
        }
        for log in logs
    ]