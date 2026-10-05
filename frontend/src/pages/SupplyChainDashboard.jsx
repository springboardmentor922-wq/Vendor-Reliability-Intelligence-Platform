import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

const MENU_ITEMS = [
  "Dashboard",
  "Suppliers",
  "Purchase Orders",
  "Deliveries",
  "Delayed Deliveries",
  "Performance",
  "Risk",
];

function getToken() {
  const keys = [
    "access_token",
    "token",
    "authToken",
    "jwt_token",
  ];

  for (const key of keys) {
    const localToken = localStorage.getItem(key);

    if (localToken) {
      return localToken;
    }

    const sessionToken = sessionStorage.getItem(key);

    if (sessionToken) {
      return sessionToken;
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

function getHeaders() {
  const token = getToken();

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

async function fetchData(endpoint) {
  const token = getToken();

  if (!token) {
    throw new Error("No login token found. Please login again.");
  }

  let response;

  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      method: "GET",
      headers: getHeaders(),
    });
  } catch (error) {
    throw new Error(
      "Cannot connect to backend. Please make sure FastAPI is running."
    );
  }

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

  try {
    return await response.json();
  } catch {
    throw new Error("Backend returned an invalid response.");
  }
}

function asArray(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

function numberValue(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(
    numberValue(value)
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function formatPercentage(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "No data";
  }

  return `${Number(value).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getToday() {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

function isDelivered(order) {
  return (
    String(order?.status || "").toLowerCase() === "delivered"
  );
}

function isCancelled(order) {
  return (
    String(order?.status || "").toLowerCase() === "cancelled"
  );
}

function isDelayed(order) {
  if (!order || isDelivered(order) || isCancelled(order)) {
    return false;
  }

  const expected = order.expected_delivery_date;

  if (!expected) {
    return false;
  }

  const expectedDate = new Date(expected);
  expectedDate.setHours(0, 0, 0, 0);

  const actual = order.actual_delivery_date;

  if (actual) {
    const actualDate = new Date(actual);
    actualDate.setHours(0, 0, 0, 0);

    return actualDate > expectedDate;
  }

  return expectedDate < getToday();
}

function isOnTime(order) {
  if (!isDelivered(order)) {
    return false;
  }

  if (
    !order.expected_delivery_date ||
    !order.actual_delivery_date
  ) {
    return false;
  }

  const expected = new Date(order.expected_delivery_date);
  const actual = new Date(order.actual_delivery_date);

  expected.setHours(0, 0, 0, 0);
  actual.setHours(0, 0, 0, 0);

  return actual <= expected;
}

function getDeliveryStatus(order) {
  const status = String(order?.status || "").toLowerCase();

  if (status === "delivered") {
    return "Delivered";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  if (isDelayed(order)) {
    return "Delayed";
  }

  if (status === "shipped") {
    return "In Transit";
  }

  if (status === "approved") {
    return "Approved";
  }

  if (status === "pending") {
    return "Pending";
  }

  return status
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : "Unknown";
}

function getStatusStyle(status) {
  const value = String(status || "").toLowerCase();

  if (value === "delivered") {
    return styles.statusDelivered;
  }

  if (value === "delayed") {
    return styles.statusDelayed;
  }

  if (value === "cancelled") {
    return styles.statusCancelled;
  }

  if (
    value === "in transit" ||
    value === "shipped"
  ) {
    return styles.statusTransit;
  }

  if (
    value === "approved" ||
    value === "pending"
  ) {
    return styles.statusPending;
  }

  return styles.statusDefault;
}

function getReliability(vendor) {
  const value = Number(vendor?.reliability_score);

  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
}

function getRiskLabel(score) {
  if (score === null || score === undefined) {
    return "No Data";
  }

  if (score >= 80) {
    return "Low";
  }

  if (score >= 60) {
    return "Medium";
  }

  return "High";
}

function getRiskStyle(risk) {
  if (risk === "Low") {
    return styles.riskLow;
  }

  if (risk === "Medium") {
    return styles.riskMedium;
  }

  if (risk === "High") {
    return styles.riskHigh;
  }

  return styles.riskNone;
}

function getSupplierName(supplierId, suppliers) {
  if (
    supplierId === null ||
    supplierId === undefined ||
    supplierId === ""
  ) {
    return "Not assigned";
  }

  const supplier = suppliers.find(
    (item) => Number(item.id) === Number(supplierId)
  );

  if (!supplier) {
    return `Supplier #${supplierId}`;
  }

  return (
    supplier.company_name ||
    supplier.name ||
    supplier.supplier_name ||
    `Supplier #${supplierId}`
  );
}

function KpiCard({
  icon,
  title,
  value,
  subtitle,
  accent = "blue",
}) {
  return (
    <div style={styles.kpiCard}>
      <div
        style={{
          ...styles.kpiIcon,
          ...(accent === "teal"
            ? styles.kpiIconTeal
            : accent === "orange"
            ? styles.kpiIconOrange
            : accent === "red"
            ? styles.kpiIconRed
            : styles.kpiIconBlue),
        }}
      >
        {icon}
      </div>

      <div style={styles.kpiContent}>
        <p style={styles.kpiLabel}>{title}</p>

        <h2 style={styles.kpiValue}>{value}</h2>

        <span style={styles.kpiSubtitle}>{subtitle}</span>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  count,
  max = 100,
}) {
  const safeValue = Math.max(
    0,
    Math.min(numberValue(value), max)
  );

  const percentage =
    max > 0 ? (safeValue / max) * 100 : 0;

  return (
    <div style={styles.progressRow}>
      <div style={styles.progressHeader}>
        <span>{label}</span>

        <strong>
          {count !== undefined
            ? `${formatNumber(count)}`
            : `${safeValue.toFixed(1)}%`}
        </strong>
      </div>

      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressFill,
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

function SupplyChainDashboard() {
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [performance, setPerformance] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [lastUpdated, setLastUpdated] = useState(null);

  async function loadDashboard(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const results = await Promise.allSettled([
        fetchData("/suppliers"),
        fetchData("/purchase-orders"),
        fetchData("/performance"),
      ]);

      const supplierResult = results[0];
      const orderResult = results[1];
      const performanceResult = results[2];

      if (supplierResult.status === "fulfilled") {
        setSuppliers(
          asArray(supplierResult.value)
        );
      } else {
        setSuppliers([]);
      }

      if (orderResult.status === "fulfilled") {
        setOrders(
          asArray(orderResult.value)
        );
      } else {
        throw orderResult.reason;
      }

      if (performanceResult.status === "fulfilled") {
        setPerformance(
          asArray(performanceResult.value)
        );
      } else {
        setPerformance([]);
      }

      setLastUpdated(new Date());
    } catch (loadError) {
      setError(
        loadError?.message ||
          "Unable to load Supply Chain dashboard data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const metrics = useMemo(() => {
    const validOrders = orders.filter(
      (order) => !isCancelled(order)
    );

    const delivered = orders.filter(isDelivered);

    const delayed = orders.filter(isDelayed);

    const activeDeliveries = orders.filter(
      (order) =>
        !isDelivered(order) &&
        !isCancelled(order)
    );

    const approved = orders.filter(
      (order) =>
        String(order?.status || "").toLowerCase() ===
        "approved"
    );

    const pending = orders.filter(
      (order) =>
        String(order?.status || "").toLowerCase() ===
        "pending"
    );

    const shipped = orders.filter(
      (order) =>
        String(order?.status || "").toLowerCase() ===
        "shipped"
    );

    const onTime = delivered.filter(isOnTime);

    const measurableDeliveries = delivered.filter(
      (order) =>
        order.expected_delivery_date &&
        order.actual_delivery_date
    );

    const onTimeRate =
      measurableDeliveries.length > 0
        ? (onTime.length / measurableDeliveries.length) *
          100
        : null;

    const completionRate =
      validOrders.length > 0
        ? (delivered.length / validOrders.length) * 100
        : 0;

    const totalValue = orders.reduce(
      (sum, order) =>
        sum + numberValue(order.total_amount),
      0
    );

    const deliveredValue = delivered.reduce(
      (sum, order) =>
        sum + numberValue(order.total_amount),
      0
    );

    const activeSuppliers = suppliers.filter(
      (supplier) => {
        const status = String(
          supplier?.supplier_status ||
            supplier?.status ||
            ""
        ).toLowerCase();

        return status === "active";
      }
    );

    const uniqueSupplierIds = new Set(
      orders
        .map((order) => order.supplier_id)
        .filter(
          (id) =>
            id !== null &&
            id !== undefined &&
            id !== ""
        )
    );

    const supplierCount =
      activeSuppliers.length > 0
        ? activeSuppliers.length
        : uniqueSupplierIds.size;

    const reliabilityValues = performance
      .map((item) => {
        const score = Number(
          item?.reliability_score ??
            item?.overall_score ??
            item?.overallScore
        );

        return Number.isFinite(score)
          ? score
          : null;
      })
      .filter((score) => score !== null);

    const averageReliability =
      reliabilityValues.length > 0
        ? reliabilityValues.reduce(
            (sum, score) => sum + score,
            0
          ) / reliabilityValues.length
        : null;

    return {
      totalOrders: orders.length,
      activeDeliveries: activeDeliveries.length,
      expectedDeliveries: activeDeliveries.filter(
        (order) =>
          order.expected_delivery_date &&
          !isDelayed(order)
      ).length,
      delayedDeliveries: delayed.length,
      delivered: delivered.length,
      approved: approved.length,
      pending: pending.length,
      shipped: shipped.length,
      onTimeRate,
      completionRate,
      totalValue,
      deliveredValue,
      supplierCount,
      activeSuppliers: activeSuppliers.length,
      averageReliability,
      measurableDeliveries:
        measurableDeliveries.length,
    };
  }, [orders, suppliers, performance]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...orders]
      .filter((order) => {
        const status = getDeliveryStatus(order);

        if (
          statusFilter !== "All" &&
          status !== statusFilter
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        const supplierName = getSupplierName(
          order.supplier_id,
          suppliers
        );

        const searchableText = [
          order.order_number,
          order.vendor_name,
          supplierName,
          order.status,
          status,
          order.vendor_id,
          order.supplier_id,
        ]
          .filter(
            (value) =>
              value !== null &&
              value !== undefined
          )
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      })
      .sort((a, b) => {
        const dateA = new Date(
          a.created_at ||
            a.order_date ||
            a.expected_delivery_date ||
            0
        ).getTime();

        const dateB = new Date(
          b.created_at ||
            b.order_date ||
            b.expected_delivery_date ||
            0
        ).getTime();

        return dateB - dateA;
      });
  }, [orders, suppliers, search, statusFilter]);

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => {
        const dateA = new Date(
          a.created_at ||
            a.order_date ||
            0
        ).getTime();

        const dateB = new Date(
          b.created_at ||
            b.order_date ||
            0
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 6);
  }, [orders]);

  const supplierPerformance = useMemo(() => {
    const map = new Map();

    performance.forEach((item) => {
      const vendorId =
        item?.vendor_id ??
        item?.vendorId;

      const score = Number(
        item?.reliability_score ??
          item?.overall_score ??
          item?.overallScore
      );

      if (
        vendorId !== null &&
        vendorId !== undefined &&
        Number.isFinite(score)
      ) {
        map.set(Number(vendorId), score);
      }
    });

    return Array.from(map.entries())
      .map(([vendorId, score]) => ({
        vendorId,
        score,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [performance]);

  const riskSummary = useMemo(() => {
    let low = 0;
    let medium = 0;
    let high = 0;

    performance.forEach((item) => {
      const score = Number(
        item?.reliability_score ??
          item?.overall_score ??
          item?.overallScore
      );

      if (!Number.isFinite(score)) {
        return;
      }

      if (score >= 80) {
        low += 1;
      } else if (score >= 60) {
        medium += 1;
      } else {
        high += 1;
      }
    });

    return {
      low,
      medium,
      high,
    };
  }, [performance]);

  return (
    <DashboardLayout
      title="Supply Chain Dashboard"
      role="Supply Chain Manager"
      menuItems={MENU_ITEMS}
    >
      <div style={styles.page}>
        {/* HEADER */}
        <div style={styles.topHeader}>
          <div>
            <p style={styles.eyebrow}>
              SUPPLY CHAIN MANAGEMENT
            </p>

            <h1 style={styles.pageTitle}>
              Supply Chain Overview
            </h1>

            <p style={styles.pageDescription}>
              Monitor suppliers, purchase orders,
              deliveries and supply chain risks from
              one place.
            </p>
          </div>

          <button
            type="button"
            style={styles.refreshButton}
            onClick={() => loadDashboard(true)}
            disabled={loading || refreshing}
          >
            <span
              style={
                refreshing
                  ? styles.refreshIconSpin
                  : styles.refreshIcon
              }
            >
              ↻
            </span>

            {refreshing
              ? "Refreshing..."
              : "Refresh Data"}
          </button>
        </div>

        {/* LAST UPDATED */}
        <div style={styles.updateBar}>
          <span style={styles.liveDot} />

          <span>
            Live backend data
          </span>

          <span style={styles.updateSeparator}>
            •
          </span>

          <span>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString(
                  "en-IN",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}`
              : "Loading latest data"}
          </span>
        </div>

        {/* ERROR */}
        {error && (
          <div style={styles.errorBox}>
            <div>
              <strong>
                Unable to load dashboard data
              </strong>

              <p style={styles.errorText}>
                {error}
              </p>
            </div>

            <button
              type="button"
              style={styles.retryButton}
              onClick={() => loadDashboard()}
            >
              Retry
            </button>
          </div>
        )}

        {/* LOADING */}
        {loading ? (
          <div style={styles.loadingCard}>
            <div style={styles.spinner} />

            <h3 style={styles.loadingTitle}>
              Loading Supply Chain Dashboard
            </h3>

            <p style={styles.loadingText}>
              Fetching suppliers, purchase orders and
              delivery performance...
            </p>
          </div>
        ) : (
          <>
            {/* KPI CARDS */}
            <div style={styles.statsGrid}>
              <KpiCard
                icon="🚛"
                title="Active Deliveries"
                value={formatNumber(
                  metrics.activeDeliveries
                )}
                subtitle={`${formatNumber(
                  metrics.shipped
                )} currently shipped`}
                accent="blue"
              />

              <KpiCard
                icon="📅"
                title="Expected Deliveries"
                value={formatNumber(
                  metrics.expectedDeliveries
                )}
                subtitle="Upcoming and on track"
                accent="teal"
              />

              <KpiCard
                icon="⏱"
                title="Delayed Deliveries"
                value={formatNumber(
                  metrics.delayedDeliveries
                )}
                subtitle={
                  metrics.delayedDeliveries > 0
                    ? "Requires follow-up"
                    : "No delayed deliveries"
                }
                accent={
                  metrics.delayedDeliveries > 0
                    ? "red"
                    : "teal"
                }
              />

              <KpiCard
                icon="🏢"
                title="Active Suppliers"
                value={formatNumber(
                  metrics.supplierCount
                )}
                subtitle={`${formatNumber(
                  metrics.totalOrders
                )} total purchase orders`}
                accent="blue"
              />
            </div>

            {/* PERFORMANCE OVERVIEW */}
            <div style={styles.twoColumnGrid}>
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.cardTitle}>
                      Delivery Performance
                    </h3>

                    <p style={styles.cardSubtitle}>
                      Delivery execution based on
                      completed purchase orders
                    </p>
                  </div>

                  <div style={styles.headerIcon}>
                    📊
                  </div>
                </div>

                <div style={styles.metricBlock}>
                  <div style={styles.metricHeader}>
                    <span>
                      On-Time Delivery
                    </span>

                    <strong>
                      {formatPercentage(
                        metrics.onTimeRate
                      )}
                    </strong>
                  </div>

                  <div style={styles.progressTrackLarge}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${
                          metrics.onTimeRate === null
                            ? 0
                            : Math.min(
                                metrics.onTimeRate,
                                100
                              )
                        }%`,
                      }}
                    />
                  </div>

                  <p style={styles.metricHint}>
                    {metrics.measurableDeliveries} completed
                    deliveries with measurable dates
                  </p>
                </div>

                <div style={styles.metricBlock}>
                  <div style={styles.metricHeader}>
                    <span>
                      Order Completion
                    </span>

                    <strong>
                      {formatPercentage(
                        metrics.completionRate
                      )}
                    </strong>
                  </div>

                  <div style={styles.progressTrackLarge}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${Math.min(
                          metrics.completionRate,
                          100
                        )}%`,
                      }}
                    />
                  </div>

                  <p style={styles.metricHint}>
                    Delivered orders excluding cancelled
                    orders
                  </p>
                </div>

                <div style={styles.performanceStats}>
                  <div style={styles.miniStat}>
                    <span>Delivered</span>

                    <strong>
                      {formatNumber(
                        metrics.delivered
                      )}
                    </strong>
                  </div>

                  <div style={styles.miniStat}>
                    <span>Delayed</span>

                    <strong>
                      {formatNumber(
                        metrics.delayedDeliveries
                      )}
                    </strong>
                  </div>

                  <div style={styles.miniStat}>
                    <span>Cancelled</span>

                    <strong>
                      {formatNumber(
                        orders.filter(
                          isCancelled
                        ).length
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              {/* PROCUREMENT STATUS */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.cardTitle}>
                      Order Status Overview
                    </h3>

                    <p style={styles.cardSubtitle}>
                      Current purchase order distribution
                    </p>
                  </div>

                  <div style={styles.headerIcon}>
                    📦
                  </div>
                </div>

                <ProgressRow
                  label="Delivered"
                  count={metrics.delivered}
                  value={
                    metrics.totalOrders > 0
                      ? (metrics.delivered /
                          metrics.totalOrders) *
                        100
                      : 0
                  }
                />

                <ProgressRow
                  label="In Transit"
                  count={metrics.shipped}
                  value={
                    metrics.totalOrders > 0
                      ? (metrics.shipped /
                          metrics.totalOrders) *
                        100
                      : 0
                  }
                />

                <ProgressRow
                  label="Approved"
                  count={metrics.approved}
                  value={
                    metrics.totalOrders > 0
                      ? (metrics.approved /
                          metrics.totalOrders) *
                        100
                      : 0
                  }
                />

                <ProgressRow
                  label="Pending"
                  count={metrics.pending}
                  value={
                    metrics.totalOrders > 0
                      ? (metrics.pending /
                          metrics.totalOrders) *
                        100
                      : 0
                  }
                />

                <div style={styles.totalValueBox}>
                  <div>
                    <span style={styles.totalValueLabel}>
                      Total PO Value
                    </span>

                    <strong style={styles.totalValue}>
                      {formatCurrency(
                        metrics.totalValue
                      )}
                    </strong>
                  </div>

                  <div style={styles.valueIcon}>
                    ₹
                  </div>
                </div>
              </div>
            </div>

            {/* SUPPLIER + RISK */}
            <div style={styles.twoColumnGrid}>
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.cardTitle}>
                      Supplier Performance
                    </h3>

                    <p style={styles.cardSubtitle}>
                      Reliability data available from the
                      performance module
                    </p>
                  </div>

                  <span style={styles.scoreBadge}>
                    {formatPercentage(
                      metrics.averageReliability
                    )}{" "}
                    Avg.
                  </span>
                </div>

                {supplierPerformance.length === 0 ? (
                  <EmptyState
                    icon="📊"
                    message="No supplier performance data available yet."
                  />
                ) : (
                  <div>
                    {supplierPerformance.map(
                      (item) => {
                        const risk = getRiskLabel(
                          item.score
                        );

                        return (
                          <div
                            key={item.vendorId}
                            style={styles.supplierRow}
                          >
                            <div
                              style={
                                styles.supplierInfo
                              }
                            >
                              <div
                                style={
                                  styles.supplierAvatar
                                }
                              >
                                {String(
                                  item.vendorId
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </div>

                              <div>
                                <strong
                                  style={
                                    styles.supplierName
                                  }
                                >
                                  Vendor #
                                  {item.vendorId}
                                </strong>

                                <span
                                  style={
                                    styles.supplierMeta
                                  }
                                >
                                  Reliability score
                                </span>
                              </div>
                            </div>

                            <div
                              style={
                                styles.supplierScore
                              }
                            >
                              <strong>
                                {formatPercentage(
                                  item.score
                                )}
                              </strong>

                              <span
                                style={getRiskStyle(
                                  risk
                                )}
                              >
                                {risk} Risk
                              </span>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>

              {/* RISK SUMMARY */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.cardTitle}>
                      Supply Chain Risk
                    </h3>

                    <p style={styles.cardSubtitle}>
                      Reliability-based risk distribution
                    </p>
                  </div>

                  <div style={styles.headerIcon}>
                    🛡
                  </div>
                </div>

                <div style={styles.riskGrid}>
                  <div style={styles.riskCardLow}>
                    <span>Low Risk</span>

                    <strong>
                      {formatNumber(
                        riskSummary.low
                      )}
                    </strong>
                  </div>

                  <div style={styles.riskCardMedium}>
                    <span>Medium Risk</span>

                    <strong>
                      {formatNumber(
                        riskSummary.medium
                      )}
                    </strong>
                  </div>

                  <div style={styles.riskCardHigh}>
                    <span>High Risk</span>

                    <strong>
                      {formatNumber(
                        riskSummary.high
                      )}
                    </strong>
                  </div>
                </div>

                <div style={styles.riskNotice}>
                  <span style={styles.noticeIcon}>
                    !
                  </span>

                  <div>
                    <strong>
                      Monitoring required
                    </strong>

                    <p>
                      Delayed deliveries and low
                      reliability scores should be reviewed
                      by the supply chain team.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* DELIVERY TRACKING */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>
                    Delivery Tracking
                  </h3>

                  <p style={styles.cardSubtitle}>
                    Live purchase order delivery status
                  </p>
                </div>

                <span style={styles.countBadge}>
                  {formatNumber(
                    filteredOrders.length
                  )}{" "}
                  Records
                </span>
              </div>

              {/* FILTERS */}
              <div style={styles.filterBar}>
                <div style={styles.searchBox}>
                  <span style={styles.searchIcon}>
                    🔎
                  </span>

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search PO, vendor or supplier..."
                    style={styles.searchInput}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  style={styles.select}
                >
                  <option value="All">
                    All Statuses
                  </option>
                  <option value="Delivered">
                    Delivered
                  </option>
                  <option value="Delayed">
                    Delayed
                  </option>
                  <option value="In Transit">
                    In Transit
                  </option>
                  <option value="Approved">
                    Approved
                  </option>
                  <option value="Pending">
                    Pending
                  </option>
                  <option value="Cancelled">
                    Cancelled
                  </option>
                </select>
              </div>

              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>
                        PO Number
                      </th>

                      <th style={styles.th}>
                        Vendor
                      </th>

                      <th style={styles.th}>
                        Supplier
                      </th>

                      <th style={styles.th}>
                        Expected Date
                      </th>

                      <th style={styles.th}>
                        Actual Date
                      </th>

                      <th style={styles.th}>
                        Amount
                      </th>

                      <th style={styles.th}>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td
                          colSpan="7"
                          style={
                            styles.emptyTableCell
                          }
                        >
                          No purchase orders match the
                          selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const status =
                          getDeliveryStatus(
                            order
                          );

                        return (
                          <tr key={order.id}>
                            <td style={styles.td}>
                              <strong
                                style={
                                  styles.orderNumber
                                }
                              >
                                {order.order_number ||
                                  `PO-${order.id}`}
                              </strong>
                            </td>

                            <td style={styles.td}>
                              <div
                                style={
                                  styles.vendorCell
                                }
                              >
                                <span
                                  style={
                                    styles.vendorDot
                                  }
                                />

                                <span>
                                  {order.vendor_name ||
                                    `Vendor #${order.vendor_id}`}
                                </span>
                              </div>
                            </td>

                            <td style={styles.td}>
                              {getSupplierName(
                                order.supplier_id,
                                suppliers
                              )}
                            </td>

                            <td style={styles.td}>
                              {formatDate(
                                order.expected_delivery_date
                              )}
                            </td>

                            <td style={styles.td}>
                              {formatDate(
                                order.actual_delivery_date
                              )}
                            </td>

                            <td style={styles.td}>
                              {formatCurrency(
                                order.total_amount
                              )}
                            </td>

                            <td style={styles.td}>
                              <span
                                style={getStatusStyle(
                                  status
                                )}
                              >
                                <span
                                  style={
                                    styles.statusDot
                                  }
                                />

                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BOTTOM SECTION */}
            <div style={styles.twoColumnGrid}>
              {/* RECENT ACTIVITY */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.cardTitle}>
                      Recent Supply Chain Activity
                    </h3>

                    <p style={styles.cardSubtitle}>
                      Latest purchase order movements
                    </p>
                  </div>
                </div>

                {recentOrders.length === 0 ? (
                  <EmptyState
                    icon="📋"
                    message="No recent purchase order activity."
                  />
                ) : (
                  <div style={styles.activityList}>
                    {recentOrders.map((order) => {
                      const status =
                        getDeliveryStatus(order);

                      return (
                        <div
                          key={order.id}
                          style={styles.activityItem}
                        >
                          <div
                            style={
                              styles.activityIcon
                            }
                          >
                            {status === "Delivered"
                              ? "✓"
                              : status === "Delayed"
                              ? "!"
                              : status ===
                                "Cancelled"
                              ? "×"
                              : "→"}
                          </div>

                          <div
                            style={
                              styles.activityContent
                            }
                          >
                            <strong>
                              {order.order_number ||
                                `PO-${order.id}`}
                            </strong>

                            <span>
                              {order.vendor_name ||
                                `Vendor #${order.vendor_id}`}
                            </span>
                          </div>

                          <div
                            style={
                              styles.activityRight
                            }
                          >
                            <span
                              style={getStatusStyle(
                                status
                              )}
                            >
                              {status}
                            </span>

                            <small>
                              {formatDate(
                                order.created_at ||
                                  order.order_date
                              )}
                            </small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ATTENTION */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.cardTitle}>
                      Attention Required
                    </h3>

                    <p style={styles.cardSubtitle}>
                      Items that may require supply chain
                      follow-up
                    </p>
                  </div>

                  <div style={styles.headerIcon}>
                    ⚠
                  </div>
                </div>

                <div style={styles.attentionList}>
                  {metrics.delayedDeliveries > 0 ? (
                    <div style={styles.attentionDanger}>
                      <div
                        style={
                          styles.attentionIconDanger
                        }
                      >
                        ⏱
                      </div>

                      <div>
                        <strong>
                          {formatNumber(
                            metrics.delayedDeliveries
                          )}{" "}
                          Delayed Deliveries
                        </strong>

                        <p>
                          Review overdue purchase orders
                          and follow up with the responsible
                          vendor or supplier.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div style={styles.attentionSuccess}>
                      <div
                        style={
                          styles.attentionIconSuccess
                        }
                      >
                        ✓
                      </div>

                      <div>
                        <strong>
                          No Delayed Deliveries
                        </strong>

                        <p>
                          There are currently no delivery
                          records that meet the delayed
                          criteria.
                        </p>
                      </div>
                    </div>
                  )}

                  <div style={styles.attentionInfo}>
                    <div
                      style={
                        styles.attentionIconInfo
                      }
                    >
                      📦
                    </div>

                    <div>
                      <strong>
                        {formatNumber(
                          metrics.activeDeliveries
                        )}{" "}
                        Active Deliveries
                      </strong>

                      <p>
                        Purchase orders are still in
                        progress and require delivery
                        monitoring.
                      </p>
                    </div>
                  </div>

                  <div style={styles.attentionNeutral}>
                    <div
                      style={
                        styles.attentionIconNeutral
                      }
                    >
                      ₹
                    </div>

                    <div>
                      <strong>
                        Delivered Value
                      </strong>

                      <p>
                        {formatCurrency(
                          metrics.deliveredValue
                        )}{" "}
                        worth of purchase orders have been
                        delivered.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>{icon}</div>

      <p>{message}</p>
    </div>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    color: "#172033",
  },

  topHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "20px",
    flexWrap: "wrap",
  },

  eyebrow: {
    margin: 0,
    color: "#137388",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "1.2px",
  },

  pageTitle: {
    margin: "5px 0 4px",
    color: "#142338",
    fontSize: "28px",
    fontWeight: 700,
  },

  pageDescription: {
    margin: 0,
    color: "#7b8495",
    fontSize: "14px",
    lineHeight: 1.6,
  },

  refreshButton: {
    border: "1px solid #dfe4eb",
    background: "#ffffff",
    color: "#123f61",
    borderRadius: "10px",
    padding: "11px 16px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    boxShadow: "0 2px 8px rgba(11,31,58,0.04)",
  },

  refreshIcon: {
    fontSize: "18px",
    lineHeight: 1,
  },

  refreshIconSpin: {
    fontSize: "18px",
    lineHeight: 1,
    display: "inline-block",
    animation: "spin 1s linear infinite",
  },

  updateBar: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    color: "#7b8495",
    fontSize: "12px",
  },

  liveDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#137388",
    display: "inline-block",
  },

  updateSeparator: {
    color: "#c7ccd5",
  },

  errorBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    background: "#fff5f5",
    border: "1px solid #f1d5d5",
    borderRadius: "12px",
    padding: "14px 16px",
    color: "#9f3030",
  },

  errorText: {
    margin: "4px 0 0",
    fontSize: "13px",
  },

  retryButton: {
    border: "1px solid #d7a4a4",
    background: "#ffffff",
    color: "#9f3030",
    borderRadius: "8px",
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },

  loadingCard: {
    background: "#ffffff",
    border: "1px solid #e8ebf1",
    borderRadius: "16px",
    minHeight: "320px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 4px 18px rgba(11,31,58,0.04)",
  },

  spinner: {
    width: "32px",
    height: "32px",
    border: "3px solid #edf7f9",
    borderTop: "3px solid #137388",
    borderRadius: "50%",
    marginBottom: "14px",
  },

  loadingTitle: {
    margin: 0,
    color: "#142338",
    fontSize: "17px",
  },

  loadingText: {
    margin: "7px 0 0",
    color: "#7b8495",
    fontSize: "13px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "16px",
  },

  kpiCard: {
    background: "#ffffff",
    border: "1px solid #e8ebf1",
    borderRadius: "14px",
    padding: "18px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    minWidth: 0,
    boxShadow:
      "0 4px 16px rgba(11,31,58,0.035)",
  },

  kpiIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "21px",
    flexShrink: 0,
  },

  kpiIconBlue: {
    background: "#edf4f8",
  },

  kpiIconTeal: {
    background: "#edf7f9",
  },

  kpiIconOrange: {
    background: "#fff7ed",
  },

  kpiIconRed: {
    background: "#fff1f1",
  },

  kpiContent: {
    minWidth: 0,
  },

  kpiLabel: {
    margin: 0,
    color: "#7b8495",
    fontSize: "12px",
    fontWeight: 500,
  },

  kpiValue: {
    margin: "4px 0",
    color: "#142338",
    fontSize: "25px",
    lineHeight: 1.1,
    fontWeight: 700,
  },

  kpiSubtitle: {
    color: "#98a1af",
    fontSize: "10px",
  },

  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "18px",
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e8ebf1",
    borderRadius: "15px",
    padding: "20px",
    boxShadow:
      "0 4px 18px rgba(11,31,58,0.035)",
    minWidth: 0,
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "15px",
    marginBottom: "18px",
  },

  cardTitle: {
    margin: 0,
    color: "#142338",
    fontSize: "16px",
    fontWeight: 700,
  },

  cardSubtitle: {
    margin: "5px 0 0",
    color: "#7b8495",
    fontSize: "12px",
    lineHeight: 1.5,
  },

  headerIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "9px",
    background: "#edf7f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  countBadge: {
    background: "#edf7f9",
    color: "#137388",
    padding: "6px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  scoreBadge: {
    background: "#edf7f9",
    color: "#137388",
    padding: "6px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  metricBlock: {
    marginBottom: "18px",
  },

  metricHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#4f5b6b",
    fontSize: "13px",
    marginBottom: "8px",
  },

  metricHeaderStrong: {
    color: "#142338",
  },

  progressTrackLarge: {
    width: "100%",
    height: "9px",
    background: "#edf0f4",
    borderRadius: "20px",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    background:
      "linear-gradient(90deg, #123f61, #137388)",
    borderRadius: "20px",
    transition: "width 0.4s ease",
  },

  metricHint: {
    margin: "6px 0 0",
    color: "#98a1af",
    fontSize: "10px",
  },

  performanceStats: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    marginTop: "8px",
  },

  miniStat: {
    background: "#f7f9fc",
    borderRadius: "9px",
    padding: "11px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  miniStatSpan: {
    color: "#7b8495",
    fontSize: "11px",
  },

  progressRow: {
    marginBottom: "15px",
  },

  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "7px",
    color: "#667085",
    fontSize: "12px",
  },

  progressTrack: {
    height: "7px",
    background: "#edf0f4",
    borderRadius: "20px",
    overflow: "hidden",
  },

  totalValueBox: {
    marginTop: "19px",
    padding: "14px",
    borderRadius: "11px",
    background: "#edf7f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  totalValueLabel: {
    display: "block",
    color: "#7b8495",
    fontSize: "10px",
    marginBottom: "4px",
  },

  totalValue: {
    color: "#123f61",
    fontSize: "18px",
  },

  valueIcon: {
    width: "34px",
    height: "34px",
    borderRadius: "9px",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#137388",
    fontWeight: 700,
  },

  supplierRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "12px 0",
    borderBottom: "1px solid #f0f2f5",
  },

  supplierInfo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },

  supplierAvatar: {
    width: "34px",
    height: "34px",
    borderRadius: "9px",
    background: "#edf4f8",
    color: "#123f61",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: 700,
    flexShrink: 0,
  },

  supplierName: {
    display: "block",
    color: "#263447",
    fontSize: "12px",
  },

  supplierMeta: {
    display: "block",
    color: "#98a1af",
    fontSize: "10px",
    marginTop: "2px",
  },

  supplierScore: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "4px",
    flexShrink: 0,
  },

  supplierScoreStrong: {
    color: "#142338",
  },

  riskLow: {
    background: "#edf8f1",
    color: "#217344",
    padding: "3px 7px",
    borderRadius: "12px",
    fontSize: "9px",
    fontWeight: 700,
  },

  riskMedium: {
    background: "#fff7e8",
    color: "#9a6811",
    padding: "3px 7px",
    borderRadius: "12px",
    fontSize: "9px",
    fontWeight: 700,
  },

  riskHigh: {
    background: "#fff1f1",
    color: "#a33a3a",
    padding: "3px 7px",
    borderRadius: "12px",
    fontSize: "9px",
    fontWeight: 700,
  },

  riskNone: {
    background: "#f2f4f7",
    color: "#7b8495",
    padding: "3px 7px",
    borderRadius: "12px",
    fontSize: "9px",
    fontWeight: 700,
  },

  riskGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: "10px",
  },

  riskCardLow: {
    background: "#edf8f1",
    borderRadius: "10px",
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    color: "#217344",
  },

  riskCardMedium: {
    background: "#fff7e8",
    borderRadius: "10px",
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    color: "#9a6811",
  },

  riskCardHigh: {
    background: "#fff1f1",
    borderRadius: "10px",
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    color: "#a33a3a",
  },

  riskNotice: {
    display: "flex",
    gap: "10px",
    marginTop: "17px",
    padding: "12px",
    background: "#f7f9fc",
    borderRadius: "10px",
  },

  noticeIcon: {
    width: "25px",
    height: "25px",
    borderRadius: "50%",
    background: "#edf7f9",
    color: "#137388",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    flexShrink: 0,
  },

  riskNoticeStrong: {
    color: "#263447",
    fontSize: "12px",
  },

  riskNoticeP: {
    margin: "4px 0 0",
    color: "#7b8495",
    fontSize: "10px",
    lineHeight: 1.5,
  },

  filterBar: {
    display: "flex",
    gap: "10px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },

  searchBox: {
    flex: 1,
    minWidth: "240px",
    height: "40px",
    border: "1px solid #dfe4eb",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    padding: "0 11px",
    background: "#ffffff",
  },

  searchIcon: {
    fontSize: "13px",
    marginRight: "7px",
  },

  searchInput: {
    border: "none",
    outline: "none",
    width: "100%",
    fontSize: "12px",
    color: "#172033",
    background: "transparent",
  },

  select: {
    height: "40px",
    minWidth: "150px",
    border: "1px solid #dfe4eb",
    borderRadius: "9px",
    padding: "0 11px",
    color: "#4f5b6b",
    background: "#ffffff",
    fontSize: "12px",
    outline: "none",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "900px",
  },

  th: {
    textAlign: "left",
    padding: "11px 10px",
    borderBottom: "1px solid #e8ebf1",
    color: "#7b8495",
    fontSize: "10px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },

  td: {
    padding: "13px 10px",
    borderBottom: "1px solid #f0f2f5",
    color: "#4f5b6b",
    fontSize: "12px",
    verticalAlign: "middle",
  },

  orderNumber: {
    color: "#123f61",
    fontSize: "12px",
  },

  vendorCell: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    whiteSpace: "nowrap",
  },

  vendorDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#137388",
    flexShrink: 0,
  },

  statusDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: "currentColor",
    display: "inline-block",
  },

  statusDelivered: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    background: "#edf8f1",
    color: "#217344",
    padding: "5px 8px",
    borderRadius: "15px",
    fontSize: "10px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  statusDelayed: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    background: "#fff1f1",
    color: "#a33a3a",
    padding: "5px 8px",
    borderRadius: "15px",
    fontSize: "10px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  statusCancelled: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    background: "#f2f4f7",
    color: "#667085",
    padding: "5px 8px",
    borderRadius: "15px",
    fontSize: "10px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  statusTransit: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    background: "#fff7e8",
    color: "#9a6811",
    padding: "5px 8px",
    borderRadius: "15px",
    fontSize: "10px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  statusPending: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    background: "#edf4f8",
    color: "#123f61",
    padding: "5px 8px",
    borderRadius: "15px",
    fontSize: "10px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  statusDefault: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    background: "#f2f4f7",
    color: "#667085",
    padding: "5px 8px",
    borderRadius: "15px",
    fontSize: "10px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  emptyTableCell: {
    textAlign: "center",
    padding: "35px 15px",
    color: "#98a1af",
    fontSize: "12px",
  },

  activityList: {
    display: "flex",
    flexDirection: "column",
  },

  activityItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "11px 0",
    borderBottom: "1px solid #f0f2f5",
  },

  activityIcon: {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    background: "#edf7f9",
    color: "#137388",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 700,
    flexShrink: 0,
  },

  activityContent: {
    flex: 1,
    minWidth: 0,
  },

  activityContentStrong: {
    display: "block",
    color: "#263447",
    fontSize: "12px",
  },

  activityContentSpan: {
    display: "block",
    color: "#98a1af",
    fontSize: "10px",
    marginTop: "3px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  activityRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "4px",
    flexShrink: 0,
  },

  activityRightSmall: {
    color: "#98a1af",
    fontSize: "9px",
  },

  attentionList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  attentionDanger: {
    display: "flex",
    gap: "10px",
    padding: "13px",
    background: "#fff5f5",
    borderRadius: "10px",
  },

  attentionSuccess: {
    display: "flex",
    gap: "10px",
    padding: "13px",
    background: "#edf8f1",
    borderRadius: "10px",
  },

  attentionInfo: {
    display: "flex",
    gap: "10px",
    padding: "13px",
    background: "#edf7f9",
    borderRadius: "10px",
  },

  attentionNeutral: {
    display: "flex",
    gap: "10px",
    padding: "13px",
    background: "#f7f9fc",
    borderRadius: "10px",
  },

  attentionIconDanger: {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    background: "#fee9e9",
    color: "#a33a3a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  attentionIconSuccess: {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    background: "#dff3e7",
    color: "#217344",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  attentionIconInfo: {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    background: "#dff1f4",
    color: "#137388",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  attentionIconNeutral: {
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    background: "#edf0f4",
    color: "#667085",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  attentionDangerStrong: {
    color: "#7d2929",
    fontSize: "12px",
  },

  attentionSuccessStrong: {
    color: "#21643a",
    fontSize: "12px",
  },

  attentionInfoStrong: {
    color: "#123f61",
    fontSize: "12px",
  },

  attentionNeutralStrong: {
    color: "#263447",
    fontSize: "12px",
  },

  attentionDangerP: {
    margin: "4px 0 0",
    color: "#a45a5a",
    fontSize: "10px",
    lineHeight: 1.5,
  },

  attentionSuccessP: {
    margin: "4px 0 0",
    color: "#5c876c",
    fontSize: "10px",
    lineHeight: 1.5,
  },

  attentionInfoP: {
    margin: "4px 0 0",
    color: "#66808b",
    fontSize: "10px",
    lineHeight: 1.5,
  },

  attentionNeutralP: {
    margin: "4px 0 0",
    color: "#7b8495",
    fontSize: "10px",
    lineHeight: 1.5,
  },

  emptyState: {
    minHeight: "160px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#98a1af",
    textAlign: "center",
  },

  emptyIcon: {
    fontSize: "28px",
    marginBottom: "8px",
  },
};

export default SupplyChainDashboard;