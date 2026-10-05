from app.database import SessionLocal
from app.models.vendor import Vendor


def main():
    db = SessionLocal()

    try:
        vendors = db.query(Vendor).all()
        updated = 0

        for vendor in vendors:
            if vendor.email and "@vendoriq.local" in vendor.email:
                local_part = vendor.email.split("@")[0]
                vendor.email = f"{local_part}@example.com"
                updated += 1

        db.commit()

        print("=" * 50)
        print("VENDOR EMAIL FIX COMPLETED")
        print("=" * 50)
        print(f"Vendors checked : {len(vendors)}")
        print(f"Emails updated  : {updated}")
        print("=" * 50)

    except Exception as exc:
        db.rollback()
        print("ERROR:", exc)

    finally:
        db.close()


if __name__ == "__main__":
    main()