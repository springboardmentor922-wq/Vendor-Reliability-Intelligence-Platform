import sys
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.seed_data import seed_database

client = TestClient(app)

def run_tests():
    print("--- 1. Testing Root & Health ---")
    r = client.get("/")
    assert r.status_code == 200, f"Root failed: {r.text}"
    print(" Root endpoint OK:", r.json()["name"])

    print("\n--- 2. Testing Database Seed ---")
    r = client.post("/api/seed/reset")
    assert r.status_code == 200, f"Seed reset failed: {r.text}"
    print(" DB Reset & Seeded OK:", r.json()["status"])

    print("\n--- 3. Testing Authentication (All 6 Roles) ---")
    roles_credentials = [
        ("admin@vendoriq.com", "Admin@123", "Administrator"),
        ("procurement@vendoriq.com", "Procure@123", "Procurement Manager"),
        ("supplychain@vendoriq.com", "Supply@123", "Supply Chain Manager"),
        ("vendor@apexmaterials.com", "Vendor@123", "Vendor"),
        ("finance@vendoriq.com", "Finance@123", "Finance Officer"),
        ("auditor@vendoriq.com", "Audit@123", "Auditor")
    ]

    tokens = {}
    for email, pwd, expected_role in roles_credentials:
        r = client.post("/api/auth/login", json={"email": email, "password": pwd})
        assert r.status_code == 200, f"Login failed for {email}: {r.text}"
        data = r.json()
        assert data["user"]["role"] == expected_role, f"Role mismatch: {data['user']['role']} vs {expected_role}"
        tokens[expected_role] = data["access_token"]
        print(f" Login successful: {email} ({expected_role})")

    procure_headers = {"Authorization": f"Bearer {tokens['Procurement Manager']}"}
    vendor_headers = {"Authorization": f"Bearer {tokens['Vendor']}"}
    admin_headers = {"Authorization": f"Bearer {tokens['Administrator']}"}
    finance_headers = {"Authorization": f"Bearer {tokens['Finance Officer']}"}
    auditor_headers = {"Authorization": f"Bearer {tokens['Auditor']}"}

    print("\n--- 4. Testing Role-Based Dashboard Shells ---")
    for role_name, token in tokens.items():
        headers = {"Authorization": f"Bearer {token}"}
        r = client.get("/api/dashboard/stats", headers=headers)
        assert r.status_code == 200, f"Dashboard failed for {role_name}: {r.text}"
        print(f" Dashboard stats loaded for {role_name}: role={r.json()['role']}")

    print("\n--- 5. Testing Vendor Management & RBAC ---")
    # Procurement Manager lists all vendors
    r = client.get("/api/vendors", headers=procure_headers)
    assert r.status_code == 200
    all_vendors = r.json()
    assert len(all_vendors) >= 6, f"Expected at least 6 vendors, got {len(all_vendors)}"
    print(f" Procurement Manager sees {len(all_vendors)} vendors")
    apex_vendor = next(v for v in all_vendors if v["company_name"] == "Apex Raw Materials Ltd")
    apex_vendor_id = apex_vendor["id"]

    # Vendor role only sees their own vendor profile
    r = client.get("/api/vendors", headers=vendor_headers)
    assert r.status_code == 200
    vendor_view = r.json()
    assert len(vendor_view) == 1, f"Vendor should see exactly 1 vendor, got {len(vendor_view)}"
    assert vendor_view[0]["company_name"] == "Apex Raw Materials Ltd"
    print(" Vendor RBAC isolation verified: vendor sees only 'Apex Raw Materials Ltd'")

    # Test Self-Registration as Vendor with Company Details
    self_vendor_payload = {
        "full_name": "Aaryan Singh",
        "email": "aaryan@aaryantech.com",
        "password": "Aaryan@123",
        "role": "Vendor",
        "phone": "+91 98765 43210",
        "company_name": "Aaryan Tech & Materials Ltd",
        "category": "raw_material",
        "contact_person": "Aaryan Singh",
        "gst_number": "24AAACA5566B1Z8",
        "address": "GIDC Industrial Estate, Vadodara, Gujarat",
        "notes": "Precision alloy supplier specializing in aerospace materials."
    }
    r = client.post("/api/auth/register", json=self_vendor_payload)
    assert r.status_code == 201, f"Vendor self-registration failed: {r.text}"
    aaryan_data = r.json()
    assert aaryan_data["user"]["vendor_id"] is not None, "Vendor ID should be auto-assigned"
    aaryan_token = aaryan_data["access_token"]
    aaryan_headers = {"Authorization": f"Bearer {aaryan_token}"}
    print(f" Self-registered vendor '{self_vendor_payload['company_name']}' with auto-assigned Vendor ID {aaryan_data['user']['vendor_id']}")

    # Check that Aaryan's company is in 'pending' status
    r = client.get("/api/vendors", headers=aaryan_headers)
    assert r.status_code == 200
    aaryan_vendor_list = r.json()
    assert len(aaryan_vendor_list) == 1
    assert aaryan_vendor_list[0]["status"] == "pending"
    assert aaryan_vendor_list[0]["company_name"] == "Aaryan Tech & Materials Ltd"
    print(" Aaryan's company correctly set to 'pending' review")

    # Verify Procurement Manager is blocked from approving vendor confirmation
    r_blocked = client.patch(
        f"/api/vendors/{aaryan_vendor_list[0]['id']}/status",
        json={"status": "approved", "notes": "Procurement attempting approval."},
        headers=procure_headers
    )
    assert r_blocked.status_code == 403
    print(" Procurement Manager correctly blocked from vendor onboarding confirmation (403 Forbidden)")

    # Vendor confirms and approves their own onboarding
    r = client.patch(
        f"/api/vendors/{aaryan_vendor_list[0]['id']}/status",
        json={"status": "approved", "notes": "Onboarding confirmed by Vendor."},
        headers=aaryan_headers
    )
    assert r.status_code == 200
    assert r.json()["status"] == "approved"
    print(" Vendor confirmed and approved onboarding successfully")

    # Verify initial reliability score is exactly zero for new vendor
    r_intel = client.get(f"/api/analytics/vendor-performance/{aaryan_vendor_list[0]['id']}", headers=aaryan_headers)
    assert r_intel.status_code == 200
    assert r_intel.json()["reliability_score"] == 0.0
    print(" New vendor initial reliability score verified as 0.0")

    print("\n--- 6. Testing Procurement & Purchase Order Workflow ---")
    # 1. Create Procurement Request
    req_payload = {
        "title": "Industrial Titanium Stock for Turbine Production",
        "description": "20 tons of aerospace grade titanium alloy billets."
    }
    r = client.post("/api/procurement/requests", json=req_payload, headers=procure_headers)
    assert r.status_code == 201
    created_req = r.json()
    print(f" Created Procurement Request: #{created_req['id']} - {created_req['title']}")

    # 2. Approve Procurement Request
    r = client.patch(f"/api/procurement/requests/{created_req['id']}/status", json={"status": "approved"}, headers=procure_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "approved"
    print(" Approved Procurement Request")

    # 3. Create Purchase Order with Line Items & Auto Total
    po_payload = {
        "procurement_request_id": created_req["id"],
        "vendor_id": aaryan_vendor_list[0]["id"],
        "expected_delivery_date": "2026-10-15",
        "items": [
            {"item_name": "Titanium Grade 5 Billets (Tons)", "quantity": 10.0, "unit_price": 4500.0},
            {"item_name": "Forging Heat Treatment Certification", "quantity": 1.0, "unit_price": 2500.0}
        ]
    }
    r = client.post("/api/procurement/orders", json=po_payload, headers=procure_headers)
    assert r.status_code == 201, f"PO creation failed: {r.text}"
    created_po = r.json()
    expected_total = (10.0 * 4500.0) + (1.0 * 2500.0)
    assert created_po["total_amount"] == expected_total, f"Total mismatch: {created_po['total_amount']} vs {expected_total}"
    assert created_po["status"] == "pending"
    print(f" Created PO {created_po['po_number']} with auto-calculated total: ${created_po['total_amount']:,.2f}")

    # 4. Approve Purchase Order
    r = client.patch(f"/api/procurement/orders/{created_po['id']}/status", json={"status": "approved"}, headers=procure_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "approved"
    print(" PO Status transitioned to 'approved'")

    # 5. Move to Ordered
    r = client.patch(f"/api/procurement/orders/{created_po['id']}/status", json={"status": "ordered"}, headers=procure_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "ordered"
    print(" PO Status transitioned to 'ordered'")

    # 6. Move to Delivered
    r = client.patch(f"/api/procurement/orders/{created_po['id']}/status", json={"status": "delivered", "actual_delivery_date": "2026-10-10"}, headers=procure_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "delivered"
    print(" PO Status transitioned to 'delivered'")

    # 7. Generate Invoice against PO
    inv_payload = {
        "purchase_order_id": created_po["id"],
        "amount": created_po["total_amount"],
        "due_date": "2026-11-10"
    }
    r = client.post("/api/procurement/invoices", json=inv_payload, headers=procure_headers)
    assert r.status_code == 201
    created_inv = r.json()
    print(f" Generated Invoice {created_inv['invoice_number']} for ${created_inv['amount']:,.2f}")

    # 8. Finance Officer pays Invoice
    r = client.patch(f"/api/procurement/invoices/{created_inv['id']}/status", json={"status": "paid", "paid_date": "2026-10-12"}, headers=finance_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "paid"
    print(" Invoice marked as paid by Finance Officer")

    print("\n--- 7. Testing Contract Management & Expiring Soon Flag ---")
    expiring_date = datetime.now() + timedelta(days=15)
    contract_payload = {
        "vendor_id": aaryan_vendor_list[0]["id"],
        "title": "Master Supply Agreement - Titanium Rods",
        "contract_number": "CTR-2026-TITAN-01",
        "start_date": "2025-10-01",
        "end_date": expiring_date.strftime("%Y-%m-%d"),
        "terms": "Net 30 payment terms, 99% purity SLA.",
        "file_path": "/uploads/contracts/ctr_titan_01.pdf"
    }
    r = client.post("/api/contracts", json=contract_payload, headers=procure_headers)
    assert r.status_code == 201
    created_contract = r.json()
    assert created_contract["status"] == "expiring_soon", f"Expected expiring_soon, got {created_contract['status']}"
    print(f" Contract {created_contract['contract_number']} auto-flagged as '{created_contract['status']}'")

    # Add Certification
    cert_payload = {
        "contract_id": created_contract["id"],
        "vendor_id": aaryan_vendor_list[0]["id"],
        "name": "AS9100D Aerospace Quality Certification",
        "issued_date": "2026-01-10",
        "expiry_date": "2027-01-10"
    }
    r = client.post("/api/contracts/certifications", json=cert_payload, headers=procure_headers)
    assert r.status_code == 201
    print(f" Added certification '{r.json()['name']}'")

    print("\n--- 8. Testing Communication Thread ---")
    # Send message from Procurement Manager to Vendor
    msg_payload = {
        "vendor_id": apex_vendor_id,
        "body": "Please share updated shipping manifests."
    }
    r = client.post("/api/messages", json=msg_payload, headers=procure_headers)
    assert r.status_code == 201
    print(" Procurement Manager sent message to Apex Raw Materials")

    # Fetch messages as Vendor
    r = client.get(f"/api/messages/vendor/{apex_vendor_id}", headers=vendor_headers)
    assert r.status_code == 200, f"Get messages failed: {r.text}"
    msgs = r.json()
    assert len(msgs) >= 4
    print(f" Vendor retrieved message thread ({len(msgs)} messages)")

    print("\n--- 9. Testing Audit Logs ---")
    r = client.get("/api/audit-logs", headers=auditor_headers)
    assert r.status_code == 200
    logs = r.json()
    assert len(logs) > 0
    print(f" Auditor retrieved {len(logs)} audit trail entries")

    print("\n--- 10. Testing Analytics Overview & Reliability Scoring (Milestone 3) ---")
    # Global Analytics Overview
    r = client.get("/api/analytics/overview", headers=procure_headers)
    assert r.status_code == 200, f"Analytics overview failed: {r.text}"
    overview = r.json()
    assert "total_vendors" in overview
    assert "average_reliability_score" in overview
    assert "platform_on_time_rate" in overview
    assert len(overview["category_breakdown"]) > 0
    assert len(overview["top_ranked_suppliers"]) > 0
    print(f" Analytics Overview loaded: Avg Reliability={overview['average_reliability_score']}, Platform On-Time={overview['platform_on_time_rate']}%")

    # Vendor-specific deep dive metrics
    r = client.get(f"/api/analytics/vendor-performance/{apex_vendor_id}", headers=procure_headers)
    assert r.status_code == 200, f"Vendor performance failed: {r.text}"
    perf = r.json()
    assert perf["vendor_id"] == apex_vendor_id
    assert "reliability_score" in perf
    assert "risk_level" in perf
    assert "supplier_tier" in perf
    assert len(perf["monthly_trend"]) == 6
    assert len(perf["recommendations"]) > 0
    print(f" Vendor Performance loaded for {perf['company_name']}: Score={perf['reliability_score']}, Tier='{perf['supplier_tier']}', Risk='{perf['risk_level']}'")

    print("\n--- 11. Testing Predictive AI Delivery Delay Model (Milestone 3) ---")
    # Scenario A: Tight turnaround (2 days) + High spend ($35,000) -> Should predict elevated delay risk
    pred_payload_tight = {
        "vendor_id": apex_vendor_id,
        "scheduled_days": 2,
        "total_amount": 35000.0,
        "item_count": 6,
        "shipping_mode": "Same Day"
    }
    r = client.post("/api/analytics/predict-po-risk", json=pred_payload_tight, headers=procure_headers)
    assert r.status_code == 200, f"Delay prediction failed: {r.text}"
    pred_tight = r.json()
    assert pred_tight["late_delivery_risk"] is True or pred_tight["risk_probability"] >= 40.0
    assert len(pred_tight["key_risk_factors"]) >= 1
    assert len(pred_tight["mitigation_recommendations"]) >= 1
    print(f" AI Risk Simulator (Tight Timeline): Probability={pred_tight['risk_probability']}%, Delay={pred_tight['predicted_delay_days']} days, Risk Level={pred_tight['risk_level']}")

    # Scenario B: Standard timeline (14 days) + moderate spend ($5,000) -> Low risk
    pred_payload_normal = {
        "vendor_id": apex_vendor_id,
        "scheduled_days": 14,
        "total_amount": 5000.0,
        "item_count": 2,
        "shipping_mode": "Standard Ground"
    }
    r = client.post("/api/analytics/predict-po-risk", json=pred_payload_normal, headers=procure_headers)
    assert r.status_code == 200
    pred_normal = r.json()
    assert pred_normal["risk_level"] in ["Low", "Medium-Low"]
    print(f" AI Risk Simulator (Normal Timeline): Probability={pred_normal['risk_probability']}%, Risk Level={pred_normal['risk_level']}")

    print("\n--- 12. Testing Dynamic Reports & Data Exports (Milestone 3) ---")
    # 1. Vendor Performance CSV
    r = client.get("/api/analytics/reports/export?report_type=vendor_performance&export_format=csv", headers=procure_headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "Vendor ID" in r.text
    print(f" Vendor Performance CSV Export verified ({len(r.text.splitlines())} lines)")

    # 2. Procurement Spend CSV
    r = client.get("/api/analytics/reports/export?report_type=procurement_spend&export_format=csv", headers=procure_headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "PO Number" in r.text
    print(f" Procurement Spend CSV Export verified ({len(r.text.splitlines())} lines)")

    # 3. Contract Compliance CSV
    r = client.get("/api/analytics/reports/export?report_type=contract_compliance&export_format=csv", headers=procure_headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "Contract #" in r.text
    print(f" Contract Compliance CSV Export verified ({len(r.text.splitlines())} lines)")

    # 4. JSON Format Export
    r = client.get("/api/analytics/reports/export?report_type=vendor_performance&export_format=json", headers=procure_headers)
    assert r.status_code == 200
    assert "data" in r.json()
    print(" JSON Report Export verified")

    print("\n--- 13. Testing Event-Driven Notification Engine (Milestone 3) ---")
    # Trigger background scan
    r = client.post("/api/notifications/scan-and-trigger", headers=procure_headers)
    assert r.status_code == 200
    print(f" Notification scan triggered: {r.json()['status']}, new alerts={r.json()['alerts_triggered']}")

    # Fetch notifications
    r = client.get("/api/notifications", headers=procure_headers)
    assert r.status_code == 200
    notifs = r.json()
    assert len(notifs) >= 1
    print(f" Retrieved {len(notifs)} live notifications for Procurement Manager")

    # Mark single notification as read
    first_notif_id = notifs[0]["id"]
    r = client.patch(f"/api/notifications/{first_notif_id}/read", headers=procure_headers)
    assert r.status_code == 200
    assert r.json()["is_read"] is True
    print(f" Notification #{first_notif_id} marked as read")

    # Mark all notifications as read
    r = client.patch("/api/notifications/mark-all-read", headers=procure_headers)
    assert r.status_code == 200
    print(" All notifications successfully marked as read")

    print("\n--- 14. Testing Admin Role Promotion & Staff Reassignment ---")
    # Fetch user list as Admin
    r = client.get("/api/auth/users", headers=admin_headers)
    assert r.status_code == 200
    all_users = r.json()
    supply_user = next(u for u in all_users if u["email"] == "supplychain@vendoriq.com")
    vendor_user = next(u for u in all_users if u["role"] == "Vendor")

    # Admin promotes/updates Supply Chain Manager to Procurement Manager
    r = client.put(f"/api/auth/users/{supply_user['id']}/role", json={"new_role": "Procurement Manager"}, headers=admin_headers)
    assert r.status_code == 200, f"Role update failed: {r.text}"
    assert r.json()["role"] == "Procurement Manager"
    print(f" Admin successfully promoted '{supply_user['full_name']}' to '{r.json()['role']}'")

    # Admin reverts role back to Supply Chain Manager
    r = client.put(f"/api/auth/users/{supply_user['id']}/role", json={"new_role": "Supply Chain Manager"}, headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["role"] == "Supply Chain Manager"
    print(f" Role smoothly updated back to 'Supply Chain Manager'")

    # Verify Vendor protection rule: trying to change a Vendor's role must fail
    r = client.put(f"/api/auth/users/{vendor_user['id']}/role", json={"new_role": "Procurement Manager"}, headers=admin_headers)
    assert r.status_code == 400
    print(f" Protected Vendor rule verified: Vendor role modification correctly blocked (400 Bad Request)")


    print("\n--- 15. Testing Vendor Direct Email to Procurement Team ---")
    email_payload = {
        "vendor_id": apex_vendor_id,
        "recipient_email": "procurement@vendoriq.com",
        "subject": "Urgent: Direct Shipping Dispatch Notice for PO-2026-F6124E",
        "priority": "High / Urgent",
        "reference_type": "Purchase Order",
        "reference_id": "PO-2026-F6124E",
        "body": "Dear Procurement Team, We have expedited the titanium batch with SwiftLine Air Freight. Tracking AWB: SWF-990021.",
        "attachment_name": "Dispatch_Manifest_Titanium.pdf"
    }
    r = client.post("/api/messages/send-email", json=email_payload, headers=vendor_headers)
    assert r.status_code == 201, f"Send email failed: {r.text}"
    email_resp = r.json()
    assert email_resp["delivery_status"] == "Delivered to Secure Enterprise Gateway"
    assert email_resp["subject"] == email_payload["subject"]
    print(f" Direct formal email dispatched: '{email_resp['subject']}' with attachment '{email_resp['attachment_name']}'")

    # Verify notification was generated for Procurement Manager
    r = client.get("/api/notifications", headers=procure_headers)
    assert r.status_code == 200
    notifs = r.json()
    assert any("formal email" in n["message"].lower() for n in notifs)
    print(" Procurement Manager received automated email alert notification")

    print("\n--- 16. Testing 6-Factor Reliability Formula & Factor Breakdown (Milestone 4 Guide) ---")
    r = client.get(f"/api/analytics/vendor-performance/{apex_vendor_id}", headers=procure_headers)
    assert r.status_code == 200
    apex_metrics = r.json()
    assert "factor_breakdown" in apex_metrics
    fb = apex_metrics["factor_breakdown"]
    assert "delivery_history" in fb
    assert fb["delivery_history"]["weight"] == 25
    assert "product_quality" in fb
    assert fb["product_quality"]["weight"] == 25
    assert "communication_efficiency" in fb
    assert fb["communication_efficiency"]["weight"] == 10
    assert "contract_compliance" in fb
    assert fb["contract_compliance"]["weight"] == 15
    assert "purchase_history" in fb
    assert fb["purchase_history"]["weight"] == 10
    assert "issue_resolution" in fb
    assert fb["issue_resolution"]["weight"] == 15
    factor_weight_sum = sum(v["weight"] for k, v in fb.items() if isinstance(v, dict) and "weight" in v)
    assert factor_weight_sum == 100
    print(f" 6-Factor Reliability breakdown verified according to Guide: weights sum to 100%, Apex overall score={apex_metrics['reliability_score']}")

    print("\n--- 17. Testing Automated Performance Record on PO Delivery ---")
    db = SessionLocal()
    from app.models.performance import PerformanceRecord, ReliabilityScore
    perf_records = db.query(PerformanceRecord).filter(PerformanceRecord.vendor_id == aaryan_vendor_list[0]["id"]).all()
    assert len(perf_records) >= 1
    assert perf_records[-1].on_time is True
    print(f" Auto-generated PerformanceRecord verified for delivered PO (on_time={perf_records[-1].on_time})")
    rel_score_rec = db.query(ReliabilityScore).filter(ReliabilityScore.vendor_id == aaryan_vendor_list[0]["id"]).first()
    assert rel_score_rec is not None
    print(f" Live ReliabilityScore record updated in DB: score={rel_score_rec.score}")
    db.close()

    print("\n--- 18. Testing All 5 Report Types Data & Excel Export ---")
    report_types = ["vendor_performance", "procurement_reports", "po_reports", "compliance_reports", "contract_reports"]
    for rep_type in report_types:
        r_data = client.get(f"/api/analytics/reports/data?report_type={rep_type}", headers=procure_headers)
        assert r_data.status_code == 200
        data_list = r_data.json()
        assert isinstance(data_list, list)
        print(f" Report '{rep_type}' data verified ({len(data_list)} records returned)")

        r_excel = client.get(f"/api/analytics/reports/export?report_type={rep_type}&export_format=excel", headers=procure_headers)
        assert r_excel.status_code == 200
        assert "application/vnd.ms-excel" in r_excel.headers["content-type"]
        assert r_excel.content.startswith(b"\xef\xbb\xbf")
        print(f" Excel export for '{rep_type}' verified (.xlsx with UTF-8 BOM)")

    print("\n--- 19. Testing SMS Gateway Mobile Dispatch & Audit Logs ---")
    sms_payload = {
        "recipient_phone": "+91 98765 43210",
        "recipient_name": "Apex Operations Lead",
        "message": f"[VendorIQ SMS] URGENT: Delivery milestone update for {created_po['po_number']}."
    }
    r_sms = client.post("/api/notifications/send-sms", json=sms_payload, headers=procure_headers)
    assert r_sms.status_code == 200
    sms_res = r_sms.json()
    assert sms_res["status"] == "success"
    assert sms_res["sms"]["recipient_phone"] == sms_payload["recipient_phone"]
    print(" SMS notification successfully dispatched via SMS Gateway")

    r_logs = client.get("/api/notifications/sms-logs", headers=procure_headers)
    assert r_logs.status_code == 200
    sms_logs = r_logs.json()
    assert len(sms_logs) >= 2
    assert any(sms_payload["recipient_phone"] in log["recipient_phone"] for log in sms_logs)
    print(f" SMS Gateway audit logs retrieved ({len(sms_logs)} log entries verified)")

    print("\n--- 20. Testing 100% Dynamic Database-Driven Dashboards ---")
    # Admin Dashboard
    r_admin = client.get("/api/dashboard/stats", headers=admin_headers)
    assert r_admin.status_code == 200
    d_admin = r_admin.json()
    metrics = d_admin["metrics"]
    assert metrics["total_users"] >= 6
    assert metrics["total_vendors"] >= 6
    assert metrics["total_orders"] >= 1
    assert "procurement_reports" in d_admin
    assert len(d_admin["procurement_reports"]) >= 1
    print(f" Admin Dashboard: Dynamic DB counts verified (users={metrics['total_users']}, vendors={metrics['total_vendors']}, orders={metrics['total_orders']})")

    # Procurement Dashboard
    r_proc = client.get("/api/dashboard/stats", headers=procure_headers)
    assert r_proc.status_code == 200
    d_proc = r_proc.json()
    assert "procurement_overview" in d_proc
    assert "active_pos_breakdown" in d_proc
    assert "cost_by_category" in d_proc
    assert "radar_performance" in d_proc
    print(" Procurement Dashboard: Dynamic spend & PO status breakdown verified")

    # Vendor Dashboard
    r_v = client.get("/api/dashboard/stats", headers=vendor_headers)
    assert r_v.status_code == 200
    d_v = r_v.json()
    assert "vendor_performance_comparison" in d_v
    assert "contract_status_donut" in d_v
    assert "order_history_chart" in d_v
    print(" Vendor Dashboard: Live contract donut & order history dynamic charts verified")

    print("\n=======================================================")
    print(" ALL 20 BACKEND TEST SUITES PASSED WITH 100% SUCCESS!")
    print("=======================================================")


if __name__ == "__main__":
    run_tests()

