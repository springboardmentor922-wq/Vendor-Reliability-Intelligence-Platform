import requests

BASE_URL = "http://127.0.0.1:8000"
token = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "aish@test.com", "password": "test1234"
}).json()["access_token"]
h = {"Authorization": f"Bearer {token}"}

vendors = requests.get(f"{BASE_URL}/vendors/", headers=h).json()
for v in vendors:
    if v["status"] != "approved":
        resp = requests.put(f"{BASE_URL}/vendors/{v['id']}", json={"status": "approved"}, headers=h)
        print(f"Approved: {v['company_name']} -> {resp.status_code}")
    else:
        print(f"Already approved: {v['company_name']}")