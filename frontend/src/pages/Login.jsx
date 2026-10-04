import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const QUICK_ROLES = [
  { role: 'Administrator', name: 'Arthur Vance (Admin)', email: 'admin@vendoriq.com', pass: 'Admin@123' },
  { role: 'Procurement Manager', name: 'Priya Sharma (Procure)', email: 'procurement@vendoriq.com', pass: 'Procure@123' },
  { role: 'Supply Chain Manager', name: 'Marcus Kane (Supply)', email: 'supplychain@vendoriq.com', pass: 'Supply@123' },
  { role: 'Finance Officer', name: 'Clara Higgins (Finance)', email: 'finance@vendoriq.com', pass: 'Finance@123' },
  { role: 'Auditor', name: 'Benjamin Cole (Auditor)', email: 'auditor@vendoriq.com', pass: 'Audit@123' },
];

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (acc) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    setError('');
    setLoading(true);
    try {
      await login(acc.email, acc.pass);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#145e47" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="auth-title">VendorIQ Platform</h1>
          <p className="auth-subtitle">Reliability Intelligence & Procurement Risk Management</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="user@vendoriq.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px', marginTop: '8px', fontWeight: 700 }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px' }}>
          New supplier or staff? <Link to="/register" style={{ fontWeight: 600, color: 'var(--primary)' }}>Create an account</Link>
        </div>

        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '12px', letterSpacing: '0.05em' }}>
            ONE-CLICK DEMO ROLE LOGIN
          </div>
          <div className="quick-roles-grid">
            {QUICK_ROLES.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="quick-role-btn"
                onClick={() => handleQuickLogin(acc)}
                disabled={loading}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{acc.role}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{acc.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
