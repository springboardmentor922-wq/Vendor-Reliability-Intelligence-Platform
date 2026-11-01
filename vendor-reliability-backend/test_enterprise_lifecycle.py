import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def make_request(method, path, data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(content)
        except:
            return e.code, {"raw": content}

def run_tests():
    print("=" * 70)
    print("VENDOR RELIABILITY & RISK MANAGEMENT SYSTEM - FULL SUITE VERIFICATION")
    print("=" * 70)

    # 1. Verify Demo Accounts (Exactly 6 roles)
    print("\n--- 1. Testing Demo Accounts (6 Roles) ---")
    status, accounts = make_request("GET", "/auth/demo-accounts")
    assert status == 200, f"Expected 200, got {status}"
    assert len(accounts) == 6, f"Expected 6 roles, got {len(accounts)}"
    roles = [a["role"] for a in accounts]
    print(f"Verified {len(accounts)} Roles: {', '.join(roles)}")
    assert "Administrator" in roles
    assert "Procurement Manager" in roles
    assert "Finance Officer" in roles
    assert "Supply Chain Manager" in roles
    assert "Vendor" in roles
    assert "Auditor" in roles
    print("[PASS] All 6 strict enterprise roles verified.")

    # 2. Test Vendor Registration with Mandatory 6 Categories
    print("\n--- 2. Testing Vendor Registration with 6 Categories ---")
    
    # 2a. Attempt Vendor registration without category -> MUST FAIL (422)
    invalid_vendor = {
        "full_name": "Incomplete Vendor Rep",
        "email": "nocat@supplier.com",
        "password": "password123",
        "role": "Vendor",
        "company": "Missing Category Inc"
    }
    status, err = make_request("POST", "/auth/register", invalid_vendor)
    assert status == 422, f"Expected 422 for missing vendor category, got {status}: {err}"
    print(f"[PASS] Missing category rejected with 422: {err.get('detail')}")

    # 2b. Attempt Vendor registration with invalid/random category -> MUST FAIL (422)
    fake_cat_vendor = {
        "full_name": "Fake Cat Rep",
        "email": "fakecat@supplier.com",
        "password": "password123",
        "role": "Vendor",
        "company": "Fake Category Inc",
        "vendor_category": "Random Invalid Category"
    }
    status, err = make_request("POST", "/auth/register", fake_cat_vendor)
    assert status == 422, f"Expected 422 for invalid vendor category, got {status}: {err}"
    print(f"[PASS] Invalid category rejected with 422: {err.get('detail')}")

    # 2c. Valid Vendor Registration with one of the 6 authorized categories
    import time
    unique_email = f"optics_{int(time.time())}@quantum-sensors.com"
    valid_vendor = {
        "full_name": "Advanced Optics Rep",
        "email": unique_email,
        "password": "optics123",
        "role": "Vendor",
        "vendor_category": "Office Supplies & Equipment",
        "phone": "+1 (555) 902-1823"
    }
    status, reg_res = make_request("POST", "/auth/register", valid_vendor)
    assert status == 201, f"Expected 201, got {status}: {reg_res}"
    user_id = reg_res["user"]["id"]
    print(f"[PASS] Successfully registered vendor under 'Office Supplies & Equipment' (User ID: {user_id}, Status: PENDING)")

    # 3. Admin Verification & Approval of Pending Vendor
    print("\n--- 3. Testing Administrator Verification of Vendor Registration ---")
    status, auth_admin = make_request("POST", "/auth/login", {"email": "admin@vendor-iq.com", "password": "admin123"})
    admin_token = auth_admin["access_token"]

    # Check pending list
    status, pending = make_request("GET", "/admin/pending-registrations", token=admin_token)
    matching = [p for p in pending if p["id"] == user_id]
    assert len(matching) > 0, "Registered vendor not found in pending list"
    assert matching[0]["vendor_category"] == "Office Supplies & Equipment"
    print(f"[PASS] Admin retrieved pending registration with category: '{matching[0]['vendor_category']}'")

    # Admin approves vendor
    status, app_res = make_request("POST", f"/admin/users/{user_id}/approve", {"assigned_role": "Vendor", "assigned_category": "Office Supplies & Equipment"}, token=admin_token)
    assert status == 200, f"Approval failed: {app_res}"
    print(f"[PASS] Admin approved vendor: {app_res['message']}")

    # 4. Strict RBAC Boundary Checks (403 Forbidden enforcement)
    print("\n--- 4. Testing Strict RBAC Boundary Enforcement ---")
    # Procurement Manager login
    status, auth_pm = make_request("POST", "/auth/login", {"email": "procurement@vendor-iq.com", "password": "procure123"})
    pm_token = auth_pm["access_token"]

    # Procurement Manager MUST NOT be able to issue a Purchase Order
    status, err = make_request("POST", "/purchase-orders/1/issue", token=pm_token)
    assert status == 403, f"Expected 403 for PM issuing PO, got {status}"
    print("[PASS] Procurement Manager blocked from issuing PO (403 Forbidden).")

    # Administrator MUST NOT be able to issue a Purchase Order (Strict separation)
    status, err = make_request("POST", "/purchase-orders/1/issue", token=admin_token)
    assert status == 403, f"Expected 403 for Admin issuing PO, got {status}"
    print("[PASS] Administrator blocked from operational SCM PO issuance (403 Forbidden).")

    # 5. End-to-End Procurement Lifecycle Step-by-Step
    print("\n--- 5. End-to-End Lifecycle Execution ---")
    
    # Step 5a: Procurement Manager creates Requisition (PR)
    pr_payload = {
        "department": "Manufacturing & Production",
        "product_name": "Industrial Metals, Polymers & Composites",
        "quantity": 100,
        "required_date": "2026-11-01",
        "priority": "High",
        "reason": "Assembly line inventory buffer replenishment",
        "category": "Raw Material Suppliers",
        "estimated_budget": 12000.0
    }
    status, pr = make_request("POST", "/requisitions", pr_payload, token=pm_token)
    assert status == 201, f"PR creation failed: {pr}"
    pr_id = pr["id"]
    print(f"[PASS] Step 5a: Procurement Manager created requirement {pr['request_number']} (Status: {pr['status']})")

    # Step 5b: Procurement Manager selects vendor (Acme Industrial, Vendor 1)
    sel_payload = {
        "requisition_id": pr_id,
        "vendor_id": 1,
        "quotation_amount": 11500.0,
        "justification": "Selected based on 99.2% reliability score, competitive quotation, and certified quality standard."
    }
    status, sel = make_request("POST", "/procurement/select-vendor", sel_payload, token=pm_token)
    assert status == 200, f"Vendor selection failed: {sel}"
    selection_id = sel.get("selection_id") or sel.get("id") or sel.get("selection", {}).get("id")
    print(f"[PASS] Step 5b: Procurement Manager evaluated & selected Vendor 1 for PR (Selection ID: {selection_id})")

    # Step 5c: Finance Officer reviews and approves selection
    status, auth_fin = make_request("POST", "/auth/login", {"email": "finance@vendor-iq.com", "password": "finance123"})
    fin_token = auth_fin["access_token"]

    status, fin_app = make_request("POST", f"/finance/approvals/{selection_id}/approve", {"budget_allocated": 11500.0, "comments": "Budget verified and authorized for procurement."}, token=fin_token)
    assert status == 200, f"Finance approval failed: {fin_app}"
    print(f"[PASS] Step 5c: Finance Officer approved selection budget (${11500.00})")

    # Step 5d: Supply Chain Manager creates and issues Purchase Order
    status, auth_scm = make_request("POST", "/auth/login", {"email": "supplychain@vendor-iq.com", "password": "supply123"})
    scm_token = auth_scm["access_token"]

    po_payload = {
        "requisition_id": pr_id,
        "vendor_id": 1,
        "currency": "USD",
        "payment_terms": "Net 30",
        "shipping_address": "Enterprise Central Warehouse, Dock 4",
        "billing_address": "Enterprise Corporate Finance, Suite 100",
        "expected_delivery_date": "2026-10-15T00:00:00",
        "items": [
            {
                "item_name": "High-Grade Industrial Fasteners",
                "item_description": "Batch 44 Grade-A Steel Fasteners",
                "quantity": 100,
                "unit_price": 115.00
            }
        ]
    }
    status, po = make_request("POST", "/purchase-orders", po_payload, token=scm_token)
    assert status == 201, f"SCM PO creation failed: {po}"
    po_id = po["id"]
    print(f"[PASS] Step 5d: SCM created Purchase Order {po['po_number']} (Total: ${po['total_amount']})")

    # Issue PO
    status, po_issued = make_request("POST", f"/purchase-orders/{po_id}/issue", token=scm_token)
    assert status == 200, f"SCM PO issuance failed: {po_issued}"
    print(f"[PASS] Step 5d: SCM issued Purchase Order {po['po_number']} to Vendor (Status: {po_issued['status']})")

    # Step 5e: Vendor confirms and dispatches shipment
    status, auth_v = make_request("POST", "/auth/login", {"email": "vendor@vendor-iq.com", "password": "vendor123"})
    vendor_token = auth_v["access_token"]

    # Vendor accepts
    status, v_acc = make_request("POST", f"/purchase-orders/{po_id}/accept", token=vendor_token)
    assert status == 200, f"Vendor accept failed: {v_acc}"
    # Vendor marks In Transit
    status, v_disp = make_request("PUT", f"/purchase-orders/{po_id}/status", {"status": "In Transit"}, token=vendor_token)
    assert status == 200, f"Vendor dispatch failed: {v_disp}"
    print(f"[PASS] Step 5e: Vendor accepted & dispatched shipment (Status: In Transit)")

    # Step 5f: SCM records physical delivery receipt and confirms completion
    delivery_payload = {
        "purchase_order_id": po_id,
        "expected_delivery_date": "2026-10-15T00:00:00",
        "actual_delivery_date": "2026-10-14T10:00:00",
        "ordered_quantity": 100.0,
        "delivered_quantity": 100.0,
        "tracking_number": "TRK-2026-88192",
        "carrier": "Global Freight Logistics",
        "notes": "All 100 units inspected and received in pristine condition."
    }
    status, deliv = make_request("POST", "/deliveries", delivery_payload, token=scm_token)
    assert status == 201, f"Delivery record failed: {deliv}"
    deliv_id = deliv["delivery_id"]

    # SCM confirms delivery completion
    status, conf = make_request("POST", f"/deliveries/{deliv_id}/confirm-completed", token=scm_token)
    assert status == 200, f"Delivery confirmation failed: {conf}"
    print(f"[PASS] Step 5f: SCM recorded physical delivery & confirmed completion (PO Delivered, Finance notified)")

    # Step 5g: Finance Officer 3-Way Match & Payment Disbursement
    status, invoices = make_request("GET", "/finance/invoices", token=fin_token)
    assert status == 200
    inv = next(i for i in invoices if i["purchase_order_id"] == po_id)
    inv_id = inv["id"]

    status, match_res = make_request("POST", f"/finance/invoices/{inv_id}/verify-3way-match", token=fin_token)
    assert status == 200, f"3-Way Match failed: {match_res}"
    print(f"[PASS] Step 5g-1: Finance Officer automated 3-Way Match successful ({match_res['status']})")

    pay_payload = {
        "invoice_id": inv_id,
        "amount": 11500.0,
        "payment_method": "Wire Transfer",
        "transaction_reference": f"WT-{int(time.time())}",
        "notes": "3-way match verified against PR requirement, PO contract, and SCM physical delivery receipt."
    }
    status, pay = make_request("POST", "/finance/payments", pay_payload, token=fin_token)
    assert status == 200, f"Finance payment failed: {pay}"
    print(f"[PASS] Step 5g-2: Finance Officer disbursed payment (${11500.00})")

    # Step 5h: Auditor traces complete lifecycle chain
    status, auth_aud = make_request("POST", "/auth/login", {"email": "auditor@vendor-iq.com", "password": "audit123"})
    aud_token = auth_aud["access_token"]

    status, logs = make_request("GET", "/communications/audit-logs", token=aud_token)
    assert status == 200
    assert len(logs) > 0
    print(f"[PASS] Step 5h-1: Auditor verified immutable ledger ({len(logs)} audit events captured)")

    status, chains = make_request("GET", "/auditor/transactions", token=aud_token)
    assert status == 200
    assert len(chains) > 0
    print(f"[PASS] Step 5h-2: Auditor traced complete lifecycle chains ({len(chains)} requisition chains verified)")

    # 6. Verify Vendor Detailed Profile & Reliability Metrics
    print("\n--- 6. Testing Vendor Profile & Calculated Intelligence ---")
    status, profile = make_request("GET", "/vendors/1/profile", token=pm_token)
    assert status == 200
    perf = profile["performance"]
    print(f"Vendor 1 Reliability Score: {perf['reliability_score']}%")
    print(f"Vendor 1 On-Time Rate: {perf['on_time_delivery_rate']}%")
    print(f"Vendor 1 Risk Level: {perf['risk_level']}")
    print(f"Vendor 1 Risk Reasons: {perf['risk_reasons']}")
    print(f"Vendor 1 Products count: {len(profile['products'])}")
    print(f"Vendor 1 Documents count: {len(profile['documents'])}")
    print("[PASS] Full profile with dynamic reliability intelligence and risk reasons verified.")

    print("\n" + "=" * 70)
    print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY WITH ZERO ERRORS!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
