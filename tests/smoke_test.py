"""End-to-end smoke test for Milestone 1 & 2 backend features.

Run the API first, then:  python tests/smoke_test.py
"""

import json
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

BASE = "http://127.0.0.1:8000"
PASSWORD = "VendorIQ@2026"

passed = 0
failed = 0
failures: list[str] = []


def call(method, path, body=None, token=None, expect=None):
    request = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None
    )

    if body is not None:
        request.add_header("Content-Type", "application/json")

    if token:
        request.add_header("Authorization", f"Bearer {token}")

    try:
        with urllib.request.urlopen(request) as response:
            status = response.status
            payload = json.loads(response.read() or b"null")
    except urllib.error.HTTPError as error:
        status = error.code
        raw = error.read()
        try:
            payload = json.loads(raw or b"null")
        except json.JSONDecodeError:
            payload = {"raw": raw.decode(errors="replace")}

    return status, payload


def check(name, condition, detail=""):
    global passed, failed

    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        failures.append(f"{name} :: {detail}")
        print(f"  FAIL  {name}  -> {detail}")


def login(email):
    status, data = call("POST", "/auth/login", {"email": email, "password": PASSWORD})
    assert status == 200, f"login failed for {email}: {status} {data}"
    return data["access_token"], data["user"]


def section(title):
    print(f"\n=== {title} ===")


# =========================================================
# 1. AUTHENTICATION & RBAC
# =========================================================

section("Authentication")

status, data = call("GET", "/health")
check("health endpoint responds", status == 200 and data["status"] == "healthy", str(data))

status, data = call("POST", "/auth/login", {
    "email": "admin@vendoriq.com", "password": "wrong-password"
})
check("bad password is rejected", status == 401, f"got {status}")

admin_token, admin_user = login("admin@vendoriq.com")
check("administrator can log in", admin_user["role"] == "Administrator", str(admin_user))

pm_token, pm_user = login("procurement@vendoriq.com")
scm_token, _ = login("supplychain@vendoriq.com")
fin_token, _ = login("finance@vendoriq.com")
aud_token, _ = login("auditor@vendoriq.com")
vendor_token, vendor_user = login("northwind@vendor.vendoriq.com")

check("vendor login is scoped to a vendor", vendor_user["vendor_id"] is not None, str(vendor_user))

status, data = call("GET", "/auth/me", token=pm_token)
check("profile returns the logged-in user", status == 200 and data["email"] == "procurement@vendoriq.com", str(data))

status, data = call("GET", "/vendors", token=None)
check("unauthenticated request is blocked", status == 401, f"got {status}")

status, data = call("GET", "/vendors", token="not-a-real-token")
check("garbage token is rejected", status == 401, f"got {status}")

section("Password reset flow")

status, data = call("POST", "/auth/forgot-password", {"email": "auditor@vendoriq.com"})
check("forgot-password issues a token", status == 200 and data.get("reset_token"), str(data))
reset_token = data.get("reset_token")

status, data = call("POST", "/auth/reset-password", {
    "token": "invalid-token", "new_password": "Whatever@2026"
})
check("invalid reset token is rejected", status == 400, f"got {status}")

status, data = call("POST", "/auth/reset-password", {
    "token": reset_token, "new_password": PASSWORD
})
check("valid reset token resets the password", status == 200, str(data))

status, data = call("POST", "/auth/reset-password", {
    "token": reset_token, "new_password": PASSWORD
})
check("reset token is single-use", status == 400, f"got {status}")

status, data = call("POST", "/auth/login", {
    "email": "auditor@vendoriq.com", "password": PASSWORD
})
check("login works after reset", status == 200, str(data))

section("Role-based access control")

status, data = call("GET", "/users", token=pm_token)
check("non-admin cannot list users", status == 403, f"got {status}")

status, data = call("GET", "/users", token=admin_token)
check("admin can list users", status == 200 and len(data) >= 8, str(status))

status, data = call("POST", "/vendors", {
    "vendor_name": "Unauthorised Co", "category": "IT Vendors"
}, token=aud_token)
check("auditor cannot create a vendor", status == 403, f"got {status}")

status, data = call("GET", "/communication/activity", token=aud_token)
check("auditor can read the activity log", status == 200, f"got {status}")


