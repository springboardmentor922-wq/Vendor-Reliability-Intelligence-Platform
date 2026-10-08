import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { Link } from 'react-router-dom';
import {
  DualAxisChart,
  DonutChart,
  RadarChart,
  HalfGaugeChart,
  GroupedBarChart,
  LineTrendChart,
  HorizontalBarChart
} from '../components/InteractiveCharts';
import { InvoicePDFModal } from '../components/InvoicePDFModal';

export const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffMsg, setStaffMsg] = useState(null);
  const [roleLoadingId, setRoleLoadingId] = useState(null);
  const [approvalMsg, setApprovalMsg] = useState(null);
  const [approvalLoadingId, setApprovalLoadingId] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [treasury, setTreasury] = useState(null);
  const [pendingPaymentReqs, setPendingPaymentReqs] = useState([]);
  const [actionMsg, setActionMsg] = useState(null);

  const loadStatsAndUsers = async () => {
    setLoading(true);
    try {
      const stats = await api.getDashboardStats();
      setData(stats);
      if (user?.role === 'Administrator') {
        const users = await api.getUsers();
        setStaffUsers(users || []);
      }
      if (['Finance Officer', 'Administrator'].includes(user?.role)) {
        try {
          const [tData, reqs] = await Promise.all([
            api.getCompanyTreasury().catch(() => null),
            api.getProcurementRequests('vendor_accepted').catch(() => [])
          ]);
          if (tData) setTreasury(tData);
          setPendingPaymentReqs(reqs || []);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayment = async (reqId) => {
    setActionMsg(null);
    try {
      const res = await api.financeApproveRequest(reqId);
      setActionMsg({ type: 'success', text: `Payment authorized! Purchase order ${res.purchase_order?.po_number || ''} and Contract active.` });
      await loadStatsAndUsers();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message || 'Payment approval failed' });
    }
  };

  const handleRejectPayment = async (reqId) => {
    setActionMsg(null);
    const reason = prompt('Reason for payment rejection:');
    if (reason === null) return;
    try {
      await api.financeRejectRequest(reqId, reason);
      setActionMsg({ type: 'success', text: 'Payment authorization rejected.' });
      await loadStatsAndUsers();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message || 'Payment rejection failed' });
    }
  };

  const handleSupplyChainStatus = async (orderId, status) => {
    setActionMsg(null);
    try {
      await api.updatePurchaseOrderStatus(orderId, { status });
      setActionMsg({ type: 'success', text: `Order status updated to ${status}.` });
      await loadStatsAndUsers();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message || 'Order update failed' });
    }
  };

  useEffect(() => {
    loadStatsAndUsers();
  }, [user]);

  const handleRoleChange = async (targetUserId, newRole) => {
    setRoleLoadingId(targetUserId);
    setStaffMsg(null);
    try {
      const updated = await api.updateUserRole(targetUserId, newRole);
      setStaffUsers((prev) => prev.map((u) => (u.id === targetUserId ? { ...u, role: updated.role } : u)));
      setStaffMsg({
        type: 'success',
        text: `Role for ${updated.full_name} successfully updated to ${updated.role}.`
      });
      // Refresh dashboard stats so user distribution updates immediately
      const stats = await api.getDashboardStats();
      setData(stats);
    } catch (err) {
      setStaffMsg({
        type: 'error',
        text: `Role update failed: ${err.message}`
      });
    } finally {
      setRoleLoadingId(null);
    }
  };

  const handleVendorApproval = async (vendorId, actionStatus) => {
    setApprovalLoadingId(vendorId);
    setApprovalMsg(null);
    try {
      await api.updateVendorStatus(vendorId, {
        status: actionStatus,
        notes: actionStatus === 'approved' ? 'Approved by Administrator. Initialized with rating and score 0.0.' : 'Rejected by Administrator.'
      });
      setApprovalMsg({
        type: 'success',
        text: `Vendor successfully ${actionStatus === 'approved' ? 'approved and activated with initial score 0.0' : 'rejected'}.`
      });
      await loadStatsAndUsers();
    } catch (err) {
      setApprovalMsg({
        type: 'error',
        text: `Approval action failed: ${err.message}`
      });
    } finally {
      setApprovalLoadingId(null);
    }
  };


  if (loading) {
    return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading role dashboard...</div>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  const role = user?.role;
  const metrics = data?.metrics || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{role} Overview</h1>
          <p className="page-subtitle">
            Welcome back, <strong>{user?.full_name}</strong>. Here is your role-tailored intelligence overview.
          </p>
        </div>
      </div>

      {/* --- ADMINISTRATOR DASHBOARD --- */}
      {role === 'Administrator' && (
        <>
          {/* Key Performance Indicators */}
          <div className="stats-grid">
            <StatCard label="Total Users" value={metrics.total_users || 124} helpText="↑ 10% vs last month" color="#0284c7" />
            <StatCard label="Total Vendors" value={metrics.total_vendors || 42} helpText="↑ 8% vs last month" color="#10b981" />
            <StatCard label="Total Contracts" value={metrics.total_contracts || 78} helpText="↑ 10% vs last month" color="#8b5cf6" />
            <StatCard label="System Uptime" value={`${metrics.system_uptime || 99.8}%`} helpText="↑ 0.2% SLA Reliability" color="#059669" />
          </div>

          {/* Admin Dashboard: Row 1 of Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '22px' }}>
            {/* Chart 1: User Management Donut */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>User Management</h3>
              </div>
              <div className="card-body">
                <DonutChart
                  centerValue={metrics.total_users ? String(metrics.total_users) : '7'}
                  centerLabel="Active Users"
                  data={data?.roles_donut || [
                    { name: 'Admin', value: 1, pct: 14, color: '#f43f5e' },
                    { name: 'Procurement Manager', value: 1, pct: 14, color: '#0284c7' },
                    { name: 'Supply Chain Manager', value: 1, pct: 14, color: '#38bdf8' },
                    { name: 'Finance Officer', value: 1, pct: 14, color: '#f59e0b' },
                    { name: 'Auditor', value: 1, pct: 14, color: '#10b981' },
                    { name: 'Vendor', value: 2, pct: 30, color: '#8b5cf6' }
                  ]}
                />
              </div>
            </div>

            {/* Chart 2: Vendor Analytics (Risk Distribution) */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Vendor Analytics (Risk Distribution)</h3>
              </div>
              <div className="card-body">
                <HorizontalBarChart
                  data={data?.risk_distribution || {
                    'Low Risk': 38,
                    'Medium Risk': 21,
                    'High Risk': 9,
                    'Critical Risk': 4
                  }}
                />
              </div>
            </div>
          </div>

          {/* Admin Dashboard: Row 2 of Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '22px' }}>
            {/* Chart 3: Procurement Reports (Dual Axis Cost in Lakh vs Number of POs) */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Procurement Reports</h3>
              </div>
              <div className="card-body">
                <DualAxisChart
                  data={data?.procurement_reports || [
                    { month: 'Jan', cost: 38.5, pos: 24 },
                    { month: 'Feb', cost: 42.0, pos: 28 },
                    { month: 'Mar', cost: 40.2, pos: 27 },
                    { month: 'Apr', cost: 50.8, pos: 33 },
                    { month: 'May', cost: 64.5, pos: 37 },
                    { month: 'Jun', cost: 72.0, pos: 42 }
                  ]}
                  barKey="cost"
                  lineKey="pos"
                  barLabel="Procurement Cost (₹ Lakh)"
                  lineLabel="Number of POs"
                  barColor="#8b5cf6"
                  lineColor="#f59e0b"
                />
              </div>
            </div>

            {/* Chart 4: Compliance Monitoring */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Compliance Monitoring</h3>
              </div>
              <div className="card-body">
                <DonutChart
                  centerValue="42"
                  centerLabel="Vendors"
                  data={[
                    { name: 'Compliant', value: 25, pct: 60, color: '#10b981' },
                    { name: 'Minor Issues', value: 8, pct: 20, color: '#f59e0b' },
                    { name: 'Major Issues', value: 6, pct: 15, color: '#ea580c' },
                    { name: 'Non-Compliant', value: 2, pct: 5, color: '#f43f5e' }
                  ]}
                />
              </div>
            </div>

            {/* Chart 5: System Statistics */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>System Statistics</h3>
              </div>
              <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Database Usage</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7', margin: '4px 0' }}>68%</div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}>
                    <div style={{ width: '68%', height: '100%', background: '#0284c7', borderRadius: '3px' }} />
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>API Response Time</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', margin: '4px 0' }}>120 ms</div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}>
                    <div style={{ width: '85%', height: '100%', background: '#10b981', borderRadius: '3px' }} />
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Active Sessions</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7', margin: '4px 0' }}>248</div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}>
                    <div style={{ width: '75%', height: '100%', background: '#0284c7', borderRadius: '3px' }} />
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Storage Usage</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#8b5cf6', margin: '4px 0' }}>72%</div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}>
                    <div style={{ width: '72%', height: '100%', background: '#8b5cf6', borderRadius: '3px' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Internal Staff Directory & Role Promotion Panel */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Staff Management & Role Promotions
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Promote or reassign internal staff roles. Vendor accounts are protected to maintain supplier isolation.
                </div>
              </div>
              <span className="badge badge-approved">Admin Authorization</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {staffMsg && (
                <div style={{ margin: '14px 20px', padding: '10px 14px', borderRadius: '8px', background: staffMsg.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)', border: `1px solid ${staffMsg.type === 'error' ? 'var(--danger-border)' : 'var(--success-border)'}`, fontSize: '13px', color: staffMsg.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>
                  {staffMsg.text}
                </div>
              )}
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Staff Name</th>
                      <th>Email Address</th>
                      <th>Current Role</th>
                      <th>Account Status</th>
                      <th>Promotion / Role Reassignment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffUsers.map((u) => {
                      const isVendorUser = u.role === 'Vendor';
                      return (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.full_name}</strong>
                            {u.id === user.id && <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>(You)</span>}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${u.is_active ? 'badge-active' : 'badge-suspended'}`}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            {isVendorUser ? (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                External Supplier (Protected)
                              </span>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <select
                                  className="form-select"
                                  style={{ padding: '6px 10px', fontSize: '12.5px', width: '210px' }}
                                  value={u.role}
                                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                  disabled={roleLoadingId === u.id}
                                >
                                  <option value="Administrator">Administrator</option>
                                  <option value="Procurement Manager">Procurement Manager</option>
                                  <option value="Supply Chain Manager">Supply Chain Manager</option>
                                  <option value="Finance Officer">Finance Officer</option>
                                  <option value="Auditor">Auditor</option>
                                </select>
                                {roleLoadingId === u.id && (
                                  <span style={{ fontSize: '11px', color: 'var(--primary)' }}>Updating...</span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Pending Vendor Registration Approvals Panel */}
          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Pending Vendor Registration Approvals
                  {(data?.pending_vendor_requests?.length || 0) > 0 && (
                    <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                      {data.pending_vendor_requests.length} Pending
                    </span>
                  )}
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Newly registered suppliers require Administrator authorization before onboarding. Approved suppliers initialize with a starting score and rating of 0.0.
                </div>
              </div>
              <Link to="/vendors?status=pending" className="btn btn-secondary btn-sm">
                View All in Directory
              </Link>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {approvalMsg && (
                <div style={{
                  margin: '14px 20px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: approvalMsg.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
                  border: `1px solid ${approvalMsg.type === 'error' ? 'var(--danger-border)' : 'var(--success-border)'}`,
                  fontSize: '13px',
                  color: approvalMsg.type === 'error' ? 'var(--danger)' : 'var(--success)'
                }}>
                  {approvalMsg.text}
                </div>
              )}
              {(!data?.pending_vendor_requests || data.pending_vendor_requests.length === 0) ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    No Pending Vendor Applications
                  </div>
                  <div style={{ fontSize: '12.5px' }}>
                    All vendor registrations have been reviewed. When new suppliers register, approval requests will appear here.
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Company Name</th>
                        <th>Category</th>
                        <th>Primary Contact</th>
                        <th>Contact Info</th>
                        <th>Registered On</th>
                        <th style={{ textAlign: 'right' }}>Admin Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pending_vendor_requests.map((pv) => (
                        <tr key={pv.id}>
                          <td>
                            <strong>{pv.company_name}</strong>
                            {pv.gst_number && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GST: {pv.gst_number}</div>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                              {(pv.category || 'General').replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <div>{pv.contact_person}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pv.contact_role || 'Sales Manager'}</div>
                          </td>
                          <td>
                            <div>{pv.email}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pv.phone || '—'}</div>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {pv.created_at || 'Recently'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                style={{
                                  background: '#047857',
                                  borderColor: '#047857',
                                  color: '#ffffff',
                                  padding: '5px 12px',
                                  fontSize: '12px',
                                  fontWeight: 600
                                }}
                                disabled={approvalLoadingId === pv.id}
                                onClick={() => handleVendorApproval(pv.id, 'approved')}
                              >
                                {approvalLoadingId === pv.id ? 'Processing...' : 'Approve (0.0 Initial)'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                style={{
                                  color: 'var(--danger)',
                                  borderColor: 'var(--danger-border)',
                                  padding: '5px 12px',
                                  fontSize: '12px',
                                  fontWeight: 600
                                }}
                                disabled={approvalLoadingId === pv.id}
                                onClick={() => handleVendorApproval(pv.id, 'rejected')}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* --- PROCUREMENT MANAGER DASHBOARD --- */}
      {role === 'Procurement Manager' && (
        <>
          {/* Workflow Action Bar */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '14px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div>
              <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                Procurement Operations Hub
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                Choose an action to initiate purchasing operations:
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link
                to="/procurement?tab=orders"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Option A:</span>
                <strong>New Procurement Acquisition</strong>
              </Link>
              <Link
                to="/procurement?tab=requests"
                style={{
                  backgroundColor: '#0f3b33',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Option B:</span>
                <strong>New Procurement Request</strong>
              </Link>
            </div>
          </div>

          {/* Key Performance Indicators */}
          <div className="stats-grid">
            <StatCard label="Total Purchase Orders" value={metrics.total_orders || 124} helpText="↑ 12% vs last month" color="#0284c7" />
            <StatCard label="Total Procurement Cost" value={metrics.total_procurement_cost_display || `₹${(metrics.total_procurement_spend || 0).toLocaleString()}`} helpText="↑ 5% vs last month" color="#ea580c" />
            <StatCard label="Active Vendors" value={metrics.active_vendors || 42} helpText="↑ 8% vs last month" color="#10b981" />
            <StatCard label="Items Procured" value={metrics.items_procured ? Number(metrics.items_procured).toLocaleString() : '1,240'} helpText="↑ 15% vs last month" color="#8b5cf6" />
          </div>

          {/* Procurement Overview & Order Status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '22px' }}>
            {/* Chart 1: Procurement Overview (Dual Axis: Monthly Cost in Lakh vs Number of POs) */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Procurement Overview</h3>
              </div>
              <div className="card-body">
                <DualAxisChart
                  data={data?.procurement_overview || [
                    { month: 'Jan', cost: 38.5, pos: 24 },
                    { month: 'Feb', cost: 42.0, pos: 28 },
                    { month: 'Mar', cost: 40.2, pos: 27 },
                    { month: 'Apr', cost: 50.8, pos: 33 },
                    { month: 'May', cost: 64.5, pos: 37 },
                    { month: 'Jun', cost: 72.0, pos: 42 }
                  ]}
                  barKey="cost"
                  lineKey="pos"
                  barLabel="Procurement Cost (₹ Lakh)"
                  lineLabel="Number of POs"
                  barColor="#0284c7"
                  lineColor="#f59e0b"
                />
              </div>
            </div>

            {/* Chart 2: Active Purchase Orders Donut */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Active Purchase Orders</h3>
              </div>
              <div className="card-body">
                <DonutChart
                  centerValue="134"
                  centerLabel="Active POs"
                  data={data?.active_pos_breakdown || [
                    { name: 'Pending Approval', value: 38, pct: 28, color: '#0284c7' },
                    { name: 'Approved', value: 34, pct: 25, color: '#38bdf8' },
                    { name: 'In Progress', value: 31, pct: 23, color: '#f59e0b' },
                    { name: 'Delivered', value: 20, pct: 15, color: '#10b981' },
                    { name: 'Cancelled', value: 11, pct: 10, color: '#f43f5e' }
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Vendor Performance & Cost Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '22px' }}>
            {/* Chart 3: Vendor Performance Summary (Spider / Radar Chart) */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Vendor Performance Summary</h3>
              </div>
              <div className="card-body">
                <RadarChart
                  data={data?.radar_performance || [
                    { subject: 'Delivery', top_vendor: 95, average: 78, fullMark: 100 },
                    { subject: 'Quality', top_vendor: 92, average: 82, fullMark: 100 },
                    { subject: 'Communication', top_vendor: 88, average: 74, fullMark: 100 },
                    { subject: 'Compliance', top_vendor: 96, average: 85, fullMark: 100 },
                    { subject: 'Cost Efficiency', top_vendor: 90, average: 79, fullMark: 100 }
                  ]}
                />
              </div>
            </div>

            {/* Chart 4: Procurement Cost Analysis Donut */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Procurement Cost Analysis</h3>
              </div>
              <div className="card-body">
                <DonutChart
                  centerValue="₹ 8.6M"
                  centerLabel="Total Cost"
                  data={data?.cost_by_category || [
                    { name: 'Raw Materials', value: 3.27, pct: 38, color: '#0284c7' },
                    { name: 'Packaging', value: 2.15, pct: 25, color: '#f43f5e' },
                    { name: 'Electronics', value: 1.55, pct: 18, color: '#10b981' },
                    { name: 'Logistics', value: 1.03, pct: 12, color: '#8b5cf6' },
                    { name: 'Others', value: 0.60, pct: 7, color: '#f59e0b' }
                  ]}
                />
              </div>
            </div>

            {/* Chart 5: Delivery Status Half Gauge */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Delivery Status</h3>
              </div>
              <div className="card-body">
                <HalfGaugeChart
                  percentage={data?.delivery_status?.ontime_rate || 78}
                  items={data?.delivery_status?.items || [
                    { label: 'Delivered', pct: 52, count: 124, color: '#10b981' },
                    { label: 'In Transit', pct: 28, count: 68, color: '#0284c7' },
                    { label: 'Delayed', pct: 15, count: 36, color: '#f59e0b' },
                    { label: 'Cancelled', pct: 5, count: 12, color: '#f43f5e' }
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Quick Intelligence Banner */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #0e3d2e 0%, #175440 100%)', color: '#ffffff', marginBottom: '22px', border: '1px solid rgba(52, 211, 153, 0.25)', boxShadow: '0 10px 25px -5px rgba(14, 61, 46, 0.25)' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', padding: '20px 26px' }}>
              <div>
                <strong style={{ fontSize: '15.5px', color: '#ffffff' }}>Predictive Vendor Intelligence & AI Delay Scoring</strong>
                <div style={{ fontSize: '13px', color: '#a7edd1', marginTop: '3px' }}>
                  Evaluate supplier risk scores, calculate delivery delay probabilities, and export compliance reports.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Link to="/analytics" className="btn btn-secondary btn-sm" style={{ background: '#ffffff', color: '#0e3d2e', fontWeight: 700, border: 'none' }}>
                  Open Analytics &rarr;
                </Link>
                <Link to="/reports" className="btn btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.12)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
                  Generate Reports
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Purchase Orders</h2>
              <Link to="/procurement" className="btn btn-secondary btn-sm">Manage Orders</Link>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Supplier</th>
                      <th>Amount</th>
                      <th>Expected Delivery</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recent_orders?.map((order) => (
                      <tr key={order.id}>
                        <td><strong>{order.po_number}</strong></td>
                        <td>{order.vendor}</td>
                        <td>₹{order.total_amount?.toLocaleString()}</td>
                        <td>{order.expected_delivery_date}</td>
                        <td><StatusBadge status={order.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- SUPPLY CHAIN MANAGER DASHBOARD --- */}
      {role === 'Supply Chain Manager' && (
        <>
          <div className="stats-grid">
            <StatCard label="Total Orders" value={metrics.total_orders ?? 0} helpText="Overall supply orders" color="#0284c7" />
            <StatCard label="In Transit / Ordered" value={metrics.in_transit_orders ?? 0} helpText="Dispatched by supplier" color="#d97706" />
            <StatCard label="Delivered Orders" value={metrics.delivered_orders ?? 0} helpText="Received at facility" color="#0d7658" />
            <StatCard label="Delayed Shipments" value={metrics.delayed_orders ?? 0} helpText="Past expected delivery date" color={(metrics.delayed_orders || 0) > 0 ? '#be123c' : '#0d7658'} />
          </div>

          {/* Supply Chain Charts: Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '22px' }}>
            {/* Chart 1: Delivery Performance Trend */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Delivery Performance Trend</h3>
              </div>
              <div className="card-body">
                <DualAxisChart
                  data={data?.delivery_performance_trend || [
                    { month: 'Apr', on_time: 14, delayed: 2 },
                    { month: 'May', on_time: 18, delayed: 3 },
                    { month: 'Jun', on_time: 22, delayed: 1 },
                    { month: 'Jul', on_time: 19, delayed: 4 },
                    { month: 'Aug', on_time: 25, delayed: 2 },
                    { month: 'Sep', on_time: 28, delayed: 1 }
                  ]}
                  barKey="on_time"
                  lineKey="delayed"
                  barLabel="On-Time Shipments"
                  lineLabel="Delayed Shipments"
                  barColor="#10b981"
                  lineColor="#f43f5e"
                  valueSuffix=" orders"
                />
              </div>
            </div>

            {/* Chart 2: Shipment Pipeline Donut */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Shipment Pipeline</h3>
              </div>
              <div className="card-body">
                <DonutChart
                  centerValue={metrics.total_orders ? String(metrics.total_orders) : '0'}
                  centerLabel="Active Shipments"
                  data={data?.shipment_pipeline_donut || [
                    { name: 'Delivered', value: 18, pct: 50, color: '#10b981' },
                    { name: 'In Transit', value: 10, pct: 28, color: '#0284c7' },
                    { name: 'Ordered', value: 5, pct: 14, color: '#f59e0b' },
                    { name: 'Delayed', value: 3, pct: 8, color: '#f43f5e' }
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Supply Chain Charts: Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '22px' }}>
            {/* Chart 3: Logistics & Fulfillment Efficiency */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Logistics & SLA Efficiency</h3>
              </div>
              <div className="card-body">
                <RadarChart
                  data={data?.logistics_radar || [
                    { subject: 'On-Time Dispatch', top_vendor: 96, average: 82, fullMark: 100 },
                    { subject: 'Transit Speed', top_vendor: 92, average: 75, fullMark: 100 },
                    { subject: 'Packaging Integrity', top_vendor: 98, average: 88, fullMark: 100 },
                    { subject: 'Route Compliance', top_vendor: 94, average: 80, fullMark: 100 },
                    { subject: 'Customs Clearance', top_vendor: 90, average: 78, fullMark: 100 }
                  ]}
                />
              </div>
            </div>

            {/* Chart 4: Fulfillment by Vendor Category */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Fulfillment by Category</h3>
              </div>
              <div className="card-body">
                <GroupedBarChart
                  data={data?.category_logistics_bar || [
                    { vendor: 'Raw Materials', on_time: 88, delayed: 12, in_transit: 40 },
                    { vendor: 'Equipment', on_time: 75, delayed: 25, in_transit: 20 },
                    { vendor: 'IT Vendors', on_time: 95, delayed: 5, in_transit: 30 },
                    { vendor: 'Logistics', on_time: 80, delayed: 20, in_transit: 50 }
                  ]}
                  categories={['on_time', 'delayed', 'in_transit']}
                  colors={['#10b981', '#f43f5e', '#0284c7']}
                  maxVal={100}
                />
              </div>
            </div>

            {/* Chart 5: Delivery Health Half Gauge */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Fulfillment Health</h3>
              </div>
              <div className="card-body">
                <HalfGaugeChart
                  percentage={data?.delivery_status?.ontime_rate ?? 80}
                  items={data?.delivery_status?.items || [
                    { label: 'Delivered', pct: 60, count: 12, color: '#10b981' },
                    { label: 'In Transit', pct: 25, count: 5, color: '#0284c7' },
                    { label: 'Delayed', pct: 15, count: 3, color: '#f43f5e' }
                  ]}
                  title="On-Time Delivery Rate"
                />
              </div>
            </div>
          </div>

          {/* Operational Alerts */}
          <div className="card" style={{ marginBottom: '22px' }}>
            <div className="card-header">
              <h2 className="card-title">Supply Chain Operational Alerts</h2>
            </div>
            <div className="card-body">
              {metrics.delayed_orders > 0 ? (
                <div className="alert alert-danger">
                  <strong>{metrics.delayed_orders} purchase order(s)</strong> are currently delayed past their scheduled delivery window. Please check the procurement tracker.
                </div>
              ) : (
                <div className="alert alert-success">
                  All active purchase orders are on schedule according to supplier delivery commitments.
                </div>
              )}
              {metrics.expiring_contracts > 0 && (
                <div className="alert alert-warning">
                  <strong>{metrics.expiring_contracts} supplier contract(s)</strong> are expiring within the next 30 days. Review contract renewals.
                </div>
              )}
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                <Link to="/procurement" className="btn btn-primary btn-sm">Inspect Orders</Link>
                <Link to="/vendors" className="btn btn-secondary btn-sm">View Suppliers</Link>
              </div>
            </div>
          </div>

          {/* Recent Shipments / Orders Table */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Supply Shipments</h2>
              <Link to="/procurement" className="btn btn-secondary btn-sm">Manage All Shipments</Link>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Supplier</th>
                      <th>Amount</th>
                      <th>Expected Delivery</th>
                      <th>Status</th>
                      <th>Delivery Tracking Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recent_orders?.map((order) => (
                      <tr key={order.id}>
                        <td><strong>{order.po_number}</strong></td>
                        <td>{order.vendor}</td>
                        <td>₹{order.total_amount?.toLocaleString()}</td>
                        <td>{order.expected_delivery_date}</td>
                        <td><StatusBadge status={order.status} /></td>
                        <td>
                          {['pending', 'approved', 'ordered'].includes((order.status || '').toLowerCase()) && (
                            <button
                              type="button"
                              onClick={() => handleSupplyChainStatus(order.id, 'in_transit')}
                              style={{
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                                border: '1px solid #fde68a',
                                borderRadius: '5px',
                                padding: '4px 10px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Mark In Transit &rarr;
                            </button>
                          )}
                          {(order.status || '').toLowerCase() === 'in_transit' && (
                            <button
                              type="button"
                              onClick={() => handleSupplyChainStatus(order.id, 'delivered')}
                              style={{
                                backgroundColor: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid #a7f3d0',
                                borderRadius: '5px',
                                padding: '4px 10px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Mark Delivered &rarr;
                            </button>
                          )}
                          {(order.status || '').toLowerCase() === 'delivered' && (
                            <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600 }}>
                              Delivered &bull; Invoice Auto-Generated
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- VENDOR DASHBOARD --- */}
      {role === 'Vendor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {(data?.vendor_info?.status === 'pending' || data?.vendor_info?.status === 'pending_approval') && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{ fontWeight: 800, color: '#92400e', fontSize: '14.5px', marginBottom: '4px' }}>
                  Vendor Registration Pending Administrator Approval
                </div>
                <div style={{ color: '#b45309', fontSize: '13px' }}>
                  Your supplier account registration has been submitted and is currently pending review by the Administrator. Once approved, your supplier profile will be activated with an initial reliability score and quality rating of 0.0.
                </div>
              </div>
              <span className="badge badge-warning" style={{ fontSize: '12px', padding: '6px 12px' }}>
                Pending Approval
              </span>
            </div>
          )}

          {/* 1. Welcome & Session Security Card */}
          <div className="card" style={{ margin: 0, border: '1px solid var(--border-color)', background: '#ffffff', boxShadow: 'var(--shadow-xs)' }}>
            <div className="card-body" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #eef8f3 0%, #d8f0e5 100%)',
                  border: '1px solid var(--primary-border)',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  fontSize: '17px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-xs)'
                }}>
                  {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'VN'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Welcome, {user?.full_name}
                    </h2>
                    <span className="badge badge-approved" style={{ fontSize: '11px', padding: '2px 8px' }}>Vendor</span>
                    <span className="badge badge-ordered" style={{ fontSize: '11px', padding: '2px 8px' }}>Role Locked</span>
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '3px 0 6px 0' }}>
                    Restricted to your company only. Isolated purchase orders, dispatch tracking, reliability scores, and compliance repositories.
                  </p>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span>Account: <strong>@{user?.email?.split('@')[0] || 'vendor'}</strong></span>
                    <span>&bull;</span>
                    <span>Org: <strong>{data?.vendor_info?.company_name || 'Assigned Supplier'}</strong></span>
                    <span>&bull;</span>
                    <span>Scoped Supplier ID: <code>{data?.vendor_info?.code || 'VND-001'}</code></span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  Print / PDF
                </button>
                <div style={{ textAlign: 'right', display: 'none', sm: 'block' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.05em' }}>
                    Active Session
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Role switching locked
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}
                  style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>

          {/* 2. Supplier Identity & Governance Card */}
          {data?.vendor_info && (
            <div className="card" style={{ margin: 0, border: '1px solid var(--border-color)', background: '#ffffff', boxShadow: 'var(--shadow-xs)' }}>
              <div className="card-body" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '21px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      {data.vendor_info.company_name}
                    </h2>
                    <span className="badge badge-approved" style={{ fontSize: '11px', padding: '3px 10px' }}>
                      Authorized Supplier Portal
                    </span>
                    <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontSize: '12px', padding: '3px 8px' }}>
                      {data.vendor_info.code}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.6 }}>
                    <div>
                      Category: <strong>{data.vendor_info.category?.replace('_', ' ').toUpperCase()}</strong> &bull; Tax ID: <code>{data.vendor_info.gst_number}</code> &bull; Tier: <strong style={{ color: 'var(--primary)' }}>{data.vendor_info.tier}</strong>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      Primary Contact: ({data.vendor_info.email} &bull; {data.vendor_info.phone}) &bull; Facility: {data.vendor_info.address}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Link to="/contracts" className="btn btn-primary btn-sm" style={{ padding: '8px 16px', fontWeight: 700 }}>
                    Upload Compliance Doc
                  </Link>
                  <Link to="/messages" className="btn btn-secondary btn-sm" style={{ padding: '8px 16px', fontWeight: 700 }}>
                    Direct Email
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Key Performance Indicators */}
          <div className="stats-grid">
            <StatCard label="Performance Score" value={`${metrics.performance_score ?? 88}%`} helpText="↑ 6% vs last month" color="#10b981" />
            <StatCard label="Reliability Score" value={`${Math.round(metrics.reliability_score ?? 0)}%`} helpText="Based on historical orders" color="#0284c7" />
            <StatCard label="Active Contracts" value={metrics.active_contracts ?? 0} helpText="Active legal contracts" color="#f59e0b" />
            <StatCard label="Total Orders" value={metrics.total_orders ?? 0} helpText="Total POs processed" color="#8b5cf6" />
          </div>

          {/* Vendor Performance & Reliability Trend */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
            {/* Chart 1: Vendor Performance Grouped Bar */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Vendor Performance</h3>
              </div>
              <div className="card-body">
                <GroupedBarChart
                  data={data?.vendor_performance_comparison || [
                    { vendor: 'Vendor A', delivery: 92, quality: 88, communication: 80, compliance: 90 },
                    { vendor: 'Vendor B', delivery: 85, quality: 82, communication: 74, compliance: 86 },
                    { vendor: 'Vendor C', delivery: 78, quality: 75, communication: 70, compliance: 80 },
                    { vendor: 'Vendor D', delivery: 95, quality: 90, communication: 85, compliance: 94 },
                    { vendor: 'Vendor E', delivery: 81, quality: 84, communication: 78, compliance: 88 }
                  ]}
                  categories={['delivery', 'quality', 'communication', 'compliance']}
                  colors={['#10b981', '#0284c7', '#f59e0b', '#8b5cf6']}
                />
              </div>
            </div>

            {/* Chart 2: Reliability Score Trend Line */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Reliability Score Trend</h3>
              </div>
              <div className="card-body">
                <LineTrendChart
                  data={data?.reliability_trend || [
                    { month: 'Jan', score: 78 },
                    { month: 'Feb', score: 81 },
                    { month: 'Mar', score: 80 },
                    { month: 'Apr', score: 85 },
                    { month: 'May', score: 88 },
                    { month: 'Jun', score: 91 }
                  ]}
                  keyName="score"
                  color="#10b981"
                />
              </div>
            </div>
          </div>

          {/* Contract & Order Distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Chart 3: Contract Status Donut */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Contract Status</h3>
              </div>
              <div className="card-body">
                <DonutChart
                  centerValue="54"
                  centerLabel="Contracts"
                  data={data?.contract_status_donut || [
                    { name: 'Active', value: 27, pct: 50, color: '#10b981' },
                    { name: 'Expiring Soon', value: 4, pct: 8, color: '#f43f5e' },
                    { name: 'Under Renewal', value: 9, pct: 17, color: '#f59e0b' },
                    { name: 'Expired', value: 14, pct: 25, color: '#ea580c' }
                  ]}
                />
              </div>
            </div>

            {/* Chart 4: Order History Dual Axis */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Order History</h3>
              </div>
              <div className="card-body">
                <DualAxisChart
                  data={data?.order_history_chart || [
                    { month: 'Jan', value: 20, orders: 14 },
                    { month: 'Feb', value: 24, orders: 18 },
                    { month: 'Mar', value: 25, orders: 17 },
                    { month: 'Apr', value: 34, orders: 22 },
                    { month: 'May', value: 38, orders: 24 },
                    { month: 'Jun', value: 45, orders: 29 }
                  ]}
                  barKey="value"
                  lineKey="orders"
                  barLabel="Order Value (₹ Lakh)"
                  lineLabel="Number of Orders"
                  barColor="#10b981"
                  lineColor="#0284c7"
                />
              </div>
            </div>

            {/* Chart 5: Communication Activity Donut */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Communication Activity</h3>
              </div>
              <div className="card-body">
                <DonutChart
                  centerValue="239"
                  centerLabel="Activities"
                  data={data?.communication_activity_donut || [
                    { name: 'Emails', value: 86, pct: 36, color: '#0284c7' },
                    { name: 'Calls', value: 43, pct: 18, color: '#10b981' },
                    { name: 'Meetings', value: 29, pct: 12, color: '#f59e0b' },
                    { name: 'Portal Messages', value: 65, pct: 27, color: '#ea580c' },
                    { name: 'Support Tickets', value: 16, pct: 7, color: '#f43f5e' }
                  ]}
                />
              </div>
            </div>
          </div>

          {/* 6. The 8-Card Telemetry Grid (Vendor Scoped) */}
          <div className="vendor-telemetry-grid">
            {/* CARD 1: RELIABILITY SCORE */}
            <div className="vendor-metric-card">
              <div>
                <div className="vendor-metric-header">
                  <span className="vendor-metric-label">Reliability Score</span>
                  <div className="vendor-metric-icon" style={{ background: '#eef8f3', border: '1px solid #b2decb', color: '#145e47', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#145e47" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </div>
                </div>
                <div className="vendor-metric-value" style={{ color: 'var(--primary)' }}>
                  {metrics.reliability_score ?? 0}<span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>/100</span>
                </div>
                <div className="vendor-metric-subtext">
                  Risk Level: <strong>{metrics.risk_level || 'Low'}</strong>
                </div>
              </div>
              <div className="vendor-metric-footer">
                <span>Status</span>
                <span className="badge badge-approved" style={{ fontSize: '11px' }}>
                  {data?.vendor_info?.tier ? data.vendor_info.tier.split(':')[0] : 'Tier 1'} Preferred
                </span>
              </div>
            </div>

            {/* CARD 2: ON-TIME DELIVERY RATE */}
            <div className="vendor-metric-card">
              <div>
                <div className="vendor-metric-header">
                  <span className="vendor-metric-label">On-Time Delivery Rate</span>
                  <div className="vendor-metric-icon" style={{ background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                </div>
                <div className="vendor-metric-value" style={{ color: 'var(--success)' }}>
                  {metrics.on_time_delivery_rate || 100}%
                </div>
                <div className="vendor-metric-subtext">
                  {metrics.on_time_orders || metrics.delivered_orders || 1} on-time of {metrics.total_orders || ((metrics.active_orders || 0) + (metrics.delivered_orders || 1))} orders
                </div>
              </div>
              <div className="vendor-metric-footer">
                <span>Status</span>
                <span className={`badge ${(metrics.on_time_delivery_rate || 100) >= 80 ? 'badge-approved' : 'badge-pending'}`} style={{ fontSize: '11px' }}>
                  {(metrics.on_time_delivery_rate || 100) >= 80 ? 'On Track' : 'Action Required'}
                </span>
              </div>
            </div>

            {/* CARD 3: PRODUCT QUALITY RATING */}
            <div className="vendor-metric-card">
              <div>
                <div className="vendor-metric-header">
                  <span className="vendor-metric-label">Product Quality Rating</span>
                  <div className="vendor-metric-icon" style={{ background: '#fff8eb', border: '1px solid #fed7aa', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                </div>
                <div className="vendor-metric-value" style={{ color: 'var(--accent)' }}>
                  {metrics.average_quality_rating || 4.8} <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}>/ 5.0</span>
                </div>
                <div className="vendor-metric-subtext">
                  Defect rate: {Math.max(0, (5.0 - (metrics.average_quality_rating || 4.8)) * 2).toFixed(1)}% &bull; ISO Compliant
                </div>
              </div>
              <div className="vendor-metric-footer">
                <span>Status</span>
                <span className="badge badge-approved" style={{ fontSize: '11px' }}>
                  Audit Passing
                </span>
              </div>
            </div>

            {/* CARD 4: COMMUNICATION RESPONSE */}
            <div className="vendor-metric-card">
              <div>
                <div className="vendor-metric-header">
                  <span className="vendor-metric-label">Communication Response</span>
                  <div className="vendor-metric-icon" style={{ background: '#eef8f3', border: '1px solid #b2decb', color: '#145e47', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#145e47" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                </div>
                <div className="vendor-metric-value" style={{ color: 'var(--text-primary)' }}>
                  {metrics.average_response_hours || 1.8} <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-muted)' }}>hrs</span>
                </div>
                <div className="vendor-metric-subtext">
                  Issue resolution: {metrics.issue_resolution_days || 1.0} days
                </div>
              </div>
              <div className="vendor-metric-footer">
                <span>Status</span>
                <span className="badge badge-ordered" style={{ fontSize: '11px' }}>
                  Verified SLA
                </span>
              </div>
            </div>

            {/* CARD 5: ACTIVE PURCHASE ORDERS */}
            <div className="vendor-metric-card">
              <div>
                <div className="vendor-metric-header">
                  <span className="vendor-metric-label">Active Purchase Orders</span>
                  <div className="vendor-metric-icon" style={{ background: '#eef8f3', border: '1px solid #b2decb', color: '#145e47', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#145e47" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                  </div>
                </div>
                <div className="vendor-metric-value" style={{ color: 'var(--text-primary)' }}>
                  {metrics.active_orders || 0}
                </div>
                <div className="vendor-metric-subtext">
                  {(metrics.active_commitment || 0) > 0 ? `₹${Number(metrics.active_commitment).toLocaleString()} active commitment` : 'No active PO backlog'}
                </div>
              </div>
              <div className="vendor-metric-footer">
                <span>Status</span>
                <span className="badge badge-ordered" style={{ fontSize: '11px' }}>
                  {metrics.active_orders || 0} In Pipeline
                </span>
              </div>
            </div>

            {/* CARD 6: COMPLETED ORDERS */}
            <div className="vendor-metric-card">
              <div>
                <div className="vendor-metric-header">
                  <span className="vendor-metric-label">Completed Orders</span>
                  <div className="vendor-metric-icon" style={{ background: '#edfbf5', border: '1px solid #a7edd1', color: '#0d7658', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d7658" strokeWidth="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                  </div>
                </div>
                <div className="vendor-metric-value" style={{ color: 'var(--success)' }}>
                  {metrics.delivered_orders || 0}
                </div>
                <div className="vendor-metric-subtext">
                  {(metrics.lifetime_fulfilled || 0) > 0 ? `₹${Number(metrics.lifetime_fulfilled).toLocaleString()} lifetime fulfilled` : 'Dispatched shipments verified'}
                </div>
              </div>
              <div className="vendor-metric-footer">
                <span>Status</span>
                <span className="badge badge-approved" style={{ fontSize: '11px' }}>
                  Fulfilled
                </span>
              </div>
            </div>

            {/* CARD 7: DELAYED ORDERS */}
            <div className="vendor-metric-card">
              <div>
                <div className="vendor-metric-header">
                  <span className="vendor-metric-label">Delayed Orders</span>
                  <div className="vendor-metric-icon" style={{ background: (metrics.delayed_orders || 0) > 0 ? '#fff1f2' : '#edfbf5', border: `1px solid ${(metrics.delayed_orders || 0) > 0 ? '#fecdd3' : '#a7edd1'}`, color: (metrics.delayed_orders || 0) > 0 ? '#be123c' : '#0d7658' }}>
                    {(metrics.delayed_orders || 0) > 0 ? '!' : 'OK'}
                  </div>
                </div>
                <div className="vendor-metric-value" style={{ color: (metrics.delayed_orders || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {metrics.delayed_orders || 0}
                </div>
                <div className="vendor-metric-subtext">
                  {(metrics.delayed_orders || 0) > 0 ? `${metrics.delayed_orders} order(s) past delivery date` : 'Zero active delays on record'}
                </div>
              </div>
              <div className="vendor-metric-footer">
                <span>Status</span>
                <span className={`badge ${(metrics.delayed_orders || 0) > 0 ? 'badge-rejected' : 'badge-approved'}`} style={{ fontSize: '11px' }}>
                  {(metrics.delayed_orders || 0) > 0 ? 'Action Needed' : 'On Track'}
                </span>
              </div>
            </div>

            {/* CARD 8: DISBURSED & PENDING AP */}
            <div className="vendor-metric-card">
              <div>
                <div className="vendor-metric-header">
                  <span className="vendor-metric-label">Disbursed & Pending AP</span>
                  <div className="vendor-metric-icon" style={{ background: '#fff8eb', border: '1px solid #fed7aa', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  </div>
                </div>
                <div className="vendor-metric-value" style={{ color: 'var(--text-primary)' }}>
                  ₹{Number(metrics.disbursed_pending_amount || metrics.paid_invoices_amount || 0).toLocaleString()}
                </div>
                <div className="vendor-metric-subtext">
                  {metrics.paid_invoices_count || 0} Settled &bull; {metrics.pending_invoices_count || 0} Pending Payment
                </div>
              </div>
              <div className="vendor-metric-footer">
                <span>Status</span>
                <span className={`badge ${(metrics.pending_invoices_count || 0) > 0 ? 'badge-pending' : 'badge-approved'}`} style={{ fontSize: '11px' }}>
                  {(metrics.pending_invoices_count || 0) > 0 ? 'Pending Payout' : 'Settled'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Quick Action Hub Navigation */}
          <div className="card" style={{ margin: 0, border: '1px solid var(--border-color)', background: '#ffffff', boxShadow: 'var(--shadow-xs)' }}>
            <div className="card-header" style={{ background: '#fdfcf9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 className="card-title" style={{ fontSize: '15px', fontWeight: 800 }}>
                  Supplier Operational Workspace
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Direct access to purchase order fulfillments, commercial invoices, communications, and compliance records.
                </div>
              </div>
              <span className="badge badge-neutral">Vendor Scoped</span>
            </div>
            <div className="card-body" style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <Link to="/procurement" className="btn btn-primary" style={{ padding: '10px 20px', fontWeight: 700 }}>
                Fulfill Orders & Invoices
              </Link>
              <Link to="/messages" className="btn btn-secondary" style={{ padding: '10px 20px', fontWeight: 700 }}>
                Direct Communication Thread {metrics.unread_messages > 0 && `(${metrics.unread_messages} new)`}
              </Link>
              <Link to="/contracts" className="btn btn-secondary" style={{ padding: '10px 20px', fontWeight: 700 }}>
                Compliance & Contracts ({metrics.active_contracts || 0})
              </Link>
              <Link to="/analytics" className="btn btn-secondary" style={{ padding: '10px 20px', fontWeight: 700 }}>
                Predictive Reliability Scorecard
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* --- FINANCE OFFICER DASHBOARD --- */}
      {role === 'Finance Officer' && (
        <>
          {actionMsg && (
            <div className={`alert ${actionMsg.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '16px' }}>
              {actionMsg.text}
            </div>
          )}

          {treasury && (
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1.5px solid #0f766e',
              borderRadius: '8px',
              padding: '14px 20px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live Corporate Treasury Liquidity
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
                  <span style={{ fontSize: '15px', color: '#0f172a' }}>
                    Available Balance: <strong style={{ color: '#0f766e', fontSize: '17px' }}>₹{Number(treasury.available_balance || 0).toLocaleString()}</strong>
                  </span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ fontSize: '13.5px', color: '#64748b' }}>
                    Total Budget: <strong>₹{Number(treasury.total_budget || 0).toLocaleString()}</strong>
                  </span>
                </div>
              </div>
              <span className="badge badge-approved" style={{ fontSize: '12px', padding: '4px 10px' }}>
                Balance Verification Enforced
              </span>
            </div>
          )}

          {/* Pending Payment Requests awaiting Finance approval */}
          {pendingPaymentReqs.length > 0 && (
            <div className="card" style={{ marginBottom: '22px', border: '1.5px solid #f59e0b' }}>
              <div className="card-header" style={{ backgroundColor: '#fffbeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="card-title" style={{ color: '#92400e', fontSize: '15px', fontWeight: 800 }}>
                    Payment Authorizations Awaiting Approval ({pendingPaymentReqs.length})
                  </h2>
                  <div style={{ fontSize: '12px', color: '#b45309' }}>
                    Accepted supplier requisitions ready for balance check and PO contract issuance.
                  </div>
                </div>
                <span className="badge badge-warning">Awaiting Finance Action</span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Requisition</th>
                        <th>Category</th>
                        <th>Requested Amount</th>
                        <th>Available Balance</th>
                        <th>Balance Check</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingPaymentReqs.map(pr => {
                        const hasEnoughBalance = (treasury?.available_balance || 0) >= (pr.budget_amount || 0);
                        return (
                          <tr key={pr.id}>
                            <td>
                              <strong>{pr.title}</strong>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>REQ-{String(pr.id).padStart(4, '0')} &bull; {pr.department}</div>
                            </td>
                            <td>{pr.category?.replace('_', ' ')}</td>
                            <td><strong style={{ color: '#0f172a' }}>₹{Number(pr.budget_amount || 0).toLocaleString()}</strong></td>
                            <td>₹{Number(treasury?.available_balance || 0).toLocaleString()}</td>
                            <td>
                              {hasEnoughBalance ? (
                                <span className="badge badge-approved" style={{ fontSize: '11px' }}>Sufficient Liquidity</span>
                              ) : (
                                <span className="badge badge-rejected" style={{ fontSize: '11px' }}>Insufficient Balance</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleApprovePayment(pr.id)}
                                  disabled={!hasEnoughBalance}
                                  style={{
                                    backgroundColor: hasEnoughBalance ? '#047857' : '#9ca3af',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '5px',
                                    padding: '5px 10px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    cursor: hasEnoughBalance ? 'pointer' : 'not-allowed'
                                  }}
                                >
                                  Approve Payment
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectPayment(pr.id)}
                                  style={{
                                    backgroundColor: '#ffffff',
                                    color: '#b91c1c',
                                    border: '1px solid #fecaca',
                                    borderRadius: '5px',
                                    padding: '5px 8px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="stats-grid">
            <StatCard label="Total Invoiced" value={`₹${(metrics.total_invoiced || 0).toLocaleString()}`} helpText="Cumulative billed amount" color="#0284c7" />
            <StatCard label="Pending Payment" value={`₹${(metrics.pending_amount || 0).toLocaleString()}`} helpText={`${metrics.pending_count || 0} unpaid invoices`} color="#d97706" />
            <StatCard label="Disbursed / Paid" value={`₹${(metrics.paid_amount || 0).toLocaleString()}`} helpText={`${metrics.paid_count || 0} settled invoices`} color="#0d7658" />
            <StatCard label="Overdue Invoices" value={metrics.overdue_count ?? 0} helpText="Past invoice due date" color={(metrics.overdue_count || 0) > 0 ? '#be123c' : '#0d7658'} />
          </div>

          {/* Finance Charts: Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '22px' }}>
            {/* Chart 1: Cashflow & Spend Trajectory */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Cashflow & AP Settlement Trajectory</h3>
              </div>
              <div className="card-body">
                <DualAxisChart
                  data={data?.cashflow_trend || [
                    { month: 'Apr', invoiced: 3.8, paid: 3.2 },
                    { month: 'May', invoiced: 4.5, paid: 4.0 },
                    { month: 'Jun', invoiced: 5.2, paid: 4.8 },
                    { month: 'Jul', invoiced: 6.0, paid: 5.5 },
                    { month: 'Aug', invoiced: 7.4, paid: 6.8 },
                    { month: 'Sep', invoiced: 8.5, paid: 7.2 }
                  ]}
                  barKey="invoiced"
                  lineKey="paid"
                  barLabel="Invoiced (₹ Lakh)"
                  lineLabel="Settled / Paid (₹ Lakh)"
                  barColor="#0284c7"
                  lineColor="#10b981"
                  valuePrefix="₹"
                  valueSuffix="L"
                />
              </div>
            </div>

            {/* Chart 2: Invoice Status Breakdown */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Invoice Status & Payment Pipeline</h3>
              </div>
              <div className="card-body">
                <DonutChart
                  centerValue={metrics.total_invoiced ? `₹${Math.round(metrics.total_invoiced / 100000)}L` : '₹0'}
                  centerLabel="Total Invoiced"
                  data={data?.invoice_status_donut || [
                    { name: 'Paid', value: 12, pct: 60, color: '#10b981' },
                    { name: 'Pending', value: 6, pct: 30, color: '#f59e0b' },
                    { name: 'Overdue', value: 2, pct: 10, color: '#f43f5e' }
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Finance Charts: Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '22px' }}>
            {/* Chart 3: Spend by Vendor Category */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Spend by Vendor Category</h3>
              </div>
              <div className="card-body">
                <DonutChart
                  centerValue="Spend"
                  centerLabel="By Category"
                  data={data?.spend_by_category || [
                    { name: 'Raw Materials', value: 45, pct: 45, color: '#0284c7' },
                    { name: 'Equipment', value: 25, pct: 25, color: '#10b981' },
                    { name: 'IT Vendors', value: 15, pct: 15, color: '#8b5cf6' },
                    { name: 'Logistics', value: 15, pct: 15, color: '#f59e0b' }
                  ]}
                />
              </div>
            </div>

            {/* Chart 4: Top Vendors by Invoiced vs Paid Spend */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Top Vendor Spend Comparison (₹ Lakh)</h3>
              </div>
              <div className="card-body">
                <GroupedBarChart
                  data={data?.top_vendors_spend || [
                    { vendor: 'Apex Raw', invoiced: 4.5, paid: 3.8 },
                    { vendor: 'Precision Tools', invoiced: 3.2, paid: 2.8 },
                    { vendor: 'Swift Logistics', invoiced: 2.1, paid: 2.0 },
                    { vendor: 'Nova IT Corp', invoiced: 1.8, paid: 1.5 }
                  ]}
                  categories={['invoiced', 'paid']}
                  colors={['#0284c7', '#10b981']}
                  maxVal={10}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Commercial Tax Invoices</h2>
              <Link to="/procurement" className="btn btn-secondary btn-sm">Process Payments &rarr;</Link>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>PO Ref</th>
                      <th>Supplier</th>
                      <th>Amount</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Tax Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recent_invoices?.map((inv) => (
                      <tr key={inv.id}>
                        <td><strong>{inv.invoice_number}</strong></td>
                        <td>{inv.po_number || 'N/A'}</td>
                        <td>{inv.vendor_name || 'N/A'}</td>
                        <td><strong>₹{inv.amount?.toLocaleString()}</strong></td>
                        <td>{inv.due_date}</td>
                        <td><StatusBadge status={inv.status} /></td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setIsPdfOpen(true);
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', fontSize: '11.5px' }}
                            title="Download or Print GST Tax Invoice"
                          >
                            PDF Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- AUDITOR DASHBOARD --- */}
      {role === 'Auditor' && (
        <>
          <div className="stats-grid">
            <StatCard label="Audit Log Entries" value={metrics.total_audit_logs ?? 0} helpText="Immutable system actions logged" color="#0284c7" />
            <StatCard label="Active Contracts" value={metrics.total_contracts ?? 0} helpText={`${metrics.expiring_soon_contracts || 0} expiring soon`} color="#145e47" />
            <StatCard label="Certifications Tracked" value={metrics.total_certifications ?? 0} helpText={`${metrics.expired_certifications || 0} expired`} color="#8b5cf6" />
            <StatCard label="Audited PO Records" value={metrics.audited_orders ?? 0} helpText="Approved procurement commitments" color="#0d7658" />
          </div>

          {/* Auditor Charts: Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '22px' }}>
            {/* Chart 1: Audit Events Breakdown Donut */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Audit Events by Action Category</h3>
              </div>
              <div className="card-body">
                <DonutChart
                  centerValue={metrics.total_audit_logs ? String(metrics.total_audit_logs) : '0'}
                  centerLabel="System Logs"
                  data={data?.audit_events_donut || [
                    { name: 'Onboarding', value: 8, pct: 28, color: '#10b981' },
                    { name: 'Procurement', value: 10, pct: 35, color: '#0284c7' },
                    { name: 'Contracts', value: 6, pct: 21, color: '#8b5cf6' },
                    { name: 'Security & Auth', value: 4, pct: 16, color: '#f59e0b' }
                  ]}
                />
              </div>
            </div>

            {/* Chart 2: Compliance & Contract Health Donut */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Compliance & Contract Health</h3>
              </div>
              <div className="card-body">
                <DonutChart
                  centerValue={metrics.total_contracts ? String(metrics.total_contracts) : '0'}
                  centerLabel="Total Contracts"
                  data={data?.compliance_status_donut || [
                    { name: 'Compliant & Active', value: 18, pct: 65, color: '#10b981' },
                    { name: 'Expiring Soon (<30d)', value: 6, pct: 22, color: '#f59e0b' },
                    { name: 'Expired / Non-Compliant', value: 4, pct: 13, color: '#f43f5e' }
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Auditor Charts: Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '22px' }}>
            {/* Chart 3: System Vendor Risk Distribution */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>System Vendor Risk Distribution</h3>
              </div>
              <div className="card-body">
                <HorizontalBarChart
                  data={data?.system_risk_distribution || {
                    'Low Risk': 4,
                    'Medium Risk': 2,
                    'High Risk': 1,
                    'Critical Risk': 0
                  }}
                />
              </div>
            </div>

            {/* Chart 4: Audit Activity Trend */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>Audit Activity 6-Month Trail Trend</h3>
              </div>
              <div className="card-body">
                <LineTrendChart
                  data={data?.monthly_audit_trend || [
                    { month: 'Apr', events: 14 },
                    { month: 'May', events: 22 },
                    { month: 'Jun', events: 35 },
                    { month: 'Jul', events: 28 },
                    { month: 'Aug', events: 42 },
                    { month: 'Sep', events: 48 }
                  ]}
                  keyName="events"
                  color="#8b5cf6"
                  valueSuffix=" events"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">Recent Compliance & Transaction Audit Trails</h2>
              <Link to="/audit-logs" className="btn btn-secondary btn-sm">Inspect Full Immutable Log &rarr;</Link>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event Action</th>
                      <th>Target Entity</th>
                      <th>Audit Trail Details</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.recent_logs?.map((l) => (
                      <tr key={l.id}>
                        <td><span className="badge badge-neutral">{l.action}</span></td>
                        <td><strong>{l.entity}</strong></td>
                        <td style={{ fontSize: '12px' }}>{l.details}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(l.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Structured Tax Invoice PDF Preview & Download Modal */}
      <InvoicePDFModal
        isOpen={isPdfOpen}
        onClose={() => {
          setIsPdfOpen(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
      />
    </div>
  );
};
