import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

const REPORT_TYPES = [
  { id: 'vendor_performance', title: 'Vendor Performance Reports' },
  { id: 'procurement_reports', title: 'Procurement Reports' },
  { id: 'po_reports', title: 'Purchase Order Reports' },
  { id: 'compliance_reports', title: 'Compliance Reports' },
  { id: 'contract_reports', title: 'Contract Reports' }
];

export const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeReport, setActiveReport] = useState('vendor_performance');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedPO, setSelectedPO] = useState(null);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);

  const loadReportData = async (reportType) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getReportData(reportType);
      setReportData(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (reportId) => {
    if (activeReport === reportId) return;
    setActiveReport(reportId);
    setReportData([]);
    setSearchTerm('');
  };

  useEffect(() => {
    loadReportData(activeReport);
  }, [activeReport]);

  const handleDownloadExport = async (format) => {
    try {
      const blob = await api.getExportReport(activeReport, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'excel' ? 'xlsx' : 'csv';
      a.download = `${activeReport}_report_${new Date().toISOString().split('T')[0]}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Error downloading ${format.toUpperCase()}: ` + err.message);
    }
  };

  const handlePrintPDF = () => {
    const title = REPORT_TYPES.find(r => r.id === activeReport)?.title || 'Report';
    const dateStr = new Date().toLocaleString();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up window blocked. Please allow pop-ups for this site to export the Executive PDF.');
      return;
    }

    let tableHtml = '';
    if (activeReport === 'vendor_performance') {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Supplier Name</th>
              <th>Category</th>
              <th>Reliability Score</th>
              <th>Risk Tier</th>
              <th>On-Time Rate</th>
              <th>Avg Quality</th>
              <th>Orders</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(r => `
              <tr>
                <td>#${r.vendor_id || r.id}</td>
                <td><strong>${r.company_name}</strong></td>
                <td>${r.category}</td>
                <td><strong>${r.reliability_score}/100</strong></td>
                <td>${r.supplier_tier || r.risk_level}</td>
                <td>${r.on_time_delivery_rate}%</td>
                <td>${r.average_quality_rating} / 5.0</td>
                <td>${r.total_orders}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeReport === 'procurement_reports') {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>Requisition ID</th>
              <th>Title</th>
              <th>Department</th>
              <th>Status</th>
              <th>Estimated Cost</th>
              <th>Created Date</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(r => `
              <tr>
                <td>#${r.id}</td>
                <td><strong>${r.title}</strong></td>
                <td>${r.department}</td>
                <td>${r.status}</td>
                <td>₹${Number(r.estimated_cost || 0).toLocaleString()}</td>
                <td>${r.created_at}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeReport === 'po_reports') {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Amount (₹)</th>
              <th>Status</th>
              <th>Order Date</th>
              <th>Expected Delivery</th>
              <th>Fulfillment Status</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(r => `
              <tr>
                <td><strong>${r.po_number}</strong></td>
                <td>${r.supplier}</td>
                <td><strong>₹${Number(r.total_amount || 0).toLocaleString()}</strong></td>
                <td>${r.status}</td>
                <td>${r.order_date}</td>
                <td>${r.expected_delivery_date}</td>
                <td>${r.delivery_status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeReport === 'compliance_reports') {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Supplier</th>
              <th>Certification</th>
              <th>Issuing Body</th>
              <th>Expiry Date</th>
              <th>Compliance Status</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(r => `
              <tr>
                <td>#${r.id}</td>
                <td><strong>${r.supplier}</strong></td>
                <td>${r.certification_name}</td>
                <td>${r.issuing_body}</td>
                <td>${r.expiry_date}</td>
                <td>${r.compliance_status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>Contract #</th>
              <th>Title</th>
              <th>Supplier</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(r => `
              <tr>
                <td><strong>${r.contract_number}</strong></td>
                <td>${r.title}</td>
                <td>${r.supplier}</td>
                <td>${r.start_date}</td>
                <td>${r.end_date}</td>
                <td>${r.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>VendorIQ Report - ${title}</title>
        <style>
          body { font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1e293b; }
          .header { border-bottom: 2px solid #0f766e; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
          .logo { font-size: 24px; font-weight: 800; color: #0f766e; }
          .meta { font-size: 12px; color: #64748b; text-align: right; }
          h1 { font-size: 20px; margin: 0 0 5px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th { background: #f8fafc; text-align: left; padding: 10px 12px; border-bottom: 2px solid #cbd5e1; font-weight: 600; color: #475569; }
          td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
          .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">VendorIQ Platform</div>
            <h1>${title}</h1>
          </div>
          <div class="meta">
            <div>Generated by: ${user?.full_name || 'System User'} (${user?.role || 'Auditor'})</div>
            <div>Timestamp: ${dateStr}</div>
            <div>Classification: Official Enterprise Procurement Audit</div>
          </div>
        </div>

        ${tableHtml}

        <div class="footer">
          Confidential Document &bull; VendorIQ Predictive Vendor Reliability & Procurement Risk Platform &bull; Enterprise Compliance Intelligence
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filteredRows = reportData.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(r).some(val =>
      val !== null && val !== undefined && String(val).toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Compliance Audits</h1>
          <p className="page-subtitle">
            Export real-time database intelligence in CSV, Excel, or Executive PDF formats.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => handleDownloadExport('csv')} disabled={loading}>
            Download CSV
          </button>
          <button className="btn btn-secondary" onClick={() => handleDownloadExport('excel')} disabled={loading} style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' }}>
            Export Excel (.xlsx)
          </button>
          <button className="btn btn-primary" onClick={handlePrintPDF} disabled={loading}>
            Export Executive PDF
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      
      <div className="tabs">
        {REPORT_TYPES.map((rep) => (
          <button
            key={rep.id}
            className={`tab-btn ${activeReport === rep.id ? 'active' : ''}`}
            onClick={() => handleTabChange(rep.id)}
          >
            
            {rep.title}
          </button>
        ))}
      </div>

      
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search report records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: '360px' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Showing {filteredRows.length} of {reportData.length} records
            </span>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 700 }}>
            ● Live PostgreSQL/SQLite Data Synced
          </div>
        </div>
      </div>

      
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-responsive">
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Querying report database tables...
              </div>
            ) : filteredRows.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No records found matching the query.
              </div>
            ) : (
              <table className="data-table">
                
                {activeReport === 'vendor_performance' && (
                  <>
                    <thead>
                      <tr>
                        <th>Supplier</th>
                        <th>Category</th>
                        <th>Reliability Score</th>
                        <th>Risk Tier</th>
                        <th>On-Time Rate</th>
                        <th>Quality</th>
                        <th>Response Time</th>
                        <th>Total Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r) => (
                        <tr key={r.vendor_id || r.id}>
                          <td><strong>{r.company_name}</strong></td>
                          <td><span className="badge badge-neutral">{r.category?.replace('_', ' ')}</span></td>
                          <td>
                            <strong style={{ color: (r.reliability_score ?? 0) >= 80 ? 'var(--success)' : (r.reliability_score ?? 0) >= 60 ? 'var(--accent)' : 'var(--danger)' }}>
                              {r.reliability_score ?? 0} / 100
                            </strong>
                          </td>
                          <td>
                            <span className={`badge ${r.risk_level === 'Low' ? 'badge-approved' : r.risk_level === 'Medium' ? 'badge-pending' : 'badge-rejected'}`}>
                              {r.supplier_tier || r.risk_level}
                            </span>
                          </td>
                          <td><strong>{r.on_time_delivery_rate}%</strong></td>
                          <td>{r.average_quality_rating} / 5.0</td>
                          <td>{r.average_response_hours}h</td>
                          <td>{r.total_orders}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                
                {activeReport === 'procurement_reports' && (
                  <>
                    <thead>
                      <tr>
                        <th>Requisition ID</th>
                        <th>Requisition Title</th>
                        <th>Department</th>
                        <th>Requester</th>
                        <th>Status</th>
                        <th>Created Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r) => (
                        <tr key={r.id}>
                          <td><strong>#{r.id}</strong></td>
                          <td>{r.title}</td>
                          <td><span className="badge badge-neutral">{r.department}</span></td>
                          <td>{r.requested_by}</td>
                          <td><StatusBadge status={r.status} /></td>
                          <td>{r.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                
                {activeReport === 'po_reports' && (
                  <>
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>Supplier</th>
                        <th>Amount (₹)</th>
                        <th>Status</th>
                        <th>Expected Delivery</th>
                        <th>Actual Delivery</th>
                        <th>Fulfillment Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r) => {
                        const delStatus = r.delivery_status || (r.status === 'delivered' ? 'Delivered (On-Time)' : 'In-Transit');
                        const isOntime = String(delStatus).toLowerCase().includes('on-time');
                        const isDelayed = String(delStatus).toLowerCase().includes('delayed');
                        const badgeClass = isOntime ? 'badge-approved' : isDelayed ? 'badge-rejected' : 'badge-ordered';

                        return (
                          <tr key={r.id || r.po_number}>
                            <td>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontWeight: 700, padding: '3px 8px', fontSize: '11.5px' }}
                                onClick={() => { setSelectedPO(r); setIsPOModalOpen(true); }}
                              >
                                {r.po_number || 'N/A'}
                              </button>
                            </td>
                            <td>
                              <strong>{r.supplier || 'N/A'}</strong>
                              {r.category && (
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                  {r.category.replace('_', ' ')}
                                </div>
                              )}
                            </td>
                            <td><strong>₹{Number(r.total_amount || 0).toLocaleString()}</strong></td>
                            <td><StatusBadge status={r.status} /></td>
                            <td>{r.expected_delivery_date || 'N/A'}</td>
                            <td>{r.actual_delivery_date || 'Pending Delivery'}</td>
                            <td>
                              <span className={`badge ${badgeClass}`}>
                                {delStatus}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: '11.5px', padding: '3px 9px' }}
                                  onClick={() => { setSelectedPO(r); setIsPOModalOpen(true); }}
                                >
                                  View PO
                                </button>
                                <button
                                  className="btn btn-outline btn-sm"
                                  style={{ fontSize: '11.5px', padding: '3px 9px' }}
                                  onClick={() => navigate('/procurement')}
                                >
                                  Open in POs ↗
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </>
                )}

                
                {activeReport === 'compliance_reports' && (
                  <>
                    <thead>
                      <tr>
                        <th>Cert ID</th>
                        <th>Supplier</th>
                        <th>Certification Name</th>
                        <th>Issuing Body</th>
                        <th>Expiry Date</th>
                        <th>Compliance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r) => (
                        <tr key={r.id}>
                          <td>#{r.id}</td>
                          <td><strong>{r.supplier}</strong></td>
                          <td>{r.certification_name}</td>
                          <td>{r.issuing_body}</td>
                          <td>{r.expiry_date}</td>
                          <td>
                            <span className={`badge ${r.verified ? 'badge-approved' : 'badge-rejected'}`}>
                              {r.compliance_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                
                {activeReport === 'contract_reports' && (
                  <>
                    <thead>
                      <tr>
                        <th>Contract #</th>
                        <th>Agreement Title</th>
                        <th>Supplier</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r) => (
                        <tr key={r.id}>
                          <td><strong>{r.contract_number}</strong></td>
                          <td>{r.title}</td>
                          <td>{r.supplier}</td>
                          <td>{r.start_date}</td>
                          <td>{r.end_date}</td>
                          <td><StatusBadge status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            )}
          </div>
        </div>
      </div>

      
      {selectedPO && (
        <Modal
          isOpen={isPOModalOpen}
          onClose={() => setIsPOModalOpen(false)}
          title={`Purchase Order: ${selectedPO.po_number || 'Details'}`}
          maxWidth="680px"
        >
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '14px 18px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div>
                <span className="badge badge-neutral" style={{ textTransform: 'capitalize', fontSize: '11px', marginBottom: '4px' }}>
                  {selectedPO.category ? selectedPO.category.replace('_', ' ') : 'Supplier Order'}
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0', color: 'var(--text-primary)' }}>
                  {selectedPO.supplier || 'N/A'}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Order Date: {selectedPO.order_date || 'N/A'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <StatusBadge status={selectedPO.status} />
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', marginTop: '6px' }}>
                  ₹{Number(selectedPO.total_amount || 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Expected Delivery Date</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                  {selectedPO.expected_delivery_date || 'N/A'}
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Actual Delivery Date</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                  {selectedPO.actual_delivery_date || 'Pending Delivery'}
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Fulfillment Status</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px', color: String(selectedPO.delivery_status || '').toLowerCase().includes('on-time') ? 'var(--success)' : String(selectedPO.delivery_status || '').toLowerCase().includes('delayed') ? 'var(--danger)' : 'var(--accent)' }}>
                  {selectedPO.delivery_status || (selectedPO.status === 'delivered' ? 'Delivered' : 'In-Transit')}
                  {selectedPO.delay_days > 0 && ` (${selectedPO.delay_days}d delay)`}
                </div>
              </div>
            </div>

            
            {selectedPO.items && selectedPO.items.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Line Items ({selectedPO.items.length})</h4>
                <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Item Description</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.item_name}</td>
                          <td>{item.quantity}</td>
                          <td>₹{Number(item.unit_price || 0).toLocaleString()}</td>
                          <td><strong>₹{Number(item.subtotal || (item.quantity * item.unit_price) || 0).toLocaleString()}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setIsPOModalOpen(false);
                navigate('/procurement');
              }}
            >
              Manage in Procurement & POs ↗
            </button>
            <button className="btn btn-secondary" onClick={() => setIsPOModalOpen(false)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
