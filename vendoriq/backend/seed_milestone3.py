import requests
from datetime import datetime, timedelta

BASE = "http://127.0.0.1:8000/api/v1"

ADMIN_EMAIL = "admin@vendoriq.com"
ADMIN_PASSWORD = "Admin@123"

session = requests.Session()


def login():
    r = session.post(
        f"{BASE}/auth/login-json",
        json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
        },
    )

    if r.status_code != 200:
        print("LOGIN FAILED:", r.status_code, r.text)
        raise SystemExit(1)

    token = r.json()["access_token"]
    session.headers.update({
        "Authorization": f"Bearer {token}"
    })

    print("[+] Logged in successfully")


def post(path, payload):
    r = session.post(f"{BASE}{path}", json=payload)

    if r.status_code not in (200, 201):
        print(f"[!] POST {path} -> {r.status_code}")
        print(r.text)
        return None

    return r.json()


def put(path, payload):
    r = session.put(f"{BASE}{path}", json=payload)

    if r.status_code not in (200, 201):
        print(f"[!] PUT {path} -> {r.status_code}")
        print(r.text)
        return None

    return r.json()


def get(path):
    r = session.get(f"{BASE}{path}")

    if r.status_code != 200:
        print(f"[!] GET {path} -> {r.status_code}")
        print(r.text)
        return None

    return r.json()


login()


# ============================================================
# 1. CREATE ADDITIONAL VENDORS
# ============================================================

vendors_data = [
    {
        "company_name": "TechNova Solutions",
        "category": "it_vendors",
        "registration_number": "TN-REG-1001",
        "tax_id": "GST29TECH1001",
        "contact_person": "Rahul Sharma",
        "email": "contact@technova.example.com",
        "phone": "9876501001",
        "address": "45 MG Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "country": "India",
    },
    {
        "company_name": "CyberShield Technologies",
        "category": "service_providers",
        "registration_number": "TN-REG-1002",
        "tax_id": "GST33CYBER1002",
        "contact_person": "Priya Menon",
        "email": "contact@cybershield.example.com",
        "phone": "9876501002",
        "address": "12 Anna Salai",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "country": "India",
    },
    {
        "company_name": "NetCore Systems",
        "category": "equipment_vendors",
        "registration_number": "TN-REG-1003",
        "tax_id": "GST33NET1003",
        "contact_person": "Arjun Kumar",
        "email": "sales@netcore.example.com",
        "phone": "9876501003",
        "address": "21 OMR Road",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "country": "India",
    },
    {
        "company_name": "DataSecure India",
        "category": "service_providers",
        "registration_number": "TN-REG-1004",
        "tax_id": "GST33DATA1004",
        "contact_person": "Meera Iyer",
        "email": "sales@datasecure.example.com",
        "phone": "9876501004",
        "address": "88 IT Park",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "country": "India",
    },
    {
        "company_name": "CloudMatrix Technologies",
        "category": "it_vendors",
        "registration_number": "TN-REG-1005",
        "tax_id": "GST33CLOUD1005",
        "contact_person": "Vikram Rao",
        "email": "contact@cloudmatrix.example.com",
        "phone": "9876501005",
        "address": "17 Hitech City",
        "city": "Hyderabad",
        "state": "Telangana",
        "country": "India",
    },
    {
        "company_name": "InfraGuard Systems",
        "category": "equipment_vendors",
        "registration_number": "TN-REG-1006",
        "tax_id": "GST33INFRA1006",
        "contact_person": "Ananya Singh",
        "email": "sales@infraguard.example.com",
        "phone": "9876501006",
        "address": "33 Electronic City",
        "city": "Bengaluru",
        "state": "Karnataka",
        "country": "India",
    },
    {
        "company_name": "SecureEdge Networks",
        "category": "it_vendors",
        "registration_number": "TN-REG-1007",
        "tax_id": "GST33EDGE1007",
        "contact_person": "Karthik Raj",
        "email": "contact@secureedge.example.com",
        "phone": "9876501007",
        "address": "9 Cyber Park",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "country": "India",
    },
    {
        "company_name": "Alpha IT Solutions",
        "category": "service_providers",
        "registration_number": "TN-REG-1008",
        "tax_id": "GST33ALPHA1008",
        "contact_person": "Sneha Patel",
        "email": "support@alphait.example.com",
        "phone": "9876501008",
        "address": "72 Tech Avenue",
        "city": "Pune",
        "state": "Maharashtra",
        "country": "India",
    },
]


