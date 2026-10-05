/**
 * VendorIQ REST API Client
 */
const API = {
  TOKEN_KEY: 'vendoriq_token',
  USER_KEY: 'vendoriq_user',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setAuth(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  getCurrentUser() {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      if (response.status === 401) {
        this.clearAuth();
        window.dispatchEvent(new CustomEvent('auth:expired'));
        throw new Error('Session expired. Please log in again.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // Auth
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setAuth(data.access_token, data.user);
    return data;
  },

  async demoLogin(role) {
    const data = await this.request('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role })
    });
    this.setAuth(data.access_token, data.user);
    return data;
  },

  async register(vendorData) {
    return await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(vendorData)
    });
  },

  async getMe() {
    return await this.request('/api/auth/me');
  },

  // Vendors
  async getVendors(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/api/vendors?${query}`);
  },

  async getVendorDetails(id) {
    return await this.request(`/api/vendors/${id}`);
  },

  async getApprovalQueue() {
    return await this.request('/api/vendors/approval-queue');
  },

  async updateVendorStatus(id, status, notes = '') {
    return await this.request(`/api/vendors/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, notes })
    });
  },

  // Procurement
  async getProcurementRequests(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/api/procurement/requests?${query}`);
  },

  async createProcurementRequest(data) {
    return await this.request('/api/procurement/requests', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async decideProcurementRequest(id, status, comments = '') {
    return await this.request(`/api/procurement/requests/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ status, comments })
    });
  },

  async getSelectableVendors(category = null) {
    const url = category ? `/api/procurement/selectable-vendors?category=${encodeURIComponent(category)}` : '/api/procurement/selectable-vendors';
    return await this.request(url);
  },

  async createPurchaseOrder(data) {
    return await this.request('/api/procurement/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getPurchaseOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/api/procurement/purchase-orders?${query}`);
  },

  async getPurchaseOrderDetail(id) {
    return await this.request(`/api/procurement/purchase-orders/${id}`);
  },

  async recordDelivery(id, deliveryData) {
    return await this.request(`/api/procurement/purchase-orders/${id}/deliver`, {
      method: 'POST',
      body: JSON.stringify(deliveryData)
    });
  },

  async getInvoices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/api/procurement/invoices?${query}`);
  },

  async payInvoice(id, reference = '') {
    return await this.request(`/api/procurement/invoices/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ payment_status: 'Paid', payment_reference: reference })
    });
  },

  // Performance & Reliability
  async getVendorPerformance(id) {
    return await this.request(`/api/performance/vendors/${id}`);
  },

  async getRankings(category = null) {
    const url = category ? `/api/performance/ranking?category=${encodeURIComponent(category)}` : '/api/performance/ranking';
    return await this.request(url);
  },

  async getTrends(id) {
    return await this.request(`/api/performance/trends/${id}`);
  },

  // Contracts & Compliance
  async getContracts(status = null) {
    const url = status ? `/api/compliance/contracts?status=${encodeURIComponent(status)}` : '/api/compliance/contracts';
    return await this.request(url);
  },

  async createContract(data) {
    return await this.request('/api/compliance/contracts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getCertifications() {
    return await this.request('/api/compliance/certifications');
  },

  async addCertification(data) {
    return await this.request('/api/compliance/certifications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getComplianceAlerts() {
    return await this.request('/api/compliance/alerts');
  },

  // Communication (Rule 2: Email + SMS)
  async getComposeIntent(vendorId, type, recordType = null, recordId = null) {
    const params = new URLSearchParams({
      vendor_id: vendorId,
      communication_type: type,
      ...(recordType ? { record_type: recordType } : {}),
      ...(recordId ? { record_id: recordId } : {})
    });
    return await this.request(`/api/communication/compose-intent?${params.toString()}`);
  },

  async getCommunicationHistory(vendorId = null) {
    const url = vendorId ? `/api/communication/history?vendor_id=${vendorId}` : '/api/communication/history';
    return await this.request(url);
  },

  // Dashboards
  async getDashboard(role) {
    const map = {
      'Administrator': '/api/dashboard/admin',
      'Procurement Manager': '/api/dashboard/procurement',
      'Supply Chain Manager': '/api/dashboard/supply-chain',
      'Vendor': '/api/dashboard/vendor',
      'Finance Officer': '/api/dashboard/finance',
      'Auditor': '/api/dashboard/auditor'
    };
    return await this.request(map[role] || '/api/dashboard/procurement');
  },

  // Dynamic Charts
  async getChartSpendByCategory() {
    return await this.request('/api/dashboard/charts/spend-by-category');
  },

  async getChartMonthlyTrend() {
    return await this.request('/api/dashboard/charts/monthly-trend');
  },

  async getChartDeliveryStatus() {
    return await this.request('/api/dashboard/charts/delivery-status');
  },

  async getChartVendorReliability() {
    return await this.request('/api/dashboard/charts/vendor-reliability-comparison');
  },

  async getChartRiskDistribution() {
    return await this.request('/api/dashboard/charts/risk-distribution');
  },

  async getChartShippingModes() {
    return await this.request('/api/dashboard/charts/shipping-modes');
  },

  // Audit & Notifications
  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/api/audit/logs?${query}`);
  },

  async getNotifications() {
    return await this.request('/api/audit/notifications');
  },

  async markNotificationRead(id) {
    return await this.request(`/api/audit/notifications/${id}/read`, { method: 'POST' });
  }
};
