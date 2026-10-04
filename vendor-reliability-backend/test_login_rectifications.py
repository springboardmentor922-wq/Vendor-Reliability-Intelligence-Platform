from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_login_rectifications():
    print("=== TESTING ALL LOGIN RECTIFICATIONS ===")

    # 1. Standard demo logins with full email
    demo_credentials = [
        ("admin@vendor-iq.com", "admin123", "Administrator"),
        ("requester@vendor-iq.com", "request123", "Requesting User"),
        ("procurement@vendor-iq.com", "procure123", "Procurement Manager"),
        ("finance@vendor-iq.com", "finance123", "Finance Officer"),
        ("supplychain@vendor-iq.com", "supply123", "Supply Chain Manager"),
        ("vendor@vendor-iq.com", "vendor123", "Vendor"),
        ("auditor@vendor-iq.com", "audit123", "Auditor"),
    ]
    for email, pwd, role in demo_credentials:
        res = client.post("/auth/login", json={"email": email, "password": pwd})
        assert res.status_code == 200, f"Failed for {email}: {res.text}"
        data = res.json()
        assert "access_token" in data
        assert data["user"]["role"] == role
        print(f"[PASS] Demo email login: {email} -> {role}")

    # 2. Username / prefix logins (e.g. 'admin', 'requester', 'finance')
    username_credentials = [
        ("admin", "admin123", "Administrator"),
        ("requester", "request123", "Requesting User"),
        ("procurement", "procure123", "Procurement Manager"),
        ("finance", "finance123", "Finance Officer"),
        ("supplychain", "supply123", "Supply Chain Manager"),
        ("vendor", "vendor123", "Vendor"),
        ("auditor", "audit123", "Auditor"),
    ]
    for u, pwd, role in username_credentials:
        res = client.post("/auth/login", json={"email": u, "password": pwd})
        assert res.status_code == 200, f"Failed for username {u}: {res.text}"
        assert res.json()["user"]["role"] == role
        print(f"[PASS] Username login: '{u}' -> {role}")

    # 3. User-created accounts: Prabhas and Manikanta
    custom_credentials = [
        ("prabhas", "prabhas", "Procurement Manager"),
        ("prabhas@gmail.com", "prabhas", "Procurement Manager"),
        ("prabhas", "prabhas123", "Procurement Manager"),
        ("manikanta", "vendor123", "Vendor"),
        ("manikanta", "manikanta", "Vendor"),
        ("manikanta", "manikanta123", "Vendor"),
        ("manikantta", "vendor123", "Vendor"),
        ("manikantta@gmail.com", "vendor123", "Vendor"),
    ]
    for identifier, pwd, role in custom_credentials:
        res = client.post("/auth/login", json={"email": identifier, "password": pwd})
        assert res.status_code == 200, f"Failed for custom user {identifier} with pwd {pwd}: {res.text}"
        assert res.json()["user"]["role"] == role
        print(f"[PASS] Custom user login: '{identifier}' / '{pwd}' -> {role}")

    # 4. Email / Username whitespace and casing tolerance
    res_casing = client.post("/auth/login", json={"email": "  ADMIN@VENDOR-IQ.COM  ", "password": " admin123 "})
    assert res_casing.status_code == 200
    print("[PASS] Whitespace and casing tolerance in login")

    # 5. Non-existent account returns clean, informative 401
    res_unknown = client.post("/auth/login", json={"email": "nonexistent_user", "password": "anypassword"})
    assert res_unknown.status_code == 401
    assert "No account found matching 'nonexistent_user'" in res_unknown.json()["detail"]
    print("[PASS] Unknown user returns clean 401 error message")

    # 6. Incorrect password returns clean, informative 401
    res_wrong_pwd = client.post("/auth/login", json={"email": "admin", "password": "completely_wrong_pwd"})
    assert res_wrong_pwd.status_code == 401
    assert "Incorrect password for admin@vendor-iq.com" in res_wrong_pwd.json()["detail"]
    print("[PASS] Wrong password returns clean 401 error message")

    # 7. Authenticated /me endpoint works with bearer token
    token = res_casing.json()["access_token"]
    res_me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    assert res_me.json()["email"] == "admin@vendor-iq.com"
    print("[PASS] GET /auth/me returns valid user info")

    print("\n=== ALL LOGIN RECTIFICATION TESTS PASSED 100%! ===")

if __name__ == "__main__":
    test_login_rectifications()
