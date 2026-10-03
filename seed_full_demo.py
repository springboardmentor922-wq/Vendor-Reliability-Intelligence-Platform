"""
Populates realistic example data across every module:
vendors, procurement requests, purchase orders, contracts,
performance records, and notifications — so the app looks
full and demoable, not empty.

Run once with your backend already running:
    python seed_full_demo.py
"""
import requests
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"
LOGIN_EMAIL = "aish@test.com"
LOGIN_PASSWORD = "test1234"


def login():
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD})
    resp.raise_for_status()
    return resp.json()["access_token"]


def h(token):
    return {"Authorization": f"Bearer {token}"}


def create_vendor(token, data):
    resp = requests.post(f"{BASE_URL}/vendors/", json=data, headers=h(token))
    if resp.status_code == 400:
        # already exists — fetch and return existing
        existing = requests.get(f"{BASE_URL}/vendors/", headers=h(token)).json()
        return next((v for v in existing if v["email"] == data["email"]), None)
    resp.raise_for_status()
    return resp.json()


def create_request(token, data):
    resp = requests.post(f"{BASE_URL}/procurement-requests/", json=data, headers=h(token))
    if resp.status_code == 400:
        return None
    resp.raise_for_status()
    return resp.json()


def create_po(token, data):
    resp = requests.post(f"{BASE_URL}/purchase-orders/", json=data, headers=h(token))
    if resp.status_code == 400:
        return None
    resp.raise_for_status()
    return resp.json()


def create_contract(token, data):
    resp = requests.post(f"{BASE_URL}/contracts/", json=data, headers=h(token))
    resp.raise_for_status()
    return resp.json()


def log_performance(token, data):
    resp = requests.post(f"{BASE_URL}/performance/", json=data, headers=h(token))
    resp.raise_for_status()
    return resp.json()


def create_notification(token, data):
    resp = requests.post(f"{BASE_URL}/notifications/", json=data, headers=h(token))
    resp.raise_for_status()
    return resp.json()


