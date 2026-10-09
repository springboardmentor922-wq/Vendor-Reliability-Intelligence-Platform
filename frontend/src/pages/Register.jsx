import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  'Vendor',
  'Procurement Manager',
  'Supply Chain Manager',
  'Finance Officer',
  'Auditor',
  'Administrator'
];

const CATEGORIES = [
  { label: 'Raw Materials', value: 'raw_material' },
  { label: 'Equipment & Hardware', value: 'equipment' },
  { label: 'IT Services & Software', value: 'it' },
  { label: 'Service Provider', value: 'service_provider' },
  { label: 'Logistics & Transportation', value: 'logistics' },
  { label: 'Facility & Maintenance', value: 'maintenance' }
];

export const Register = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Vendor');
  const [phone, setPhone] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [category, setCategory] = useState('raw_material');
  const [contactPerson, setContactPerson] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        full_name: fullName,
        email,
        password,
        role,
        phone: phone || null
      };

      if (role === 'Vendor') {
        payload.company_name = companyName || `${fullName}'s Enterprise`;
        payload.category = category;
        payload.contact_person = contactPerson || fullName;
        payload.gst_number = gstNumber || null;
        payload.address = address || null;
        payload.notes = notes || null;
      }

      await register(payload);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: role === 'Vendor' ? '640px' : '480px', transition: 'max-width 0.2s ease' }}>
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#145e47" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join the VendorIQ Enterprise Procurement Platform</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Aaryan Singh"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                className="form-control"
                placeholder="aaryan@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Platform Role *</label>
              <select
                className="form-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="+1 555 0199"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          
          {role === 'Vendor' && (
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '18px',
              marginBottom: '18px',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>Vendor / Supplier Company Profile</strong>
                <span className="badge badge-warning" style={{ marginLeft: 'auto', fontSize: '11px' }}>
                  Pending Admin Approval
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.4' }}>
                New vendor registrations are submitted in <strong>Pending</strong> status and require Administrator approval before onboarding. Upon approval, your account starts with an initial reliability score and quality rating of <strong>0.0</strong>.
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1.2 }}>
                  <label className="form-label">Company Legal Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Aaryan Tech & Materials Ltd"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required={role === 'Vendor'}
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Category *</label>
                  <select
                    className="form-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">GST / Tax Identification</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="24AAACA1234A1Z5"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Primary Contact Person</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={fullName || 'John Doe'}
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label className="form-label">Physical Factory / Office Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Plot 42, Industrial Zone, Phase II..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Company Overview / Specialization</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Supplier specialization, production capabilities, quality certifications..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password *</label>
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
            style={{ width: '100%', padding: '11px', marginTop: '8px', fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? 'Submitting registration...' : role === 'Vendor' ? 'Submit Supplier Registration & Enter →' : 'Create Account & Enter →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px' }}>
          Already registered? <Link to="/login">Sign in here</Link>
        </div>
      </div>
    </div>
  );
};
