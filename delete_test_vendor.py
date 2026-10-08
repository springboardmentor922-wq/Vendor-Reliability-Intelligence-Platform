import requests

BASE_URL = "http://127.0.0.1:8000"
token = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "aish@test.com", "password": "test1234"
}).json()["access_token"]
h = {"Authorization": f"Bearer {token}"}

resp = requests.delete(f"{BASE_URL}/vendors/1", headers=h)
print("Delete status:", resp.status_code)

print("\nAll vendors now:")
for v in requests.get(f"{BASE_URL}/vendors/", headers=h).json():
    print(f"  {v['id']}: {v['company_name']} ({v['category']})")