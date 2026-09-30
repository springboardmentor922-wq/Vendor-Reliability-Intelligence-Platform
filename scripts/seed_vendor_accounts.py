import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import get_database
from auth.password_handler import hash_password
from config.settings import COLLECTION_USERS, COLLECTION_VENDORS

SIX_VENDOR_ACCOUNTS = [
    {
        "name": "Raw Material Supplies Inc.",
        "email": "vendor.rawmat@vendorpulse.com",
        "password": "rawmat123",
        "category": "Raw Material Suppliers",
        "department": "Raw Materials",
        "vendor_code": "VND-RAWMAT",
        "contact_name": "Sarah Mitchell",
        "phone": "+1-555-0101",
    },
    {
        "name": "ProEquip Vendors Ltd.",
        "email": "vendor.equip@vendorpulse.com",
        "password": "equip123",
        "category": "Equipment Vendors",
        "department": "Equipment",
        "vendor_code": "VND-EQUIP",
        "contact_name": "James Harrington",
        "phone": "+1-555-0202",
    },
    {
        "name": "TechSolutions IT Vendors",
        "email": "vendor.it@vendorpulse.com",
        "password": "it123",
        "category": "IT Vendors",
        "department": "Information Technology",
        "vendor_code": "VND-IT",
        "contact_name": "Priya Sharma",
        "phone": "+1-555-0303",
    },
    {
        "name": "ServicePro Partners",
        "email": "vendor.service@vendorpulse.com",
        "password": "service123",
        "category": "Service Providers",
        "department": "Professional Services",
        "vendor_code": "VND-SERVICE",
        "contact_name": "Michael Chen",
        "phone": "+1-555-0404",
    },
    {
        "name": "FastTrack Logistics Partners",
        "email": "vendor.logistics@vendorpulse.com",
        "password": "logistics123",
        "category": "Logistics Partners",
        "department": "Logistics and Shipping",
        "vendor_code": "VND-LOGI",
        "contact_name": "Anna Rodriguez",
        "phone": "+1-555-0505",
    },
    {
        "name": "OptimaMaintain Vendors",
        "email": "vendor.maint@vendorpulse.com",
        "password": "maint123",
        "category": "Maintenance Vendors",
        "department": "Facilities and Maintenance",
        "vendor_code": "VND-MAINT",
        "contact_name": "David Park",
        "phone": "+1-555-0606",
    },
]


def seed_vendor_accounts():
    db = get_database()
    users_col = db[COLLECTION_USERS]
    vendors_col = db[COLLECTION_VENDORS]
    now = datetime.now(timezone.utc)
    cu = cv = uu = uv = 0

    print("=" * 60)
    print("Seeding 6 Vendor Accounts + Entities")
    print("=" * 60)

    for acct in SIX_VENDOR_ACCOUNTS:
        cat = acct["category"]
        email = acct["email"]
        name = acct["name"]
        vcode = acct["vendor_code"]

        vendor_doc = vendors_col.find_one(
            {"$or": [{"vendor_code": vcode}, {"company_name": name}]}
        )
        if not vendor_doc:
            new_v = {
                "vendor_code": vcode,
                "company_name": name,
                "category": cat,
                "department": acct["department"],
                "status": "Active",
                "approval_status": "Approved",
                "contact_information": {
                    "name": acct["contact_name"],
                    "email": email,
                    "phone": acct["phone"],
                },
                "address": {"street": "123 Demo Ave", "city": "Demo City", "country": "USA"},
                "reliability_score": 85.0,
                "late_delivery_rate": 0.05,
                "total_orders": 0,
                "is_demo": True,
                "created_at": now,
                "updated_at": now,
                "created_by": "system",
            }
            result = vendors_col.insert_one(new_v)
            vendor_id = str(result.inserted_id)
            print(f"  [VENDOR CREATED]  {name}  ({cat})")
            cv += 1
        else:
            vendor_id = str(vendor_doc["_id"])
            vendors_col.update_one(
                {"_id": vendor_doc["_id"]},
                {"$set": {"status": "Active", "approval_status": "Approved", "category": cat, "updated_at": now}},
            )
            print(f"  [VENDOR EXISTS]   {name}  ({cat})")
            uv += 1

        user_doc = users_col.find_one({"email": email})
        if not user_doc:
            new_u = {
                "name": name,
                "email": email,
                "password_hash": hash_password(acct["password"]),
                "role": "Vendor",
                "department": acct["department"],
                "phone": acct["phone"],
                "status": "Active",
                "vendor_id": vendor_id,
                "vendor_category": cat,
                "is_demo": True,
                "created_at": now,
                "updated_at": now,
                "last_login": None,
            }
            users_col.insert_one(new_u)
            print(f"  [USER CREATED]    {email}  cat={cat}")
            cu += 1
        else:
            users_col.update_one(
                {"email": email},
                {"$set": {
                    "status": "Active",
                    "vendor_id": vendor_id,
                    "vendor_category": cat,
                    "password_hash": hash_password(acct["password"]),
                    "updated_at": now,
                }},
            )
            print(f"  [USER EXISTS]     {email}  vendor_id={vendor_id}")
            uu += 1

    print()
    print(f"Done. Vendors: Created={cv} Updated={uv} | Users: Created={cu} Updated={uu}")
    print()
    print("LOGIN CREDENTIALS:")
    for a in SIX_VENDOR_ACCOUNTS:
        c = a["category"]
        e = a["email"]
        p = a["password"]
        print(f"  {c:<32} {e:<42} / {p}")


if __name__ == "__main__":
    seed_vendor_accounts()
