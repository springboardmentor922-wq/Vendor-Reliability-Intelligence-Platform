import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Authenticating session...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return (
      <div className="alert alert-danger" style={{ marginTop: '20px' }}>
        <div>
          <strong>Access Restricted (403 Forbidden):</strong> Your current role (
          <strong>{user.role}</strong>) does not have authorization to view this module.
        </div>
      </div>
    );
  }

  return <Outlet />;
};
