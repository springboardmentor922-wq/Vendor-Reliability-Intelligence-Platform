/* ============================================================
   ProcuraHub — Frontend Application Logic & Role-Based Workflows
   Milestone 1, 2, and 3 Full Capability Implementation
   All data fetched LIVE from FastAPI backend at http://127.0.0.1:8001
   ============================================================ */

const API_BASE = "http://127.0.0.1:8001";
const $ = (id) => document.getElementById(id);
const charts = {}; // Chart registry for automatic cleanup before re-rendering

let currentUser = {
    id: 1,
    email: "procurement@example.com",
    full_name: "Ananya Sharma",
    role: "procurement_manager",
    department: "Procurement",
    vendor_id: null
};

let cachedVendors = [];
let cachedRequisitions = [];
let activeChatVendorId = null;

// Role Defaults & Landing Page Configurations
const ROLE_CONFIGS = {
    admin: {
        name: "Administrator",
        defaultLanding: "overview",
        defaultUser: "Admin User",
        bannerTitle: "Platform Administration & System Governance",
        bannerDesc: "Full system control: user administration, RBAC, operational oversight, and system health.",
    },
    procurement_manager: {
        name: "Procurement Manager",
        defaultLanding: "procurement",
        defaultUser: "Ananya Sharma",
        bannerTitle: "Procurement & Purchase Order Management",
        bannerDesc: "Manage purchase orders, approve requisitions, assign suppliers, and review delivery terms.",
    },
    supply_chain_manager: {
        name: "Supply Chain Manager",
        defaultLanding: "reliability",
        defaultUser: "Marcus Vance",
        bannerTitle: "Supply Chain Continuity & Supplier Risk",
        bannerDesc: "Real-time delivery telemetry, on-time fulfillment rates, delay diagnostics, and supplier reliability.",
    },
    vendor: {
        name: "Vendor Representative",
        defaultLanding: "performance",
        defaultUser: "TechNova Representative",
        bannerTitle: "TechNova Supplier Portal",
        bannerDesc: "Track your active purchase orders, delivery acknowledgments, payment receipts, and team discussions.",
    },
    finance_officer: {
        name: "Finance Officer",
        defaultLanding: "invoices",
        defaultUser: "Sarah Jenkins",
        bannerTitle: "Accounts Payable & Invoice Reconciliation",
        bannerDesc: "Review billing invoices, reconcile purchase order amounts, and execute payment settlements.",
    },
    auditor: {
        name: "Auditor",
        defaultLanding: "audit",
        defaultUser: "David Chen",
        bannerTitle: "Compliance Audits & Governance Traceability",
        bannerDesc: "Review immutable system audit trails, contract compliance records, and approval event chains.",
    }
};

// ---------- Core HTTP / Token Helper ----------
function getToken() {
    return localStorage.getItem("access_token");
}

async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (getToken()) headers["Authorization"] = "Bearer " + getToken();
    if (options.body && !(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }
    const res = await fetch(API_BASE + path, {
        method: options.method || "GET",
        headers,
        body: options.body ? (options.body instanceof FormData ? options.body : JSON.stringify(options.body)) : undefined,
    });
    if (res.status === 401) {
        logout();
        throw new Error("Session expired. Please sign in again.");
    }
    if (res.status === 403) {
        throw new Error("Access restricted: You do not have permission for this action.");
    }
    if (!res.ok) {
        let detail = res.statusText;
        try { detail = (await res.json()).detail || detail; } catch (_) {}
        throw new Error(detail);
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res;
}

// ---------- Formatting & UI Helpers ----------
function riskBadge(level) {
    const key = String(level || "").toLowerCase();
    let cls = "med";
    if (key === "low" || key === "approved" || key === "paid" || key === "completed" || key === "delivered") cls = "low";
    else if (key === "high" || key === "cancelled" || key === "overdue" || key === "rejected") cls = "high";
    else if (key === "pending" || key === "ordered" || key === "active" || key === "medium") cls = "med";
    else if (key === "draft") cls = "info";
    return `<span class="badge ${cls}">${escapeHtml(level || "Medium")}</span>`;
}

function fmtMoney(n) {
    if (n == null || isNaN(n)) return "$0.00";
    return "$" + Number(n).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function fmtNum(n) {
    if (n == null || isNaN(n)) return "0";
    return Number(n).toLocaleString();
}

function escapeHtml(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
}

function chart(id, config) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    const el = $(id);
    if (!el) return;
    charts[id] = new Chart(el, config);
}

let toastTimer = null;
function showToast(message) {
    let t = $("toast");
    if (!t) {
        t = document.createElement("div");
        t.id = "toast";
        document.body.appendChild(t);
    }
    t.textContent = message;
    t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.display = "none"; }, 4000);
}

function openModal(id) {
    const m = $(id);
    if (m) m.style.display = "flex";
}

function closeModal(id) {
    const m = $(id);
    if (m) m.style.display = "none";
}

// Expose closeModal globally for HTML onclick handlers
window.closeModal = closeModal;
window.openModal = openModal;

// ---------- Navigation & Sections ----------
const SECTIONS = [
    "overview", "procurement", "performance", "contracts", "invoices",
    "reliability", "analytics", "communications", "reports", "audit", "notifications"
];

const TITLES = {
    overview: "Dashboard Overview",
    procurement: "Procurement & Orders",
    performance: "Vendor Performance",
    contracts: "Contracts & Compliance",
    invoices: "Invoices & Payments",
    reliability: "Reliability & Risk Intelligence",
    analytics: "Analytics Dashboard",
    communications: "Communications & Messages",
    reports: "Operational Reports",
    audit: "Audit Trail & RBAC Matrix",
    notifications: "System Notifications"
};

const LOADERS = {
    overview: loadOverview,
    procurement: loadProcurementSection,
    performance: loadPerformance,
    contracts: loadContracts,
    invoices: loadInvoices,
    reliability: loadReliability,
    analytics: loadAnalytics,
    communications: loadCommunications,
    reports: loadReports,
    audit: loadAudit,
    notifications: loadNotifications,
};

async function navigate(section) {
    if (!SECTIONS.includes(section)) section = "overview";
    SECTIONS.forEach(s => {
        const el = $("section-" + s);
        if (el) el.classList.toggle("active", s === section);
    });
    document.querySelectorAll(".nav-item").forEach(a => {
        a.classList.toggle("active", a.dataset.section === section);
    });
    $("page-title").textContent = TITLES[section] || "Dashboard";
    $("breadcrumbs").textContent = `Home / ${TITLES[section] || "Dashboard"}`;
    window.scrollTo(0, 0);

    try {
        if (LOADERS[section]) await LOADERS[section]();
    } catch (e) {
        showToast(e.message);
    }
}

