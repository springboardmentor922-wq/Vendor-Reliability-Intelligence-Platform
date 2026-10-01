from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_admin
from app.db.session_dep import get_db
from app.models.user import User
from app.models.notification_log import EmailLog
from app.services.notification_service import run_expiry_and_compliance_checks

router = APIRouter()


@router.post("/run-checks")
def run_checks(days: int = 30, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Trigger the Contract Expiry / Compliance Notifications scan.
    In production this is invoked by a scheduled job (Celery beat / cron);
    here it's exposed as an on-demand admin action."""
    return run_expiry_and_compliance_checks(db, days)


@router.get("/email-logs")
def list_email_logs(limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Simulated email outbox — see app/services/notification_service.py
    for how to wire up a real SMTP/Twilio provider."""
    logs = db.query(EmailLog).order_by(EmailLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id, "to_email": l.to_email, "subject": l.subject, "event_type": l.event_type,
            "status": l.status, "sent_at": l.sent_at,
        }
        for l in logs
    ]