# =========================================================
# 2. VENDOR MANAGEMENT + APPROVAL WORKFLOW
# =========================================================

section("Vendor management")

status, data = call("GET", "/vendors", token=pm_token)
# Baseline counts, so the suite stays correct when re-run against a database
# that already holds records created by an earlier run.
VENDOR_BASELINE = len(data) if isinstance(data, list) else 0
check("vendor list loads", status == 200 and VENDOR_BASELINE >= 11, f"got {status}, {VENDOR_BASELINE}")

status, data = call("GET", "/vendors?category=IT%20Vendors", token=pm_token)
check("category filter works", status == 200 and all(v["category"] == "IT Vendors" for v in data), str(data))

status, data = call("GET", "/vendors?search=Northwind", token=pm_token)
check("search filter works", status == 200 and len(data) == 1, str(data))

status, data = call("GET", "/vendors/stats/summary", token=pm_token)
check("vendor stats aggregate", status == 200 and data["total"] == VENDOR_BASELINE and data["pending"] >= 2, str(data))

status, data = call("POST", "/vendors", {
    "vendor_name": "Aurora Components Ltd",
    "category": "Equipment Vendors",
    "contact_person": "Elena Petrova",
    "email": "sales@auroracomp.test",
    "phone": "+372 5555 0100",
    "city": "Tallinn",
    "country": "Estonia",
    "contacts": [
        {"name": "Elena Petrova", "designation": "Sales Lead",
         "email": "sales@auroracomp.test", "is_primary": True}
    ]
}, token=pm_token)
check("vendor registration succeeds", status == 201, str(data))
new_vendor_id = data.get("id")
check("new vendor starts as Pending", data.get("status") == "Pending", str(data.get("status")))
check("vendor code auto-generated", str(data.get("vendor_code", "")).startswith("VND-"), str(data.get("vendor_code")))
check("contact saved with the vendor", len(data.get("contacts", [])) == 1, str(data.get("contacts")))

status, data = call("POST", "/vendors", {
    "vendor_name": "Bad Category Co", "category": "Nonexistent Category"
}, token=pm_token)
check("invalid category is rejected", status == 422, f"got {status}")

status, data = call("GET", "/vendors/pending-approvals", token=pm_token)
check("pending approval queue includes the new vendor", any(v["id"] == new_vendor_id for v in data), str(status))

status, data = call("POST", f"/vendors/{new_vendor_id}/approve", {}, token=scm_token)
check("supply chain manager cannot approve vendors", status == 403, f"got {status}")

status, data = call("POST", f"/vendors/{new_vendor_id}/reject", {}, token=pm_token)
check("rejection without a reason is blocked", status == 400, f"got {status}")

status, data = call("POST", f"/vendors/{new_vendor_id}/approve", {
    "comments": "Documents verified"
}, token=pm_token)
check("procurement manager approves the vendor", status == 200 and data["status"] == "Approved", str(data))

status, data = call("POST", f"/vendors/{new_vendor_id}/approve", {}, token=pm_token)
check("double approval is blocked", status == 400, f"got {status}")

status, data = call("GET", f"/vendors/{new_vendor_id}/approvals", token=pm_token)
check("approval audit trail recorded", status == 200 and len(data) == 2, str(data))

status, data = call("POST", f"/vendors/{new_vendor_id}/suspend", {
    "reason": "Pending re-audit"
}, token=pm_token)
check("vendor can be suspended", status == 200 and data["status"] == "Suspended", str(data))

status, data = call("POST", f"/vendors/{new_vendor_id}/reactivate", {}, token=pm_token)
check("vendor can be reactivated", status == 200 and data["status"] == "Approved", str(data))

section("Vendor data isolation")

status, data = call("GET", "/vendors", token=vendor_token)
check("vendor login sees only its own record", status == 200 and len(data) == 1, str(data))

other_vendor = 2 if vendor_user["vendor_id"] != 2 else 3
status, data = call("GET", f"/vendors/{other_vendor}", token=vendor_token)
check("vendor login cannot read another vendor", status == 403, f"got {status}")


# =========================================================
# 3. PROCUREMENT WORKFLOW
# =========================================================

section("Procurement requests")

