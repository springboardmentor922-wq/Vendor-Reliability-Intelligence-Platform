import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';

const CATEGORY_TABS = [
  { id: 'all', label: 'All Suppliers' },
  { id: 'raw_material', label: 'Raw Materials' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'it', label: 'IT & Cloud' },
  { id: 'service_provider', label: 'Service Providers' },
  { id: 'logistics', label: 'Logistics' },
  { id: 'maintenance', label: 'Maintenance' }
];

const PRIORITY_TABS = [
  { id: 'all', label: 'All Priorities' },
  { id: 'high', label: 'High Priority', activeBg: '#be123c', activeBorder: '#9f1239' },
  { id: 'medium', label: 'Medium Priority', activeBg: '#d97706', activeBorder: '#b45309' },
  { id: 'low', label: 'Low Priority', activeBg: '#059669', activeBorder: '#047857' }
];

const PAYMENT_TERMS_OPTIONS = ['Net 15', 'Net 30', 'Net 45', 'Net 60'];

export const VendorPortal = () => {
  const { user } = useAuth();

  // Active Main Section: 'directory' | 'requisitions'
  const [activePortalTab, setActivePortalTab] = useState('directory');

  // Directory Data
  const [vendors, setVendors] = useState([]);
  const [openRequests, setOpenRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reqLoading, setReqLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [search, setSearch] = useState('');

  // Vendor registration modal state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regSuccess, setRegSuccess] = useState('');
  const [regError, setRegError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registeredVendor, setRegisteredVendor] = useState(null);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalSent, setApprovalSent] = useState(false);

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

  // Requisition Acquisition Modal State
  const [selectedReqForAcquire, setSelectedReqForAcquire] = useState(null);
  const [acquireVendorId, setAcquireVendorId] = useState('');
  const [acquireStatus, setAcquireStatus] = useState({ error: '', success: '', loading: false });

  // Supplier Profile & Contracts Detail Modal State
  const [selectedVendorForModal, setSelectedVendorForModal] = useState(null);
  const [vendorModalLoading, setVendorModalLoading] = useState(false);
  const [vendorModalData, setVendorModalData] = useState(null);

  const handleOpenVendorModal = async (vendor) => {
    setSelectedVendorForModal(vendor);
    setVendorModalLoading(true);
    setVendorModalData(vendor);
    try {
      const fullProfile = await api.getVendorPublicProfile(vendor.id);
      setVendorModalData(fullProfile);
    } catch (err) {
      console.error('Failed to load supplier public profile:', err);
    } finally {
      setVendorModalLoading(false);
    }
  };

  const loadPortalData = async () => {
    setLoading(true);
    setError('');
    try {
      const vendorData = await api.getPublicVendorShowcase();
      setVendors(vendorData || []);
    } catch (err) {
      setError('Failed to load supplier directory: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOpenRequisitions = async () => {
    setReqLoading(true);
    try {
      const reqData = await api.getPublicOpenRequests(selectedCategory !== 'all' ? selectedCategory : undefined);
      setOpenRequests(reqData || []);
    } catch (err) {
      console.error('Failed to load open requisitions:', err);
    } finally {
      setReqLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, []);

  useEffect(() => {
    if (activePortalTab === 'requisitions') {
      loadOpenRequisitions();
    }
  }, [activePortalTab, selectedCategory]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setRegError('');
    setRegSuccess('');

    try {
      const res = await api.publicRegisterVendor(formData);
      setRegisteredVendor(res.vendor);
      setApprovalSent(false);
      setRegSuccess(`Registration details recorded for ${formData.company_name}! Status set to PENDING_APPROVAL.`);
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
      loadPortalData();
    } catch (err) {
      setRegError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForApproval = async (vendorId) => {
    if (!vendorId) return;
    setApprovalSubmitting(true);
    try {
      await api.submitVendorApproval(vendorId);
      setApprovalSent(true);
      alert('Approval request submitted successfully to the Administrator! You will be notified once reviewed.');
    } catch (err) {
      alert(err.message || 'Error submitting for approval');
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handleAcquireSubmit = async (e) => {
    e.preventDefault();
    if (!acquireVendorId || !selectedReqForAcquire) return;

    const chosenVendor = vendors.find(v => String(v.id) === String(acquireVendorId));
    if (!chosenVendor) {
      setAcquireStatus({ error: 'Please select a valid supplier.', success: '', loading: false });
      return;
    }

    // Validation: Only vendors in matching category can acquire requisition
    if (chosenVendor.category !== selectedReqForAcquire.category) {
      setAcquireStatus({
        error: `Category Mismatch: Only suppliers in '${getCategoryLabel(selectedReqForAcquire.category)}' can acquire this requisition. Your supplier category is '${getCategoryLabel(chosenVendor.category)}'.`,
        success: '',
        loading: false
      });
      return;
    }

    setAcquireStatus({ error: '', success: '', loading: true });
    try {
      await api.acquireProcurementRequest(selectedReqForAcquire.id, Number(acquireVendorId));
      setAcquireStatus({
        error: '',
        success: `Requisition acquired successfully! Direct Purchase Order generated for ${chosenVendor.company_name}.`,
        loading: false
      });
      loadOpenRequisitions();
      setTimeout(() => {
        setSelectedReqForAcquire(null);
        setAcquireStatus({ error: '', success: '', loading: false });
        setAcquireVendorId('');
      }, 2000);
    } catch (err) {
      setAcquireStatus({
        error: err.message || 'Failed to acquire requisition',
        success: '',
        loading: false
      });
    }
  };

  const getVendorPriority = (v) => {
    if (v.priority) return v.priority.toLowerCase();
    const score = Number(v.reliability_score) || 0;
    if (v.status === 'suspended') return 'low';
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  };

  const getCategoryLabel = (cat) => {
    const map = {
      raw_material: 'Raw Materials',
      equipment: 'Equipment',
      it: 'IT & Cloud',
      service_provider: 'Service Provider',
      logistics: 'Logistics',
      maintenance: 'Maintenance'
    };
    return map[cat] || (cat ? cat.replace('_', ' ') : 'General');
  };

  const getReliabilityInfo = (score) => {
    const raw = Number(score);
    const num = isNaN(raw) ? 0 : Math.round(raw);
    if (num === 0) return { score: 0, label: 'Unrated (New)', color: '#64748b', barColor: '#94a3b8' };
    if (num >= 85) return { score: num, label: 'Excellent', color: '#0d7658', barColor: '#10b981' };
    if (num >= 70) return { score: num, label: 'Good', color: '#1d4ed8', barColor: '#3b82f6' };
    if (num >= 50) return { score: num, label: 'Moderate', color: '#b45309', barColor: '#f59e0b' };
    return { score: num, label: 'High Risk', color: '#be123c', barColor: '#ef4444' };
  };

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

  const filteredVendors = vendors.filter((v) => {
    const matchCategory = selectedCategory === 'all' || v.category === selectedCategory;
    const vendorPriority = getVendorPriority(v);
    const matchPriority = selectedPriority === 'all' || vendorPriority === selectedPriority;
    const matchSearch = search.trim() === '' ||
      v.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
      v.city_region?.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchPriority && matchSearch;
  });

  const filteredOpenRequests = openRequests.filter((r) => {
    const matchCategory = selectedCategory === 'all' || r.category === selectedCategory;
    const matchPriority = selectedPriority === 'all' || (r.priority || 'medium').toLowerCase() === selectedPriority;
    const matchSearch = search.trim() === '' ||
      r.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.department?.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchPriority && matchSearch;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Platform Standard Header */}
      <div className="page-header" style={{ marginBottom: '22px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Vendor Portal & Marketplace</h1>
            <span className="badge badge-success" style={{ fontSize: '11px' }}>
              Open Directory
            </span>
          </div>
          <p className="page-subtitle">
            Directory of enterprise suppliers, public opportunity board, and self-registration gateway.
          </p>
        </div>

        <div className="page-actions">
          <button
            onClick={() => {
              setRegSuccess('');
              setRegError('');
              setIsRegisterOpen(true);
            }}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '7px',
              padding: '9px 18px',
              fontSize: '13.5px',
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

      {/* Tabs matching Procurement style */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActivePortalTab('directory')}
          style={{
            padding: '7px 16px',
            borderRadius: '6px',
            fontSize: '13.5px',
            fontWeight: 600,
            border: activePortalTab === 'directory' ? 'none' : '1px solid var(--border-color)',
            backgroundColor: activePortalTab === 'directory' ? '#2563eb' : 'var(--bg-surface)',
            color: activePortalTab === 'directory' ? '#ffffff' : 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <span>Supplier Directory</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 6px',
            borderRadius: '10px',
            backgroundColor: activePortalTab === 'directory' ? 'rgba(255,255,255,0.2)' : 'var(--bg-subtle)',
            color: activePortalTab === 'directory' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 700
          }}>
            {vendors.length}
          </span>
        </button>

        <button
          onClick={() => setActivePortalTab('requisitions')}
          style={{
            padding: '7px 16px',
            borderRadius: '6px',
            fontSize: '13.5px',
            fontWeight: 600,
            border: activePortalTab === 'requisitions' ? 'none' : '1px solid var(--border-color)',
            backgroundColor: activePortalTab === 'requisitions' ? '#2563eb' : 'var(--bg-surface)',
            color: activePortalTab === 'requisitions' ? '#ffffff' : 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <span>Open Procurement Requisitions</span>
          <span style={{
            fontSize: '11px',
            padding: '1px 6px',
            borderRadius: '10px',
            backgroundColor: activePortalTab === 'requisitions' ? 'rgba(255,255,255,0.2)' : 'var(--bg-subtle)',
            color: activePortalTab === 'requisitions' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 700
          }}>
            {openRequests.length}
          </span>
        </button>
      </div>

      {/* Search & Filter Toolbar matching project styling */}
      <div className="card" style={{ marginBottom: '22px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {activePortalTab === 'directory'
              ? `Showing ${filteredVendors.length} registered suppliers across enterprise categories`
              : `Showing ${filteredOpenRequests.length} open requisitions available for same-category acquisition`}
          </div>

          <div style={{ position: 'relative', minWidth: '280px', flex: '0 1 340px' }}>
            <input
              type="text"
              className="form-control"
              placeholder={activePortalTab === 'directory' ? 'Search supplier, contact, city...' : 'Search requisition title, department...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: '13px', paddingLeft: '32px' }}
            />
            <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {CATEGORY_TABS.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 14px',
                  borderRadius: '18px',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 600 : 500,
                  border: isActive ? '1px solid #0f3b33' : '1px solid var(--border-color)',
                  backgroundColor: isActive ? '#0f3b33' : 'var(--bg-surface)',
                  color: isActive ? '#ffffff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Priority Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
            Priority:
          </span>
          {PRIORITY_TABS.map((p) => {
            const isActive = selectedPriority === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPriority(p.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 500,
                  border: isActive ? '1.5px solid #0f3b33' : '1px solid var(--border-color)',
                  backgroundColor: isActive ? '#0f3b33' : 'var(--bg-surface)',
                  color: isActive ? '#ffffff' : 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: SUPPLIER DIRECTORY GRID                                           */}
      {/* ========================================================================= */}
      {activePortalTab === 'directory' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
              Loading supplier profiles...
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No suppliers found matching the selected filters.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
              {filteredVendors.map((v) => {
                const relInfo = getReliabilityInfo(v.reliability_score);
                const vendorCode = `VN-${String(v.id).padStart(4, '0')}`;

                return (
                  <div
                    key={v.id}
                    className="card supplier-grid-card"
                    onClick={() => handleOpenVendorModal(v)}
                    title="Click to view complete supplier profile, reliability index, and awarded contracts"
                    style={{
                      border: '1px solid var(--border-color)',
                      boxShadow: 'var(--shadow-xs)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease-in-out',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)';
                      e.currentTarget.style.borderColor = '#94a3b8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  >
                    <div style={{ padding: '20px' }}>
                      {/* Header: Company Name & Category */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px 0', wordBreak: 'break-word' }}>
                            {v.company_name}
                          </h3>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {vendorCode}
                          </div>
                        </div>
                        <span
                          className="badge badge-neutral"
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            lineHeight: 1.25
                          }}
                        >
                          {getCategoryLabel(v.category)}
                        </span>
                      </div>

                      {/* Contact details */}
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6 }}>
                        <div><strong>{v.contact_person}</strong> {v.contact_role && `(${v.contact_role})`}</div>
                        <div>{v.email}</div>
                        {v.phone && <div>{v.phone}</div>}
                        {v.address && <div>{v.address}</div>}
                      </div>

                      {/* Reliability Score & Index Bar */}
                      <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: '8px', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Reliability Rating
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: relInfo.color }}>
                            {relInfo.score}% • {relInfo.label}
                          </span>
                        </div>
                        <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(relInfo.score, 100)}%`, height: '100%', backgroundColor: relInfo.barColor }} />
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Terms & Status */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border-subtle)',
                      padding: '12px 20px',
                      backgroundColor: '#fcfbf8',
                      borderBottomLeftRadius: 'var(--radius-lg)',
                      borderBottomRightRadius: 'var(--radius-lg)',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Terms: <strong>{v.payment_terms || 'Net 30'}</strong>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: '#065f46'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                          Active Supplier
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#0f3b33',
                          backgroundColor: '#eef8f3',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid #d8f0e5'
                        }}>
                          Contracts &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: OPEN PROCUREMENT REQUISITIONS (Bidding & Same-Category Acquire)   */}
      {/* ========================================================================= */}
      {activePortalTab === 'requisitions' && (
        <div>
          <div className="alert alert-info" style={{ marginBottom: '20px' }}>
            <strong>Enterprise Opportunity Board:</strong>{' '}
            <span>
              Internal departments have raised the following approved purchase requisitions.
              In accordance with procurement compliance rules, only suppliers registered within the
              <strong> exact same category</strong> can acquire each requisition.
            </span>
          </div>

          {reqLoading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
              Loading open requisitions...
            </div>
          ) : filteredOpenRequests.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No open requisitions matching your filter at this moment.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
              {filteredOpenRequests.map((req) => {
                const reqCode = `REQ-${String(req.id).padStart(4, '0')}`;
                return (
                  <div
                    key={req.id}
                    className="card"
                    style={{
                      border: '1px solid var(--border-color)',
                      boxShadow: 'var(--shadow-xs)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderRadius: 'var(--radius-lg)'
                    }}
                  >
                    <div style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 700 }}>
                            {reqCode}
                          </span>
                          <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0 0', wordBreak: 'break-word' }}>
                            {req.title}
                          </h3>
                        </div>
                        <span
                          className="badge badge-neutral"
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            lineHeight: 1.25
                          }}
                        >
                          {getCategoryLabel(req.category)}
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '10px 0 14px 0', lineHeight: 1.5 }}>
                        {req.justification || req.description || 'Department requisition for enterprise procurement.'}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-subtle)', padding: '10px 12px', borderRadius: '6px' }}>
                        <div>Dept: <strong>{req.department || 'Operations'}</strong></div>
                        <div>Quantity: <strong>{req.quantity || 1} units</strong></div>
                        <div>Needed by: <strong>{formatDate(req.needed_by)}</strong></div>
                        <div>Priority: <strong style={{ color: 'var(--accent)' }}>{req.priority || 'Medium'}</strong></div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', padding: '14px 20px', backgroundColor: '#fcfbf8', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
                      <span style={{ fontSize: '11.5px', color: '#047857', fontWeight: 600 }}>
                        ● Open for Acquisition
                      </span>
                      <button
                        onClick={() => {
                          setSelectedReqForAcquire(req);
                          const matchingUserVendor = vendors.find(v => v.id === user?.vendor_id && v.category === req.category);
                          setAcquireVendorId(matchingUserVendor ? String(matchingUserVendor.id) : '');
                          setAcquireStatus({ error: '', success: '', loading: false });
                        }}
                        style={{
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '7px 14px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
                        }}
                      >
                        Avail / Acquire Requisition &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTER VENDOR                                                    */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register vendor"
        subtitle="Onboard a new supplier into the platform."
      >
        <form onSubmit={handleRegister}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {regSuccess && (
              <div className="alert alert-success">
                {regSuccess}
              </div>
            )}
            {registeredVendor && (
              <div style={{
                backgroundColor: '#fffbeb',
                border: '1.5px solid #fde68a',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#92400e' }}>
                    {registeredVendor.company_name}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                    PENDING_APPROVAL
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: '#78350f' }}>
                  Your profile has been created with pending status. Click below to submit an official onboarding request to the Administrator.
                </div>
                {!approvalSent ? (
                  <button
                    type="button"
                    onClick={() => handleSubmitForApproval(registeredVendor.id)}
                    disabled={approvalSubmitting}
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: '#0f3b33',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '7px 14px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: approvalSubmitting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {approvalSubmitting ? 'Submitting...' : 'Submit for Approval'}
                  </button>
                ) : (
                  <div style={{ fontSize: '12.5px', color: '#047857', fontWeight: 600 }}>
                    Official approval request submitted to Administrator. Initial reliability index will be 0.0 upon activation.
                  </div>
                )}
              </div>
            )}
            {regError && (
              <div className="alert alert-danger">
                {regError}
              </div>
            )}

            {/* Vendor Name */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Vendor name *
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Apex Industrial Supplies"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                required
              />
            </div>

            {/* Category Selectable Pills */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Category *
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {CATEGORY_TABS.filter(c => c.id !== 'all').map((cat) => {
                  const isSelected = formData.category === cat.id;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setFormData({ ...formData, category: cat.id })}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '16px',
                        fontSize: '12.5px',
                        fontWeight: isSelected ? 600 : 500,
                        border: isSelected ? '1.5px solid #0f3b33' : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? '#0f3b33' : 'var(--bg-surface)',
                        color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contact Person & Role */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Primary contact name *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Vikram Sharma"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Role
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Sales Director"
                  value={formData.contact_role}
                  onChange={(e) => setFormData({ ...formData, contact_role: e.target.value })}
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Email *
                </label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="orders@supplier.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            {/* Registered Address */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Registered address
              </label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Plot 42, Industrial Area, Phase II..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            {/* Tax / GST ID & Payment terms */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Tax / GST ID
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="27AABCU9603R1ZM"
                  value={formData.gst_number}
                  onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
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
                          border: isSelected ? '1.5px solid #0f3b33' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? '#0f3b33' : 'var(--bg-surface)',
                          color: isSelected ? '#ffffff' : 'var(--text-primary)',
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

            {/* Notes (optional) */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Notes (optional)
              </label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Key capabilities, certifications, or internal onboarding notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsRegisterOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: '#0f3b33',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 18px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? 'Registering...' : 'Register vendor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: ACQUIRE REQUISITION (Enforces Same Category Bidding)              */}
      {/* ========================================================================= */}
      {selectedReqForAcquire && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReqForAcquire(null)}
          title={`Acquire Requisition: REQ-${String(selectedReqForAcquire.id).padStart(4, '0')}`}
          subtitle="Issue direct purchase order to fulfill this requisition."
        >
          <form onSubmit={handleAcquireSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {acquireStatus.success && (
                <div className="alert alert-success">
                  {acquireStatus.success}
                </div>
              )}
              {acquireStatus.error && (
                <div className="alert alert-danger">
                  {acquireStatus.error}
                </div>
              )}

              {/* Requisition Summary Card */}
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {selectedReqForAcquire.title}
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <span>Category: <strong style={{ color: 'var(--primary)' }}>{getCategoryLabel(selectedReqForAcquire.category)}</strong></span>
                  <span>Quantity: <strong>{selectedReqForAcquire.quantity || 1} units</strong></span>
                  <span>Department: <strong>{selectedReqForAcquire.department || 'Operations'}</strong></span>
                </div>
              </div>

              {/* Category Governance Notice */}
              <div className="alert alert-info" style={{ fontSize: '12.5px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                <strong>Category Matching Active:</strong> Showing only verified suppliers registered under the <strong>{getCategoryLabel(selectedReqForAcquire.category)}</strong> category.
              </div>

              {/* Select Supplier - Only Matching Category Vendors */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Select Your Supplier Company ({getCategoryLabel(selectedReqForAcquire.category)} only) *
                </label>
                {(() => {
                  const eligibleVendors = vendors.filter(v => v.category === selectedReqForAcquire.category);
                  return (
                    <select
                      className="form-select"
                      value={acquireVendorId}
                      onChange={(e) => {
                        setAcquireVendorId(e.target.value);
                        setAcquireStatus({ error: '', success: '', loading: false });
                      }}
                      required
                    >
                      {eligibleVendors.length === 0 ? (
                        <option value="" disabled>
                          -- No suppliers found in category '{getCategoryLabel(selectedReqForAcquire.category)}' --
                        </option>
                      ) : (
                        <>
                          <option value="">-- Choose your registered supplier ({eligibleVendors.length} eligible) --</option>
                          {eligibleVendors.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.company_name} [Verified Supplier &bull; {getCategoryLabel(v.category)}]
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  );
                })()}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedReqForAcquire(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  acquireStatus.loading ||
                  !acquireVendorId ||
                  !vendors.some(v => String(v.id) === String(acquireVendorId) && v.category === selectedReqForAcquire.category)
                }
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '9px 18px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: (acquireStatus.loading || !acquireVendorId) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
                }}
              >
                {acquireStatus.loading ? 'Processing Order...' : 'Confirm Acquisition (Generate PO)'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* SUPPLIER DETAILS, RELIABILITY INDEX & CONTRACTS POPUP MODAL               */}
      {/* ========================================================================= */}
      {selectedVendorForModal && (
        <Modal
          isOpen={!!selectedVendorForModal}
          onClose={() => {
            setSelectedVendorForModal(null);
            setVendorModalData(null);
          }}
          title={vendorModalData?.company_name || selectedVendorForModal.company_name}
          subtitle={`Supplier Profile • Code: ${vendorModalData?.code || `VN-${String(selectedVendorForModal.id).padStart(4, '0')}`} • Category: ${getCategoryLabel(vendorModalData?.category || selectedVendorForModal.category)}`}
          maxWidth="940px"
        >
          <div
            className="modal-body custom-scrollbar"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '14px 20px',
              overflowY: 'auto',
              maxHeight: 'calc(88vh - 100px)',
              minHeight: 0,
              flex: '1 1 auto'
            }}
          >
            {/* Header Identity & Quick Badges */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="badge badge-neutral" style={{ padding: '3px 8px', fontSize: '11.5px', fontWeight: 700 }}>
                  {getCategoryLabel(vendorModalData?.category || selectedVendorForModal.category)}
                </span>
                <span className="badge badge-approved" style={{ padding: '3px 8px', fontSize: '11.5px' }}>
                  {vendorModalData?.status ? (vendorModalData.status.charAt(0).toUpperCase() + vendorModalData.status.slice(1)) : 'Active'} Supplier
                </span>
                <span className="badge badge-ordered" style={{ padding: '3px 8px', fontSize: '11.5px' }}>
                  Tier: {vendorModalData?.tier || 'Standard Supplier'}
                </span>
                {vendorModalData?.risk_level && (
                  <span className="badge" style={{
                    padding: '3px 8px',
                    fontSize: '11.5px',
                    backgroundColor: String(vendorModalData.risk_level).includes('Low') ? '#ecfdf5' : '#fef2f2',
                    color: String(vendorModalData.risk_level).includes('Low') ? '#047857' : '#b91c1c',
                    border: `1px solid ${String(vendorModalData.risk_level).includes('Low') ? '#a7f3d0' : '#fecaca'}`
                  }}>
                    {vendorModalData.risk_level}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Registered ID: <code>VN-{String(selectedVendorForModal.id).padStart(4, '0')}</code>
              </div>
            </div>

            {/* Key Reliability & Performance KPI Grid - Compact & Scalable */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
              {/* Reliability Index Card */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1.5px solid #0f766e',
                borderRadius: '8px',
                padding: '10px 14px',
                position: 'relative'
              }}>
                <div style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: '#0f766e', letterSpacing: '0.05em' }}>
                  Reliability Index
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginTop: '4px' }}>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                    {vendorModalData?.reliability_index !== undefined ? Number(vendorModalData.reliability_index).toFixed(1) : Number(selectedVendorForModal.reliability_score || 0).toFixed(1)}
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>/ 100</span>
                </div>
                <div style={{ marginTop: '6px', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(Number(vendorModalData?.reliability_index ?? selectedVendorForModal.reliability_score ?? 0), 100)}%`,
                    height: '100%',
                    backgroundColor: Number(vendorModalData?.reliability_index ?? selectedVendorForModal.reliability_score ?? 0) >= 75 ? '#10b981' : Number(vendorModalData?.reliability_index ?? selectedVendorForModal.reliability_score ?? 0) >= 50 ? '#f59e0b' : '#ef4444'
                  }} />
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px' }}>
                  {getReliabilityInfo(vendorModalData?.reliability_score || selectedVendorForModal.reliability_score).label} Reliability
                </div>
              </div>

              {/* Quality Rating */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 14px'
              }}>
                <div style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                  Quality Rating
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginTop: '4px' }}>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                    {vendorModalData?.quality_rating !== undefined ? Number(vendorModalData.quality_rating).toFixed(1) : (vendorModalData?.rating ? Number(vendorModalData.rating).toFixed(1) : '5.0')}
                  </span>
                  <span style={{ fontSize: '12px', color: '#eab308' }}>★ / 5.0</span>
                </div>
                <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px', fontWeight: 600 }}>
                  {vendorModalData?.on_time_delivery_rate ? `${vendorModalData.on_time_delivery_rate}% On-Time Delivery` : 'Delivery Commitments Met'}
                </div>
              </div>

              {/* Awarded Contracts Count */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 14px'
              }}>
                <div style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                  Awarded Contracts
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginTop: '4px' }}>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                    {vendorModalData?.contracts?.length ?? (vendorModalData?.completed_contracts || 0)}
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>agreements</span>
                </div>
                <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px', fontWeight: 600 }}>
                  {vendorModalData?.active_contracts ? `${vendorModalData.active_contracts} Active Agreement(s)` : 'Lifecycle Tracked'}
                </div>
              </div>

              {/* Fulfillment Status */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 14px'
              }}>
                <div style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                  Commercial Terms
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginTop: '4px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                    {vendorModalData?.payment_terms || selectedVendorForModal.payment_terms || 'Net 30'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {vendorModalData?.completed_contracts || 0} Contracts Completed
                </div>
              </div>
            </div>

            {/* Vendor Corporate Details Info Card - Compact & Scalable */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '10px 16px'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Supplier Corporate Details & Points of Contact
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '8px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', display: 'block', fontWeight: 600 }}>Primary Liaison:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{vendorModalData?.contact_person || selectedVendorForModal.contact_person}</strong>
                  {(vendorModalData?.contact_role || selectedVendorForModal.contact_role) && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}> ({vendorModalData?.contact_role || selectedVendorForModal.contact_role})</span>}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', display: 'block', fontWeight: 600 }}>Email Communications:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{vendorModalData?.email || selectedVendorForModal.email}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', display: 'block', fontWeight: 600 }}>Phone / Direct:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{vendorModalData?.phone || selectedVendorForModal.phone || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', display: 'block', fontWeight: 600 }}>GST / Tax Identification:</span>
                  <code style={{ fontSize: '11.5px', color: 'var(--text-primary)', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>{vendorModalData?.gst_number || selectedVendorForModal.gst_number || '—'}</code>
                </div>
                <div style={{ gridColumn: '1 / -1', paddingTop: '6px', borderTop: '1px dashed #e2e8f0', display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600 }}>Facility / Registered Address:</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '11.5px' }}>{vendorModalData?.address || selectedVendorForModal.address || 'National Headquarters'}</span>
                </div>
              </div>
            </div>

            {/* Section: Contracts He Has Been Part Of */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '10px 16px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '6px'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    Awarded Contracts & Agreements ({vendorModalData?.contracts?.length || 0})
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    All enterprise procurement contracts awarded to this supplier.
                  </div>
                </div>
                {vendorModalLoading && (
                  <span style={{ fontSize: '11px', color: '#0284c7' }}>
                    Syncing live contract records...
                  </span>
                )}
              </div>

              {(!vendorModalData?.contracts || vendorModalData.contracts.length === 0) ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b' }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ margin: '0 auto 8px auto', display: 'block' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                    No Historical Contracts on Record
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', maxWidth: '420px', margin: '0 auto' }}>
                    This supplier has not been awarded any procurement contracts yet. When purchase orders or requisitions are finalized and authorized by Finance, the binding contract will automatically appear here.
                  </div>
                </div>
              ) : (
                <div className="table-responsive" style={{ margin: 0, maxHeight: '240px', overflowY: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 12px', fontSize: '11px' }}>Contract Number</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px' }}>Agreement Title</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px' }}>Duration / Dates</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px' }}>Order Value</th>
                        <th style={{ padding: '8px 12px', fontSize: '11px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorModalData.contracts.map((c) => (
                        <tr key={c.id}>
                          <td style={{ padding: '8px 12px' }}>
                            <strong style={{ color: '#0f766e' }}>{c.contract_number}</strong>
                            <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                              {c.purchase_orders_count ? `${c.purchase_orders_count} PO(s) Linked` : 'Direct Agreement'}
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.title}</div>
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '11.5px', color: '#475569' }}>
                            <div>Start: <strong>{c.start_date}</strong></div>
                            <div>End: <strong>{c.end_date}</strong></div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <strong style={{ color: '#0f172a' }}>
                              {c.total_purchase_amount ? `₹${Number(c.total_purchase_amount).toLocaleString('en-IN')}` : 'Variable / Active'}
                            </strong>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span
                              className="badge"
                              style={{
                                fontSize: '10.5px',
                                padding: '2px 8px',
                                backgroundColor: (c.status === 'active') ? '#ecfdf5' : (c.status === 'expiring_soon') ? '#fffbeb' : '#f1f5f9',
                                color: (c.status === 'active') ? '#047857' : (c.status === 'expiring_soon') ? '#b45309' : '#475569',
                                border: `1px solid ${(c.status === 'active') ? '#a7f3d0' : (c.status === 'expiring_soon') ? '#fde68a' : '#cbd5e1'}`
                              }}
                            >
                              {(c.status || '').toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Reliability intelligence recalculated automatically after each delivery completion.
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 16px', fontSize: '13px' }}
              onClick={() => {
                setSelectedVendorForModal(null);
                setVendorModalData(null);
              }}
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
