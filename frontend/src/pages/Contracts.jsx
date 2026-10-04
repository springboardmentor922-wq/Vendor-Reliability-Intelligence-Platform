import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

export const Contracts = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('contracts');
  const [contracts, setContracts] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Forms
  const [contractForm, setContractForm] = useState({
    vendor_id: '',
    title: '',
    start_date: '',
    end_date: '',
    file_path: ''
  });

  const [certForm, setCertForm] = useState({
    vendor_id: '',
    contract_id: '',
    name: '',
    issued_date: '',
    expiry_date: '',
    document_path: ''
  });

  const canManageContracts = ['Administrator', 'Procurement Manager', 'Supply Chain Manager'].includes(user?.role);
  const isVendor = user?.role === 'Vendor';

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [contractsData, certsData, vendorsData] = await Promise.all([
        api.getContracts(),
        api.getCertifications(),
        !isVendor ? api.getVendors() : Promise.resolve([])
      ]);
      setContracts(contractsData);
      setCertifications(certsData);
      setVendors(vendorsData);
    } catch (err) {
      setError(err.message || 'Failed to load contracts and compliance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCreateContract = async (e) => {
    e.preventDefault();
    try {
      await api.createContract({
        vendor_id: Number(contractForm.vendor_id),
        title: contractForm.title,
        start_date: contractForm.start_date,
        end_date: contractForm.end_date,
        file_path: contractForm.file_path || undefined
      });
      setIsContractModalOpen(false);
      setContractForm({ vendor_id: '', title: '', start_date: '', end_date: '', file_path: '' });
      loadData();
    } catch (err) {
      alert('Error creating contract: ' + err.message);
    }
  };

  const handleCreateCert = async (e) => {
    e.preventDefault();
    try {
      await api.createCertification({
        vendor_id: isVendor ? user.vendor_id : Number(certForm.vendor_id),
        contract_id: certForm.contract_id ? Number(certForm.contract_id) : undefined,
        name: certForm.name,
        issued_date: certForm.issued_date,
        expiry_date: certForm.expiry_date,
        document_path: certForm.document_path || undefined
      });
      setIsCertModalOpen(false);
      setCertForm({ vendor_id: '', contract_id: '', name: '', issued_date: '', expiry_date: '', document_path: '' });
      loadData();
    } catch (err) {
      alert('Error adding certification: ' + err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contracts & Compliance Management</h1>
          <p className="page-subtitle">
            Repository of legal supplier agreements, 30-day renewal alerts, and compliance certifications.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canManageContracts && (
            <button className="btn btn-primary" onClick={() => setIsContractModalOpen(true)}>
              + Register Contract
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setIsCertModalOpen(true)}>
            + Add Certification
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'contracts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contracts')}
        >
          Master Contracts ({contracts.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'certifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('certifications')}
        >
          Certifications & Accreditations ({certifications.length})
        </button>
      </div>

      {/* --- TAB 1: CONTRACTS --- */}
      {activeTab === 'contracts' && (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contract #</th>
                    <th>Supplier</th>
                    <th>Agreement Title</th>
                    <th>Term (Start - End)</th>
                    <th>Status</th>
                    <th>Repository Link</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No contracts found.
                      </td>
                    </tr>
                  ) : (
                    contracts.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.contract_number}</strong></td>
                        <td>{c.vendor?.company_name || 'N/A'}</td>
                        <td>
                          <strong>{c.title}</strong>
                          {c.status === 'expiring_soon' && (
                            <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>
                              Renewal required within 30 days
                            </div>
                          )}
                        </td>
                        <td>
                          {c.start_date} &rarr; <strong>{c.end_date}</strong>
                        </td>
                        <td><StatusBadge status={c.status} /></td>
                        <td>
                          {c.file_path ? (
                            <span style={{ fontSize: '12px', color: 'var(--primary)', fontFamily: 'monospace' }}>
                              {c.file_path}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No doc attached</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: CERTIFICATIONS --- */}
      {activeTab === 'certifications' && (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Certification Name</th>
                    <th>Supplier</th>
                    <th>Issued Date</th>
                    <th>Expiration Date</th>
                    <th>Document Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {certifications.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No certifications on record.
                      </td>
                    </tr>
                  ) : (
                    certifications.map((cert) => {
                      const isExpired = new Date(cert.expiry_date) < new Date();
                      return (
                        <tr key={cert.id}>
                          <td>
                            <strong>{cert.name}</strong>
                          </td>
                          <td>{cert.vendor?.company_name || 'N/A'}</td>
                          <td>{cert.issued_date}</td>
                          <td>
                            {cert.expiry_date}
                            {isExpired && (
                              <span className="badge badge-rejected" style={{ marginLeft: '8px' }}>
                                Expired
                              </span>
                            )}
                          </td>
                          <td>
                            {cert.document_path ? (
                              <span style={{ fontSize: '12px', color: 'var(--primary)', fontFamily: 'monospace' }}>
                                {cert.document_path}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Verified online</span>
                            )}
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

      {/* Modal: Register Contract */}
      <Modal
        isOpen={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
        title="Register Supplier Contract"
      >
        <form onSubmit={handleCreateContract}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Select Supplier *</label>
              <select
                className="form-select"
                value={contractForm.vendor_id}
                onChange={(e) => setContractForm({ ...contractForm, vendor_id: e.target.value })}
                required
              >
                <option value="">-- Choose Supplier --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.company_name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Contract Agreement Title *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Master Supply & Service Level Agreement"
                value={contractForm.title}
                onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={contractForm.start_date}
                  onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={contractForm.end_date}
                  onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Document Repository Path / URL</label>
              <input
                type="text"
                className="form-control"
                placeholder="/documents/contracts/2026-CTR.pdf"
                value={contractForm.file_path}
                onChange={(e) => setContractForm({ ...contractForm, file_path: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsContractModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Register Contract
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Certification */}
      <Modal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        title="Record Quality Certification"
      >
        <form onSubmit={handleCreateCert}>
          <div className="modal-body">
            {!isVendor && (
              <div className="form-group">
                <label className="form-label">Select Supplier *</label>
                <select
                  className="form-select"
                  value={certForm.vendor_id}
                  onChange={(e) => setCertForm({ ...certForm, vendor_id: e.target.value })}
                  required
                >
                  <option value="">-- Choose Supplier --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.company_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Certification Standard Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. ISO 9001:2015 Quality Management"
                value={certForm.name}
                onChange={(e) => setCertForm({ ...certForm, name: e.target.value })}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Issued Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={certForm.issued_date}
                  onChange={(e) => setCertForm({ ...certForm, issued_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Expiry Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={certForm.expiry_date}
                  onChange={(e) => setCertForm({ ...certForm, expiry_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Document Path</label>
              <input
                type="text"
                className="form-control"
                placeholder="/documents/certifications/ISO-CERT.pdf"
                value={certForm.document_path}
                onChange={(e) => setCertForm({ ...certForm, document_path: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsCertModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Certification
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