vendors = []

for data in vendors_data:
    result = post("/vendors", {
        **data,
        "contacts": [
            {
                "name": data["contact_person"],
                "designation": "Account Manager",
                "email": data["email"],
                "phone": data["phone"],
                "is_primary": True,
            }
        ],
    })

    if result:
        vendors.append(result)
        print(
            f"[+] Vendor created: "
            f"{result['company_name']} -> {result['id']}"
        )


# ============================================================
# 2. APPROVE CREATED VENDORS
# ============================================================

for vendor in vendors:
    vendor_id = vendor["id"]

    result = put(
        f"/vendors/{vendor_id}/approval",
        {
            "status": "approved",
            "approval_notes": "Approved during Milestone 3 operational testing.",
        },
    )

    if result:
        print(f"[+] Vendor approved: {vendor['company_name']}")


# ============================================================
# 3. REFRESH VENDORS
# ============================================================

all_vendors = get("/vendors") or []

active_vendors = [
    v for v in all_vendors
    if v.get("status") in ("approved", "active")
]

print(f"\n[+] Usable vendors: {len(active_vendors)}")


# ============================================================
# 4. CREATE PROCUREMENT REQUESTS
# ============================================================

procurement_data = [
    ("Enterprise Firewall Upgrade", "Network Security", 250000, "urgent"),
    ("SIEM Infrastructure", "Security Operations", 180000, "high"),
    ("Endpoint Protection Licenses", "Endpoint Security", 120000, "high"),
    ("Network Monitoring Equipment", "Networking", 150000, "medium"),
    ("Secure Wi-Fi Infrastructure", "Networking", 95000, "medium"),
    ("Vulnerability Management Platform", "Application Security", 135000, "high"),
    ("SOC Workstation Upgrade", "Security Operations", 80000, "medium"),
    ("Backup Security Appliance", "Data Security", 175000, "high"),
    ("Cloud Security Gateway", "Cloud Security", 210000, "urgent"),
    ("Identity Management Solution", "Identity Security", 160000, "high"),
]

requests_created = []

for i, (title, category, budget, priority) in enumerate(procurement_data):

    vendor = active_vendors[i % len(active_vendors)]

    payload = {
        "title": title,
        "description": (
            f"Milestone 3 operational procurement for {category}. "
            f"Vendor evaluation and delivery tracking required."
        ),
        "department": category,
        "category": category,
        "quantity": 1,
        "unit": "project",
        "estimated_budget": budget,
        "priority": priority,
        "required_date": (
            datetime.utcnow() + timedelta(days=30 + i * 5)
        ).isoformat(),
        "assigned_vendor_id": vendor["id"],
    }

    result = post("/procurement", payload)

    if result:
        requests_created.append(result)

        print(
            f"[+] Procurement created: "
            f"{result['request_number']} -> {vendor['company_name']}"
        )


# ============================================================
# 5. APPROVE PROCUREMENT REQUESTS
# ============================================================

approved_requests = []

for req in requests_created:

    result = put(
        f"/procurement/{req['id']}/approval",
        {
            "status": "approved",
            "approval_notes": "Approved for operational procurement.",
        },
    )

    if result:
        approved_requests.append(result)


# ============================================================
# 6. ASSIGN VENDORS
# ============================================================

