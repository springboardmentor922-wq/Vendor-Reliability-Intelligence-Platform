const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('vendoriq_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If unauthorized, clear token and notify
    localStorage.removeItem('vendoriq_token');
    localStorage.removeItem('vendoriq_user');
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  // Handle file downloads/blobs
  if (options.responseType === 'blob') {
    if (!response.ok) {
      throw new Error('Failed to download report');
    }
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.detail || (typeof data === 'string' ? data : 'API Request failed');
    throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
  }
  return data;
}

export const api = {
  // Authentication
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  getMe: () => request('/auth/me'),
  getUsers: () => request('/auth/users'),
  updateUserRole: (userId, newRole) => request(`/auth/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ new_role: newRole }) }),


  // Dashboard
  getDashboardStats: () => request('/dashboard/stats'),

  // Vendors
  getPublicVendorShowcase: () => request('/vendors/public-showcase'),
  publicRegisterVendor: (vendorData) => request('/vendors/public-register', { method: 'POST', body: JSON.stringify(vendorData) }),
  getVendors: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.append('category', params.category);
    if (params.status) searchParams.append('status', params.status);
    if (params.search) searchParams.append('search', params.search);
    const query = searchParams.toString();
    return request(`/vendors${query ? `?${query}` : ''}`);
  },
  getVendorById: (id) => request(`/vendors/${id}`),
  createVendor: (vendorData) => request('/vendors', { method: 'POST', body: JSON.stringify(vendorData) }),
  updateVendor: (id, vendorData) => request(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(vendorData) }),
  updateVendorStatus: (id, statusData) => request(`/vendors/${id}/status`, { method: 'PATCH', body: JSON.stringify(statusData) }),

  // Procurement Requests
  getProcurementRequests: (status) => request(`/procurement/requests${status ? `?status=${status}` : ''}`),
  getPublicOpenRequests: (category) => request(`/procurement/public-open-requests${category ? `?category=${category}` : ''}`),
  acquireProcurementRequest: (reqId, vendorId) => request(`/procurement/requests/${reqId}/acquire?vendor_id=${vendorId}`, { method: 'POST' }),
  createProcurementRequest: (data) => request('/procurement/requests', { method: 'POST', body: JSON.stringify(data) }),
  updateProcurementRequestStatus: (id, statusData) => request(`/procurement/requests/${id}/status`, { method: 'PATCH', body: JSON.stringify(statusData) }),

  // Purchase Orders
  getPurchaseOrders: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    if (params.vendor_id) searchParams.append('vendor_id', params.vendor_id);
    const query = searchParams.toString();
    return request(`/procurement/orders${query ? `?${query}` : ''}`);
  },
  getPurchaseOrderById: (id) => request(`/procurement/orders/${id}`),
  createPurchaseOrder: (data) => request('/procurement/orders', { method: 'POST', body: JSON.stringify(data) }),
  updatePurchaseOrderStatus: (id, data) => request(`/procurement/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Invoices
  getInvoices: (status) => request(`/procurement/invoices${status ? `?status=${status}` : ''}`),
  createInvoice: (data) => request('/procurement/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoiceStatus: (id, data) => request(`/procurement/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Contracts & Compliance
  getContracts: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    if (params.vendor_id) searchParams.append('vendor_id', params.vendor_id);
    const query = searchParams.toString();
    return request(`/contracts${query ? `?${query}` : ''}`);
  },
  getContractById: (id) => request(`/contracts/${id}`),
  createContract: (data) => request('/contracts', { method: 'POST', body: JSON.stringify(data) }),
  getCertifications: (vendor_id) => request(`/contracts/compliance/certifications${vendor_id ? `?vendor_id=${vendor_id}` : ''}`),
  createCertification: (data) => request('/contracts/certifications', { method: 'POST', body: JSON.stringify(data) }),

  // Communication / Team Collaboration & Messages
  getConversations: () => request('/messages/conversations'),
  getVendorMessages: (vendorId) => request(`/messages/vendor/${vendorId}`),
  sendMessage: (data) => request('/messages', { method: 'POST', body: JSON.stringify(data) }),
  sendDirectEmail: (data) => request('/messages/send-email', { method: 'POST', body: JSON.stringify(data) }),
  getInternalChannels: () => request('/messages/internal/channels'),
  getInternalMessages: (channelId) => request(`/messages/internal/${channelId}`),
  sendInternalMessage: (data) => request('/messages/internal', { method: 'POST', body: JSON.stringify(data) }),



  // Predictive Analytics & Reliability
  getAnalyticsOverview: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.append('category', params.category);
    if (params.risk_level) searchParams.append('risk_level', params.risk_level);
    if (params.time_window) searchParams.append('time_window', params.time_window);
    const query = searchParams.toString();
    return request(`/analytics/overview${query ? `?${query}` : ''}`);
  },
  getVendorPerformance: (vendorId) => request(`/analytics/vendor-performance/${vendorId}`),
  predictPORisk: (data) => request('/analytics/predict-po-risk', { method: 'POST', body: JSON.stringify(data) }),
  getReportData: (reportType) => request(`/analytics/reports/data?report_type=${reportType}`),
  getExportReport: (reportType, format = 'csv') => {
    return request(`/analytics/reports/export?report_type=${reportType}&export_format=${format}`, {
      responseType: (format === 'csv' || format === 'excel') ? 'blob' : 'json'
    });
  },

  // Event-Driven Notifications & SMS Gateway
  getNotifications: () => request('/notifications'),
  scanAndTriggerNotifications: () => request('/notifications/scan-and-trigger', { method: 'POST' }),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/mark-all-read', { method: 'PATCH' }),
  getSMSLogs: () => request('/notifications/sms-logs'),
  sendSMSNotification: (data) => request('/notifications/send-sms', { method: 'POST', body: JSON.stringify(data) }),

  // Audit Logs
  getAuditLogs: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.entity) searchParams.append('entity', params.entity);
    if (params.action) searchParams.append('action', params.action);
    const query = searchParams.toString();
    return request(`/audit-logs${query ? `?${query}` : ''}`);
  },

  // Seed
  resetDatabase: () => request('/seed/reset', { method: 'POST' }),
};
