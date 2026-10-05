"""Seed a small realistic communication history for VendorIQ."""
from __future__ import annotations

from datetime import datetime, timedelta

import models
from database import SessionLocal


def main() -> None:
    with SessionLocal() as db:
        if db.query(models.Communication).count() > 0:
            print("Communications already exist; nothing to seed.")
            return

        vendors = {
            v.company_name: v
            for v in db.query(models.Vendor).all()
        }

        users = {
            u.email: u
            for u in db.query(models.User).filter(
                models.User.email.in_(
                    [
                        "admin@vendoriq.local",
                        "procurement@vendoriq.local",
                        "supplychain@vendoriq.local",
                        "vendor@vendoriq.local",
                    ]
                )
            ).all()
        }

        required_users = [
            "procurement@vendoriq.local",
            "supplychain@vendoriq.local",
            "vendor@vendoriq.local",
        ]
        missing_users = [email for email in required_users if email not in users]
        if missing_users:
            raise RuntimeError(
                "Missing demo users. Run `python seed_data.py` first: "
                + ", ".join(missing_users)
            )

        rows = [
            {
                "vendor": "Asteron Industrial Systems",
                "sender": "procurement@vendoriq.local",
                "subject": "PO-2026-0001 delivery confirmation",
                "message": "Please confirm the revised delivery window for the pressure sensor array.",
                "thread": "thread-asteron-delivery",
                "days": 4,
            },
            {
                "vendor": "Asteron Industrial Systems",
                "sender": "supplychain@vendoriq.local",
                "subject": "PO-2026-0001 delivery confirmation",
                "message": "The receiving plan remains aligned with the requested delivery date. Please share tracking once dispatched.",
                "thread": "thread-asteron-delivery",
                "days": 3,
            },
            {
                "vendor": "LumenGrid Technologies",
                "sender": "procurement@vendoriq.local",
                "subject": "Network switch refresh",
                "message": "We are ready to proceed with the approved switch refresh. Please confirm the final shipment schedule.",
                "thread": "thread-lumengrid-switches",
                "days": 12,
            },
            {
                "vendor": "LumenGrid Technologies",
                "sender": "vendor@vendoriq.local",
                "subject": "Network switch refresh",
                "message": "Shipment is scheduled and the tracking reference will follow after carrier pickup.",
                "thread": "thread-lumengrid-switches",
                "days": 11,
            },
            {
                "vendor": "HarborPoint Facilities",
                "sender": "procurement@vendoriq.local",
                "subject": "Contract renewal review",
                "message": "Your facilities agreement is approaching expiry. Please send the updated compliance documents for renewal review.",
                "thread": "thread-harborpoint-renewal",
                "days": 9,
            },
            {
                "vendor": "BluePeak Components",
                "sender": "supplychain@vendoriq.local",
                "subject": "Component availability",
                "message": "Please confirm current component availability and lead time for the next replenishment cycle.",
                "thread": "thread-bluepeak-availability",
                "days": 6,
            },
            {
                "vendor": "Northstar Logistics",
                "sender": "procurement@vendoriq.local",
                "subject": "Delivery status check",
                "message": "Please share the current status for the next distribution movement and any expected delay risks.",
                "thread": "thread-northstar-status",
                "days": 2,
            },
        ]

        now = datetime.utcnow()
        for index, row in enumerate(rows):
            vendor = vendors.get(row["vendor"])
            if not vendor:
                continue
            sender = users[row["sender"]]
            db.add(
                models.Communication(
                    sender_id=sender.id,
                    vendor_id=vendor.id,
                    message=row["message"],
                    subject=row["subject"],
                    thread_id=row["thread"],
                    created_at=now - timedelta(
                        days=row["days"], minutes=index * 11
                    ),
                )
            )

        db.commit()
        count = db.query(models.Communication).count()
        print(f"Seeded {count} VendorIQ communication records.")


if __name__ == "__main__":
    main()
