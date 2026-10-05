import React, { useEffect, useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

const MENU_ITEMS = [
  "Dashboard",
  "Vendors",
  "Procurement Requests",
  "Purchase Orders",
  "Approvals",
  "Vendor Performance",
  "Reports",
  "Notifications",
];

const CATEGORY_OPTIONS = [
  "All Categories",
  "Raw Material Suppliers",
  "Equipment Vendors",
  "IT Vendors",
  "Service Providers",
  "Logistics Partners",
  "Maintenance Vendors",
];

function getStoredToken() {
  const keys = [
    "access_token",
    "token",
    "authToken",
    "jwt_token",
  ];

  for (const key of keys) {
    const localValue = localStorage.getItem(key);

    if (localValue) {
      return localValue;
    }

    const sessionValue = sessionStorage.getItem(key);

    if (sessionValue) {
      return sessionValue;
    }
  }

  return null;
}

function clearAuthentication() {
  const keys = [
    "access_token",
    "token",
    "authToken",
    "jwt_token",
  ];

  keys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

function createAuthHeaders() {
  const token = getStoredToken();

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    const cleanToken = token.startsWith("Bearer ")
      ? token.substring(7)
      : token;

    headers.Authorization = `Bearer ${cleanToken}`;
  }

  return headers;
}

async function getApiData(endpoint) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "GET",
    headers: createAuthHeaders(),
  });

  if (response.status === 401) {
    clearAuthentication();

    throw new Error(
      "Your login session has expired. Please login again."
    );
  }

  if (response.status === 403) {
    throw new Error(
      "You do not have permission to access this data."
    );
  }

  if (!response.ok) {
    let message = `Backend request failed with status ${response.status}`;

    try {
      const errorData = await response.json();

      if (errorData?.detail) {
        message = errorData.detail;
      }
    } catch {
      // Keep default message.
    }

    throw new Error(message);
  }

  return response.json();
}

function numberValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function formatPercentage(value) {
  const number = numberValue(value);

  if (number === null) {
    return "No data";
  }

  return `${number.toFixed(1)}%`;
}

function getCurrentUser() {
  const possibleKeys = [
    "user",
    "currentUser",
    "loggedInUser",
  ];

  for (const key of possibleKeys) {
    const localValue = localStorage.getItem(key);

    if (localValue) {
      try {
        return JSON.parse(localValue);
      } catch {
        return null;
      }
    }

    const sessionValue = sessionStorage.getItem(key);

    if (sessionValue) {
      try {
        return JSON.parse(sessionValue);
      } catch {
        return null;
      }
    }
  }

  return null;
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\_-]+/g, " ");
}

function isDelivered(order) {
  const status = normalizeStatus(order.status);

  return (
    status === "delivered" ||
    status === "completed" ||
    status === "delivery completed"
  );
}

function getLatestPerformance(vendorId, records) {
  const matchingRecords = records.filter(
    (record) =>
      Number(record.vendor_id) === Number(vendorId)
  );

  if (matchingRecords.length === 0) {
    return null;
  }

  return [...matchingRecords].sort((a, b) => {
    const dateA = a.evaluation_date
      ? new Date(a.evaluation_date).getTime()
      : 0;

    const dateB = b.evaluation_date
      ? new Date(b.evaluation_date).getTime()
      : 0;

    return dateB - dateA;
  })[0];
}

function getDeliveryScore(vendorId, purchaseOrders) {
  const deliveredOrders = purchaseOrders.filter(
    (order) =>
      Number(order.vendor_id) === Number(vendorId) &&
      isDelivered(order) &&
      order.expected_delivery_date &&
      order.actual_delivery_date
  );

  if (deliveredOrders.length === 0) {
    return null;
  }

  let onTimeCount = 0;

  deliveredOrders.forEach((order) => {
    const expected = new Date(
      order.expected_delivery_date
    );

    const actual = new Date(
      order.actual_delivery_date
    );

    if (
      !Number.isNaN(expected.getTime()) &&
      !Number.isNaN(actual.getTime()) &&
      actual <= expected
    ) {
      onTimeCount += 1;
    }
  });

  return (
    (onTimeCount / deliveredOrders.length) * 100
  );
}

