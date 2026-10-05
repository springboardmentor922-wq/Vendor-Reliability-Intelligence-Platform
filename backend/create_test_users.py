from passlib.context import CryptContext

from app.database import SessionLocal
from app.models.user import User, UserRole


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


TEST_USERS = [
    {
        "full_name": "Admin User",
        "email": "admin@vendoriq.com",
        "password": "Admin@123",
        "role": UserRole.ADMINISTRATOR,
    },
    {
        "full_name": "Procurement Manager",
        "email": "procurement@vendoriq.com",
        "password": "Procure@123",
        "role": UserRole.PROCUREMENT_MANAGER,
    },
    {
        "full_name": "Supply Chain Manager",
        "email": "supplychain@vendoriq.com",
        "password": "Supply@123",
        "role": UserRole.SUPPLY_CHAIN_MANAGER,
    },
    {
        "full_name": "Vendor User",
        "email": "vendor@vendoriq.com",
        "password": "Vendor@123",
        "role": UserRole.VENDOR,
    },
    {
        "full_name": "Finance Officer",
        "email": "finance@vendoriq.com",
        "password": "Finance@123",
        "role": UserRole.FINANCE_OFFICER,
    },
    {
        "full_name": "Auditor User",
        "email": "auditor@vendoriq.com",
        "password": "Audit@123",
        "role": UserRole.AUDITOR,
    },
]


def create_test_users():
    db = SessionLocal()

    try:
        for user_data in TEST_USERS:

            existing_user = (
                db.query(User)
                .filter(User.email == user_data["email"])
                .first()
            )

            if existing_user:
                print(
                    f"SKIPPED: {user_data['email']} already exists "
                    f"with role {existing_user.role.value}"
                )
                continue

            new_user = User(
                full_name=user_data["full_name"],
                email=user_data["email"],
                hashed_password=pwd_context.hash(user_data["password"]),
                role=user_data["role"],
                is_active=True,
            )

            db.add(new_user)

            print(
                f"CREATED: {user_data['email']} "
                f"-> {user_data['role'].value}"
            )

        db.commit()

        print("\n======================================")
        print("TEST USERS SETUP COMPLETED")
        print("======================================")

    except Exception as error:
        db.rollback()
        print("\nERROR:", error)

    finally:
        db.close()


if __name__ == "__main__":
    create_test_users()