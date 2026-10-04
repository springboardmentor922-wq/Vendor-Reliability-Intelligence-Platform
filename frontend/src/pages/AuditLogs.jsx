import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAuditLogs({
        action: actionFilter || undefined,
        entity: entityFilter || undefined
      });
      setLogs(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter, entityFilter]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Audit Trails & Governance</h1>
          <p className="page-subtitle">
            Immutable chronological records of approvals, status modifications, contracts, and authentication events.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadLogs}>
          Refresh Audit Feed
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                className="form-control"
                placeholder="Filter by Action (e.g. APPROVE_PO, REGISTER)..."
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                className="form-control"
                placeholder="Filter by Target Entity (e.g. PurchaseOrder, Vendor)..."
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Audit Trail Records ({logs.length})</h2>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>User / Role</th>
                  <th>Audit Trail Event Details</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>
                      Retrieving audit records...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No audit log entries found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td><code>#{log.id}</code></td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontFamily: 'monospace' }}>
                          {log.action}
                        </span>
                      </td>
                      <td><strong>{log.entity}</strong></td>
                      <td>
                        {log.user ? (
                          <div>
                            <div>{log.user.full_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{log.user.role}</div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>System Engine</span>
                        )}
                      </td>
                      <td style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>{log.details}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
