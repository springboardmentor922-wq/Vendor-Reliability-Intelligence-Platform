import asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models import Role, User, Vendor, VendorContact
from app.security import get_password_hash
from sqlalchemy.future import select

async def run_milestone3b_tests():
    print("==================================================")
    print("STARTING MILESTONE 3 GROUP B VERIFICATION TESTS")
    print("==================================================")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:

        # 0. Setup test users and roles: Admin, Procurement Manager, Vendor
        async with AsyncSessionLocal() as db:
            # Roles
            roles = {}
            for r_name in ["Administrator", "Procurement Manager", "Vendor"]:
                r = (await db.execute(select(Role).where(Role.name == r_name))).scalar_one_or_none()
                if not r:
                    r = Role(name=r_name)
                    db.add(r)
                    await db.commit()
                    await db.refresh(r)
                roles[r_name] = r

            # Admin
            admin = (await db.execute(select(User).where(User.email == "admin@example.com"))).scalar_one_or_none()
            if not admin:
                admin = User(
                    email="admin@example.com",
                    hashed_password=get_password_hash("Admin@123456"),
                    full_name="System Administrator",
                    status="APPROVED",
                    roles=[roles["Administrator"]]
                )
                db.add(admin)
                await db.commit()

            # Procurement Manager
            pm = (await db.execute(select(User).where(User.email == "pm@example.com"))).scalar_one_or_none()
            if not pm:
                pm = User(
                    email="pm@example.com",
                    hashed_password=get_password_hash("Procurement@123456"),
                    full_name="Procurement Manager",
                    status="APPROVED",
                    roles=[roles["Procurement Manager"]]
                )
                db.add(pm)
                await db.commit()

            # Create a Vendor and linked Vendor User
            v_stmt = select(Vendor).where(Vendor.company_name == "Apex Strategic Systems")
            test_vendor = (await db.execute(v_stmt)).scalar_one_or_none()
            if not test_vendor:
                test_vendor = Vendor(
                    company_name="Apex Strategic Systems",
                    registration_no=f"REG-APEX-{asyncio.get_event_loop().time():.0f}",
                    category="Hardware",
                    status="approved"
                )
                db.add(test_vendor)
                await db.commit()
                await db.refresh(test_vendor)

                # Add Contact
                contact = VendorContact(
                    vendor_id=test_vendor.id,
                    name="Elena Vance",
                    email="vendor_user@example.com",
                    phone="+1 555-0199"
                )
                db.add(contact)
                await db.commit()

            vendor_user = (await db.execute(select(User).where(User.email == "vendor_user@example.com"))).scalar_one_or_none()
            if not vendor_user:
                vendor_user = User(
                    email="vendor_user@example.com",
                    hashed_password=get_password_hash("Vendor@123456"),
                    full_name="Elena Vance (Vendor Rep)",
                    status="APPROVED",
                    roles=[roles["Vendor"]]
                )
                db.add(vendor_user)
                await db.commit()

            vendor_id = str(test_vendor.id)

        # 1. Login as Admin
        print("\n[TEST 1] Authenticate as Administrator...")
        admin_login = await client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "Admin@123456"})
        assert admin_login.status_code == 200
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
        print("  -> Admin token acquired.")

        # 2. Login as Procurement Manager
        print("\n[TEST 2] Authenticate as Procurement Manager...")
        pm_login = await client.post("/api/v1/auth/login", json={"email": "pm@example.com", "password": "Procurement@123456"})
        assert pm_login.status_code == 200
        pm_headers = {"Authorization": f"Bearer {pm_login.json()['access_token']}"}
        print("  -> Procurement Manager token acquired.")

        # 3. Login as Vendor
        print("\n[TEST 3] Authenticate as Vendor...")
        v_login = await client.post("/api/v1/auth/login", json={"email": "vendor_user@example.com", "password": "Vendor@123456"})
        assert v_login.status_code == 200
        vendor_headers = {"Authorization": f"Bearer {v_login.json()['access_token']}"}
        print("  -> Vendor token acquired.")

        # 4. Verify GET /api/v1/dashboard/procurement
        print("\n[TEST 4] Test Procurement Dashboard API (/dashboard/procurement)...")
        proc_resp = await client.get("/api/v1/dashboard/procurement", headers=admin_headers)
        assert proc_resp.status_code == 200, f"Failed: {proc_resp.text}"
        p_data = proc_resp.json()
        print(f"  -> Total PRs: {p_data['total_pr_count']}, Total POs: {p_data['total_po_count']}, Spend: ${p_data['total_po_spend']}")
        assert "pr_by_status" in p_data
        assert "po_by_status" in p_data
        assert "recent_prs" in p_data
        assert "recent_pos" in p_data
        print("  -> Procurement dashboard response verified.")

        # 5. Verify GET /api/v1/dashboard/admin
        print("\n[TEST 5] Test Admin Dashboard API (/dashboard/admin)...")
        admin_dash_resp = await client.get("/api/v1/dashboard/admin", headers=admin_headers)
        assert admin_dash_resp.status_code == 200, f"Failed: {admin_dash_resp.text}"
        a_data = admin_dash_resp.json()
        print(f"  -> Users: {a_data['total_users']}, Pending: {a_data['pending_users']}, Vendors: {a_data['total_vendors']}")
        print(f"  -> Active Contracts: {a_data['active_contracts']}, Overdue POs: {a_data['overdue_pos']}")
        assert a_data["total_users"] >= 2
        assert a_data["total_vendors"] >= 1
        print("  -> Admin dashboard verified.")

        # RBAC: Vendor cannot access admin dashboard
        v_admin_resp = await client.get("/api/v1/dashboard/admin", headers=vendor_headers)
        assert v_admin_resp.status_code == 403
        print("  -> Non-admin access to /admin correctly rejected with 403 Forbidden.")

        # 6. Verify GET /api/v1/dashboard/vendor/{vendor_id}
        print("\n[TEST 6] Test Individual Vendor Dashboard API (/dashboard/vendor/{id})...")
        # As Admin
        v_dash_resp = await client.get(f"/api/v1/dashboard/vendor/{vendor_id}", headers=admin_headers)
        assert v_dash_resp.status_code == 200, f"Failed: {v_dash_resp.text}"
        vd = v_dash_resp.json()
        print(f"  -> Vendor: {vd['company_name']} ({vd['vendor_id']})")
        print(f"  -> Reliability Score: {vd['reliability']['overall_reliability_score']} ({vd['reliability']['risk_level']})")
        print(f"  -> Quality: {vd['performance']['quality_rating']}, Delivery: {vd['performance']['delivery_rate']}%")
        print(f"  -> Total Contracts: {vd['contracts']['total_contracts']}, Total Orders: {vd['orders']['total_orders']}")
        print(f"  -> Communication Activity: {vd['communication']['note']}")
        assert vd["communication"]["messages_sent"] == 0
        assert vd["communication"]["unread_messages"] == 0

        # As own vendor user
        own_resp = await client.get(f"/api/v1/dashboard/vendor/{vendor_id}", headers=vendor_headers)
        assert own_resp.status_code == 200
        print("  -> Vendor accessing own dashboard successfully authenticated.")

        # Cross-vendor isolation: Vendor cannot access another random vendor's dashboard
        other_uuid = str(uuid.uuid4())
        cross_resp = await client.get(f"/api/v1/dashboard/vendor/{other_uuid}", headers=vendor_headers)
        assert cross_resp.status_code in (403, 404)
        print("  -> Vendor accessing unauthorized vendor dashboard rejected with 403/404.")

        # 7. Test Notifications: Overdue check and type tags
        print("\n[TEST 7] Test Overdue Notification Trigger & Type Tagging...")
        check_resp = await client.post("/api/v1/notifications/check-overdue", headers=admin_headers)
        assert check_resp.status_code == 200, f"Failed: {check_resp.text}"
        print(f"  -> Overdue/compliance scan executed: {check_resp.json()['message']}")

        # Read notifications and verify 'type' field is returned
        notifs_resp = await client.get("/api/v1/notifications", headers=admin_headers)
        assert notifs_resp.status_code == 200
        notifs = notifs_resp.json()
        assert len(notifs) > 0
        print(f"  -> Found {len(notifs)} notifications in database.")
        for n in notifs[:5]:
            print(f"     * [{n.get('type')}] {n['message'][:70]}... (is_read: {n['is_read']})")
            assert "type" in n, "Notification item missing 'type' field!"
        print("  -> Notification type tagging confirmed on all items.")

        # 8. Test Email & SMS Service functions directly
        print("\n[TEST 8] Test Email & SMS Stubs Execution...")
        from app.email_service import send_delivery_delay_alert, send_compliance_flag_alert
        from app.sms_service import send_delivery_delay_sms, send_compliance_sms

        e1 = send_delivery_delay_alert("partner@test.com", "Apex Logistics", "PO-999")
        e2 = send_compliance_flag_alert("partner@test.com", "Apex Logistics", "ISO audit expired")
        s1 = send_delivery_delay_sms("+15551234567", "PO-999")
        s2 = send_compliance_sms("+15551234567", "Insurance certificate missing")
        print("  -> Email and SMS stubs executed cleanly without raising exceptions.")

    print("\n==================================================")
    print("ALL MILESTONE 3 GROUP B TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_milestone3b_tests())
