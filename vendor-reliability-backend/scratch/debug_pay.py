from fastapi.testclient import TestClient
from app.main import app
import traceback

client = TestClient(app, raise_server_exceptions=False)

# Login as finance officer
res = client.post("/auth/login", json={"email": "finance@vendor-iq.com", "password": "finance123"})
print("Finance login:", res.status_code)
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Get invoices
inv_res = client.get("/finance/invoices", headers=headers)
print("Invoices count:", len(inv_res.json()))
if inv_res.json():
    inv = inv_res.json()[0]
    inv_id = inv["id"]
    print("Testing invoice ID:", inv_id, "amount:", inv["amount"])
    
    pay_payload = {
        "invoice_id": inv_id,
        "amount": inv["amount"],
        "payment_method": "Wire Transfer",
        "transaction_reference": f"WT-DEBUG-001",
        "notes": "Testing payment traceback"
    }
    pay_res = client.post("/finance/payments", json=pay_payload, headers=headers)
    print("Payment status:", pay_res.status_code)
    print("Payment response:", pay_res.text)
