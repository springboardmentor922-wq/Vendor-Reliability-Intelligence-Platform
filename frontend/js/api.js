// Centralized API Client with JWT Bearer Interceptor

const API = {
    BASE_URL: '/api/v1',

    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(options.headers || {})
        };

        const config = {
            ...options,
            headers
        };

        try {
            const res = await fetch(`${this.BASE_URL}${endpoint}`, config);
            if (res.status === 401 || res.status === 403) {
                // If unauthorized or token expired, redirect to login
                localStorage.removeItem('token');
                window.location.href = 'index.html';
                return null;
            }
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `Request failed with status ${res.status}`);
            }
            return await res.json();
        } catch (error) {
            console.error(`API Error on ${endpoint}:`, error);
            throw error;
        }
    },

    // Analytics
    getSummary() {
        return this.request('/analytics/summary');
    },
    getCharts() {
        return this.request('/analytics/charts');
    },

    // Vendors
    getVendors(category = null, status = null, search = null) {
        let url = '/vendors/?';
        if (category && category !== 'All') url += `&category=${encodeURIComponent(category)}`;
        if (status && status !== 'All') url += `&status=${encodeURIComponent(status)}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        return this.request(url);
    },
    createVendor(vendorData) {
        return this.request('/vendors/', {
            method: 'POST',
            body: JSON.stringify(vendorData)
        });
    },

    // Purchase Orders & Role Workflow Methods
    getOrders(status = null) {
        let url = '/procurement/orders?';
        if (status && status !== 'All') url += `&status=${encodeURIComponent(status)}`;
        return this.request(url);
    },
    createOrder(orderData) {
        return this.request('/procurement/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    },
    updateOrderStatus(orderId, newStatus) {
        return this.request(`/procurement/orders/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
    },
    approveOrder(orderId) {
        return this.request(`/procurement/orders/${orderId}/approve`, {
            method: 'PATCH'
        });
    },
    dispatchOrder(orderId, carrierName, trackingNumber) {
        return this.request(`/procurement/orders/${orderId}/dispatch`, {
            method: 'PATCH',
            body: JSON.stringify({
                carrier_name: carrierName,
                tracking_number: trackingNumber
            })
        });
    },
    receiveOrderQA(orderId, qualityRating, qaNotes) {
        return this.request(`/procurement/orders/${orderId}/receive`, {
            method: 'PATCH',
            body: JSON.stringify({
                quality_rating: parseFloat(qualityRating),
                qa_notes: qaNotes
            })
        });
    },
    submitInvoice(orderId, invoiceNumber, invoiceAmount) {
        return this.request(`/procurement/orders/${orderId}/invoice`, {
            method: 'PATCH',
            body: JSON.stringify({
                invoice_number: invoiceNumber,
                invoice_amount: parseFloat(invoiceAmount)
            })
        });
    },
    authorizePayment(orderId, paymentNotes) {
        return this.request(`/procurement/orders/${orderId}/pay`, {
            method: 'PATCH',
            body: JSON.stringify({
                payment_notes: paymentNotes
            })
        });
    },
    cancelOrder(orderId) {
        return this.request(`/procurement/orders/${orderId}/cancel`, {
            method: 'PATCH'
        });
    },

    // Notifications
    getNotifications() {
        return this.request('/notifications/');
    },
    markNotificationsRead() {
        return this.request('/notifications/read-all', {
            method: 'PATCH'
        });
    },

    // Contracts
    getContracts(complianceStatus = null) {
        let url = '/contracts/?';
        if (complianceStatus && complianceStatus !== 'All') url += `&compliance_status=${encodeURIComponent(complianceStatus)}`;
        return this.request(url);
    },
    createContract(contractData) {
        return this.request('/contracts/', {
            method: 'POST',
            body: JSON.stringify(contractData)
        });
    }
};
