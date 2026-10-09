import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const DEMO_ACCOUNTS = [
  { name: 'Admin (Arthur Vance)', email: 'admin@vendoriq.com', role: 'Administrator', pass: 'Admin@123' },
  { name: 'Procurement (Priya Sharma)', email: 'procurement@vendoriq.com', role: 'Procurement Manager', pass: 'Procure@123' },
  { name: 'Supply Chain (Marcus Kane)', email: 'supplychain@vendoriq.com', role: 'Supply Chain Manager', pass: 'Supply@123' },
  { name: 'Vendor (Apex Raw Materials)', email: 'vendor@apexmaterials.com', role: 'Vendor', pass: 'Vendor@123' },
  { name: 'Finance (Clara Higgins)', email: 'finance@vendoriq.com', role: 'Finance Officer', pass: 'Finance@123' },
  { name: 'Auditor (Benjamin Cole)', email: 'auditor@vendoriq.com', role: 'Auditor', pass: 'Audit@123' },
];

export const Navbar = () => {
  const { user, login, logout } = useAuth();
  const location = useLocation();
  const isVendorPortal = location.pathname === '/vendor-portal';
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleScanAlerts = async () => {
    setScanning(true);
    try {
      await api.scanAndTriggerNotifications();
      await loadNotifications();
    } catch (err) {
      alert('Error triggering scan: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      await loadNotifications();
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      await loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleSwitch = async (e) => {
    const targetEmail = e.target.value;
    if (!targetEmail) return;
    const target = DEMO_ACCOUNTS.find(a => a.email === targetEmail);
    if (target) {
      try {
        await login(target.email, target.pass);
        window.location.reload();
      } catch (err) {
        alert('Switch failed: ' + err.message);
      }
    }
  };

  const handleResetData = async () => {
    if (window.confirm('Reset database to clean default seed state?')) {
      try {
        await api.resetDatabase();
        window.location.reload();
      } catch (err) {
        alert('Reset failed: ' + err.message);
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) {
    return (
      <header className="top-navbar" style={{ justifyContent: 'space-between', padding: '12px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Vendor & Supplier Public Directory
          </span>
          <span
            className="badge"
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              backgroundColor: '#edfbf5',
              color: '#0d7658',
              border: '1px solid #a7edd1',
              fontWeight: 600
            }}
          >
            Open Public Access
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Public Supplier Onboarding & Verified Directory
          </span>
          <Link
            to="/"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '6px' }}
          >
            ← Back to Home
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="top-navbar">
      {user?.role === 'Vendor' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#064e3b',
            border: '1px solid #059669',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            color: '#a7f3d0',
            fontWeight: 600
          }}>
            <span style={{ color: '#34d399', fontSize: '9px' }}>●</span>
            <span>Supplier: {user?.full_name || 'Apex Industrial Materials Corp.'} ({user?.vendor_id ? `VID-${String(user.vendor_id).padStart(3, '0')}` : 'VID-001'})</span>
          </div>

          <Link
            to="/vendor-portal"
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
            <span>Overview Portal</span>
          </Link>

          <button
            onClick={() => alert('Dataset Import: Ready to sync supplier catalog with ERP/inventory systems.')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Upload Dataset</span>
          </button>

          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            border: '1px solid #bfdbfe',
            padding: '2px 8px',
            borderRadius: '4px'
          }}>
            ROLE VIEW: Vendor
          </span>
        </div>
      ) : !isVendorPortal ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Quick Role Switcher:
          </span>
          <select
            className="form-select"
            style={{ width: '230px', padding: '5px 10px', fontSize: '12px' }}
            value={user?.email || ''}
            onChange={handleRoleSwitch}
          >
            {DEMO_ACCOUNTS.map((acc) => (
              <option key={acc.email} value={acc.email}>
                {acc.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleResetData}
            className="btn btn-secondary btn-sm"
            title="Reset database to initial seed"
            style={{ fontSize: '11.5px', padding: '4px 10px' }}
          >
            Reset Demo Data
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Vendor &amp; Supplier Public Directory
          </span>
          <span
            className="badge"
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              backgroundColor: '#edfbf5',
              color: '#0d7658',
              border: '1px solid #a7edd1',
              fontWeight: 600
            }}
          >
            Open Public Access
          </span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ position: 'relative', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            title="System Alert Notifications"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          
          {isNotifOpen && (
            <div
              style={{
                position: 'absolute',
                top: '42px',
                right: 0,
                width: '370px',
                background: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 15px 35px -5px rgba(23, 36, 31, 0.2), 0 5px 15px rgba(0, 0, 0, 0.08)',
                border: '1px solid var(--border-color)',
                zIndex: 1000,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  background: '#fbfaf7',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>System Alert Notifications</strong>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{unreadCount} unread alert(s)</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    onClick={handleScanAlerts}
                    disabled={scanning}
                    title="Scan DB for new delay & expiry events"
                  >
                    {scanning ? 'Scanning...' : 'Scan DB'}
                  </button>
                  {unreadCount > 0 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                      onClick={handleMarkAllRead}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>

              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No notifications or active risk alerts.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && handleMarkRead(n.id)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: n.is_read ? '#ffffff' : '#f4fbf8',
                        cursor: n.is_read ? 'default' : 'pointer',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start'
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>
                        {n.type === 'delivery_delay' ? 'Notice' : n.type === 'contract_expiry' ? 'Exp' : 'PO'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: '1.45', fontWeight: n.is_read ? '500' : '600' }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {n.type?.replace('_', ' ').toUpperCase()}
                        </div>
                      </div>
                      {!n.is_read && (
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--primary)', marginTop: '6px' }}></span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        
        <div className="user-profile-widget">
          <div className="user-avatar" style={{ backgroundColor: user ? 'var(--primary)' : '#6b7280' }}>
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'G'}
          </div>
          <div className="user-meta">
            <span className="user-name">{user?.full_name || 'Public Guest'}</span>
            <span className="user-role-tag">
              <strong>{user?.role || 'Guest Mode'}</strong>
            </span>
          </div>
          {user ? (
            <button
              onClick={logout}
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: '10px', fontSize: '12px' }}
            >
              Sign Out
            </button>
          ) : (
            <Link
              to="/login"
              className="btn btn-primary btn-sm"
              style={{ marginLeft: '10px', fontSize: '12px', padding: '5px 12px' }}
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
