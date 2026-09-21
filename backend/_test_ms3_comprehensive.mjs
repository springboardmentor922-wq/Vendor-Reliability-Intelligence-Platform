/**
 * ProcuraHub Milestone 3 Comprehensive Test Suite
 * Tests 6-role logins, Invoices, Communications, Audit Trails, and PDF Reports
 */
const BASE = "http://127.0.0.1:8001";
let pass = 0, fail = 0;

function check(desc, cond, extra = "") {
  if (cond) {
    console.log("  PASS " + desc);
    pass++;
  } else {
    console.log("  FAIL " + desc + (extra ? " -> " + extra : ""));
    fail++;
  }
}

async function api(path, method = "GET", body = null, token = null) {
  const headers = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { data = await res.json(); } catch (_) {}
  }
  return { status: res.status, headers: res.headers, data, res };
}

async function login(email, password) {
  const r = await api("/login", "POST", { email, password });
  if (r.status === 200 && r.data && r.data.access_token) return r.data.access_token;
  return null;
}

async function run() {
  console.log("Starting Milestone 3 Comprehensive Verification...\n");

  // 1. Verify 6 Role Logins
  const roles = [
    { email: "admin@example.com", name: "Admin" },
    { email: "procurement@example.com", name: "Procurement" },
    { email: "scm@example.com", name: "SCM" },
    { email: "vendor@example.com", name: "Vendor" },
    { email: "finance@example.com", name: "Finance" },
    { email: "auditor@example.com", name: "Auditor" },
  ];

  const tokens = {};
  for (const r of roles) {
    const tok = await login(r.email, "admin123");
    check(`Role login: ${r.name} (${r.email})`, !!tok);
    tokens[r.name] = tok;
  }

  const admin = tokens["Admin"];
  const procurement = tokens["Procurement"];
  const finance = tokens["Finance"];
  const vendor = tokens["Vendor"];
  const auditor = tokens["Auditor"];

  // 2. Test Purchase Order with Line Items Creation
  const poPayload = {
    vendor_id: 1,
    department: "Information Technology",
    payment_terms: "Net 30",
    shipping_address: "Tech Park Campus, Tower B",
    billing_address: "Finance HQ Suite 100",
    remarks: "MS3 Comprehensive Test Order",
    items: [
      { product_name: "Dell PowerEdge Server", quantity: 2, unit_price: 2500.0, tax_percent: 18 },
      { product_name: "10GbE Network Switch", quantity: 4, unit_price: 450.0, tax_percent: 18 }
    ]
  };
  const poRes = await api("/purchase-orders", "POST", poPayload, procurement);
  check("Create PO with Line Items (Procurement Manager)", poRes.status === 200 && poRes.data && poRes.data.id);
  const createdPoId = poRes.data ? poRes.data.id : null;

  if (createdPoId) {
    // Approve PO
    const appRes = await api(`/purchase-orders/${createdPoId}/approve`, "PUT", null, procurement);
    check("Approve PO (Procurement Manager)", appRes.status === 200 && appRes.data.status === "Approved");

    // Advance to Ordered
    const ordRes = await api(`/purchase-orders/${createdPoId}/status`, "PUT", { status: "Ordered" }, procurement);
    check("Advance PO to Ordered", ordRes.status === 200 && ordRes.data.status === "Ordered");

    // Advance to Delivered
    const delRes = await api(`/purchase-orders/${createdPoId}/status`, "PUT", { status: "Delivered" }, procurement);
    check("Advance PO to Delivered", delRes.status === 200 && delRes.data.status === "Delivered");
  }

  // 3. Test Invoices & Finance Endpoints
  const invPayload = {
    purchase_order_id: createdPoId || 1,
    vendor_id: 1,
    amount: 5000.0,
    tax_amount: 900.0,
    total_amount: 5900.0,
    due_date: "2026-10-15",
    notes: "Testing Net 30 Wire Transfer"
  };
  const invRes = await api("/api/invoices", "POST", invPayload, finance);
  check("Generate Invoice (Finance Officer)", invRes.status === 200 && invRes.data && invRes.data.id);
  const createdInvId = invRes.data ? invRes.data.id : null;

  // List Invoices
  const invList = await api("/api/invoices", "GET", null, finance);
  check("List Invoices (Finance Officer)", invList.status === 200 && Array.isArray(invList.data) && invList.data.length > 0);

  // Invoice Summary
  const invSum = await api("/api/invoices/summary", "GET", null, finance);
  check("Invoice Summary Aggregations", invSum.status === 200 && invSum.data.total_invoiced_amount > 0);

  // Settle Invoice to Paid
  if (createdInvId) {
    const payRes = await api(`/api/invoices/${createdInvId}/status`, "PUT", { status: "Paid" }, finance);
    check("Mark Invoice as Paid", payRes.status === 200 && payRes.data.status === "Paid");
  }

  // 4. Test Communications Module
  const msgPayload = {
    vendor_id: 1,
    subject: "Delivery Confirmation Inquiry",
    message_body: "Please confirm tracking details for the server shipment.",
    message_type: "Inquiry"
  };
  const msgRes = await api("/api/communications", "POST", msgPayload, procurement);
  check("Send Vendor Message (Procurement)", msgRes.status === 200 && msgRes.data && msgRes.data.id);

  // List Threads
  const threadsRes = await api("/api/communications/threads", "GET", null, procurement);
  check("List Vendor Threads", threadsRes.status === 200 && Array.isArray(threadsRes.data) && threadsRes.data.length > 0);

  // Get Messages by Vendor
  const msgsRes = await api("/api/communications?vendor_id=1", "GET", null, vendor);
  check("Get Vendor Messages (Vendor View)", msgsRes.status === 200 && Array.isArray(msgsRes.data));

  // 5. Test Audit Trail & Governance
  const auditList = await api("/api/audit-logs", "GET", null, auditor);
  check("List Audit Logs (Auditor Access)", auditList.status === 200 && Array.isArray(auditList.data) && auditList.data.length > 0);

  const auditSum = await api("/api/audit-logs/summary", "GET", null, auditor);
  check("Audit Summary Metrics", auditSum.status === 200 && auditSum.data.total_logs > 0);

  // 6. Test PDF Report Generation & Downloads
  const pdfReports = ["vendor-performance", "purchase-orders", "invoices", "audit-logs"];
  for (const rep of pdfReports) {
    const pdfRes = await api(`/api/reports/${rep}/pdf`, "GET", null, admin);
    const ct = pdfRes.headers.get("content-type") || "";
    check(`PDF Report Export: ${rep}`, pdfRes.status === 200 && ct.includes("application/pdf"));
  }

  console.log(`\n========================================`);
  console.log(`Comprehensive MS3 Results: ${pass} passed, ${fail} failed`);
  console.log(`========================================`);
  process.exit(fail ? 1 : 0);
}

run().catch(e => {
  console.error("Test error:", e);
  process.exit(1);
});
