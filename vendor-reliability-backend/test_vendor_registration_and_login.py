from fastapi.testclient import TestClient
import time
from app.main import app

client = TestClient(app)

def test_vendor_credentials_and_login():
    print("=" * 70)
    print("TESTING VENDOR PASSWORD & EMAIL REGISTRATION AND LOGIN")
    print("=" * 70)

    ts = int(time.time() * 1000)

    # ---------------------------------------------------------
    # 1. Register a Vendor via POST /vendors/register
    # ---------------------------------------------------------
    vendor1_email = f"fastsupply_{ts}@globalfreight.com"
    vendor1_pwd = f"SupplyPass_{ts}!"
    vendor1_payload = {
        "name": "FastSupply Logistics Rep",
        "company": f"FastSupply Logistics Corp {ts}",
        "email": vendor1_email,
        "password": vendor1_pwd,
        "phone": "+1 800-555-1234",
        "category": "Logistics & Transportation",
        "product": "Freight & Warehousing",
        "address": "100 Cargo Way, Newark, NJ",
        "website": "https://fastsupplylogistics.com"
    }

    res_reg = client.post("/vendors/register", json=vendor1_payload)
    assert res_reg.status_code == 201, f"Vendor registration failed: {res_reg.text}"
    reg_data = res_reg.json()
    assert reg_data["status"] == "success"
    assert reg_data["credentials"]["email"] == vendor1_email
    assert reg_data["credentials"]["approval_status"] == "APPROVED"
    assert reg_data["credentials"]["is_active"] is True
    vendor1_id = reg_data["vendor"]["id"]
    print(f"[PASS] 1. Registered vendor '{vendor1_payload['name']}' with email '{vendor1_email}' (Vendor ID: {vendor1_id})")

    # ---------------------------------------------------------
    # 2. Login immediately with registered vendor email & password
    # ---------------------------------------------------------
    res_login = client.post("/auth/login", json={
        "email": vendor1_email,
        "password": vendor1_pwd
    })
    assert res_login.status_code == 200, f"Vendor login failed: {res_login.text}"
    token_data = res_login.json()
    assert "access_token" in token_data
    assert token_data["user"]["role"] == "Vendor"
    assert token_data["user"]["email"] == vendor1_email
    v_token = token_data["access_token"]
    print(f"[PASS] 2. Logged in successfully with registered vendor credentials! Role: Vendor, Token received.")

    # ---------------------------------------------------------
    # 3. Check /auth/me for vendor
    # ---------------------------------------------------------
    res_me = client.get("/auth/me", headers={"Authorization": f"Bearer {v_token}"})
    assert res_me.status_code == 200
    me_data = res_me.json()
    assert me_data["email"] == vendor1_email
    assert me_data["role"] == "Vendor"
    assert me_data["vendor_id"] == vendor1_id
    print(f"[PASS] 3. GET /auth/me verified: vendor_id={me_data['vendor_id']}, role={me_data['role']}")

    # ---------------------------------------------------------
    # 4. Access Vendor's own profile via /vendors/my-profile
    # ---------------------------------------------------------
    res_profile = client.get("/vendors/my-profile", headers={"Authorization": f"Bearer {v_token}"})
    assert res_profile.status_code == 200
    assert res_profile.json()["id"] == vendor1_id
    print(f"[PASS] 4. GET /vendors/my-profile verified for registered vendor.")

    # ---------------------------------------------------------
    # 5. Register Vendor via POST /vendors (e.g. from Add Vendor form with password)
    # ---------------------------------------------------------
    vendor2_email = f"precision_{ts}@techparts.io"
    vendor2_pwd = f"Precision_{ts}#99"
    vendor2_payload = {
        "name": "Precision Tech Components",
        "company": f"Precision Tech Components Ltd {ts}",
        "email": vendor2_email,
        "password": vendor2_pwd,
        "phone": "+1 888-555-4321",
        "category": "Machinery & Spare Parts",
        "product": "Bearings & Pumps",
        "deliveryRate": 92.0,
        "quality_rating": 4.5,
        "response_time_hours": 12.0,
        "risk_level": "Low"
    }

    res_add = client.post("/vendors", json=vendor2_payload)
    assert res_add.status_code == 201, f"Add vendor failed: {res_add.text}"
    vendor2_id = res_add.json()["id"]
    print(f"[PASS] 5. Created vendor via POST /vendors with email '{vendor2_email}' and password (ID: {vendor2_id})")

    # Login with vendor 2
    res_login2 = client.post("/auth/login", json={
        "email": vendor2_email,
        "password": vendor2_pwd
    })
    assert res_login2.status_code == 200, f"Vendor 2 login failed: {res_login2.text}"
    assert res_login2.json()["user"]["role"] == "Vendor"
    print(f"[PASS] 6. Vendor 2 logged in successfully with registered password!")

    # ---------------------------------------------------------
    # 6. Check credentials status for vendor 2
    # ---------------------------------------------------------
    res_cred_status = client.get(f"/vendors/{vendor2_id}/credentials-status")
    assert res_cred_status.status_code == 200
    assert res_cred_status.json()["has_login_account"] is True
    assert res_cred_status.json()["login_email"] == vendor2_email
    print(f"[PASS] 7. GET /vendors/{vendor2_id}/credentials-status confirms active login account.")

    # ---------------------------------------------------------
    # 7. Update credentials for vendor 2 via POST /vendors/{id}/credentials
    # ---------------------------------------------------------
    new_pwd = f"UpdatedSecret_{ts}!"
    res_update_cred = client.post(f"/vendors/{vendor2_id}/credentials", json={
        "password": new_pwd
    })
    assert res_update_cred.status_code == 200
    print(f"[PASS] 8. Successfully updated password for vendor {vendor2_id}.")

    # Login with new password
    res_new_login = client.post("/auth/login", json={
        "email": vendor2_email,
        "password": new_pwd
    })
    assert res_new_login.status_code == 200
    print(f"[PASS] 9. Vendor logged in successfully with updated password!")

    # ---------------------------------------------------------
    # 8. Register Vendor via POST /auth/register-vendor
    # ---------------------------------------------------------
    vendor3_email = f"directvendor_{ts}@quantum.com"
    vendor3_pwd = f"QuantumPass_{ts}123"
    res_direct = client.post("/auth/register-vendor", json={
        "full_name": "Direct Quantum Supplier",
        "company": f"Direct Quantum Corp {ts}",
        "email": vendor3_email,
        "password": vendor3_pwd,
        "phone": "+1 800-777-9999",
        "vendor_category": "IT & Electronics",
        "product_service": "Laptops & Microelectronics"
    })
    assert res_direct.status_code == 201, f"Direct vendor registration failed: {res_direct.text}"
    assert "access_token" in res_direct.json()
    assert res_direct.json()["user"]["email"] == vendor3_email
    print(f"[PASS] 10. Direct vendor registration via /auth/register-vendor returns access_token immediately.")

    # Login with vendor 3
    res_login3 = client.post("/auth/login", json={
        "email": vendor3_email,
        "password": vendor3_pwd
    })
    assert res_login3.status_code == 200
    print(f"[PASS] 11. Vendor 3 logged in successfully via /auth/login!")

    # ---------------------------------------------------------
    # 9. Verify login using Vendor's Company Name
    # ---------------------------------------------------------
    res_company_login = client.post("/auth/login", json={
        "email": vendor1_payload["company"],
        "password": vendor1_pwd
    })
    assert res_company_login.status_code == 200
    assert res_company_login.json()["user"]["email"] == vendor1_email
    # ---------------------------------------------------------
    # 10. Register via standard /auth/register and login immediately with registered password
    # ---------------------------------------------------------
    vendor4_email = f"portal_vendor_{ts}@logistics-link.com"
    vendor4_pwd = f"PortalPass_{ts}#"
    res_reg4 = client.post("/auth/register", json={
        "full_name": "Portal Vendor Rep",
        "email": vendor4_email,
        "password": vendor4_pwd,
        "role": "Vendor",
        "vendor_category": "Logistics & Transportation",
        "phone": "+1 800-444-5555"
    })
    assert res_reg4.status_code == 201
    user4_id = res_reg4.json()["user"]["id"]
    print(f"[PASS] 13. Registered via /auth/register with email '{vendor4_email}' (Awaiting Admin approval)")

    # Admin approves vendor 4
    admin_login = client.post("/auth/login", json={"email": "admin@vendor-iq.com", "password": "admin123"})
    admin_token = admin_login.json()["access_token"]
    appr_res = client.post(f"/admin/users/{user4_id}/approve", json={"assigned_role": "Vendor"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert appr_res.status_code == 200
    print(f"[PASS] 14. Admin approved vendor 4 successfully.")

    # Vendor logs in with registered email & password
    res_login4 = client.post("/auth/login", json={
        "email": vendor4_email,
        "password": vendor4_pwd
    })
    assert res_login4.status_code == 200, f"Vendor 4 login failed: {res_login4.text}"
    assert res_login4.json()["user"]["role"] == "Vendor"
    assert res_login4.json()["user"]["approval_status"] == "APPROVED"
    # ---------------------------------------------------------
    # 11. Retrieve approved vendors list for automatic saved passwords on login page
    # ---------------------------------------------------------
    res_approved = client.get("/auth/approved-vendors-login")
    assert res_approved.status_code == 200
    appr_list = res_approved.json()
    assert len(appr_list) > 0, "Expected approved vendors in login list"
    first_appr = appr_list[0]
    assert "email" in first_appr
    assert "password" in first_appr
    assert first_appr["password"] == "vendor123"
    print(f"[PASS] 15. GET /auth/approved-vendors-login returned {len(appr_list)} approved vendors with saved passwords.")

    # ---------------------------------------------------------
    # 12. Test 1-click login using saved credentials of an approved vendor
    # ---------------------------------------------------------
    test_target_vendor = appr_list[0]
    res_saved_login = client.post("/auth/login", json={
        "email": test_target_vendor["email"],
        "password": test_target_vendor["password"]
    })
    assert res_saved_login.status_code == 200, f"Saved login failed for {test_target_vendor['email']}: {res_saved_login.text}"
    assert res_saved_login.json()["user"]["role"] == "Vendor"
    print(f"[PASS] 16. Successfully logged in using auto-saved credentials for approved vendor '{test_target_vendor['name']}' ({test_target_vendor['email']} / {test_target_vendor['password']})")

    print("\n" + "=" * 70)
    print("ALL VENDOR PASSWORD & EMAIL REGISTRATION AND LOGIN TESTS PASSED 100%!")
    print("=" * 70)

if __name__ == "__main__":
    test_vendor_credentials_and_login()

