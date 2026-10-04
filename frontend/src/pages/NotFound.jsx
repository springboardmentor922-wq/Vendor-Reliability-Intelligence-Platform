import React from 'react';
import { Link } from 'react-router-dom';

export const NotFound = () => {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <h1 style={{ fontSize: '48px', fontWeight: 800, color: 'var(--primary)' }}>404</h1>
      <h2 style={{ fontSize: '20px', marginTop: '8px', marginBottom: '16px' }}>Page Not Found</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        The requested resource does not exist in the VendorIQ system.
      </p>
      <Link to="/" className="btn btn-primary">
        Return to Dashboard
      </Link>
    </div>
  );
};