def main():
    token = login()
    print("Logged in.")

    vendors_data = [
        {"company_name": "TechNova Solutions", "contact_person": "Priya Rao", "email": "priya@technova.com",
         "phone": "9876500011", "address": "Bengaluru, Karnataka", "category": "it_vendor"},
        {"company_name": "Metro Raw Materials", "contact_person": "Suresh Iyer", "email": "suresh@metroraw.com",
         "phone": "9876500022", "address": "Chennai, Tamil Nadu", "category": "raw_material_supplier"},
        {"company_name": "Bharat Equipment Co.", "contact_person": "Anil Kumar", "email": "anil@bharatequip.com",
         "phone": "9876500033", "address": "Pune, Maharashtra", "category": "equipment_vendor"},
        {"company_name": "SwiftCare Maintenance", "contact_person": "Deepa Nair", "email": "deepa@swiftcare.com",
         "phone": "9876500044", "address": "Hyderabad, Telangana", "category": "maintenance_vendor"},
    ]

    vendors = []
    for v in vendors_data:
        created = create_vendor(token, v)
        if created:
            vendors.append(created)
            print(f"Vendor ready: {created['company_name']} (id={created['id']})")

    # Procurement requests
    requests_data = [
        {"request_number": "PR-2025-0200", "title": "Laptops for new hires", "department": "Information Technology",
         "description": "10 laptops needed for Q4 onboarding batch"},
        {"request_number": "PR-2025-0201", "title": "Raw steel for production line", "department": "Operations",
         "description": "Monthly steel supply replenishment"},
        {"request_number": "PR-2025-0202", "title": "Office AC maintenance", "department": "Operations",
         "description": "Quarterly AC servicing across floors 1-3"},
    ]
    for r in requests_data:
        created = create_request(token, r)
        if created:
            print(f"Request created: {created['request_number']}")

    # Purchase orders (with line items) — spread across vendors
    if len(vendors) >= 2:
        po1 = create_po(token, {
            "order_number": "PO-2025-0301",
            "vendor_id": vendors[0]["id"],
            "department": "Information Technology",
            "payment_terms": "Net 30",
            "shipping_address": "HQ, Bengaluru",
            "billing_address": "HQ, Bengaluru",
            "remarks": "Standard laptop refresh order",
            "expected_delivery_date": (datetime.utcnow() + timedelta(days=10)).isoformat(),
            "save_as_draft": False,
            "items": [
                {"item_description": "Business Laptop", "quantity": 10, "unit_price": 62000, "tax_percent": 18},
                {"item_description": "Docking Station", "quantity": 10, "unit_price": 4500, "tax_percent": 18},
            ],
        })
        if po1: print(f"PO created: {po1['order_number']} — total ₹{po1['total_amount']}")

        po2 = create_po(token, {
            "order_number": "PO-2025-0302",
            "vendor_id": vendors[1]["id"],
            "department": "Operations",
            "payment_terms": "Net 45",
            "shipping_address": "Plant 2, Chennai",
            "billing_address": "HQ, Bengaluru",
            "remarks": "Monthly raw material restock",
            "expected_delivery_date": (datetime.utcnow() - timedelta(days=2)).isoformat(),  # already overdue
            "save_as_draft": False,
            "items": [
                {"item_description": "Steel Sheets (per unit)", "quantity": 200, "unit_price": 850, "tax_percent": 12},
            ],
        })
        if po2: print(f"PO created: {po2['order_number']} — total ₹{po2['total_amount']}")

    # Contracts
    if len(vendors) >= 3:
        c1 = create_contract(token, {
            "vendor_id": vendors[0]["id"],
            "title": "IT Hardware Master Agreement",
            "document_url": "https://example.com/contracts/it-master.pdf",
            "start_date": (datetime.utcnow() - timedelta(days=300)).isoformat(),
            "end_date": (datetime.utcnow() + timedelta(days=5)).isoformat(),  # expiring soon
            "compliance_notes": "Renewal discussion pending with vendor",
        })
        print(f"Contract created: {c1['title']}")

        c2 = create_contract(token, {
            "vendor_id": vendors[2]["id"],
            "title": "Equipment Supply & Warranty Agreement",
            "document_url": "https://example.com/contracts/equip.pdf",
            "start_date": (datetime.utcnow() - timedelta(days=100)).isoformat(),
            "end_date": (datetime.utcnow() + timedelta(days=200)).isoformat(),
            "compliance_notes": "Standard terms, no issues",
        })
        print(f"Contract created: {c2['title']}")

    # Performance history per new vendor (rough -> improving trend)
    entries = [
        (False, 2.0, 2.5, 45, "Rocky start — delayed shipment, slow replies"),
        (True, 3.0, 3.0, 24, "Getting better — delivered on time this cycle"),
        (True, 4.0, 4.0, 10, "Solid performance, minor delay in confirmation"),
        (True, 4.8, 4.7, 4, "Excellent — fast, high quality, great communication"),
    ]
    for v in vendors:
        for e in entries:
            log_performance(token, {
                "vendor_id": v["id"],
                "on_time_delivery": e[0],
                "quality_rating": e[1],
                "communication_rating": e[2],
                "response_time_hours": e[3],
                "notes": e[4],
            })
        print(f"Performance history logged for {v['company_name']}")

    # Notifications
    if vendors:
        create_notification(token, {
            "vendor_id": vendors[0]["id"],
            "type": "contract_expiry",
            "title": "Contract expiring soon",
            "message": f"{vendors[0]['company_name']}'s IT Hardware Master Agreement ends in 5 days.",
        })
        create_notification(token, {
            "vendor_id": vendors[1]["id"] if len(vendors) > 1 else vendors[0]["id"],
            "type": "delivery_delay",
            "title": "Delivery delayed",
            "message": "A purchase order is past its expected delivery date.",
        })
        create_notification(token, {
            "type": "compliance_alert",
            "title": "Compliance review needed",
            "message": "One vendor's reliability score has dropped below acceptable threshold.",
        })
        print("Notifications created.")

    print("\nDone — your app now has realistic data across all modules.")


if __name__ == "__main__":
    main()