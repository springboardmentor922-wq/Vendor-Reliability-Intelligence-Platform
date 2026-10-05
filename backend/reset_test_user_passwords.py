from app.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password


TEST_USERS = [
    {
        "email": "admin@vendoriq.com",
        "password": "Admin@123",
    },
    {
        "email": "procurement@vendoriq.com",
        "password": "Procure@123",
    },
    {
        "email": "supplychain@vendoriq.com",
        "password": "Supply@123",
    },
    {
        "email": "vendor@vendoriq.com",
        "password": "Vendor@123",
    },
    {
        "email": "finance@vendoriq.com",
        "password": "Finance@123",
    },
    {
        "email": "auditor@vendoriq.com",
        "password": "Audit@123",
    },
]


def reset_test_user_passwords():
    db = SessionLocal()

    try:
        for user_data in TEST_USERS:

            email = user_data["email"].lower().strip()

            user = (
                db.query(User)
                .filter(User.email == email)
                .first()
            )

            if not user:
                print(f"NOT FOUND: {email}")
                continue

            user.hashed_password = hash_password(
                user_data["password"]
            )

            print(f"PASSWORD RESET: {email}")

        db.commit()

        print("\n======================================")
        print("TEST USER PASSWORDS RESET COMPLETED")
        print("======================================")

    except Exception as error:
        db.rollback()
        print("\nERROR:", error)

    finally:
        db.close()


if __name__ == "__main__":
    reset_test_user_passwords()