status, data = call("GET", "/procurement-requests", token=pm_token)
REQUEST_BASELINE = len(data) if isinstance(data, list) else 0
check("request list loads", status == 200 and REQUEST_BASELINE >= 10, f"got {REQUEST_BASELINE}")

status, data = call("GET", "/procurement-requests/stats/summary", token=pm_token)
check("procurement stats aggregate", status == 200 and data["total"] == REQUEST_BASELINE, str(data))

required = (date.today() + timedelta(days=45)).isoformat()

status, data = call("POST", "/procurement-requests", {
    "item": "Hydraulic press seals",
    "description": "Replacement seal kits for press line 2",
    "category": "Maintenance Vendors",
    "quantity": 60,
    "unit": "Kits",
    "estimated_cost": 7200,
    "required_date": required,
    "priority": "High",
    "department": "Maintenance"
}, token=scm_token)
check("procurement request created", status == 201, str(data))
request_id = data.get("id")
check("request number auto-generated", str(data.get("request_number", "")).startswith("PR-"), str(data.get("request_number")))
check("request starts as Pending", data.get("status") == "Pending", str(data.get("status")))

status, data = call("POST", "/procurement-requests", {
    "item": "Bad priority item", "quantity": 1, "priority": "Whenever"
}, token=pm_token)
check("invalid priority is rejected", status == 422, f"got {status}")

status, data = call("POST", "/procurement-requests", {
    "item": "Zero quantity item", "quantity": 0
}, token=pm_token)
check("zero quantity is rejected", status == 422, f"got {status}")

status, data = call("POST", f"/procurement-requests/{request_id}/approve", {},
                    token=scm_token)
check("supply chain manager cannot approve requests", status == 403, f"got {status}")

status, data = call("POST", f"/procurement-requests/{request_id}/assign-vendor", {
    "vendor_id": 11
}, token=pm_token)
check("rejected vendor cannot be assigned", status == 400, str(data))

status, data = call("POST", f"/procurement-requests/{request_id}/assign-vendor", {
    "vendor_id": 6
}, token=pm_token)
check("approved vendor can be assigned", status == 200 and data["assigned_vendor_id"] == 6, str(data))

status, data = call("POST", f"/procurement-requests/{request_id}/approve", {
    "comments": "Budget confirmed"
}, token=pm_token)
check("procurement manager approves the request", status == 200 and data["status"] == "Approved", str(data))

status, data = call("POST", f"/procurement-requests/{request_id}/approve", {},
                    token=pm_token)
check("re-approving an approved request is blocked", status == 400, f"got {status}")

status, data = call("GET", f"/procurement-requests/{request_id}", token=pm_token)
check("request detail exposes the approval trail", status == 200 and len(data["approvals"]) >= 3, str(status))


# =========================================================
# 4. PURCHASE ORDERS
# =========================================================

section("Purchase orders")

status, data = call("GET", "/purchase-orders", token=pm_token)
PO_BASELINE = len(data) if isinstance(data, list) else 0
check("purchase order list loads", status == 200 and PO_BASELINE >= 4, f"got {PO_BASELINE}")

status, data = call("GET", "/purchase-orders/stats/summary", token=pm_token)
check("purchase order stats aggregate", status == 200 and data["total"] == PO_BASELINE, str(data))

status, data = call("POST", "/purchase-orders", {
    "vendor_id": 10,
    "items": [{"item_name": "Test", "quantity": 1, "unit_price": 100}]
}, token=pm_token)
check("suspended vendor cannot receive a PO", status == 400, str(data))

expected = (date.today() + timedelta(days=30)).isoformat()

status, data = call("POST", "/purchase-orders", {
    "vendor_id": 6,
    "procurement_request_id": request_id,
    "title": "Hydraulic press seals",
    "expected_delivery": expected,
    "tax_amount": 576,
    "shipping_amount": 240,
    "payment_terms": "Net 30",
    "items": [
        {"item_name": "Seal kit A", "quantity": 40, "unit": "Kits", "unit_price": 120},
        {"item_name": "Seal kit B", "quantity": 20, "unit": "Kits", "unit_price": 114}
    ]
}, token=pm_token)
check("purchase order created from a request", status == 201, str(data))
po_id = data.get("id")
check("PO number auto-generated", str(data.get("po_number", "")).startswith("PO-"), str(data.get("po_number")))
check("subtotal computed from line items", str(data.get("subtotal")) == "7080.00", str(data.get("subtotal")))
check("total includes tax and shipping", str(data.get("total_amount")) == "7896.00", str(data.get("total_amount")))
check("two line items stored", len(data.get("items", [])) == 2, str(data.get("items")))

