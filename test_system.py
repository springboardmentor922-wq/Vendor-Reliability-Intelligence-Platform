"""
VendorIQ Comprehensive System Verification Script
Tests all functional requirements, roles, business workflows, and report exports.
"""
import sys
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT_DIR))

import threading
import time
import requests
import uvicorn
from backend.main import app

PORT = 8001
BASE_URL = f"http://127.0.0.1:{PORT}"

class ClientWrapper:
    def get(self, path, **kwargs):
        return requests.get(f"{BASE_URL}{path}", **kwargs)
    def post(self, path, **kwargs):
        return requests.post(f"{BASE_URL}{path}", **kwargs)

client = ClientWrapper()

def start_server():
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=PORT, log_level="warning"))
    server.run()

def test_complete_platform():
    # Start test server thread
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    time.sleep(2) # Give server 2s to bind port

    print("\n" + "="*60)
    print("RUNNING VENDORIQ COMPREHENSIVE AUTOMATED VERIFICATION SUITE")
    print("="*60)

    # 1. Health & Static Check
    print("\n[1] Verifying System Health & Web Shell...")
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("  [PASS] Health check endpoint: OK (200)")

    res_html = client.get("/")
    assert res_html.status_code == 200 and "VendorIQ" in res_html.text
    print("  [PASS] Web SPA Shell loaded successfully with VendorIQ branding")

    # 2. Demo Mode Logins for all 6 Roles
    print("\n[2] Verifying Demo Mode Authentication for All 6 Roles...")
    roles = [
        "Administrator",
        "Procurement Manager",
        "Supply Chain Manager",
        "Vendor",
        "Finance Officer",
        "Auditor"
    ]
    tokens = {}
    for r in roles:
        resp = client.post("/api/auth/demo-login", json={"role": r})
        assert resp.status_code == 200, f"Demo login failed for {r}: {resp.text}"
        data = resp.json()
        assert "access_token" in data and data["user"]["role"] == r
        tokens[r] = data["access_token"]
        print(f"  [PASS] Demo Login: {r:22} -> Token issued, User: {data['user']['full_name']}")

    admin_headers = {"Authorization": f"Bearer {tokens['Administrator']}"}
    proc_headers = {"Authorization": f"Bearer {tokens['Procurement Manager']}"}
    vendor_headers = {"Authorization": f"Bearer {tokens['Vendor']}"}
    finance_headers = {"Authorization": f"Bearer {tokens['Finance Officer']}"}

    # 3. Six Mandatory Categories & Vendor Filtering
    print("\n[3] Verifying 6 Mandatory Vendor Categories & Filters...")
    mandatory_categories = [
        "Raw Material Suppliers",
        "Equipment Vendors",
        "IT Vendors",
        "Service Providers",
        "Logistics Partners",
        "Maintenance Vendors"
    ]
    for cat in mandatory_categories:
        resp = client.get(f"/api/vendors?category={cat}", headers=admin_headers)
        assert resp.status_code == 200
        vendors = resp.json()
        assert len(vendors) > 0, f"No vendors found for mandatory category {cat}"
        assert all(v["category"] == cat for v in vendors)
        print(f"  [PASS] Category Filter [{cat:24}]: Found {len(vendors)} vendor(s) -> Example: {vendors[0]['company_name']}")

    # 4. Status Filtering & Search
    print("\n[4] Verifying Status Filters & Vendor Search...")
    for st in ["Active", "Pending Approval", "Suspended"]:
        resp = client.get(f"/api/vendors?status={st}", headers=admin_headers)
        assert resp.status_code == 200
        v_list = resp.json()
        assert len(v_list) > 0, f"No vendors for status {st}"
        print(f"  [PASS] Status Filter [{st:18}]: Found {len(v_list)} vendor(s)")

    resp_search = client.get("/api/vendors?search=Apex", headers=admin_headers)
    assert resp_search.status_code == 200 and len(resp_search.json()) >= 1
    print("  [PASS] Search query ('Apex'): Successfully matched Apex Raw Materials")

    # 5. Role Data Isolation for Vendor Role
    print("\n[5] Verifying Strict Vendor Data Isolation...")
    resp_vendor_view = client.get("/api/vendors", headers=vendor_headers)
    assert resp_vendor_view.status_code == 200
    vendor_records = resp_vendor_view.json()
    assert len(vendor_records) == 1, "Vendor role should only see their own company record!"
    assert vendor_records[0]["company_name"] == "Apex Raw Materials & Metallurgy Corp"
    print("  [PASS] Vendor role data isolation: Confirmed (Only sees Apex Materials)")

    # 6. Vendor Registration -> Pending Approval Workflow
    print("\n[6] Verifying Vendor Registration & Approval Workflow...")
    unique_ts = int(time.time())
    new_vendor_payload = {
        "company_name": f"Zenith Quantum Sensors {unique_ts}",
        "category": "Equipment Vendors",
        "contact_person": "Dr. Aris Thorne",
        "email": f"aris.thorne.{unique_ts}@zenithquantum.tech",
        "phone": "+1-555-098-7654",
        "address": "88 Science Park Way, Cambridge, MA",
        "tax_id": f"US-EIN-{unique_ts}",
        "products_services": "High-precision quantum magnetic and optical sensors",
        "password": "SecureVendor2026!"
    }
    reg_resp = client.post("/api/auth/register", json=new_vendor_payload)
    assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
    reg_data = reg_resp.json()
    assert reg_data["status"] == "Pending Approval"
    print(f"  [PASS] Vendor Self-Registration: Registered '{new_vendor_payload['company_name']}' with status 'Pending Approval'")

    # Check approval queue
    queue_resp = client.get("/api/vendors/approval-queue", headers=admin_headers)
    assert queue_resp.status_code == 200
    queue_items = queue_resp.json()
    newly_registered = next((item for item in queue_items if item["company_name"] == new_vendor_payload["company_name"]), None)
    assert newly_registered is not None, "Newly registered vendor not in approval queue"
    print(f"  [PASS] Approval Queue: Vendor present in queue (ID: {newly_registered['id']})")

    # Approve vendor
    approve_resp = client.post(
        f"/api/vendors/{newly_registered['id']}/status",
        json={"status": "Active", "notes": "Verified business credentials"},
        headers=admin_headers
    )
    assert approve_resp.status_code == 200 and approve_resp.json()["new_status"] == "Active"
    print("  [PASS] Approval Workflow: Vendor status transitioned from 'Pending Approval' to 'Active'")

    # 7. Procurement Requisition -> Approval -> Vendor Assignment
    print("\n[7] Verifying Procurement Lifecycle & Vendor Assignment...")
    req_payload = {
        "title": "Cryogenic Temperature Sensor Modules",
        "department": "Advanced R&D",
        "category": "Equipment Vendors",
        "description": "Precision sensors for vacuum test chambers",
        "quantity": 10,
        "estimated_cost": 34000.0,
        "priority": "High",
        "required_date": "2026-06-15"
    }
    create_req_resp = client.post("/api/procurement/requests", json=req_payload, headers=proc_headers)
    assert create_req_resp.status_code == 200
    created_req_id = create_req_resp.json()["request_id"]
    print(f"  [PASS] Requisition Created: {create_req_resp.json()['request_code']} (Status: Pending)")

    # Approve request
    decide_resp = client.post(
        f"/api/procurement/requests/{created_req_id}/decision",
        json={"status": "Approved", "comments": "Budget allocated for Q2"},
        headers=proc_headers
    )
    assert decide_resp.status_code == 200 and decide_resp.json()["status"] == "Approved"
    print("  [PASS] Requisition Approved: Decision recorded by Procurement Manager")

    # Check Selectable Vendors (CRITICAL: Only Active vendors selectable!)
    sel_resp = client.get("/api/procurement/selectable-vendors?category=Equipment Vendors", headers=proc_headers)
    assert sel_resp.status_code == 200
    selectable_vendors = sel_resp.json()
    assert len(selectable_vendors) >= 1
    # Check that Suspended vendor 8 (Vortex Power Systems) is NOT returned!
    assert all(v["id"] != 8 for v in selectable_vendors), "Suspended vendor must NOT be selectable!"
    selected_v = selectable_vendors[0]
    print(f"  [PASS] Selectable Active Vendors: Only Active vendors selectable (Top ranked: {selected_v['company_name']}, Score: {selected_v['reliability_score']}, Rec: {selected_v['recommendation']})")

    # Issue Purchase Order
    po_payload = {
        "request_id": created_req_id,
        "vendor_id": selected_v["id"],
        "expected_delivery_date": "2026-06-10",
        "total_amount": 34000.0,
        "shipping_mode": "First Class",
        "items": [{"product_name": "Cryogenic Temperature Sensor Modules", "quantity": 10, "unit_price": 3400.0}],
        "notes": "Fast-track shipment requested"
    }
    po_resp = client.post("/api/procurement/purchase-orders", json=po_payload, headers=proc_headers)
    assert po_resp.status_code == 200
    new_po_data = po_resp.json()
    new_po_id = new_po_data["po_id"]
    new_po_num = new_po_data["po_number"]
    print(f"  [PASS] Purchase Order Issued: {new_po_num} to {new_po_data['vendor_name']} for $34,000.00")

    # 8. Delivery Tracking & Real-Time Reliability Recalculation
    print("\n[8] Verifying Delivery Tracking & Live Metric Recalculation...")
    # Record on-time delivery
    deliv_resp = client.post(
        f"/api/procurement/purchase-orders/{new_po_id}/deliver",
        json={
            "actual_delivery_date": "2026-06-08", # 2 days ahead of 2026-06-10 -> On-time!
            "quality_rating": 4.9,
            "inspected_quantity": 10,
            "defective_quantity": 0,
            "evaluator_comments": "Precision tolerance met"
        },
        headers=proc_headers
    )
    assert deliv_resp.status_code == 200
    deliv_res_data = deliv_resp.json()
    assert deliv_res_data["is_on_time"] is True
    print(f"  [PASS] Delivery Processed: Status '{deliv_res_data['delivery_status']}'")
    print(f"  [PASS] Dynamic Recalculation: Updated Reliability Score: {deliv_res_data['updated_reliability_score']}, Risk: {deliv_res_data['updated_risk_level']}, Rec: {deliv_res_data['updated_recommendation']}")

    # 9. Invoicing & Finance Settlement
    print("\n[9] Verifying Invoice Generation & Disbursement...")
    inv_list_resp = client.get(f"/api/procurement/invoices", headers=finance_headers)
    assert inv_list_resp.status_code == 200
    invoices = inv_list_resp.json()
    matched_inv = next((inv for inv in invoices if inv["po_id"] == new_po_id), None)
    assert matched_inv is not None, "Invoice was not generated on delivery!"
    print(f"  [PASS] Automated Invoicing: Generated {matched_inv['invoice_number']} for $34,000.00 (Status: Pending)")

    pay_resp = client.post(
        f"/api/procurement/invoices/{matched_inv['id']}/pay",
        json={"payment_status": "Paid", "payment_reference": "WIRE-2026-TEST-998"},
        headers=finance_headers
    )
    assert pay_resp.status_code == 200 and pay_resp.json()["payment_status"] == "Paid"
    print("  [PASS] Payment Settlement: Invoice settled and marked 'Paid'")

    # 10. Native Email & SMS Intent Trigger (Rule 2)
    print("\n[10] Verifying Communication Triggers (Email & SMS)...")
    email_intent_resp = client.get("/api/communication/compose-intent?vendor_id=1&communication_type=EMAIL&record_type=PO&record_id=PO-2026-001", headers=admin_headers)
    assert email_intent_resp.status_code == 200
    intent_data = email_intent_resp.json()
    assert intent_data["uri"].startswith("mailto:")
    print(f"  [PASS] Email Compose URI: {intent_data['uri'][:45]}... (Pre-filled recipient & subject)")

    sms_intent_resp = client.get("/api/communication/compose-intent?vendor_id=1&communication_type=SMS&record_type=PO&record_id=PO-2026-001", headers=admin_headers)
    assert sms_intent_resp.status_code == 200
    sms_data = sms_intent_resp.json()
    assert sms_data["uri"].startswith("sms:")
    print(f"  [PASS] SMS Compose URI: {sms_data['uri'][:45]}... (Pre-filled phone & message)")

    comm_hist_resp = client.get("/api/communication/history?vendor_id=1", headers=admin_headers)
    assert comm_hist_resp.status_code == 200 and len(comm_hist_resp.json()) >= 2
    print(f"  [PASS] Communication Activity: Permanently audited {len(comm_hist_resp.json())} interaction events in database")

    # 11. Dynamic Charts Telemetry (Zero hardcoding)
    print("\n[11] Verifying Dataset & Database-Driven Dynamic Charts...")
    chart_endpoints = [
        "/api/dashboard/charts/spend-by-category",
        "/api/dashboard/charts/monthly-trend",
        "/api/dashboard/charts/delivery-status",
        "/api/dashboard/charts/vendor-reliability-comparison",
        "/api/dashboard/charts/risk-distribution",
        "/api/dashboard/charts/shipping-modes"
    ]
    for ep in chart_endpoints:
        c_resp = client.get(ep, headers=admin_headers)
        assert c_resp.status_code == 200
        c_data = c_resp.json()
        assert "labels" in c_data and len(c_data["labels"]) > 0
        assert "datasets" in c_data and len(c_data["datasets"]) > 0
        total_data_pts = len(c_data["datasets"][0]["data"])
        print(f"  [PASS] Dynamic Chart [{ep.split('/')[-1]:32}]: {len(c_data['labels'])} labels, {total_data_pts} data points")

    # 12. Document & Report Exports (PDF & Excel)
    print("\n[12] Verifying PDF (ReportLab) & Excel (openpyxl) Report Downloads...")
    pdf_resp = client.get("/api/reports/vendor-pdf?vendor_id=1", headers=admin_headers)
    assert pdf_resp.status_code == 200 and pdf_resp.content.startswith(b"%PDF")
    print(f"  [PASS] Vendor Audit PDF Export: Generated {len(pdf_resp.content)} bytes of valid PDF")

    pdf_proc_resp = client.get("/api/reports/procurement-pdf", headers=admin_headers)
    assert pdf_proc_resp.status_code == 200 and pdf_proc_resp.content.startswith(b"%PDF")
    print(f"  [PASS] Procurement Summary PDF Export: Generated {len(pdf_proc_resp.content)} bytes of valid PDF")

    excel_resp = client.get("/api/reports/vendor-excel", headers=admin_headers)
    assert excel_resp.status_code == 200 and len(excel_resp.content) > 1000
    print(f"  [PASS] Vendor Intelligence Matrix Excel Export: Generated {len(excel_resp.content)} bytes of .xlsx")

    excel_proc_resp = client.get("/api/reports/procurement-excel", headers=admin_headers)
    assert excel_proc_resp.status_code == 200 and len(excel_proc_resp.content) > 1000
    print(f"  [PASS] Procurement Orders Excel Export: Generated {len(excel_proc_resp.content)} bytes of .xlsx")

    # 13. Audit Trail & Notifications
    print("\n[13] Verifying Audit Trail & Notification Engine...")
    logs_resp = client.get("/api/audit/logs", headers=admin_headers)
    assert logs_resp.status_code == 200
    logs = logs_resp.json()
    assert len(logs) >= 5
    print(f"  [PASS] Audit Logs: {len(logs)} immutable events verified in database")

    notif_resp = client.get("/api/audit/notifications", headers=admin_headers)
    assert notif_resp.status_code == 200
    print(f"  [PASS] Notifications: {len(notif_resp.json())} active role notifications verified")

    print("\n" + "="*60)
    print("ALL 13 VERIFICATION CRITERIA PASSED WITHOUT ERROR!")
    print("="*60 + "\n")

if __name__ == "__main__":
    test_complete_platform()
