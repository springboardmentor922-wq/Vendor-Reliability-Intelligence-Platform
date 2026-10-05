"""Background jobs used by the notification/reporting platform."""

from __future__ import annotations

from celery_app import celery_app
from database import SessionLocal
from notifications import generate_alerts


@celery_app.task(name="vendoriq.scan_alerts")
def scan_alerts():
    with SessionLocal() as db:
        counts = generate_alerts(db)
        db.commit()
        return counts
