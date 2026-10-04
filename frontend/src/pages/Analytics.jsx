import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

export const Analytics = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRisk, setSelectedRisk] = useState('');
  const [timeWindow, setTimeWindow] = useState('90d');

  // Vendor Deep Dive Modal
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [vendorMetrics, setVendorMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Predictive Simulator State
  const [simVendorId, setSimVendorId] = useState('');
  const [simCategory, setSimCategory] = useState('raw_material');
  const [simItemCount, setSimItemCount] = useState(3);
  const [simAmount, setSimAmount] = useState(25000);
  const [simDays, setSimDays] = useState(5);
  const [simShipping, setSimShipping] = useState('Standard Class');
  const [predictionResult, setPredictionResult] = useState(null);
  const [predicting, setPredicting] = useState(false);

  const isVendor = user?.role === 'Vendor';
  const normalize = (val) => (val || '').toLowerCase().replace(/[\s_-]+/g, '');
  const hasActiveFilters = Boolean(selectedCategory || selectedRisk || timeWindow !== '90d');

  const loadAnalyticsData = async (cat = selectedCategory, risk = selectedRisk, window = timeWindow) => {
    setLoading(true);
    setError('');
    try {
      const [overviewData, vendorsData] = await Promise.all([
        api.getAnalyticsOverview({ category: cat, risk_level: risk, time_window: window }),
        api.getVendors()
      ]);
      setOverview(overviewData);
      setVendors(vendorsData);
      if (vendorsData.length > 0 && !simVendorId) {
        setSimVendorId(vendorsData[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load intelligence data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyticsData(selectedCategory, selectedRisk, timeWindow);
  }, [selectedCategory, selectedRisk, timeWindow]);

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSelectedRisk('');
    setTimeWindow('90d');
  };

  const handleInspectVendor = async (vendorId) => {
    setSelectedVendorId(vendorId);
    setMetricsLoading(true);
    try {
      const data = await api.getVendorPerformance(vendorId);
      setVendorMetrics(data);
    } catch (err) {
      alert('Error fetching vendor metrics: ' + err.message);
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleRunPrediction = async (e) => {
    e.preventDefault();
    if (!simVendorId) return;
    setPredicting(true);
    try {
      const res = await api.predictPORisk({
        vendor_id: Number(simVendorId),
        category: simCategory,
        item_count: Number(simItemCount),
        total_amount: Number(simAmount),
        scheduled_days: Number(simDays),
        shipping_mode: simShipping
      });
      setPredictionResult(res);
    } catch (err) {
      alert('Error running risk prediction: ' + err.message);
    } finally {
      setPredicting(false);
    }
  };

  // Filtered Suppliers for Leaderboard with robust string normalization
  const filteredSuppliers = (overview?.top_ranked_suppliers || []).filter((s) => {
    if (selectedCategory) {
      const cNorm = normalize(selectedCategory);
      const sCatNorm = normalize(s.category);
      const sRawNorm = normalize(s.raw_category);
      if (!sCatNorm.includes(cNorm) && !cNorm.includes(sCatNorm) && !sRawNorm.includes(cNorm)) {
        return false;
      }
    }
    if (selectedRisk) {
      const rNorm = normalize(selectedRisk);
      const sRiskNorm = normalize(s.risk_level);
      if (!sRiskNorm.includes(rNorm) && !rNorm.includes(sRiskNorm)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Predictive Vendor Intelligence & Analytics</h1>
          <p className="page-subtitle">
            Multi-factor reliability scoring, delivery delay forecasting, supplier ranking, and AI procurement recommendations.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => loadAnalyticsData(selectedCategory, selectedRisk, timeWindow)}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Intelligence'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Top Telemetry KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <div className="stat-label">Global Reliability Index</div>
            {hasActiveFilters && <span className="badge badge-ordered" style={{ fontSize: '9.5px', padding: '2px 6px' }}>Filtered</span>}
          </div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {overview?.average_reliability_score || 0}<span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>/100</span>
          </div>
          <div className="stat-subtext" style={{ color: 'var(--success)' }}>
            ● {hasActiveFilters ? 'Scoped to active filter criteria' : 'Weighted multi-factor algorithm'}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <div className="stat-label">On-Time Fulfillment Rate</div>
            {hasActiveFilters && <span className="badge badge-ordered" style={{ fontSize: '9.5px', padding: '2px 6px' }}>Filtered</span>}
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {overview?.platform_on_time_rate || 0}%
          </div>
          <div className="stat-subtext">
            Target SLA: &ge; 90.0%
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <div className="stat-label">High-Risk Suppliers</div>
            {hasActiveFilters && <span className="badge badge-ordered" style={{ fontSize: '9.5px', padding: '2px 6px' }}>Filtered</span>}
          </div>
          <div className="stat-value" style={{ color: (overview?.high_risk_vendors_count || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {overview?.high_risk_vendors_count || 0}
          </div>
          <div className="stat-subtext">
            Out of {overview?.total_vendors || 0} {hasActiveFilters ? 'matching' : 'active'} suppliers
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <div className="stat-label">Total Procurement Spend</div>
            {hasActiveFilters && <span className="badge badge-ordered" style={{ fontSize: '9.5px', padding: '2px 6px' }}>Filtered</span>}
          </div>
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>
            ₹{Number(overview?.total_spend || 0).toLocaleString()}
          </div>
          <div className="stat-subtext">
            Across {overview?.active_orders_count || 0} active purchase orders
          </div>
        </div>
      </div>

      {/* Interactive Filter Toolbar */}
      <div className="card" style={{ marginBottom: '24px', border: hasActiveFilters ? '1px solid var(--primary-border)' : '1px solid var(--border-color)', boxShadow: 'var(--shadow-xs)' }}>
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Filter Analytics:
            </span>

            <div style={{ flex: 1, minWidth: '160px' }}>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="raw_material">Raw Material</option>
                <option value="equipment">Equipment</option>
                <option value="it">IT Services</option>
                <option value="service_provider">Service Provider</option>
                <option value="logistics">Logistics</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '160px' }}>
              <select
                className="form-select"
                value={selectedRisk}
                onChange={(e) => setSelectedRisk(e.target.value)}
              >
                <option value="">All Risk Tiers</option>
                <option value="Low">Low Risk (Tier 1)</option>
                <option value="Medium-Low">Medium-Low (Tier 2)</option>
                <option value="Medium">Medium Risk (Tier 3)</option>
                <option value="High">High Risk (Tier 4)</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '150px' }}>
              <select
                className="form-select"
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
              >
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last 12 Months</option>
                <option value="all">All-Time Historical</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleResetFilters}
                style={{ fontWeight: 700, color: 'var(--danger)' }}
              >
                &times; Reset Filters
              </button>
            )}
          </div>

          {/* Active Filters Tag Row */}
          {hasActiveFilters && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Applied Scope ({overview?.total_vendors ?? filteredSuppliers.length} suppliers):
              </span>
              {selectedCategory && (
                <span className="badge badge-ordered" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', padding: '3px 8px' }}>
                  Category: <strong>{selectedCategory.replace('_', ' ').toUpperCase()}</strong>
                  <span style={{ cursor: 'pointer', fontWeight: 800, fontSize: '13px' }} onClick={() => setSelectedCategory('')}>&times;</span>
                </span>
              )}
              {selectedRisk && (
                <span className="badge badge-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', padding: '3px 8px' }}>
                  Risk: <strong>{selectedRisk}</strong>
                  <span style={{ cursor: 'pointer', fontWeight: 800, fontSize: '13px' }} onClick={() => setSelectedRisk('')}>&times;</span>
                </span>
              )}
              {timeWindow !== '90d' && (
                <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', padding: '3px 8px' }}>
                  Timeline: <strong>{timeWindow === '30d' ? 'Last 30 Days' : timeWindow === '1y' ? 'Last 12 Months' : 'All-Time'}</strong>
                  <span style={{ cursor: 'pointer', fontWeight: 800, fontSize: '13px' }} onClick={() => setTimeWindow('90d')}>&times;</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Analytics Grid: Visual Charts & Intelligence */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '24px' }}>
        {/* Chart 1: Monthly On-Time Delivery Trajectory (Interactive SVG Chart) */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Monthly Delivery Reliability Trajectory</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                On-time delivery percentage trend across historical fulfillment cycles ({timeWindow === '30d' ? 'Last 30 Days' : timeWindow === '90d' ? 'Last 90 Days' : timeWindow === '1y' ? 'Last 12 Months' : 'All Cycles'})
              </p>
            </div>
            <span className="badge badge-approved">{timeWindow.toUpperCase()} Trend</span>
          </div>
          <div className="card-body">
            <div style={{ height: '220px', position: 'relative', width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '20px 10px 10px' }}>
              {!overview?.monthly_delivery_trend || overview.monthly_delivery_trend.length === 0 ? (
                <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>
                  No historical delivery data for current filter criteria.
                </div>
              ) : (
                overview.monthly_delivery_trend.map((item, idx) => {
                  const heightPercent = Math.max(10, Math.min(100, item.on_time));
                  return (
                    <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>
                        {item.on_time}%
                      </div>
                      <div
                        style={{
                          width: '36px',
                          height: `${heightPercent * 1.5}px`,
                          maxHeight: '150px',
                          background: 'linear-gradient(180deg, #145e47 0%, #0d3e2f 100%)',
                          borderRadius: '6px 6px 0 0',
                          position: 'relative',
                          transition: 'height 0.3s ease',
                          boxShadow: '0 2px 6px rgba(20, 94, 71, 0.2)'
                        }}
                        title={`${item.month}: ${item.on_time}% on-time (${item.orders} orders)`}
                      >
                        {item.delayed > 8 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: `${item.delayed}%`,
                              background: 'var(--terracotta)',
                              borderRadius: '6px 6px 0 0'
                            }}
                            title={`Delayed: ${item.delayed}%`}
                          />
                        )}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '8px' }}>
                        {item.month}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', background: 'var(--primary)', borderRadius: '3px' }}></span> On-Time Rate
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', background: 'var(--terracotta)', borderRadius: '3px' }}></span> Delay Variance
              </span>
            </div>
          </div>
        </div>

        {/* Chart 2: Category Spend vs. Reliability */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Category Reliability & Spend Matrix</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Departmental spend allocation vs. average performance
              </p>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!overview?.category_breakdown || overview.category_breakdown.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>
                  No category records matching the current filters.
                </div>
              ) : (
                overview.category_breakdown.map((cat, idx) => {
                  const isSelected = selectedCategory && normalize(cat.category) === normalize(selectedCategory);
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: isSelected ? '8px 12px' : '4px 0',
                        background: isSelected ? 'var(--primary-light)' : 'transparent',
                        borderRadius: 'var(--radius-sm)',
                        border: isSelected ? '1px solid var(--primary-border)' : '1px solid transparent',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{cat.category}</strong>
                          {isSelected && <span className="badge badge-approved" style={{ fontSize: '9.5px', padding: '1px 5px' }}>Active Filter</span>}
                        </div>
                        <span>
                          <strong>₹{Number(cat.spend || 0).toLocaleString()}</strong> &bull;{' '}
                          <span style={{ color: cat.avg_reliability >= 85 ? 'var(--success)' : cat.avg_reliability >= 70 ? 'var(--accent)' : 'var(--danger)', fontWeight: 700 }}>
                            {cat.avg_reliability} Score
                          </span>
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(10, cat.avg_reliability))}%`,
                            height: '100%',
                            background: cat.avg_reliability >= 85 ? 'var(--success)' : cat.avg_reliability >= 70 ? 'var(--accent)' : 'var(--danger)',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Supplier Reliability Leaderboard + Predictive AI Simulator */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '20px', marginBottom: '24px' }}>
        {/* Supplier Leaderboard Table */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Supplier Reliability Leaderboard ({filteredSuppliers.length})</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Multi-factor composite ranking. Click any supplier to inspect 5-factor breakdown.
              </p>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Category</th>
                    <th>Reliability Score</th>
                    <th>Risk Level</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '14px', marginBottom: '8px' }}>No suppliers found matching the active filter criteria.</div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleResetFilters}
                        >
                          Reset Filters to Show All
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.company_name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.tier}</div>
                        </td>
                        <td>
                          <span className="badge badge-neutral">{s.category}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '14px', color: s.reliability_score >= 85 ? 'var(--success)' : s.reliability_score >= 70 ? 'var(--accent)' : 'var(--danger)' }}>
                              {s.reliability_score}
                            </strong>
                            <div style={{ width: '60px', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px' }}>
                              <div
                                style={{
                                  width: `${s.reliability_score}%`,
                                  height: '100%',
                                  background: s.reliability_score >= 85 ? 'var(--success)' : s.reliability_score >= 70 ? 'var(--accent)' : 'var(--danger)',
                                  borderRadius: '3px'
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              s.risk_level === 'Low'
                                ? 'badge-approved'
                                : s.risk_level === 'Medium-Low'
                                ? 'badge-ordered'
                                : s.risk_level === 'Medium'
                                ? 'badge-pending'
                                : 'badge-rejected'
                            }`}
                          >
                            {s.risk_level}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleInspectVendor(s.id)}
                          >
                            Inspect 360°
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Predictive PO Delivery Delay Simulator Widget */}
        <div className="card" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
          <div className="card-header" style={{ background: 'var(--primary-light)', borderBottom: '1px solid var(--primary-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              
              <div>
                <h2 className="card-title" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  AI Delivery Delay Predictor
                  <span className="badge badge-approved" style={{ fontSize: '10px', padding: '2px 6px' }}>ML Deployed</span>
                </h2>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  GradientBoosting model trained on <strong>180,519 DataCo Supply Chain</strong> historical orders
                </div>
              </div>
            </div>
          </div>
          <div className="card-body">
            <form onSubmit={handleRunPrediction}>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Target Supplier *</label>
                <select
                  className="form-select"
                  value={simVendorId}
                  onChange={(e) => setSimVendorId(e.target.value)}
                  required
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.company_name} ({v.category?.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row" style={{ gap: '10px', marginBottom: '10px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px' }}>Order Total (₹) *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={simAmount}
                    onChange={(e) => setSimAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px' }}>Scheduled Days *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={simDays}
                    onChange={(e) => setSimDays(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row" style={{ gap: '10px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px' }}>Shipping Mode</label>
                  <select
                    className="form-select"
                    value={simShipping}
                    onChange={(e) => setSimShipping(e.target.value)}
                  >
                    <option value="Standard Class">Standard Freight</option>
                    <option value="Second Class">Second Class Freight</option>
                    <option value="First Class">First Class Air</option>
                    <option value="Same Day">Same Day Critical</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px' }}>Line Items Qty</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={simItemCount}
                    onChange={(e) => setSimItemCount(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', fontWeight: 700 }}
                disabled={predicting}
              >
                {predicting ? 'Evaluating ML Model...' : 'Run Predictive Risk Assessment'}
              </button>
            </form>

            {/* Prediction Result Display */}
            {predictionResult && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  borderRadius: '10px',
                  background: predictionResult.late_delivery_risk ? 'var(--danger-bg)' : 'var(--success-bg)',
                  border: `1px solid ${predictionResult.late_delivery_risk ? 'var(--danger-border)' : 'var(--success-border)'}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ color: predictionResult.late_delivery_risk ? 'var(--danger)' : 'var(--success)', fontSize: '13.5px' }}>
                    {predictionResult.late_delivery_risk ? 'Elevated Delay Risk Detected' : 'Standard Delivery Profile'}
                  </strong>
                  <span
                    className={`badge ${predictionResult.late_delivery_risk ? 'badge-rejected' : 'badge-approved'}`}
                  >
                    {predictionResult.risk_probability}% Probability
                  </span>
                </div>

                {predictionResult.predicted_delay_days > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--danger)', marginBottom: '8px' }}>
                    Estimated delivery delay: <strong>+{predictionResult.predicted_delay_days} days</strong> past scheduled window.
                  </div>
                )}

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <strong>Key Factors:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {predictionResult.key_risk_factors.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                  <strong>AI Mitigation Strategy:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {predictionResult.mitigation_recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Vendor 360 Deep Dive Inspection */}
      <Modal
        isOpen={Boolean(selectedVendorId)}
        onClose={() => { setSelectedVendorId(null); setVendorMetrics(null); }}
        title={`Supplier 360° Intelligence: ${vendorMetrics?.company_name || 'Loading...'}`}
        maxWidth="720px"
      >
        {metricsLoading || !vendorMetrics ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Calculating multi-factor telemetry...</div>
        ) : (
          <div>
            <div className="modal-body">
              {/* Score Header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div className="stat-card" style={{ padding: '14px' }}>
                  <div className="stat-label">Composite Score</div>
                  <div className="stat-value" style={{ fontSize: '24px', color: 'var(--primary)' }}>
                    {vendorMetrics.reliability_score}
                  </div>
                  <div className="stat-subtext" style={{ color: 'var(--text-secondary)' }}>{vendorMetrics.supplier_tier}</div>
                </div>

                <div className="stat-card" style={{ padding: '14px' }}>
                  <div className="stat-label">On-Time Fulfillment</div>
                  <div className="stat-value" style={{ fontSize: '24px', color: 'var(--success)' }}>
                    {vendorMetrics.on_time_delivery_rate}%
                  </div>
                  <div className="stat-subtext" style={{ color: 'var(--text-secondary)' }}>{vendorMetrics.on_time_orders}/{vendorMetrics.total_orders} on time</div>
                </div>

                <div className="stat-card" style={{ padding: '14px' }}>
                  <div className="stat-label">Quality Rating</div>
                  <div className="stat-value" style={{ fontSize: '24px', color: 'var(--accent)' }}>
                    {vendorMetrics.average_quality_rating} / 5.0
                  </div>
                  <div className="stat-subtext" style={{ color: 'var(--text-secondary)' }}>Out of 5.0 scale</div>
                </div>

                <div className="stat-card" style={{ padding: '14px' }}>
                  <div className="stat-label">Response Time</div>
                  <div className="stat-value" style={{ fontSize: '24px', color: 'var(--text-primary)' }}>
                    {vendorMetrics.average_response_hours}h
                  </div>
                  <div className="stat-subtext" style={{ color: 'var(--text-secondary)' }}>Resolution: {vendorMetrics.issue_resolution_hours}h</div>
                </div>
              </div>

              {/* 5-Factor Radar Breakdown */}
              <div style={{ marginBottom: '20px' }}>
                <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>5-Factor Reliability Weighting Breakdown</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                      <span>1. Delivery Performance (40% weight)</span>
                      <strong>{vendorMetrics.on_time_delivery_rate}%</strong>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border-subtle)', borderRadius: '3px' }}>
                      <div style={{ width: `${vendorMetrics.on_time_delivery_rate}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                      <span>2. Quality & SLA (25% weight)</span>
                      <strong>{round((vendorMetrics.average_quality_rating / 5.0) * 100, 1)}%</strong>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border-subtle)', borderRadius: '3px' }}>
                      <div style={{ width: `${(vendorMetrics.average_quality_rating / 5.0) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                      <span>3. Contract Compliance (15% weight)</span>
                      <strong>{vendorMetrics.active_contracts} Contracts &bull; {vendorMetrics.active_certifications} Certs</strong>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border-subtle)', borderRadius: '3px' }}>
                      <div style={{ width: vendorMetrics.active_certifications > 0 ? '90%' : '50%', height: '100%', background: 'var(--info)', borderRadius: '3px' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                      <span>4. Communication Speed (10% weight)</span>
                      <strong>{vendorMetrics.average_response_hours}h avg</strong>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border-subtle)', borderRadius: '3px' }}>
                      <div style={{ width: '85%', height: '100%', background: 'var(--terracotta)', borderRadius: '3px' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Procurement Recommendations */}
              <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Strategic Sourcing Recommendations</strong>
                <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {vendorMetrics.recommendations?.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setSelectedVendorId(null); setVendorMetrics(null); }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

function round(val, decimals = 1) {
  return Number(Math.round(val + 'e' + decimals) + 'e-' + decimals);
}
