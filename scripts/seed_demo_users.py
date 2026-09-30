"""
scripts/seed_demo_users.py
--------------------------
Creates the 6 demo users required for Quick Demo Sign-In on the login page.
Safe to run multiple times — skips users that already exist.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import get_database
from auth.password_handler import hash_password
from config.settings import COLLECTION_USERS
from datetime import datetime, timezone

DEMO_USERS = [
    {
        "name": "System Administrator",
        "email": "admin@vendorpulse.com",
        "password": "admin123",
        "role": "Administrator",
        "department": "IT Operations",
    },
    {
        "name": "Procurement Manager",
        "email": "procurement@vendorpulse.com",
        "password": "procure123",
        "role": "Procurement Manager",
        "department": "Procurement",
    },
    {
        "name": "Supply Chain Manager",
        "email": "supply@vendorpulse.com",
        "password": "supply123",
        "role": "Supply Chain Manager",
        "department": "Supply Chain",
    },
    {
        "name": "Finance Officer",
        "email": "finance@vendorpulse.com",
        "password": "finance123",
        "role": "Finance Officer",
        "department": "Finance",
    },
    {
        "name": "Compliance Auditor",
        "email": "auditor@vendorpulse.com",
        "password": "audit123",
        "role": "Auditor",
        "department": "Compliance",
    },
    # Legacy single vendor account (kept for backward compatibility)
    {
        "name": "Alpha Supplies Ltd",
        "email": "vendor@alpha.com",
        "password": "vendor123",
        "role": "Vendor",
        "department": "External",
    },
    # NOTE: The 6 category-specific vendor accounts are managed by
    # scripts/seed_vendor_accounts.py which also creates their vendor entities.
    # This file only seeds the non-vendor platform roles.
]


def seed_demo_users():
    db = get_database()
    collection = db[COLLECTION_USERS]

    created = 0
    skipped = 0

    for user_data in DEMO_USERS:
        existing = collection.find_one({"email": user_data["email"]})
        if existing:
            # Ensure status is Active even if it was changed
            collection.update_one(
                {"email": user_data["email"]},
                {"$set": {"status": "Active", "updated_at": datetime.now(timezone.utc)}},
            )
            print(f"  [EXISTS]  {user_data['email']} -- status set to Active")
            skipped += 1
            continue

        doc = {
            "name": user_data["name"],
            "email": user_data["email"],
            "password_hash": hash_password(user_data["password"]),
            "role": user_data["role"],
            "department": user_data.get("department", ""),
            "phone": None,
            "status": "Active",
            "is_demo": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "last_login": None,
        }

        collection.insert_one(doc)
        print(f"  [CREATED] {user_data['email']} ({user_data['role']})")
        created += 1

    print(f"\nDone. Created: {created}  |  Already existed: {skipped}")


if __name__ == "__main__":
    print("Seeding demo users...")
    seed_demo_users()
