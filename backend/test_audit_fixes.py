import asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models import Role, User, Vendor, ProcurementRequest, PurchaseOrder, PRLineItem, POItem
from app.security import get_password_hash
from sqlalchemy.future import select

async def run_all_tests():
    print("==================================================================")
    print("TESTING AUDIT FIXES: PR/PO TRANSITIONS & DASHBOARD DATA ACCURACY")
    print("==================================================================")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver", timeout=30.0) as client:
        # 1. Login as Administrator
        print("\n[STEP 1] Authenticating as Administrator...")
        login_res = await client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "Admin@123456"})
        assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
        admin_token = login_res.json()["access_token"]
        admin_h = {"Authorization": f"Bearer {admin_token}"}
        print("  -> Admin authenticated successfully.")

        # 2. Login as Procurement Manager
        print("\n[STEP 2] Authenticating as Procurement Manager...")
        pm_login = await client.post("/api/v1/auth/login", json={"email": "pm@example.com", "password": "Procurement@123456"})
        assert pm_login.status_code == 200, f"PM login failed: {pm_login.text}"
        pm_token = pm_login.json()["access_token"]
        pm_h = {"Authorization": f"Bearer {pm_token}"}
        print("  -> Procurement Manager authenticated successfully.")

        # 3. FIX 1 & 2: PR Status Transitions (Completed & Cancelled)
        print("\n[STEP 3] Testing PR Completed and Cancelled transitions...")
        # Create test PR
        pr_payload = {
            "title": f"Audit Verification PR {uuid.uuid4().hex[:6]}",
            "description": "Test PR for status transitions",
            "line_items": [{"item_name": "Test Router", "quantity": 2.0, "estimated_cost": 150.0}]
        }
        pr_res = await client.post("/api/v1/procurement-requests", json=pr_payload, headers=pm_h)
        assert pr_res.status_code == 201
        test_pr_id = pr_res.json()["id"]

        # Transition to completed via PATCH /api/v1/procurement-requests/{id}/status
        patch_completed = await client.patch(
            f"/api/v1/procurement-requests/{test_pr_id}/status",
            json={"status": "completed"},
            headers=pm_h
        )
        assert patch_completed.status_code == 200
        assert patch_completed.json()["status"].lower() == "completed"
        print("  -> PR transitioned to 'completed' via PATCH /status.")

        # Transition to cancelled via POST /api/v1/procurement-requests/{id}/cancel
        post_cancel = await client.post(f"/api/v1/procurement-requests/{test_pr_id}/cancel", headers=pm_h)
        assert post_cancel.status_code == 200
        assert post_cancel.json()["status"].lower() == "cancelled"
        print("  -> PR transitioned to 'cancelled' via POST /cancel action.")

        # Transition to completed via POST /api/v1/procurement-requests/{id}/complete
        post_complete = await client.post(f"/api/v1/procurement-requests/{test_pr_id}/complete", headers=pm_h)
        assert post_complete.status_code == 200
        assert post_complete.json()["status"].lower() == "completed"
        print("  -> PR transitioned to 'completed' via POST /complete action.")

        # 4. FIX 1 & 2: PO Status Transitions (Completed & Cancelled)
        print("\n[STEP 4] Testing PO Completed and Cancelled transitions...")
        # Get a vendor id
        v_list = await client.get("/api/v1/vendors", headers=admin_h)
        assert v_list.status_code == 200
        vendors = v_list.json()
        assert len(vendors) > 0
        v_id = vendors[0]["id"]

        po_payload = {
            "vendor_id": v_id,
            "items": [{"item_name": "Test Fiber Cable", "quantity": 5.0, "unit_price": 50.0}]
        }
        po_res = await client.post("/api/v1/purchase-orders", json=po_payload, headers=pm_h)
        assert po_res.status_code == 201
        test_po_id = po_res.json()["id"]

        # Transition PO to COMPLETED via PATCH /api/v1/purchase-orders/{id}/status
        po_patch_completed = await client.patch(
            f"/api/v1/purchase-orders/{test_po_id}/status",
            json={"status": "COMPLETED"},
            headers=pm_h
        )
        assert po_patch_completed.status_code == 200
        assert po_patch_completed.json()["status"] == "COMPLETED"
        assert po_patch_completed.json()["delivery_status"] == "delivered"
        print("  -> PO transitioned to 'COMPLETED' via PATCH /status (delivery_status set to 'delivered').")

        # Transition PO to CANCELLED via POST /api/v1/purchase-orders/{id}/cancel
        po_post_cancel = await client.post(f"/api/v1/purchase-orders/{test_po_id}/cancel", headers=pm_h)
        assert po_post_cancel.status_code == 200
        assert po_post_cancel.json()["status"] == "CANCELLED"
        print("  -> PO transitioned to 'CANCELLED' via POST /cancel action.")

        # Transition PO to COMPLETED via POST /api/v1/purchase-orders/{id}/complete
        po_post_complete = await client.post(f"/api/v1/purchase-orders/{test_po_id}/complete", headers=pm_h)
        assert po_post_complete.status_code == 200
        assert po_post_complete.json()["status"] == "COMPLETED"
        print("  -> PO transitioned to 'COMPLETED' via POST /complete action.")

        # 5. FIX 3: Order History cancelled and delayed counts in Vendor Dashboard
        print("\n[STEP 5] Testing Vendor Dashboard cancelled and delayed order counts...")
        # Check vendors with POs
        v_dash_res = await client.get(f"/api/v1/dashboard/vendor/{v_id}", headers=admin_h)
        assert v_dash_res.status_code == 200
        v_dash_data = v_dash_res.json()
        orders_sec = v_dash_data["orders"]
        print(f"  -> Vendor '{v_dash_data['company_name']}' Orders Summary: {orders_sec}")
        assert "cancelled" in orders_sec or "cancelled_orders" in orders_sec
        assert "delayed" in orders_sec or "delayed_orders" in orders_sec
        print("  -> cancelled and delayed counts successfully present in VendorOrdersSummary.")

        # Specifically check Sri Venkateswara Raw Materials (dc8cfe5c-9557-4bea-b4a8-9f5eb89056b4) which has a CANCELLED PO
        v_raw_id = "dc8cfe5c-9557-4bea-b4a8-9f5eb89056b4"
        raw_dash = await client.get(f"/api/v1/dashboard/vendor/{v_raw_id}", headers=admin_h)
        if raw_dash.status_code == 200:
            raw_orders = raw_dash.json()["orders"]
            print(f"  -> Vendor with cancelled PO orders summary: {raw_orders}")
            assert raw_orders["cancelled"] >= 1 or raw_orders["cancelled_orders"] >= 1
            print("  -> Confirmed real cancelled count > 0 from real PO status data!")

        # Specifically check tejaswinisoftwares (8a0525a9-6a4f-40f5-b235-833388ece66f) which has an overdue/delayed PO
        v_it_id = "8a0525a9-6a4f-40f5-b235-833388ece66f"
        it_dash = await client.get(f"/api/v1/dashboard/vendor/{v_it_id}", headers=admin_h)
        if it_dash.status_code == 200:
            it_orders = it_dash.json()["orders"]
            print(f"  -> Vendor with overdue PO orders summary: {it_orders}")
            assert it_orders["delayed"] >= 1 or it_orders["delayed_orders"] >= 1
            print("  -> Confirmed real delayed count > 0 from real PO status data!")

        # 6. FIX 4: Real Communication Activity in Vendor Dashboard (not zeros)
        print("\n[STEP 6] Testing real Communication Activity in Vendor Dashboard summary...")
        v_comm_res = await client.get(f"/api/v1/dashboard/vendor/{v_it_id}", headers=admin_h)
        assert v_comm_res.status_code == 200
        comm_sec = v_comm_res.json()["communication"]
        print(f"  -> Seeded Vendor Communication Activity: {comm_sec}")
        assert comm_sec["messages_sent"] > 0 or comm_sec["messages_received"] > 0 or comm_sec["total_messages"] > 0
        assert "Populated once Communication module exists" not in comm_sec.get("note", "")

        # Also post a message and confirm live update
        post_msg = await client.post(f"/api/v1/vendors/{v_id}/messages", json={"message": "Audit communication test"}, headers=admin_h)
        assert post_msg.status_code == 201
        v_dash_up = await client.get(f"/api/v1/dashboard/vendor/{v_id}", headers=admin_h)
        up_comm = v_dash_up.json()["communication"]
        print(f"  -> Updated Vendor Communication Activity: {up_comm}")
        assert up_comm["messages_sent"] > 0
        assert up_comm["total_messages"] >= 1
        print("  -> Confirmed Communication Activity contains real data (NOT zeros/hardcoded stub)!")

        # 7. FIX 5: Vendors by Category in Admin Dashboard Summary
        print("\n[STEP 7] Testing Vendors by Category in GET /api/v1/dashboard/admin...")
        admin_dash = await client.get("/api/v1/dashboard/admin", headers=admin_h)
        assert admin_dash.status_code == 200
        admin_data = admin_dash.json()
        assert "vendors_by_category" in admin_data
        v_by_cat = admin_data["vendors_by_category"]
        print(f"  -> vendors_by_category: {v_by_cat}")
        assert isinstance(v_by_cat, dict)
        assert len(v_by_cat) > 0
        assert sum(v_by_cat.values()) == admin_data["total_vendors"]
        print(f"  -> Confirmed vendors_by_category correctly totals {admin_data['total_vendors']} vendors across {len(v_by_cat)} categories!")

        # 8. Regression Tests: Vendor CRUD, Login, Dashboards
        print("\n[STEP 8] Regression Testing: Vendor CRUD, Dashboards, and RBAC...")
        # Create a new vendor
        new_v_payload = {
            "company_name": f"Regression Vendor {uuid.uuid4().hex[:6]}",
            "registration_no": f"REG-TEST-{uuid.uuid4().hex[:6].upper()}",
            "category": "Testing",
            "status": "ACTIVE",
            "contacts": [{"name": "Test Contact", "email": f"test_{uuid.uuid4().hex[:4]}@example.com", "phone": "123456"}]
        }
        cr_v = await client.post("/api/v1/vendors", json=new_v_payload, headers=admin_h)
        assert cr_v.status_code == 201
        new_v = cr_v.json()
        print(f"  -> Vendor Create OK: {new_v['company_name']}")

        # Read vendor
        rd_v = await client.get(f"/api/v1/vendors/{new_v['id']}", headers=admin_h)
        assert rd_v.status_code == 200
        print("  -> Vendor Read OK")

        # Update vendor
        up_v = await client.put(f"/api/v1/vendors/{new_v['id']}", json={"company_name": new_v['company_name'] + " Updated"}, headers=admin_h)
        assert up_v.status_code == 200
        print("  -> Vendor Update OK")

        # Delete vendor
        dl_v = await client.delete(f"/api/v1/vendors/{new_v['id']}", headers=admin_h)
        assert dl_v.status_code == 200
        print("  -> Vendor Delete OK")

        # Test Dashboard endpoints
        proc_dash = await client.get("/api/v1/dashboard/procurement", headers=pm_h)
        assert proc_dash.status_code == 200
        print("  -> GET /dashboard/procurement OK")

        proc_charts = await client.get("/api/v1/dashboard/procurement/charts", headers=pm_h)
        assert proc_charts.status_code == 200
        print("  -> GET /dashboard/procurement/charts OK")

        admin_charts = await client.get("/api/v1/dashboard/admin/charts", headers=admin_h)
        assert admin_charts.status_code == 200
        print("  -> GET /dashboard/admin/charts OK")

        v_charts = await client.get(f"/api/v1/dashboard/vendor/{v_id}/charts", headers=admin_h)
        assert v_charts.status_code == 200
        print("  -> GET /dashboard/vendor/{id}/charts OK")

    print("\n==================================================================")
    print("ALL 5 FIXES AND REGRESSION TESTS VERIFIED AND PASSED!")
    print("==================================================================")

if __name__ == "__main__":
    asyncio.run(run_all_tests())
