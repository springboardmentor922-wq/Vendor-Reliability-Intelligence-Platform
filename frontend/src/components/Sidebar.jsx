import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  const isAdmin = user?.role === 'Administrator';
  const isAuditorOrAdmin = ['Administrator', 'Auditor'].includes(user?.role);
  const isVendor = user?.role === 'Vendor';

  const [notifications, setNotifications] = useState([]);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to load notifications in sidebar:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setIsNotifDrawerOpen(false);
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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      <aside className="sidebar" style={{
        width: '260px',
        backgroundColor: '#091024',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        
        <div style={{
          padding: '20px 20px 16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.4)'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em' }}>
                VendorIQ
              </span>
              <span style={{
                fontSize: '9.5px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8'
              }}>
                ENTERPRISE
              </span>
            </div>
            <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 500, letterSpacing: '-0.01em', marginTop: '2px' }}>
              Predictive Vendor Intelligence &amp; Risk Platform
            </div>
          </Link>
        </div>

        
        <nav style={{
          padding: '14px 12px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          overflowY: 'auto'
        }}>
          
          <div style={{
            padding: '10px 12px 6px 12px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#64748b'
          }}>
            SUPPLIER WORKSPACE
          </div>

          
          <NavLink
            to="/vendor-portal"
            className={({ isActive }) => `sidebar-nav-btn ${isActive ? 'active' : ''}`}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9.5px 12px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? '#ffffff' : '#94a3b8',
              backgroundColor: isActive ? '#2563eb' : 'transparent',
              boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
              textDecoration: 'none',
              transition: 'all 0.15s ease'
            })}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Supplier Portal</span>
            </div>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#60a5fa'
            }}>
              Vendor
            </span>
          </NavLink>

          
          {user && !isVendor && (
            <NavLink
              to="/vendors"
              className={({ isActive }) => `sidebar-nav-btn ${isActive ? 'active' : ''}`}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                padding: '9.5px 12px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#ffffff' : '#94a3b8',
                backgroundColor: isActive ? '#2563eb' : 'transparent',
                boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                textDecoration: 'none',
                transition: 'all 0.15s ease'
              })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Vendor Management</span>
              </div>
            </NavLink>
          )}

          
          {user && (
            <>
              
              <NavLink
                to="/procurement?tab=orders"
                className={({ isActive }) => `sidebar-nav-btn ${isActive || location.pathname.startsWith('/procurement') ? 'active' : ''}`}
                style={({ isActive }) => {
                  const active = isActive || location.pathname.startsWith('/procurement');
                  return {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '9.5px 12px',
                    borderRadius: '8px',
                    fontSize: '13.5px',
                    fontWeight: active ? 600 : 500,
                    color: active ? '#ffffff' : '#94a3b8',
                    backgroundColor: active ? '#2563eb' : 'transparent',
                    boxShadow: active ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease'
                  };
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                  <span>Orders &amp; Invoices</span>
                </div>
              </NavLink>

              
              <NavLink
                to="/contracts"
                className={({ isActive }) => `sidebar-nav-btn ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  padding: '9.5px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : '#94a3b8',
                  backgroundColor: isActive ? '#2563eb' : 'transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <span>Contracts &amp; Compliance</span>
                </div>
              </NavLink>

              
              <NavLink
                to="/messages"
                className={({ isActive }) => `sidebar-nav-btn ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  padding: '9.5px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : '#94a3b8',
                  backgroundColor: isActive ? '#2563eb' : 'transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>Communication Hub</span>
                </div>
              </NavLink>

              
              <button
                type="button"
                onClick={() => setIsNotifDrawerOpen(!isNotifDrawerOpen)}
                className={`sidebar-nav-btn ${isNotifDrawerOpen ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9.5px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: isNotifDrawerOpen ? 600 : 500,
                  color: isNotifDrawerOpen ? '#ffffff' : '#94a3b8',
                  backgroundColor: isNotifDrawerOpen ? '#2563eb' : 'transparent',
                  boxShadow: isNotifDrawerOpen ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span>Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    minWidth: '18px',
                    textAlign: 'center'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            </>
          )}

          
          {user && !isVendor && (
            <>
              <div style={{
                padding: '16px 12px 6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#64748b',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                marginTop: '10px'
              }}>
                ENTERPRISE OPERATIONS
              </div>

              <NavLink
                to="/dashboard"
                className={({ isActive }) => `sidebar-nav-btn ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  padding: '9.5px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : '#94a3b8',
                  backgroundColor: isActive ? '#2563eb' : 'transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span>Executive Dashboard</span>
                </div>
              </NavLink>

              <NavLink
                to="/analytics"
                className={({ isActive }) => `sidebar-nav-btn ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  padding: '9.5px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : '#94a3b8',
                  backgroundColor: isActive ? '#2563eb' : 'transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  <span>Predictive Analytics</span>
                </div>
              </NavLink>

              <NavLink
                to="/reports"
                className={({ isActive }) => `sidebar-nav-btn ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  padding: '9.5px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : '#94a3b8',
                  backgroundColor: isActive ? '#2563eb' : 'transparent',
                  boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Reports &amp; Exports</span>
                </div>
              </NavLink>

              {isAuditorOrAdmin && (
                <NavLink
                  to="/audit-logs"
                  className={({ isActive }) => `sidebar-nav-btn ${isActive ? 'active' : ''}`}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    padding: '9.5px 12px',
                    borderRadius: '8px',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#ffffff' : '#94a3b8',
                    backgroundColor: isActive ? '#2563eb' : 'transparent',
                    boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease'
                  })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>Audit Trails</span>
                  </div>
                </NavLink>
              )}

              {isAdmin && (
                <NavLink
                  to="/staff"
                  className={({ isActive }) => `sidebar-nav-btn ${isActive ? 'active' : ''}`}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    padding: '9.5px 12px',
                    borderRadius: '8px',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#ffffff' : '#94a3b8',
                    backgroundColor: isActive ? '#2563eb' : 'transparent',
                    boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease'
                  })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <polyline points="17 11 19 13 23 9" />
                    </svg>
                    <span>Staff Management</span>
                  </div>
                </NavLink>
              )}
            </>
          )}

          
          {!user && (
            <div style={{
              marginTop: '16px',
              padding: '14px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>
                Existing vendor or enterprise team member?
              </div>
              <Link
                to="/login"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)'
                }}
              >
                <span>Sign In to Platform</span>
                <span>&rarr;</span>
              </Link>
            </div>
          )}
        </nav>

        
        <div style={{
          padding: '14px 18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '11px',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>VendorIQ Platform</span>
          <span style={{
            fontSize: '9px',
            padding: '1px 5px',
            borderRadius: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            color: '#94a3b8'
          }}>
            v1.0.0
          </span>
        </div>
      </aside>

      
      {user && isNotifDrawerOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: '260px',
          width: '380px',
          height: '100vh',
          backgroundColor: '#0f172a',
          borderRight: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '10px 0 30px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease'
        }}>
          
          <div style={{
            padding: '18px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#1e293b'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '15px', color: '#f8fafc' }}>Notifications Center</strong>
                {unreadCount > 0 && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    padding: '1px 6px',
                    borderRadius: '10px'
                  }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                Procurement, dispatch &amp; payment alerts
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsNotifDrawerOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px'
              }}
            >
              ×
            </button>
          </div>

          
          <div style={{
            padding: '10px 16px',
            backgroundColor: '#1e293b',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            <button
              onClick={handleScanAlerts}
              disabled={scanning}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '11.5px',
                cursor: scanning ? 'not-allowed' : 'pointer'
              }}
            >
              {scanning ? 'Scanning...' : 'Scan Alerts'}
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  backgroundColor: 'rgba(37, 99, 235, 0.2)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '11.5px',
                  cursor: 'pointer'
                }}
              >
                Mark All Read
              </button>
            )}
          </div>

          
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No notifications recorded.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.is_read && handleMarkRead(notif.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    backgroundColor: notif.is_read ? 'rgba(255, 255, 255, 0.03)' : 'rgba(37, 99, 235, 0.12)',
                    border: notif.is_read ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(59, 130, 246, 0.3)',
                    cursor: notif.is_read ? 'default' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: notif.is_read ? '#64748b' : '#38bdf8',
                      letterSpacing: '0.04em'
                    }}>
                      {notif.type ? notif.type.replace('_', ' ') : 'ALERT'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      {notif.created_at ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: notif.is_read ? '#cbd5e1' : '#ffffff', lineHeight: 1.4 }}>
                    {notif.message}
                  </div>
                  {!notif.is_read && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <span style={{ fontSize: '10.5px', color: '#60a5fa', fontWeight: 600 }}>
                        Click to mark read
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};
