"""Notification System (Milestone 3). Two channels:
  - in-app Notification rows (already used since Milestone 2)
  - EmailLog rows that simulate an SMTP send

No live SMTP/Twilio credentials are configured in this environment, so
send_email() logs the message instead of dispatching it. To go live, plug a
real smtplib/Twilio call in where noted below — the call sites elsewhere in
the app do not need to change.
"""
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.notification_log import EmailLog
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.models.contract import Contract, Certification, ContractStatus, CertificationStatus
from app.models.communication import Notification
from app.core.utils import notify_user


def send_email(db: Session, to_email: str, subject: str, body: str, event_type: str) -> EmailLog:
    # --- integration point ---
    # Replace this block with a real SMTP (smtplib) or Twilio SendGrid call
    # when SMTP_HOST / SMTP_USER credentials are configured for the
    # deployment. Until then, every "email" is recorded here so the
    # Communication module's audit trail stays accurate.
    log = EmailLog(to_email=to_email, subject=subject, body=body, event_type=event_type, status="simulated")
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def notify_and_email(db: Session, user: User, event_type: str, title: str, message: str, related_type=None, related_id=None):
    notify_user(db, user.id, event_type, title, message, related_type, related_id)
    send_email(db, user.email, title, message, event_type)


def notify_event(db: Session, user: User, event_type: str, title: str, message: str, related_type=None, related_id=None):
    """Create both an in-app notification and a simulated email audit entry."""
    notify_and_email(db, user, event_type, title, message, related_type, related_id)


def notify_user_event(db: Session, user_id, event_type: str, title: str, message: str, related_type=None, related_id=None):
    """Convenience wrapper for event-driven notifications when only a user ID is known."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    return notify_event(db, user, event_type, title, message, related_type, related_id)


def run_expiry_and_compliance_checks(db: Session, days: int = 30) -> dict:
    """Contract Expiry Notifications + Compliance Notifications. Scans for
    contracts/certifications expiring within `days` and notifies
    Administrators and Procurement Managers. In production this would be
    invoked by a scheduled job (Celery beat / cron); here it's triggered
    on demand via the API (or manually, e.g. a daily call from an external
    scheduler)."""
    cutoff = datetime.utcnow() + timedelta(days=days)
    approvers = db.query(User).filter(User.role.in_([UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER])).all()

    expiring_contracts = (
        db.query(Contract)
        .filter(Contract.end_date >= datetime.utcnow(), Contract.end_date <= cutoff, Contract.status != ContractStatus.TERMINATED)
        .all()
    )
    expiring_certs = (
        db.query(Certification)
        .filter(Certification.expiry_date.isnot(None), Certification.expiry_date >= datetime.utcnow(), Certification.expiry_date <= cutoff, Certification.status != CertificationStatus.EXPIRED)
        .all()
    )

    notified = 0
    for contract in expiring_contracts:
        vendor = db.query(Vendor).filter(Vendor.id == contract.vendor_id).first()
        title = f"Contract expiring soon: {contract.contract_number}"
        message = f"{vendor.company_name if vendor else 'Vendor'}'s contract '{contract.title}' expires on {contract.end_date.date()}."
        for approver in approvers:
            notify_and_email(db, approver, "contract_expiry", title, message, "contract", contract.id)
            notified += 1

    for cert in expiring_certs:
        vendor = db.query(Vendor).filter(Vendor.id == cert.vendor_id).first()
        title = f"Certification expiring soon: {cert.name}"
        message = f"{vendor.company_name if vendor else 'Vendor'}'s certification '{cert.name}' expires on {cert.expiry_date.date() if cert.expiry_date else 'unknown'}."
        for approver in approvers:
            notify_and_email(db, approver, "compliance_alert", title, message, "certification", cert.id)
            notified += 1

    return {
        "expiring_contracts": len(expiring_contracts),
        "expiring_certifications": len(expiring_certs),
        "notifications_sent": notified,
    }
