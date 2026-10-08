import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import SessionLocal
from app.models.contract import Contract, ContractStatus
from app.models.certification import Certification
from app.models.notification import Notification, NotificationType

logger = logging.getLogger("scheduler")


def check_expirations():
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        soon = now + timedelta(days=30)

        # Contracts expiring within 30 days
        expiring_contracts = db.query(Contract).filter(
            Contract.status == ContractStatus.ACTIVE,
            Contract.end_date <= soon,
            Contract.end_date >= now,
            Contract.notified_expiry == False,
        ).all()

        for c in expiring_contracts:
            db.add(Notification(
                vendor_id=c.vendor_id,
                type=NotificationType.CONTRACT_EXPIRY,
                title=f"Contract expiring soon: {c.title}",
                message=f"Contract '{c.title}' expires on {c.end_date.strftime('%Y-%m-%d')}.",
            ))
            c.notified_expiry = True
            c.status = ContractStatus.EXPIRING_SOON

        # Contracts already expired, not yet marked
        expired_contracts = db.query(Contract).filter(
            Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.EXPIRING_SOON]),
            Contract.end_date < now,
        ).all()
        for c in expired_contracts:
            c.status = ContractStatus.EXPIRED

        # Certifications expiring within 30 days
        expiring_certs = db.query(Certification).filter(
            Certification.expiry_date <= soon,
            Certification.expiry_date >= now,
            Certification.notified_expiry == False,
        ).all()

        for cert in expiring_certs:
            db.add(Notification(
                vendor_id=cert.vendor_id,
                type=NotificationType.COMPLIANCE_ALERT,
                title=f"Certification expiring soon: {cert.name}",
                message=f"Certification '{cert.name}' expires on {cert.expiry_date.strftime('%Y-%m-%d')}.",
            ))
            cert.notified_expiry = True

        db.commit()

        if expiring_contracts or expiring_certs or expired_contracts:
            logger.info(
                f"Scheduler: {len(expiring_contracts)} contract(s) and {len(expiring_certs)} "
                f"certification(s) flagged as expiring soon, {len(expired_contracts)} marked expired."
            )
    finally:
        db.close()


def start_scheduler():
    check_expirations()  # run immediately on startup
    scheduler = BackgroundScheduler()
    scheduler.add_job(check_expirations, "interval", hours=24)
    scheduler.start()
    return scheduler