status, data = call("GET", f"/procurement-requests/{request_id}", token=pm_token)
check("request moves to Ordered when a PO is raised", data.get("status") == "Ordered", str(data.get("status")))

status, data = call("POST", "/purchase-orders", {
    "vendor_id": 6, "items": []
}, token=pm_token)
check("PO without line items is rejected", status == 422, f"got {status}")

section("Purchase order status transitions")

status, data = call("POST", f"/purchase-orders/{po_id}/status", {
    "status": "Delivered"
}, token=pm_token)
check("illegal transition Pending -> Delivered blocked", status == 400, str(data))

status, data = call("POST", f"/purchase-orders/{po_id}/status", {
    "status": "Approved"
}, token=pm_token)
check("Pending -> Approved allowed", status == 200 and data["status"] == "Approved", str(data))

status, data = call("POST", f"/purchase-orders/{po_id}/status", {
    "status": "Ordered"
}, token=pm_token)
check("Approved -> Ordered allowed", status == 200, str(data))

late = (date.today() + timedelta(days=37)).isoformat()
status, data = call("POST", f"/purchase-orders/{po_id}/status", {
    "status": "Delivered", "actual_delivery": late
}, token=pm_token)
check("Ordered -> Delivered allowed", status == 200, str(data))
check("late delivery is flagged", data.get("is_delayed") is True and data.get("days_late") == 7, str(data))

status, data = call("POST", f"/purchase-orders/{po_id}/status", {
    "status": "Completed"
}, token=pm_token)
check("Delivered -> Completed allowed", status == 200, str(data))

status, data = call("POST", f"/purchase-orders/{po_id}/status", {
    "status": "Ordered"
}, token=pm_token)
check("no transitions out of Completed", status == 400, f"got {status}")

status, data = call("GET", f"/procurement-requests/{request_id}", token=pm_token)
check("request closes when its PO completes", data.get("status") == "Completed", str(data.get("status")))

section("Invoices")

status, data = call("POST", f"/purchase-orders/{po_id}/invoices", {
    "amount": 7080, "tax_amount": 576
}, token=pm_token)
check("non-finance role cannot raise an invoice", status == 403, f"got {status}")

status, data = call("POST", f"/purchase-orders/{po_id}/invoices", {
    "amount": 7080, "tax_amount": 576,
    "due_date": (date.today() + timedelta(days=60)).isoformat()
}, token=fin_token)
check("finance officer raises an invoice", status == 201, str(data))
invoice_id = data.get("id")
check("invoice total computed", str(data.get("total_amount")) == "7656.00", str(data.get("total_amount")))

status, data = call("PUT", f"/invoices/{invoice_id}", {"status": "Paid"}, token=fin_token)
check("invoice can be marked paid", status == 200 and data["status"] == "Paid", str(data))
check("payment date stamped automatically", data.get("payment_date") is not None, str(data))

status, data = call("DELETE", f"/invoices/{invoice_id}", token=fin_token)
check("paid invoice cannot be deleted", status == 400, f"got {status}")

section("Purchase order data isolation")

status, data = call("GET", "/purchase-orders", token=vendor_token)
check("vendor sees only its own orders",
      status == 200 and all(o["vendor_id"] == vendor_user["vendor_id"] for o in data),
      str(data))


# =========================================================
# 5. CONTRACTS & COMPLIANCE
# =========================================================

section("Contracts and compliance")

status, data = call("GET", "/contracts", token=pm_token)
CONTRACT_BASELINE = len(data) if isinstance(data, list) else 0
check("contract list loads", status == 200 and CONTRACT_BASELINE >= 7, f"got {CONTRACT_BASELINE}")

status, data = call("GET", "/contracts/stats/summary", token=pm_token)
check("contract stats aggregate", status == 200 and data["total"] == CONTRACT_BASELINE, str(data))

