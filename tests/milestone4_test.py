"""End-to-end test for the Milestone 4 additions.

Covers the chart-ready dashboards (Procurement / Vendor / Admin), the live
change-detection probe, system monitoring, the vendor application form, the
Create Purchase Order fields (per-line tax, billing address, department), the
month drill-down on purchase orders and the spreadsheet import (template,
preview, commit, row-level errors, post-import rescoring).

Run the API first, then:  python tests/milestone4_test.py

Uses only the standard library plus openpyxl (already a backend dependency)
to build test workbooks. Expectations are derived from live data, so the
suite is safe to re-run.
"""

import io
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta

BASE = "http://127.0.0.1:8000"
PASSWORD = "VendorIQ@2026"

passed = 0
failed = 0
failures: list[str] = []


# --------------------------------------------------------------------------
# HTTP helpers
# --------------------------------------------------------------------------

def _send(request):
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            content = response.read()
            ctype = response.headers.get("Content-Type", "")
            return response.status, (json.loads(content or b"null") if "json" in ctype else content)
    except urllib.error.HTTPError as error:
        content = error.read()
        try:
            return error.code, json.loads(content or b"null")
        except json.JSONDecodeError:
            return error.code, {"raw": content.decode(errors="replace")}


def call(method, path, body=None, token=None):
    request = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
    )
    if body is not None:
        request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    return _send(request)


def multipart(path, fields, files, token=None):
    """POST multipart/form-data. files: list of (field, filename, bytes, ctype)."""

    boundary = uuid.uuid4().hex
    body = io.BytesIO()
    for name, value in fields:
        body.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode())
    for name, filename, data, ctype in files:
        body.write(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{filename}\"\r\n"
            f"Content-Type: {ctype}\r\n\r\n".encode()
        )
        body.write(data)
        body.write(b"\r\n")
    body.write(f"--{boundary}--\r\n".encode())

    request = urllib.request.Request(BASE + path, method="POST", data=body.getvalue())
    request.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    return _send(request)


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
    status, body = call("POST", "/auth/login", {"email": email, "password": PASSWORD})
    if status != 200:
        print(f"Cannot log in as {email}: {status} {body}")
        sys.exit(1)
    return body["access_token"]


def section(title):
    print(f"\n== {title} " + "=" * max(4, 60 - len(title)))


# --------------------------------------------------------------------------
# Tests
# --------------------------------------------------------------------------

