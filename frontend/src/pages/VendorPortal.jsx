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
      await api.publicRegisterVendor(formData);
      setRegSuccess(`Registration submitted successfully for ${formData.company_name}! Your request has been forwarded to the Administrator for approval. Upon approval, your supplier account will be initialized with a reliability score and rating of 0.0.`);
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
              backgroundColor: '#0f3b33',
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
              boxShadow: '0 1px 2px rgba(15, 59, 51, 0.2)'
            }}
          >
            <span>+</span>
            <span>Register vendor</span>
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
            backgroundColor: activePortalTab === 'directory' ? '#0f3b33' : 'var(--bg-surface)',
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
            backgroundColor: activePortalTab === 'requisitions' ? '#0f3b33' : 'var(--bg-surface)',
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

                      {/* Reliability Score Bar */}
                      <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: '8px', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Reliability Rating</span>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', padding: '12px 20px', backgroundColor: '#fcfbf8', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Terms: <strong>{v.payment_terms || 'Net 30'}</strong>
                      </span>
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
                          setAcquireVendorId('');
                          setAcquireStatus({ error: '', success: '', loading: false });
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
                        Acquire Requisition →
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
              <div className="alert alert-warning" style={{ fontSize: '12.5px' }}>
                <strong>Procurement Governance Rule:</strong> To acquire this requisition, you must represent an active supplier registered under the <strong>{getCategoryLabel(selectedReqForAcquire.category)}</strong> category.
              </div>

              {/* Select Supplier */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Select Your Supplier Company *
                </label>
                <select
                  className="form-select"
                  value={acquireVendorId}
                  onChange={(e) => {
                    setAcquireVendorId(e.target.value);
                    setAcquireStatus({ error: '', success: '', loading: false });
                  }}
                  required
                >
                  <option value="">-- Choose your registered supplier --</option>
                  {vendors.map((v) => {
                    const isSameCategory = v.category === selectedReqForAcquire.category;
                    return (
                      <option key={v.id} value={v.id}>
                        {v.company_name} [{getCategoryLabel(v.category)}] {isSameCategory ? '(Eligible)' : '(Category Mismatch)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {acquireVendorId && (() => {
                const chosen = vendors.find(v => String(v.id) === String(acquireVendorId));
                if (chosen && chosen.category !== selectedReqForAcquire.category) {
                  return (
                    <div style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 600 }}>
                      Cannot acquire: {chosen.company_name} is in '{getCategoryLabel(chosen.category)}', which does not match required category '{getCategoryLabel(selectedReqForAcquire.category)}'.
                    </div>
                  );
                }
                return null;
              })()}
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
                  vendors.find(v => String(v.id) === String(acquireVendorId))?.category !== selectedReqForAcquire.category
                }
                style={{
                  backgroundColor: '#0f3b33',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '9px 18px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: acquireStatus.loading ? 'not-allowed' : 'pointer'
                }}
              >
                {acquireStatus.loading ? 'Processing Order...' : 'Confirm Acquisition (Generate PO)'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