status, data = call("GET", "/contracts/expiring?days=30", token=pm_token)
check("expiring contracts surfaced", status == 200 and len(data) >= 2, str(data))

start = date.today().isoformat()
end = (date.today() + timedelta(days=365)).isoformat()

status, data = call("POST", "/contracts", {
    "vendor_id": 6,
    "title": "Maintenance retainer 2026",
    "contract_type": "Maintenance Agreement",
    "start_date": start,
    "expiry_date": end,
    "contract_value": 148000,
    "status": "Active"
}, token=pm_token)
check("contract created", status == 201, str(data))
contract_id = data.get("id")
check("contract number auto-generated", str(data.get("contract_number", "")).startswith("CT-"), str(data.get("contract_number")))

status, data = call("POST", "/contracts", {
    "vendor_id": 6, "contract_type": "Supply Agreement",
    "start_date": end, "expiry_date": start
}, token=pm_token)
check("expiry before start is rejected", status == 422, f"got {status}")

status, data = call("POST", f"/contracts/{contract_id}/compliance", {
    "check_type": "Certification",
    "result": "Non-Compliant",
    "remarks": "ISO 45001 certificate lapsed"
}, token=scm_token)
check("compliance check recorded", status == 201, str(data))

status, data = call("GET", f"/contracts/{contract_id}", token=pm_token)
check("failed check flips contract to Non-Compliant",
      data.get("compliance_status") == "Non-Compliant", str(data.get("compliance_status")))

status, data = call("POST", f"/contracts/{contract_id}/compliance", {
    "check_type": "Certification", "result": "Compliant"
}, token=scm_token)
check("passing check restores Compliant", status == 201, str(data))

status, data = call("DELETE", f"/contracts/{contract_id}", token=pm_token)
check("active contract cannot be deleted", status == 400, f"got {status}")

renew_start = (date.today() + timedelta(days=366)).isoformat()
renew_end = (date.today() + timedelta(days=730)).isoformat()

status, data = call("POST", f"/contracts/{contract_id}/renew", {
    "start_date": renew_start, "expiry_date": renew_end, "contract_value": 155000
}, token=pm_token)
check("contract renewal creates a successor", status == 201, str(data))
check("successor links back to the original", data.get("renewed_from_id") == contract_id, str(data))

status, data = call("GET", f"/contracts/{contract_id}", token=pm_token)
check("original marked Renewed", data.get("status") == "Renewed", str(data.get("status")))

status, data = call("POST", "/contracts/run-expiry-scan", token=pm_token)
check("expiry scan runs", status == 200, str(data))

status, data = call("POST", "/contracts/certifications/vendor/6", {
    "certification_name": "ISO 45001 Occupational Health & Safety",
    "issuing_authority": "SGS",
    "issue_date": (date.today() - timedelta(days=30)).isoformat(),
    "expiry_date": (date.today() + timedelta(days=1000)).isoformat()
}, token=pm_token)
check("certification recorded", status == 201 and data["status"] == "Valid", str(data))


# =========================================================
# 6. COMMUNICATION
# =========================================================

section("Communication")

status, data = call("GET", "/communication/threads", token=pm_token)
check("thread list loads", status == 200 and len(data) >= 4, f"got {len(data) if isinstance(data, list) else data}")

status, data = call("POST", "/communication/threads", {
    "subject": "Seal kit delivery confirmation",
    "vendor_id": 6,
    "purchase_order_id": po_id,
    "priority": "High",
    "body": "Please confirm the dispatch date for the seal kits."
}, token=pm_token)
check("conversation created with a first message", status == 201 and len(data["messages"]) == 1, str(data))
thread_id = data.get("id")

status, data = call("POST", f"/communication/threads/{thread_id}/messages", {
    "body": "Confirmed - shipping Monday."
}, token=vendor_token)
check("vendor cannot post to another vendor's thread", status == 403, f"got {status}")

status, data = call("POST", f"/communication/threads/{thread_id}/messages", {
    "body": "Following up internally."
}, token=scm_token)
check("staff can reply on a thread", status == 201, str(data))

status, data = call("GET", f"/communication/threads/{thread_id}", token=pm_token)
check("thread detail returns both messages", status == 200 and len(data["messages"]) == 2, str(status))