function getPerformanceMetric(
  performance,
  fieldName
) {
  if (!performance) {
    return null;
  }

  return numberValue(performance[fieldName]);
}

function calculateReliability({
  performance,
  deliveryScore,
}) {
  if (!performance && deliveryScore === null) {
    return null;
  }

  const explicitReliability =
    getPerformanceMetric(
      performance,
      "reliability_score"
    );

  if (explicitReliability !== null) {
    return explicitReliability;
  }

  const qualityScore = getPerformanceMetric(
    performance,
    "quality_score"
  );

  const communicationScore =
    getPerformanceMetric(
      performance,
      "communication_score"
    );

  const complianceScore =
    getPerformanceMetric(
      performance,
      "compliance_score"
    );

  const metrics = [];

  if (deliveryScore !== null) {
    metrics.push({
      value: deliveryScore,
      weight: 40,
    });
  }

  if (qualityScore !== null) {
    metrics.push({
      value: qualityScore,
      weight: 25,
    });
  }

  if (communicationScore !== null) {
    metrics.push({
      value: communicationScore,
      weight: 15,
    });
  }

  if (complianceScore !== null) {
    metrics.push({
      value: complianceScore,
      weight: 20,
    });
  }

  if (metrics.length === 0) {
    return null;
  }

  let weightedTotal = 0;
  let totalWeight = 0;

  metrics.forEach((metric) => {
    weightedTotal += metric.value * metric.weight;
    totalWeight += metric.weight;
  });

  return weightedTotal / totalWeight;
}

function calculateOverall({
  performance,
  deliveryScore,
  reliabilityScore,
}) {
  const backendOverall = getPerformanceMetric(
    performance,
    "overall_score"
  );

  if (backendOverall !== null) {
    return backendOverall;
  }

  const qualityScore = getPerformanceMetric(
    performance,
    "quality_score"
  );

  const communicationScore =
    getPerformanceMetric(
      performance,
      "communication_score"
    );

  const complianceScore =
    getPerformanceMetric(
      performance,
      "compliance_score"
    );

  const metrics = [];

  if (deliveryScore !== null) {
    metrics.push({
      value: deliveryScore,
      weight: 40,
    });
  }

  if (qualityScore !== null) {
    metrics.push({
      value: qualityScore,
      weight: 25,
    });
  }

  if (communicationScore !== null) {
    metrics.push({
      value: communicationScore,
      weight: 15,
    });
  }

  if (complianceScore !== null) {
    metrics.push({
      value: complianceScore,
      weight: 20,
    });
  }

  if (metrics.length === 0) {
    return reliabilityScore;
  }

  let total = 0;
  let weight = 0;

  metrics.forEach((metric) => {
    total += metric.value * metric.weight;
    weight += metric.weight;
  });

  return total / weight;
}

function getScoreStyle(value) {
  if (value === null || value === undefined) {
    return styles.scoreNone;
  }

  if (value >= 80) {
    return styles.scoreGood;
  }

  if (value >= 60) {
    return styles.scoreMedium;
  }

  return styles.scoreLow;
}

function ScoreBadge({ value }) {
  const score = numberValue(value);

  return (
    <span
      style={{
        ...styles.scoreBadge,
        ...getScoreStyle(score),
      }}
    >
      {score === null
        ? "No data"
        : `${score.toFixed(1)}%`}
    </span>
  );
}