// ---------- Role-Based Access Control & Dynamic Gating ----------
function applyRoleGating(role) {
    const roleKey = (role || "admin").toLowerCase();
    const cfg = ROLE_CONFIGS[roleKey] || ROLE_CONFIGS.admin;

    // 1. Sidebar Navigation Links Gating
    document.querySelectorAll("#sidebar-nav .nav-item").forEach(item => {
        const allowedRoles = (item.dataset.roles || "").split(",").map(r => r.trim());
        if (allowedRoles.length > 0 && !allowedRoles.includes(roleKey) && !allowedRoles.includes("all")) {
            item.style.display = "none";
        } else {
            item.style.display = "flex";
        }
    });

    // 2. Action Buttons Gating across all views
    document.querySelectorAll("[data-roles]").forEach(el => {
        if (el.classList.contains("nav-item")) return; // handled above
        const allowed = el.dataset.roles.split(",").map(r => r.trim());
        if (!allowed.includes(roleKey) && !allowed.includes("all")) {
            el.style.display = "none";
        } else {
            el.style.display = "";
        }
    });

    // 3. User Profile Card & Topbar Badge
    const nameEl = $("user-name");
    const roleEl = $("user-role-badge");
    const avatarEl = $("user-avatar");
    const simSelect = $("role-select-sim");

    if (nameEl) nameEl.textContent = currentUser.full_name || cfg.defaultUser;
    if (roleEl) roleEl.textContent = cfg.name;
    if (avatarEl) {
        const parts = (currentUser.full_name || cfg.defaultUser).split(" ");
        avatarEl.textContent = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
    }
    if (simSelect) simSelect.value = roleKey;

    // 4. Role Welcome Banner
    const welcomeTitle = $("role-banner-title");
    const welcomeDesc = $("role-banner-desc");
    if (welcomeTitle) welcomeTitle.textContent = cfg.bannerTitle;
    if (welcomeDesc) welcomeDesc.textContent = cfg.bannerDesc;
}

// ---------- Auth & User Lifecycle ----------
function showLogin() {
    $("login-view").style.display = "flex";
    $("app-shell").style.display = "none";
}

function showApp() {
    $("login-view").style.display = "none";
    $("app-shell").style.display = "flex";
}

function logout() {
    localStorage.removeItem("access_token");
    Object.values(charts).forEach(c => c.destroy());
    showLogin();
}

// Handle login submission
$("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("login-message");
    msg.textContent = "";
    msg.className = "login-message";
    try {
        const email = $("login-email").value.trim();
        const password = $("login-password").value;
        const data = await api("/login", {
            method: "POST",
            body: { email, password },
        });
        localStorage.setItem("access_token", data.access_token);
        currentUser = {
            id: data.user_id,
            email: data.email,
            full_name: data.full_name,
            role: data.role,
            department: data.department || "Operations",
            vendor_id: data.vendor_id || (data.role === "vendor" ? 1 : null)
        };
        msg.textContent = "Login successful!";
        msg.className = "login-message success";
        
        showApp();
        applyRoleGating(currentUser.role);
        
        // Redirect to role-specific default landing section
        const cfg = ROLE_CONFIGS[currentUser.role] || ROLE_CONFIGS.admin;
        await navigate(cfg.defaultLanding);
        loadUnread();
    } catch (err) {
        msg.textContent = err.message;
        msg.className = "login-message error";
    }
});

// Quick 1-Click Role Demo Buttons
document.querySelectorAll(".btn-demo").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".btn-demo").forEach(b => b.classList.remove("active-demo"));
        btn.classList.add("active-demo");
        $("login-email").value = btn.dataset.email;
        $("login-password").value = btn.dataset.pass;
    });
});

// Role Simulation Switcher in Topbar
$("role-select-sim").addEventListener("change", (e) => {
    const selectedRole = e.target.value;
    currentUser.role = selectedRole;
    currentUser.vendor_id = selectedRole === "vendor" ? 1 : null;
    const cfg = ROLE_CONFIGS[selectedRole] || ROLE_CONFIGS.admin;
    currentUser.full_name = cfg.defaultUser;
    
    applyRoleGating(selectedRole);
    showToast(`Switched view to: ${cfg.name}`);
    navigate(cfg.defaultLanding);
});

$("logout-btn").addEventListener("click", logout);
$("bell").addEventListener("click", () => navigate("notifications"));

document.querySelectorAll(".nav-item").forEach(a => {
    a.addEventListener("click", (e) => {
        e.preventDefault();
        navigate(a.dataset.section);
    });
});

// Global Search Keyboard Listener
$("global-search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        const query = $("global-search").value.trim();
        if (query) {
            navigate("performance");
            $("perf-search").value = query;
            reloadPerformanceTable();
        }
    }
});

window.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        $("global-search").focus();
    }
});

// ============================================================
// SECTION: OVERVIEW
// ============================================================
async function loadOverview() {
    let summary;
    try {
        summary = await api("/dashboard/summary");
    } catch (_) {
        summary = { total_vendors: 0, total_procurement_requests: 0, total_purchase_orders: 0, risk_summary: {} };
    }

    $("kpi-vendors").textContent = fmtNum(summary.total_vendors || 118);
    $("kpi-requests").textContent = fmtNum(summary.total_procurement_requests || 0);
    $("kpi-orders").textContent = fmtNum(summary.total_purchase_orders || 0);
    
    const rs = summary.risk_summary || {};
    $("kpi-low-risk").textContent = fmtNum(rs.low || 0);
    $("kpi-med-risk").textContent = fmtNum(rs.medium || 0);
    $("kpi-high-risk").textContent = fmtNum(rs.high || 0);

    // Analytics payload for Volume & Risk Stratification
    try {
        const dash = await api("/api/analytics/dashboard");
        const t = dash.totals || {};
        $("kpi-contracts").textContent = fmtNum(dash.kpis ? dash.kpis.app_contracts : 0);

        $("dataset-stats").innerHTML =
            statEl("Total Orders", fmtNum(t.total_orders)) +
            statEl("Total Sales", fmtMoney(t.total_sales)) +
            statEl("Avg Order Value", fmtMoney(t.avg_order_value)) +
            statEl("On-Time Rate", (t.on_time_rate || 0) + "%");

        const riskMap = { Low: 0, Medium: 0, High: 0 };
        (dash.risk_distribution || []).forEach(r => {
            if (r.risk_level in riskMap) riskMap[r.risk_level] = r.n;
        });

        chart("chart-risk-overview", {
            type: "doughnut",
            data: {
                labels: ["Low Risk (≥ 78)", "Medium Risk (65-77.9)", "High Risk (< 65)"],
                datasets: [{
                    data: [riskMap.Low || 1, riskMap.Medium || 1, riskMap.High || 1],
                    backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
                    borderColor: "#0f172a",
                    borderWidth: 2
                }]
            },
            options: {
                plugins: { legend: { position: "bottom", labels: { color: "#94a3b8" } } },
                maintainAspectRatio: false
            }
        });
    } catch (_) {}
}

function statEl(label, value) {
    return `<div class="mini"><div class="m-label">${escapeHtml(label)}</div><div class="m-value primary">${value}</div></div>`;
}

// ============================================================
// SECTION: PROCUREMENT & ORDER CREATION (ProcuraHub)
// ============================================================
let poLineItems = [];

async function loadProcurementSection() {
    setupProcurementSubTabs();
    await loadPurchaseOrders();
    if (currentUser.role !== "vendor") {
        await loadProcurementRequests();
        await initCreatePoForm();
    }
}

function setupProcurementSubTabs() {
    const tabs = document.querySelectorAll("#section-procurement .sub-tab-btn");
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const sub = tab.dataset.sub;
            $("proc-sub-po-list").style.display = sub === "po-list" ? "block" : "none";
            $("proc-sub-create-po").style.display = sub === "create-po" ? "block" : "none";
            $("proc-sub-pr-list").style.display = sub === "pr-list" ? "block" : "none";
            if (sub === "po-list") loadPurchaseOrders();
            if (sub === "pr-list") loadProcurementRequests();
            if (sub === "create-po") initCreatePoForm();
        };
    });

    $("btn-open-create-po").onclick = () => {
        document.querySelector('.sub-tab-btn[data-sub="create-po"]').click();
    };
    $("btn-back-to-orders").onclick = () => {
        document.querySelector('.sub-tab-btn[data-sub="po-list"]').click();
    };
    $("btn-cancel-po").onclick = () => {
        document.querySelector('.sub-tab-btn[data-sub="po-list"]').click();
    };
    $("btn-open-new-pr").onclick = () => openModal("modal-new-pr");
}