status, data = call("PUT", f"/communication/threads/{thread_id}", {
    "status": "Closed"
}, token=pm_token)
check("thread can be closed", status == 200 and data["status"] == "Closed", str(data))

status, data = call("POST", f"/communication/threads/{thread_id}/messages", {
    "body": "One more thing"
}, token=pm_token)
check("closed thread rejects new messages", status == 400, f"got {status}")

status, data = call("GET", "/communication/threads", token=vendor_token)
check("vendor sees only its own conversations",
      status == 200 and all(t["vendor_id"] == vendor_user["vendor_id"] for t in data),
      str(data))

status, data = call("GET", "/communication/activity", token=pm_token)
check("activity log populated", status == 200 and len(data) > 10, f"got {len(data) if isinstance(data, list) else data}")


# =========================================================
# 7. NOTIFICATIONS & DASHBOARD
# =========================================================

section("Notifications")

status, data = call("GET", "/notifications", token=pm_token)
check("notifications delivered to the manager", status == 200 and len(data) > 0, str(status))
notification_id = data[0]["id"] if data else None

status, data = call("GET", "/notifications/summary", token=pm_token)
check("notification summary aggregates", status == 200 and data["total"] > 0, str(data))

if notification_id:
    status, data = call("POST", f"/notifications/{notification_id}/read", token=pm_token)
    check("notification marked read", status == 200 and data["is_read"] is True, str(data))

status, data = call("POST", "/notifications/read-all", token=pm_token)
check("mark-all-read works", status == 200, str(data))

status, data = call("GET", "/notifications?unread_only=true", token=pm_token)
check("no unread notifications remain", status == 200 and len(data) == 0, str(data))

section("Dashboard")

status, data = call("GET", "/dashboard/overview", token=pm_token)
check("dashboard overview loads", status == 200, str(status))
# Milestone 3 added the on-time delivery and average reliability cards, so
# the count is a floor rather than an exact figure.
check("dashboard returns headline cards", len(data.get("cards", [])) >= 8, str(len(data.get("cards", []))))
check("dashboard groups vendors by status", len(data.get("vendors_by_status", {})) > 0, str(data.get("vendors_by_status")))
check("dashboard reports top vendors by spend", len(data.get("top_vendors_by_spend", [])) > 0, str(data.get("top_vendors_by_spend")))

status, data = call("GET", "/dashboard/overview", token=vendor_token)
check("vendor dashboard is scoped", status == 200 and sum(data["vendors_by_status"].values()) == 1, str(data.get("vendors_by_status")))

# The activity feed must not leak other vendors' records to a supplier login.
vendor_activity = data.get("recent_activity", [])
own_vendor_name = vendor_user["name"]

_, own_orders = call("GET", "/purchase-orders", token=vendor_token)
own_po_numbers = {o["po_number"] for o in own_orders}

foreign_po_mentions = [
    entry for entry in vendor_activity
    if entry["entity_type"] == "PurchaseOrder"
    and entry.get("description")
    and not any(po in entry["description"] for po in own_po_numbers)
]

check(
    "vendor activity feed only covers its own entity types",
    all(
        e["entity_type"] in ("Vendor", "ProcurementRequest", "PurchaseOrder", "Contract")
        for e in vendor_activity
    ),
    str([e["entity_type"] for e in vendor_activity]),
)

check(
    "vendor activity feed does not mention other vendors' orders",
    len(foreign_po_mentions) == 0,
    str([e["description"] for e in foreign_po_mentions]),
)

_, staff_dash = call("GET", "/dashboard/overview", token=pm_token)
check(
    "staff activity feed is broader than the vendor's",
    len(staff_dash.get("recent_activity", [])) > len(vendor_activity),
    f"staff={len(staff_dash.get('recent_activity', []))} vendor={len(vendor_activity)}",
)


# =========================================================
# SUMMARY
# =========================================================

print(f"\n{'=' * 55}")
print(f"  {passed} passed, {failed} failed")
print(f"{'=' * 55}")

if failures:
    print("\nFailures:")
    for failure in failures:
        print(f"  - {failure}")

sys.exit(1 if failed else 0)
