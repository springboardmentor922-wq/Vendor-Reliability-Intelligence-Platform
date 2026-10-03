import requests

BASE_URL = "http://127.0.0.1:8000"
token = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "aish@test.com", "password": "test1234"
}).json()["access_token"]
h = {"Authorization": f"Bearer {token}"}

# Add the missing Service Provider vendor
resp = requests.post(f"{BASE_URL}/vendors/", json={
    "company_name": "Precision Facility Services",
    "contact_person": "Rekha Menon",
    "email": "rekha@precisionfacility.com",
    "phone": "9876500055",
    "address": "Kochi, Kerala",
    "category": "service_provider",
}, headers=h)
print("Service provider vendor:", resp.status_code, resp.json())

# Find and delete the leftover "string" test vendor
vendors = requests.get(f"{BASE_URL}/vendors/", headers=h).json()
for v in vendors:
    if v["company_name"].lower() == "string":
        del_resp = requests.delete(f"{BASE_URL}/vendors/{v['id']}", headers=h)
        print(f"Deleted leftover test vendor id={v['id']}, status={del_resp.status_code}")

print("\nAll vendors now:")
for v in requests.get(f"{BASE_URL}/vendors/", headers=h).json():
    print(f"  {v['id']}: {v['company_name']} ({v['category']})")