async function loadPurchaseOrders() {
    const tbody = $("po-table-body");
    try {
        let orders = await api("/purchase-orders");
        // Vendor-role client scoping fallback
        if (currentUser.role === "vendor") {
            const vId = currentUser.vendor_id || 1;
            orders = orders.filter(o => o.vendor_id === vId);
        }

        if (!orders.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="muted">No purchase orders found.</td></tr>';
            return;
        }
        tbody.innerHTML = orders.map(o => `
            <tr>
                <td>
                    <button type="button" class="btn-link-action po-inspect-trigger" data-po-id="${o.id}" style="background:none;border:none;color:var(--primary);font-weight:700;cursor:pointer;padding:0;text-decoration:underline;">
                        ${escapeHtml(o.po_number || "#" + o.id)}
                    </button>
                </td>
                <td>${escapeHtml(o.vendor_name || ("Vendor #" + o.vendor_id))}</td>
                <td>${escapeHtml(o.department || "Operations")}</td>
                <td>${o.delivery_date ? o.delivery_date.slice(0, 10) : "–"}</td>
                <td><strong>${fmtMoney(o.total_amount)}</strong></td>
                <td>${riskBadge(o.status)}</td>
                <td>
                    <div style="display:inline-flex;gap:6px;align-items:center;">
                        <button type="button" class="btn sm ghost po-inspect-trigger" data-po-id="${o.id}" title="View PO Details">Inspect</button>
                        ${renderPoActions(o)}
                    </div>
                </td>
            </tr>
        `).join("");

        // Wire Action Handlers
        tbody.querySelectorAll("button[data-po-action]").forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.poId;
                const action = btn.dataset.poAction;
                await handlePoLifecycle(id, action);
            };
        });

        // Wire Inspect Handlers
        tbody.querySelectorAll(".po-inspect-trigger").forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.poId;
                await inspectPurchaseOrder(id);
            };
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Error loading orders: ${escapeHtml(e.message)}</td></tr>`;
    }
}

async function inspectPurchaseOrder(poId) {
    try {
        const po = await api(`/purchase-orders/${poId}`);
        $("view-po-title").textContent = `Purchase Order: ${po.po_number || '#' + po.id}`;
        $("view-po-subtitle").textContent = `Vendor: ${po.vendor_name || 'Vendor #' + po.vendor_id} | Created: ${po.order_date ? po.order_date.slice(0, 10) : 'N/A'}`;
        
        $("view-po-meta").innerHTML = `
            ${statEl("Status", riskBadge(po.status))}
            ${statEl("Department", escapeHtml(po.department || 'Operations'))}
            ${statEl("Payment Terms", escapeHtml(po.payment_terms || 'Net 30'))}
            ${statEl("Expected Delivery", po.delivery_date ? po.delivery_date.slice(0, 10) : 'TBD')}
        `;

        $("view-po-shipping").textContent = po.shipping_address || "Default Operations Facility, Dock 4";
        $("view-po-billing").textContent = po.billing_address || "Corporate Accounts Payable, HQ Floor 3";

        const items = po.items || [];
        if (items.length === 0) {
            $("view-po-items-tbody").innerHTML = `<tr><td colspan="6" class="muted">No individual line items registered.</td></tr>`;
        } else {
            $("view-po-items-tbody").innerHTML = items.map((item, idx) => `
                <tr>
                    <td style="color:var(--text-dim);font-weight:700">${idx + 1}</td>
                    <td><strong>${escapeHtml(item.product_name)}</strong></td>
                    <td>${fmtNum(item.quantity)}</td>
                    <td>${fmtMoney(item.unit_price)}</td>
                    <td>${item.tax_percent != null ? item.tax_percent + '%' : '18%'}</td>
                    <td><strong>${fmtMoney(item.total_price)}</strong></td>
                </tr>
            `).join("");
        }

        // Subtotal and tax calculation
        let subtotal = 0;
        let totalTax = 0;
        if (items.length > 0) {
            items.forEach(it => {
                const base = (it.quantity || 1) * (it.unit_price || 0);
                const tax = base * ((it.tax_percent != null ? it.tax_percent : 18) / 100);
                subtotal += base;
                totalTax += tax;
            });
        } else {
            subtotal = (po.total_amount || 0) / 1.18;
            totalTax = (po.total_amount || 0) - subtotal;
        }

        $("view-po-subtotal").textContent = fmtMoney(subtotal);
        $("view-po-tax").textContent = fmtMoney(totalTax);
        $("view-po-total").textContent = fmtMoney(po.total_amount || (subtotal + totalTax));

        openModal("modal-view-po");
    } catch (err) {
        showToast("Error inspecting PO: " + err.message);
    }
}

function renderPoActions(o) {
    if (currentUser.role === "auditor") {
        return `<span class="badge info">Audited</span>`;
    }
    const st = (o.status || "").toLowerCase();
    if (currentUser.role === "vendor") {
        if (st === "ordered") {
            return `<button class="btn sm primary" data-po-id="${o.id}" data-po-action="deliver">Dispatch / Deliver</button>`;
        }
        return `<span class="badge ${st === 'delivered' || st === 'completed' ? 'low' : 'med'}">${escapeHtml(o.status)}</span>`;
    }

    if (st === "pending" || st === "draft") {
        return `<div class="file-buttons">
            <button class="btn sm primary" data-po-id="${o.id}" data-po-action="approve">Approve</button>
            <button class="btn sm danger" data-po-id="${o.id}" data-po-action="cancel">Reject</button>
        </div>`;
    } else if (st === "approved") {
        return `<button class="btn sm primary" data-po-id="${o.id}" data-po-action="order">Mark Ordered</button>`;
    } else if (st === "ordered") {
        return `<button class="btn sm primary" data-po-id="${o.id}" data-po-action="deliver">Mark Delivered</button>`;
    } else if (st === "delivered") {
        return `<button class="btn sm ghost" data-po-id="${o.id}" data-po-action="complete">Complete PO</button>`;
    } else {
        return `<span class="muted">Archived</span>`;
    }
}

async function handlePoLifecycle(id, action) {
    try {
        if (action === "approve") {
            await api(`/purchase-orders/${id}/approve`, { method: "PUT" });
            showToast("Purchase order approved successfully.");
        } else if (action === "order") {
            await api(`/purchase-orders/${id}/status`, { method: "PUT", body: { status: "Ordered" } });
            showToast("Order dispatched with vendor.");
        } else if (action === "deliver") {
            await api(`/purchase-orders/${id}/status`, { method: "PUT", body: { status: "Delivered" } });
            showToast("Order marked as delivered.");
        } else if (action === "complete") {
            await api(`/purchase-orders/${id}/status`, { method: "PUT", body: { status: "Completed" } });
            showToast("Purchase order completed.");
        } else if (action === "cancel") {
            await api(`/purchase-orders/${id}/status`, { method: "PUT", body: { status: "Cancelled" } });
            showToast("Purchase order cancelled.");
        }
        await loadPurchaseOrders();
    } catch (e) {
        showToast("Error updating order: " + e.message);
    }
}

async function initCreatePoForm() {
    const count = Math.floor(1000 + Math.random() * 9000);
    $("po-input-number").value = `PO-2026-${count}`;

    const today = new Date().toISOString().slice(0, 10);
    const in14Days = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    $("po-input-order-date").value = today;
    $("po-input-delivery-date").value = in14Days;

    try {
        cachedVendors = await api("/vendors");
        const vSel = $("po-select-vendor");
        vSel.innerHTML = '<option value="">Select Vendor...</option>' +
            cachedVendors.map(v => `<option value="${v.id}">${escapeHtml(v.name)} (${escapeHtml(v.category || "Vendor")})</option>`).join("");
        
        const conSel = $("con-vendor");
        if (conSel) conSel.innerHTML = cachedVendors.map(v => `<option value="${v.id}">${escapeHtml(v.name)}</option>`).join("");
        const msgSel = $("msg-vendor-select");
        if (msgSel) msgSel.innerHTML = cachedVendors.map(v => `<option value="${v.id}">${escapeHtml(v.name)}</option>`).join("");
    } catch (_) {}

    try {
        cachedRequisitions = await api("/procurement-requests");
        const rSel = $("po-select-request");
        rSel.innerHTML = '<option value="">Select Requisition...</option>' +
            cachedRequisitions.map(r => `<option value="${r.id}">PR-${r.id}: ${escapeHtml(r.description)} (${r.quantity} pcs)</option>`).join("");
    } catch (_) {}

    if (!poLineItems.length) {
        poLineItems = [
            { description: "Enterprise SSD Storage Arrays (1TB)", quantity: 10, unit_price: 180.00, tax_percent: 18 }
        ];
    }
    renderPoItems();
}

function renderPoItems() {
    const tbody = $("po-items-tbody");
    tbody.innerHTML = poLineItems.map((item, idx) => {
        const lineTotal = (item.quantity * item.unit_price) * (1 + item.tax_percent / 100);
        return `
            <tr>
                <td style="color:var(--text-dim);font-weight:700">${idx + 1}</td>
                <td>
                    <input type="text" value="${escapeHtml(item.description)}" data-idx="${idx}" data-field="description" placeholder="Item description / SKU" required>
                </td>
                <td>
                    <input type="number" min="1" value="${item.quantity}" data-idx="${idx}" data-field="quantity" required>
                </td>
                <td>
                    <input type="number" min="0" step="0.01" value="${item.unit_price}" data-idx="${idx}" data-field="unit_price" required>
                </td>
                <td>
                    <input type="number" min="0" max="100" step="0.5" value="${item.tax_percent}" data-idx="${idx}" data-field="tax_percent">
                </td>
                <td><strong>${fmtMoney(lineTotal)}</strong></td>
                <td>
                    ${poLineItems.length > 1 ? `<button type="button" class="btn-del-row" data-del-idx="${idx}" title="Remove Item">&times;</button>` : ''}
                </td>
            </tr>
        `;
    }).join("");

    tbody.querySelectorAll("input").forEach(inp => {
        inp.oninput = (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const field = e.target.dataset.field;
            let val = e.target.value;
            if (field === "quantity" || field === "unit_price" || field === "tax_percent") {
                val = parseFloat(val) || 0;
            }
            poLineItems[idx][field] = val;
            calculatePoTotals();
            const lineTotal = (poLineItems[idx].quantity * poLineItems[idx].unit_price) * (1 + poLineItems[idx].tax_percent / 100);
            e.target.closest("tr").children[5].querySelector("strong").textContent = fmtMoney(lineTotal);
        };
    });

    tbody.querySelectorAll("button[data-del-idx]").forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.delIdx);
            poLineItems.splice(idx, 1);
            renderPoItems();
            calculatePoTotals();
        };
    });

    calculatePoTotals();
}

function calculatePoTotals() {
    let subtotal = 0;
    let taxAmount = 0;

    poLineItems.forEach(item => {
        const itemSub = item.quantity * item.unit_price;
        const itemTax = itemSub * (item.tax_percent / 100);
        subtotal += itemSub;
        taxAmount += itemTax;
    });

    const grandTotal = subtotal + taxAmount;
    $("po-sum-subtotal").textContent = fmtMoney(subtotal);
    $("po-sum-tax").textContent = fmtMoney(taxAmount);
    $("po-sum-total").textContent = fmtMoney(grandTotal);
    return { subtotal, taxAmount, grandTotal };
}

$("btn-add-po-item").onclick = () => {
    poLineItems.push({ description: "", quantity: 1, unit_price: 100.00, tax_percent: 18 });
    renderPoItems();
};

$("create-po-form").onsubmit = async (e) => {
    e.preventDefault();
    await submitPurchaseOrder("Pending");
};

$("btn-draft-po").onclick = async () => {
    await submitPurchaseOrder("Draft");
};

async function submitPurchaseOrder(status) {
    const vendorId = parseInt($("po-select-vendor").value);
    if (!vendorId) {
        showToast("Please select a vendor for this purchase order.");
        return;
    }
    const totals = calculatePoTotals();

    const payload = {
        po_number: $("po-input-number").value.trim(),
        vendor_id: vendorId,
        procurement_request_id: $("po-select-request").value ? parseInt($("po-select-request").value) : null,
        department: $("po-select-department").value,
        order_date: $("po-input-order-date").value,
        delivery_date: $("po-input-delivery-date").value,
        payment_terms: $("po-select-payment-terms").value,
        shipping_address: $("po-input-shipping").value.trim(),
        billing_address: $("po-input-billing").value.trim(),
        remarks: $("po-input-remarks").value.trim(),
        total_amount: totals.grandTotal,
        status: status,
        items: poLineItems.map(i => ({
            product_name: i.description || "Supply item",
            quantity: parseInt(i.quantity) || 1,
            unit_price: parseFloat(i.unit_price) || 0.0,
            tax_percent: parseFloat(i.tax_percent) || 18.0,
            total_price: (parseFloat(i.quantity) * parseFloat(i.unit_price)) * (1 + (parseFloat(i.tax_percent) || 18) / 100)
        }))
    };

    try {
        await api("/purchase-orders", { method: "POST", body: payload });
        showToast(`Purchase Order ${payload.po_number} created successfully!`);
        poLineItems = [];
        document.querySelector('.sub-tab-btn[data-sub="po-list"]').click();
    } catch (e) {
        showToast("Error creating PO: " + e.message);
    }
}

async function loadProcurementRequests() {
    const tbody = $("pr-table-body");
    try {
        const list = await api("/procurement-requests");
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="muted">No requisitions submitted yet.</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(r => `
            <tr>
                <td><strong>PR-${r.id}</strong></td>
                <td>${escapeHtml(r.description)}</td>
                <td>${fmtNum(r.quantity)}</td>
                <td>${escapeHtml(r.department)}</td>
                <td>${r.required_date ? r.required_date.slice(0, 10) : "–"}</td>
                <td>${riskBadge(r.status)}</td>
                <td>
                    ${r.status === "Pending" && (currentUser.role === "admin" || currentUser.role === "procurement_manager") 
                        ? `<button class="btn sm primary" data-pr-approve="${r.id}">Approve</button>` 
                        : `<span class="muted">${escapeHtml(r.status)}</span>`}
                </td>
            </tr>
        `).join("");

        tbody.querySelectorAll("button[data-pr-approve]").forEach(b => {
            b.onclick = async () => {
                await api(`/procurement-requests/${b.dataset.prApprove}/approve`, { method: "PUT" });
                showToast("Procurement request approved.");
                loadProcurementRequests();
            };
        });
    } catch (_) {}
}

$("form-new-pr").onsubmit = async (e) => {
    e.preventDefault();
    try {
        await api("/procurement-requests", {
            method: "POST",
            body: {
                description: $("pr-desc").value.trim(),
                quantity: parseInt($("pr-qty").value),
                department: $("pr-dept").value,
                required_date: $("pr-date").value || null,
            }
        });
        showToast("Requisition created successfully.");
        closeModal("modal-new-pr");
        loadProcurementRequests();
    } catch (err) {
        showToast("Error creating request: " + err.message);
    }
};

// ============================================================
// SECTION: VENDORS & PERFORMANCE
// ============================================================
async function loadPerformance() {
    if (currentUser.role === "vendor") {
        // Vendor View: Directly open their own company's scorecard
        showSupplierDetail(1);
        return;
    }
    try {
        const cats = await api("/api/suppliers/categories");
        const sel = $("perf-category");
        if (sel.options.length <= 1) {
            cats.forEach(c => {
                const o = document.createElement("option");
                o.value = c.category_name;
                o.textContent = c.category_name;
                sel.appendChild(o);
            });
        }
    } catch (_) {}
    await reloadPerformanceTable();
}

async function reloadPerformanceTable() {
    const q = $("perf-search").value.trim();
    const category = $("perf-category").value;
    const risk = $("perf-risk").value;
    const limit = $("perf-limit").value;

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (risk) params.set("risk", risk);
    params.set("limit", limit);

    const body = $("perf-body");
    try {
        const rows = await api("/api/suppliers?" + params.toString());
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="10" class="muted">No suppliers matched your search criteria.</td></tr>';
            return;
        }
        body.innerHTML = rows.map(r => `
            <tr>
                <td><code>${escapeHtml(r.product_card_id || "SUP-" + r.id)}</code></td>
                <td><strong>${escapeHtml(r.product_name || r.name)}</strong></td>
                <td>${escapeHtml(r.category_name || r.category || "General")}</td>
                <td>${fmtNum(r.order_count)}</td>
                <td>${r.on_time_rate}%</td>
                <td>${r.late_rate}%</td>
                <td>${r.cancel_rate}%</td>
                <td><strong>${r.reliability_score}</strong></td>
                <td>${riskBadge(r.risk_level)}</td>
                <td><button class="btn sm primary" data-pid="${escapeHtml(r.product_card_id || r.id)}">Scorecard</button></td>
            </tr>
        `).join("");

        body.querySelectorAll("button[data-pid]").forEach(b =>
            b.onclick = () => showSupplierDetail(b.dataset.pid)
        );
    } catch (e) {
        body.innerHTML = `<tr><td colspan="10" class="muted">Error: ${escapeHtml(e.message)}</td></tr>`;
    }
}

async function showSupplierDetail(pid) {
    const d = $("perf-detail");
    d.classList.remove("hidden");
    window.scrollTo({ top: d.offsetTop - 80, behavior: "smooth" });

    try {
        const s = await api("/api/suppliers/" + encodeURIComponent(pid));
        $("perf-detail-title").innerHTML = `${escapeHtml(s.product_name)} ${riskBadge(s.risk_level)}`;

        $("perf-detail-metrics").innerHTML =
            statEl("Orders Fulfilled", fmtNum(s.order_count)) +
            statEl("Total Sales Volume", fmtMoney(s.total_sales)) +
            statEl("On-Time Delivery", s.on_time_rate + "%") +
            statEl("Order Completion", s.complete_rate + "%") +
            statEl("Cancellation Rate", s.cancel_rate + "%") +
            statEl("Avg Overdue Days", (s.avg_overdue_days || 0) + "d");

        $("perf-detail-recs").innerHTML = (s.recommendations || []).map(r =>
            `<li style="padding:6px 0"><span class="badge ${r.severity === 'high' ? 'high' : 'med'}">${r.severity}</span> ${escapeHtml(r.message)}</li>`
        ).join("") || "<li class='muted'>No active operational alerts for this supplier.</li>";

        const trend = s.trend || [];
        chart("chart-perf-trend", {
            data: {
                labels: trend.map(t => t.period),
                datasets: [
                    { type: "bar", label: "Orders Dispatched", yAxisID: "y",
                        data: trend.map(t => t.n), backgroundColor: "rgba(59,130,246,.35)",
                        borderColor: "#3b82f6", borderWidth: 1 },
                    { type: "line", label: "On-Time %", yAxisID: "y2",
                        data: trend.map(t => t.on_time_rate),
                        borderColor: "#10b981", tension: 0.3, pointRadius: 3 },
                ],
            },
            options: {
                maintainAspectRatio: false,
                scales: {
                    y: { title: { display: true, text: "Orders", color: "#94a3b8" } },
                    y2: { position: "right", min: 0, max: 100, grid: { drawOnChartArea: false },
                        title: { display: true, text: "On-Time %", color: "#94a3b8" } },
                },
            },
        });
    } catch (e) {
        showToast("Error loading scorecard: " + e.message);
    }
}

$("perf-reload").onclick = reloadPerformanceTable;
["perf-search", "perf-category", "perf-risk", "perf-limit"].forEach(id => {
    const el = $(id);
    if (el) {
        el.onchange = reloadPerformanceTable;
        if (id === "perf-search") el.onkeydown = (e) => { if (e.key === "Enter") reloadPerformanceTable(); };
    }
});

$("btn-open-add-vendor").onclick = () => openModal("modal-add-vendor");
$("form-add-vendor").onsubmit = async (e) => {
    e.preventDefault();
    try {
        await api("/vendors", {
            method: "POST",
            body: {
                name: $("v-name").value.trim(),
                category: $("v-cat").value,
                email: $("v-email").value.trim(),
                phone: $("v-phone").value.trim(),
                status: $("v-status").value,
                address: $("v-address").value.trim()
            }
        });
        showToast("Vendor registered successfully!");
        closeModal("modal-add-vendor");
        reloadPerformanceTable();
    } catch (err) {
        showToast("Error registering vendor: " + err.message);
    }
};

// ============================================================
// SECTION: CONTRACTS
// ============================================================
async function loadContracts() {
    const body = $("contracts-body");
    try {
        let list = await api("/contracts");
        if (currentUser.role === "vendor") {
            const vId = currentUser.vendor_id || 1;
            list = list.filter(c => c.vendor_id === vId);
        }

        if (!list.length) {
            body.innerHTML = '<tr><td colspan="7" class="muted">No contracts registered.</td></tr>';
        } else {
            body.innerHTML = list.map(c => `
                <tr>
                    <td><strong>#${c.id}</strong></td>
                    <td>${escapeHtml(c.vendor_name || ("Vendor #" + c.vendor_id))}</td>
                    <td>${escapeHtml(c.contract_name)}</td>
                    <td>${c.end_date ? c.end_date.slice(0, 10) : "–"}</td>
                    <td><strong>${c.days_left != null ? c.days_left + "d" : "–"}</strong></td>
                    <td>${riskBadge(c.status === "Active" ? "low" : "high")}</td>
                    <td>${c.compliance_status === "Compliant" ? '<span class="badge low">Compliant</span>' : `<span class="badge high">${escapeHtml(c.compliance_status)}</span>`}</td>
                </tr>
            `).join("");
        }

        const comp = await api("/contracts/compliance");
        const summary = comp.summary || [];
        chart("chart-compliance", {
            type: "doughnut",
            data: {
                labels: summary.map(x => x.status),
                datasets: [{
                    data: summary.map(x => x.count),
                    backgroundColor: ["#10b981", "#ef4444", "#f59e0b", "#64748b"],
                    borderColor: "#0f172a",
                    borderWidth: 2
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { color: "#94a3b8" } } }
            }
        });

        const exp = await api("/contracts/expiring?days=90");
        $("contracts-expiring").innerHTML = exp.length ? exp.slice(0, 5).map(c => `
            <div class="mini">
                <div class="m-label">${escapeHtml(c.contract_name)}</div>
                <div class="m-value ${c.days_left <= 30 ? 'risk-high' : 'risk-med'}">${c.days_left}d remaining</div>
            </div>
        `).join("") : '<p class="muted">No contracts expiring within 90 days.</p>';
    } catch (e) {
        body.innerHTML = `<tr><td colspan="7" class="muted">Error: ${escapeHtml(e.message)}</td></tr>`;
    }
}

$("btn-open-create-contract").onclick = () => openModal("modal-new-contract");
$("form-new-contract").onsubmit = async (e) => {
    e.preventDefault();
    try {
        await api("/contracts", {
            method: "POST",
            body: {
                vendor_id: parseInt($("con-vendor").value),
                contract_name: $("con-name").value.trim(),
                start_date: $("con-start").value || null,
                end_date: $("con-end").value,
                status: $("con-status").value,
                compliance_status: $("con-compliance").value
            }
        });
        showToast("Contract registered successfully.");
        closeModal("modal-new-contract");
        loadContracts();
    } catch (err) {
        showToast("Error creating contract: " + err.message);
    }
};

// ============================================================
// SECTION: INVOICES & FINANCE
// ============================================================
async function loadInvoices() {
    const tbody = $("invoices-table-body");
    const statusFilter = $("invoice-status-filter").value;

    try {
        const sum = await api("/api/invoices/summary");
        $("invoice-stats").innerHTML =
            statEl("Total Invoiced", fmtMoney(sum.total_invoiced_amount)) +
            statEl("Paid Volume", fmtMoney(sum.total_paid_amount)) +
            statEl("Pending Amount", fmtMoney(sum.total_pending_amount)) +
            statEl("Overdue Invoices", fmtNum(sum.overdue_invoices_count)) +
            statEl("Total Invoices", fmtNum(sum.total_invoices));

        const params = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
        let invoices = await api("/api/invoices" + params);

        if (currentUser.role === "vendor") {
            const vId = currentUser.vendor_id || 1;
            invoices = invoices.filter(i => i.vendor_id === vId);
        }

        if (!invoices.length) {
            tbody.innerHTML = '<tr><td colspan="10" class="muted">No invoices recorded yet.</td></tr>';
            return;
        }

        tbody.innerHTML = invoices.map(inv => `
            <tr>
                <td><strong>${escapeHtml(inv.invoice_number)}</strong></td>
                <td>${escapeHtml(inv.po_number || ("PO #" + inv.purchase_order_id))}</td>
                <td>${escapeHtml(inv.vendor_name || ("Vendor #" + inv.vendor_id))}</td>
                <td>${fmtMoney(inv.amount)}</td>
                <td>${fmtMoney(inv.tax_amount)}</td>
                <td><strong>${fmtMoney(inv.total || inv.total_amount)}</strong></td>
                <td>${riskBadge(inv.status)}</td>
                <td>${inv.due_date ? inv.due_date.slice(0, 10) : "–"}</td>
                <td>${inv.paid_date ? inv.paid_date.slice(0, 10) : "–"}</td>
                <td>
                    ${(currentUser.role === "admin" || currentUser.role === "finance_officer") && inv.status !== "Paid" 
                        ? `<button class="btn sm primary" data-inv-pay="${inv.id}">Mark Paid</button>` 
                        : `<span class="badge ${inv.status === 'Paid' ? 'low' : 'med'}">${escapeHtml(inv.status)}</span>`}
                </td>
            </tr>
        `).join("");

        tbody.querySelectorAll("button[data-inv-pay]").forEach(b => {
            b.onclick = async () => {
                await api(`/api/invoices/${b.dataset.invPay}/status`, {
                    method: "PUT",
                    body: { status: "Paid" }
                });
                showToast("Invoice marked as Paid.");
                loadInvoices();
            };
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="10" class="muted">Error: ${escapeHtml(e.message)}</td></tr>`;
    }
}

