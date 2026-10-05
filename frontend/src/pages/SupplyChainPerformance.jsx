import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

function SupplyChainPerformance() {
  const [vendors, setVendors] = useState([]);
  const [performance, setPerformance] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");

  useEffect(() => {
    loadPerformance();
  }, []);

  async function loadPerformance() {
    try {
      setError("");

      if (vendors.length > 0) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = getToken();

      if (!token) {
        throw new Error("Please login again.");
      }

      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };

      // =========================================================
      // GET ALL VENDORS
      // =========================================================

      const vendorsResponse = await fetch(
        `${API_URL}/vendors`,
        {
          headers,
        }
      );

      if (!vendorsResponse.ok) {
        throw new Error("Unable to load vendor information.");
      }

      const vendorsData = await vendorsResponse.json();

      const vendorList = Array.isArray(vendorsData)
        ? vendorsData
        : Array.isArray(vendorsData?.vendors)
        ? vendorsData.vendors
        : [];

      // =========================================================
      // GET ALL PERFORMANCE RECORDS
      // =========================================================

      const performanceResponse = await fetch(
        `${API_URL}/performance`,
        {
          headers,
        }
      );

      if (!performanceResponse.ok) {
        throw new Error("Unable to load performance information.");
      }

      const performanceData = await performanceResponse.json();

      const performanceList = Array.isArray(performanceData)
        ? performanceData
        : Array.isArray(performanceData?.performance)
        ? performanceData.performance
        : Array.isArray(performanceData?.records)
        ? performanceData.records
        : [];

      setVendors(vendorList);
      setPerformance(performanceList);
    } catch (err) {
      console.error(
        "Supply Chain Performance Error:",
        err
      );

      setError(
        err.message ||
          "Unable to load supply chain performance."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // =========================================================
  // NUMBER HELPER
  // =========================================================

  function toNumber(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }

  // =========================================================
  // GET LATEST PERFORMANCE FOR EACH VENDOR
  // =========================================================

  const vendorPerformance = useMemo(() => {
    return vendors.map((vendor) => {
      const records = performance.filter(
        (item) =>
          String(item.vendor_id) ===
          String(vendor.id)
      );

      let latest = null;

      if (records.length > 0) {
        latest = records[records.length - 1];
      }

      // -------------------------------------------------------
      // RELIABILITY
      // -------------------------------------------------------

      const vendorReliability = toNumber(
        vendor.reliability_score
      );

      const performanceReliability =
        toNumber(latest?.reliability_score);

      const overallScore = toNumber(
        latest?.overall_score
      );

      const reliability =
        vendorReliability !== null
          ? vendorReliability
          : performanceReliability !== null
          ? performanceReliability
          : overallScore;

      // -------------------------------------------------------
      // ON-TIME DELIVERY
      // -------------------------------------------------------

      const onTime =
        toNumber(latest?.on_time_delivery) ??
        toNumber(latest?.on_time_percentage) ??
        toNumber(latest?.delivery_score);

      // -------------------------------------------------------
      // QUALITY
      // -------------------------------------------------------

      const quality =
        toNumber(latest?.quality_score) ??
        toNumber(latest?.quality);

      // -------------------------------------------------------
      // OVERALL
      // -------------------------------------------------------

      const overall =
        overallScore ??
        reliability;

      // -------------------------------------------------------
      // STATUS
      // -------------------------------------------------------

      let status = "No Data";

      if (reliability !== null) {
        if (reliability >= 80) {
          status = "Good";
        } else if (reliability >= 60) {
          status = "Monitor";
        } else {
          status = "Needs Review";
        }
      }

      return {
        vendor,
        performance: latest,
        onTime,
        quality,
        reliability,
        overall,
        status,
      };
    });
  }, [vendors, performance]);

  // =========================================================
  // FILTERED DATA
  // =========================================================

  const filteredVendors = useMemo(() => {
    return vendorPerformance.filter((item) => {
      const vendorName =
        item.vendor?.company_name ||
        item.vendor?.name ||
        "";

      const matchesSearch = vendorName
        .toLowerCase()
        .includes(search.toLowerCase());

      let matchesRisk = true;

      if (riskFilter === "good") {
        matchesRisk = item.status === "Good";
      }

      if (riskFilter === "monitor") {
        matchesRisk = item.status === "Monitor";
      }

      if (riskFilter === "review") {
        matchesRisk =
          item.status === "Needs Review";
      }

      return matchesSearch && matchesRisk;
    });
  }, [
    vendorPerformance,
    search,
    riskFilter,
  ]);

  // =========================================================
  // AVERAGE RELIABILITY
  // =========================================================

  const reliabilityValues =
    vendorPerformance
      .map((item) => item.reliability)
      .filter(
        (value) =>
          value !== null &&
          value !== undefined
      );

  const averageReliability =
    reliabilityValues.length > 0
      ? Math.round(
          reliabilityValues.reduce(
            (sum, value) => sum + value,
            0
          ) / reliabilityValues.length
        )
      : null;

  // =========================================================
  // AVERAGE ON-TIME DELIVERY
  // =========================================================

  const onTimeValues =
    vendorPerformance
      .map((item) => item.onTime)
      .filter(
        (value) =>
          value !== null &&
          value !== undefined
      );

  const averageOnTime =
    onTimeValues.length > 0
      ? Math.round(
          onTimeValues.reduce(
            (sum, value) => sum + value,
            0
          ) / onTimeValues.length
        )
      : null;

  // =========================================================
  // AVERAGE QUALITY
  // =========================================================

  const qualityValues =
    vendorPerformance
      .map((item) => item.quality)
      .filter(
        (value) =>
          value !== null &&
          value !== undefined
      );

  const averageQuality =
    qualityValues.length > 0
      ? Math.round(
          qualityValues.reduce(
            (sum, value) => sum + value,
            0
          ) / qualityValues.length
        )
      : null;

  // =========================================================
  // RELIABLE VENDORS
  // =========================================================

  const reliableVendors =
    vendorPerformance.filter(
      (item) =>
        item.reliability !== null &&
        item.reliability >= 80
    ).length;

  // =========================================================
  // RISK COUNTS
  // =========================================================

  const goodCount =
    vendorPerformance.filter(
      (item) => item.status === "Good"
    ).length;

  const monitorCount =
    vendorPerformance.filter(
      (item) => item.status === "Monitor"
    ).length;

  const reviewCount =
    vendorPerformance.filter(
      (item) => item.status === "Needs Review"
    ).length;

  // =========================================================
  // FORMAT
  // =========================================================

  function formatPercentage(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "—";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "—";
    }

    return `${Number.isInteger(number)
      ? number
      : number.toFixed(1)}%`;
  }

  function getInitial(name) {
    return String(name || "V")
      .charAt(0)
      .toUpperCase();
  }

  return (
    <DashboardLayout
      title="Supply Chain Performance"
      role="Administrator"
      menuItems={[
        "Dashboard",
        "Vendor Portal",
        "Vendor Management",
        "Procurement & POs",
        "Contracts & Compliance",
        "Predictive Analytics",
        "Reports & Exports",
        "Tender Communication",
        "Audit Trails",
      ]}
    >
      <div className="supply-chain-page">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="page-header">

          <div>
            <div className="page-eyebrow">
              PROCUREMENT INTELLIGENCE
            </div>

            <h1>
              Supply Chain Performance
            </h1>

            <p>
              Analyze real vendor reliability and
              delivery performance.
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={loadPerformance}
            disabled={
              loading || refreshing
            }
          >
            <span>↻</span>

            {refreshing
              ? "Refreshing..."
              : "Refresh Data"}
          </button>
        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="error-box">

            <div className="error-icon">
              !
            </div>

            <div>
              <strong>
                Unable to load performance data
              </strong>

              <p>
                {error}
              </p>
            </div>

            <button
              onClick={loadPerformance}
            >
              Retry
            </button>

          </div>
        )}

        {/* =====================================================
            KPI CARDS
        ===================================================== */}

        <div className="stats-grid">

          <StatCard
            label="Average Reliability"
            value={
              loading
                ? "..."
                : averageReliability !== null
                ? `${averageReliability}%`
                : "N/A"
            }
            description="Across evaluated vendors"
            icon="◉"
            type="reliability"
          />

          <StatCard
            label="On-Time Delivery"
            value={
              loading
                ? "..."
                : averageOnTime !== null
                ? `${averageOnTime}%`
                : "N/A"
            }
            description="Average delivery performance"
            icon="✓"
            type="delivery"
          />

          <StatCard
            label="Quality"
            value={
              loading
                ? "..."
                : averageQuality !== null
                ? `${averageQuality}%`
                : "Not Available"
            }
            description="Based on recorded quality data"
            icon="◆"
            type="quality"
          />

          <StatCard
            label="Reliable Vendors"
            value={
              loading
                ? "..."
                : reliableVendors
            }
            description="Reliability score ≥ 80%"
            icon="★"
            type="vendors"
          />

        </div>

        {/* =====================================================
            RISK SUMMARY
        ===================================================== */}

        <div className="risk-summary">

          <div className="risk-summary-title">
            <div>
              <h3>
                Vendor Risk Distribution
              </h3>

              <p>
                Current reliability classification
                across your vendor network.
              </p>
            </div>

            <div className="total-vendors">
              <strong>
                {vendorPerformance.length}
              </strong>

              <span>
                Total Vendors
              </span>
            </div>
          </div>

          <div className="risk-grid">

            <RiskItem
              title="Good"
              count={goodCount}
              description="Reliable vendors"
              className="good"
            />

            <RiskItem
              title="Monitor"
              count={monitorCount}
              description="Requires monitoring"
              className="monitor"
            />

            <RiskItem
              title="Needs Review"
              count={reviewCount}
              description="Requires attention"
              className="review"
            />

          </div>

        </div>

        {/* =====================================================
            MAIN PERFORMANCE CARD
        ===================================================== */}

        <div className="performance-card">

          <div className="performance-header">

            <div>
              <h2>
                Vendor Performance
              </h2>

              <p>
                Reliability and delivery indicators
                for registered vendors.
              </p>
            </div>

            <div className="vendor-count">
              {filteredVendors.length} Vendors
            </div>

          </div>

          {/* SEARCH + FILTER */}

          <div className="toolbar">

            <div className="search-box">

              <span>
                ⌕
              </span>

              <input
                type="text"
                placeholder="Search vendors..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />

            </div>

            <div className="filter-buttons">

              <button
                className={
                  riskFilter === "all"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setRiskFilter("all")
                }
              >
                All
              </button>

              <button
                className={
                  riskFilter === "good"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setRiskFilter("good")
                }
              >
                Good
              </button>

              <button
                className={
                  riskFilter === "monitor"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setRiskFilter("monitor")
                }
              >
                Monitor
              </button>

              <button
                className={
                  riskFilter === "review"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setRiskFilter("review")
                }
              >
                Needs Review
              </button>

            </div>

          </div>

          {/* ===================================================
              TABLE
          =================================================== */}

          {loading ? (

            <div className="loading-container">

              <div className="spinner" />

              <p>
                Loading vendor performance...
              </p>

            </div>

          ) : filteredVendors.length === 0 ? (

            <div className="empty-container">

              <div className="empty-icon">
                ◌
              </div>

              <h3>
                No vendor performance data
              </h3>

              <p>
                No vendors match the current
                search or filter.
              </p>

            </div>

          ) : (

            <div className="table-wrapper">

              <table className="performance-table">

                <thead>

                  <tr>

                    <th>
                      VENDOR
                    </th>

                    <th>
                      ON-TIME DELIVERY
                    </th>

                    <th>
                      QUALITY
                    </th>

                    <th>
                      RELIABILITY
                    </th>

                    <th>
                      OVERALL
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredVendors.map(
                    (item, index) => {

                      const vendorName =
                        item.vendor
                          ?.company_name ||
                        item.vendor?.name ||
                        "Unknown Vendor";

                      return (

                        <tr
                          key={
                            item.vendor?.id ||
                            index
                          }
                        >

                          {/* VENDOR */}

                          <td>

                            <div className="vendor-cell">

                              <div className="vendor-avatar">
                                {getInitial(
                                  vendorName
                                )}
                              </div>

                              <div>

                                <strong>
                                  {vendorName}
                                </strong>

                                <span>
                                  {item.vendor
                                    ?.category ||
                                    "Vendor"}
                                </span>

                              </div>

                            </div>

                          </td>

                          {/* ON TIME */}

                          <td>

                            <PerformanceValue
                              value={item.onTime}
                              positive
                            />

                          </td>

                          {/* QUALITY */}

                          <td>

                            <PerformanceValue
                              value={item.quality}
                            />

                          </td>

                          {/* RELIABILITY */}

                          <td>

                            <div className="reliability-cell">

                              <strong>
                                {formatPercentage(
                                  item.reliability
                                )}
                              </strong>

                              {item.reliability !==
                                null && (
                                <div className="mini-progress">

                                  <div
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          item.reliability
                                        )
                                      )}%`,
                                    }}
                                  />

                                </div>
                              )}

                            </div>

                          </td>

                          {/* OVERALL */}

                          <td>

                            <div className="overall-cell">

                              <span
                                className={`status-badge ${getStatusClass(
                                  item.status
                                )}`}
                              >
                                {item.status}
                              </span>

                            </div>

                          </td>

                        </tr>

                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

      <style>{`

        * {
          box-sizing: border-box;
        }

        .supply-chain-page {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
          color: #172033;
        }

        /* ================================================
           HEADER
        ================================================ */

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
        }

        .page-eyebrow {
          margin-bottom: 6px;
          color: #137388;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .page-header h1 {
          margin: 0;
          color: #142338;
          font-size: 27px;
          font-weight: 750;
          line-height: 1.2;
        }

        .page-header p {
          margin: 7px 0 0;
          color: #7b8495;
          font-size: 12px;
          line-height: 1.5;
        }

        .refresh-button {
          display: flex;
          align-items: center;
          gap: 7px;
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: #123f61;
          padding: 10px 15px;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .refresh-button:hover {
          background: #edf7f9;
          border-color: #67d7e8;
        }

        .refresh-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .refresh-button span {
          font-size: 15px;
        }

        /* ================================================
           ERROR
        ================================================ */

        .error-box {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 15px;
          margin-bottom: 20px;
          border: 1px solid #f1cccc;
          border-radius: 11px;
          background: #fff7f7;
        }

        .error-icon {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 50%;
          background: #dc3545;
          color: white;
          font-weight: 800;
        }

        .error-box div:nth-child(2) {
          flex: 1;
        }

        .error-box strong {
          display: block;
          color: #a52834;
          font-size: 12px;
        }

        .error-box p {
          margin: 3px 0 0;
          color: #777;
          font-size: 10px;
        }

        .error-box button {
          border: 0;
          border-radius: 7px;
          background: #dc3545;
          color: white;
          padding: 8px 12px;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        /* ================================================
           STATS
        ================================================ */

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 15px;
          margin-bottom: 20px;
        }

        .stat-card {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 13px;
          min-height: 112px;
          padding: 17px;
          border: 1px solid #e7ebf0;
          border-radius: 13px;
          background: #ffffff;
          box-shadow: 0 3px 12px rgba(
            11,
            31,
            58,
            0.025
          );
          transition: 0.2s ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          border-color: #d5e7eb;
          box-shadow: 0 8px 22px rgba(
            11,
            31,
            58,
            0.07
          );
        }

        .stat-icon {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: #edf7f9;
          color: #137388;
          font-size: 19px;
          font-weight: 800;
        }

        .stat-label {
          margin: 0;
          color: #7c8695;
          font-size: 10px;
          font-weight: 600;
        }

        .stat-value {
          margin: 4px 0 3px;
          color: #142338;
          font-size: 24px;
          font-weight: 800;
          line-height: 1;
        }

        .stat-description {
          margin: 0;
          color: #9aa3b1;
          font-size: 8px;
        }

        /* ================================================
           RISK SUMMARY
        ================================================ */

        .risk-summary {
          padding: 20px;
          margin-bottom: 20px;
          border: 1px solid #e7ebf0;
          border-radius: 13px;
          background: #ffffff;
          box-shadow: 0 3px 12px rgba(
            11,
            31,
            58,
            0.025
          );
        }

        .risk-summary-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }

        .risk-summary-title h3 {
          margin: 0;
          color: #142338;
          font-size: 15px;
          font-weight: 700;
        }

        .risk-summary-title p {
          margin: 4px 0 0;
          color: #8a94a3;
          font-size: 10px;
        }

        .total-vendors {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 12px;
          border-radius: 8px;
          background: #f6f8fa;
        }

        .total-vendors strong {
          color: #123f61;
          font-size: 17px;
        }

        .total-vendors span {
          color: #8a94a3;
          font-size: 9px;
        }

        .risk-grid {
          display: grid;
          grid-template-columns: repeat(
            3,
            1fr
          );
          gap: 12px;
        }

        .risk-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 15px;
          border: 1px solid #edf0f3;
          border-radius: 10px;
          background: #fafbfc;
        }

        .risk-item-left {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .risk-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
        }

        .risk-item.good .risk-dot {
          background: #20a36a;
        }

        .risk-item.monitor .risk-dot {
          background: #e5a63a;
        }

        .risk-item.review .risk-dot {
          background: #df4b58;
        }

        .risk-item-title {
          display: block;
          color: #253247;
          font-size: 10px;
          font-weight: 700;
        }

        .risk-item-description {
          display: block;
          margin-top: 2px;
          color: #929ba8;
          font-size: 8px;
        }

        .risk-count {
          font-size: 20px;
          font-weight: 800;
        }

        .risk-item.good .risk-count {
          color: #198754;
        }

        .risk-item.monitor .risk-count {
          color: #b7791f;
        }

        .risk-item.review .risk-count {
          color: #dc3545;
        }

        /* ================================================
           PERFORMANCE CARD
        ================================================ */

        .performance-card {
          overflow: hidden;
          border: 1px solid #e7ebf0;
          border-radius: 13px;
          background: #ffffff;
          box-shadow: 0 3px 12px rgba(
            11,
            31,
            58,
            0.025
          );
        }

        .performance-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 20px 20px 16px;
        }

        .performance-header h2 {
          margin: 0;
          color: #142338;
          font-size: 16px;
          font-weight: 750;
        }

        .performance-header p {
          margin: 4px 0 0;
          color: #8a94a3;
          font-size: 10px;
        }

        .vendor-count {
          padding: 7px 11px;
          border-radius: 20px;
          background: #edf7f9;
          color: #123f61;
          font-size: 9px;
          font-weight: 750;
        }

        /* ================================================
           TOOLBAR
        ================================================ */

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 11px 20px;
          border-top: 1px solid #f0f2f4;
          border-bottom: 1px solid #e8ebf1;
          background: #fafbfc;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 260px;
          padding: 7px 10px;
          border: 1px solid #e0e5eb;
          border-radius: 7px;
          background: #ffffff;
        }

        .search-box span {
          color: #8b95a4;
          font-size: 15px;
        }

        .search-box input {
          width: 100%;
          border: 0;
          outline: 0;
          color: #263449;
          background: transparent;
          font-size: 10px;
        }

        .search-box input::placeholder {
          color: #a3aab4;
        }

        .filter-buttons {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .filter-buttons button {
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          color: #737d8c;
          padding: 7px 10px;
          font-size: 9px;
          font-weight: 650;
          cursor: pointer;
        }

        .filter-buttons button:hover {
          background: #ffffff;
          color: #123f61;
        }

        .filter-buttons button.active {
          border-color: #dfe4eb;
          background: #ffffff;
          color: #123f61;
          box-shadow: 0 1px 3px rgba(
            11,
            31,
            58,
            0.04
          );
        }

        /* ================================================
           TABLE
        ================================================ */

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .performance-table {
          width: 100%;
          border-collapse: collapse;
        }

        .performance-table th {
          padding: 12px 20px;
          border-bottom: 1px solid #e8ebf1;
          color: #7c8695;
          text-align: left;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .performance-table td {
          padding: 13px 20px;
          border-bottom: 1px solid #f0f2f4;
          color: #5e6877;
          font-size: 10px;
          white-space: nowrap;
        }

        .performance-table tbody tr {
          transition: 0.15s ease;
        }

        .performance-table tbody tr:hover {
          background: #f9fbfc;
        }

        /* ================================================
           VENDOR CELL
        ================================================ */

        .vendor-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .vendor-avatar {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 9px;
          background: #edf7f9;
          color: #137388;
          font-size: 12px;
          font-weight: 800;
        }

        .vendor-cell strong {
          display: block;
          max-width: 260px;
          overflow: hidden;
          color: #253247;
          font-size: 10px;
          font-weight: 700;
          text-overflow: ellipsis;
        }

        .vendor-cell span {
          display: block;
          margin-top: 3px;
          color: #969fab;
          font-size: 8px;
        }

        /* ================================================
           PERFORMANCE VALUE
        ================================================ */

        .performance-value {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #263449;
          font-weight: 650;
        }

        .performance-value.positive {
          color: #198754;
        }

        .performance-value-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #198754;
        }

        /* ================================================
           RELIABILITY
        ================================================ */

        .reliability-cell {
          min-width: 100px;
        }

        .reliability-cell strong {
          color: #123f61;
          font-size: 11px;
          font-weight: 750;
        }

        .mini-progress {
          width: 85px;
          height: 4px;
          margin-top: 5px;
          overflow: hidden;
          border-radius: 10px;
          background: #edf0f3;
        }

        .mini-progress div {
          height: 100%;
          border-radius: 10px;
          background: linear-gradient(
            90deg,
            #123f61,
            #137388
          );
        }

        /* ================================================
           STATUS
        ================================================ */

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 20px;
          font-size: 8px;
          font-weight: 800;
        }

        .status-badge.good {
          background: #e8f7ee;
          color: #198754;
        }

        .status-badge.monitor {
          background: #fff4df;
          color: #b7791f;
        }

        .status-badge.review {
          background: #fff0f0;
          color: #dc3545;
        }

        .status-badge.no-data {
          background: #f1f3f5;
          color: #6c757d;
        }

        /* ================================================
           LOADING
        ================================================ */

        .loading-container {
          min-height: 280px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          width: 29px;
          height: 29px;
          margin-bottom: 10px;
          border: 3px solid #e2e7eb;
          border-top-color: #137388;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-container p {
          margin: 0;
          color: #8a94a3;
          font-size: 10px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* ================================================
           EMPTY
        ================================================ */

        .empty-container {
          min-height: 280px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          border-radius: 50%;
          background: #edf7f9;
          color: #137388;
          font-size: 23px;
        }

        .empty-container h3 {
          margin: 0;
          color: #253247;
          font-size: 13px;
        }

        .empty-container p {
          margin: 5px 0 0;
          color: #929ba8;
          font-size: 10px;
        }

        /* ================================================
           RESPONSIVE
        ================================================ */

        @media (max-width: 1100px) {

          .stats-grid {
            grid-template-columns: repeat(
              2,
              1fr
            );
          }

        }

        @media (max-width: 850px) {

          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .search-box {
            width: 100%;
          }

          .filter-buttons {
            flex-wrap: wrap;
          }

          .risk-grid {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 700px) {

          .page-header {
            flex-direction: column;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .performance-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .risk-summary-title {
            align-items: flex-start;
            flex-direction: column;
          }

          .error-box {
            align-items: flex-start;
          }

        }

      `}</style>
    </DashboardLayout>
  );
}

/* =============================================================
   STAT CARD
============================================================= */

function StatCard({
  label,
  value,
  description,
  icon,
}) {
  return (
    <div className="stat-card">

      <div className="stat-icon">
        {icon}
      </div>

      <div>

        <p className="stat-label">
          {label}
        </p>

        <div className="stat-value">
          {value}
        </div>

        <p className="stat-description">
          {description}
        </p>

      </div>

    </div>
  );
}

/* =============================================================
   RISK ITEM
============================================================= */

function RiskItem({
  title,
  count,
  description,
  className,
}) {
  return (
    <div
      className={`risk-item ${className}`}
    >

      <div className="risk-item-left">

        <div className="risk-dot" />

        <div>

          <span className="risk-item-title">
            {title}
          </span>

          <span className="risk-item-description">
            {description}
          </span>

        </div>

      </div>

      <strong className="risk-count">
        {count}
      </strong>

    </div>
  );
}

/* =============================================================
   PERFORMANCE VALUE
============================================================= */

function PerformanceValue({
  value,
  positive,
}) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return (
      <span className="performance-value">
        —
      </span>
    );
  }

  return (
    <span
      className={`performance-value ${
        positive ? "positive" : ""
      }`}
    >

      {positive && (
        <span className="performance-value-dot" />
      )}

      {Number.isInteger(Number(value))
        ? Number(value)
        : Number(value).toFixed(1)}
      %

    </span>
  );
}

/* =============================================================
   STATUS CLASS
============================================================= */

function getStatusClass(status) {
  if (status === "Good") {
    return "good";
  }

  if (status === "Monitor") {
    return "monitor";
  }

  if (status === "Needs Review") {
    return "review";
  }

  return "no-data";
}

export default SupplyChainPerformance;