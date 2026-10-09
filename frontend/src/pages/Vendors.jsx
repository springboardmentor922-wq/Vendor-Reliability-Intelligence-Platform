import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Modal } from '../components/Modal';

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Raw Materials', value: 'raw_material' },
  { label: 'Equipment', value: 'equipment' },
  { label: 'IT & Cloud', value: 'it' },
  { label: 'Service Providers', value: 'service_provider' },
  { label: 'Logistics', value: 'logistics' },
  { label: 'Maintenance', value: 'maintenance' }
];

const STATUS_PILLS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Rejected', value: 'rejected' }
];

const PAYMENT_TERMS_OPTIONS = ['Net 15', 'Net 30', 'Net 45', 'Net 60'];

export const Vendors = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const canManageProcurement = ['Administrator', 'Procurement Manager'].includes(user?.role);

  const initialCategory = searchParams.get('category') || '';
  const linkedReqId = searchParams.get('reqId') || '';
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [statusFilter, setStatusFilter] = useState('');

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [viewVendorDetails, setViewVendorDetails] = useState(null);

  const [formData, setFormData] = useState({
    company_name: '',
    category: 'raw_material',
    contact_person: '',
    contact_role: 'Sales Director',
    email: '',
    phone: '',
    address: '',
    gst_number: '',
    payment_terms: 'Net 30',
    notes: ''
  });

  const canManageVendors = ['Administrator', 'Procurement Manager', 'Supply Chain Manager'].includes(user?.role);

  const loadVendors = async () => {
    setLoading(true);
    setError('');
    try {
      const activeCategory = (linkedReqId && initialCategory) ? initialCategory : categoryFilter;
      const data = await api.getVendors({
        category: activeCategory || undefined,
        status: statusFilter === 'active' ? 'approved' : (statusFilter || undefined),
        search: search || undefined
      });
      setVendors(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, [categoryFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadVendors();
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createVendor({
        ...formData,
        status: 'pending'
      });
      setIsRegisterOpen(false);
      setFormData({
        company_name: '',
        category: 'raw_material',
        contact_person: '',
        contact_role: 'Sales Director',
        email: '',
        phone: '',
        address: '',
        gst_number: '',
        payment_terms: 'Net 30',
        notes: ''
      });
      alert('Vendor registration submitted. New vendors require Administrator approval before activation.');
      loadVendors();
    } catch (err) {
      alert('Error registering vendor: ' + err.message);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVendor) return;
    try {
      await api.updateVendor(selectedVendor.id, formData);
      setIsEditOpen(false);
      loadVendors();
    } catch (err) {
      alert('Error updating vendor: ' + err.message);
    }
  };

  const handleStatusChange = async (vendorId, newStatus) => {
    try {
      await api.updateVendorStatus(vendorId, { status: newStatus });
      loadVendors();
    } catch (err) {
      alert('Status change error: ' + err.message);
    }
  };

  const openEditModal = (v) => {
    setSelectedVendor(v);
    setFormData({
      company_name: v.company_name,
      category: v.category || 'raw_material',
      contact_person: v.contact_person,
      contact_role: v.contact_role || 'Account Executive',
      email: v.email,
      phone: v.phone || '',
      address: v.address || '',
      gst_number: v.gst_number || '',
      payment_terms: v.payment_terms || 'Net 30',
      notes: v.notes || ''
    });
    setIsEditOpen(true);
  };

  const getReliabilityInfo = (score) => {
    const raw = Number(score);
    const num = isNaN(raw) ? 0 : Math.round(raw);
    if (num === 0) return { score: 0, label: 'Unrated (New)', color: '#64748b', barColor: '#94a3b8' };
    if (num >= 85) return { score: num, label: 'Excellent', color: '#10b981', barColor: '#10b981' };
    if (num >= 70) return { score: num, label: 'Good', color: '#2563eb', barColor: '#3b82f6' };
    if (num >= 50) return { score: num, label: 'Moderate', color: '#d97706', barColor: '#f59e0b' };
    return { score: num, label: 'High Risk', color: '#dc2626', barColor: '#ef4444' };
  };

  const getStatusBadge = (status) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'approved' || s === 'active') {
      return { label: 'Active', dotColor: '#10b981', bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' };
    }
    if (s === 'pending' || s === 'pending_approval') {
      return { label: 'Pending Approval', dotColor: '#f59e0b', bg: '#fffbeb', text: '#92400e', border: '#fde68a' };
    }
    if (s === 'inactive') {
      return { label: 'Inactive', dotColor: '#6b7280', bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
    }
    if (s === 'suspended') {
      return { label: 'Suspended', dotColor: '#ef4444', bg: '#fef2f2', text: '#991b1b', border: '#fecaca' };
    }
    if (s === 'rejected') {
      return { label: 'Rejected', dotColor: '#b91c1c', bg: '#fef2f2', text: '#7f1d1d', border: '#fecaca' };
    }
    return { label: s.charAt(0).toUpperCase() + s.slice(1), dotColor: '#6b7280', bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '15 Jan 2024';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getCategoryLabel = (cat) => {
    const found = CATEGORIES.find(c => c.value === cat);
    return found ? found.label : (cat ? cat.replace('_', ' ') : 'General');
  };

  const filteredVendors = vendors.filter(v => {
    if (linkedReqId && initialCategory && v.category !== initialCategory) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const code = `vn-${String(v.id).padStart(4, '0')}`;
      const match = v.company_name?.toLowerCase().includes(q) ||
                    v.contact_person?.toLowerCase().includes(q) ||
                    v.email?.toLowerCase().includes(q) ||
                    code.includes(q);
      if (!match) return false;
    }
    if (statusFilter) {
      const s = (v.status || '').toLowerCase();
      if (statusFilter === 'active' && s !== 'approved' && s !== 'active') return false;
      if (statusFilter !== 'active' && s !== statusFilter) return false;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {linkedReqId && canManageProcurement && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong style={{ color: '#1e40af' }}>Requisition Assignment Active:</strong>{' '}
            <span style={{ color: '#1e3a8a' }}>
              Assigning supplier for Requisition <strong>REQ-{String(linkedReqId).padStart(4, '0')}</strong>{' '}
              ({categoryFilter ? getCategoryLabel(categoryFilter) : 'All categories'}).
              Select an active vendor below to issue direct purchase order.
            </span>
          </div>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => {
              setSearchParams({});
              setCategoryFilter('');
            }}
          >
            Clear Assignment
          </button>
        </div>
      )}

      
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '10px',
            backgroundColor: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Vendor Management &amp; Categorical Directory
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                {vendors.length} Vendors Registered
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Switch partitions, track approval stages, oversee contracts, and monitor real-time reliability metrics.
            </p>
          </div>
        </div>

        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: '260px' }}>
            <div style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
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
              placeholder="Search vendors, contacts, tax ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                fontSize: '13px',
                borderRadius: '7px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#1e293b',
                outline: 'none'
              }}
            />
          </form>

          <button
            onClick={() => window.print()}
            style={{
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Print</span>
          </button>

          <button
            onClick={() => {
              const csvContent = "data:text/csv;charset=utf-8," + ["ID,Company Name,Category,Status,Email"].concat(
                vendors.map(v => `${v.id},"${v.company_name}","${v.category}","${v.status}","${v.email}"`)
              ).join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", "vendors_directory.csv");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            style={{
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export</span>
          </button>

          <button
            onClick={() => setIsRegisterOpen(true)}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '7px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
            }}
          >
            <span>+</span>
            <span>Register Vendor</span>
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}

      
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            VENDOR CATEGORIES (SWAP PARTITIONS)
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Viewing: {categoryFilter ? (CATEGORIES.find(c => c.value === categoryFilter)?.label || categoryFilter) : 'All'} ({vendors.length} of {vendors.length})
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => {
            const isActive = categoryFilter === cat.value;
            const count = cat.value ? vendors.filter(v => v.category === cat.value).length : vendors.length;
            return (
              <button
                key={cat.value || 'all'}
                onClick={() => setCategoryFilter(cat.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 700 : 500,
                  border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: isActive ? '#2563eb' : '#ffffff',
                  color: isActive ? '#ffffff' : '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isActive ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{cat.label === 'All' ? 'All Categories' : cat.label}</span>
                <span style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.25)' : '#f1f5f9',
                  color: isActive ? '#ffffff' : '#64748b',
                  fontWeight: 700
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Filter by Status:
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Showing {vendors.length} matches
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {STATUS_PILLS.map((st) => {
            const isActive = statusFilter === st.value;
            const count = st.value ? (
              st.value === 'active'
                ? vendors.filter(v => v.status === 'approved' || v.status === 'active').length
                : vendors.filter(v => v.status === st.value).length
            ) : vendors.length;
            return (
              <button
                key={st.value || 'all'}
                onClick={() => setStatusFilter(st.value)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  border: isActive ? '1px solid #1e40af' : '1px solid #e2e8f0',
                  backgroundColor: isActive ? '#1e3a8a' : '#f8fafc',
                  color: isActive ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{st.label}</span>
                <span style={{
                  fontSize: '10.5px',
                  padding: '0 5px',
                  borderRadius: '8px',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : '#e2e8f0',
                  color: isActive ? '#ffffff' : '#64748b',
                  fontWeight: 700
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      
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
                <th style={{ padding: '12px 18px', fontSize: '11.5px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  VENDOR
                </th>
                <th style={{ padding: '12px 18px', fontSize: '11.5px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  CATEGORY
                </th>
                <th style={{ padding: '12px 18px', fontSize: '11.5px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  PRIMARY CONTACT
                </th>
                <th style={{ padding: '12px 18px', fontSize: '11.5px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  STATUS
                </th>
                <th style={{ padding: '12px 18px', fontSize: '11.5px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: '170px' }}>
                  RELIABILITY
                </th>
                <th style={{ padding: '12px 18px', fontSize: '11.5px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ONBOARDED
                </th>
                <th style={{ padding: '12px 18px', fontSize: '11.5px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    Loading supplier directory...
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    No vendors found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((v) => {
                  const statusInfo = getStatusBadge(v.status);
                  const relInfo = getReliabilityInfo(v.reliability_score);
                  const vendorCode = `VN-${String(v.id).padStart(4, '0')}`;
                  const isSupplierActive = (v.status || '').toLowerCase() === 'approved' || (v.status || '').toLowerCase() === 'active';

                  return (
                    <tr
                      key={v.id}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                    >
                      
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: '#f3f4f6',
                            color: '#4b5563',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="4" y="2" width="16" height="20" rx="2" />
                              <line x1="9" y1="22" x2="9" y2="22" />
                              <line x1="8" y1="6" x2="10" y2="6" />
                              <line x1="14" y1="6" x2="16" y2="6" />
                              <line x1="8" y1="10" x2="10" y2="10" />
                              <line x1="14" y1="10" x2="16" y2="10" />
                              <line x1="8" y1="14" x2="10" y2="14" />
                              <line x1="14" y1="14" x2="16" y2="14" />
                            </svg>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#111827', fontSize: '14px' }}>
                              {v.company_name}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#9ca3af', fontFamily: 'monospace' }}>
                              {vendorCode}
                            </div>
                          </div>
                        </div>
                      </td>

                      
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          padding: '4px 9px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 500,
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          whiteSpace: 'nowrap'
                        }}>
                          {getCategoryLabel(v.category)}
                        </span>
                      </td>

                      
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '13px' }}>
                          {v.contact_person} {v.contact_role && <span style={{ fontSize: '11.5px', color: '#6b7280', fontWeight: 400 }}>• {v.contact_role}</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {v.email}
                        </div>
                      </td>

                      
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: statusInfo.bg,
                          color: statusInfo.text,
                          border: `1px solid ${statusInfo.border}`
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: statusInfo.dotColor
                          }} />
                          {statusInfo.label}
                        </span>
                      </td>

                      
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            flex: 1,
                            height: '6px',
                            backgroundColor: '#e5e7eb',
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${Math.min(relInfo.score, 100)}%`,
                              height: '100%',
                              backgroundColor: relInfo.barColor,
                              borderRadius: '3px'
                            }} />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: relInfo.color, minWidth: '40px' }}>
                            {relInfo.score}%
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                          {relInfo.label}
                        </div>
                      </td>

                      
                      <td style={{ padding: '14px 18px', fontSize: '12.5px', color: '#4b5563', whiteSpace: 'nowrap' }}>
                        {formatDate(v.created_at)}
                      </td>

                      
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          {linkedReqId && isSupplierActive && canManageProcurement && (
                            <button
                              onClick={() => {
                                navigate(`/procurement?tab=orders&directVendorId=${v.id}&reqId=${linkedReqId}`);
                              }}
                              style={{
                                padding: '4px 10px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer'
                              }}
                            >
                              Assign PO
                            </button>
                          )}
                          <button
                            onClick={() => setViewVendorDetails(v)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '11.5px',
                              fontWeight: 500,
                              backgroundColor: '#f3f4f6',
                              color: '#374151',
                              border: '1px solid #e5e7eb',
                              borderRadius: '5px',
                              cursor: 'pointer'
                            }}
                          >
                            View
                          </button>
                          {canManageVendors && (
                            <button
                              onClick={() => openEditModal(v)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11.5px',
                                fontWeight: 500,
                                backgroundColor: '#ffffff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe',
                                borderRadius: '5px',
                                cursor: 'pointer'
                              }}
                            >
                              Edit
                            </button>
                          )}
                          {user?.role === 'Administrator' && (v.status === 'pending' || v.status === 'pending_approval') && (
                            <>
                              <button
                                onClick={() => handleStatusChange(v.id, 'approved')}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  backgroundColor: '#ecfdf5',
                                  color: '#047857',
                                  border: '1px solid #a7f3d0',
                                  borderRadius: '5px',
                                  cursor: 'pointer'
                                }}
                                title="Approve vendor with initial score 0.0"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleStatusChange(v.id, 'rejected')}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  backgroundColor: '#fef2f2',
                                  color: '#b91c1c',
                                  border: '1px solid #fecaca',
                                  borderRadius: '5px',
                                  cursor: 'pointer'
                                }}
                                title="Reject vendor registration"
                              >
                                Reject
                              </button>
                            </>
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

      
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register vendor"
        subtitle="Onboard a new supplier into the platform."
      >
        <form onSubmit={handleRegisterSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Vendor name *
              </label>
              <input
                type="text"
                placeholder="e.g. Apex Industrial Supplies"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                Category *
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {CATEGORIES.filter(c => c.value !== '').map((cat) => {
                  const isSelected = formData.category === cat.value;
                  return (
                    <button
                      type="button"
                      key={cat.value}
                      onClick={() => setFormData({ ...formData, category: cat.value })}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '16px',
                        fontSize: '12.5px',
                        fontWeight: isSelected ? 600 : 500,
                        border: isSelected ? '1.5px solid #2563eb' : '1px solid #d1d5db',
                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        color: isSelected ? '#1d4ed8' : '#374151',
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
                  Primary contact name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vikram Sharma"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
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
                  Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sales Director"
                  value={formData.contact_role}
                  onChange={(e) => setFormData({ ...formData, contact_role: e.target.value })}
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
                  Email *
                </label>
                <input
                  type="email"
                  placeholder="orders@supplier.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                  Phone
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                Registered address
              </label>
              <textarea
                rows="2"
                placeholder="Plot 42, Industrial Area, Phase II..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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

            
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Tax / GST ID
                </label>
                <input
                  type="text"
                  placeholder="27AABCU9603R1ZM"
                  value={formData.gst_number}
                  onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
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
                  Payment terms
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {PAYMENT_TERMS_OPTIONS.map((term) => {
                    const isSelected = formData.payment_terms === term;
                    return (
                      <button
                        type="button"
                        key={term}
                        onClick={() => setFormData({ ...formData, payment_terms: term })}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: isSelected ? 600 : 500,
                          border: isSelected ? '1.5px solid #2563eb' : '1px solid #d1d5db',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                          color: isSelected ? '#1d4ed8' : '#374151',
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

            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Notes (optional)
              </label>
              <textarea
                rows="2"
                placeholder="Key capabilities, certifications, or internal onboarding notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
              onClick={() => setIsRegisterOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 18px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Register vendor
            </button>
          </div>
        </form>
      </Modal>

      
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Supplier: ${selectedVendor?.company_name}`}
      >
        <form onSubmit={handleEditSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Company Name *</label>
              <input
                type="text"
                className="form-control"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="form-select"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="raw_material">Raw Materials</option>
                  <option value="equipment">Equipment</option>
                  <option value="it">IT & Cloud</option>
                  <option value="service_provider">Service Providers</option>
                  <option value="logistics">Logistics</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Contact Person *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-control"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">GST / Tax Identification</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.gst_number}
                  onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Terms</label>
                <select
                  className="form-select"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                >
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                className="form-control"
                rows="2"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control"
                rows="2"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      
      {viewVendorDetails && (
        <Modal
          isOpen={true}
          onClose={() => setViewVendorDetails(null)}
          title={`Supplier Profile: ${viewVendorDetails.company_name}`}
        >
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vendor Code</div>
                <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'monospace' }}>VN-{String(viewVendorDetails.id).padStart(4, '0')}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</div>
                <span className="badge badge-neutral">{getCategoryLabel(viewVendorDetails.category)}</span>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                <span className="badge badge-success">{viewVendorDetails.status || 'Active'}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11.5px', color: '#6b7280' }}>Primary Contact</div>
                <div style={{ fontWeight: 600 }}>{viewVendorDetails.contact_person}</div>
                {viewVendorDetails.contact_role && <div style={{ fontSize: '12px', color: '#4b5563' }}>{viewVendorDetails.contact_role}</div>}
              </div>
              <div>
                <div style={{ fontSize: '11.5px', color: '#6b7280' }}>Contact Email & Phone</div>
                <div style={{ fontWeight: 600 }}>{viewVendorDetails.email}</div>
                <div style={{ fontSize: '12px', color: '#4b5563' }}>{viewVendorDetails.phone || 'N/A'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11.5px', color: '#6b7280' }}>GST / Tax Number</div>
                <div style={{ fontWeight: 600 }}>{viewVendorDetails.gst_number || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11.5px', color: '#6b7280' }}>Payment Terms</div>
                <div style={{ fontWeight: 600 }}>{viewVendorDetails.payment_terms || 'Net 30'}</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: '#6b7280' }}>Registered Address</div>
              <div style={{ fontSize: '13px' }}>{viewVendorDetails.address || 'Address not specified'}</div>
            </div>

            {viewVendorDetails.notes && (
              <div>
                <div style={{ fontSize: '11.5px', color: '#6b7280' }}>Onboarding Notes</div>
                <div style={{ fontSize: '13px', color: '#4b5563', background: '#f3f4f6', padding: '8px 12px', borderRadius: '6px' }}>
                  {viewVendorDetails.notes}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setViewVendorDetails(null)}>
              Close
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                const v = viewVendorDetails;
                setViewVendorDetails(null);
                openEditModal(v);
              }}
            >
              Edit Supplier
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