$("invoice-status-filter").onchange = loadInvoices;
$("btn-refresh-invoices").onclick = loadInvoices;

$("btn-open-create-invoice").onclick = async () => {
    try {
        const orders = await api("/purchase-orders");
        const poSel = $("inv-po-select");
        poSel.innerHTML = '<option value="">Select Purchase Order...</option>' +
            orders.map(o => `<option value="${o.id}" data-total="${o.total_amount || 0}" data-vendor="${o.vendor_id}">${escapeHtml(o.po_number || "#" + o.id)} — ${fmtMoney(o.total_amount)} (${o.status})</option>`).join("");
        
        poSel.onchange = () => {
            const opt = poSel.selectedOptions[0];
            if (opt && opt.dataset.total) {
                const total = parseFloat(opt.dataset.total) || 0;
                const base = total / 1.18;
                const tax = total - base;
                $("inv-amount").value = base.toFixed(2);
                $("inv-tax").value = tax.toFixed(2);
            }
        };
    } catch (_) {}
    openModal("modal-new-invoice");
};

$("form-new-invoice").onsubmit = async (e) => {
    e.preventDefault();
    const poId = parseInt($("inv-po-select").value);
    if (!poId) {
        showToast("Please select a purchase order.");
        return;
    }
    const opt = $("inv-po-select").selectedOptions[0];
    const vendorId = parseInt(opt.dataset.vendor) || 1;
    const amount = parseFloat($("inv-amount").value) || 0;
    const tax = parseFloat($("inv-tax").value) || 0;

    try {
        await api("/api/invoices", {
            method: "POST",
            body: {
                purchase_order_id: poId,
                vendor_id: vendorId,
                amount: amount,
                tax_amount: tax,
                total_amount: amount + tax,
                due_date: $("inv-due-date").value || null,
                notes: $("inv-notes").value.trim()
            }
        });
        showToast("Invoice generated successfully!");
        closeModal("modal-new-invoice");
        loadInvoices();
    } catch (err) {
        showToast("Error generating invoice: " + err.message);
    }
};