for i, req in enumerate(approved_requests):

    vendor = active_vendors[i % len(active_vendors)]

    result = put(
        f"/procurement/{req['id']}/assign-vendor/{vendor['id']}",
        {},
    )

    if result:
        print(
            f"[+] Assigned {req['request_number']} "
            f"to {vendor['company_name']}"
        )


# ============================================================
# 7. CREATE PURCHASE ORDERS
# ============================================================

purchase_orders = []

for i, req in enumerate(approved_requests[:8]):

    vendor_id = req.get("assigned_vendor_id")

    if not vendor_id:
        vendor_id = active_vendors[i % len(active_vendors)]["id"]

    # First four are deliberately on-time.
    # Next two are deliberately delayed.
    # Remaining two are still ordered.

    if i < 4:
        expected = datetime.utcnow() + timedelta(days=2)
    elif i < 6:
        expected = datetime.utcnow() - timedelta(days=5 + i)
    else:
        expected = datetime.utcnow() + timedelta(days=15)

    budget = req["estimated_budget"]

    payload = {
        "procurement_request_id": req["id"],
        "vendor_id": vendor_id,
        "expected_delivery_date": expected.isoformat(),
        "notes": "Generated as part of VendorIQ Milestone 3 operational testing.",
        "items": [
            {
                "item_name": req["title"],
                "description": f"Procurement item for {req['department']}",
                "quantity": 1,
                "unit_price": budget,
            }
        ],
    }

    result = post("/purchase-orders", payload)

    if result:
        purchase_orders.append(result)

        print(
            f"[+] PO created: "
            f"{result['po_number']} -> {vendor_id}"
        )


# ============================================================
# 8. UPDATE PO DELIVERY STATUS
# ============================================================

for i, po in enumerate(purchase_orders):

    if i < 6:
        result = put(
            f"/purchase-orders/{po['id']}/status",
            {"status": "delivered"},
        )

        if result:
            print(
                f"[+] PO delivered: "
                f"{result['po_number']}"
            )


# ============================================================
# 9. QUALITY EVALUATIONS
# ============================================================

quality_ratings = [4.8, 4.6, 4.2, 3.9, 3.2, 4.4, 4.7, 3.5]

for i, po in enumerate(purchase_orders):

    vendor_id = po["vendor_id"]

    rating = quality_ratings[i % len(quality_ratings)]

    defects = 0 if rating >= 4.0 else 2
    rejected = 0 if rating >= 4.0 else 1

    result = post(
        "/performance/quality-evaluations",
        {
            "vendor_id": vendor_id,
            "purchase_order_id": po["id"],
            "rating": rating,
            "defects_count": defects,
            "rejected_items_count": rejected,
            "complaints": (
                None
                if rating >= 4.0
                else "Minor quality and delivery concerns reported."
            ),
            "notes": "Quality evaluation generated during operational testing.",
        },
    )

    if result:
        print(
            f"[+] Quality evaluation: "
            f"{rating}/5 for PO {po['po_number']}"
        )


# ============================================================
# 10. CREATE ISSUES
# ============================================================

issue_data = [
    ("Late delivery", "Purchase order delivered after expected date."),
    ("Damaged equipment", "Two items arrived with packaging damage."),
    ("Incorrect quantity", "Delivered quantity differed from purchase order."),
    ("Support response delay", "Vendor response exceeded expected SLA."),
    ("Documentation issue", "Required compliance documentation was incomplete."),
    ("Installation issue", "Installation required additional vendor support."),
]

issues = []

for i, (title, description) in enumerate(issue_data):

    if not purchase_orders:
        break

    po = purchase_orders[i % len(purchase_orders)]

    result = post(
        "/performance/issues",
        {
            "vendor_id": po["vendor_id"],
            "purchase_order_id": po["id"],
            "title": title,
            "description": description,
        },
    )

    if result:
        issues.append(result)
        print(f"[+] Issue created: {title}")


