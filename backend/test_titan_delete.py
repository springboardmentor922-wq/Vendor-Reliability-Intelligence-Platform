import asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models import Vendor, PurchaseOrder, Contract, POItem, VendorPerformance, VendorReliability
from sqlalchemy.future import select

async def test_titan_delete():
    print("==================================================")
    print("TEST: DELETING TITAN PRECISION LOGISTICS WITH CASCADE")
    print("==================================================")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Authenticate as Administrator
        login_res = await client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "Admin@123456"})
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Find a Titan Precision Logistics vendor that has POs and Contracts
        target_vendor = None
        target_pos = []
        target_contracts = []

        async with AsyncSessionLocal() as db:
            vendors = (await db.execute(select(Vendor).where(Vendor.company_name.ilike("%Titan Precision Logistics%")))).scalars().all()
            for v in vendors:
                pos = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.vendor_id == v.id))).scalars().all()
                cts = (await db.execute(select(Contract).where(Contract.vendor_id == v.id))).scalars().all()
                if len(pos) > 0 and len(cts) > 0:
                    target_vendor = v
                    target_pos = pos
                    target_contracts = cts
                    break

        assert target_vendor is not None, "No Titan Precision Logistics vendor with POs and Contracts found!"

        target_vendor_id = str(target_vendor.id)
        target_po_ids = [str(po.id) for po in target_pos]
        target_po_numbers = [po.po_number for po in target_pos]
        target_contract_ids = [str(c.id) for c in target_contracts]
        target_contract_titles = [c.title for c in target_contracts]

        print(f"Target Vendor identified:")
        print(f"  ID: {target_vendor_id}")
        print(f"  Company Name: {target_vendor.company_name}")
        print(f"  Registration No: {target_vendor.registration_no}")
        print(f"  Related POs: {target_po_numbers} (IDs: {target_po_ids})")
        print(f"  Related Contracts: {target_contract_titles} (IDs: {target_contract_ids})")

        # 2. Record other vendors, their POs, and their contracts before deletion
        async with AsyncSessionLocal() as db:
            other_vendors_before = {str(v.id) for v in (await db.execute(select(Vendor).where(Vendor.id != target_vendor.id))).scalars().all()}
            other_pos_before = {str(po.id) for po in (await db.execute(select(PurchaseOrder).where(PurchaseOrder.vendor_id != target_vendor.id))).scalars().all()}
            other_cts_before = {str(c.id) for c in (await db.execute(select(Contract).where(Contract.vendor_id != target_vendor.id))).scalars().all()}

        print(f"\nBefore Deletion Baseline:")
        print(f"  Other vendors count: {len(other_vendors_before)}")
        print(f"  Other POs count: {len(other_pos_before)}")
        print(f"  Other Contracts count: {len(other_cts_before)}")

        # 3. Perform DELETE /api/v1/vendors/{id}
        print(f"\nExecuting DELETE /api/v1/vendors/{target_vendor_id}...")
        del_resp = await client.delete(f"/api/v1/vendors/{target_vendor_id}", headers=headers)
        assert del_resp.status_code == 200, f"Delete failed: {del_resp.status_code} {del_resp.text}"
        print(f"  -> Delete response: {del_resp.json()['message']}")

        # 4. Confirm: The vendor is removed from the Vendor Directory
        get_vendor_resp = await client.get(f"/api/v1/vendors/{target_vendor_id}", headers=headers)
        assert get_vendor_resp.status_code == 404, f"Expected 404, got {get_vendor_resp.status_code}"

        all_vendors_resp = await client.get("/api/v1/vendors", headers=headers)
        assert all_vendors_resp.status_code == 200
        vendor_ids_in_dir = [v["id"] for v in all_vendors_resp.json()]
        assert target_vendor_id not in vendor_ids_in_dir, "Deleted vendor still appears in Vendor Directory!"
        print("  -> PASS: Vendor successfully removed from Vendor Directory (404 and absent from list).")

        # 5. Confirm: Its related purchase orders no longer appear in the Orders page (GET /api/v1/purchase-orders)
        all_pos_resp = await client.get("/api/v1/purchase-orders", headers=headers)
        assert all_pos_resp.status_code == 200
        pos_list = all_pos_resp.json()
        po_ids_in_list = [po["id"] for po in pos_list]
        po_nums_in_list = [po["po_number"] for po in pos_list]
        for p_id in target_po_ids:
            assert p_id not in po_ids_in_list, f"Related PO {p_id} still appears in Orders page!"
        for p_num in target_po_numbers:
            assert p_num not in po_nums_in_list, f"Related PO number {p_num} still appears in Orders page!"
        print("  -> PASS: Related purchase orders no longer appear in Orders page.")

        # 6. Confirm: Its related contract no longer appears in the Contracts page (GET /api/v1/contracts)
        all_cts_resp = await client.get("/api/v1/contracts", headers=headers)
        assert all_cts_resp.status_code == 200
        cts_list = all_cts_resp.json()
        ct_ids_in_list = [c["id"] for c in cts_list]
        for c_id in target_contract_ids:
            assert c_id not in ct_ids_in_list, f"Related Contract {c_id} still appears in Contracts page!"
        print("  -> PASS: Related contract no longer appears in Contracts page.")

        # 7. Confirm: Other vendors, their POs, and their contracts are completely unaffected
        async with AsyncSessionLocal() as db:
            other_vendors_after = {str(v.id) for v in (await db.execute(select(Vendor))).scalars().all()}
            other_pos_after = {str(po.id) for po in (await db.execute(select(PurchaseOrder))).scalars().all()}
            other_cts_after = {str(c.id) for c in (await db.execute(select(Contract))).scalars().all()}

        assert other_vendors_after == other_vendors_before, "Other vendors were unexpectedly modified or removed!"
        assert other_pos_after == other_pos_before, "Other POs were unexpectedly modified or removed!"
        assert other_cts_after == other_cts_before, "Other Contracts were unexpectedly modified or removed!"
        print("  -> PASS: Other vendors, POs, and contracts are 100% unaffected.")

        print("\n==================================================")
        print("TITAN PRECISION LOGISTICS DELETE TEST PASSED COMPLETELY!")
        print("==================================================")

if __name__ == "__main__":
    asyncio.run(test_titan_delete())