// ============================================================
// SECTION: COMMUNICATIONS (Messaging Hub)
// ============================================================
async function loadCommunications() {
    const listEl = $("comm-threads-list");
    try {
        let threads = await api("/api/communications/threads");
        if (currentUser.role === "vendor") {
            const vId = currentUser.vendor_id || 1;
            threads = threads.filter(t => t.vendor_id === vId);
        }

        if (!threads.length) {
            listEl.innerHTML = '<p class="muted">No vendor message threads yet.</p>';
            return;
        }

        listEl.innerHTML = threads.map((t, idx) => `
            <div class="thread-item ${idx === 0 && !activeChatVendorId ? 'active' : (activeChatVendorId === t.vendor_id ? 'active' : '')}" data-vendor-id="${t.vendor_id}">
                <div class="thread-item-header">
                    <span class="thread-vendor-name">${escapeHtml(t.vendor_name || ("Vendor #" + t.vendor_id))}</span>
                    <span class="thread-time">${t.last_message_time ? t.last_message_time.slice(0, 10) : ""}</span>
                </div>
                <div class="thread-preview">${escapeHtml(t.last_message || "Open thread")}</div>
            </div>
        `).join("");

        listEl.querySelectorAll(".thread-item").forEach(item => {
            item.onclick = () => {
                listEl.querySelectorAll(".thread-item").forEach(i => i.classList.remove("active"));
                item.classList.add("active");
                activeChatVendorId = parseInt(item.dataset.vendorId);
                loadChatMessages(activeChatVendorId, item.querySelector(".thread-vendor-name").textContent);
            };
        });

        const defaultVendorId = activeChatVendorId || threads[0].vendor_id;
        activeChatVendorId = defaultVendorId;
        const defaultName = threads.find(t => t.vendor_id === defaultVendorId)?.vendor_name || "Vendor";
        loadChatMessages(defaultVendorId, defaultName);
    } catch (e) {
        listEl.innerHTML = `<p class="muted">Error: ${escapeHtml(e.message)}</p>`;
    }
}

