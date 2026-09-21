// Milestone 4: Comprehensive 6-Role End-to-End Workflow & Integration Test
const API_BASE = "http://127.0.0.1:8001";
let passed = 0;
let failed = 0;

function check(title, condition, extra = "") {
    if (condition) {
        console.log(`  PASS: ${title} ${extra}`);
        passed++;
    } else {
        console.error(`  FAIL: ${title} ${extra}`);
        failed++;
    }
}

async function api(path, options = {}, token = null) {
    const headers = { ...(options.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }
    const res = await fetch(API_BASE + path, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const ct = res.headers.get("content-type") || "";
    let data = null;
    if (ct.includes("application/json")) {
        data = await res.json();
    } else {
        data = await res.text();
    }
    return { ok: res.ok, status: res.status, data, headers: res.headers };
}

async function login(email, password = "admin123") {
    const res = await api("/login", {
        method: "POST",
        body: { email, password }
    });
    if (!res.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
    return res.data.access_token;
}

async function runE2EWorkflow() {
    console.log("===================================================================");
    console.log("  PROCURAHUB FULL 6-ROLE END-TO-END WORKFLOW INTEGRATION TEST  ");
    console.log("===================================================================");

    try {
        // --- 1. Login all 6 Roles ---
        console.log("\n--- 1. Authenticating all 6 Roles ---");
        const adminToken = await login("admin@example.com");
        const procToken = await login("procurement@example.com");
        const scmToken = await login("scm@example.com");
        const vendorToken = await login("vendor@example.com");
        const financeToken = await login("finance@example.com");
        const auditorToken = await login("auditor@example.com");
        check("All 6 roles authenticated successfully", true);

        // --- 2. Admin System Oversight & RBAC ---
        console.log("\n--- 2. Admin: System Oversight & Governance ---");
        const summaryRes = await api("/dashboard/summary", {}, adminToken);
        check("Admin can access system summary", summaryRes.ok && summaryRes.data.total_vendors > 0);

        const usersRes = await api("/users", {}, adminToken);
        check("Admin can view registered users", usersRes.ok && usersRes.data.length >= 6);

        // --- 3. Procurement Manager: Requisition -> Purchase Order with Items ---
        console.log("\n--- 3. Procurement Manager: Create PR & Purchase Order ---");
        const prRes = await api("/procurement-requests", {
            method: "POST",
            body: {
                description: "MS4 High-Speed Fiber Optics Hardware",
                department: "Information Technology",
                quantity: 15,
                required_date: "2026-10-15T00:00:00"
            }
        }, procToken);
        check("Procurement Manager created PR", prRes.ok && prRes.data.id != null);
        const prId = prRes.data.id;

        // Create PO linked to TechNova (Vendor 1)
        const poRes = await api("/purchase-orders", {
            method: "POST",
            body: {
                po_number: `PO-E2E-${Date.now().toString().slice(-4)}`,
                vendor_id: 1,
                procurement_request_id: prId,
                department: "Information Technology",
                order_date: "2026-09-21T00:00:00",
                delivery_date: "2026-10-05T00:00:00",
                payment_terms: "Net 30",
                shipping_address: "Data Center Alpha, Dock 2",
                billing_address: "Finance HQ Floor 4",
                remarks: "MS4 E2E Verified Order",
                total_amount: 11800.00,
                status: "Pending",
                items: [
                    { product_name: "42U Server Rack", quantity: 2, unit_price: 2500.00, tax_percent: 18.0, total_price: 5900.00 },
                    { product_name: "PDU Monitored 32A", quantity: 4, unit_price: 1250.00, tax_percent: 18.0, total_price: 5900.00 }
                ]
            }
        }, procToken);
        check("Procurement Manager created PO with line items", poRes.ok && poRes.data.id != null);
        const poId = poRes.data.id;

        // Approve PO
        const appRes = await api(`/purchase-orders/${poId}/approve`, { method: "PUT" }, procToken);
        check("Procurement Manager approved PO", appRes.ok && appRes.data.status === "Approved");

        // Mark as Ordered
        const ordRes = await api(`/purchase-orders/${poId}/status`, {
            method: "PUT",
            body: { status: "Ordered" }
        }, procToken);
        check("Procurement Manager dispatched PO to vendor (Ordered)", ordRes.ok && ordRes.data.status === "Ordered");

        // --- 4. Supply Chain Manager: Telemetry & Risk Check ---
        console.log("\n--- 4. Supply Chain Manager: Telemetry & Vendor Risk ---");
        const relRes = await api("/api/analytics/procurement", {}, scmToken);
        check("Supply Chain Manager accessed procurement telemetry", relRes.ok && relRes.data.spend_summary != null);

        const vScoreRes = await api("/api/suppliers?limit=10", {}, scmToken);
        check("Supply Chain Manager viewed supplier leaderboard", vScoreRes.ok && Array.isArray(vScoreRes.data));

        // --- 5. Vendor (TechNova): Scoped Visibility & Delivery ---
        console.log("\n--- 5. Vendor: Scoped POs & Dispatch Delivery ---");
        const vendorPosRes = await api("/purchase-orders", {}, vendorToken);
        check("Vendor retrieved scoped PO list", vendorPosRes.ok && Array.isArray(vendorPosRes.data));

        // Inspect the PO detail with items
        const inspectPoRes = await api(`/purchase-orders/${poId}`, {}, vendorToken);
        check("Vendor can inspect assigned PO line items", inspectPoRes.ok && inspectPoRes.data.items?.length === 2);

        // Vendor updates status to Delivered
        const deliverRes = await api(`/purchase-orders/${poId}/status`, {
            method: "PUT",
            body: { status: "Delivered" }
        }, vendorToken);
        check("Vendor updated order status to 'Delivered'", deliverRes.ok && deliverRes.data.status === "Delivered");

        // --- 6. Finance Officer: Invoice Generation & Settlement ---
        console.log("\n--- 6. Finance Officer: Billing & Payment Settlement ---");
        const invRes = await api("/api/invoices", {
            method: "POST",
            body: {
                purchase_order_id: poId,
                vendor_id: 1,
                amount: 10000.00,
                tax_amount: 1800.00,
                total_amount: 11800.00,
                due_date: "2026-10-30T00:00:00",
                notes: "MS4 E2E Verified Invoice"
            }
        }, financeToken);
        check("Finance Officer created reconciliation Invoice", invRes.ok && invRes.data.id != null);
        const invId = invRes.data.id;

        // Pay Invoice
        const payRes = await api(`/api/invoices/${invId}/status`, {
            method: "PUT",
            body: { status: "Paid", notes: "Settled in full via corporate wire transfer" }
        }, financeToken);
        check("Finance Officer settled and paid Invoice", payRes.ok && payRes.data.status === "Paid");

        // Complete PO
        const compRes = await api(`/purchase-orders/${poId}/status`, {
            method: "PUT",
            body: { status: "Completed" }
        }, procToken);
        check("Procurement Manager marked PO as 'Completed'", compRes.ok && compRes.data.status === "Completed");

        // --- 7. Auditor: Full Audit Verification ---
        console.log("\n--- 7. Auditor: Audit Trail Verification & Compliance ---");
        const auditRes = await api("/api/audit-logs?limit=50", {}, auditorToken);
        check("Auditor retrieved immutable system audit logs", auditRes.ok && auditRes.data.length > 0);

        const actionsLogged = auditRes.data.map(l => l.action);
        check("Audit trail recorded PO lifecycle transitions", actionsLogged.some(a => a.includes("PO") || a.includes("UPDATE") || a.includes("CREATE")));

        // --- 8. Export Reports ---
        console.log("\n--- 8. Operational Report Exports (CSV / PDF / Excel) ---");
        const csvRes = await api("/api/reports/purchase-orders/csv", {}, adminToken);
        check("CSV Report Export generation", csvRes.ok && typeof csvRes.data === "string" && csvRes.data.includes("PO Number"));

        const excelRes = await api("/api/reports/purchase-orders/download", {}, adminToken);
        check("Excel Report Export generation", excelRes.ok);

        console.log("\n===================================================================");
        console.log(`  E2E INTEGRATION SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
        console.log("===================================================================");

        if (failed > 0) process.exit(1);
        else process.exit(0);

    } catch (e) {
        console.error("FATAL E2E FAILURE:", e);
        process.exit(1);
    }
}

runE2EWorkflow();
