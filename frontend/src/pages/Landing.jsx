import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DEMO_PERSONAS } from '../data/demoPersonas';

export const Landing = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [authLoading, setAuthLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState('');

  // Direct persona login for demo navigation
  const handleLaunchPersona = async (persona) => {
    setAuthError('');
    setAuthLoading(true);
    try {
      await login(persona.email, persona.pass);
      navigate('/dashboard');
    } catch (err) {
      setAuthError('Login failed: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="landing-page">
      {/* Top Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="brand-logo" style={{ fontSize: '20px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span>VendorIQ</span>
          </div>

          <div className="landing-nav-links">
            <a href="#features" className="nav-link-item">Capabilities</a>
            <a href="#roles" className="nav-link-item">Role Matrix</a>
            <a href="#architecture" className="nav-link-item">Architecture</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: 'rgba(52, 211, 153, 0.12)',
                color: '#34d399',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center'
              }}
              onClick={() => navigate('/vendor-portal')}
            >
              <span>Vendor Portal</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ background: 'transparent', color: '#ffffff', borderColor: 'rgba(255,255,255,0.2)' }}
              onClick={() => navigate('/login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ padding: '8px 18px', fontWeight: 700 }}
              onClick={() => navigate('/signup')}
            >
              Sign Up
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="landing-hero-container">
        {/* Background visual accents */}
        <div className="hero-dynamic-backdrop" aria-hidden="true">
          <div className="hero-grid-mesh" />
          <div className="glow-orb orb-primary" />
          <div className="glow-orb orb-secondary" />
          <div className="glow-orb orb-accent" />
          <div className="glow-orb orb-subtle" />

          {/* Network graphic */}
          <svg className="hero-svg-constellation" viewBox="0 0 1200 650" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M80 320 Q320 160 600 250 T1120 280" stroke="rgba(52, 211, 153, 0.22)" strokeWidth="1.5" strokeDasharray="6 6" className="constellation-path-1" />
            <path d="M120 460 Q380 300 600 250 T1080 380" stroke="rgba(245, 158, 11, 0.18)" strokeWidth="1.5" strokeDasharray="5 5" className="constellation-path-2" />
            <path d="M250 140 L600 250 L950 140" stroke="rgba(16, 185, 129, 0.15)" strokeWidth="1.2" strokeDasharray="4 4" className="constellation-path-3" />

            <circle cx="80" cy="320" r="4.5" fill="#34d399" opacity="0.65" className="floating-node node-1" />
            <circle cx="320" cy="190" r="5" fill="#10b981" opacity="0.75" className="floating-node node-2" />
            <circle cx="250" cy="140" r="4" fill="#6ee7b7" opacity="0.6" className="floating-node node-3" />
            <circle cx="600" cy="250" r="7" fill="#34d399" opacity="0.9" className="floating-node node-hub" />
            <circle cx="880" cy="180" r="5" fill="#f59e0b" opacity="0.75" className="floating-node node-4" />
            <circle cx="950" cy="140" r="4" fill="#fbbf24" opacity="0.6" className="floating-node node-5" />
            <circle cx="1120" cy="280" r="4.5" fill="#34d399" opacity="0.65" className="floating-node node-6" />
            
            <circle cx="120" cy="460" r="4" fill="#10b981" opacity="0.55" className="floating-node node-7" />
            <circle cx="380" cy="330" r="5" fill="#f59e0b" opacity="0.7" className="floating-node node-8" />
            <circle cx="820" cy="320" r="5" fill="#34d399" opacity="0.7" className="floating-node node-9" />
            <circle cx="1080" cy="380" r="4" fill="#10b981" opacity="0.55" className="floating-node node-10" />

            <circle cx="600" cy="250" r="22" stroke="rgba(52, 211, 153, 0.35)" strokeWidth="1.2" className="node-pulse-ring" />
            <circle cx="600" cy="250" r="45" stroke="rgba(52, 211, 153, 0.16)" strokeWidth="1" strokeDasharray="4 4" className="node-pulse-ring-outer" />
          </svg>
        </div>

        <div className="hero-left-content" style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 3 }}>
          <h1 className="hero-title">
            Vendor Reliability & <br />
            <span className="text-gradient">Procurement Risk Platform</span>
          </h1>

          <p className="hero-subtitle" style={{ margin: '0 0 28px 0' }}>
            Streamlined multi-role platform for supplier qualification, purchase order workflows with dynamic line-items, commercial invoices, 30-day contract expiry tracking, and real-time vendor communications.
          </p>

          {authError && (
            <div className="alert alert-danger" style={{ marginBottom: '16px', padding: '8px 12px', fontSize: '12px' }}>
              {authError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              style={{
                padding: '11px 26px',
                fontWeight: 600,
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                transition: 'all 0.2s ease'
              }}
              onClick={() => navigate('/login')}
            >
              Access Dashboard &rarr;
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              style={{
                padding: '11px 26px',
                fontWeight: 600,
                borderColor: 'rgba(52, 211, 153, 0.45)',
                color: '#34d399',
                background: 'rgba(52, 211, 153, 0.08)',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease'
              }}
              onClick={() => navigate('/vendor-portal')}
            >
              Vendor Portal
            </button>
          </div>
        </div>

        {/* Live Metrics Showcase Banner */}
        <div className="hero-stats-banner" style={{ marginTop: '50px' }}>
          <div className="hero-stat-box">
            <div className="stat-number">13</div>
            <div className="stat-caption">Relational Tables in Schema</div>
          </div>
          <div className="hero-stat-box">
            <div className="stat-number">6</div>
            <div className="stat-caption">Tailored Role Dashboards</div>
          </div>
          <div className="hero-stat-box">
            <div className="stat-number">100%</div>
            <div className="stat-caption">Demonstrable M2 Flow</div>
          </div>
          <div className="hero-stat-box">
            <div className="stat-number">&lt; 30d</div>
            <div className="stat-caption">Automated Expiry Alerts</div>
          </div>
        </div>
      </header>

      {/* Interactive 6-Role Selector Section */}
      <section id="roles" className="landing-section">
        <div className="section-header">
          <div className="section-tag">Role-Based Access Control</div>
          <h2 className="section-title">Six Specialized Role Experiences</h2>
          <p className="section-subtitle">
            Every persona receives dedicated authorization filters, telemetry metrics, and data privacy isolation. Click any persona below to log in directly:
          </p>
        </div>

        <div className="roles-grid">
          {DEMO_PERSONAS.map((p) => (
            <div key={p.role} className="role-card" style={{ borderTop: `4px solid ${p.color}`, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span className="badge badge-neutral" style={{ color: p.color, fontWeight: 700, borderColor: p.color }}>
                    {p.tag}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{p.email}</span>
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                  {p.role}
                </h3>
                <div style={{ fontSize: '12.5px', color: '#6ee7b7', marginBottom: '10px', fontWeight: 600 }}>
                  {p.name}
                </div>
                <p style={{ fontSize: '13px', color: '#d1ded8', lineHeight: '1.5', marginBottom: '18px', flex: 1 }}>
                  {p.desc}
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#ffffff' }}
                  onClick={() => handleLaunchPersona(p)}
                  disabled={authLoading}
                >
                  Log In as {p.role} &rarr;
                </button>
              </div>
          ))}
        </div>
      </section>

      {/* Core Capabilities */}
      <section id="features" className="landing-section" style={{ background: 'rgba(6, 18, 14, 0.5)' }}>
        <div className="section-header">
          <div className="section-tag">Platform Modules</div>
          <h2 className="section-title">Engineered for Operational Rigor</h2>
          <p className="section-subtitle">
            Complete end-to-end integration across all procurement lifecycle milestones.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-item">
            <div className="feature-icon-box" style={{ background: 'rgba(52, 211, 153, 0.12)', borderColor: 'rgba(52, 211, 153, 0.3)', color: '#34d399' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M5 21V7l8-4v18M13 10h4M13 14h4M13 18h4M9 10H7M9 14H7M9 18H7" />
              </svg>
            </div>
            <h3 className="feature-heading">Vendor Lifecycle Management</h3>
            <p className="feature-body">
              Multi-category supplier catalog, GST/Tax identification validation, and approval workflow (Pending &rarr; Approved &rarr; Suspended &rarr; Rejected).
            </p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-box" style={{ background: 'rgba(251, 191, 36, 0.12)', borderColor: 'rgba(251, 191, 36, 0.3)', color: '#fbbf24' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h3 className="feature-heading">Requisitions & Purchase Orders</h3>
            <p className="feature-body">
              Multi-line item purchase orders with live auto-calculated order totals and state progression: Pending &rarr; Approved &rarr; Ordered &rarr; Delivered &rarr; Completed.
            </p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-box" style={{ background: 'rgba(45, 212, 191, 0.12)', borderColor: 'rgba(45, 212, 191, 0.3)', color: '#2dd4bf' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
                <line x1="6" y1="15" x2="10" y2="15" />
                <line x1="14" y1="15" x2="18" y2="15" />
              </svg>
            </div>
            <h3 className="feature-heading">Commercial Invoices</h3>
            <p className="feature-body">
              Automated invoice generation matching against purchase orders, due date monitoring, settlement tracking, and finance approval controls.
            </p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-box" style={{ background: 'rgba(251, 146, 60, 0.12)', borderColor: 'rgba(251, 146, 60, 0.3)', color: '#fb923c' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v4M16 2v4M3 10h18" />
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <circle cx="12" cy="15" r="2" />
              </svg>
            </div>
            <h3 className="feature-heading">Contracts & 30-Day Expiry Alerts</h3>
            <p className="feature-body">
              Central contract repository with automated real-time flagging of agreements expiring within 30 days and ISO/quality certification management.
            </p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-box" style={{ background: 'rgba(110, 231, 183, 0.12)', borderColor: 'rgba(110, 231, 183, 0.3)', color: '#6ee7b7' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <circle cx="8" cy="10" r="1" fill="currentColor" />
                <circle cx="12" cy="10" r="1" fill="currentColor" />
                <circle cx="16" cy="10" r="1" fill="currentColor" />
              </svg>
            </div>
            <h3 className="feature-heading">Supplier Communication Hub</h3>
            <p className="feature-body">
              Dedicated, chronological vendor message threads with audit timestamps, real-time unread badges, and attachment placeholders.
            </p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-box" style={{ background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <h3 className="feature-heading">Immutable Audit Governance</h3>
            <p className="feature-body">
              Granular logging of all system actions, status transitions, contract creations, and authentication events for independent auditor inspection.
            </p>
          </div>
        </div>
      </section>

      {/* Architecture & Tech Stack */}
      <section id="architecture" className="landing-section">
        <div className="section-header">
          <div className="section-tag">Enterprise Architecture</div>
          <h2 className="section-title">Modern, Clean & High-Performance Stack</h2>
        </div>

        <div className="tech-stack-row">
          <div className="tech-pill">
            <strong>Frontend:</strong> React 18 + Vite + Plain Bespoke CSS
          </div>
          <div className="tech-pill">
            <strong>Backend:</strong> FastAPI + Python 3.12 + Pydantic v2
          </div>
          <div className="tech-pill">
            <strong>ORM & DB:</strong> SQLAlchemy + PostgreSQL / SQLite
          </div>
          <div className="tech-pill">
            <strong>Auth:</strong> JWT Bearer + BCrypt Hashing
          </div>
          <div className="tech-pill">
            <strong>DevOps:</strong> Docker + Docker Compose
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary btn-lg"
          >
            Access System Dashboard Now &rarr;
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ color: '#9db2a8', fontSize: '13px' }}>
            &copy; 2026 <strong>VendorIQ Platform</strong> &bull; Predictive Vendor Reliability & Procurement Risk Intelligence
          </div>
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Sign In</button>
            <button onClick={() => navigate('/signup')} style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Sign Up</button>
            <a href="#roles" style={{ color: '#6ee7b7', fontWeight: 600 }}>Demo Personas</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
