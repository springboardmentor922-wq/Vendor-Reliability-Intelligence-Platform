// Dynamic Role-Based Navigation Generator for VendorIQ

function renderSharedLayout(activePageTitle) {
    const userRole = localStorage.getItem('user_role') || 'Procurement Manager';
    const userEmail = localStorage.getItem('user_email') || 'user@vendoriq.com';
    const userFullName = localStorage.getItem('user_fullname') || userEmail.split('@')[0];

    // 1. Mount Sidebar
    const sidebarMount = document.getElementById('sidebarMount');
    if (sidebarMount) {
        sidebarMount.className = "app-sidebar";
        sidebarMount.innerHTML = `
            <div>
                <a href="dashboard.html" class="brand-logo mb-2">
                    <div class="brand-icon" style="background: linear-gradient(135deg, #ea580c 0%, #9a3412 50%, #5c200c 100%) !important; color: #ffffff !important; box-shadow: 0 4px 14px rgba(92, 32, 12, 0.28) !important;">
                        <i class="bi bi-shield-check"></i>
                    </div>
                    <div>
                        <div class="fw-bold fs-5 tracking-tight" style="color: var(--text-main);">VendorIQ</div>
                        <div style="font-size: 0.68rem; color: #7c5c4a; text-transform: uppercase; letter-spacing: 0.05em;">${getRolePortalName(userRole)}</div>
                    </div>
                </a>

                <div class="nav-section-title">Navigation</div>
                <div class="sidebar-nav">
                    ${getNavLinksForRole(userRole, activePageTitle)}
                </div>

                <div class="nav-section-title">Communication</div>
                <div class="sidebar-nav">
                    <a href="notifications.html" class="nav-link ${activePageTitle === 'Notifications' ? 'active' : ''}">
                        <i class="bi bi-bell-fill" style="${activePageTitle === 'Notifications' ? 'color: #c2410c;' : ''}"></i>
                        <span>Alerts Center</span>
                        <span class="badge rounded-pill ms-auto" style="font-size: 0.7rem; background-color: #c2410c; color: #ffffff;">3</span>
                    </a>
                </div>
            </div>

            <div>
                <div class="sidebar-user mb-3" style="background-color: var(--surface-bg); border: 1px solid var(--border-color);">
                    <div class="d-flex align-items-center gap-2">
                        <div class="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold" style="width: 36px; height: 36px; font-size: 0.9rem; background: linear-gradient(135deg, #ea580c, #5c200c); box-shadow: 0 2px 8px rgba(92, 32, 12, 0.25);">
                            ${userFullName.charAt(0).toUpperCase()}
                        </div>
                        <div class="overflow-hidden">
                            <div class="fw-semibold text-truncate small" style="color: var(--text-main);">${userFullName}</div>
                            <span class="badge ${getRoleBadgeClass(userRole)}" style="font-size: 0.65rem;">${userRole}</span>
                        </div>
                    </div>
                </div>

                <button onclick="logout()" class="btn btn-light w-100 btn-sm d-flex align-items-center justify-content-center gap-2" style="border-radius: 8px; border-color: var(--border-color); color: #7c5c4a;">
                    <i class="bi bi-box-arrow-left"></i> Sign Out
                </button>
            </div>
        `;
    }

    // 2. Mount Header
    const headerMount = document.getElementById('headerMount');
    if (headerMount) {
        headerMount.className = "app-header";
        headerMount.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <div class="d-flex align-items-center gap-2">
                    <span class="badge ${getRoleBadgeClass(userRole)} px-2.5 py-1.5" style="font-size: 0.8rem; background-color: #ffedd5 !important; color: #7c2d12 !important; border: 1px solid #fed7aa !important;">
                        <i class="bi bi-person-badge me-1"></i> ${userRole} Mode
                    </span>
                </div>
                <div class="position-relative d-none d-md-block">
                    <i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
                    <input type="text" class="search-input" placeholder="Search orders, records, suppliers..." style="background-color: #f5ede4; border-color: #ebdcd0;">
                </div>
            </div>

            <div class="d-flex align-items-center gap-3">
                <!-- Dedicated Terracotta & Mocha Brown Theme Indicator Badge -->
                <div class="d-flex align-items-center gap-2 px-2.5 py-1 rounded-pill" style="background: #f5ede4; border: 1px solid #ebdcd0;" title="Palette: Terracotta & Mocha Brown">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: linear-gradient(135deg, #ea580c, #5c200c); display: inline-block; box-shadow: 0 0 0 1px #ffffff;"></span>
                    <span style="font-size: 0.72rem; font-weight: 700; color: #5c200c;">Terracotta & Mocha Brown</span>
                </div>

                <a href="notifications.html" class="btn btn-light rounded-circle position-relative border" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-color: var(--border-color) !important;">
                    <i class="bi bi-bell" style="color: var(--text-secondary);"></i>
                    <span class="position-absolute top-0 start-100 translate-middle p-1 border border-light rounded-circle" style="background-color: #c2410c;"></span>
                </a>

                <div class="vr mx-1" style="background-color: var(--border-color);"></div>

                <div class="d-flex align-items-center gap-2">
                    <div class="text-end d-none d-sm-block">
                        <div class="fw-semibold small" style="color: var(--text-main);">${userFullName}</div>
                        <small class="text-muted" style="font-size: 0.75rem;">${userEmail}</small>
                    </div>
                    <a href="index.html" onclick="logout()" class="btn btn-light btn-sm px-2.5" style="border-radius: 8px; border-color: var(--border-color);" title="Switch Role">
                        <i class="bi bi-arrow-repeat me-1" style="color: #c2410c;"></i> Switch Role
                    </a>
                </div>
            </div>
        `;
    }
}

function getRolePortalName(role) {
    switch (role) {
        case 'Vendor': return 'Supplier Portal';
        case 'Administrator': return 'Admin Console';
        case 'Finance Officer': return 'Finance Console';
        case 'Supply Chain Manager': return 'Risk Intelligence';
        case 'Auditor': return 'Compliance Audit';
        default: return 'Procurement Suite';
    }
}

function getNavLinksForRole(role, activePage) {
    if (role === 'Vendor') {
        return `
            <a href="dashboard.html" class="nav-link ${activePage === 'Dashboard' ? 'active' : ''}">
                <i class="bi bi-grid-1x2-fill"></i>
                <span>Supplier Dashboard</span>
            </a>
            <a href="procurement.html" class="nav-link ${activePage === 'Procurement' ? 'active' : ''}">
                <i class="bi bi-box-seam"></i>
                <span>My Purchase Orders</span>
            </a>
            <a href="performance.html" class="nav-link ${activePage === 'Performance' ? 'active' : ''}">
                <i class="bi bi-star-fill text-warning"></i>
                <span>My Reliability Score</span>
            </a>
            <a href="contracts.html" class="nav-link ${activePage === 'Contracts' ? 'active' : ''}">
                <i class="bi bi-file-earmark-text"></i>
                <span>My Contracts & SLA</span>
            </a>
        `;
    } else if (role === 'Auditor') {
        return `
            <a href="dashboard.html" class="nav-link ${activePage === 'Dashboard' ? 'active' : ''}">
                <i class="bi bi-grid-1x2-fill"></i>
                <span>Audit Dashboard</span>
            </a>
            <a href="contracts.html" class="nav-link ${activePage === 'Contracts' ? 'active' : ''}">
                <i class="bi bi-file-earmark-check-fill"></i>
                <span>Contracts Repository</span>
            </a>
            <a href="vendors.html" class="nav-link ${activePage === 'Vendors' ? 'active' : ''}">
                <i class="bi bi-building-check"></i>
                <span>Vendor Compliance</span>
            </a>
            <a href="reports.html" class="nav-link ${activePage === 'Reports' ? 'active' : ''}">
                <i class="bi bi-file-earmark-spreadsheet-fill"></i>
                <span>Audit Export Logs</span>
            </a>
        `;
    } else if (role === 'Finance Officer') {
        return `
            <a href="dashboard.html" class="nav-link ${activePage === 'Dashboard' ? 'active' : ''}">
                <i class="bi bi-grid-1x2-fill"></i>
                <span>Finance Dashboard</span>
            </a>
            <a href="procurement.html" class="nav-link ${activePage === 'Procurement' ? 'active' : ''}">
                <i class="bi bi-receipt-cutoff"></i>
                <span>Orders & Invoices</span>
            </a>
            <a href="contracts.html" class="nav-link ${activePage === 'Contracts' ? 'active' : ''}">
                <i class="bi bi-bank"></i>
                <span>Capital & Contracts</span>
            </a>
            <a href="reports.html" class="nav-link ${activePage === 'Reports' ? 'active' : ''}">
                <i class="bi bi-cash-stack"></i>
                <span>Spend Ledgers</span>
            </a>
        `;
    } else if (role === 'Supply Chain Manager') {
        return `
            <a href="dashboard.html" class="nav-link ${activePage === 'Dashboard' ? 'active' : ''}">
                <i class="bi bi-grid-1x2-fill"></i>
                <span>Supply Chain Cockpit</span>
            </a>
            <a href="performance.html" class="nav-link ${activePage === 'Performance' ? 'active' : ''}">
                <i class="bi bi-speedometer2"></i>
                <span>Reliability & Risk</span>
            </a>
            <a href="vendors.html" class="nav-link ${activePage === 'Vendors' ? 'active' : ''}">
                <i class="bi bi-building"></i>
                <span>Supplier Directory</span>
            </a>
            <a href="procurement.html" class="nav-link ${activePage === 'Procurement' ? 'active' : ''}">
                <i class="bi bi-truck"></i>
                <span>Delivery Timelines</span>
            </a>
            <a href="reports.html" class="nav-link ${activePage === 'Reports' ? 'active' : ''}">
                <i class="bi bi-graph-up"></i>
                <span>Risk Analytics</span>
            </a>
        `;
    } else {
        // Administrator & Procurement Manager
        return `
            <a href="dashboard.html" class="nav-link ${activePage === 'Dashboard' ? 'active' : ''}">
                <i class="bi bi-grid-1x2-fill"></i>
                <span>${role === 'Administrator' ? 'Admin Dashboard' : 'Procurement Dashboard'}</span>
            </a>
            <a href="vendors.html" class="nav-link ${activePage === 'Vendors' ? 'active' : ''}">
                <i class="bi bi-building"></i>
                <span>Vendor Directory</span>
            </a>
            <a href="procurement.html" class="nav-link ${activePage === 'Procurement' ? 'active' : ''}">
                <i class="bi bi-cart3"></i>
                <span>Purchase Orders</span>
            </a>
            <a href="performance.html" class="nav-link ${activePage === 'Performance' ? 'active' : ''}">
                <i class="bi bi-speedometer2"></i>
                <span>Reliability & Risk</span>
            </a>
            <a href="contracts.html" class="nav-link ${activePage === 'Contracts' ? 'active' : ''}">
                <i class="bi bi-file-earmark-lock"></i>
                <span>Contracts & SLA</span>
            </a>
            <a href="reports.html" class="nav-link ${activePage === 'Reports' ? 'active' : ''}">
                <i class="bi bi-bar-chart-line-fill"></i>
                <span>Audit Reports</span>
            </a>
        `;
    }
}

function getRoleBadgeClass(role) {
    switch (role) {
        case 'Administrator': return 'role-badge-admin';
        case 'Procurement Manager': return 'role-badge-procurement';
        case 'Supply Chain Manager': return 'role-badge-supply';
        case 'Finance Officer': return 'role-badge-finance';
        case 'Vendor': return 'role-badge-vendor';
        case 'Auditor': return 'role-badge-auditor';
        default: return 'role-badge-procurement';
    }
}

// Global Theme Controller - Locked to Native Apricot & Terracotta Peach
function setPastelTheme(themeName) {
    document.documentElement.className = 'theme-peach';
    localStorage.setItem('pastel_theme', 'theme-peach');
}

(function() {
    document.documentElement.className = 'theme-peach';
    localStorage.setItem('pastel_theme', 'theme-peach');
})();

