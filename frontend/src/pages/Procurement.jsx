import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { InvoicePDFModal } from '../components/InvoicePDFModal';

const VENDOR_CATEGORIES = [
  { label: 'Raw Materials', value: 'raw_material' },
  { label: 'Equipment', value: 'equipment' },
  { label: 'IT & Cloud', value: 'it' },
  { label: 'Service Providers', value: 'service_provider' },
  { label: 'Logistics', value: 'logistics' },
  { label: 'Maintenance', value: 'maintenance' }
];

const DEPARTMENTS = [
  'Operations',
  'Engineering',
  'IT Services',
  'Facilities',
  'Logistics',
  'Supply Chain',
  'Finance',
  'Production',
  'Maintenance'
];

const REQUEST_STATUS_PILLS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'Vendor Accepted', value: 'vendor_accepted' },
  { label: 'Finance Approved', value: 'finance_approved' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' }
];

const REQUEST_PRIORITY_PILLS = [
  { label: 'All', value: '' },
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' }
];

// PO status filter options
const PO_STATUS_PILLS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Ordered', value: 'ordered' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' }
];

const PAYMENT_TERMS_OPTIONS = ['Net 15', 'Net 30', 'Net 45', 'Net 60'];

export const Procurement = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active Tab: 'requests' | 'orders'
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam === 'requests' ? 'requests' : 'orders');

  // Search filter query
  const [globalSearch, setGlobalSearch] = useState('');

  // Data lists
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter pills
  const [requestStatusFilter, setRequestStatusFilter] = useState('');
  const [requestPriorityFilter, setRequestPriorityFilter] = useState('');
  const [poStatusFilter, setPOStatusFilter] = useState('');

  // Modals state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedPOForDetail, setSelectedPOForDetail] = useState(null);
  const [selectedInvoiceForPDF, setSelectedInvoiceForPDF] = useState(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // New Requisition Form State
  const [requestForm, setRequestForm] = useState({
    title: '',
    department: 'Operations',
    requested_by_name: user?.name || 'Aryan Singh',
    quantity: 1,
    needed_by: '',
    priority: 'Medium',
    category: 'raw_material',
    justification: '',
    budget_amount: '',
    specifications: '',
    location: '',
    is_multi_vendor: false,
    assigned_vendor_id: ''
  });

  const [treasury, setTreasury] = useState(null);

  // Direct Purchase Order Form State
  const [poForm, setPOForm] = useState({
    vendor_id: '',
    procurement_request_id: '',
    expected_delivery_date: '',
    payment_terms: 'Net 30',
    items: [{ item_name: '', quantity: 1, unit_price: 0 }]
  });

  // Invoice Form State
  const [invoiceForm, setInvoiceForm] = useState({
    purchase_order_id: '',
    amount: '',
    due_date: ''
  });

  const canManageProcurement = ['Administrator', 'Procurement Manager'].includes(user?.role);
  const canUpdateStatus = ['Administrator', 'Procurement Manager', 'Supply Chain Manager'].includes(user?.role);
  const canManageFinance = ['Administrator', 'Procurement Manager', 'Finance Officer'].includes(user?.role);

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const promises = [
        api.getProcurementRequests(),
        api.getPurchaseOrders(),
        api.getInvoices(),
        api.getVendors()
      ];
      if (['Administrator', 'Procurement Manager', 'Finance Officer'].includes(user?.role)) {
        promises.push(api.getCompanyTreasury().catch(() => null));
      }
      const [reqData, poData, invData, venData, treasuryData] = await Promise.all(promises);
      setRequests(reqData || []);
      setOrders(poData || []);
      setInvoices(invData || []);
      setVendors(venData || []);
      if (treasuryData) setTreasury(treasuryData);
    } catch (err) {
      setError(err.message || 'Failed to load procurement data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handle URL query parameters (e.g. from Vendor Management or Sidebar)
  useEffect(() => {
    const directVendorId = searchParams.get('directVendorId');
    const linkedReqId = searchParams.get('reqId');
    const tab = searchParams.get('tab');

    if (tab === 'orders') {
      setActiveTab('orders');
    } else if (tab === 'requests') {
      setActiveTab('requests');
    }

    if (directVendorId) {
      const linkedReq = requests.find(r => String(r.id) === String(linkedReqId));
      setPOForm({
        vendor_id: Number(directVendorId),
        procurement_request_id: linkedReqId ? Number(linkedReqId) : '',
        expected_delivery_date: linkedReq?.needed_by || '',
        payment_terms: 'Net 30',
        items: linkedReq ? [
          { item_name: linkedReq.title || 'Requisition Items', quantity: linkedReq.quantity || 1, unit_price: 1500 }
        ] : [
          { item_name: '', quantity: 1, unit_price: 0 }
        ]
      });
      setIsPOModalOpen(true);
    }
  }, [searchParams, requests]);

  // Request Handlers
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    try {
      await api.createProcurementRequest({
        title: requestForm.title,
        description: requestForm.justification || requestForm.title,
        department: requestForm.department,
        requested_by_name: requestForm.requested_by_name,
        quantity: Number(requestForm.quantity) || 1,
        needed_by: requestForm.needed_by || undefined,
        priority: requestForm.priority,
        category: requestForm.category,
        justification: requestForm.justification,
        budget_amount: requestForm.budget_amount ? Number(requestForm.budget_amount) : undefined,
        specifications: requestForm.specifications || undefined,
        location: requestForm.location || undefined,
        is_multi_vendor: Boolean(requestForm.is_multi_vendor),
        assigned_vendor_id: (!requestForm.is_multi_vendor && requestForm.assigned_vendor_id) ? Number(requestForm.assigned_vendor_id) : undefined
      });
      setIsRequestModalOpen(false);
      setRequestForm({
        title: '',
        department: 'Operations',
        requested_by_name: user?.name || 'Aryan Singh',
        quantity: 1,
        needed_by: '',
        priority: 'Medium',
        category: 'raw_material',
        justification: '',
        budget_amount: '',
        specifications: '',
        location: '',
        is_multi_vendor: false,
        assigned_vendor_id: ''
      });
      loadAllData();
      alert('Procurement request created successfully!');
    } catch (err) {
      alert('Error creating request: ' + err.message);
    }
  };

  const handleUpdateRequestStatus = async (reqId, status) => {
    try {
      await api.updateProcurementRequestStatus(reqId, { status });
      loadAllData();
    } catch (err) {
      alert('Error updating request status: ' + err.message);
    }
  };

  const handleVendorAccept = async (reqId) => {
    try {
      await api.vendorAcceptRequest(reqId);
      alert('Requisition accepted successfully! A payment authorization request has been routed to the Finance Manager.');
      loadAllData();
    } catch (err) {
      alert('Error accepting requisition: ' + err.message);
    }
  };

  const handleFinanceApprove = async (reqId) => {
    try {
      const res = await api.financeApproveRequest(reqId);
      alert(`Payment authorization approved! Purchase Order ${res.purchase_order?.po_number || ''} and Contract generated. Supplier notified.`);
      loadAllData();
    } catch (err) {
      alert('Finance authorization failed: ' + err.message);
    }
  };

  const handleFinanceReject = async (reqId) => {
    const reason = prompt('Please enter the reason for rejecting payment authorization:');
    if (reason === null) return;
    try {
      await api.financeRejectRequest(reqId, reason);
      alert('Payment authorization rejected.');
      loadAllData();
    } catch (err) {
      alert('Error rejecting payment: ' + err.message);
    }
  };

  // PO Line Items Handler
  const handleAddItem = () => {
    setPOForm({
      ...poForm,
      items: [...poForm.items, { item_name: '', quantity: 1, unit_price: 0 }]
    });
  };

  const handleRemoveItem = (index) => {
    if (poForm.items.length === 1) return;
    const newItems = poForm.items.filter((_, i) => i !== index);
    setPOForm({ ...poForm, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...poForm.items];
    newItems[index][field] = field === 'item_name' ? value : Number(value);
    setPOForm({ ...poForm, items: newItems });
  };

  const calculatePOTotal = () => {
    return poForm.items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
  };

  const handleCreatePO = async (e) => {
    e.preventDefault();
    if (!poForm.vendor_id) {
      alert('Please select an active vendor to assign this direct order.');
      return;
    }
    try {
      await api.createPurchaseOrder({
        vendor_id: Number(poForm.vendor_id),
        procurement_request_id: poForm.procurement_request_id ? Number(poForm.procurement_request_id) : undefined,
        expected_delivery_date: poForm.expected_delivery_date || undefined,
        payment_terms: poForm.payment_terms || 'Net 30',
        items: poForm.items
      });
      setIsPOModalOpen(false);
      setPOForm({
        vendor_id: '',
        procurement_request_id: '',
        expected_delivery_date: '',
        payment_terms: 'Net 30',
        items: [{ item_name: '', quantity: 1, unit_price: 0 }]
      });
      setActiveTab('orders');
      loadAllData();
    } catch (err) {
      alert('Error creating purchase order: ' + err.message);
    }
  };

  const handlePOStatusChange = async (orderId, newStatus) => {
    try {
      await api.updatePurchaseOrderStatus(orderId, { status: newStatus });
      loadAllData();
      if (selectedPOForDetail && selectedPOForDetail.id === orderId) {
        setSelectedPOForDetail({ ...selectedPOForDetail, status: newStatus });
      }
    } catch (err) {
      alert('Error changing PO status: ' + err.message);
    }
  };

  // Invoice Handlers
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    try {
      await api.createInvoice({
        purchase_order_id: Number(invoiceForm.purchase_order_id),
        amount: Number(invoiceForm.amount),
        due_date: invoiceForm.due_date
      });
      setIsInvoiceModalOpen(false);
      setInvoiceForm({ purchase_order_id: '', amount: '', due_date: '' });
      loadAllData();
      alert('Invoice created successfully!');
    } catch (err) {
      alert('Error generating invoice: ' + err.message);
    }
  };

  // Date formatting helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Currency formatted with Indian Rupee formatting e.g. ₹21,00,000, ₹60,000
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Status Badge for Purchase Orders
  const getPOStatusBadge = (status) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'pending') {
      return { label: 'Pending', dot: '#d97706', bg: '#fef3c7', text: '#92400e' };
    }
    if (s === 'approved') {
      return { label: 'Approved', dot: '#0284c7', bg: '#e0f2fe', text: '#0369a1' };
    }
    if (s === 'in_transit') {
      return { label: 'In Transit', dot: '#d97706', bg: '#fef3c7', text: '#b45309' };
    }
    if (s === 'ordered') {
      return { label: 'Ordered', dot: '#8b5cf6', bg: '#f3e8ff', text: '#6b21a8' };
    }
    if (s === 'delivered') {
      return { label: 'Delivered', dot: '#0d9488', bg: '#ccfbf1', text: '#0f766e' };
    }
    if (s === 'completed') {
      return { label: 'Completed', dot: '#16a34a', bg: '#dcfce7', text: '#166534' };
    }
    if (s === 'cancelled') {
      return { label: 'Cancelled', dot: '#ef4444', bg: '#fee2e2', text: '#991b1b' };
    }
    return { label: s.charAt(0).toUpperCase() + s.slice(1), dot: '#6b7280', bg: '#f3f4f6', text: '#374151' };
  };

  const getPriorityBadge = (priority) => {
    const p = (priority || 'medium').toLowerCase();
    if (p === 'urgent') return { label: 'Urgent', bg: '#fef2f2', text: '#991b1b', border: '#fecaca' };
    if (p === 'high') return { label: 'High', bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' };
    if (p === 'medium') return { label: 'Medium', bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' };
    return { label: 'Low', bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
  };

  const getRequestStatusBadge = (status) => {
    const s = (status || 'draft').toLowerCase();
    if (s === 'finance_approved') return { label: 'Finance Approved', dotColor: '#10b981', bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
    if (s === 'vendor_accepted') return { label: 'Vendor Accepted', dotColor: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' };
    if (s === 'assigned') return { label: 'Assigned', dotColor: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
    if (s === 'approved') return { label: 'Approved', dotColor: '#10b981', bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' };
    if (s === 'submitted' || s === 'pending') return { label: 'Submitted', dotColor: '#f59e0b', bg: '#fffbeb', text: '#92400e', border: '#fde68a' };
    if (s === 'draft') return { label: 'Draft', dotColor: '#6b7280', bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
    if (s === 'rejected') return { label: 'Rejected', dotColor: '#ef4444', bg: '#fef2f2', text: '#991b1b', border: '#fecaca' };
    return { label: s.charAt(0).toUpperCase() + s.slice(1), dotColor: '#6b7280', bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
  };

  const getCategoryLabel = (cat) => {
    const found = VENDOR_CATEGORIES.find(c => c.value === cat);
    return found ? found.label : (cat ? cat.replace('_', ' ') : 'General');
  };

  // Helper to format clean PO code e.g. PO-3530
  const getPOCode = (po) => {
    if (po.po_number && po.po_number.startsWith('PO-') && po.po_number.length <= 8) {
      return po.po_number;
    }
    return `PO-${3200 + po.id}`;
  };

  // Helper to summarize line items
  const getPOItemsSummary = (po) => {
    if (po.items && po.items.length > 0) {
      const firstName = po.items[0].item_name;
      if (po.items.length > 1) {
        return `${firstName} + ${po.items.length - 1} more`;
      }
      return firstName;
    }
    return 'General Procurement Supplies';
  };

  // Filtered lists
  const filteredRequests = requests.filter(r => {
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      const code = `req-${String(r.id).padStart(4, '0')}`;
      const match = r.title?.toLowerCase().includes(q) ||
                    r.department?.toLowerCase().includes(q) ||
                    r.requested_by_name?.toLowerCase().includes(q) ||
                    code.includes(q);
      if (!match) return false;
    }
    if (requestStatusFilter) {
      const s = (r.status || 'submitted').toLowerCase();
      if (requestStatusFilter === 'submitted' && s !== 'submitted' && s !== 'pending') return false;
      if (requestStatusFilter !== 'submitted' && s !== requestStatusFilter) return false;
    }
    if (requestPriorityFilter) {
      const p = (r.priority || 'medium').toLowerCase();
      if (p !== requestPriorityFilter) return false;
    }
    return true;
  });

  const filteredOrders = orders.filter(po => {
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      const poCode = getPOCode(po).toLowerCase();
      const vendorName = vendors.find(v => v.id === po.vendor_id)?.company_name?.toLowerCase() || '';
      const itemsSummary = getPOItemsSummary(po).toLowerCase();
      const match = poCode.includes(q) || vendorName.includes(q) || itemsSummary.includes(q);
      if (!match) return false;
    }
    if (poStatusFilter) {
      const s = (po.status || 'pending').toLowerCase();
      if (s !== poStatusFilter) return false;
    }
    return true;
  });

  const activeVendors = vendors.filter(v => (v.status || '').toLowerCase() === 'approved' || (v.status || '').toLowerCase() === 'active');

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Header and Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        marginBottom: '22px'
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
            Procurement
          </h1>
          <p style={{ fontSize: '13.5px', color: '#6b7280', margin: 0 }}>
            Raise requests, assign vendors, create purchase orders and track them through to invoice.
          </p>
        </div>

        {/* Search and Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Search Box in Header */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: '11px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none'
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search requests, POs, ve"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              style={{
                padding: '8px 12px 8px 34px',
                fontSize: '13px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: '#ffffff',
                color: '#1f2937',
                outline: 'none',
                width: '210px'
              }}
            />
          </div>

          {/* + Purchase order and + New request buttons: restricted to Procurement Manager & Admin */}
          {canManageProcurement && (
            <>
              <button
                onClick={() => {
                  setPOForm({
                    vendor_id: '',
                    procurement_request_id: '',
                    expected_delivery_date: '',
                    payment_terms: 'Net 30',
                    items: [{ item_name: '', quantity: 1, unit_price: 0 }]
                  });
                  setIsPOModalOpen(true);
                }}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>+</span>
                <span>New Procurement Acquisition</span>
              </button>

              <button
                onClick={() => setIsRequestModalOpen(true)}
                style={{
                  backgroundColor: '#0f3b33',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>+</span>
                <span>New Procurement Request</span>
              </button>
            </>
          )}
        </div>
      </div>

      {treasury && ['Administrator', 'Procurement Manager', 'Finance Officer'].includes(user?.role) && (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Company Treasury Status
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '2px' }}>
              <span style={{ fontSize: '14px', color: '#1e293b' }}>
                Available Balance: <strong style={{ color: '#0f766e', fontSize: '15px' }}>{formatCurrency(treasury.available_balance)}</strong>
              </span>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Total Allocated Budget: <strong>{formatCurrency(treasury.total_budget)}</strong>
              </span>
            </div>
          </div>
          <span style={{ fontSize: '12px', color: '#047857', backgroundColor: '#ecfdf5', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, border: '1px solid #a7f3d0' }}>
            Live Liquidity Verified
          </span>
        </div>
      )}

      {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '22px' }}>
        <button
          onClick={() => setActiveTab('requests')}
          style={{
            padding: '7px 16px',
            borderRadius: '6px',
            fontSize: '13.5px',
            fontWeight: 600,
            border: activeTab === 'requests' ? 'none' : '1px solid #e5e7eb',
            backgroundColor: activeTab === 'requests' ? '#0f3b33' : '#ffffff',
            color: activeTab === 'requests' ? '#ffffff' : '#4b5563',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Requests
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '7px 16px',
            borderRadius: '6px',
            fontSize: '13.5px',
            fontWeight: 600,
            border: activeTab === 'orders' ? 'none' : '1px solid #e5e7eb',
            backgroundColor: activeTab === 'orders' ? '#0f3b33' : '#ffffff',
            color: activeTab === 'orders' ? '#ffffff' : '#4b5563',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Purchase orders
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: REQUESTS                                                           */}
      {/* ========================================================================= */}
      {activeTab === 'requests' && (
        <div>
          {/* Status Filter Pills */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              STATUS
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {REQUEST_STATUS_PILLS.map((st) => {
                const isActive = requestStatusFilter === st.value;
                return (
                  <button
                    key={st.value || 'all'}
                    onClick={() => setRequestStatusFilter(st.value)}
                    style={{
                      padding: '4px 14px',
                      borderRadius: '20px',
                      fontSize: '12.5px',
                      fontWeight: isActive ? 600 : 500,
                      border: isActive ? '1.5px solid #1f2937' : '1px solid #e5e7eb',
                      backgroundColor: '#ffffff',
                      color: isActive ? '#111827' : '#4b5563',
                      cursor: 'pointer'
                    }}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority Filter Pills */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              PRIORITY
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {REQUEST_PRIORITY_PILLS.map((pr) => {
                const isActive = requestPriorityFilter === pr.value;
                return (
                  <button
                    key={pr.value || 'all'}
                    onClick={() => setRequestPriorityFilter(pr.value)}
                    style={{
                      padding: '4px 14px',
                      borderRadius: '20px',
                      fontSize: '12.5px',
                      fontWeight: isActive ? 600 : 500,
                      border: isActive ? '1.5px solid #1f2937' : '1px solid #e5e7eb',
                      backgroundColor: '#ffffff',
                      color: isActive ? '#111827' : '#4b5563',
                      cursor: 'pointer'
                    }}
                  >
                    {pr.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Requests Table */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <div className="table-responsive" style={{ margin: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      REQUEST
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      DEPARTMENT
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      REQUESTED BY
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      PRIORITY
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      NEEDED BY
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      STATUS
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                        Loading procurement requisitions...
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                        {canManageProcurement ? (
                          <>No procurement requests found. Click <strong>+ New request</strong> to raise a requisition.</>
                        ) : (
                          <>No procurement requests found.</>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => {
                      const reqCode = `REQ-${String(req.id).padStart(4, '0')}`;
                      const priorityBadge = getPriorityBadge(req.priority);
                      const statusBadge = getRequestStatusBadge(req.status);
                      const isApproved = (req.status || '').toLowerCase() === 'approved';
                      const isSubmitted = (req.status || '').toLowerCase() === 'submitted' || (req.status || '').toLowerCase() === 'pending' || (req.status || '').toLowerCase() === 'draft';

                      return (
                        <tr
                          key={req.id}
                          style={{
                            borderBottom: '1px solid #f3f4f6',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                        >
                          {/* REQUEST */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontWeight: 700, color: '#111827', fontSize: '14px' }}>
                              {req.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '11.5px', color: '#6b7280', fontFamily: 'monospace' }}>
                                {reqCode}
                              </span>
                              {req.category && (
                                <span style={{
                                  fontSize: '11px',
                                  padding: '1px 6px',
                                  borderRadius: '8px',
                                  backgroundColor: '#f3f4f6',
                                  color: '#4b5563'
                                }}>
                                  {getCategoryLabel(req.category)}
                                </span>
                              )}
                              {req.budget_amount && (
                                <span style={{
                                  fontSize: '11px',
                                  padding: '1px 7px',
                                  borderRadius: '8px',
                                  backgroundColor: '#ecfdf5',
                                  color: '#047857',
                                  fontWeight: 700
                                }}>
                                  Budget: {formatCurrency(req.budget_amount)}
                                </span>
                              )}
                              {req.is_multi_vendor && (
                                <span style={{
                                  fontSize: '10.5px',
                                  padding: '1px 6px',
                                  borderRadius: '8px',
                                  backgroundColor: '#fffbeb',
                                  color: '#b45309',
                                  fontWeight: 600
                                }}>
                                  Multi-Vendor Broadcast
                                </span>
                              )}
                              {req.assigned_vendor_id && (
                                <span style={{
                                  fontSize: '10.5px',
                                  padding: '1px 6px',
                                  borderRadius: '8px',
                                  backgroundColor: '#eff6ff',
                                  color: '#1d4ed8',
                                  fontWeight: 600
                                }}>
                                  Vendor Assigned
                                </span>
                              )}
                            </div>
                            {req.specifications && (
                              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>
                                Specs: {req.specifications}
                              </div>
                            )}
                            {req.location && (
                              <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '1px' }}>
                                Delivery to: {req.location}
                              </div>
                            )}
                          </td>

                          {/* DEPARTMENT */}
                          <td style={{ padding: '14px 18px', fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                            {req.department || 'Operations'}
                          </td>

                          {/* REQUESTED BY */}
                          <td style={{ padding: '14px 18px', fontSize: '13px', color: '#1f2937', fontWeight: 600 }}>
                            {req.requested_by_name || 'Staff Member'}
                          </td>

                          {/* PRIORITY */}
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: priorityBadge.bg,
                              color: priorityBadge.text,
                              border: `1px solid ${priorityBadge.border}`
                            }}>
                              {priorityBadge.label}
                            </span>
                          </td>

                          {/* NEEDED BY */}
                          <td style={{ padding: '14px 18px', fontSize: '12.5px', color: '#4b5563', whiteSpace: 'nowrap' }}>
                            {formatDate(req.needed_by)}
                          </td>

                          {/* STATUS */}
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: statusBadge.bg,
                              color: statusBadge.text,
                              border: `1px solid ${statusBadge.border}`
                            }}>
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: statusBadge.dotColor
                              }} />
                              {statusBadge.label}
                            </span>
                          </td>

                          {/* ACTIONS */}
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                              {/* Vendor Acceptance Action */}
                              {user?.role === 'Vendor' && (req.status === 'assigned' || (['pending', 'submitted'].includes(req.status) && req.is_multi_vendor)) && (
                                <button
                                  onClick={() => handleVendorAccept(req.id)}
                                  style={{
                                    padding: '5px 12px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    backgroundColor: '#0f3b33',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Accept / Approve
                                </button>
                              )}

                              {/* Finance Manager Payment Authorization Action */}
                              {['Finance Officer', 'Administrator'].includes(user?.role) && req.status === 'vendor_accepted' && (
                                <>
                                  <button
                                    onClick={() => handleFinanceApprove(req.id)}
                                    style={{
                                      padding: '5px 12px',
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      backgroundColor: '#ecfdf5',
                                      color: '#047857',
                                      border: '1px solid #a7f3d0',
                                      borderRadius: '5px',
                                      cursor: 'pointer'
                                    }}
                                    title="Verify treasury balance and authorize payment"
                                  >
                                    Approve Payment
                                  </button>
                                  <button
                                    onClick={() => handleFinanceReject(req.id)}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '11.5px',
                                      fontWeight: 600,
                                      backgroundColor: '#fef2f2',
                                      color: '#991b1b',
                                      border: '1px solid #fecaca',
                                      borderRadius: '5px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {isSubmitted && canManageProcurement && (
                                <>
                                  <button
                                    onClick={() => handleUpdateRequestStatus(req.id, 'approved')}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '11.5px',
                                      fontWeight: 600,
                                      backgroundColor: '#ecfdf5',
                                      color: '#047857',
                                      border: '1px solid #a7f3d0',
                                      borderRadius: '5px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleUpdateRequestStatus(req.id, 'rejected')}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '11.5px',
                                      fontWeight: 600,
                                      backgroundColor: '#fef2f2',
                                      color: '#991b1b',
                                      border: '1px solid #fecaca',
                                      borderRadius: '5px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {isApproved && canManageProcurement && (
                                <>
                                  <button
                                    onClick={() => navigate(`/vendors?category=${req.category || 'raw_material'}&reqId=${req.id}`)}
                                    title="Assign an active vendor in Vendor Management for this requisition"
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '11.5px',
                                      fontWeight: 600,
                                      backgroundColor: '#eff6ff',
                                      color: '#1d4ed8',
                                      border: '1px solid #bfdbfe',
                                      borderRadius: '5px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Assign Vendor
                                  </button>

                                  <button
                                    onClick={() => {
                                      setPOForm({
                                        vendor_id: '',
                                        procurement_request_id: req.id,
                                        expected_delivery_date: req.needed_by || '',
                                        payment_terms: 'Net 30',
                                        items: [
                                          { item_name: req.title, quantity: req.quantity || 1, unit_price: 2500 }
                                        ]
                                      });
                                      setIsPOModalOpen(true);
                                    }}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '11.5px',
                                      fontWeight: 600,
                                      backgroundColor: '#0f3b33',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '5px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Direct PO
                                  </button>
                                </>
                              )}

                              {req.status === 'vendor_accepted' && user?.role === 'Vendor' && (
                                <span style={{ fontSize: '11.5px', color: '#6d28d9', fontWeight: 600, padding: '4px 6px' }}>
                                  Accepted &bull; Awaiting Finance
                                </span>
                              )}

                              {req.status === 'finance_approved' && (
                                <span style={{ fontSize: '11.5px', color: '#047857', fontWeight: 600, padding: '4px 6px' }}>
                                  Payment Approved &bull; PO Awarded
                                </span>
                              )}

                              {isApproved && !canManageProcurement && user?.role !== 'Vendor' && (
                                <span style={{ fontSize: '12px', color: '#6b7280', padding: '4px 8px' }}>
                                  Approved &bull; Ready
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PURCHASE ORDERS                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div>
          {/* Status Filter Pills */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              STATUS
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PO_STATUS_PILLS.map((st) => {
                const isActive = poStatusFilter === st.value;
                return (
                  <button
                    key={st.value || 'all'}
                    onClick={() => setPOStatusFilter(st.value)}
                    style={{
                      padding: '4px 14px',
                      borderRadius: '20px',
                      fontSize: '12.5px',
                      fontWeight: isActive ? 600 : 500,
                      border: isActive ? '1.5px solid #1f2937' : '1px solid #e5e7eb',
                      backgroundColor: '#ffffff',
                      color: isActive ? '#111827' : '#4b5563',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Purchase Orders Table */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <div className="table-responsive" style={{ margin: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      PURCHASE ORDER
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      VENDOR
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      ITEMS
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      TOTAL
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      STATUS
                    </th>
                    <th style={{ padding: '12px 18px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      DELIVERY DATE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                        Loading purchase orders...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                        No purchase orders found. Click <strong>+ Purchase order</strong> to issue a direct order.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((po) => {
                      const poCode = getPOCode(po);
                      const vendor = vendors.find(v => v.id === po.vendor_id);
                      const statusBadge = getPOStatusBadge(po.status);
                      const itemsText = getPOItemsSummary(po);
                      const totalAmount = (po.items || []).reduce(
                        (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)),
                        Number(po.total_amount) || 0
                      );

                      return (
                        <tr
                          key={po.id}
                          onClick={() => setSelectedPOForDetail(po)}
                          style={{
                            borderBottom: '1px solid #f3f4f6',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                        >
                          {/* PURCHASE ORDER */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontWeight: 700, color: '#111827', fontSize: '13.5px' }}>
                              {poCode}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#6b7280', fontFamily: 'monospace', marginTop: '1px' }}>
                              {po.procurement_request_id ? `from PR-${2200 + po.procurement_request_id}` : 'direct order'}
                            </div>
                          </td>

                          {/* VENDOR */}
                          <td style={{ padding: '14px 18px', fontSize: '13.5px', color: '#1f2937' }}>
                            {vendor ? vendor.company_name : `Vendor #${po.vendor_id}`}
                          </td>

                          {/* ITEMS */}
                          <td style={{ padding: '14px 18px', fontSize: '13px', color: '#374151' }}>
                            {itemsText}
                          </td>

                          {/* TOTAL */}
                          <td style={{ padding: '14px 18px', fontWeight: 600, color: '#111827', fontSize: '13.5px' }}>
                            {formatCurrency(totalAmount)}
                          </td>

                          {/* STATUS with Dot */}
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 10px',
                              borderRadius: '14px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: statusBadge.bg,
                              color: statusBadge.text
                            }}>
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: statusBadge.dot
                              }} />
                              {statusBadge.label}
                            </span>
                          </td>

                          {/* DELIVERY DATE */}
                          <td style={{ padding: '14px 18px', fontSize: '13px', color: '#4b5563' }}>
                            {formatDate(po.expected_delivery_date)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PURCHASE ORDER DETAILS & ACTIONS (on row click)                   */}
      {/* ========================================================================= */}
      {selectedPOForDetail && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPOForDetail(null)}
          title={`Purchase Order: ${getPOCode(selectedPOForDetail)}`}
          subtitle={`Vendor: ${vendors.find(v => v.id === selectedPOForDetail.vendor_id)?.company_name || 'Assigned Supplier'}`}
        >
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', padding: '12px 16px', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Status</div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>
                  {getPOStatusBadge(selectedPOForDetail.status).label}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Delivery Date</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  {formatDate(selectedPOForDetail.expected_delivery_date)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>Terms</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  {selectedPOForDetail.payment_terms || 'Net 30'}
                </div>
              </div>
            </div>

            {/* Line items list */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
                Ordered Line Items
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '8px 12px', fontSize: '11.5px', color: '#6b7280' }}>Item</th>
                      <th style={{ padding: '8px 12px', fontSize: '11.5px', color: '#6b7280' }}>Qty</th>
                      <th style={{ padding: '8px 12px', fontSize: '11.5px', color: '#6b7280' }}>Unit Price</th>
                      <th style={{ padding: '8px 12px', fontSize: '11.5px', color: '#6b7280', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPOForDetail.items || []).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 12px', fontSize: '13px' }}>{it.item_name}</td>
                        <td style={{ padding: '8px 12px', fontSize: '13px' }}>{it.quantity}</td>
                        <td style={{ padding: '8px 12px', fontSize: '13px' }}>{formatCurrency(it.unit_price)}</td>
                        <td style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 600, textAlign: 'right' }}>
                          {formatCurrency(Number(it.quantity || 0) * Number(it.unit_price || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Status Change Controls for staff */}
            {canUpdateStatus && (
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Update Order Lifecycle Status
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['approved', 'ordered', 'in_transit', 'delivered', 'completed', 'cancelled'].map(st => (
                    <button
                      key={st}
                      type="button"
                      disabled={selectedPOForDetail.status === st}
                      onClick={() => handlePOStatusChange(selectedPOForDetail.id, st)}
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: selectedPOForDetail.status === st ? '1.5px solid #0f3b33' : '1px solid #d1d5db',
                        backgroundColor: selectedPOForDetail.status === st ? '#0f3b33' : '#ffffff',
                        color: selectedPOForDetail.status === st ? '#ffffff' : '#374151',
                        cursor: selectedPOForDetail.status === st ? 'default' : 'pointer'
                      }}
                    >
                      {st === 'in_transit' ? 'In Transit' : (st.charAt(0).toUpperCase() + st.slice(1))}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {/* PDF Invoice Button */}
              <button
                type="button"
                onClick={() => {
                  const inv = invoices.find(i => i.purchase_order_id === selectedPOForDetail.id) || {
                    id: selectedPOForDetail.id,
                    amount: selectedPOForDetail.total_amount,
                    invoice_number: `INV-2026-${String(selectedPOForDetail.id).padStart(4, '0')}`,
                    created_at: selectedPOForDetail.created_at,
                    due_date: selectedPOForDetail.expected_delivery_date,
                    status: 'paid'
                  };
                  setSelectedInvoiceForPDF(inv);
                  setIsPdfModalOpen(true);
                }}
                style={{
                  backgroundColor: '#0f3b33',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Download Structured PDF Invoice
              </button>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedPOForDetail(null)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NEW PROCUREMENT REQUEST                                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        title="New procurement request"
        subtitle="Raise a new internal requisition for goods or services."
      >
        <form onSubmit={handleCreateRequest}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Item or service description *
              </label>
              <input
                type="text"
                placeholder="e.g. High-performance industrial servo motors (50 units)"
                value={requestForm.title}
                onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '13.5px'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Department *
                </label>
                <select
                  value={requestForm.department}
                  onChange={(e) => setRequestForm({ ...requestForm, department: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13.5px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Requested by *
                </label>
                <input
                  type="text"
                  value={requestForm.requested_by_name}
                  onChange={(e) => setRequestForm({ ...requestForm, requested_by_name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13.5px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={requestForm.quantity}
                  onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13.5px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Needed by
                </label>
                <input
                  type="date"
                  value={requestForm.needed_by}
                  onChange={(e) => setRequestForm({ ...requestForm, needed_by: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13.5px'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                Priority *
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Low', 'Medium', 'High', 'Urgent'].map((p) => {
                  const isSelected = requestForm.priority.toLowerCase() === p.toLowerCase();
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setRequestForm({ ...requestForm, priority: p })}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '16px',
                        fontSize: '12.5px',
                        fontWeight: isSelected ? 600 : 500,
                        border: isSelected ? '1.5px solid #0f3b33' : '1px solid #d1d5db',
                        backgroundColor: isSelected ? '#0f3b33' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#374151',
                        cursor: 'pointer'
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Requisition Category *
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {VENDOR_CATEGORIES.map((cat) => {
                  const isSelected = requestForm.category === cat.value;
                  return (
                    <button
                      type="button"
                      key={cat.value}
                      onClick={() => setRequestForm({ ...requestForm, category: cat.value })}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        fontWeight: isSelected ? 600 : 500,
                        border: isSelected ? '1.5px solid #0f3b33' : '1px solid #d1d5db',
                        backgroundColor: isSelected ? '#0f3b33' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#374151',
                        cursor: 'pointer'
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Budget / Amount (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 250000"
                  value={requestForm.budget_amount}
                  onChange={(e) => setRequestForm({ ...requestForm, budget_amount: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13.5px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Delivery Location / Facility
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pune Central Warehouse - Bay 4"
                  value={requestForm.location}
                  onChange={(e) => setRequestForm({ ...requestForm, location: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13.5px'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Required Specifications
              </label>
              <textarea
                rows="2"
                placeholder="Technical specifications, grade, compliance standards (e.g. ISO 9001 certified, Grade 316L stainless steel)..."
                value={requestForm.specifications}
                onChange={(e) => setRequestForm({ ...requestForm, specifications: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '13.5px',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Vendor Assignment Strategy */}
            <div style={{ backgroundColor: '#f9fafb', padding: '14px 16px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
                Vendor Assignment Strategy
              </label>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="vendor_strategy"
                    checked={!requestForm.is_multi_vendor}
                    onChange={() => setRequestForm({ ...requestForm, is_multi_vendor: false })}
                  />
                  Single Vendor Assignment
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="vendor_strategy"
                    checked={requestForm.is_multi_vendor}
                    onChange={() => setRequestForm({ ...requestForm, is_multi_vendor: true, assigned_vendor_id: '' })}
                  />
                  Multiple Vendors (Category Broadcast)
                </label>
              </div>

              {!requestForm.is_multi_vendor ? (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4b5563', marginBottom: '4px' }}>
                    Select Assigned Supplier (Filtered by {getCategoryLabel(requestForm.category)})
                  </label>
                  {(() => {
                    const matchingVendors = activeVendors.filter(v => !requestForm.category || v.category === requestForm.category);
                    return (
                      <select
                        value={requestForm.assigned_vendor_id}
                        onChange={(e) => setRequestForm({ ...requestForm, assigned_vendor_id: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '13px',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        {matchingVendors.length === 0 ? (
                          <option value="" disabled>
                            -- No active vendors registered under '{getCategoryLabel(requestForm.category)}' --
                          </option>
                        ) : (
                          <>
                            <option value="">-- Select an active vendor to assign ({matchingVendors.length} eligible in category) --</option>
                            {matchingVendors.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.company_name} [{getCategoryLabel(v.category)}] &bull; Reliability: {v.reliability_score || 0}%
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#047857', backgroundColor: '#ecfdf5', padding: '8px 12px', borderRadius: '6px' }}>
                  All approved vendors registered in the <strong>{getCategoryLabel(requestForm.category)}</strong> category will receive an immediate requisition notification.
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Business Justification
              </label>
              <textarea
                rows="2"
                placeholder="Business justification for this purchase requisition..."
                value={requestForm.justification}
                onChange={(e) => setRequestForm({ ...requestForm, justification: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '13.5px',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', backgroundColor: '#f9fafb' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsRequestModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                backgroundColor: '#0f3b33',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 18px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Submit for approval
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: CREATE PURCHASE ORDER                                              */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isPOModalOpen}
        onClose={() => setIsPOModalOpen(false)}
        title="Create purchase order"
        subtitle="Issue a direct order to an active vendor."
      >
        <form onSubmit={handleCreatePO}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Assign vendor selectable pills */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Assign vendor *
              </label>
              <div style={{
                maxHeight: '130px',
                overflowY: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '10px',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                backgroundColor: '#fafafa'
              }}>
                {activeVendors.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#6b7280', padding: '6px' }}>
                    No active suppliers available. Please register or approve a vendor first.
                  </div>
                ) : (
                  activeVendors.map((v) => {
                    const isSelected = String(poForm.vendor_id) === String(v.id);
                    return (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => setPOForm({ ...poForm, vendor_id: v.id })}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '12.5px',
                          fontWeight: isSelected ? 600 : 500,
                          border: isSelected ? '1.5px solid #0f3b33' : '1px solid #d1d5db',
                          backgroundColor: isSelected ? '#0f3b33' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#374151',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {isSelected && <span>Selected</span>}
                        <span>{v.company_name}</span>
                        <span style={{ fontSize: '10.5px', opacity: 0.8 }}>
                          ({getCategoryLabel(v.category)})
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Line items table */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                Line items
              </label>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '8px 12px', fontSize: '11.5px', fontWeight: 600, color: '#6b7280' }}>Item description</th>
                      <th style={{ padding: '8px 12px', fontSize: '11.5px', fontWeight: 600, color: '#6b7280', width: '80px' }}>Qty</th>
                      <th style={{ padding: '8px 12px', fontSize: '11.5px', fontWeight: 600, color: '#6b7280', width: '120px' }}>Unit price (₹)</th>
                      <th style={{ padding: '8px 12px', fontSize: '11.5px', fontWeight: 600, color: '#6b7280', width: '110px' }}>Total</th>
                      <th style={{ padding: '8px 12px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {poForm.items.map((item, idx) => {
                      const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="text"
                              placeholder="Item or service name"
                              value={item.item_name}
                              onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                              required
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid #d1d5db',
                                fontSize: '13px'
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              required
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid #d1d5db',
                                fontSize: '13px'
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="number"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                              required
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid #d1d5db',
                                fontSize: '13px'
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                            {formatCurrency(lineTotal)}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            {poForm.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontSize: '16px'
                                }}
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleAddItem}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0f3b33',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px 0'
                  }}
                >
                  + Add line item
                </button>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                  Total: <span style={{ color: '#0f3b33' }}>{formatCurrency(calculatePOTotal())}</span>
                </div>
              </div>
            </div>

            {/* Expected delivery date & Payment terms */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Expected delivery date
                </label>
                <input
                  type="date"
                  value={poForm.expected_delivery_date}
                  onChange={(e) => setPOForm({ ...poForm, expected_delivery_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Payment terms
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {PAYMENT_TERMS_OPTIONS.map((term) => {
                    const isSelected = poForm.payment_terms === term;
                    return (
                      <button
                        type="button"
                        key={term}
                        onClick={() => setPOForm({ ...poForm, payment_terms: term })}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: isSelected ? 600 : 500,
                          border: isSelected ? '1.5px solid #0f3b33' : '1px solid #d1d5db',
                          backgroundColor: isSelected ? '#0f3b33' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#374151',
                          cursor: 'pointer'
                        }}
                      >
                        {term}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 24px', backgroundColor: '#f9fafb' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsPOModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                backgroundColor: '#0f3b33',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 18px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Create order
            </button>
          </div>
        </form>
      </Modal>

      {/* Structured PDF Invoice Modal */}
      <InvoicePDFModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        invoice={selectedInvoiceForPDF}
        order={selectedPOForDetail}
        vendor={vendors.find(v => v.id === selectedPOForDetail?.vendor_id)}
      />
    </div>
  );
};