async function loadChatMessages(vendorId, vendorName) {
    $("chat-thread-title").textContent = `Conversation with ${vendorName}`;
    $("chat-active-vendor-id").value = vendorId;
    const container = $("chat-messages-container");

    try {
        const msgs = await api(`/api/communications?vendor_id=${vendorId}`);
        if (!msgs.length) {
            container.innerHTML = '<p class="muted" style="text-align:center;padding:20px;">No messages in this thread. Write below to start conversation.</p>';
            return;
        }
        container.innerHTML = msgs.map(m => {
            const isMe = m.sender_id === currentUser.id || (!m.sender_id && currentUser.role !== "vendor");
            return `
                <div class="chat-msg ${isMe ? 'outgoing' : 'incoming'}">
                    <div><strong>${isMe ? 'You' : (m.sender_name || 'Counterpart')}</strong>: ${escapeHtml(m.message || m.message_body)}</div>
                    <div class="chat-msg-meta">
                        <span>${escapeHtml(m.subject || m.message_type || 'Message')}</span>
                        <span>${m.created_at ? m.created_at.slice(11, 16) : ''}</span>
                    </div>
                </div>
            `;
        }).join("");
        container.scrollTop = container.scrollHeight;
    } catch (_) {}
}

$("chat-reply-form").onsubmit = async (e) => {
    e.preventDefault();
    const vendorId = parseInt($("chat-active-vendor-id").value);
    const body = $("chat-reply-input").value.trim();
    if (!vendorId || !body) return;

    try {
        await api("/api/communications", {
            method: "POST",
            body: {
                vendor_id: vendorId,
                subject: "Fulfillment Inquiry",
                message_body: body,
                message_type: "Inquiry"
            }
        });
        $("chat-reply-input").value = "";
        await loadChatMessages(vendorId, $("chat-thread-title").textContent.replace("Conversation with ", ""));
        await loadCommunications();
    } catch (err) {
        showToast("Error sending message: " + err.message);
    }
};

