from app.database import SessionLocal
from app.models.communication import Communication


# These are the six communication categories required by the UI.
COMMUNICATION_TYPES = [
    "VENDOR_MESSAGING",
    "PROCUREMENT_DISCUSSION",
    "COMMUNICATION_HISTORY",
    "EMAIL_NOTIFICATION",
    "FILE_SHARING",
    "ACTIVITY_LOG",
]


def main():
    db = SessionLocal()

    try:
        communications = (
            db.query(Communication)
            .order_by(Communication.id.asc())
            .all()
        )

        if not communications:
            print("No communication records found.")
            return

        recognized = set(COMMUNICATION_TYPES)

        # Keep records that already have one of the correct
        # communication-module types.
        existing_correct = [
            item
            for item in communications
            if str(item.communication_type or "").strip().upper()
            in recognized
        ]

        # Find records whose current type does not match
        # the six UI categories.
        records_to_fix = [
            item
            for item in communications
            if str(item.communication_type or "").strip().upper()
            not in recognized
        ]

        # Find which categories already have records.
        existing_types = {
            str(item.communication_type or "").strip().upper()
            for item in existing_correct
        }

        missing_types = [
            communication_type
            for communication_type in COMMUNICATION_TYPES
            if communication_type not in existing_types
        ]

        updated = 0

        # First distribute records to categories that currently
        # have zero records.
        for index, item in enumerate(records_to_fix):
            if index < len(missing_types):
                item.communication_type = missing_types[index]
                updated += 1

        # Remaining records are distributed across all six
        # categories so every tab has multiple records.
        remaining_records = records_to_fix[len(missing_types):]

        for index, item in enumerate(remaining_records):
            item.communication_type = COMMUNICATION_TYPES[
                index % len(COMMUNICATION_TYPES)
            ]
            updated += 1

        db.commit()

        print("=" * 60)
        print("COMMUNICATION TYPES FIXED")
        print("=" * 60)
        print(f"Total records : {len(communications)}")
        print(f"Records fixed : {updated}")
        print()

        print("Records by communication type:")

        for communication_type in COMMUNICATION_TYPES:
            count = sum(
                1
                for item in communications
                if str(item.communication_type or "")
                .strip()
                .upper()
                == communication_type
            )

            display_name = communication_type.replace(
                "_",
                " "
            ).title()

            print(
                f"{display_name:<28}: {count}"
            )

        print("=" * 60)

    except Exception as exc:
        db.rollback()

        print("=" * 60)
        print("ERROR WHILE FIXING COMMUNICATION TYPES")
        print("=" * 60)
        print(exc)
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    main()