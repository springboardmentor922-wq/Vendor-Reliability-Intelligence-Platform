import requests
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000/api/v1"

EMAIL = "admin@vendoriq.com"
PASSWORD = "Admin@123"

# Existing approved vendors
VENDORS = [
    "c4ddc15c-9b55-49ad-9bef-873fba1fd2a8",  # TechNova
    "c7bab899-21c9-415a-966c-b1e854bfc091",  # CyberShield
    "8bec620f-c7cf-4c70-bdc9-dbcb4ad971a2",  # NetCore
    "05d37a3f-87b4-4a27-80d6-72db25f5ac42",  # DataSecure
    "d07140fc-588f-4c1d-8843-e8684891a6fb",  # CloudMatrix
    "571be23b-adf9-4a7e-9f1d-763c339dc4cc",  # InfraGuard
    "55127507-7009-43bb-8595-30a279529517",  # SecureEdge
    "3b4e50c7-a83e-4208-8aa0-dd112e50ddf0",  # Alpha IT
    "fcde1124-5053-41c6-a4c7-f4c8cd8eb5ac",  # SecureNet
]

REQUESTS = [
    ("Next Generation Firewall", "Network Security", 275000, "urgent"),
    ("Endpoint Detection and Response", "Cybersecurity", 185000, "high"),
    ("SIEM License Renewal", "Security Operations", 145000, "high"),
    ("Network Access Control System", "Networking", 220000, "medium"),
    ("Vulnerability Scanner License", "Application Security", 125000, "high"),
    ("Secure Email Gateway", "Email Security", 95000, "medium"),
    ("Privileged Access Management", "Identity Security", 165000, "high"),
    ("Cloud Security Monitoring", "Cloud Security", 135000, "medium"),
    ("Wireless Security Infrastructure", "Networking", 110000, "medium"),
    ("Backup and Disaster Recovery", "Data Security", 250000, "urgent"),
    ("Security Awareness Platform", "Security Operations", 85000, "low"),
    ("Web Application Firewall", "Application Security", 195000, "high"),
    ("Database Security Solution", "Data Security", 155000, "high"),
    ("Zero Trust Network Upgrade", "Network Security", 310000, "urgent"),
    ("Security Incident Response Platform", "Incident Response", 175000, "medium"),
]

# Login
login = requests.post(
    f"{BASE_URL}/auth/login",
    data={
        "username": EMAIL,
        "password": PASSWORD,
    },
)

if login.status_code != 200:
    print("Login failed:")
    print(login.text)
    raise SystemExit(1)

token = login.json()["access_token"]

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
}

print("\nCreating pending procurement requests...\n")

created = 0

for i, (title, category, budget, priority) in enumerate(REQUESTS):
    payload = {
        "title": title,
        "description": f"Procurement request for {title.lower()} infrastructure and security requirements.",
        "department": "Information Security",
        "category": category,
        "quantity": 1,
        "unit": "project",
        "estimated_budget": budget,
        "priority": priority,
        "required_date": (
            datetime.utcnow() + timedelta(days=30 + i)
        ).isoformat(),
    }

    # Assign vendors to some requests.
    # Leave others unassigned so the UI shows "Select vendor".
    if i % 3 != 0:
        payload["assigned_vendor_id"] = VENDORS[i % len(VENDORS)]

    response = requests.post(
        f"{BASE_URL}/procurement",
        headers=headers,
        json=payload,
    )

    if response.status_code == 201:
        data = response.json()

        print(
            f"[+] {data['request_number']} | "
            f"{data['title']} | "
            f"{data['status']}"
        )

        created += 1
    else:
        print(f"[-] Failed: {title}")
        print(response.status_code)
        print(response.text)

print(f"\nCreated {created} pending procurement requests.")
print("Refresh the Procurement page.")

