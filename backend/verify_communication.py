import asyncio
import os
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models import Role, User, Vendor, VendorContact
from app.security import get_password_hash
from sqlalchemy.future import select

async def run_communication_tests():
    print("==================================================")
    print("STARTING COMMUNICATION MODULE VERIFICATION TESTS")
    print("==================================================")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:

        # 0. Setup: Ensure Admin and Vendor test users exist
        async with AsyncSessionLocal() as db:
            # Roles
            r_admin = (await db.execute(select(Role).where(Role.name == "Administrator"))).scalar_one_or_none()
            if not r_admin:
                r_admin = Role(name="Administrator")
                db.add(r_admin)
            r_vendor = (await db.execute(select(Role).where(Role.name == "Vendor"))).scalar_one_or_none()
            if not r_vendor:
                r_vendor = Role(name="Vendor")
                db.add(r_vendor)
            await db.commit()
            await db.refresh(r_admin)
            await db.refresh(r_vendor)

            # Admin User
            admin_user = (await db.execute(select(User).where(User.email == "admin@example.com"))).scalar_one_or_none()
            if not admin_user:
                admin_user = User(
                    email="admin@example.com",
                    hashed_password=get_password_hash("Admin@123456"),
                    full_name="System Administrator",
                    status="APPROVED",
                    roles=[r_admin]
                )
                db.add(admin_user)
                await db.commit()

            # Test Vendor A
            vendor_a = (await db.execute(select(Vendor).where(Vendor.registration_no == "REG-COMM-VEND-A"))).scalar_one_or_none()
            if not vendor_a:
                vendor_a = Vendor(
                    company_name="Apex Communication Partner A",
                    registration_no="REG-COMM-VEND-A",
                    category="Logistics",
                    status="approved"
                )
                db.add(vendor_a)
                await db.commit()
                await db.refresh(vendor_a)

                vc = VendorContact(
                    vendor_id=vendor_a.id,
                    name="Elena Vance",
                    email="vendor_a@example.com",
                    phone="1234567890"
                )
                db.add(vc)
                await db.commit()

            # Vendor A User
            vendor_a_user = (await db.execute(select(User).where(User.email == "vendor_a@example.com"))).scalar_one_or_none()
            if not vendor_a_user:
                vendor_a_user = User(
                    email="vendor_a@example.com",
                    hashed_password=get_password_hash("Vendor@123456"),
                    full_name="Elena Vance",
                    status="APPROVED",
                    roles=[r_vendor]
                )
                db.add(vendor_a_user)
                await db.commit()

            # Test Vendor B (for RBAC cross-vendor isolation test)
            vendor_b = (await db.execute(select(Vendor).where(Vendor.registration_no == "REG-COMM-VEND-B"))).scalar_one_or_none()
            if not vendor_b:
                vendor_b = Vendor(
                    company_name="Titan Supplier B",
                    registration_no="REG-COMM-VEND-B",
                    category="Equipment",
                    status="approved"
                )
                db.add(vendor_b)
                await db.commit()
                await db.refresh(vendor_b)

            vendor_a_id = vendor_a.id
            vendor_b_id = vendor_b.id

        # 1. Authenticate as Administrator
        print("\n[TEST 1] Authenticate as Administrator...")
        admin_login = await client.post("/api/v1/auth/login", json={
            "email": "admin@example.com",
            "password": "Admin@123456"
        })
        assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print("  -> Admin token acquired.")

        # 2. Authenticate as Vendor A User
        print("\n[TEST 2] Authenticate as Vendor User...")
        vendor_login = await client.post("/api/v1/auth/login", json={
            "email": "vendor_a@example.com",
            "password": "Vendor@123456"
        })
        assert vendor_login.status_code == 200, f"Vendor login failed: {vendor_login.text}"
        vendor_token = vendor_login.json()["access_token"]
        vendor_headers = {"Authorization": f"Bearer {vendor_token}"}
        print("  -> Vendor token acquired.")

        # 3. Post Message as Administrator to Vendor A
        print(f"\n[TEST 3] Send message as Admin to Vendor A ({vendor_a_id})...")
        msg_payload = {
            "message": "Welcome to our vendor reliability portal. Please review your compliance checklist."
        }
        send_resp = await client.post(f"/api/v1/vendors/{vendor_a_id}/messages", json=msg_payload, headers=admin_headers)
        assert send_resp.status_code == 201, f"Failed: {send_resp.text}"
        msg_data = send_resp.json()
        assert msg_data["message"] == msg_payload["message"]
        assert msg_data["sender_role"] == "Administrator"
        message_id = msg_data["id"]
        print(f"  -> Message created with id: {message_id}")

        # 4. Fetch Messages as Vendor A (Confirm thread visibility)
        print(f"\n[TEST 4] Fetch Vendor A thread as Vendor A...")
        get_thread = await client.get(f"/api/v1/vendors/{vendor_a_id}/messages", headers=vendor_headers)
        assert get_thread.status_code == 200, f"Failed: {get_thread.text}"
        messages = get_thread.json()
        assert len(messages) >= 1
        found_admin_msg = any(m["id"] == message_id for m in messages)
        assert found_admin_msg, "Sent admin message not found in vendor thread!"
        print(f"  -> Vendor A sees {len(messages)} message(s) in their thread.")

        # 5. Reply as Vendor A
        print(f"\n[TEST 5] Reply to thread as Vendor A...")
        reply_payload = {
            "message": "Thank you! We have uploaded our revised insurance certifications."
        }
        reply_resp = await client.post(f"/api/v1/vendors/{vendor_a_id}/messages", json=reply_payload, headers=vendor_headers)
        assert reply_resp.status_code == 201, f"Failed: {reply_resp.text}"
        reply_data = reply_resp.json()
        assert reply_data["sender_role"] == "Vendor"
        vendor_msg_id = reply_data["id"]
        print(f"  -> Vendor reply sent successfully (id: {vendor_msg_id}).")

        # 6. Upload file attachment to message
        print(f"\n[TEST 6] Upload file attachment to message {vendor_msg_id}...")
        test_file_content = b"Mock PDF insurance certificate content for test verification."
        files = {
            "file": ("certificate.pdf", test_file_content, "application/pdf")
        }
        attach_resp = await client.post(
            f"/api/v1/vendors/{vendor_a_id}/messages/{vendor_msg_id}/attachment",
            files=files,
            headers=vendor_headers
        )
        assert attach_resp.status_code == 200, f"Failed: {attach_resp.text}"
        attach_data = attach_resp.json()
        assert attach_data["attachment_path"] is not None
        assert "certificate.pdf" in attach_data["attachment_path"]
        print(f"  -> File attached: {attach_data['attachment_path']}")

        # 7. Download attachment
        print(f"\n[TEST 7] Download attached file...")
        dl_resp = await client.get(
            f"/api/v1/vendors/{vendor_a_id}/messages/{vendor_msg_id}/attachment",
            headers=admin_headers
        )
        assert dl_resp.status_code == 200, f"Failed: {dl_resp.text}"
        assert dl_resp.content == test_file_content
        print(f"  -> Downloaded {len(dl_resp.content)} bytes matching uploaded file.")

        # 8. Check Activity Logs endpoint
        print(f"\n[TEST 8] Fetch activity log for Vendor A...")
        act_resp = await client.get(f"/api/v1/vendors/{vendor_a_id}/activity", headers=admin_headers)
        assert act_resp.status_code == 200, f"Failed: {act_resp.text}"
        activities = act_resp.json()
        assert len(activities) >= 2, f"Expected at least 2 activities, got {len(activities)}"
        actions = [a["action"] for a in activities]
        assert "SENT_MESSAGE" in actions
        assert "ATTACHED_FILE" in actions
        print(f"  -> Activity logs recorded properly ({len(activities)} entries): {actions[:4]}")

        # 9. Verify Notifications
        print("\n[TEST 9] Check that notifications were emitted for messages...")
        notif_resp = await client.get("/api/v1/notifications", headers=admin_headers)
        assert notif_resp.status_code == 200
        notifs = notif_resp.json()
        comm_notifs = [n for n in notifs if "💬" in n["message"]]
        assert len(comm_notifs) > 0, "No communication notifications found!"
        print(f"  -> Found {len(comm_notifs)} communication notifications in drawer.")

        # 10. RBAC Isolation Check: Vendor A cannot access or post to Vendor B's thread
        print(f"\n[TEST 10] RBAC Isolation: Vendor A attempting to access Vendor B ({vendor_b_id})...")
        cross_get = await client.get(f"/api/v1/vendors/{vendor_b_id}/messages", headers=vendor_headers)
        assert cross_get.status_code == 403, f"Expected 403 Forbidden, got {cross_get.status_code}"
        print("  -> GET unauthorized vendor thread correctly returned 403 Forbidden.")

        cross_post = await client.post(
            f"/api/v1/vendors/{vendor_b_id}/messages",
            json={"message": "Unauthorized intrusion attempt"},
            headers=vendor_headers
        )
        assert cross_post.status_code == 403, f"Expected 403 Forbidden, got {cross_post.status_code}"
        print("  -> POST to unauthorized vendor thread correctly returned 403 Forbidden.")

        cross_act = await client.get(f"/api/v1/vendors/{vendor_b_id}/activity", headers=vendor_headers)
        assert cross_act.status_code == 403, f"Expected 403 Forbidden, got {cross_act.status_code}"
        print("  -> GET activity for unauthorized vendor correctly returned 403 Forbidden.")

        # 11. Unauthenticated Check
        print("\n[TEST 11] Unauthenticated request...")
        unauth_resp = await client.get(f"/api/v1/vendors/{vendor_a_id}/messages")
        assert unauth_resp.status_code == 401
        print("  -> Unauthenticated request correctly rejected with 401 Unauthorized.")

    print("\n==================================================")
    print("ALL COMMUNICATION MODULE TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_communication_tests())
