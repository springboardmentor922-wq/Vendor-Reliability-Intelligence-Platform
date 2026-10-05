from app.database import SessionLocal
from app.models.vendor import Vendor
from app.models.communication import Communication


def main():
    db = SessionLocal()

    try:
        vendors = (
            db.query(Vendor)
            .order_by(Vendor.id.asc())
            .all()
        )

        if not vendors:
            print("No vendors found in the database.")
            return

        # Do not delete the existing 6 communications.
        # Add communication history for vendors that do not
        # already have enough communication records.
        existing_count = db.query(Communication).count()

        communication_templates = [
            (
                "Delivery Schedule Confirmation",
                "Please confirm the expected delivery schedule for the current purchase order.",
                "PROCUREMENT",
                "Sent",
            ),
            (
                "Order Status Update",
                "Please provide the latest status of the purchase order and expected delivery date.",
                "PROCUREMENT",
                "Sent",
            ),
            (
                "Quality Documentation Required",
                "Please share the required quality documentation and inspection details for the supplied items.",
                "QUALITY",
                "Pending",
            ),
            (
                "Invoice Clarification",
                "Please confirm the invoice details and provide clarification on the submitted amount.",
                "FINANCE",
                "Open",
            ),
            (
                "Contract Discussion",
                "Please review the current contract terms and confirm the required updates.",
                "CONTRACT",
                "Pending",
            ),
            (
                "Delivery Delay Follow-up",
                "The delivery appears to be delayed. Please provide the reason for the delay and revised delivery date.",
                "DELIVERY",
                "Open",
            ),
            (
                "Vendor Documentation",
                "Please provide the latest vendor documentation required for procurement records.",
                "DOCUMENT",
                "Sent",
            ),
            (
                "Procurement Requirement",
                "Please confirm your ability to fulfil the current procurement requirement.",
                "PROCUREMENT",
                "Sent",
            ),
            (
                "Service Support Request",
                "Please provide an update regarding the service support request raised by the procurement team.",
                "SUPPORT",
                "Open",
            ),
            (
                "Order Completion Confirmation",
                "Please confirm completion of the order and provide the final delivery confirmation.",
                "ORDER",
                "Resolved",
            ),
            (
                "Compliance Document Request",
                "Please share the latest compliance documents and applicable certifications.",
                "COMPLIANCE",
                "Pending",
            ),
            (
                "Payment Confirmation",
                "Please confirm the payment-related information for the completed procurement order.",
                "FINANCE",
                "Resolved",
            ),
        ]

        created = 0

        # Create communication history across the existing vendors.
        # Existing records are preserved.
        for index, vendor in enumerate(vendors):

            template = communication_templates[
                index % len(communication_templates)
            ]

            subject = template[0]
            message = template[1]
            communication_type = template[2]
            status = template[3]

            communication = Communication(
                vendor_id=vendor.id,
                subject=subject,
                message=message,
                communication_type=communication_type,
                status=status,
            )

            db.add(communication)
            created += 1

        db.commit()

        total = db.query(Communication).count()

        print("=" * 60)
        print("COMMUNICATION DATA SEED COMPLETED")
        print("=" * 60)
        print(f"Existing communications : {existing_count}")
        print(f"New communications      : {created}")
        print(f"Total communications    : {total}")
        print(f"Vendors processed       : {len(vendors)}")
        print("=" * 60)

    except Exception as exc:
        db.rollback()
        print("=" * 60)
        print("ERROR WHILE SEEDING COMMUNICATIONS")
        print("=" * 60)
        print(exc)
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    main()