# ============================================================
# 11. RESOLVE SOME ISSUES
# ============================================================

for i, issue in enumerate(issues):

    if i % 2 == 0:

        result = put(
            f"/performance/issues/{issue['id']}/resolve",
            {
                "resolution_notes": (
                    "Issue investigated and resolved with vendor."
                )
            },
        )

        if result:
            print(f"[+] Issue resolved: {issue['title']}")


# ============================================================
# 12. CREATE CONTRACTS
# ============================================================

for i, vendor in enumerate(active_vendors[:6]):

    start = datetime.utcnow() - timedelta(days=180)

    if i == 0:
        end = datetime.utcnow() + timedelta(days=10)
    elif i == 1:
        end = datetime.utcnow() + timedelta(days=25)
    elif i == 2:
        end = datetime.utcnow() + timedelta(days=90)
    else:
        end = datetime.utcnow() + timedelta(days=365)

    result = post(
        "/contracts",
        {
            "vendor_id": vendor["id"],
            "title": f"{vendor['company_name']} Service Agreement",
            "description": (
                "Vendor service and procurement agreement."
            ),
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "value": 100000 + (i * 50000),
        },
    )

    if result:
        print(
            f"[+] Contract created: "
            f"{result['contract_number']}"
        )


# ============================================================
# 13. CREATE CERTIFICATIONS
# ============================================================

certifications = [
    "ISO 27001",
    "SOC 2 Type II",
    "ISO 9001",
    "PCI DSS",
    "GDPR Compliance",
    "Business Continuity Certification",
]

for i, vendor in enumerate(active_vendors):

    expiry = datetime.utcnow() + timedelta(
        days=[20, 45, 90, 180, 365, 30, 120, 240][i % 8]
    )

    result = post(
        "/contracts/certifications",
        {
            "vendor_id": vendor["id"],
            "name": certifications[i % len(certifications)],
            "issuing_body": "International Certification Authority",
            "issue_date": datetime.utcnow() - timedelta(days=300),
            "expiry_date": expiry.isoformat(),
        },
    )

    if result:
        print(
            f"[+] Certification created: "
            f"{result['name']} -> {vendor['company_name']}"
        )


# ============================================================
# 14. CREATE PERFORMANCE SNAPSHOTS
# ============================================================

for vendor in active_vendors:

    result = post(
        f"/performance/vendors/{vendor['id']}/snapshot",
        {},
    )

    if result:
        print(
            f"[+] Performance snapshot: "
            f"{vendor['company_name']}"
        )


# ============================================================
# 15. CALCULATE RELIABILITY
# ============================================================

for vendor in active_vendors:

    result = post(
        f"/reliability/vendors/{vendor['id']}/calculate",
        {},
    )

    if result:
        print(
            f"[+] Reliability calculated: "
            f"{vendor['company_name']} -> "
            f"{result['score']:.2f} "
            f"({result['risk_level']})"
        )


# ============================================================
# 16. RUN NOTIFICATION CHECKS
# ============================================================

result = post("/notifications/run-checks?days=30", {})

if result:
    print("\n[+] Notification checks executed")
    print(result)


# ============================================================
# 17. FINAL SUMMARY
# ============================================================

print("\n" + "=" * 65)
print("VENDORIQ MILESTONE 3 DATA GENERATION COMPLETE")
print("=" * 65)

vendors_now = get("/vendors") or []
procurement_now = get("/procurement") or []
po_now = get("/purchase-orders") or []

print("Vendors:", len(vendors_now))
print("Procurement Requests:", len(procurement_now))
print("Purchase Orders:", len(po_now))

print("\nNext:")
print("1. Open Dashboard")
print("2. Open Vendors")
print("3. Open Procurement")
print("4. Open Purchase Orders")
print("5. Open Contracts")
print("6. Open Communication")
print("7. Check Milestone 3 analytics/reliability endpoints")
