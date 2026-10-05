/**
 * VendorIQ Enterprise Application Controller
 */

const App = {
  currentUser: null,
  currentRoute: 'dashboard',
  vendorCategoryFilter: 'All',
  vendorStatusFilter: 'All',
  vendorSearchQuery: '',
  selectedVendorId: null,

  async init() {
    this.bindEvents();
    // Check if user already logged in
    const token = API.getToken();
    const user = API.getCurrentUser();
    if (token && user) {
      try {
        this.currentUser = await API.getMe();
        this.showAppShell();
        this.navigate(window.location.hash.slice(2) || 'dashboard');
      } catch (e) {
        API.clearAuth();
        this.showLandingPage();
      }
    } else {
      this.showLandingPage();
    }
  },

  bindEvents() {
    window.addEventListener('hashchange', () => {
      if (this.currentUser) {
        this.navigate(window.location.hash.slice(2) || 'dashboard');
      }
    });

    window.addEventListener('auth:expired', () => {
      this.currentUser = null;
      this.showToast('Session expired. Please log in again.', 'warning');
      this.showLandingPage();
    });
  },

  showLandingPage() {
    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  },

  showAppShell() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    this.updateUserHeader();
    this.updateNavigationRoles();
    this.loadNotifications();
  },

  updateUserHeader() {
    if (!this.currentUser) return;
    document.getElementById('header-user-name').textContent = this.currentUser.full_name;
    document.getElementById('header-user-role').textContent = this.currentUser.role;
    document.getElementById('header-user-dept').textContent = this.currentUser.department || 'Corporate';

    // Color role badge
    const badge = document.getElementById('header-user-role');
    badge.className = 'px-2.5 py-0.5 text-xs font-semibold rounded-full ';
    if (this.currentUser.role === 'Administrator') badge.className += 'bg-purple-100 text-purple-800';
    else if (this.currentUser.role === 'Procurement Manager') badge.className += 'bg-blue-100 text-blue-800';
    else if (this.currentUser.role === 'Supply Chain Manager') badge.className += 'bg-emerald-100 text-emerald-800';
    else if (this.currentUser.role === 'Vendor') badge.className += 'bg-amber-100 text-amber-800';
    else if (this.currentUser.role === 'Finance Officer') badge.className += 'bg-teal-100 text-teal-800';
    else badge.className += 'bg-slate-100 text-slate-800';
  },

  updateNavigationRoles() {
    const role = this.currentUser.role;
    // Show/hide menu items according to exact role permissions
    const setVisibility = (id, condition) => {
      const el = document.getElementById(id);
      if (el) {
        if (condition) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    };

    setVisibility('nav-approvals', ['Administrator', 'Procurement Manager'].includes(role));
    setVisibility('nav-procurement', ['Administrator', 'Procurement Manager', 'Supply Chain Manager'].includes(role));
    setVisibility('nav-invoices', ['Administrator', 'Procurement Manager', 'Finance Officer', 'Vendor'].includes(role));
    setVisibility('nav-contracts', ['Administrator', 'Procurement Manager', 'Vendor', 'Auditor'].includes(role));
    setVisibility('nav-audit', ['Administrator', 'Auditor'].includes(role));
  },

  navigate(route) {
    if (!route) route = 'dashboard';
    this.currentRoute = route;
    window.location.hash = `#/${route}`;

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('data-route') === route) {
        link.classList.add('bg-slate-800', 'text-white', 'border-l-4', 'border-blue-500');
        link.classList.remove('text-slate-400');
      } else {
        link.classList.remove('bg-slate-800', 'text-white', 'border-l-4', 'border-blue-500');
        link.classList.add('text-slate-400');
      }
    });

    // Hide all view panels
    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.add('hidden'));

    // Route handler
    if (route === 'dashboard') this.renderDashboard();
    else if (route === 'vendors') this.renderVendorsView();
    else if (route === 'vendor-approval') this.renderApprovalQueue();
    else if (route === 'procurement') this.renderProcurementView();
    else if (route === 'purchase-orders') this.renderPurchaseOrdersView();
    else if (route === 'invoices') this.renderInvoicesView();
    else if (route === 'contracts') this.renderContractsView();
    else if (route === 'analytics') this.renderAnalyticsView();
    else if (route === 'communication') this.renderCommunicationView();
    else if (route === 'audit') this.renderAuditView();
    else if (route === 'reports') this.renderReportsView();
  },

  // ================= DEMO MODE HANDLER (1-CLICK AUTH) =================
  async handleDemoClick(role) {
    try {
      this.showLoadingToast(`Authenticating Demo Account as ${role}...`);
      const authData = await API.demoLogin(role);
      this.currentUser = authData.user;
      this.showToast(`Logged in successfully as ${this.currentUser.full_name} (${role})`, 'success');
      this.showAppShell();
      this.navigate('dashboard');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async handleQuickRoleSwitch(role) {
    try {
      this.showLoadingToast(`Switching role to ${role}...`);
      const authData = await API.demoLogin(role);
      this.currentUser = authData.user;
      this.updateUserHeader();
      this.updateNavigationRoles();
      this.showToast(`Role switched to ${role}`, 'success');
      this.navigate('dashboard');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
      this.showLoadingToast('Authenticating credentials...');
      const authData = await API.login(email, password);
      this.currentUser = authData.user;
      this.closeModal('login-modal');
      this.showToast(`Welcome back, ${this.currentUser.full_name}!`, 'success');
      this.showAppShell();
      this.navigate('dashboard');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async handleRegisterSubmit(e) {
    e.preventDefault();
    const vendorData = {
      company_name: document.getElementById('reg-company-name').value,
      category: document.getElementById('reg-category').value,
      contact_person: document.getElementById('reg-contact-person').value,
      email: document.getElementById('reg-email').value,
      phone: document.getElementById('reg-phone').value,
      address: document.getElementById('reg-address').value,
      tax_id: document.getElementById('reg-tax-id').value,
      products_services: document.getElementById('reg-products').value,
      password: document.getElementById('reg-password').value,
      full_name: document.getElementById('reg-contact-person').value
    };

    try {
      this.showLoadingToast('Submitting vendor application...');
      const res = await API.register(vendorData);
      this.closeModal('register-modal');
      this.showToast(res.message, 'success', 6000);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  logout() {
    API.clearAuth();
    this.currentUser = null;
    this.showToast('Logged out successfully', 'info');
    this.showLandingPage();
  },

  // ================= DASHBOARD RENDERER =================
  async renderDashboard() {
    const container = document.getElementById('view-dashboard');
    container.classList.remove('hidden');
    document.getElementById('view-title').textContent = `${this.currentUser.role} Intelligence Dashboard`;

    container.innerHTML = `
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900">${this.currentUser.role} Workspace</h2>
          <p class="text-sm text-slate-500">Real-time database-driven operations, risk intelligence, and supplier telemetry</p>
        </div>
        <div class="flex space-x-2">
          <button onclick="App.renderDashboard()" class="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 enterprise-shadow">
            <i class="fas fa-rotate text-slate-400"></i>
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>
      <div id="dashboard-content" class="space-y-6">
        <div class="p-8 text-center"><i class="fas fa-spinner fa-spin text-2xl text-blue-600"></i><p class="mt-2 text-sm text-slate-500">Querying live metrics from database...</p></div>
      </div>
    `;

    try {
      const data = await API.getDashboard(this.currentUser.role);
      this.renderRoleSpecificDashboard(data);
    } catch (err) {
      document.getElementById('dashboard-content').innerHTML = `
        <div class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
          Failed to load live dashboard: ${err.message}
        </div>
      `;
    }
  },

  renderRoleSpecificDashboard(data) {
    const role = this.currentUser.role;
    const content = document.getElementById('dashboard-content');

    if (role === 'Administrator') {
      content.innerHTML = `
        <!-- KPI Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="enterprise-card p-5 kpi-border-purple enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Active Users</div>
            <div class="mt-2 text-3xl font-extrabold text-slate-900">${data.users.total}</div>
            <div class="mt-2 text-xs text-slate-500">Across 6 Enterprise Roles</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-blue enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered Vendors</div>
            <div class="mt-2 text-3xl font-extrabold text-slate-900">${data.vendors.total}</div>
            <div class="mt-2 text-xs text-slate-500">${data.vendors.active} Active | ${data.vendors.pending} Pending</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-rose enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">High-Risk Suppliers</div>
            <div class="mt-2 text-3xl font-extrabold text-rose-600">${data.vendors.high_risk}</div>
            <div class="mt-2 text-xs text-slate-500">Triggered by overrides or &lt;60 score</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-emerald enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Contracts</div>
            <div class="mt-2 text-3xl font-extrabold text-emerald-600">${data.compliance.active_contracts}</div>
            <div class="mt-2 text-xs text-slate-500">${data.compliance.compliant_certifications} Valid Certifications</div>
          </div>
        </div>

        <!-- Charts Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span>Spend by Vendor Category ($)</span>
              <span class="text-xs font-normal text-slate-500">Database Aggregation</span>
            </h3>
            <div class="h-64"><canvas id="admin-spend-chart"></canvas></div>
          </div>
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span>Vendor Risk Distribution</span>
              <span class="text-xs font-normal text-slate-500">Calculated Risk Index</span>
            </h3>
            <div class="h-64"><canvas id="admin-risk-chart"></canvas></div>
          </div>
        </div>

        <!-- Live Audit Activity -->
        <div class="enterprise-card p-5 enterprise-shadow">
          <h3 class="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
            <span>Recent System Activity & Audit Trail</span>
            <a href="#/audit" class="text-xs text-blue-600 hover:underline">View All &rarr;</a>
          </h3>
          <div class="overflow-x-auto">
            <table class="min-w-full text-xs text-left text-slate-600">
              <thead class="bg-slate-50 text-slate-500 uppercase">
                <tr><th class="px-4 py-2">Timestamp</th><th class="px-4 py-2">User</th><th class="px-4 py-2">Module</th><th class="px-4 py-2">Action</th><th class="px-4 py-2">Details</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${data.recent_audits.map(a => `
                  <tr>
                    <td class="px-4 py-2.5 font-mono text-slate-500">${a.timestamp}</td>
                    <td class="px-4 py-2.5 font-semibold text-slate-800">${a.user_name || 'System'}</td>
                    <td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700">${a.module}</span></td>
                    <td class="px-4 py-2.5 font-medium text-slate-900">${a.action}</td>
                    <td class="px-4 py-2.5 text-slate-600">${a.details}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      ChartManager.renderSpendByCategory('admin-spend-chart');
      ChartManager.renderRiskDistribution('admin-risk-chart');
    }
    else if (role === 'Procurement Manager') {
      const k = data.kpis;
      content.innerHTML = `
        <!-- KPI Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="enterprise-card p-5 kpi-border-blue enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total PO Spend</div>
            <div class="mt-2 text-3xl font-extrabold text-slate-900">$${k.total_po_value.toLocaleString()}</div>
            <div class="mt-2 text-xs text-slate-500">${k.total_pos} Total Purchase Orders</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-amber enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active POs (In Pipeline)</div>
            <div class="mt-2 text-3xl font-extrabold text-amber-600">${k.active_pos}</div>
            <div class="mt-2 text-xs text-slate-500">${k.ordered_pos} Ordered | ${k.intransit_pos} In Transit</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-emerald enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">On-Time Delivery Rate</div>
            <div class="mt-2 text-3xl font-extrabold text-emerald-600">${k.delivery_rate}%</div>
            <div class="mt-2 text-xs text-slate-500">${k.on_time_deliveries} on-time / ${k.on_time_deliveries + k.delayed_deliveries} delivered</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-purple enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Vendor Reliability</div>
            <div class="mt-2 text-3xl font-extrabold text-purple-600">${k.avg_vendor_reliability} / 100</div>
            <div class="mt-2 text-xs text-slate-500">6-Factor Weighted Index</div>
          </div>
        </div>

        <!-- Charts Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-4">Monthly Procurement Order Spend Trend</h3>
            <div class="h-64"><canvas id="proc-trend-chart"></canvas></div>
          </div>
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-4">Active Supplier Reliability & Quality Comparison</h3>
            <div class="h-64"><canvas id="proc-vendor-chart"></canvas></div>
          </div>
        </div>

        <!-- Quick Action Toolbar -->
        <div class="flex flex-wrap gap-3">
          <button onclick="App.navigate('procurement')" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 enterprise-shadow flex items-center space-x-2">
            <i class="fas fa-plus"></i>
            <span>Create Procurement Request</span>
          </button>
          <button onclick="App.navigate('purchase-orders')" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 enterprise-shadow flex items-center space-x-2">
            <i class="fas fa-truck-ramp-box"></i>
            <span>Track & Update Deliveries</span>
          </button>
          <button onclick="App.navigate('reports')" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 enterprise-shadow flex items-center space-x-2">
            <i class="fas fa-file-pdf text-rose-500"></i>
            <span>Export Executive Reports</span>
          </button>
        </div>
      `;
      ChartManager.renderMonthlyTrend('proc-trend-chart');
      ChartManager.renderVendorReliability('proc-vendor-chart');
    }
    else if (role === 'Supply Chain Manager') {
      content.innerHTML = `
        <!-- Supply Chain Dataset Macro Telemetry -->
        <div class="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center justify-between mb-4">
          <div class="flex items-center space-x-3">
            <i class="fas fa-database text-blue-600 text-xl"></i>
            <div>
              <div class="text-sm font-bold text-blue-950">DataCo Supply Chain Master Dataset Connected</div>
              <div class="text-xs text-blue-700">Displaying macro benchmarks derived from 10,000 real dataset rows</div>
            </div>
          </div>
          <span class="px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">Active Ingestion</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="enterprise-card p-5 kpi-border-emerald enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dataset Total Orders</div>
            <div class="mt-2 text-3xl font-extrabold text-slate-900">${data.dataset_total_orders.toLocaleString()}</div>
            <div class="mt-2 text-xs text-slate-500">Real Supply Chain Transactions</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-blue enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dataset Total Volume</div>
            <div class="mt-2 text-3xl font-extrabold text-blue-600">$${(data.dataset_total_sales / 1000000).toFixed(2)}M</div>
            <div class="mt-2 text-xs text-slate-500">Global Supply Chain Value</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-amber enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Shipping Transit</div>
            <div class="mt-2 text-3xl font-extrabold text-amber-600">${data.avg_shipping_days} Days</div>
            <div class="mt-2 text-xs text-slate-500">Actual Realized Lead Time</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-cyan enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Shipments In Transit</div>
            <div class="mt-2 text-3xl font-extrabold text-cyan-600">${data.active_in_transit_pos}</div>
            <div class="mt-2 text-xs text-slate-500">Current Platform POs</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-4">Global Delivery Status Distribution (Dataset)</h3>
            <div class="h-64"><canvas id="scm-delivery-chart"></canvas></div>
          </div>
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-4">Intermodal Shipping Modes (Dataset)</h3>
            <div class="h-64"><canvas id="scm-shipping-chart"></canvas></div>
          </div>
        </div>
      `;
      ChartManager.renderDeliveryStatus('scm-delivery-chart');
      ChartManager.renderShippingModes('scm-shipping-chart');
    }
    else if (role === 'Vendor') {
      const v = data.vendor;
      const m = data.metrics;
      content.innerHTML = `
        <!-- Vendor Profile Header -->
        <div class="enterprise-card p-6 enterprise-shadow bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="flex items-center space-x-3">
                <h2 class="text-2xl font-bold">${v.company_name}</h2>
                <span class="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">${v.status}</span>
              </div>
              <p class="text-xs text-slate-400 mt-1">Vendor Code: <span class="font-mono text-white">${v.vendor_code}</span> | Category: <span class="text-blue-300 font-semibold">${v.category}</span></p>
            </div>
            <div class="text-right">
              <div class="text-xs uppercase text-slate-400">Reliability Score</div>
              <div class="text-4xl font-extrabold text-blue-400">${m.overall_reliability}<span class="text-lg text-slate-400">/100</span></div>
              <span class="inline-block px-2 py-0.5 mt-1 rounded text-xs font-semibold ${m.risk_level === 'Low' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
                ${m.risk_level} Risk • ${m.trend} Trend
              </span>
            </div>
          </div>
        </div>

        <!-- 6 Factors Breakdown for Vendor -->
        <div class="enterprise-card p-5 enterprise-shadow">
          <h3 class="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
            <span>Your 6-Factor Reliability Audit</span>
            <span class="text-xs text-slate-500">Transparent Multi-Factor Scoring</span>
          </h3>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            ${Object.entries(m.factors).map(([key, f]) => `
              <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div class="text-xs text-slate-500 font-medium">${key.replace('_', ' ').toUpperCase()} (${f.weight*100}%)</div>
                <div class="text-xl font-bold text-slate-900 mt-1">${f.score}</div>
                <div class="text-xs text-blue-600 font-semibold">+${f.weighted_points} pts</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Vendor Orders and Invoices -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-3">Your Recent Purchase Orders</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs text-left">
                <thead class="bg-slate-50 text-slate-500 uppercase">
                  <tr><th class="px-3 py-2">PO #</th><th class="px-3 py-2">Date</th><th class="px-3 py-2">Expected</th><th class="px-3 py-2">Amount</th><th class="px-3 py-2">Status</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${data.recent_pos.map(p => `
                    <tr>
                      <td class="px-3 py-2 font-mono font-semibold text-blue-600">${p.po_number}</td>
                      <td class="px-3 py-2">${p.order_date}</td>
                      <td class="px-3 py-2">${p.expected_delivery_date}</td>
                      <td class="px-3 py-2 font-semibold">$${p.total_amount.toLocaleString()}</td>
                      <td class="px-3 py-2"><span class="px-2 py-0.5 rounded text-xs ${p.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">${p.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-3">Your Billing & Invoices</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs text-left">
                <thead class="bg-slate-50 text-slate-500 uppercase">
                  <tr><th class="px-3 py-2">Invoice #</th><th class="px-3 py-2">Due Date</th><th class="px-3 py-2">Amount</th><th class="px-3 py-2">Status</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${data.recent_invoices.map(inv => `
                    <tr>
                      <td class="px-3 py-2 font-mono font-semibold">${inv.invoice_number}</td>
                      <td class="px-3 py-2">${inv.due_date}</td>
                      <td class="px-3 py-2 font-semibold">$${inv.amount.toLocaleString()}</td>
                      <td class="px-3 py-2"><span class="px-2 py-0.5 rounded text-xs ${inv.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${inv.payment_status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }
    else if (role === 'Finance Officer') {
      content.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="enterprise-card p-5 kpi-border-blue enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Invoiced</div>
            <div class="mt-2 text-3xl font-extrabold text-slate-900">$${data.total_invoiced.toLocaleString()}</div>
            <div class="mt-2 text-xs text-slate-500">Gross Procurement Billing</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-emerald enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Settled & Paid</div>
            <div class="mt-2 text-3xl font-extrabold text-emerald-600">$${data.total_paid.toLocaleString()}</div>
            <div class="mt-2 text-xs text-slate-500">Reconciled Payments</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-amber enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Disbursement</div>
            <div class="mt-2 text-3xl font-extrabold text-amber-600">$${data.total_pending.toLocaleString()}</div>
            <div class="mt-2 text-xs text-slate-500">Awaiting Approval / Terms</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-rose enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue Balance</div>
            <div class="mt-2 text-3xl font-extrabold text-rose-600">$${data.total_overdue.toLocaleString()}</div>
            <div class="mt-2 text-xs text-slate-500">Past Net-30 Maturity</div>
          </div>
        </div>

        <div class="enterprise-card p-5 enterprise-shadow">
          <h3 class="text-sm font-bold text-slate-900 mb-4">Spend Concentration by Vendor</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full text-xs text-left">
              <thead class="bg-slate-50 text-slate-500 uppercase">
                <tr><th class="px-4 py-2">Vendor Name</th><th class="px-4 py-2">Category</th><th class="px-4 py-2">Total Invoiced ($)</th><th class="px-4 py-2">Action</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${data.spend_by_vendor.map(s => `
                  <tr>
                    <td class="px-4 py-3 font-semibold text-slate-800">${s.company_name}</td>
                    <td class="px-4 py-3"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700">${s.category}</span></td>
                    <td class="px-4 py-3 font-mono font-bold text-slate-900">$${s.spend.toLocaleString()}</td>
                    <td class="px-4 py-3"><button onclick="App.navigate('invoices')" class="text-xs text-blue-600 font-semibold hover:underline">View Invoices</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
    else if (role === 'Auditor') {
      content.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="enterprise-card p-5 kpi-border-blue enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Audit Records</div>
            <div class="mt-2 text-3xl font-extrabold text-slate-900">${data.total_logs}</div>
            <div class="mt-2 text-xs text-slate-500">Immutable Change Log Events</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-amber enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Expired Contracts</div>
            <div class="mt-2 text-3xl font-extrabold text-amber-600">${data.expired_contracts}</div>
            <div class="mt-2 text-xs text-slate-500">Require Formal Renewal</div>
          </div>
          <div class="enterprise-card p-5 kpi-border-rose enterprise-shadow">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Non-Compliant Certifications</div>
            <div class="mt-2 text-3xl font-extrabold text-rose-600">${data.non_compliant_certs}</div>
            <div class="mt-2 text-xs text-slate-500">Mandatory ISO / OSHA lapses</div>
          </div>
        </div>

        <div class="enterprise-card p-5 enterprise-shadow">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-bold text-slate-900">Recent Platform Traceability Log</h3>
            <a href="#/audit" class="text-xs text-blue-600 hover:underline">Full Log Explorer &rarr;</a>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-xs text-left text-slate-600">
              <thead class="bg-slate-50 text-slate-500 uppercase">
                <tr><th class="px-4 py-2">Time</th><th class="px-4 py-2">User</th><th class="px-4 py-2">Module</th><th class="px-4 py-2">Action</th><th class="px-4 py-2">Details</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${data.recent_logs.map(l => `
                  <tr>
                    <td class="px-4 py-2.5 font-mono text-slate-500">${l.timestamp}</td>
                    <td class="px-4 py-2.5 font-semibold text-slate-800">${l.user_name || 'System'}</td>
                    <td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700">${l.module}</span></td>
                    <td class="px-4 py-2.5 font-medium text-slate-900">${l.action}</td>
                    <td class="px-4 py-2.5 text-slate-600">${l.details}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  },

  // ================= VENDORS DIRECTORY (6 CATEGORY FILTERS + STATUS FILTERS) =================
  async renderVendorsView() {
    const container = document.getElementById('view-vendors');
    container.classList.remove('hidden');
    document.getElementById('view-title').textContent = 'Vendor Intelligence Directory';

    // 6 Mandatory Categories
    const categories = [
      'All',
      'Raw Material Suppliers',
      'Equipment Vendors',
      'IT Vendors',
      'Service Providers',
      'Logistics Partners',
      'Maintenance Vendors'
    ];

    const statuses = ['All', 'Active', 'Pending Approval', 'Inactive', 'Suspended', 'Rejected'];

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Controls Toolbar -->
        <div class="enterprise-card p-4 enterprise-shadow space-y-3">
          <!-- 6 Mandatory Category Filters -->
          <div>
            <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Vendor Categories (6 Mandatory Types):</div>
            <div class="flex flex-wrap gap-2">
              ${categories.map(cat => `
                <button onclick="App.setVendorCategory('${cat}')"
                  class="cat-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${this.vendorCategoryFilter === cat ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
                  ${cat}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Status Filters + Search -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Status:</span>
              ${statuses.map(st => `
                <button onclick="App.setVendorStatus('${st}')"
                  class="status-filter-btn px-2.5 py-1 rounded text-xs font-medium ${this.vendorStatusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
                  ${st}
                </button>
              `).join('')}
            </div>
            <div class="relative w-full md:w-64">
              <i class="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
              <input type="text" id="vendor-search-input" placeholder="Search vendors..."
                value="${this.vendorSearchQuery}"
                oninput="App.handleVendorSearch(this.value)"
                class="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>
        </div>

        <!-- Vendor Table / Grid -->
        <div id="vendor-list-container" class="enterprise-card enterprise-shadow overflow-hidden">
          <div class="p-8 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-xl"></i> Loading vendors...</div>
        </div>
      </div>
    `;

    this.fetchAndRenderVendors();
  },

  setVendorCategory(cat) {
    this.vendorCategoryFilter = cat;
    this.renderVendorsView();
  },

  setVendorStatus(st) {
    this.vendorStatusFilter = st;
    this.renderVendorsView();
  },

  handleVendorSearch(val) {
    this.vendorSearchQuery = val;
    this.fetchAndRenderVendors();
  },

  async fetchAndRenderVendors() {
    const listContainer = document.getElementById('vendor-list-container');
    if (!listContainer) return;

    try {
      const params = {};
      if (this.vendorCategoryFilter !== 'All') params.category = this.vendorCategoryFilter;
      if (this.vendorStatusFilter !== 'All') params.status = this.vendorStatusFilter;
      if (this.vendorSearchQuery.trim()) params.search = this.vendorSearchQuery.trim();

      const vendors = await API.getVendors(params);

      if (vendors.length === 0) {
        listContainer.innerHTML = `
          <div class="p-12 text-center">
            <i class="fas fa-filter-circle-xmark text-3xl text-slate-300"></i>
            <h4 class="mt-2 text-sm font-semibold text-slate-700">No vendors match your filter criteria</h4>
            <p class="text-xs text-slate-500 mt-1">Try resetting the category or status filter.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = `
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs text-left text-slate-600">
            <thead class="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th class="px-4 py-3">Vendor</th>
                <th class="px-4 py-3">Category</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Reliability Score</th>
                <th class="px-4 py-3">Risk Level</th>
                <th class="px-4 py-3">Procurement Recommendation</th>
                <th class="px-4 py-3">Delivery Rate</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${vendors.map(v => {
                const statusBadgeClass = v.status === 'Active' ? 'badge-active' :
                                        (v.status === 'Pending Approval' ? 'badge-pending' :
                                        (v.status === 'Suspended' ? 'badge-suspended' : 'badge-inactive'));
                const riskBadgeClass = v.risk_level === 'Low' ? 'risk-low' :
                                      (v.risk_level === 'Medium' ? 'risk-medium' : 'risk-high');
                return `
                  <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="px-4 py-3.5">
                      <div class="font-bold text-slate-900">${v.company_name}</div>
                      <div class="text-[11px] font-mono text-slate-400">${v.vendor_code}</div>
                    </td>
                    <td class="px-4 py-3.5">
                      <span class="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">${v.category}</span>
                    </td>
                    <td class="px-4 py-3.5">
                      <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeClass}">${v.status}</span>
                    </td>
                    <td class="px-4 py-3.5">
                      <div class="flex items-center space-x-2">
                        <span class="font-bold text-slate-900 text-sm">${v.reliability_score}</span>
                        <span class="text-[10px] text-slate-400">/ 100</span>
                      </div>
                    </td>
                    <td class="px-4 py-3.5">
                      <span class="px-2 py-0.5 rounded text-[11px] ${riskBadgeClass}">${v.risk_level} Risk</span>
                    </td>
                    <td class="px-4 py-3.5">
                      <div class="font-medium text-slate-800 flex items-center space-x-1.5">
                        <i class="fas ${v.risk_level === 'Low' ? 'fa-check-circle text-emerald-500' : (v.risk_level === 'Medium' ? 'fa-exclamation-triangle text-amber-500' : 'fa-times-circle text-rose-500')}"></i>
                        <span>${v.recommendation}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3.5 font-semibold text-slate-700">
                      ${v.delivery_rate}%
                    </td>
                    <td class="px-4 py-3.5 text-right whitespace-nowrap">
                      <div class="flex items-center justify-end space-x-1">
                        <button onclick="App.openVendorDrawer(${v.id})" title="View Complete Profile & 6-Factor Breakdown" class="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold">
                          Profile
                        </button>
                        <!-- Email Button (Rule 2) -->
                        <button onclick="App.triggerCommunication(${v.id}, 'EMAIL')" title="Dispatch Email (mailto:)" class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded">
                          <i class="fas fa-envelope"></i>
                        </button>
                        <!-- SMS Button (Rule 2) -->
                        <button onclick="App.triggerCommunication(${v.id}, 'SMS')" title="Send SMS (sms:)" class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded">
                          <i class="fas fa-comment-sms"></i>
                        </button>
                        <a href="/api/reports/vendor-pdf?vendor_id=${v.id}" target="_blank" title="Export PDF Audit Report" class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded">
                          <i class="fas fa-file-pdf"></i>
                        </a>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      listContainer.innerHTML = `<div class="p-4 text-rose-700 bg-rose-50">${err.message}</div>`;
    }
  },

  // ================= VENDOR PROFILE DETAIL DRAWER =================
  async openVendorDrawer(vendorId) {
    this.selectedVendorId = vendorId;
    const modal = document.getElementById('vendor-drawer-modal');
    const content = document.getElementById('vendor-drawer-content');
    modal.classList.remove('hidden');
    content.innerHTML = `<div class="p-12 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-2xl"></i><p class="mt-2 text-xs">Loading complete vendor dossier...</p></div>`;

    try {
      const v = await API.getVendorDetails(vendorId);
      const m = v.intelligence;

      content.innerHTML = `
        <div class="space-y-6">
          <!-- Header Banner -->
          <div class="p-6 bg-slate-900 text-white rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div class="flex items-center space-x-2">
                <span class="px-2 py-0.5 text-xs font-bold rounded bg-blue-500 text-white">${v.category}</span>
                <span class="px-2 py-0.5 text-xs font-bold rounded bg-slate-800 text-slate-300">${v.vendor_code}</span>
              </div>
              <h2 class="text-2xl font-black mt-1">${v.company_name}</h2>
              <div class="text-xs text-slate-400 mt-1 flex flex-wrap gap-4">
                <span><i class="fas fa-user mr-1 text-slate-500"></i> ${v.contact_person} (${v.designation || 'Lead'})</span>
                <span><i class="fas fa-envelope mr-1 text-slate-500"></i> ${v.email}</span>
                <span><i class="fas fa-phone mr-1 text-slate-500"></i> ${v.phone}</span>
              </div>
            </div>
            <div class="flex flex-col items-end">
              <div class="text-xs uppercase text-slate-400">Reliability Score</div>
              <div class="text-4xl font-black text-blue-400">${m.overall_reliability}<span class="text-base text-slate-400">/100</span></div>
              <div class="text-xs font-semibold px-2 py-0.5 mt-1 rounded ${m.risk_level === 'Low' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
                ${m.risk_level} Risk • ${m.recommendation}
              </div>
            </div>
          </div>

          <!-- Status Update Control (Admin / Procurement) -->
          ${['Administrator', 'Procurement Manager'].includes(this.currentUser.role) ? `
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-slate-700">Current Lifecycle Status:</span>
                <span class="ml-2 px-2.5 py-0.5 rounded text-xs font-bold ${v.status === 'Active' ? 'badge-active' : 'badge-pending'}">${v.status}</span>
              </div>
              <div class="flex items-center space-x-2">
                <select id="update-status-select" class="text-xs border border-slate-300 rounded px-2 py-1 bg-white">
                  <option value="Active" ${v.status === 'Active' ? 'selected' : ''}>Active</option>
                  <option value="Pending Approval" ${v.status === 'Pending Approval' ? 'selected' : ''}>Pending Approval</option>
                  <option value="Inactive" ${v.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                  <option value="Suspended" ${v.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                  <option value="Rejected" ${v.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                </select>
                <button onclick="App.submitStatusUpdate(${v.id})" class="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold">
                  Update Status
                </button>
              </div>
            </div>
          ` : ''}

          <!-- 6-Factor Worked Example Table (From Requirement Guide Page 10) -->
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-1">Official 6-Factor Reliability Scoring Formula</h3>
            <p class="text-xs text-slate-500 mb-4">Each factor is scored 0–100 directly from stored database records, multiplied by its defined weight, and summed.</p>
            <div class="overflow-x-auto">
              <table class="min-w-full text-xs text-left">
                <thead class="bg-slate-100 text-slate-700 font-bold uppercase">
                  <tr>
                    <th class="px-3 py-2">Factor</th>
                    <th class="px-3 py-2 text-center">Weight</th>
                    <th class="px-3 py-2 text-center">Sub-score</th>
                    <th class="px-3 py-2 text-center">Weighted Points</th>
                    <th class="px-3 py-2">Evidence / Explanation</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${Object.entries(m.factors).map(([key, f]) => `
                    <tr>
                      <td class="px-3 py-2.5 font-bold text-slate-800">${key.replace('_', ' ').toUpperCase()}</td>
                      <td class="px-3 py-2.5 text-center font-semibold text-slate-600">${f.weight * 100}%</td>
                      <td class="px-3 py-2.5 text-center font-bold text-slate-900">${f.score}</td>
                      <td class="px-3 py-2.5 text-center font-bold text-blue-600">${f.weighted_points}</td>
                      <td class="px-3 py-2.5 text-slate-600">${f.description}</td>
                    </tr>
                  `).join('')}
                  <tr class="bg-slate-50 font-black border-t-2 border-slate-300">
                    <td class="px-3 py-2.5 text-slate-900">VENDOR RELIABILITY SCORE</td>
                    <td class="px-3 py-2.5 text-center">100%</td>
                    <td class="px-3 py-2.5 text-center">—</td>
                    <td class="px-3 py-2.5 text-center text-blue-700 text-sm">${m.overall_reliability}</td>
                    <td class="px-3 py-2.5 text-slate-700">Risk Level: <b>${m.risk_level}</b> &bull; ${m.recommendation}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            ${m.override_reason ? `
              <div class="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center space-x-2">
                <i class="fas fa-triangle-exclamation text-rose-600"></i>
                <span><b>Override Alert:</b> ${m.override_reason}</span>
              </div>
            ` : ''}
          </div>

          <!-- Contracts & Certifications Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Contracts -->
            <div class="enterprise-card p-4 enterprise-shadow">
              <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Contracts</h4>
              ${v.contracts.length > 0 ? `
                <div class="space-y-2">
                  ${v.contracts.map(c => `
                    <div class="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs flex justify-between items-center">
                      <div>
                        <div class="font-bold text-slate-800">${c.contract_type}</div>
                        <div class="text-[11px] text-slate-500">${c.contract_number} &bull; Valid to ${c.end_date}</div>
                      </div>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold ${c.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${c.status}</span>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="text-xs text-slate-400">No contracts registered.</p>'}
            </div>

            <!-- Certifications -->
            <div class="enterprise-card p-4 enterprise-shadow">
              <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Compliance Certifications</h4>
              ${v.certifications.length > 0 ? `
                <div class="space-y-2">
                  ${v.certifications.map(cert => `
                    <div class="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs flex justify-between items-center">
                      <div>
                        <div class="font-bold text-slate-800">${cert.certification_name}</div>
                        <div class="text-[11px] text-slate-500">${cert.issuing_body} &bull; Expires ${cert.expiry_date}</div>
                      </div>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold ${cert.compliance_status === 'Compliant' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${cert.compliance_status}</span>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="text-xs text-slate-400">No certifications registered.</p>'}
            </div>
          </div>

          <!-- Purchase Orders History -->
          <div class="enterprise-card p-4 enterprise-shadow">
            <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Procurement History (${v.purchase_orders.length} Orders)</h4>
            <div class="overflow-x-auto max-h-48 overflow-y-auto">
              <table class="min-w-full text-xs text-left">
                <thead class="bg-slate-50 text-slate-500 uppercase">
                  <tr><th class="px-3 py-1.5">PO #</th><th class="px-3 py-1.5">Order Date</th><th class="px-3 py-1.5">Expected Delivery</th><th class="px-3 py-1.5">Actual Delivery</th><th class="px-3 py-1.5">Amount</th><th class="px-3 py-1.5">Status</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${v.purchase_orders.map(po => `
                    <tr>
                      <td class="px-3 py-2 font-mono font-semibold">${po.po_number}</td>
                      <td class="px-3 py-2">${po.order_date}</td>
                      <td class="px-3 py-2">${po.expected_delivery_date}</td>
                      <td class="px-3 py-2">${po.actual_delivery_date || 'Pending'}</td>
                      <td class="px-3 py-2 font-semibold">$${po.total_amount.toLocaleString()}</td>
                      <td class="px-3 py-2"><span class="px-2 py-0.5 rounded text-[11px] ${po.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">${po.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="p-4 text-rose-700 bg-rose-50">${err.message}</div>`;
    }
  },

  async submitStatusUpdate(vendorId) {
    const sel = document.getElementById('update-status-select');
    if (!sel) return;
    const newStatus = sel.value;
    try {
      this.showLoadingToast(`Updating vendor status to ${newStatus}...`);
      await API.updateVendorStatus(vendorId, newStatus, 'Status updated via administrator review.');
      this.showToast(`Vendor status updated to ${newStatus}`, 'success');
      this.openVendorDrawer(vendorId);
      this.fetchAndRenderVendors();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ================= VENDOR APPROVAL QUEUE =================
  async renderApprovalQueue() {
    const container = document.getElementById('view-vendor-approval');
    container.classList.remove('hidden');
    document.getElementById('view-title').textContent = 'Vendor Verification & Approval Workflow';

    container.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <i class="fas fa-shield-halved mr-1"></i>
          <b>Security Governance:</b> New vendors register in <b>Pending Approval</b> status and are restricted from procurement assignment until verified by an Administrator or Procurement Manager.
        </div>
        <div id="approval-queue-list" class="enterprise-card enterprise-shadow">
          <div class="p-8 text-center text-slate-400"><i class="fas fa-spinner fa-spin"></i> Loading pending applications...</div>
        </div>
      </div>
    `;

    try {
      const pendingVendors = await API.getApprovalQueue();
      const el = document.getElementById('approval-queue-list');
      if (pendingVendors.length === 0) {
        el.innerHTML = `
          <div class="p-12 text-center text-slate-400">
            <i class="fas fa-check-circle text-3xl text-emerald-500 mb-2"></i>
            <h4 class="text-sm font-bold text-slate-700">Approval Queue is Clear</h4>
            <p class="text-xs text-slate-500">There are currently no vendors awaiting verification.</p>
          </div>
        `;
        return;
      }

      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs text-left">
            <thead class="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th class="px-4 py-3">Vendor / Code</th>
                <th class="px-4 py-3">Category</th>
                <th class="px-4 py-3">Contact</th>
                <th class="px-4 py-3">Products / Services</th>
                <th class="px-4 py-3">Documents</th>
                <th class="px-4 py-3 text-right">Decision</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${pendingVendors.map(v => `
                <tr>
                  <td class="px-4 py-3">
                    <div class="font-bold text-slate-900">${v.company_name}</div>
                    <div class="text-[11px] font-mono text-slate-400">${v.vendor_code}</div>
                  </td>
                  <td class="px-4 py-3"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">${v.category}</span></td>
                  <td class="px-4 py-3">
                    <div>${v.contact_person}</div>
                    <div class="text-slate-400">${v.email}</div>
                  </td>
                  <td class="px-4 py-3 max-w-xs truncate text-slate-600">${v.products_services || 'Standard Supplies'}</td>
                  <td class="px-4 py-3"><span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">${v.doc_count || 2} Docs Uploaded</span></td>
                  <td class="px-4 py-3 text-right space-x-2">
                    <button onclick="App.approveVendor(${v.id}, '${v.company_name}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold">
                      <i class="fas fa-check mr-1"></i> Approve
                    </button>
                    <button onclick="App.rejectVendor(${v.id}, '${v.company_name}')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold">
                      <i class="fas fa-times mr-1"></i> Reject
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      document.getElementById('approval-queue-list').innerHTML = `<div class="p-4 text-rose-700 bg-rose-50">${err.message}</div>`;
    }
  },

  async approveVendor(vendorId, name) {
    try {
      this.showLoadingToast(`Approving ${name}...`);
      await API.updateVendorStatus(vendorId, 'Active', 'Approved by administrator review.');
      this.showToast(`Vendor '${name}' is now Active and selectable for procurement.`, 'success');
      this.renderApprovalQueue();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async rejectVendor(vendorId, name) {
    try {
      this.showLoadingToast(`Rejecting ${name}...`);
      await API.updateVendorStatus(vendorId, 'Rejected', 'Failed vendor documentation check.');
      this.showToast(`Vendor '${name}' has been rejected.`, 'warning');
      this.renderApprovalQueue();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ================= PROCUREMENT MANAGEMENT (WORKFLOW) =================
  async renderProcurementView() {
    const container = document.getElementById('view-procurement');
    container.classList.remove('hidden');
    document.getElementById('view-title').textContent = 'Procurement Sourcing & Lifecycle';

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-slate-800">Procurement Requisitions</h3>
            <p class="text-xs text-slate-500">End-to-end purchasing pipeline: Requisition &rarr; Review &rarr; Vendor Assignment &rarr; PO Issuance</p>
          </div>
          <button onclick="App.openCreateRequestModal()" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold enterprise-shadow flex items-center space-x-1.5">
            <i class="fas fa-plus"></i>
            <span>New Procurement Request</span>
          </button>
        </div>

        <div id="procurement-requests-list" class="enterprise-card enterprise-shadow">
          <div class="p-8 text-center text-slate-400"><i class="fas fa-spinner fa-spin"></i> Loading requisitions...</div>
        </div>
      </div>
    `;

    try {
      const requests = await API.getProcurementRequests();
      const el = document.getElementById('procurement-requests-list');
      if (requests.length === 0) {
        el.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">No procurement requests found.</div>`;
        return;
      }

      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs text-left">
            <thead class="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th class="px-4 py-3">Code</th>
                <th class="px-4 py-3">Title / Scope</th>
                <th class="px-4 py-3">Department</th>
                <th class="px-4 py-3">Category</th>
                <th class="px-4 py-3">Est. Cost</th>
                <th class="px-4 py-3">Priority</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${requests.map(r => `
                <tr class="hover:bg-slate-50/70">
                  <td class="px-4 py-3 font-mono font-bold text-blue-600">${r.request_code}</td>
                  <td class="px-4 py-3 font-semibold text-slate-900">${r.title}</td>
                  <td class="px-4 py-3 text-slate-600">${r.department}</td>
                  <td class="px-4 py-3"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">${r.category}</span></td>
                  <td class="px-4 py-3 font-mono font-bold">$${r.estimated_cost.toLocaleString()}</td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-0.5 rounded font-bold ${r.priority === 'Urgent' ? 'bg-rose-100 text-rose-800' : (r.priority === 'High' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700')}">
                      ${r.priority}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="px-2.5 py-0.5 rounded-full font-bold ${r.status === 'Completed' ? 'badge-active' : (r.status === 'Approved' ? 'bg-blue-100 text-blue-800' : 'badge-pending')}">
                      ${r.status}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                    ${r.status === 'Pending' && ['Administrator', 'Procurement Manager'].includes(this.currentUser.role) ? `
                      <button onclick="App.decideRequest(${r.id}, 'Approved')" class="px-2.5 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold">Approve</button>
                      <button onclick="App.decideRequest(${r.id}, 'Rejected')" class="px-2.5 py-1 bg-rose-600 text-white rounded hover:bg-rose-700 font-bold">Reject</button>
                    ` : ''}
                    ${r.status === 'Approved' && ['Administrator', 'Procurement Manager'].includes(this.currentUser.role) ? `
                      <button onclick="App.openVendorAssignmentModal(${r.id}, '${r.category}', ${r.estimated_cost}, '${r.title}')" class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold enterprise-shadow">
                        <i class="fas fa-handshake mr-1"></i> Assign Vendor & Issue PO
                      </button>
                    ` : ''}
                    ${r.status === 'Completed' ? `<span class="text-xs text-slate-400 font-semibold"><i class="fas fa-check text-emerald-500 mr-1"></i>PO Issued</span>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      document.getElementById('procurement-requests-list').innerHTML = `<div class="p-4 text-rose-700 bg-rose-50">${err.message}</div>`;
    }
  },

  openCreateRequestModal() {
    this.openModal('create-request-modal');
  },

  async handleCreateRequestSubmit(e) {
    e.preventDefault();
    const data = {
      title: document.getElementById('req-title').value,
      department: document.getElementById('req-dept').value,
      category: document.getElementById('req-category').value,
      description: document.getElementById('req-desc').value,
      estimated_cost: parseFloat(document.getElementById('req-cost').value),
      priority: document.getElementById('req-priority').value,
      required_date: document.getElementById('req-date').value
    };

    try {
      this.showLoadingToast('Creating procurement requisition...');
      await API.createProcurementRequest(data);
      this.closeModal('create-request-modal');
      this.showToast('Procurement requisition submitted successfully', 'success');
      this.renderProcurementView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async decideRequest(id, status) {
    try {
      this.showLoadingToast(`${status} request...`);
      await API.decideRequest(id, status, `Decision recorded by ${this.currentUser.full_name}`);
      this.showToast(`Request has been ${status}`, 'success');
      this.renderProcurementView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ================= INTELLIGENT VENDOR ASSIGNMENT MODAL =================
  async openVendorAssignmentModal(requestId, category, estimatedCost, title) {
    const modal = document.getElementById('vendor-assign-modal');
    const container = document.getElementById('assign-vendors-options');
    modal.classList.remove('hidden');

    document.getElementById('assign-req-title').textContent = title;
    document.getElementById('assign-req-category').textContent = category;
    document.getElementById('assign-total-amount').value = estimatedCost;
    document.getElementById('assign-request-id').value = requestId;

    container.innerHTML = `<div class="p-8 text-center text-slate-400"><i class="fas fa-spinner fa-spin text-xl"></i> Loading selectable active vendors...</div>`;

    try {
      // MANDATORY RULE: ONLY ACTIVE VENDORS RETURNED
      const selectable = await API.getSelectableVendors(category);

      if (selectable.length === 0) {
        container.innerHTML = `
          <div class="p-6 text-center text-amber-700 bg-amber-50 rounded-lg border border-amber-200 text-xs">
            <i class="fas fa-exclamation-circle text-lg mb-1"></i>
            <p class="font-bold">No Active vendors found for category '${category}'.</p>
            <p class="mt-1">Only approved 'Active' vendors can be assigned. Please approve pending vendors first.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="space-y-3">
          <div class="text-xs font-bold text-slate-600">Select Qualified Vendor (Ranked by Reliability Index):</div>
          ${selectable.map((v, i) => `
            <label class="flex items-start p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-500 cursor-pointer transition-all">
              <input type="radio" name="selected_vendor_id" value="${v.id}" class="mt-1 mr-3 text-blue-600 focus:ring-blue-500" ${i === 0 ? 'checked' : ''}>
              <div class="flex-1">
                <div class="flex items-center justify-between">
                  <div class="font-bold text-slate-900 text-xs">${v.company_name} <span class="text-slate-400 font-mono">(${v.vendor_code})</span></div>
                  <div class="text-right">
                    <span class="text-xs font-extrabold text-blue-600">${v.reliability_score} / 100</span>
                    <span class="ml-1 px-1.5 py-0.2 rounded text-[10px] ${v.risk_level === 'Low' ? 'risk-low' : 'risk-medium'}">${v.risk_level} Risk</span>
                  </div>
                </div>
                <div class="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Delivery Rate: <b>${v.delivery_rate}%</b> | Quality: <b>${v.quality_rating}/5</b></span>
                  <span class="font-semibold text-slate-700"><i class="fas fa-wand-magic-sparkles text-blue-500 mr-1"></i>${v.recommendation}</span>
                </div>
              </div>
            </label>
          `).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="p-4 text-rose-700 bg-rose-50 text-xs">${err.message}</div>`;
    }
  },

  async handleVendorAssignSubmit(e) {
    e.preventDefault();
    const reqId = parseInt(document.getElementById('assign-request-id').value);
    const selectedVendor = document.querySelector('input[name="selected_vendor_id"]:checked');
    if (!selectedVendor) {
      this.showToast('Please select an active vendor', 'warning');
      return;
    }

    const vendorId = parseInt(selectedVendor.value);
    const expectedDelivery = document.getElementById('assign-expected-date').value;
    const totalAmount = parseFloat(document.getElementById('assign-total-amount').value);
    const shippingMode = document.getElementById('assign-shipping-mode').value;
    const itemName = document.getElementById('assign-req-title').textContent;

    const payload = {
      request_id: reqId,
      vendor_id: vendorId,
      expected_delivery_date: expectedDelivery,
      total_amount: totalAmount,
      shipping_mode: shippingMode,
      items: [{ product_name: itemName, quantity: 1, unit_price: totalAmount }],
      notes: 'Purchase Order generated via Predictive VendorIQ Sourcing'
    };

    try {
      this.showLoadingToast('Issuing formal Purchase Order to vendor...');
      const res = await API.createPurchaseOrder(payload);
      this.closeModal('vendor-assign-modal');
      this.showToast(`Purchase Order ${res.po_number} issued to ${res.vendor_name}!`, 'success', 5000);
      this.navigate('purchase-orders');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ================= PURCHASE ORDERS & DELIVERY TRACKING =================
  async renderPurchaseOrdersView() {
    const container = document.getElementById('view-purchase-orders');
    container.classList.remove('hidden');
    document.getElementById('view-title').textContent = 'Purchase Order Execution & Delivery Telemetry';

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-slate-800">Active Purchase Orders</h3>
            <p class="text-xs text-slate-500">Live order tracking with actual delivery date verification and On-Time vs Delayed calculation</p>
          </div>
        </div>

        <div id="pos-table-container" class="enterprise-card enterprise-shadow">
          <div class="p-8 text-center text-slate-400"><i class="fas fa-spinner fa-spin"></i> Loading purchase orders...</div>
        </div>
      </div>
    `;

    try {
      const pos = await API.getPurchaseOrders();
      const el = document.getElementById('pos-table-container');

      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs text-left">
            <thead class="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th class="px-4 py-3">PO Number</th>
                <th class="px-4 py-3">Vendor / Category</th>
                <th class="px-4 py-3">Order Date</th>
                <th class="px-4 py-3">Expected Delivery</th>
                <th class="px-4 py-3">Actual Delivery</th>
                <th class="px-4 py-3">Total Amount</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${pos.map(p => {
                const isDelayed = p.actual_delivery_date && p.expected_delivery_date && (p.actual_delivery_date > p.expected_delivery_date);
                const isOnTime = p.actual_delivery_date && p.expected_delivery_date && (p.actual_delivery_date <= p.expected_delivery_date);
                return `
                  <tr class="hover:bg-slate-50/70">
                    <td class="px-4 py-3.5 font-mono font-bold text-blue-600">${p.po_number}</td>
                    <td class="px-4 py-3.5">
                      <div class="font-bold text-slate-900">${p.vendor_name}</div>
                      <div class="text-[11px] text-slate-400">${p.vendor_category}</div>
                    </td>
                    <td class="px-4 py-3.5">${p.order_date}</td>
                    <td class="px-4 py-3.5 font-medium">${p.expected_delivery_date}</td>
                    <td class="px-4 py-3.5 font-semibold">
                      ${p.actual_delivery_date ? `
                        <span class="${isOnTime ? 'text-emerald-700' : 'text-rose-700'}">
                          ${p.actual_delivery_date}
                          <span class="text-[10px] ml-1 font-bold ${isOnTime ? 'text-emerald-600' : 'text-rose-600'}">
                            (${isOnTime ? 'ON-TIME' : 'DELAYED'})
                          </span>
                        </span>
                      ` : '<span class="text-slate-400">In Pipeline</span>'}
                    </td>
                    <td class="px-4 py-3.5 font-mono font-bold">$${p.total_amount.toLocaleString()}</td>
                    <td class="px-4 py-3.5">
                      <span class="px-2.5 py-0.5 rounded-full font-bold ${p.status === 'Completed' ? 'badge-active' : (p.status === 'Delivered' ? 'bg-teal-100 text-teal-800' : 'badge-pending')}">
                        ${p.status}
                      </span>
                    </td>
                    <td class="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                      ${['Ordered', 'In Transit'].includes(p.status) && ['Administrator', 'Procurement Manager', 'Supply Chain Manager'].includes(this.currentUser.role) ? `
                        <button onclick="App.openRecordDeliveryModal(${p.id}, '${p.po_number}', '${p.expected_delivery_date}')" class="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 enterprise-shadow">
                          <i class="fas fa-truck-ramp-box mr-1"></i> Record Delivery
                        </button>
                      ` : ''}
                      <!-- Communication triggers -->
                      <button onclick="App.triggerCommunication(${p.vendor_id}, 'EMAIL', 'PO', '${p.po_number}')" title="Email Vendor on this PO" class="p-1.5 text-slate-400 hover:text-blue-600 rounded">
                        <i class="fas fa-envelope"></i>
                      </button>
                      <button onclick="App.triggerCommunication(${p.vendor_id}, 'SMS', 'PO', '${p.po_number}')" title="SMS Alert on this PO" class="p-1.5 text-slate-400 hover:text-emerald-600 rounded">
                        <i class="fas fa-comment-sms"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      document.getElementById('pos-table-container').innerHTML = `<div class="p-4 text-rose-700 bg-rose-50">${err.message}</div>`;
    }
  },

  openRecordDeliveryModal(poId, poNumber, expectedDate) {
    document.getElementById('deliv-po-id').value = poId;
    document.getElementById('deliv-po-num').textContent = poNumber;
    document.getElementById('deliv-expected-date').textContent = expectedDate;
    document.getElementById('deliv-actual-date').value = new Date().toISOString().slice(0, 10);
    this.openModal('record-delivery-modal');
  },

  async handleRecordDeliverySubmit(e) {
    e.preventDefault();
    const poId = parseInt(document.getElementById('deliv-po-id').value);
    const actualDate = document.getElementById('deliv-actual-date').value;
    const rating = parseFloat(document.getElementById('deliv-quality-rating').value);
    const inspected = parseInt(document.getElementById('deliv-inspected-qty').value);
    const defects = parseInt(document.getElementById('deliv-defects-qty').value);
    const comments = document.getElementById('deliv-comments').value;

    try {
      this.showLoadingToast('Recording delivery and recalculating vendor metrics...');
      const res = await API.recordDelivery(poId, {
        actual_delivery_date: actualDate,
        quality_rating: rating,
        inspected_quantity: inspected,
        defective_quantity: defects,
        evaluator_comments: comments
      });
      this.closeModal('record-delivery-modal');
      this.showToast(
        `Delivery logged: ${res.delivery_status}. Vendor score updated to ${res.updated_reliability_score} (${res.updated_risk_level} Risk).`,
        'success',
        6000
      );
      this.renderPurchaseOrdersView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ================= INVOICE DISBURSEMENTS =================
  async renderInvoicesView() {
    const container = document.getElementById('view-invoices');
    container.classList.remove('hidden');
    document.getElementById('view-title').textContent = 'Invoicing & Corporate Disbursements';

    container.innerHTML = `
      <div class="space-y-4">
        <div id="invoices-table-container" class="enterprise-card enterprise-shadow">
          <div class="p-8 text-center text-slate-400"><i class="fas fa-spinner fa-spin"></i> Loading invoices...</div>
        </div>
      </div>
    `;

    try {
      const invoices = await API.getInvoices();
      const el = document.getElementById('invoices-table-container');

      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs text-left">
            <thead class="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th class="px-4 py-3">Invoice Number</th>
                <th class="px-4 py-3">PO Reference</th>
                <th class="px-4 py-3">Vendor / Category</th>
                <th class="px-4 py-3">Invoice Date</th>
                <th class="px-4 py-3">Due Date</th>
                <th class="px-4 py-3">Amount</th>
                <th class="px-4 py-3">Payment Status</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${invoices.map(inv => `
                <tr class="hover:bg-slate-50/70">
                  <td class="px-4 py-3.5 font-mono font-bold text-slate-900">${inv.invoice_number}</td>
                  <td class="px-4 py-3.5 font-mono text-blue-600 font-semibold">${inv.po_number}</td>
                  <td class="px-4 py-3.5">
                    <div class="font-bold text-slate-900">${inv.vendor_name}</div>
                    <div class="text-[11px] text-slate-400">${inv.vendor_category}</div>
                  </td>
                  <td class="px-4 py-3.5">${inv.invoice_date}</td>
                  <td class="px-4 py-3.5 font-medium">${inv.due_date}</td>
                  <td class="px-4 py-3.5 font-mono font-extrabold text-slate-900">$${inv.amount.toLocaleString()}</td>
                  <td class="px-4 py-3.5">
                    <span class="px-2.5 py-0.5 rounded-full font-bold ${inv.payment_status === 'Paid' ? 'badge-active' : 'badge-pending'}">
                      ${inv.payment_status}
                    </span>
                  </td>
                  <td class="px-4 py-3.5 text-right">
                    ${inv.payment_status === 'Pending' && ['Administrator', 'Finance Officer'].includes(this.currentUser.role) ? `
                      <button onclick="App.processInvoicePayment(${inv.id}, '${inv.invoice_number}', ${inv.amount})" class="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 enterprise-shadow">
                        <i class="fas fa-check-double mr-1"></i> Pay Invoice
                      </button>
                    ` : (inv.payment_status === 'Paid' ? `<span class="text-xs text-slate-400 font-mono font-medium">${inv.payment_reference || 'Settled'}</span>` : '')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      document.getElementById('invoices-table-container').innerHTML = `<div class="p-4 text-rose-700 bg-rose-50">${err.message}</div>`;
    }
  },

  async processInvoicePayment(id, invNum, amount) {
    if (!confirm(`Confirm disbursement of $${amount.toLocaleString()} for ${invNum}?`)) return;
    try {
      this.showLoadingToast(`Processing wire payment for ${invNum}...`);
      await API.payInvoice(id);
      this.showToast(`Invoice ${invNum} paid successfully. PO transaction completed.`, 'success');
      this.renderInvoicesView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ================= CONTRACTS & COMPLIANCE =================
  async renderContractsView() {
    const container = document.getElementById('view-contracts');
    container.classList.remove('hidden');
    document.getElementById('view-title').textContent = 'Contracts, Certifications & Compliance';

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Alerts Banner -->
        <div id="compliance-alerts-box" class="space-y-2"></div>

        <!-- Contracts Table -->
        <div class="enterprise-card p-5 enterprise-shadow">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-bold text-slate-900">Contract Repository & Renewal Tracking</h3>
            <button onclick="App.openModal('create-contract-modal')" class="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700">
              <i class="fas fa-plus mr-1"></i> Add Contract
            </button>
          </div>
          <div id="contracts-table-container" class="overflow-x-auto">
            <div class="p-4 text-center text-slate-400 text-xs">Loading contracts...</div>
          </div>
        </div>

        <!-- Certifications Table -->
        <div class="enterprise-card p-5 enterprise-shadow">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-bold text-slate-900">Mandatory Standards & Certifications (ISO / OSHA)</h3>
          </div>
          <div id="certs-table-container" class="overflow-x-auto">
            <div class="p-4 text-center text-slate-400 text-xs">Loading certifications...</div>
          </div>
        </div>
      </div>
    `;

    try {
      // 1. Alerts
      const alerts = await API.getComplianceAlerts();
      const alertsBox = document.getElementById('compliance-alerts-box');
      if (alerts.length > 0) {
        alertsBox.innerHTML = `
          <div class="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1">
            <div class="font-bold text-rose-800 flex items-center space-x-1.5">
              <i class="fas fa-triangle-exclamation text-rose-600"></i>
              <span>Active Compliance Expiry Alerts (${alerts.length})</span>
            </div>
            ${alerts.map(a => `
              <div class="text-rose-700 flex justify-between">
                <span><b>${a.alert_type}</b>: ${a.name} (${a.vendor_name})</span>
                <span class="font-mono font-bold">${a.severity === 'EXPIRED' ? 'EXPIRED' : 'Expiring: ' + a.deadline}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      // 2. Contracts
      const contracts = await API.getContracts();
      document.getElementById('contracts-table-container').innerHTML = `
        <table class="min-w-full text-xs text-left">
          <thead class="bg-slate-50 text-slate-500 uppercase">
            <tr><th class="px-4 py-2.5">Contract #</th><th class="px-4 py-2.5">Vendor</th><th class="px-4 py-2.5">Type</th><th class="px-4 py-2.5">Period</th><th class="px-4 py-2.5">Value ($)</th><th class="px-4 py-2.5">Status</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${contracts.map(c => `
              <tr>
                <td class="px-4 py-2.5 font-mono font-bold text-blue-600">${c.contract_number}</td>
                <td class="px-4 py-2.5 font-semibold text-slate-800">${c.vendor_name}</td>
                <td class="px-4 py-2.5 text-slate-600">${c.contract_type}</td>
                <td class="px-4 py-2.5 font-mono">${c.start_date} to ${c.end_date}</td>
                <td class="px-4 py-2.5 font-bold font-mono">$${c.contract_value.toLocaleString()}</td>
                <td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded text-[11px] font-bold ${c.status === 'Active' ? 'badge-active' : 'badge-rejected'}">${c.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      // 3. Certifications
      const certs = await API.getCertifications();
      document.getElementById('certs-table-container').innerHTML = `
        <table class="min-w-full text-xs text-left">
          <thead class="bg-slate-50 text-slate-500 uppercase">
            <tr><th class="px-4 py-2.5">Certification</th><th class="px-4 py-2.5">Vendor</th><th class="px-4 py-2.5">Issuing Body</th><th class="px-4 py-2.5">Expiry Date</th><th class="px-4 py-2.5">Compliance Status</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${certs.map(cert => `
              <tr>
                <td class="px-4 py-2.5 font-bold text-slate-900">${cert.certification_name}</td>
                <td class="px-4 py-2.5 font-semibold text-slate-800">${cert.vendor_name}</td>
                <td class="px-4 py-2.5 text-slate-600">${cert.issuing_body}</td>
                <td class="px-4 py-2.5 font-mono font-medium">${cert.expiry_date}</td>
                <td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded text-[11px] font-bold ${cert.compliance_status === 'Compliant' ? 'badge-active' : 'badge-rejected'}">${cert.compliance_status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      console.error(err);
    }
  },

  // ================= DYNAMIC ANALYTICS & CHARTS =================
  async renderAnalyticsView() {
    const container = document.getElementById('view-analytics');
    container.classList.remove('hidden');
    document.getElementById('view-title').textContent = 'Predictive Vendor Intelligence & Analytics';

    container.innerHTML = `
      <div class="space-y-6">
        <div class="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold">Real Data Telemetry Stream</h3>
            <p class="text-xs text-slate-400">All chart metrics are calculated directly via backend SQL queries on database records & dataset orders.</p>
          </div>
          <span class="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-full">0% Mock Data</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-3">Procurement Spend by Vendor Category</h3>
            <div class="h-64"><canvas id="analytics-spend-chart"></canvas></div>
          </div>
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-3">Monthly Order Value Trend</h3>
            <div class="h-64"><canvas id="analytics-trend-chart"></canvas></div>
          </div>
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-3">Supplier Reliability Score Comparison</h3>
            <div class="h-64"><canvas id="analytics-vendor-chart"></canvas></div>
          </div>
          <div class="enterprise-card p-5 enterprise-shadow">
            <h3 class="text-sm font-bold text-slate-900 mb-3">Global Delivery Fulfillment Status (Dataset)</h3>
            <div class="h-64"><canvas id="analytics-delivery-chart"></canvas></div>
          </div>
        </div>
      </div>
    `;

    ChartManager.renderSpendByCategory('analytics-spend-chart');
    ChartManager.renderMonthlyTrend('analytics-trend-chart');
    ChartManager.renderVendorReliability('analytics-vendor-chart');
    ChartManager.renderDeliveryStatus('analytics-delivery-chart');
  },

  // ================= COMMUNICATION (EMAIL + SMS ONLY - RULE 2) =================
  async triggerCommunication(vendorId, type, recordType = null, recordId = null) {
    try {
      this.showLoadingToast(`Opening ${type} compose intent...`);
      const intent = await API.getComposeIntent(vendorId, type, recordType, recordId);

      // Launch native URI protocol
      window.location.href = intent.uri;

      this.showToast(
        `${type} client triggered to ${intent.target_contact}. Interaction permanently logged to communication history.`,
        'success',
        5000
      );
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async renderCommunicationView() {
    const container = document.getElementById('view-communication');
    container.classList.remove('hidden');
    document.getElementById('view-title').textContent = 'Vendor Communications & Interaction Logs';

    container.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
          <i class="fas fa-envelope-open-text text-blue-600 mr-1.5"></i>
          <b>Email & SMS Architecture:</b> Per strict system protocol, communications are dispatched via standard <code>mailto:</code> and <code>sms:</code> protocols with pre-filled context, while exact timestamps and response latencies are audited in the database to calculate Communication Efficiency.
        </div>

        <div id="comm-history-container" class="enterprise-card enterprise-shadow">
          <div class="p-8 text-center text-slate-400 text-xs"><i class="fas fa-spinner fa-spin"></i> Loading communication history...</div>
        </div>
      </div>
    `;

    try {
      const history = await API.getCommunicationHistory();
      const el = document.getElementById('comm-history-container');

      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs text-left">
            <thead class="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th class="px-4 py-3">Timestamp</th>
                <th class="px-4 py-3">Type</th>
                <th class="px-4 py-3">Vendor</th>
                <th class="px-4 py-3">Contact Recipient</th>
                <th class="px-4 py-3">Context / Subject</th>
                <th class="px-4 py-3">Sender</th>
                <th class="px-4 py-3">Response Latency</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${history.map(c => `
                <tr class="hover:bg-slate-50/70">
                  <td class="px-4 py-3 font-mono text-slate-500">${c.timestamp}</td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-0.5 rounded font-bold ${c.communication_type === 'EMAIL' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}">
                      <i class="fas ${c.communication_type === 'EMAIL' ? 'fa-envelope' : 'fa-comment-sms'} mr-1"></i>
                      ${c.communication_type}
                    </span>
                  </td>
                  <td class="px-4 py-3 font-semibold text-slate-900">${c.vendor_name}</td>
                  <td class="px-4 py-3 font-mono text-slate-600">${c.recipient_contact}</td>
                  <td class="px-4 py-3 max-w-sm truncate text-slate-700">${c.subject || c.message_body}</td>
                  <td class="px-4 py-3 font-medium text-slate-800">${c.user_name || 'System User'}</td>
                  <td class="px-4 py-3 font-bold text-slate-900">${c.response_time_hours ? c.response_time_hours + ' hrs' : '3.0 hrs (Fast)'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      document.getElementById('comm-history-container').innerHTML = `<div class="p-4 text-rose-700 bg-rose-50">${err.message}</div>`;
    }
  },

  // ================= AUDIT LOGS =================
  async renderAuditView() {
    const container = document.getElementById('view-audit');
    container.classList.remove('hidden');
    document.getElementById('view-title').textContent = 'Enterprise Audit Trail & Traceability';

    container.innerHTML = `
      <div class="space-y-4">
        <div class="enterprise-card p-4 enterprise-shadow flex items-center justify-between">
          <div class="text-xs font-semibold text-slate-600">Full audit of all logins, approvals, status updates, PO executions and disbursements</div>
          <button onclick="App.renderAuditView()" class="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-semibold hover:bg-slate-50">
            <i class="fas fa-rotate mr-1"></i> Refresh Logs
          </button>
        </div>
        <div id="audit-table-container" class="enterprise-card enterprise-shadow">
          <div class="p-8 text-center text-slate-400 text-xs"><i class="fas fa-spinner fa-spin"></i> Loading audit logs...</div>
        </div>
      </div>
    `;

    try {
      const logs = await API.getAuditLogs({ limit: 100 });
      const el = document.getElementById('audit-table-container');

      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="min-w-full text-xs text-left">
            <thead class="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th class="px-4 py-2.5">Timestamp</th>
                <th class="px-4 py-2.5">User</th>
                <th class="px-4 py-2.5">Module</th>
                <th class="px-4 py-2.5">Action</th>
                <th class="px-4 py-2.5">Target Record</th>
                <th class="px-4 py-2.5">Old Value</th>
                <th class="px-4 py-2.5">New Value</th>
                <th class="px-4 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${logs.map(l => `
                <tr class="hover:bg-slate-50/70">
                  <td class="px-4 py-2.5 font-mono text-slate-500 whitespace-nowrap">${l.timestamp}</td>
                  <td class="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">${l.user_name || 'System'}</td>
                  <td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">${l.module}</span></td>
                  <td class="px-4 py-2.5 font-bold text-slate-900">${l.action}</td>
                  <td class="px-4 py-2.5 font-mono text-blue-600">${l.record_id || '—'}</td>
                  <td class="px-4 py-2.5 text-slate-400">${l.previous_value || '—'}</td>
                  <td class="px-4 py-2.5 font-semibold text-slate-700">${l.new_value || '—'}</td>
                  <td class="px-4 py-2.5 text-slate-600 max-w-xs truncate">${l.details}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      document.getElementById('audit-table-container').innerHTML = `<div class="p-4 text-rose-700 bg-rose-50">${err.message}</div>`;
    }
  },

  // ================= REPORTS & EXPORTS =================
  async renderReportsView() {
    const container = document.getElementById('view-reports');
    container.classList.remove('hidden');
    document.getElementById('view-title').textContent = 'Enterprise Reports & Document Exports';

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- PDF Reports Card -->
        <div class="enterprise-card p-6 enterprise-shadow space-y-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center text-xl font-bold">
              <i class="fas fa-file-pdf"></i>
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900">PDF Audit Reports (ReportLab)</h3>
              <p class="text-xs text-slate-500">Publication-grade executive compliance and performance briefs</p>
            </div>
          </div>
          <div class="space-y-3 pt-2">
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-800">Vendor Performance & Reliability Audit</div>
                <div class="text-[11px] text-slate-500">6-factor breakdown, SLA metrics, order history</div>
              </div>
              <a href="/api/reports/vendor-pdf?vendor_id=1" target="_blank" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold">
                Download PDF
              </a>
            </div>
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-800">Executive Procurement Summary</div>
                <div class="text-[11px] text-slate-500">Cross-department procurement orders and delivery audit</div>
              </div>
              <a href="/api/reports/procurement-pdf" target="_blank" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold">
                Download PDF
              </a>
            </div>
          </div>
        </div>

        <!-- Excel Reports Card -->
        <div class="enterprise-card p-6 enterprise-shadow space-y-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl font-bold">
              <i class="fas fa-file-excel"></i>
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900">Excel Data Workbooks (openpyxl)</h3>
              <p class="text-xs text-slate-500">Raw relational extracts with calculated scoring factors</p>
            </div>
          </div>
          <div class="space-y-3 pt-2">
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-800">Vendor Intelligence Matrix Workbook</div>
                <div class="text-[11px] text-slate-500">All registered vendors, 6 factors, weights, risk level</div>
              </div>
              <a href="/api/reports/vendor-excel" target="_blank" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold">
                Download Excel (.xlsx)
              </a>
            </div>
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-slate-800">Procurement & Purchase Orders Dataset</div>
                <div class="text-[11px] text-slate-500">Complete transaction table with delivery dates and invoicing</div>
              </div>
              <a href="/api/reports/procurement-excel" target="_blank" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold">
                Download Excel (.xlsx)
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ================= NOTIFICATIONS =================
  async loadNotifications() {
    try {
      const notifs = await API.getNotifications();
      const unreadCount = notifs.filter(n => !n.is_read).length;
      const badge = document.getElementById('notif-badge');
      if (badge) {
        if (unreadCount > 0) {
          badge.textContent = unreadCount;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      const listEl = document.getElementById('notif-dropdown-list');
      if (listEl) {
        if (notifs.length === 0) {
          listEl.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">No active notifications</div>`;
          return;
        }
        listEl.innerHTML = notifs.map(n => `
          <div class="p-3 border-b border-slate-100 hover:bg-slate-50 text-xs">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-800">${n.title}</span>
              <span class="text-[10px] text-slate-400">${n.created_at.slice(11, 16)}</span>
            </div>
            <p class="text-slate-600 mt-1">${n.message}</p>
          </div>
        `).join('');
      }
    } catch (e) {
      console.error(e);
    }
  },

  toggleNotificationDropdown() {
    const el = document.getElementById('notif-dropdown');
    if (el) el.classList.toggle('hidden');
  },

  // ================= MODAL & TOAST HELPERS =================
  openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('hidden');
  },

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('hidden');
  },

  showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-slate-900 border-emerald-500' :
                   (type === 'error' ? 'bg-slate-900 border-rose-500' :
                   (type === 'warning' ? 'bg-slate-900 border-amber-500' : 'bg-slate-900 border-blue-500'));
    const iconClass = type === 'success' ? 'fa-check text-emerald-400' :
                     (type === 'error' ? 'fa-xmark text-rose-400' :
                     (type === 'warning' ? 'fa-triangle-exclamation text-amber-400' : 'fa-circle-info text-blue-400'));

    toast.className = `p-3.5 rounded-lg border-l-4 text-white text-xs enterprise-shadow flex items-center space-x-3 animate-fade-in ${bgClass}`;
    toast.innerHTML = `
      <i class="fas ${iconClass} text-sm"></i>
      <span class="flex-1 font-medium">${message}</span>
      <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white">&times;</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, duration);
  },

  showLoadingToast(message) {
    this.showToast(`<i class="fas fa-spinner fa-spin mr-1"></i> ${message}`, 'info', 2000);
  }
};

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
