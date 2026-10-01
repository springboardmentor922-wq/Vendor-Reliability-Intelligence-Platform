import asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models import Role, User, Vendor, VendorContact, VendorPerformance, VendorReliability, PurchaseOrder, Contract, ProcurementRequest
from app.security import get_password_hash
from sqlalchemy.future import select

async def run_vendor_delete_tests():
    print("==================================================")
    print("STARTING VENDOR DELETE & CRUD VERIFICATION TESTS")
    print("==================================================")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:

        # 0. Setup test users and roles: Admin, Procurement Manager, Auditor
        async with AsyncSessionLocal() as db:
            roles = {}
            for r_name in ["Administrator", "Procurement Manager", "Auditor"]:
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

            # Auditor
            aud = (await db.execute(select(User).where(User.email == "auditor@example.com"))).scalar_one_or_none()
            if not aud:
                aud = User(
                    email="auditor@example.com",
                    hashed_password=get_password_hash("Auditor@123456"),
                    full_name="Internal Auditor",
                    status="APPROVED",
                    roles=[roles["Auditor"]]
                )
                db.add(aud)
                await db.commit()

        # Login tokens
        login_admin = await client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "Admin@123456"})
        admin_token = login_admin.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        login_pm = await client.post("/api/v1/auth/login", json={"email": "pm@example.com", "password": "Procurement@123456"})
        pm_token = login_pm.json()["access_token"]
        pm_headers = {"Authorization": f"Bearer {pm_token}"}

        login_aud = await client.post("/api/v1/auth/login", json={"email": "auditor@example.com", "password": "Auditor@123456"})
        aud_token = login_aud.json()["access_token"]
        aud_headers = {"Authorization": f"Bearer {aud_token}"}

        print("  -> Auth tokens acquired for Admin, Procurement Manager, and Auditor.")

        # TEST 1: Existing Vendor CRUD regression
        print("\n[TEST 1] Verifying Existing Vendor CRUD (Create, View, List, Update)...")
        reg_no = f"REG-TEST-{uuid.uuid4().hex[:6].upper()}"
        create_resp = await client.post("/api/v1/vendors", headers=admin_headers, json={
            "company_name": "Test CRUD Partner",
            "registration_no": reg_no,
            "category": "IT",
            "status": "pending",
            "review_notes": "Initial review in progress",
            "contacts": [{"name": "John Doe", "email": "john@testcrud.com", "phone": "1234567890"}]
        })
        assert create_resp.status_code == 201, f"Failed create vendor: {create_resp.text}"
        vendor_data = create_resp.json()
        vendor_id = vendor_data["id"]
        print(f"  -> Vendor created: {vendor_data['company_name']} ({vendor_id})")

        # View single
        get_resp = await client.get(f"/api/v1/vendors/{vendor_id}", headers=admin_headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["company_name"] == "Test CRUD Partner"
        print("  -> Vendor retrieved by ID successfully.")

        # Update
        update_resp = await client.put(f"/api/v1/vendors/{vendor_id}", headers=admin_headers, json={
            "company_name": "Test CRUD Partner Updated",
            "category": "Services"
        })
        assert update_resp.status_code == 200
        assert update_resp.json()["company_name"] == "Test CRUD Partner Updated"
        assert update_resp.json()["category"] == "Services"
        print("  -> Vendor updated successfully.")

        # TEST 2: Delete vendor with NO related records (Admin)
        print("\n[TEST 2] Deleting vendor with no related records (Admin)...")
        del_resp = await client.delete(f"/api/v1/vendors/{vendor_id}", headers=admin_headers)
        assert del_resp.status_code == 200, f"Delete failed: {del_resp.text}"
        assert "deleted successfully" in del_resp.json()["message"]
        print(f"  -> Delete response: {del_resp.json()['message']}")

        # Confirm 404
        get_resp = await client.get(f"/api/v1/vendors/{vendor_id}", headers=admin_headers)
        assert get_resp.status_code == 404
        print("  -> Confirmed vendor no longer exists (404 Not Found).")

        # TEST 3: Delete vendor with NO related records by Procurement Manager
        print("\n[TEST 3] Deleting vendor with no related records by Procurement Manager (RBAC)...")
        reg_no_pm = f"REG-PM-{uuid.uuid4().hex[:6].upper()}"
        create_resp_pm = await client.post("/api/v1/vendors", headers=pm_headers, json={
            "company_name": "PM Test Vendor",
            "registration_no": reg_no_pm,
            "category": "Maintenance",
            "status": "approved"
        })
        assert create_resp_pm.status_code == 201
        pm_vendor_id = create_resp_pm.json()["id"]

        del_pm_resp = await client.delete(f"/api/v1/vendors/{pm_vendor_id}", headers=pm_headers)
        assert del_pm_resp.status_code == 200, f"Procurement Manager delete failed: {del_pm_resp.text}"
        print(f"  -> Procurement Manager successfully deleted vendor: {del_pm_resp.json()['message']}")

        # TEST 4: RBAC Security - Non-permitted role (Auditor) and Unauthenticated
        print("\n[TEST 4] Verifying RBAC Security (Auditor & Unauthenticated)...")
        unauth_resp = await client.delete(f"/api/v1/vendors/{pm_vendor_id}")
        assert unauth_resp.status_code == 401
        print("  -> Unauthenticated request rejected with 401 Unauthorized.")

        forbidden_resp = await client.delete(f"/api/v1/vendors/{pm_vendor_id}", headers=aud_headers)
        assert forbidden_resp.status_code == 403
        print("  -> Auditor request rejected with 403 Forbidden.")

        # TEST 5: Cascade delete of vendor's performance & reliability records
        print("\n[TEST 5] Deleting vendor with performance/reliability records (Cascade)...")
        reg_no_perf = f"REG-PERF-{uuid.uuid4().hex[:6].upper()}"
        c_perf_resp = await client.post("/api/v1/vendors", headers=admin_headers, json={
            "company_name": "Cascade Test Vendor",
            "registration_no": reg_no_perf,
            "category": "Logistics",
            "status": "approved",
            "contacts": [{"name": "Alice Logistics", "email": "alice@cascade.com"}]
        })
        cascade_vendor_id = c_perf_resp.json()["id"]

        # Log performance
        log_perf_resp = await client.post(f"/api/v1/vendors/{cascade_vendor_id}/performance", headers=admin_headers, json={
            "on_time_deliveries": 10,
            "delayed_deliveries": 1,
            "quality_rating": 4.5,
            "response_time_hours": 8.0,
            "issue_resolution_time_hours": 24.0,
            "order_completion_rate": 95.0
        })
        assert log_perf_resp.status_code == 201
        print("  -> Performance & reliability records created for vendor.")

        # Delete vendor
        del_cascade_resp = await client.delete(f"/api/v1/vendors/{cascade_vendor_id}", headers=admin_headers)
        assert del_cascade_resp.status_code == 200
        print("  -> Vendor and its performance/reliability cascade deleted cleanly.")

        # Verify DB cascade
        async with AsyncSessionLocal() as db:
            p_stmt = select(VendorPerformance).where(VendorPerformance.vendor_id == uuid.UUID(cascade_vendor_id))
            perf_entries = (await db.execute(p_stmt)).scalars().all()
            assert len(perf_entries) == 0, "VendorPerformance entries were not cascaded!"

            r_stmt = select(VendorReliability).where(VendorReliability.vendor_id == uuid.UUID(cascade_vendor_id))
            rel_entries = (await db.execute(r_stmt)).scalars().all()
            assert len(rel_entries) == 0, "VendorReliability entries were not cascaded!"
        print("  -> Verified database: VendorPerformance & VendorReliability rows cascaded.")

        # TEST 6: Cascade deletion when Purchase Orders & PO items exist
        print("\n[TEST 6] Cascade deleting vendor with existing Purchase Orders and PO items...")
        reg_no_po = f"REG-PO-{uuid.uuid4().hex[:6].upper()}"
        c_po_vendor = await client.post("/api/v1/vendors", headers=admin_headers, json={
            "company_name": "PO Cascade Test Vendor",
            "registration_no": reg_no_po,
            "category": "Equipment",
            "status": "approved"
        })
        po_vendor_id = c_po_vendor.json()["id"]

        # Create PO with PO items for this vendor in DB
        po_id_created = None
        async with AsyncSessionLocal() as db:
            from app.models import POItem
            test_po = PurchaseOrder(
                vendor_id=uuid.UUID(po_vendor_id),
                po_number=f"PO-{uuid.uuid4().hex[:6].upper()}",
                status="SENT_TO_VENDOR",
                delivery_status="in_progress",
                total_amount=15000.00
            )
            db.add(test_po)
            await db.flush()
            po_id_created = test_po.id
            item1 = POItem(po_id=test_po.id, item_name="Industrial Pump", quantity=2, unit_price=7500.00)
            db.add(item1)
            await db.commit()
            print("  -> Purchase Order with line items linked to vendor.")

        del_po_vendor_resp = await client.delete(f"/api/v1/vendors/{po_vendor_id}", headers=admin_headers)
        assert del_po_vendor_resp.status_code == 200, f"Expected 200, got: {del_po_vendor_resp.status_code} ({del_po_vendor_resp.text})"
        assert "deleted successfully" in del_po_vendor_resp.json()["message"]
        print(f"  -> Vendor deleted response: '{del_po_vendor_resp.json()['message']}'")

        # Verify DB cascade for PO and POItem
        async with AsyncSessionLocal() as db:
            po_chk = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id_created))).scalar_one_or_none()
            assert po_chk is None, "PurchaseOrder was not cascade-deleted!"
            item_chk = (await db.execute(select(POItem).where(POItem.po_id == po_id_created))).scalars().all()
            assert len(item_chk) == 0, "POItem records were not cascade-deleted!"
        print("  -> Confirmed Purchase Order and line items cascade deleted from DB.")

        # TEST 7: Cascade deletion when Contracts exist
        print("\n[TEST 7] Cascade deleting vendor with existing Contracts...")
        reg_no_ct = f"REG-CT-{uuid.uuid4().hex[:6].upper()}"
        c_ct_vendor = await client.post("/api/v1/vendors", headers=admin_headers, json={
            "company_name": "Contract Cascade Test Vendor",
            "registration_no": reg_no_ct,
            "category": "Services",
            "status": "approved"
        })
        ct_vendor_id = c_ct_vendor.json()["id"]

        from datetime import datetime, timedelta
        ct_id_created = None
        async with AsyncSessionLocal() as db:
            test_ct = Contract(
                vendor_id=uuid.UUID(ct_vendor_id),
                title="Master Services Agreement",
                start_date=datetime.utcnow(),
                end_date=datetime.utcnow() + timedelta(days=365),
                status="ACTIVE"
            )
            db.add(test_ct)
            await db.commit()
            ct_id_created = test_ct.id
            print("  -> Contract linked to vendor.")

        del_ct_vendor_resp = await client.delete(f"/api/v1/vendors/{ct_vendor_id}", headers=admin_headers)
        assert del_ct_vendor_resp.status_code == 200, f"Expected 200, got: {del_ct_vendor_resp.status_code} ({del_ct_vendor_resp.text})"
        assert "deleted successfully" in del_ct_vendor_resp.json()["message"]
        print(f"  -> Vendor deleted response: '{del_ct_vendor_resp.json()['message']}'")

        # Verify DB cascade for Contract
        async with AsyncSessionLocal() as db:
            ct_chk = (await db.execute(select(Contract).where(Contract.id == ct_id_created))).scalar_one_or_none()
            assert ct_chk is None, "Contract was not cascade-deleted!"
        print("  -> Confirmed Contract cascade deleted from DB.")

        # TEST 8: Full simultaneous cascade: Vendor + Contacts + POs + POItems + Contracts + Performance + Reliability + Comms
        print("\n[TEST 8] Comprehensive multi-entity cascade test...")
        reg_no_full = f"REG-ALL-{uuid.uuid4().hex[:6].upper()}"
        c_full_vendor = await client.post("/api/v1/vendors", headers=admin_headers, json={
            "company_name": "Full Cascade Test Partner",
            "registration_no": reg_no_full,
            "category": "Logistics",
            "status": "approved",
            "contacts": [{"name": "Main Contact", "email": "contact@fullcascade.com", "phone": "9998887776"}]
        })
        full_vendor_id = c_full_vendor.json()["id"]

        # Add PO with items, Contract, Performance, Reliability, and Communication
        from app.models import POItem, Communication
        async with AsyncSessionLocal() as db:
            v_uuid = uuid.UUID(full_vendor_id)
            po_full = PurchaseOrder(
                vendor_id=v_uuid,
                po_number=f"PO-{uuid.uuid4().hex[:6].upper()}",
                status="SENT_TO_VENDOR",
                total_amount=5000.00
            )
            db.add(po_full)
            await db.flush()
            po_full_id = po_full.id
            db.add(POItem(po_id=po_full_id, item_name="Gear Box", quantity=5, unit_price=1000.00))

            ct_full = Contract(
                vendor_id=v_uuid,
                title="Full Scope Agreement",
                start_date=datetime.utcnow(),
                end_date=datetime.utcnow() + timedelta(days=180),
                status="ACTIVE"
            )
            db.add(ct_full)
            await db.flush()
            ct_full_id = ct_full.id

            db.add(VendorPerformance(
                vendor_id=v_uuid,
                on_time_deliveries=15,
                delayed_deliveries=0,
                quality_rating=5.0
            ))
            db.add(VendorReliability(
                vendor_id=v_uuid,
                delivery_score=99.0,
                quality_score=98.0,
                overall_reliability_score=98.5
            ))
            db.add(Communication(
                vendor_id=v_uuid,
                sender_role="Administrator",
                message="Testing cascade deletion of communication thread."
            ))
            await db.commit()

        # Delete with Procurement Manager role (RBAC verification)
        del_full_resp = await client.delete(f"/api/v1/vendors/{full_vendor_id}", headers=pm_headers)
        assert del_full_resp.status_code == 200, f"Expected 200, got: {del_full_resp.status_code} ({del_full_resp.text})"
        print(f"  -> Full vendor cascade delete response: '{del_full_resp.json()['message']}'")

        # Verify all records removed
        async with AsyncSessionLocal() as db:
            v_uuid = uuid.UUID(full_vendor_id)
            assert (await db.execute(select(Vendor).where(Vendor.id == v_uuid))).scalar_one_or_none() is None
            assert (await db.execute(select(VendorContact).where(VendorContact.vendor_id == v_uuid))).scalars().all() == []
            assert (await db.execute(select(PurchaseOrder).where(PurchaseOrder.vendor_id == v_uuid))).scalars().all() == []
            assert (await db.execute(select(POItem).where(POItem.po_id == po_full_id))).scalars().all() == []
            assert (await db.execute(select(Contract).where(Contract.vendor_id == v_uuid))).scalars().all() == []
            assert (await db.execute(select(VendorPerformance).where(VendorPerformance.vendor_id == v_uuid))).scalars().all() == []
            assert (await db.execute(select(VendorReliability).where(VendorReliability.vendor_id == v_uuid))).scalars().all() == []
            assert (await db.execute(select(Communication).where(Communication.vendor_id == v_uuid))).scalars().all() == []
        print("  -> Confirmed ALL associated child records across 8 tables cascade deleted cleanly.")

    print("\n==================================================")
    print("ALL VENDOR DELETE & CASCADE TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_vendor_delete_tests())