def main():
    admin = login("admin@vendoriq.com")
    procurement = login("procurement@vendoriq.com")
    finance = login("finance@vendoriq.com")
    vendor = login("northwind@vendor.vendoriq.com")
    suffix = uuid.uuid4().hex[:6].upper()

    # ------------------------------------------------------------------
    section("Procurement dashboard")
    started = time.perf_counter()
    status, d = call("GET", "/dashboards/procurement", token=procurement)
    elapsed = (time.perf_counter() - started) * 1000
    check("procurement dashboard loads", status == 200, status)
    keys = {k["key"] for k in d.get("kpis", [])}
    check("KPIs: POs, cost, active vendors, items procured",
          keys == {"total_purchase_orders", "total_procurement_cost", "active_vendors", "items_procured"}, keys)
    check("procurement overview has monthly cost + PO count",
          all({"period", "cost", "orders"} <= set(r) for r in d["procurement_overview"]["series"]) and d["procurement_overview"]["series"], "")
    slices = {s["label"] for s in d["active_purchase_orders"]["slices"]}
    check("active PO donut covers every status", {"Pending Approval", "Approved", "In Progress", "Delivered", "Cancelled"} <= slices, slices)
    radar = d["vendor_performance"]["radar"]
    check("radar has six factor axes", len(radar["axes"]) == 6 and len(radar["average"]) == 6, radar["axes"])
    check("radar top vendor is a ranked vendor", radar["top_vendor"] is not None, radar.get("top_vendor"))
    check("cost analysis split by category", len(d["cost_analysis"]["by_category"]) > 0, "")
    total_share = sum(c["share"] for c in d["cost_analysis"]["by_category"])
    check("category shares sum to ~100%", 99 <= total_share <= 101, total_share)
    ds = d["delivery_status"]
    check("delivery gauge rate matches on-time / delivered",
          ds["total_deliveries"] == 0 or abs(ds["on_time_rate"] - 100 * ds["on_time"] / ds["total_deliveries"]) < 0.1, ds)
    check("procurement dashboard under 1s", elapsed < 1000, f"{elapsed:.0f}ms")

    status, filtered = call("GET", "/dashboards/procurement?category=IT%20Vendors", token=procurement)
    check("category filter narrows cost analysis",
          status == 200 and all(c["category"] == "IT Vendors" for c in filtered["cost_analysis"]["by_category"]), "")
    start = (date.today() - timedelta(days=29)).isoformat()
    status, recent = call("GET", f"/dashboards/procurement?start={start}", token=procurement)
    check("date filter reduces the PO count",
          status == 200 and recent["kpis"][0]["value"] <= d["kpis"][0]["value"], "")

    # ------------------------------------------------------------------
    section("Vendor dashboard")
    status, v = call("GET", "/dashboards/vendor?vendor_id=5", token=vendor)
    check("vendor login is pinned to its own vendor", status == 200 and v["vendor"]["vendor_code"] == "VND-0001", v.get("vendor"))
    check("vendor sees own history, not peers", v["vendor_performance"]["mode"] == "months", v["vendor_performance"]["mode"])
    check("grouped bars carry four factor series", v["vendor_performance"]["series"] == ["Delivery", "Quality", "Communication", "Compliance"], "")
    check("reliability trend is populated", len(v["reliability"]["trend"]) > 0, "")
    check("contract status donut present", "slices" in v["contract_status"], "")
    check("order history has monthly value + count", all({"period", "value", "orders"} <= set(r) for r in v["order_history"]["series"]), "")
    check("communication activity donut present", len(v["communication"]["slices"]) >= 4, "")
    status, peer = call("GET", "/dashboards/vendor?vendor_id=5", token=procurement)
    check("staff can pick any vendor and compare peers",
          status == 200 and peer["vendor"]["id"] == 5 and peer["vendor_performance"]["mode"] == "peers", "")

    # ------------------------------------------------------------------
    section("Admin dashboard & monitoring")
    status, _ = call("GET", "/dashboards/admin", token=procurement)
    check("admin dashboard is admin-only", status == 403, status)
    status, a = call("GET", "/dashboards/admin", token=admin)
    check("admin dashboard loads", status == 200, status)
    check("user management by role", sum(s["value"] for s in a["user_management"]["slices"]) == a["user_management"]["total"], "")
    check("risk distribution Low/Medium/High/Critical", [r["label"] for r in a["vendor_analytics"]["risk"]] == ["Low", "Medium", "High", "Critical"], "")
    check("compliance donut classifies vendors", sum(s["value"] for s in a["compliance"]["slices"]) > 0, "")
    sysd = a["system"]
    check("system stats are measured", sysd["database_bytes"] > 0 and sysd["uptime_seconds"] >= 0 and sysd["active_sessions"] >= 1, sysd.get("active_sessions"))
    status, live_sys = call("GET", "/dashboards/system", token=admin)
    check("system monitor endpoint", status == 200 and "latency_series" in live_sys and len(live_sys["latency_series"]) == 15, status)

    # ------------------------------------------------------------------
    section("Live change detection")
    status, first = call("GET", "/dashboards/live", token=procurement)
    check("live probe responds", status == 200 and first["version"], status)
    status, again = call("GET", "/dashboards/live", token=procurement)
    check("version is stable when nothing changes", again["version"] == first["version"], "")

    # ------------------------------------------------------------------
    section("Create Purchase Order fields")
    status, vendors = call("GET", "/vendors?status=Approved", token=procurement)
    target = vendors[0]
    payload = {
        "vendor_id": target["id"],
        "title": f"M4 test order {suffix}",
        "department": "Information Technology",
        "order_date": date.today().isoformat(),
        "expected_delivery": (date.today() + timedelta(days=10)).isoformat(),
        "payment_terms": "Net 30",
        "shipping_address": "Plant 2, Hyderabad",
        "billing_address": "Head Office, Hyderabad",
        "shipping_amount": 50,
        "items": [
            {"item_name": "Laptop", "quantity": 10, "unit": "Units", "unit_price": 765, "tax_rate": 18},
            {"item_name": "Mouse", "quantity": 10, "unit": "Units", "unit_price": 14, "tax_rate": 18},
        ],
    }
    status, po = call("POST", "/purchase-orders", payload, token=procurement)
    check("PO with per-line tax created", status == 201, po)
    if status == 201:
        check("subtotal = sum of lines", float(po["subtotal"]) == 7790.0, po["subtotal"])
        check("tax computed from line rates", abs(float(po["tax_amount"]) - 1402.2) < 0.01, po["tax_amount"])
        check("total = subtotal + tax + shipping", abs(float(po["total_amount"]) - 9242.2) < 0.01, po["total_amount"])
        check("billing address + department stored", po.get("billing_address") == "Head Office, Hyderabad" and po.get("department") == "Information Technology", "")
    status, second = call("GET", "/dashboards/live", token=procurement)
    check("live version changes after a new PO", second["version"] != first["version"], "")

    month = date.today().strftime("%Y-%m")
    status, month_orders = call("GET", f"/purchase-orders?month={month}", token=procurement)
    check("month drill-down returns only that month",
          status == 200 and month_orders and all(o["order_date"].startswith(month) for o in month_orders), status)

    # ------------------------------------------------------------------
    section("Vendor application form")
    status, opts = call("GET", "/vendor-applications/options")
    check("application options are public", status == 200 and len(opts["categories"]) == 6, status)
    app = {
        "vendor_name": f"Test Applicant {suffix}",
        "company_type": "Private Limited",
        "registration_number": f"U{suffix}TEST",
        "tax_id": f"36TEST{suffix}",
        "category": "IT Vendors",
        "products_services": "Laptops and servers",
        "email": "sales@applicantdemo.in",
        "phone": "+91 40 1234 5678",
        "address": "1 Test Road",
        "city": "Hyderabad",
        "country": "India",
        "contacts": [{"name": "Ravi Test", "designation": "Director", "is_primary": True}],
        "certifications": [{"certification_name": "ISO 27001", "expiry_date": "2028-01-01"}],
        "account_email": f"portal-{suffix.lower()}@applicantdemo.in",
        "account_password": "Applicant@2026",
        "declaration_accepted": True,
    }
    status, res = multipart(
        "/vendor-applications",
        [("payload", json.dumps(app)), ("document_types", "Company Profile")],
        [("files", "profile.pdf", b"%PDF-1.4 test", "application/pdf")],
    )
    check("public application accepted", status == 201, res)
    if status == 201:
        check("application lands as Pending", res["status"] == "Pending", res["status"])
        check("document + certification recorded", res["documents_received"] == 1 and res["certifications_recorded"] == 1, res)
        check("portal login issued", res["account_created"] and res["access_token"], "")
        status, detail = call("GET", f"/vendors/{res['vendor_id']}", token=admin)
        check("vendor profile exposes documents", status == 200 and len(detail.get("documents", [])) == 1, "")
        status, dash = call("GET", "/dashboards/vendor", token=res["access_token"])
        check("applicant sees own (pending) vendor dashboard", status == 200 and dash["vendor"]["status"] == "Pending", status)
    status, dup = multipart("/vendor-applications", [("payload", json.dumps(app))], [])
    check("duplicate application rejected", status == 409, status)
    bad = dict(app, vendor_name=f"Other {suffix}", registration_number=None, tax_id=None, declaration_accepted=False)
    status, _ = multipart("/vendor-applications", [("payload", json.dumps(bad))], [])
    check("declaration is mandatory", status == 422, status)

    # ------------------------------------------------------------------
    section("Spreadsheet import")
    status, blob = call("GET", "/data-import/template", token=finance)
    check("finance cannot import", status == 403, status)
    status, blob = call("GET", "/data-import/template", token=procurement)
    check("template downloads as xlsx", status == 200 and isinstance(blob, bytes) and blob[:2] == b"PK", status)

    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Supplier Master"
    ws.append(["Supplier Name", "Vendor Category", "Email", "Status"])
    ws.append([f"Import Vendor {suffix}", "logistics", "ops@importdemo.in", "Approved"])
    ws.append(["", "IT", "x@y.z", ""])  # missing name -> row error
    orders = wb.create_sheet("Orders")
    orders.append(["PO No", "Supplier", "PO Date", "Delivery Date", "Received On", "Item", "Qty", "Price", "GST", "Quality"])
    orders.append([f"IMP-{suffix}-1", f"Import Vendor {suffix}", "2026-08-01", "2026-08-10", "2026-08-09", "Freight", 2, 500, 18, 4.5])
    orders.append([f"IMP-{suffix}-1", f"Import Vendor {suffix}", "2026-08-01", "2026-08-10", "2026-08-09", "Handling", 1, 100, 18, 4.5])
    orders.append([f"IMP-{suffix}-2", "Nobody Ltd", "2026-08-01", "2026-08-10", "", "X", 1, 1, 0, ""])
    buffer = io.BytesIO()
    wb.save(buffer)

    status, preview = multipart(
        "/data-import/preview", [],
        [("file", "m4.xlsx", buffer.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")],
        token=procurement,
    )
    check("preview succeeds", status == 200, preview)
    if status == 200:
        entities = {s["sheet"]: s["entity"] for s in preview["sheets"]}
        check("sheets matched loosely", entities == {"Supplier Master": "vendors", "Orders": "purchase_orders"}, entities)
        check("column aliases mapped", preview["sheets"][1]["mapped_columns"].get("tax_rate") == "GST", preview["sheets"][1]["mapped_columns"])
        check("row errors reported with row numbers", {e["row"] for e in preview["errors"]} == {3, 4}, preview["errors"])
        status, still = call("GET", f"/vendors?search=Import%20Vendor%20{suffix}", token=procurement)
        check("preview writes nothing", status == 200 and still == [], still)

        status, done = call("POST", "/data-import/commit", {"token": preview["token"]}, token=procurement)
        check("commit succeeds", status == 200 and done["committed"], done)
        check("post-import rescoring ran", done.get("post_processing", {}).get("vendors_rescored", 0) > 0, done.get("post_processing"))
        status, found = call("GET", f"/purchase-orders?search=IMP-{suffix}-1", token=procurement)
        check("grouped rows became one PO with two lines", status == 200 and len(found) == 1, found)
        if found:
            status, full = call("GET", f"/purchase-orders/{found[0]['id']}", token=procurement)
            check("imported PO totals include GST", abs(float(full["total_amount"]) - 1298.0) < 0.01, full["total_amount"])
            check("delivered import is Completed", full["status"] == "Completed", full["status"])
        status, hist = call("GET", "/data-import/history", token=procurement)
        check("import recorded in history", status == 200 and hist and hist[0]["file_name"] == "m4.xlsx", "")
        status, reused = call("POST", "/data-import/commit", {"token": preview["token"]}, token=procurement)
        check("staged upload cannot be committed twice", status == 404, status)

    # ------------------------------------------------------------------
    print("\n" + "=" * 58)
    print(f"  {passed} passed, {failed} failed")
    print("=" * 58)
    for failure in failures:
        print("  -", failure)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