export default function ProcurementPerformance() {
  const [vendors, setVendors] = useState([]);
  const [performanceRecords, setPerformanceRecords] =
    useState([]);
  const [purchaseOrders, setPurchaseOrders] =
    useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("All Categories");

  const [searchText, setSearchText] = useState("");

  const [currentUser, setCurrentUser] =
    useState(null);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [
        vendorData,
        performanceData,
        purchaseOrderData,
      ] = await Promise.all([
        getApiData("/vendors"),
        getApiData("/performance"),
        getApiData("/purchase-orders"),
      ]);

      setVendors(
        Array.isArray(vendorData)
          ? vendorData
          : []
      );

      setPerformanceRecords(
        Array.isArray(performanceData)
          ? performanceData
          : []
      );

      setPurchaseOrders(
        Array.isArray(purchaseOrderData)
          ? purchaseOrderData
          : []
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load vendor performance data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const vendorRows = useMemo(() => {
    return vendors.map((vendor) => {
      const performance =
        getLatestPerformance(
          vendor.id,
          performanceRecords
        );

      const deliveryScore =
        getDeliveryScore(
          vendor.id,
          purchaseOrders
        );

      const qualityScore =
        getPerformanceMetric(
          performance,
          "quality_score"
        );

      const communicationScore =
        getPerformanceMetric(
          performance,
          "communication_score"
        );

      const complianceScore =
        getPerformanceMetric(
          performance,
          "compliance_score"
        );

      const reliabilityScore =
        calculateReliability({
          performance,
          deliveryScore,
        });

      const overallScore =
        calculateOverall({
          performance,
          deliveryScore,
          reliabilityScore,
        });

      return {
        id: vendor.id,

        companyName:
          vendor.company_name ||
          vendor.name ||
          "Unnamed Vendor",

        category:
          vendor.category ||
          "Not Categorized",

        contactPerson:
          vendor.contact_person ||
          "Not Available",

        email:
          vendor.email ||
          "Not Available",

        phone:
          vendor.phone ||
          "Not Available",

        vendorStatus:
          vendor.vendor_status ||
          "active",

        approvalStatus:
          vendor.approval_status ||
          "pending",

        deliveryScore,
        qualityScore,
        communicationScore,
        complianceScore,
        reliabilityScore,
        overallScore,

        hasPerformance:
          performance !== null,

        hasDeliveryData:
          deliveryScore !== null,

        hasAnyPerformanceData:
          deliveryScore !== null ||
          qualityScore !== null ||
          communicationScore !== null ||
          complianceScore !== null ||
          reliabilityScore !== null,
      };
    });
  }, [
    vendors,
    performanceRecords,
    purchaseOrders,
  ]);

  const filteredVendors = useMemo(() => {
    const search =
      searchText.trim().toLowerCase();

    return vendorRows.filter((vendor) => {
      const categoryMatches =
        categoryFilter === "All Categories" ||
        vendor.category === categoryFilter;

      if (!categoryMatches) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        String(vendor.id)
          .toLowerCase()
          .includes(search) ||
        vendor.companyName
          .toLowerCase()
          .includes(search) ||
        vendor.category
          .toLowerCase()
          .includes(search) ||
        vendor.contactPerson
          .toLowerCase()
          .includes(search)
      );
    });
  }, [
    vendorRows,
    categoryFilter,
    searchText,
  ]);

  const averageVendorScore = useMemo(() => {
    const values = vendorRows
      .map((vendor) => vendor.reliabilityScore)
      .filter(
        (value) =>
          value !== null &&
          value !== undefined
      );

    if (values.length === 0) {
      return null;
    }

    return (
      values.reduce(
        (sum, value) => sum + value,
        0
      ) / values.length
    );
  }, [vendorRows]);

  const averageDeliveryScore = useMemo(() => {
    const values = vendorRows
      .map((vendor) => vendor.deliveryScore)
      .filter(
        (value) =>
          value !== null &&
          value !== undefined
      );

    if (values.length === 0) {
      return null;
    }

    return (
      values.reduce(
        (sum, value) => sum + value,
        0
      ) / values.length
    );
  }, [vendorRows]);

  const evaluatedCount = useMemo(() => {
    return vendorRows.filter(
      (vendor) =>
        vendor.hasAnyPerformanceData
    ).length;
  }, [vendorRows]);

  const reliableVendorCount = useMemo(() => {
    return vendorRows.filter(
      (vendor) =>
        vendor.reliabilityScore !== null &&
        vendor.reliabilityScore >= 80
    ).length;
  }, [vendorRows]);

  const evaluationCoverage =
    vendorRows.length > 0
      ? (evaluatedCount / vendorRows.length) * 100
      : 0;

  function handleMenuClick(item) {
    const routes = {
      Dashboard: "/dashboard",
      Vendors: "/vendors",
      "Procurement Requests":
        "/procurement-requests",
      "Purchase Orders": "/purchase-orders",
      Approvals: "/approvals",
      Reports: "/reports",
      Notifications: "/notifications",
    };

    if (routes[item]) {
      window.location.href = routes[item];
    }
  }

  function handleLoginAgain() {
    clearAuthentication();
    window.location.href = "/login";
  }

  function handleClearFilters() {
    setCategoryFilter("All Categories");
    setSearchText("");
  }

  const displayedUserName =
    currentUser?.name ||
    "Procurement Manager";

  const displayedUserRole =
    currentUser?.role ||
    "procurement_manager";

  return (
    <div style={styles.page}>

      {/* MAIN AREA */}

      <main style={styles.main}>

        {/* TOPBAR */}

        <header style={styles.topbar}>
          <div style={styles.topbarInner}>

            <div>
              <div style={styles.breadcrumb}>
                Procurement / Vendor Performance
              </div>

              <h1 style={styles.pageTitle}>
                Vendor Performance
              </h1>

              <p style={styles.pageDescription}>
                Monitor actual vendor performance
                using procurement and evaluation
                data.
              </p>
            </div>

            <div style={styles.topbarRight}>

              <button
                type="button"
                style={styles.refreshButton}
                onClick={loadData}
              >
                ↻ Refresh
              </button>

              <div style={styles.notification}>
                🔔
              </div>

              <div style={styles.topAvatar}>
                {displayedUserName
                  .charAt(0)
                  .toUpperCase()}
              </div>

            </div>
          </div>
        </header>

        {/* CONTENT */}

        <section style={styles.content}>
          <div style={styles.contentInner}>

            {/* ERROR */}

            {error && (
              <div style={styles.errorBox}>

                <div style={styles.errorTitle}>
                  Unable to load data
                </div>

                <div style={styles.errorText}>
                  {error}
                </div>

                {error
                  .toLowerCase()
                  .includes("login") ||
                error
                  .toLowerCase()
                  .includes("session") ||
                error
                  .toLowerCase()
                  .includes("token") ? (
                  <button
                    type="button"
                    style={styles.loginButton}
                    onClick={handleLoginAgain}
                  >
                    Login Again
                  </button>
                ) : null}

              </div>
            )}

            {/* KPI CARDS */}

            <section style={styles.kpiGrid}>

              <div style={styles.kpiCard}>
                <div style={styles.kpiTop}>

                  <span style={styles.kpiLabel}>
                    Average Reliability
                  </span>

                  <span style={styles.kpiIcon}>
                    ★
                  </span>

                </div>

                <div style={styles.kpiValue}>
                  {formatPercentage(
                    averageVendorScore
                  )}
                </div>

                <div style={styles.kpiHint}>
                  Average of vendors with
                  available reliability data
                </div>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.kpiTop}>

                  <span style={styles.kpiLabel}>
                    On-Time Delivery
                  </span>

                  <span style={styles.kpiIcon}>
                    ✓
                  </span>

                </div>

                <div style={styles.kpiValue}>
                  {formatPercentage(
                    averageDeliveryScore
                  )}
                </div>

                <div style={styles.kpiHint}>
                  Based on delivered purchase
                  orders with delivery dates
                </div>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.kpiTop}>

                  <span style={styles.kpiLabel}>
                    Vendor Records
                  </span>

                  <span style={styles.kpiIcon}>
                    ◉
                  </span>

                </div>

                <div style={styles.kpiValue}>
                  {vendorRows.length}
                </div>

                <div style={styles.kpiHint}>
                  Vendors currently available
                </div>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.kpiTop}>

                  <span style={styles.kpiLabel}>
                    Reliable Vendors
                  </span>

                  <span style={styles.kpiIcon}>
                    ✓
                  </span>

                </div>

                <div style={styles.kpiValue}>
                  {reliableVendorCount}
                </div>

                <div style={styles.kpiHint}>
                  Vendors with reliability ≥ 80%
                </div>
              </div>

            </section>

            {/* EVALUATION COVERAGE */}

            <section style={styles.summaryCard}>

              <div style={styles.summaryLeft}>

                <div style={styles.summaryTitle}>
                  Vendor Performance
                </div>

                <div style={styles.summaryText}>
                  {evaluatedCount} of{" "}
                  {vendorRows.length} vendors
                  have performance data
                </div>

              </div>

              <div style={styles.summaryProgressArea}>

                <div style={styles.summaryProgressTop}>

                  <span>
                    Evaluation coverage
                  </span>

                  <strong>
                    {evaluationCoverage.toFixed(0)}%
                  </strong>

                </div>

                <div style={styles.progressTrack}>

                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${evaluationCoverage}%`,
                    }}
                  />

                </div>

              </div>

            </section>

            {/* TABLE */}

            <section style={styles.tableCard}>

              <div style={styles.tableHeader}>

                <div>

                  <h2 style={styles.tableTitle}>
                    Vendor Performance Records
                  </h2>

                  <p style={styles.tableSubtitle}>
                    Review delivery, quality,
                    communication, compliance and
                    reliability.
                  </p>

                </div>

                <div style={styles.recordCount}>
                  {filteredVendors.length} records
                </div>

              </div>

              {/* FILTERS */}

              <div style={styles.filterArea}>

                <div style={styles.filterGroup}>

                  <label style={styles.filterLabel}>
                    Category
                  </label>

                  <select
                    value={categoryFilter}
                    onChange={(event) =>
                      setCategoryFilter(
                        event.target.value
                      )
                    }
                    style={styles.select}
                  >
                    {CATEGORY_OPTIONS.map(
                      (category) => (
                        <option
                          key={category}
                          value={category}
                        >
                          {category}
                        </option>
                      )
                    )}
                  </select>

                </div>

                <div style={styles.filterGroupSearch}>

                  <label style={styles.filterLabel}>
                    Search
                  </label>

                  <input
                    type="text"
                    value={searchText}
                    onChange={(event) =>
                      setSearchText(
                        event.target.value
                      )
                    }
                    placeholder="Search vendor, ID or category..."
                    style={styles.searchInput}
                  />

                </div>

                <button
                  type="button"
                  style={styles.clearButton}
                  onClick={handleClearFilters}
                >
                  Clear
                </button>

              </div>

              {/* DATA */}

              {loading ? (

                <div style={styles.loadingState}>

                  <div style={styles.loadingSpinner}>
                    ↻
                  </div>

                  <div>
                    Loading vendor performance...
                  </div>

                </div>

              ) : filteredVendors.length === 0 ? (

                <div style={styles.emptyState}>

                  <div style={styles.emptyIcon}>
                    ◌
                  </div>

                  <div style={styles.emptyTitle}>
                    No vendor records found
                  </div>

                  <div style={styles.emptyText}>
                    Try changing the category
                    or search filter.
                  </div>

                </div>

              ) : (

                <div style={styles.tableWrapper}>

                  <table style={styles.table}>

                    <colgroup>

                      <col style={{ width: "22%" }} />

                      <col style={{ width: "14%" }} />

                      <col style={{ width: "10.67%" }} />

                      <col style={{ width: "10.67%" }} />

                      <col style={{ width: "10.67%" }} />

                      <col style={{ width: "10.67%" }} />

                      <col style={{ width: "10.67%" }} />

                      <col style={{ width: "10.67%" }} />

                    </colgroup>

                    <thead>

                      <tr>

                        <th style={styles.th}>
                          Vendor
                        </th>

                        <th style={styles.th}>
                          Category
                        </th>

                        <th style={styles.th}>
                          On-Time Delivery
                        </th>

                        <th style={styles.th}>
                          Quality
                        </th>

                        <th style={styles.th}>
                          Communication
                        </th>

                        <th style={styles.th}>
                          Compliance
                        </th>

                        <th style={styles.th}>
                          Reliability
                        </th>

                        <th style={styles.th}>
                          Overall
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {filteredVendors.map(
                        (vendor) => (

                          <tr
                            key={vendor.id}
                            style={styles.tr}
                          >

                            <td style={styles.vendorCell}>

                              <div style={styles.vendorId}>
                                Vendor ID {vendor.id}
                              </div>

                              <div style={styles.vendorName}>
                                {vendor.companyName}
                              </div>

                              <div style={styles.vendorContact}>
                                {vendor.contactPerson}
                              </div>

                            </td>

                            <td style={styles.td}>

                              <span
                                style={
                                  styles.categoryBadge
                                }
                              >
                                {vendor.category}
                              </span>

                            </td>

                            <td style={styles.td}>
                              <ScoreBadge
                                value={
                                  vendor.deliveryScore
                                }
                              />
                            </td>

                            <td style={styles.td}>
                              <ScoreBadge
                                value={
                                  vendor.qualityScore
                                }
                              />
                            </td>

                            <td style={styles.td}>
                              <ScoreBadge
                                value={
                                  vendor.communicationScore
                                }
                              />
                            </td>

                            <td style={styles.td}>
                              <ScoreBadge
                                value={
                                  vendor.complianceScore
                                }
                              />
                            </td>

                            <td style={styles.td}>
                              <ScoreBadge
                                value={
                                  vendor.reliabilityScore
                                }
                              />
                            </td>

                            <td style={styles.td}>
                              <ScoreBadge
                                value={
                                  vendor.overallScore
                                }
                              />
                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </section>

          </div>
        </section>

      </main>

    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    margin: 0,
    padding: 0,
    background: "#f5f7fb",
    color: "#172033",
    overflowX: "hidden",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    boxSizing: "border-box",
  },

  /* ================= MAIN ================= */

  main: {
    width: "100%",
    minWidth: 0,
    minHeight: "100vh",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  /* ================= TOPBAR ================= */

  topbar: {
    width: "100%",
    minHeight: "92px",
    background: "#ffffff",
    borderBottom: "1px solid #eaecf0",
    padding: "18px 32px",
    boxSizing: "border-box",
  },

  topbarInner: {
    width: "100%",
    maxWidth: "none",
    minHeight: "56px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "24px",
    boxSizing: "border-box",
  },

  breadcrumb: {
    fontSize: "11px",
    color: "#667085",
    marginBottom: "6px",
  },

  pageTitle: {
    margin: 0,
    fontSize: "24px",
    lineHeight: "1.2",
    fontWeight: "750",
    color: "#101828",
  },

  pageDescription: {
    margin: "6px 0 0",
    color: "#667085",
    fontSize: "12px",
  },

  topbarRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexShrink: 0,
  },

  refreshButton: {
    border: "1px solid #d0d5dd",
    background: "#ffffff",
    color: "#344054",
    borderRadius: "8px",
    padding: "9px 13px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },

  notification: {
    width: "34px",
    height: "34px",
    border: "1px solid #eaecf0",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "15px",
  },

  topAvatar: {
    width: "35px",
    height: "35px",
    borderRadius: "50%",
    background: "#e8eefc",
    color: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    fontSize: "13px",
  },

  /* ================= CONTENT ================= */

  content: {
    width: "100%",
    padding: "28px 32px 50px",
    boxSizing: "border-box",
  },

  contentInner: {
    width: "100%",
    maxWidth: "none",
    margin: "0 auto",
    boxSizing: "border-box",
  },

  /* ================= ERROR ================= */

  errorBox: {
    marginBottom: "18px",
    padding: "15px 18px",
    border: "1px solid #fecdca",
    background: "#fff6f6",
    borderRadius: "10px",
    boxSizing: "border-box",
  },

  errorTitle: {
    color: "#b42318",
    fontSize: "14px",
    fontWeight: "700",
    marginBottom: "5px",
  },

  errorText: {
    color: "#912018",
    fontSize: "12px",
  },

  loginButton: {
    marginTop: "12px",
    border: 0,
    borderRadius: "7px",
    background: "#dc2626",
    color: "#ffffff",
    padding: "9px 14px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },

  /* ================= KPI ================= */

  kpiGrid: {
    width: "100%",
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "16px",
    boxSizing: "border-box",
  },

  kpiCard: {
    width: "100%",
    minWidth: 0,
    background: "#ffffff",
    border: "1px solid #eaecf0",
    borderRadius: "12px",
    padding: "18px",
    boxSizing: "border-box",
    boxShadow:
      "0 1px 2px rgba(16, 24, 40, 0.03)",
  },

  kpiTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },

  kpiLabel: {
    color: "#667085",
    fontSize: "12px",
    fontWeight: "600",
  },

  kpiIcon: {
    width: "27px",
    height: "27px",
    borderRadius: "7px",
    background: "#eff4ff",
    color: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    flexShrink: 0,
  },

  kpiValue: {
    marginTop: "13px",
    fontSize: "25px",
    fontWeight: "750",
    color: "#101828",
  },

  kpiHint: {
    marginTop: "6px",
    fontSize: "10px",
    color: "#98a2b3",
    lineHeight: "1.4",
  },

  /* ================= SUMMARY ================= */

  summaryCard: {
    width: "100%",
    marginTop: "16px",
    background: "#ffffff",
    border: "1px solid #eaecf0",
    borderRadius: "12px",
    padding: "17px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "30px",
    boxSizing: "border-box",
  },

  summaryLeft: {
    minWidth: 0,
    flex: 1,
  },

  summaryTitle: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#101828",
  },

  summaryText: {
    marginTop: "5px",
    fontSize: "11px",
    color: "#667085",
  },

  summaryProgressArea: {
    width: "40%",
    minWidth: "220px",
    maxWidth: "430px",
  },

  summaryProgressTop: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "10px",
    color: "#667085",
    marginBottom: "7px",
  },

  progressTrack: {
    width: "100%",
    height: "7px",
    background: "#eaecf0",
    borderRadius: "99px",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    background: "#2563eb",
    borderRadius: "99px",
    transition: "width 0.3s ease",
  },

  /* ================= TABLE ================= */

  tableCard: {
    width: "100%",
    maxWidth: "100%",
    marginTop: "16px",
    background: "#ffffff",
    border: "1px solid #eaecf0",
    borderRadius: "12px",
    overflow: "hidden",
    boxSizing: "border-box",
    boxShadow:
      "0 1px 2px rgba(16, 24, 40, 0.03)",
  },

  tableHeader: {
    padding: "18px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    borderBottom: "1px solid #eaecf0",
    boxSizing: "border-box",
  },

  tableTitle: {
    margin: 0,
    color: "#101828",
    fontSize: "15px",
    fontWeight: "700",
  },

  tableSubtitle: {
    margin: "5px 0 0",
    color: "#667085",
    fontSize: "11px",
  },

  recordCount: {
    color: "#475467",
    background: "#f2f4f7",
    borderRadius: "20px",
    padding: "6px 10px",
    fontSize: "10px",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },

  /* ================= FILTERS ================= */

  filterArea: {
    display: "flex",
    alignItems: "flex-end",
    gap: "12px",
    padding: "15px 20px",
    background: "#fcfcfd",
    borderBottom: "1px solid #eaecf0",
    flexWrap: "wrap",
    boxSizing: "border-box",
  },

  filterGroup: {
    width: "220px",
    minWidth: 0,
  },

  filterGroupSearch: {
    width: "300px",
    minWidth: 0,
  },

  filterLabel: {
    display: "block",
    fontSize: "10px",
    fontWeight: "700",
    color: "#475467",
    marginBottom: "6px",
  },

  select: {
    width: "100%",
    height: "37px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#344054",
    padding: "0 10px",
    fontSize: "12px",
    outline: "none",
    boxSizing: "border-box",
  },

  searchInput: {
    width: "100%",
    height: "37px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#344054",
    padding: "0 11px",
    fontSize: "12px",
    outline: "none",
    boxSizing: "border-box",
  },

  clearButton: {
    height: "37px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#344054",
    padding: "0 14px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
    boxSizing: "border-box",
  },

  /* ================= TABLE BODY ================= */

  tableWrapper: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    boxSizing: "border-box",
  },

  table: {
    width: "100%",
    minWidth: "1050px",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },

  th: {
    background: "#f9fafb",
    color: "#667085",
    fontSize: "10px",
    fontWeight: "700",
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #eaecf0",
    whiteSpace: "normal",
    verticalAlign: "middle",
    boxSizing: "border-box",
  },

  tr: {
    borderBottom: "1px solid #f2f4f7",
  },

  td: {
    padding: "13px 10px",
    color: "#344054",
    fontSize: "11px",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
    boxSizing: "border-box",
    overflow: "hidden",
  },

  vendorCell: {
    padding: "13px 14px",
    minWidth: 0,
    verticalAlign: "middle",
    boxSizing: "border-box",
    overflow: "hidden",
  },

  vendorId: {
    fontSize: "9px",
    color: "#98a2b3",
    marginBottom: "3px",
  },

  vendorName: {
    fontSize: "12px",
    color: "#101828",
    fontWeight: "700",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  vendorContact: {
    marginTop: "3px",
    color: "#667085",
    fontSize: "9px",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  categoryBadge: {
    display: "inline-block",
    maxWidth: "100%",
    background: "#f2f4f7",
    color: "#475467",
    borderRadius: "6px",
    padding: "5px 7px",
    fontSize: "9px",
    fontWeight: "600",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  },

  scoreBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "62px",
    padding: "5px 6px",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: "700",
    boxSizing: "border-box",
  },

  scoreGood: {
    background: "#ecfdf3",
    color: "#027a48",
  },

  scoreMedium: {
    background: "#fffaeb",
    color: "#b54708",
  },

  scoreLow: {
    background: "#fff1f3",
    color: "#c01048",
  },

  scoreNone: {
    background: "#f2f4f7",
    color: "#667085",
  },

  /* ================= STATES ================= */

  loadingState: {
    minHeight: "260px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    color: "#667085",
    fontSize: "12px",
  },

  loadingSpinner: {
    fontSize: "25px",
    color: "#2563eb",
  },

  emptyState: {
    minHeight: "260px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "30px",
  },

  emptyIcon: {
    fontSize: "34px",
    color: "#98a2b3",
  },

  emptyTitle: {
    marginTop: "8px",
    fontSize: "14px",
    fontWeight: "700",
    color: "#344054",
  },

  emptyText: {
    marginTop: "5px",
    fontSize: "11px",
    color: "#98a2b3",
  },
};