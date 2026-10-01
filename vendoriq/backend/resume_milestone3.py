import requests
from datetime import datetime, timedelta

BASE = "http://127.0.0.1:8000/api/v1"

session = requests.Session()


def login():
    r = session.post(
        f"{BASE}/auth/login-json",
        json={
            "email": "admin@vendoriq.com",
            "password": "Admin@123"
        }
    )

    r.raise_for_status()

    session.headers.update({
        "Authorization": f"Bearer {r.json()['access_token']}"
    })

    print("[+] Logged in successfully")


def get(path):
    r = session.get(f"{BASE}{path}")

    if r.status_code != 200:
        print(f"[!] GET {path} -> {r.status_code}")
        print(r.text)
        return None

    return r.json()


def post(path, payload):
    r = session.post(
        f"{BASE}{path}",
        json=payload
    )

    if r.status_code not in (200, 201):
        print(f"[!] POST {path} -> {r.status_code}")
        print(r.text)
        return None

    return r.json()


login()


# ============================================================
# GET EXISTING APPROVED VENDORS
# ============================================================

all_vendors = get("/vendors") or []

active_vendors = [
    v for v in all_vendors
    if v.get("status") in ("approved", "active")
]

print(f"[+] Found {len(active_vendors)} usable vendors")


# ============================================================
# CREATE CERTIFICATIONS
# ============================================================

certifications = [
    "ISO 27001",
    "SOC 2 Type II",
    "ISO 9001",
    "PCI DSS",
    "GDPR Compliance",
    "Business Continuity Certification",
]

expiry_days = [20, 45, 90, 180, 365, 30, 120, 240]

for i, vendor in enumerate(active_vendors):

    issue_date = (
        datetime.utcnow() - timedelta(days=300)
    ).isoformat()

    expiry_date = (
        datetime.utcnow()
        + timedelta(days=expiry_days[i % len(expiry_days)])
    ).isoformat()

    result = post(
        "/contracts/certifications",
        {
            "vendor_id": vendor["id"],
            "name": certifications[i % len(certifications)],
            "issuing_body": "International Certification Authority",
            "issue_date": issue_date,
            "expiry_date": expiry_date,
        }
    )

    if result:
        print(
            f"[+] Certification created: "
            f"{result['name']} -> {vendor['company_name']}"
        )


# ============================================================
# PERFORMANCE SNAPSHOTS
# ============================================================

for vendor in active_vendors:

    result = post(
        f"/performance/vendors/{vendor['id']}/snapshot",
        {}
    )

    if result:
        print(
            f"[+] Performance snapshot created: "
            f"{vendor['company_name']}"
        )


# ============================================================
# RELIABILITY SCORES
# ============================================================

for vendor in active_vendors:

    result = post(
        f"/reliability/vendors/{vendor['id']}/calculate",
        {}
    )

    if result:
        print(
            f"[+] Reliability calculated: "
            f"{vendor['company_name']} -> "
            f"{result.get('score')} "
            f"({result.get('risk_level')})"
        )


# ============================================================
# NOTIFICATION CHECKS
# ============================================================

result = post(
    "/notifications/run-checks?days=30",
    {}
)

if result:
    print("\n[+] Notification checks executed")
    print(result)


print("\n" + "=" * 60)
print("MILESTONE 3 DATA CONTINUATION COMPLETE")
print("=" * 60)

