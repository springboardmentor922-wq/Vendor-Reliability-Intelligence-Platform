from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.procurement import ProcurementRequest
from app.models.vendor import Vendor
from app.models.vendor_selection import VendorSelection
from app.models.communication import AuditLog
from app.models.notification import Notification

client = TestClient(app)

def test_procurement_request_and_vendor_selection_lifecycle():
    print("\n" + "=" * 80)
    print("TESTING PROCUREMENT REQUEST & VENDOR SELECTION MODULE")
    print("=" * 80)

    # 1. Authenticate as Procurement Manager
    res = client.post("/auth/login", json={"email": "procurement@vendor-iq.com", "password": "procure123"})
    assert res.status_code == 200, f"Login failed: {res.text}"
    pm_token = res.json()["access_token"]
    pm_user = res.json()["user"]
    print(f"[PASS] Procurement Manager authenticated: {pm_user['full_name']} ({pm_user['role']})")

    # 2. Requisition creation missing mandatory category must fail with 422
    invalid_pr = {
        "department": "Information Technology",
        "product_name": "Laptop",
        "quantity": 50,
        "priority": "High",
        "reason": "New employee requirements",
        "category": "", # Missing category
        "estimated_budget": 2500000.0
    }
    res = client.post("/requisitions", json=invalid_pr, headers={"Authorization": f"Bearer {pm_token}"})
    assert res.status_code == 422, f"Expected 422 for missing category, got {res.status_code}"
    print("[PASS] Missing vendor category rejected with HTTP 422")

    # 3. Create Procurement Request with mandatory category (IT & Electronics)
    pr_payload = {
        "department": "Information Technology",
        "product_name": "Laptop",
        "quantity": 50,
        "required_date": "2026-10-15T00:00:00",
        "priority": "High",
        "reason": "New employee requirements - 50 high-performance engineering laptops",
        "category": "IT & Electronics", # REQUIRED VENDOR CATEGORY
        "estimated_budget": 2500000.0 # ₹25,00,000
    }
    res = client.post("/requisitions", json=pr_payload, headers={"Authorization": f"Bearer {pm_token}"})
    assert res.status_code == 201, f"PR creation failed: {res.text}"
    pr_data = res.json()
    pr_id = pr_data["id"]
    req_number = pr_data["request_number"]
    assert pr_data["status"] == "SUBMITTED"
    assert pr_data["category"] == "IT & Electronics"
    assert pr_data["title"] == "Laptop"
    assert pr_data["quantity"] == 50.0
    print(f"[PASS] Created Procurement Request {req_number} (ID: {pr_id}) for '{pr_data['title']}' under '{pr_data['category']}'")

    # 4. Dynamic Category-Based Vendor Filtering
    res = client.get(f"/procurement/requirements/{pr_id}/eligible-vendors", headers={"Authorization": f"Bearer {pm_token}"})
    assert res.status_code == 200, f"Failed to get eligible vendors: {res.text}"
    eligibility_data = res.json()
    eligible_vendors = eligibility_data["vendors"]

    print(f"[INFO] Eligible Vendors returned for category '{pr_data['category']}': {len(eligible_vendors)}")
    vendor_names = [v["name"] for v in eligible_vendors]
    print(f"       Vendors: {', '.join(vendor_names)}")

    # Assert that IT & Electronics vendors ARE returned
    assert "ABC Technologies" in vendor_names
    assert "Digital Systems Inc" in vendor_names
    assert "Computer World Tech" in vendor_names

    # Assert that UNRELATED categories are NOT returned
    assert "Sri Industrial Materials" not in vendor_names # Raw Materials
    assert "Titan Heavy Machining" not in vendor_names # Machinery
    assert "FastMove Logistics Freight" not in vendor_names # Logistics
    assert "Apex Facility & IT Maintenance" not in vendor_names # Services

    # Assert that Suspended vendors are NOT returned
    assert "TechDistro Global" not in vendor_names # Suspended

    # Verify vendor metrics structure and ranking
    prev_score = 999.0
    for v in eligible_vendors:
        assert v["category"] == "IT & Electronics"
        assert "reliability_score" in v
        assert "on_time_delivery_rate" in v
        assert "total_orders" in v
        assert "completed_orders" in v
        assert "delayed_orders" in v
        assert "partial_deliveries" in v
        assert "cancelled_orders" in v
        assert "risk_level" in v
        assert v["status"] == "Active & Verified"
        # Verify sorted descending by reliability score
        assert v["reliability_score"] <= prev_score
        prev_score = v["reliability_score"]

    print("[PASS] Only Admin-verified, Active vendors from 'IT & Electronics' supplying Laptops are returned, sorted by Reliability Score.")

    # 5. View Details for top vendor (ABC Technologies)
    abc_vendor = next(v for v in eligible_vendors if v["name"] == "ABC Technologies")
    res = client.get(f"/procurement/vendors/{abc_vendor['vendor_id']}/details", headers={"Authorization": f"Bearer {pm_token}"})
    assert res.status_code == 200
    details = res.json()
    assert details["profile"]["name"] == "ABC Technologies"
    assert "performance" in details
    assert "risk" in details
    assert "purchase_history" in details
    assert len(details["purchase_history"]) > 0
    print(f"[PASS] Vendor Details verified for {details['profile']['name']} (Reliability: {details['performance']['reliability_score']}/100, Orders: {len(details['purchase_history'])})")

    # 6. Backend Validation: Attempt to select a vendor from UNRELATED category (e.g. Raw Materials)
    db = SessionLocal()
    raw_material_vendor = db.query(Vendor).filter(Vendor.category == "Raw Materials").first()
    db.close()
    assert raw_material_vendor is not None

    invalid_selection = {
        "requisition_id": pr_id,
        "vendor_id": raw_material_vendor.id,
        "quotation_amount": 2400000.0,
        "justification": "Attempting invalid selection"
    }
    res = client.post("/procurement/select-vendor", json=invalid_selection, headers={"Authorization": f"Bearer {pm_token}"})
    assert res.status_code == 403, f"Expected 403 for mismatched category, got {res.status_code}"
    print(f"[PASS] Backend rejected cross-category vendor selection with HTTP 403: {res.json()['detail']}")

    # 7. Valid Vendor Selection: Select ABC Technologies
    valid_selection = {
        "requisition_id": pr_id,
        "vendor_id": abc_vendor["vendor_id"],
        "quotation_amount": 2450000.0, # ₹24,50,000
        "justification": "ABC Technologies selected based on highest reliability score (97.6/100), 95.8% on-time delivery rate, and certified OEM warranty standard."
    }
    res = client.post("/procurement/select-vendor", json=valid_selection, headers={"Authorization": f"Bearer {pm_token}"})
    assert res.status_code == 200, f"Vendor selection failed: {res.text}"
    sel_res = res.json()
    assert sel_res["status"] == "VENDOR_SELECTED"
    assert sel_res["selected_vendor"] == "ABC Technologies"
    assert sel_res["selected_category"] == "IT & Electronics"
    assert sel_res["selected_by"] == pm_user["full_name"]
    print(f"[PASS] Vendor '{sel_res['selected_vendor']}' successfully selected for {req_number}! Status is now VENDOR_SELECTED.")

    # 8. Verify Database State, Audit Log, and Finance Officer Notification
    db = SessionLocal()
    updated_pr = db.query(ProcurementRequest).filter(ProcurementRequest.id == pr_id).first()
    assert updated_pr.status == "VENDOR_SELECTED"
    assert updated_pr.assigned_vendor_id == abc_vendor["vendor_id"]

    sel_record = db.query(VendorSelection).filter(VendorSelection.requisition_id == pr_id).first()
    assert sel_record is not None
    assert sel_record.vendor_id == abc_vendor["vendor_id"]
    assert sel_record.status == "Awaiting Financial Approval"

    audit_entry = db.query(AuditLog).filter(AuditLog.entity_id == sel_record.id, AuditLog.action == "VENDOR_SELECTED").first()
    assert audit_entry is not None
    assert "Sarah Jenkins" in audit_entry.details

    fin_notif = db.query(Notification).filter(Notification.target_role == "Finance Officer", Notification.reference_id == pr_id).first()
    assert fin_notif is not None
    print(f"[PASS] Database verified: PR status=VENDOR_SELECTED, Audit Log generated, Finance notification queued.")
    db.close()

    # 9. Role Boundaries: Procurement Manager CANNOT create or issue Purchase Orders
    res = client.post("/procurement/purchase-orders", headers={"Authorization": f"Bearer {pm_token}"})
    assert res.status_code == 403
    res = client.post("/purchase-orders", json={"vendor_id": abc_vendor["vendor_id"], "expected_delivery_date": "2026-10-15T00:00:00"}, headers={"Authorization": f"Bearer {pm_token}"})
    assert res.status_code == 403
    print("[PASS] Security boundaries confirmed: Procurement Manager blocked from PO creation (HTTP 403).")

    # 10. Role Boundaries: Other roles CANNOT select vendors
    res_fin = client.post("/auth/login", json={"email": "finance@vendor-iq.com", "password": "finance123"})
    fin_token = res_fin.json()["access_token"]
    res = client.post("/procurement/select-vendor", json=valid_selection, headers={"Authorization": f"Bearer {fin_token}"})
    assert res.status_code == 403
    print("[PASS] Security boundaries confirmed: Finance Officer blocked from selecting vendors (HTTP 403).")

    print("\n" + "=" * 80)
    print("ALL PROCUREMENT REQUEST & VENDOR SELECTION MODULE TESTS PASSED 100%!")
    print("=" * 80)

if __name__ == "__main__":
    test_procurement_request_and_vendor_selection_lifecycle()
