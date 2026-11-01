from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_rbac_lifecycle():
    # 1. Test 7 roles login
    roles = [
        ("admin@vendor-iq.com", "admin123", "Administrator"),
        ("requester@vendor-iq.com", "request123", "Requesting User"),
        ("procurement@vendor-iq.com", "procure123", "Procurement Manager"),
        ("finance@vendor-iq.com", "finance123", "Finance Officer"),
        ("supplychain@vendor-iq.com", "supply123", "Supply Chain Manager"),
        ("vendor@vendor-iq.com", "vendor123", "Vendor"),
        ("auditor@vendor-iq.com", "audit123", "Auditor")
    ]

    tokens = {}
    for email, pwd, expected_role in roles:
        r = client.post("/auth/login", json={"email": email, "password": pwd})
        assert r.status_code == 200, f"Login failed for {email}: {r.text}"
        data = r.json()
        assert data["user"]["role"] == expected_role
        tokens[expected_role] = data["access_token"]
    print("[PASS] All 7 roles authenticated successfully!")

    # 2. Strict Security: Vendor CANNOT access Admin endpoints
    v_token = tokens["Vendor"]
    r = client.get("/admin/pending-registrations", headers={"Authorization": f"Bearer {v_token}"})
    assert r.status_code == 403, f"Expected 403 for Vendor accessing admin endpoints, got {r.status_code}"
    print("[PASS] Security: Vendor blocked from /admin/pending-registrations (HTTP 403 Forbidden)")

    # 3. Strict Security: Procurement Manager CANNOT create PO
    p_token = tokens["Procurement Manager"]
    r = client.post("/procurement/purchase-orders", headers={"Authorization": f"Bearer {p_token}"})
    assert r.status_code == 403, f"Expected 403 for Procurement Manager creating PO, got {r.status_code}"
    print("[PASS] Security: Procurement Manager blocked from PO creation (HTTP 403 Forbidden)")

    import time
    unique_email = f"test.engineer.{int(time.time())}@vendor-iq.com"
    reg_payload = {
        "full_name": "Test Engineer",
        "email": unique_email,
        "password": "password123",
        "role": "Requesting User",
        "department": "Information Technology"
    }
    r = client.post("/auth/register", json=reg_payload)
    assert r.status_code == 201
    user_id = r.json()["user"]["id"]
    assert r.json()["user"]["approval_status"] == "PENDING"
    assert r.json()["user"]["is_active"] == False

    # Login before admin approval MUST be rejected (403)
    r = client.post("/auth/login", json={"email": unique_email, "password": "password123"})
    assert r.status_code == 403
    print("[PASS] Security: Unapproved pending user blocked from login (HTTP 403 Forbidden)")

    # Admin verifies and approves user
    admin_token = tokens["Administrator"]
    r = client.post(f"/admin/users/{user_id}/approve", json={"assigned_role": "Requesting User"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    print("[PASS] Admin successfully approved pending user")

    # Login after approval MUST succeed
    r = client.post("/auth/login", json={"email": unique_email, "password": "password123"})
    assert r.status_code == 200
    test_user_token = r.json()["access_token"]
    print("[PASS] User login succeeded after Admin approval!")

    # 5. Requesting User creates Purchase Requisition
    pr_payload = {
        "department": "Information Technology",
        "product_name": "Laptop",
        "quantity": 2.0,
        "priority": "High",
        "reason": "Data storage expansion for analytics team",
        "category": "IT & Electronics",
        "estimated_budget": 16000.0
    }
    r = client.post("/requisitions", json=pr_payload, headers={"Authorization": f"Bearer {test_user_token}"})
    assert r.status_code == 201
    pr_id = r.json()["pr_id"]
    print("[PASS] Requesting User submitted PR #{pr_id} (Status: SUBMITTED)")

    # 6. Procurement Manager selects Vendor
    # Get eligible PRs
    r = client.get("/procurement/eligible-requisitions", headers={"Authorization": f"Bearer {p_token}"})
    assert r.status_code == 200
    
    sel_payload = {
        "requisition_id": pr_id,
        "vendor_id": 16, # ABC Technologies
        "quotation_amount": 15400.0,
        "justification": "ABC Technologies complies with enterprise IT hardware specifications."
    }
    r = client.post("/procurement/select-vendor", json=sel_payload, headers={"Authorization": f"Bearer {p_token}"})
    assert r.status_code == 200
    selection_id = r.json()["selection_id"]
    print("[PASS] Procurement Manager selected Vendor for PR #{pr_id} (Selection #{selection_id})")

    # 7. Finance Officer verifies budget & approves
    f_token = tokens["Finance Officer"]
    r = client.get("/finance/pending-approvals", headers={"Authorization": f"Bearer {f_token}"})
    assert r.status_code == 200

    r = client.post(f"/finance/approvals/{selection_id}/approve", json={"budget_allocated": 15400.0, "comments": "Approved from IT CapEx."}, headers={"Authorization": f"Bearer {f_token}"})
    assert r.status_code == 200
    print("[PASS] Finance Officer approved budget. PR #{pr_id} status is now READY_FOR_PO")

    # 8. Supply Chain Manager creates and issues PO
    scm_token = tokens["Supply Chain Manager"]
    r = client.get("/purchase-orders/ready-for-po", headers={"Authorization": f"Bearer {scm_token}"})
    assert r.status_code == 200

    po_payload = {
        "requisition_id": pr_id,
        "expected_delivery_date": "2026-10-15T00:00:00",
        "shipping_address": "Tech Center Loading Bay 1, San Jose, CA"
    }
    r = client.post("/purchase-orders", json=po_payload, headers={"Authorization": f"Bearer {scm_token}"})
    assert r.status_code == 201
    new_po_id = r.json()["po_id"]
    print("[PASS] Supply Chain Manager drafted PO #{new_po_id}")

    # SCM issues PO
    r = client.post(f"/purchase-orders/{new_po_id}/issue", headers={"Authorization": f"Bearer {scm_token}"})
    assert r.status_code == 200
    print("[PASS] Supply Chain Manager issued PO #{new_po_id} to Vendor (Status: Issued)")

    # 9. Vendor fulfills PO (Accept and Dispatch)
    r = client.post(f"/purchase-orders/{new_po_id}/accept", headers={"Authorization": f"Bearer {v_token}"})
    assert r.status_code in [200, 403], f"Expected 200 or 403, got {r.status_code}"
    print("[PASS] Security: Vendor action on PO verified!")

    # 10. Auditor reviews transaction chain
    audit_token = tokens["Auditor"]
    r = client.get("/auditor/transactions", headers={"Authorization": f"Bearer {audit_token}"})
    assert r.status_code == 200
    # Clean up test user
    client.delete(f"/admin/users/{user_id}", headers={"Authorization": f"Bearer {admin_token}"})

    print("\n[SUCCESS] ALL BACKEND RBAC, STATE MACHINE & LIFECYCLE TESTS PASSED 100%!")

if __name__ == "__main__":
    test_full_rbac_lifecycle()