$("btn-open-compose-msg").onclick = () => openModal("modal-compose-msg");
$("form-compose-msg").onsubmit = async (e) => {
    e.preventDefault();
    const vendorId = parseInt($("msg-vendor-select").value);
    try {
        await api("/api/communications", {
            method: "POST",
            body: {
                vendor_id: vendorId,
                subject: $("msg-subject").value.trim(),
                message_body: $("msg-body").value.trim(),
                message_type: "Inquiry"
            }
        });
        showToast("Message dispatched to vendor.");
        closeModal("modal-compose-msg");
        activeChatVendorId = vendorId;
        loadCommunications();
    } catch (err) {
        showToast("Error sending message: " + err.message);
    }
};

// ============================================================
// SECTION: RELIABILITY & RISK
// ============================================================
async function loadReliability() {
    const ranked = await api("/api/suppliers/ranking?limit=20");
    const colors = { low: "#10b981", med: "#f59e0b", high: "#ef4444" };
    $("rel-board").innerHTML = ranked.map(r => {
        const c = colors[(r.risk_level || "med").toLowerCase()] || colors.med;
        return `
        <div class="lb-row" data-pid="${escapeHtml(r.product_card_id)}" style="cursor:pointer">
            <div class="rank">#${r.rank}</div>
            <div>
                <div><strong>${escapeHtml(r.product_name)}</strong></div>
                <div class="muted" style="font-size:12px">${escapeHtml(r.category_name)} · ${fmtNum(r.order_count)} orders</div>
            </div>
            <div>${riskBadge(r.risk_level)}</div>
            <div class="muted" style="font-size:12px"><strong>${r.reliability_score}</strong></div>
            <div class="score-bar"><div style="width:${r.reliability_score}%;background:${c}"></div></div>
        </div>`;
    }).join("") || '<p class="muted">No supplier reliability data available.</p>';

    document.querySelectorAll("#rel-board .lb-row").forEach(row => {
        row.onclick = () => {
            const pid = row.dataset.pid;
            navigate("performance");
            showSupplierDetail(pid);
        };
    });

    $("rel-factors").innerHTML = `
        <table class="table">
        <thead><tr><th>Factor</th><th>Weight</th><th>Data Source</th></tr></thead>
        <tbody>
            <tr><td>Delivery History</td><td>35%</td><td>Dataset on-time vs late delivery rate</td></tr>
            <tr><td>Product Quality</td><td>20%</td><td>Dataset order completion rate</td></tr>
            <tr><td>Issue Resolution</td><td>20%</td><td>Dataset punctuality vs scheduled shipping</td></tr>
            <tr><td>Purchase History</td><td>15%</td><td>Dataset order volume (score 35–100)</td></tr>
            <tr><td>Communication Efficiency</td><td>5%</td><td>Live communications responsiveness index</td></tr>
            <tr><td>Contract Compliance</td><td>5%</td><td>Contract compliance SLA records</td></tr>
        </tbody></table>`;
}

// ============================================================
// SECTION: ANALYTICS DASHBOARD
// ============================================================
async function loadAnalytics() {
    const d = await api("/api/analytics/dashboard");
    const t = d.totals || {};
    $("an-total-orders").textContent = fmtNum(t.total_orders);
    $("an-total-sales").textContent = fmtMoney(t.total_sales);
    $("an-avg-value").textContent = fmtMoney(t.avg_order_value);
    $("an-ontime").textContent = (t.on_time_rate || 0) + "%";

    const month = d.monthly_trend || [];
    chart("chart-monthly", {
        data: {
            labels: month.map(m => m.period),
            datasets: [
                { type: "bar", label: "Orders Dispatched", yAxisID: "y",
                    data: month.map(m => m.orders),
                    backgroundColor: "rgba(59,130,246,.45)" },
                { type: "line", label: "On-Time %", yAxisID: "y2",
                    data: month.map(m => m.on_time_rate),
                    borderColor: "#10b981", tension: 0.3, pointRadius: 2 },
            ],
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                y: { title: { display: true, text: "Orders", color: "#94a3b8" } },
                y2: { position: "right", min: 0, max: 100, grid: { drawOnChartArea: false },
                    title: { display: true, text: "On-Time %", color: "#94a3b8" } },
            },
        },
    });

    chart("chart-category", {
        type: "bar",
        data: {
            labels: (d.spend_by_category || []).map(c => c.category_name),
            datasets: [{ label: "Sales ($)", data: (d.spend_by_category || []).map(c => c.sales),
                backgroundColor: "rgba(59,130,246,.55)" }],
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });

    chart("chart-market", {
        type: "bar",
        data: {
            labels: (d.spend_by_market || []).map(m => m.market),
            datasets: [{ label: "Sales ($)", data: (d.spend_by_market || []).map(m => m.sales),
                backgroundColor: "rgba(16,185,129,.55)" }],
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });

    chart("chart-delivery", {
        type: "doughnut",
        data: {
            labels: (d.delivery_status || []).map(x => x.delivery_status),
            datasets: [{ data: (d.delivery_status || []).map(x => x.n),
                backgroundColor: ["#3b82f6", "#f59e0b", "#ef4444", "#10b981", "#a855f7"],
                borderColor: "#0f172a", borderWidth: 2 }],
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: "#94a3b8" } } } },
    });
}

