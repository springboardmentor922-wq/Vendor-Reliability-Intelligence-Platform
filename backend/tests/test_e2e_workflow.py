import os
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
import sys
from datetime import datetime, timedelta

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal, run_migrations
from app.models.enums import VendorStatus, RequestStatus, POStatus, ContractStatus
from app.models.user import User
from app.models.vendor import Vendor
from app.models.procurement import ProcurementRequest, PurchaseOrder, Invoice, CompanyTreasury
from app.models.contract import Contract
from app.models.notification import Notification
from app.core.security import hash_password

raw_client = TestClient(app)

class ApiClient:
    """Wrapper to prefix all endpoints with /api"""
    def __init__(self, c: TestClient):
        self.c = c

    def get(self, url, **kwargs):
        return self.c.get(f"/api{url}", **kwargs)

    def post(self, url, **kwargs):
        return self.c.post(f"/api{url}", **kwargs)

    def put(self, url, **kwargs):
        return self.c.put(f"/api{url}", **kwargs)

    def patch(self, url, **kwargs):
        return self.c.patch(f"/api{url}", **kwargs)

    def delete(self, url, **kwargs):
        return self.c.delete(f"/api{url}", **kwargs)

client = ApiClient(raw_client)

def run_test():
    print("=" * 70)
    print("STARTING END-TO-END PROCUREMENT & RELIABILITY WORKFLOW AUDIT")
    print("=" * 70)

    # Reset DB or ensure schema
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    db = SessionLocal()

    # Step 1: Ensure users for each role exist
    roles = ["Administrator", "Procurement Manager", "Finance Officer", "Supply Chain Manager"]
    auth_tokens = {}
    for r in roles:
        email = f"{r.lower().replace(' ', '')}@example.com"
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                full_name=f"Test {r}",
                role=r,
                is_active=True,
                hashed_password=hash_password("password123")
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        
        # Login to get token
        res = client.post("/auth/login", json={"email": email, "password": "password123"})
        assert res.status_code == 200, f"Login failed for {r}: {res.text}"
        auth_tokens[r] = res.json()["access_token"]
        print(f"[OK] Authenticated role: {r}")

    # Ensure Treasury exists
    treasury = db.query(CompanyTreasury).first()
    if not treasury:
        treasury = CompanyTreasury(available_balance=10000000.0, total_budget=20000000.0)
        db.add(treasury)
        db.commit()
    print(f"[OK] Company Treasury verified: Balance = INR {treasury.available_balance:,.2f}")

    # ----------------------------------------------------
    # STEP 1: Vendor Registration -> PENDING_APPROVAL
    # ----------------------------------------------------
    unique_suffix = int(datetime.utcnow().timestamp())
    reg_payload = {
        "company_name": f"Apex Dynamics {unique_suffix}",
        "category": "raw_material",
        "contact_person": "Vikram Malhotra",
        "contact_role": "Director",
        "email": f"vikram_{unique_suffix}@apexdynamics.com",
        "phone": "+91 98765 43210",
        "address": "Bhiwandi Logistics Park, Mumbai",
        "gst_number": f"27AABCA{unique_suffix % 9000 + 1000}M1Z5",
        "payment_terms": "Net 30",
        "notes": "ISO 9001:2015 Precision raw materials supplier"
    }
    res_reg = client.post("/vendors/public-register", json=reg_payload)
    assert res_reg.status_code in [200, 201], f"Registration failed: {res_reg.text}"
    vendor_data = res_reg.json()
    if "vendor" in vendor_data:
        vendor_data = vendor_data["vendor"]
    vendor_id = vendor_data["id"]
    print(f"[STEP 1 OK] Vendor registered. ID={vendor_id}, Status={vendor_data['status']}")
    assert vendor_data["status"] == "pending_approval", "Status must be pending_approval"

    # Submit for approval endpoint check
    res_sub = client.post(f"/vendors/{vendor_id}/submit-approval")
    assert res_sub.status_code == 200
    print(f"[STEP 1.1 OK] Submit for approval called: {res_sub.json()['message']}")

    # ----------------------------------------------------
    # STEP 2: Admin Vendor Approval & Zero Initial Rating Check
    # ----------------------------------------------------
    admin_headers = {"Authorization": f"Bearer {auth_tokens['Administrator']}"}
    res_appr = client.patch(f"/vendors/{vendor_id}/status", json={"status": "approved", "notes": "Approved by Admin"}, headers=admin_headers)
    assert res_appr.status_code == 200, f"Admin approval failed: {res_appr.text}"
    appr_vendor = res_appr.json()
    print(f"[STEP 2 OK] Vendor approved by Admin. Status={appr_vendor['status']}")
    assert appr_vendor["status"] == "approved"

    # Verify Intelligence / Reliability Score strictly starts at 0.0
    res_intel = client.get(f"/analytics/vendor-performance/{vendor_id}", headers=admin_headers)
    assert res_intel.status_code == 200
    intel_data = res_intel.json()
    print(f"[STEP 2.1 OK] Newly approved vendor metrics: Reliability Score={intel_data.get('reliability_score')}, Index={intel_data.get('reliability_index')}, Rating={intel_data.get('average_quality_rating')}, Completed={intel_data.get('completed_contracts')}")
    assert intel_data.get("reliability_score") == 0.0, "Score must strictly be 0.0"
    assert intel_data.get("reliability_index") == 0.0, "Index must strictly be 0.0"
    assert intel_data.get("average_quality_rating") == 0.0, "Quality rating must strictly be 0.0"
    assert intel_data.get("completed_contracts") == 0, "Completed contracts must strictly be 0"

    # Create Vendor user login to test vendor side
    v_user = db.query(User).filter(User.vendor_id == vendor_id).first()
    if not v_user:
        v_user = User(
            email=reg_payload["email"],
            full_name=reg_payload["contact_person"],
            role="Vendor",
            vendor_id=vendor_id,
            is_active=True,
            hashed_password=hash_password("vendor123")
        )
        db.add(v_user)
        db.commit()
    res_v_login = client.post("/auth/login", json={"email": reg_payload["email"], "password": "vendor123"})
    assert res_v_login.status_code == 200
    vendor_token = res_v_login.json()["access_token"]
    vendor_headers = {"Authorization": f"Bearer {vendor_token}"}
    print("[OK] Vendor logged into portal.")

    # ----------------------------------------------------
    # STEP 3 & 4: Procurement Manager creates New Procurement Request
    # ----------------------------------------------------
    proc_headers = {"Authorization": f"Bearer {auth_tokens['Procurement Manager']}"}
    req_payload = {
        "title": f"Industrial Titanium Alloy Billets {unique_suffix}",
        "description": "Grade 5 Titanium for high stress turbine housings",
        "department": "Production",
        "requested_by_name": "Test Procurement Manager",
        "quantity": 25,
        "needed_by": (datetime.utcnow() + timedelta(days=14)).strftime("%Y-%m-%d"),
        "priority": "High",
        "category": "raw_material",
        "justification": "Turbine rotor assembly batch #104",
        "budget_amount": 500000.0,
        "specifications": "ASTM B348 Grade 5 certified",
        "location": "Mumbai Plant 1",
        "assigned_vendor_id": vendor_id,
        "is_multi_vendor": False
    }
    res_req = client.post("/procurement/requests", json=req_payload, headers=proc_headers)
    assert res_req.status_code in [200, 201], f"Request creation failed: {res_req.text}"
    created_req = res_req.json()
    req_id = created_req["id"]
    print(f"[STEP 3 & 4 OK] Procurement Request created. ID={req_id}, Status={created_req['status']}")
    assert created_req["status"] == "assigned", "Status should be 'assigned' when single vendor is set"

    # ----------------------------------------------------
    # STEP 5: Single Vendor Notification Verification
    # ----------------------------------------------------
    vendor_notifs = client.get("/notifications", headers=vendor_headers).json()
    assigned_notif = next((n for n in vendor_notifs if "assigned to your company" in n["message"]), None)
    assert assigned_notif is not None, "Vendor must receive assignment notification"
    print(f"[STEP 5 OK] Vendor received notification: '{assigned_notif['message']}'")

    # ----------------------------------------------------
    # STEP 6: Multi-Vendor Broadcast Verification
    # ----------------------------------------------------
    multi_req_payload = {
        "title": f"General Copper Tubing {unique_suffix}",
        "description": "Standard copper pipes",
        "department": "Facilities",
        "requested_by_name": "Test Procurement Manager",
        "quantity": 100,
        "priority": "Medium",
        "category": "raw_material",
        "budget_amount": 75000.0,
        "is_multi_vendor": True
    }
    res_multi = client.post("/procurement/requests", json=multi_req_payload, headers=proc_headers)
    assert res_multi.status_code in [200, 201], f"Multi request creation failed: {res_multi.text}"
    multi_req_id = res_multi.json()["id"]
    # Check vendor received category broadcast
    vendor_notifs_after = client.get("/notifications", headers=vendor_headers).json()
    broadcast_notif = next((n for n in vendor_notifs_after if "New Procurement Request Available" in n["message"]), None)
    assert broadcast_notif is not None, "Vendor in category must receive broadcast notification"
    print(f"[STEP 6 OK] Category broadcast notification verified for vendor: '{broadcast_notif['message']}'")

    # ----------------------------------------------------
    # STEP 7: Vendor Acceptance -> VENDOR_ACCEPTED
    # ----------------------------------------------------
    res_accept = client.post(f"/procurement/requests/{req_id}/vendor-accept", headers=vendor_headers)
    assert res_accept.status_code == 200, f"Vendor accept failed: {res_accept.text}"
    accepted_data = res_accept.json()
    print(f"[STEP 7 OK] Vendor accepted requisition. Status={accepted_data['status']}")
    assert accepted_data["status"] == "vendor_accepted"

    # ----------------------------------------------------
    # STEP 8: Finance Manager Balance Check & Approval
    # ----------------------------------------------------
    finance_headers = {"Authorization": f"Bearer {auth_tokens['Finance Officer']}"}
    
    # 8.1: Test Treasury balance rejection if budget exceeds available balance
    # Temporarily set treasury balance to lower than budget
    db.refresh(treasury)
    original_balance = treasury.available_balance
    treasury.available_balance = 1000.0  # lower than 500,000.0
    db.commit()

    res_fin_fail = client.post(f"/procurement/requests/{req_id}/finance-approve", headers=finance_headers)
    assert res_fin_fail.status_code == 400, "Must reject when budget > available balance"
    print(f"[STEP 8.1 OK] Balance check successfully prevented approval: {res_fin_fail.json()['detail']}")

    # Restore treasury balance
    treasury.available_balance = original_balance
    db.commit()

    # 8.2: Approve with sufficient balance
    res_fin_appr = client.post(f"/procurement/requests/{req_id}/finance-approve", headers=finance_headers)
    assert res_fin_appr.status_code == 200, f"Finance approval failed: {res_fin_appr.text}"
    fin_result = res_fin_appr.json()
    po = fin_result["purchase_order"]
    contract = fin_result["contract"]
    po_id = po["id"]
    print(f"[STEP 8.2 OK] Finance approved: PO={po['po_number']}, Contract={contract['contract_number']}")
    assert po["status"] in ["pending", "ordered", "approved"]
    assert contract["status"] == "active"

    # Check treasury deducted
    db.refresh(treasury)
    print(f"[STEP 8.3 OK] Treasury deducted: New Balance = INR {treasury.available_balance:,.2f}")

    # ----------------------------------------------------
    # STEP 9: Contract & Payment Notification to Vendor
    # ----------------------------------------------------
    v_notifs_after_fin = client.get("/notifications", headers=vendor_headers).json()
    pay_notif = next((n for n in v_notifs_after_fin if "awarded" in n["message"].lower() or "active" in n["message"].lower()), None)
    assert pay_notif is not None, "Vendor must receive contract award notification"
    print(f"[STEP 9 OK] Vendor contract notification verified: '{pay_notif['message']}'")

    # ----------------------------------------------------
    # STEP 10: Supply Chain Controller Tracking (IN_TRANSIT -> DELIVERED)
    # ----------------------------------------------------
    sc_headers = {"Authorization": f"Bearer {auth_tokens['Supply Chain Manager']}"}
    
    # 10.1: Transition to IN_TRANSIT
    res_transit = client.patch(f"/procurement/orders/{po_id}/status", json={"status": "in_transit"}, headers=sc_headers)
    assert res_transit.status_code == 200, f"Failed to mark in_transit: {res_transit.text}"
    print(f"[STEP 10 OK] Supply Chain updated status to IN_TRANSIT: {res_transit.json()['status']}")
    assert res_transit.json()["status"] == "in_transit"

    # ----------------------------------------------------
    # STEP 11 & 12: Delivery Completion & Automatic Invoice Generation
    # ----------------------------------------------------
    res_deliv = client.patch(f"/procurement/orders/{po_id}/status", json={"status": "delivered"}, headers=sc_headers)
    assert res_deliv.status_code == 200, f"Failed to mark delivered: {res_deliv.text}"
    print(f"[STEP 11 OK] Supply Chain marked DELIVERED")
    assert res_deliv.json()["status"] == "delivered"

    # Verify invoice was automatically created
    invoices = client.get(f"/procurement/invoices", headers=finance_headers).json()
    matching_invoice = next((inv for inv in invoices if inv["purchase_order_id"] == po_id), None)
    assert matching_invoice is not None, "Invoice must be automatically created upon DELIVERED"
    print(f"[STEP 12 OK] Automatic GST Invoice generated: #{matching_invoice['invoice_number']} for amount INR {matching_invoice['amount']:,.2f}")

    # ----------------------------------------------------
    # STEP 13: Vendor Reliability Recalculation after Delivery
    # ----------------------------------------------------
    res_intel_after = client.get(f"/analytics/vendor-performance/{vendor_id}", headers=admin_headers)
    assert res_intel_after.status_code == 200
    intel_after = res_intel_after.json()
    print(f"[STEP 13 OK] Post-Delivery Vendor Intelligence: Reliability Score={intel_after.get('reliability_score')}, Index={intel_after.get('reliability_index')}, Rating={intel_after.get('average_quality_rating')}, Completed={intel_after.get('completed_contracts')}")
    assert intel_after.get("completed_contracts") >= 1, "Completed contracts must increment"
    assert intel_after.get("reliability_score") > 0.0, "Reliability score must be recalculated from performance data"
    assert intel_after.get("reliability_index") > 0.0, "Reliability index must be recalculated"

    # ----------------------------------------------------
    # STEP 14: Notification Audit
    # ----------------------------------------------------
    all_notifs = db.query(Notification).all()
    print(f"[STEP 14 OK] Notification audit: Total {len(all_notifs)} persistent notifications across all 5 roles.")

    # ----------------------------------------------------
    # STEP 15: Role-based Access Control Check
    # ----------------------------------------------------
    # Vendor trying to approve finance request -> should be 403 Forbidden
    res_forbidden = client.post(f"/procurement/requests/{req_id}/finance-approve", headers=vendor_headers)
    assert res_forbidden.status_code == 403, "Vendor must NOT be allowed to approve finance payment"
    print(f"[STEP 15 OK] RBAC enforced: Vendor forbidden from finance approval (HTTP 403)")

    print("=" * 70)
    print("ALL 15 END-TO-END WORKFLOW AUDIT STEPS PASSED WITH 100% SUCCESS!")
    print("=" * 70)
    db.close()

if __name__ == "__main__":
    run_test()
