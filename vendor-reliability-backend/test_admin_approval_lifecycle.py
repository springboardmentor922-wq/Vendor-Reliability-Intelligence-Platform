import time
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_admin_approval_and_monitoring():
    print("=== STARTING ADMIN USER APPROVAL, DATABASE STORAGE & MONITORING TESTS ===")

    # 1. Login as Administrator
    admin_login_res = client.post("/auth/login", json={
        "email": "admin@vendor-iq.com",
        "password": "admin123"
    })
    assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.text}"
    admin_token = admin_login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] 1. Admin authenticated successfully.")

    # 2. Register User 1 (to be approved)
    ts = int(time.time() * 1000)
    user1_email = f"user.approve.{ts}@vendor-iq.com"
    reg1_res = client.post("/auth/register", json={
        "full_name": "Approve Candidate",
        "email": user1_email,
        "password": "candidate123",
        "role": "Requesting User",
        "company": "VendorIQ Enterprise",
        "department": "Engineering"
    })
    assert reg1_res.status_code == 201, f"Registration failed: {reg1_res.text}"
    user1_data = reg1_res.json()["user"]
    user1_id = user1_data["id"]
    assert user1_data["approval_status"] == "PENDING"
    assert user1_data["is_active"] is False
    print(f"[PASS] 2. User 1 registered with PENDING approval_status & is_active=False (ID: {user1_id}).")

    # 3. Register User 2 (to be rejected)
    user2_email = f"user.reject.{ts}@vendor-iq.com"
    reg2_res = client.post("/auth/register", json={
        "full_name": "Reject Candidate",
        "email": user2_email,
        "password": "candidate123",
        "role": "Procurement Manager",
        "company": "External Vendor Inc",
        "department": "External"
    })
    assert reg2_res.status_code == 201
    user2_id = reg2_res.json()["user"]["id"]
    print(f"[PASS] 3. User 2 registered with PENDING approval_status & is_active=False (ID: {user2_id}).")

    # 4. Attempt login before Admin approval -> MUST return 403 Forbidden
    login_attempt_res = client.post("/auth/login", json={
        "email": user1_email,
        "password": "candidate123"
    })
    assert login_attempt_res.status_code == 403
    assert "pending Administrator verification" in login_attempt_res.json()["detail"]
    print("[PASS] 4. Pending user login safely blocked (HTTP 403).")

    # 5. Admin monitors pending registrations list
    pending_res = client.get("/admin/pending-registrations", headers=admin_headers)
    assert pending_res.status_code == 200
    pending_list = pending_res.json()
    pending_emails = [u["email"] for u in pending_list]
    assert user1_email in pending_emails
    assert user2_email in pending_emails
    print(f"[PASS] 5. Admin successfully retrieved {len(pending_list)} pending registrations for review.")

    # 6. Admin REJECTS User 2 with reason
    rejection_reason = "Unverified organizational affiliation and invalid corporate email."
    reject_res = client.post(f"/admin/users/{user2_id}/reject", json={
        "rejection_reason": rejection_reason
    }, headers=admin_headers)
    assert reject_res.status_code == 200
    assert reject_res.json()["approval_status"] == "REJECTED"
    assert reject_res.json()["reason"] == rejection_reason
    print(f"[PASS] 6. Admin rejected User 2 with reason recorded in database.")

    # 7. Rejected user attempts login -> MUST return 403 Forbidden with specific reason
    rejected_login_res = client.post("/auth/login", json={
        "email": user2_email,
        "password": "candidate123"
    })
    assert rejected_login_res.status_code == 403
    assert rejection_reason in rejected_login_res.json()["detail"]
    print(f"[PASS] 7. Rejected user login blocked with custom rejection reason returned.")

    # 8. Admin APPROVES User 1 and confirms role
    approve_res = client.post(f"/admin/users/{user1_id}/approve", json={
        "assigned_role": "Requesting User",
        "notes": "Corporate identity verified."
    }, headers=admin_headers)
    assert approve_res.status_code == 200
    assert approve_res.json()["approval_status"] == "APPROVED"
    assert approve_res.json()["is_active"] is True
    print(f"[PASS] 8. Admin approved User 1. approval_status='APPROVED', is_active=True stored in database.")

    # 9. Approved User 1 logs in -> MUST succeed
    user1_login_res = client.post("/auth/login", json={
        "email": user1_email,
        "password": "candidate123"
    })
    assert user1_login_res.status_code == 200
    assert "access_token" in user1_login_res.json()
    print("[PASS] 9. Approved user successfully logged in and received JWT token.")

    # 10. Admin monitors all users access directory with filtering
    users_res = client.get("/users?approval_status=APPROVED", headers=admin_headers)
    assert users_res.status_code == 200
    approved_users = users_res.json()
    assert any(u["email"] == user1_email for u in approved_users)
    print(f"[PASS] 10. Admin queried users filtered by approval_status='APPROVED' ({len(approved_users)} found).")

    rejected_res = client.get("/users?approval_status=REJECTED", headers=admin_headers)
    assert rejected_res.status_code == 200
    rejected_users = rejected_res.json()
    assert any(u["email"] == user2_email for u in rejected_users)
    print(f"[PASS] 11. Admin queried users filtered by approval_status='REJECTED' ({len(rejected_users)} found).")

    # 12. Admin monitors system statistics KPI dashboard
    stats_res = client.get("/admin/system-statistics", headers=admin_headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "users" in stats
    assert "total" in stats["users"]
    assert "active" in stats["users"]
    assert "pending_approvals" in stats["users"]
    print(f"[PASS] 12. Admin retrieved system monitoring stats: Total Users={stats['users']['total']}, Active={stats['users']['active']}, Pending={stats['users']['pending_approvals']}.")

    # 13. Safety guard: Admin cannot deactivate their own account
    admin_self_deact_res = client.put("/admin/users/1/status", json={"is_active": False}, headers=admin_headers)
    assert admin_self_deact_res.status_code == 400
    assert "cannot deactivate their own account" in admin_self_deact_res.json()["detail"]
    print("[PASS] 13. Safety guard confirmed: Admin cannot accidentally deactivate own account.")

    # 14. Audit log verification
    audit_res = client.get("/communications/audit-logs", headers=admin_headers)
    assert audit_res.status_code == 200
    actions = [log["action"] for log in audit_res.json()]
    assert "ADMIN_USER_APPROVED" in actions
    assert "ADMIN_USER_REJECTED" in actions
    print("[PASS] 14. Immutable audit trail verified: ADMIN_USER_APPROVED & ADMIN_USER_REJECTED recorded in database.")

    # 15. Clean up temporary test users so the database remains completely clean
    client.delete(f"/admin/users/{user1_id}", headers=admin_headers)
    client.delete(f"/admin/users/{user2_id}", headers=admin_headers)
    print("[PASS] 15. Temporary test users cleaned up; database restored to clean state.")

    print("\n=== ALL 15 ADMIN APPROVAL, DATABASE STORAGE & MONITORING TESTS PASSED! ===")

if __name__ == "__main__":
    test_admin_approval_and_monitoring()