// ============================================================
// SECTION: NOTIFICATIONS
// ============================================================
async function loadUnread() {
    try {
        const d = await api("/notifications/count/unread");
        $("unread-badge").textContent = d.unread || 0;
    } catch (_) {}
}

async function loadNotifications() {
    const list = await api("/notifications?unread_only=false");
    const wrap = $("notif-list");
    if (!list.length) {
        wrap.innerHTML = '<p class="muted">You have no notifications.</p>';
        return;
    }
    wrap.innerHTML = list.map(n => `
        <div class="notif ${n.is_read ? 'read' : 'unread'}" data-id="${n.id}" data-read="${n.is_read}">
            <div class="n-title">${escapeHtml(n.title)}</div>
            <div class="n-msg">${escapeHtml(n.message)}</div>
            <div class="n-meta">
                <span class="tag ${(n.notification_type || '').toLowerCase()}">${escapeHtml(n.notification_type || 'Alert')}</span>
                <span>${n.created_at ? n.created_at.replace("T", " ").slice(0, 16) : ""}</span>
            </div>
        </div>
    `).join("");

    wrap.querySelectorAll(".notif").forEach(el => {
        el.onclick = async () => {
            if (el.dataset.read === "true") return;
            await api("/notifications/" + el.dataset.id + "/read", { method: "PUT" });
            el.classList.remove("unread");
            el.classList.add("read");
            el.dataset.read = "true";
            loadUnread();
        };
    });
}

$("notif-refresh").onclick = loadNotifications;
$("notif-readall").onclick = async () => {
    await api("/notifications/read-all", { method: "PUT" });
    loadUnread();
    loadNotifications();
};
$("notif-generate").onclick = async () => {
    try {
        const r = await api("/notifications/generate", { method: "POST" });
        showToast(r.message);
        loadUnread();
        loadNotifications();
    } catch (e) {
        showToast(e.message);
    }
};

// ============================================================
// SECTION: REPORTS (Excel, CSV, PDF, Preview)
// ============================================================
const REPORT_DEFS = [
    { type: "vendor-performance", name: "Vendor Performance", desc: "Reliability metrics for all 118 suppliers (live from dataset)." },
    { type: "suppliers", name: "Supplier Ranking", desc: "Full supplier ranking & reliability score snapshot." },
    { type: "procurement", name: "Procurement Requests", desc: "Requisition records and category spend metrics." },
    { type: "purchase-orders", name: "Purchase Orders Register", desc: "PO list with line item aggregates, vendors, and status." },
    { type: "invoices", name: "Invoices & Payments", desc: "Accounts payable ledger, invoice amounts, tax, and settlement status." },
    { type: "compliance", name: "Contract Compliance", desc: "Contract compliance audit status with summary breakdown." },
    { type: "contracts", name: "Contracts Register", desc: "Contract agreements with expiration dates and days remaining." },
    { type: "audit-logs", name: "System Audit Trail", desc: "Immutable security and operational event logs with RBAC context." },
];

async function loadReports() {
    $("reports-grid").innerHTML = REPORT_DEFS.map(r => `
        <div class="report-card">
            <div>
                <h4>${r.name}</h4>
                <p>${r.desc}</p>
            </div>
            <div class="file-buttons">
                <button class="btn sm primary" data-type="${r.type}" data-format="pdf">PDF</button>
                <button class="btn sm ghost" data-type="${r.type}" data-format="download">Excel</button>
                <button class="btn sm ghost" data-type="${r.type}" data-format="csv">CSV</button>
                <button class="btn sm ghost" data-type="${r.type}" data-format="preview">Preview</button>
            </div>
        </div>
    `).join("");

    document.querySelectorAll("#reports-grid button").forEach(b => {
        b.onclick = () => handleReport(b.dataset.type, b.dataset.format);
    });
}

async function handleReport(type, format) {
    try {
        if (format === "preview") {
            const d = await api(`/api/reports/${type}/preview?limit=15`);
            renderPreview(d);
            return;
        }
        const endpoint = format === "pdf"
            ? `${API_BASE}/api/reports/${type}/pdf`
            : `${API_BASE}/api/reports/${type}/${format}`;

        const res = await fetch(endpoint, {
            headers: { Authorization: "Bearer " + getToken() },
        });
        if (!res.ok) throw new Error(res.statusText);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = format === "pdf" ? "pdf" : (format === "csv" ? "csv" : "xlsx");
        a.download = `${type}_report.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`${type} ${format.toUpperCase()} downloaded successfully.`);
    } catch (e) {
        showToast("Download failed: " + e.message);
    }
}

function renderPreview(d) {
    const table = $("report-preview-table");
    if (!d.rows || !d.rows.length) {
        table.innerHTML = "<caption>No records available to preview.</caption>";
        return;
    }
    const cols = d.columns || Object.keys(d.rows[0]);
    let html = `<caption>${escapeHtml(d.report_type)} — ${d.total_rows} rows total (showing first ${d.rows.length})</caption>
        <thead><tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead><tbody>`;
    d.rows.forEach(row => {
        html += `<tr>${cols.map(c => `<td>${escapeHtml(row[c])}</td>`).join("")}</tr>`;
    });
    table.innerHTML = html + "</tbody>";
}

// ============================================================
// SECTION: AUDIT & ROLES
// ============================================================
async function loadAudit() {
    const tbody = $("audit-table-body");
    try {
        const logs = await api("/api/audit-logs");
        if (!logs.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="muted">No audit trails recorded yet.</td></tr>';
            return;
        }
        tbody.innerHTML = logs.map(l => `
            <tr>
                <td style="color:var(--text-dim);font-size:12px;">${l.created_at ? l.created_at.replace("T", " ").slice(0, 19) : "–"}</td>
                <td><strong>${escapeHtml(l.user_email || ("User #" + l.user_id))}</strong></td>
                <td><span class="badge info">${escapeHtml(l.action)}</span></td>
                <td><code>${escapeHtml(l.entity_type)}${l.entity_id ? ' #' + l.entity_id : ''}</code></td>
                <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(l.details || "–")}</td>
            </tr>
        `).join("");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="muted">Error: ${escapeHtml(e.message)}</td></tr>`;
    }
}

$("btn-refresh-audit").onclick = loadAudit;

// ============================================================
// APPLICATION BOOTSTRAP
// ============================================================
if (getToken()) {
    showApp();
    applyRoleGating(currentUser.role);
    const cfg = ROLE_CONFIGS[currentUser.role] || ROLE_CONFIGS.admin;
    navigate(cfg.defaultLanding);
    loadUnread();
} else {
    showLogin();
}