import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

async function apiRequest(endpoint) {
  const token = getToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

function normalizeArray(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.requests)) return data.requests;
  if (Array.isArray(data?.vendors)) return data.vendors;
  if (Array.isArray(data?.purchase_orders)) return data.purchase_orders;
  if (Array.isArray(data?.orders)) return data.orders;

  return [];
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(value) {
  const date = getDate(value);

  if (!date) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "₹0";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number);
}

function getAmount(order) {
  const value =
    order?.total_amount ??
    order?.totalAmount ??
    order?.amount ??
    0;

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function getVendorName(order, vendors) {
  if (order?.vendor_name) {
    return order.vendor_name;
  }

  if (order?.vendor?.company_name) {
    return order.vendor.company_name;
  }

  const vendorId =
    order?.vendor_id ||
    order?.vendorId ||
    order?.vendor?.id;

  if (vendorId !== undefined && vendorId !== null) {
    const vendor = vendors.find(
      (item) => Number(item?.id) === Number(vendorId)
    );

    if (vendor) {
      return (
        vendor?.company_name ||
        vendor?.name ||
        vendor?.vendor_name ||
        `Vendor ${vendorId}`
      );
    }
  }

  return "Not assigned";
}

function getStatusLabel(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "approved") return "Approved";
  if (normalized === "pending") return "Pending";
  if (normalized === "shipped") return "Shipped";
  if (normalized === "delivered") return "Delivered";
  if (normalized === "cancelled") return "Cancelled";
  if (normalized === "canceled") return "Cancelled";

  if (normalized === "in_transit") return "In Transit";

  return status || "Unknown";
}

function getStatusClass(status) {
  const normalized = normalizeStatus(status);

  if (
    normalized === "approved" ||
    normalized === "delivered" ||
    normalized === "completed" ||
    normalized === "closed" ||
    normalized === "active"
  ) {
    return "success";
  }

  if (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "rejected"
  ) {
    return "danger";
  }

  if (
    normalized === "shipped" ||
    normalized === "in_transit"
  ) {
    return "info";
  }

  return "warning";
}

function ProcurementDashboard() {
  const [requests, setRequests] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [analytics, setAnalytics] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const menuItems = [
    "Dashboard",
    "Vendors",
    "Requests",
    "Purchase Orders",
    "Approvals",
    "Performance",
    "Analytics",
    "Reports",
    "Notifications",
  ];

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [
        requestsResponse,
        vendorsResponse,
        purchaseOrdersResponse,
        performanceResponse,
        analyticsResponse,
      ] = await Promise.all([
        apiRequest("/procurement-requests"),
        apiRequest("/vendors"),
        apiRequest("/purchase-orders"),
        apiRequest("/performance"),
        apiRequest("/analytics/procurement"),
      ]);

      setRequests(normalizeArray(requestsResponse));
      setVendors(normalizeArray(vendorsResponse));
      setPurchaseOrders(normalizeArray(purchaseOrdersResponse));
      setPerformance(normalizeArray(performanceResponse));
      setAnalytics(analyticsResponse || {});
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Procurement dashboard error:", err);

      setError(
        err.message ||
          "Unable to load procurement dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     PROCUREMENT REQUESTS
  ============================================================ */

  const pendingRequests = useMemo(() => {
    return requests.filter((request) => {
      const status = normalizeStatus(request?.status);

      return (
        status === "pending" ||
        status === "pending_approval" ||
        status === "submitted" ||
        status === "under_review" ||
        status === "awaiting_approval"
      );
    }).length;
  }, [requests]);

  const pendingApprovals = useMemo(() => {
    return requests.filter((request) => {
      const status = normalizeStatus(request?.status);

      return (
        status === "pending_approval" ||
        status === "awaiting_approval"
      );
    }).length;
  }, [requests]);

  /* ============================================================
     VENDORS
  ============================================================ */

  const activeVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      const status = normalizeStatus(
        vendor?.vendor_status ||
          vendor?.status ||
          vendor?.approval_status
      );

      if (!status) return true;

      return (
        status === "active" ||
        status === "approved" ||
        status === "approved_vendor"
      );
    }).length;
  }, [vendors]);

  /* ============================================================
     PURCHASE ORDERS
  ============================================================ */

  const activePurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((order) => {
      const status = normalizeStatus(order?.status);

      return (
        status === "pending" ||
        status === "approved" ||
        status === "shipped"
      );
    });
  }, [purchaseOrders]);

  const deliveredOrders = useMemo(() => {
    return purchaseOrders.filter((order) => {
      const status = normalizeStatus(order?.status);

      return (
        status === "delivered" ||
        status === "completed" ||
        status === "closed"
      );
    });
  }, [purchaseOrders]);

  const pendingOrders = useMemo(() => {
    return purchaseOrders.filter((order) => {
      const status = normalizeStatus(order?.status);

      return (
        status === "pending" ||
        status === "pending_approval" ||
        status === "awaiting_approval"
      );
    });
  }, [purchaseOrders]);

  const shippedOrders = useMemo(() => {
    return purchaseOrders.filter((order) => {
      const status = normalizeStatus(order?.status);

      return (
        status === "shipped" ||
        status === "in_transit"
      );
    });
  }, [purchaseOrders]);

  const cancelledOrders = useMemo(() => {
    return purchaseOrders.filter((order) => {
      const status = normalizeStatus(order?.status);

      return (
        status === "cancelled" ||
        status === "canceled"
      );
    });
  }, [purchaseOrders]);

  const approvedOrders = useMemo(() => {
    return purchaseOrders.filter((order) => {
      return normalizeStatus(order?.status) === "approved";
    });
  }, [purchaseOrders]);

  /* ============================================================
     DELIVERY PERFORMANCE
  ============================================================ */

  const deliveryDataOrders = useMemo(() => {
    return deliveredOrders.filter((order) => {
      const expected =
        order?.expected_delivery_date ||
        order?.expectedDeliveryDate;

      const actual =
        order?.actual_delivery_date ||
        order?.actualDeliveryDate ||
        order?.delivered_at ||
        order?.delivery_date;

      return getDate(expected) && getDate(actual);
    });
  }, [deliveredOrders]);

  const onTimeOrders = useMemo(() => {
    return deliveryDataOrders.filter((order) => {
      const expected = getDate(
        order?.expected_delivery_date ||
          order?.expectedDeliveryDate
      );

      const actual = getDate(
        order?.actual_delivery_date ||
          order?.actualDeliveryDate ||
          order?.delivered_at ||
          order?.delivery_date
      );

      return actual <= expected;
    }).length;
  }, [deliveryDataOrders]);

  const delayedOrders =
    deliveryDataOrders.length - onTimeOrders;

  const onTimePercentage =
    deliveryDataOrders.length > 0
      ? Math.round(
          (onTimeOrders /
            deliveryDataOrders.length) *
            100
        )
      : 0;

  const delayedPercentage =
    deliveryDataOrders.length > 0
      ? Math.round(
          (delayedOrders /
            deliveryDataOrders.length) *
            100
        )
      : 0;

  /* ============================================================
     PROCUREMENT COST
  ============================================================ */

  const totalPOValue = useMemo(() => {
    return purchaseOrders.reduce(
      (sum, order) => sum + getAmount(order),
      0
    );
  }, [purchaseOrders]);

  const deliveredPOValue = useMemo(() => {
    return deliveredOrders.reduce(
      (sum, order) => sum + getAmount(order),
      0
    );
  }, [deliveredOrders]);

  const averagePOValue =
    purchaseOrders.length > 0
      ? totalPOValue / purchaseOrders.length
      : 0;

  const completionRate =
    purchaseOrders.length > 0
      ? Math.round(
          (deliveredOrders.length /
            purchaseOrders.length) *
            100
        )
      : 0;

  /* ============================================================
     VENDOR PERFORMANCE
  ============================================================ */

  const performanceWithNames = useMemo(() => {
    return performance.map((item) => {
      const vendor = vendors.find(
        (vendorItem) =>
          Number(vendorItem?.id) ===
          Number(item?.vendor_id)
      );

      return {
        ...item,
        company_name:
          item?.company_name ||
          vendor?.company_name ||
          `Vendor ${item?.vendor_id}`,
        category:
          item?.category ||
          vendor?.category ||
          "—",
      };
    });
  }, [performance, vendors]);

  const reliabilityScores = performance
    .map((item) =>
      Number(item?.reliability_score)
    )
    .filter(
      (score) =>
        Number.isFinite(score) &&
        score >= 0
    );

  const averageReliability =
    reliabilityScores.length > 0
      ? reliabilityScores.reduce(
          (sum, score) => sum + score,
          0
        ) / reliabilityScores.length
      : 0;

  const atRiskVendors = performance.filter(
    (item) => {
      const score = Number(
        item?.reliability_score || 0
      );

      return score < 80;
    }
  ).length;

  /* ============================================================
     ANALYTICS API
  ============================================================ */

  const summary =
    analytics?.procurement_summary || {};

  const totalPRs =
    summary.total_prs ??
    requests.length;

  const convertedPRs =
    summary.converted_prs ?? 0;

  /* ============================================================
     PO STATUS ANALYTICS
  ============================================================ */

  const totalOrders = purchaseOrders.length;

  const statusCounts = {
    approved: approvedOrders.length,
    pending: pendingOrders.length,
    shipped: shippedOrders.length,
    delivered: deliveredOrders.length,
    cancelled: cancelledOrders.length,
  };

  const statusPercentages = {
    approved:
      totalOrders > 0
        ? Math.round(
            (approvedOrders.length /
              totalOrders) *
              100
          )
        : 0,

    pending:
      totalOrders > 0
        ? Math.round(
            (pendingOrders.length /
              totalOrders) *
              100
          )
        : 0,

    shipped:
      totalOrders > 0
        ? Math.round(
            (shippedOrders.length /
              totalOrders) *
              100
          )
        : 0,

    delivered:
      totalOrders > 0
        ? Math.round(
            (deliveredOrders.length /
              totalOrders) *
              100
          )
        : 0,

    cancelled:
      totalOrders > 0
        ? Math.round(
            (cancelledOrders.length /
              totalOrders) *
              100
          )
        : 0,
  };

  /* ============================================================
     VENDOR COST ANALYSIS
  ============================================================ */

  const vendorCostData = useMemo(() => {
    const grouped = {};

    purchaseOrders.forEach((order) => {
      const vendorName = getVendorName(
        order,
        vendors
      );

      if (!grouped[vendorName]) {
        grouped[vendorName] = 0;
      }

      grouped[vendorName] += getAmount(order);
    });

    return Object.entries(grouped)
      .map(([name, amount]) => ({
        name,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [purchaseOrders, vendors]);

  const highestVendorCost =
    vendorCostData.length > 0
      ? vendorCostData[0].amount
      : 0;

  /* ============================================================
     FILTERED PURCHASE ORDERS
  ============================================================ */

  const filteredPurchaseOrders =
    useMemo(() => {
      const search = searchTerm
        .trim()
        .toLowerCase();

      return [...purchaseOrders]
        .filter((order) => {
          const status =
            normalizeStatus(order?.status);

          if (
            statusFilter !== "all" &&
            status !== statusFilter
          ) {
            return false;
          }

          if (!search) return true;

          const poNumber =
            order?.order_number ||
            order?.po_number ||
            order?.orderNumber ||
            "";

          const vendorName =
            getVendorName(
              order,
              vendors
            );

          return (
            String(poNumber)
              .toLowerCase()
              .includes(search) ||
            String(vendorName)
              .toLowerCase()
              .includes(search) ||
            String(order?.status || "")
              .toLowerCase()
              .includes(search)
          );
        })
        .sort((a, b) => {
          const dateA =
            getDate(
              a?.created_at ||
                a?.createdAt ||
                a?.order_date
            )?.getTime() ||
            Number(a?.id) ||
            0;

          const dateB =
            getDate(
              b?.created_at ||
                b?.createdAt ||
                b?.order_date
            )?.getTime() ||
            Number(b?.id) ||
            0;

          return dateB - dateA;
        });
    }, [
      purchaseOrders,
      vendors,
      searchTerm,
      statusFilter,
    ]);

  /* ============================================================
     REFRESH
  ============================================================ */

  const updatedText = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <DashboardLayout
      title="Procurement Manager Dashboard"
      role="Procurement Manager"
      menuItems={menuItems}
    >
      <div style={styles.page}>

        {/* ======================================================
            HERO HEADER
        ====================================================== */}

        <div style={styles.hero}>
          <div>
            <div style={styles.heroEyebrow}>
              PROCUREMENT INTELLIGENCE
            </div>

            <h1 style={styles.heroTitle}>
              Procurement Overview
            </h1>

            <p style={styles.heroDescription}>
              Monitor procurement activity, vendor
              reliability, purchase orders, costs and
              delivery performance from one workspace.
            </p>

            <div style={styles.heroMeta}>
              <span style={styles.liveDot}></span>
              Live system data
              <span style={styles.metaDivider}>•</span>
              Updated {updatedText}
            </div>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            style={{
              ...styles.refreshButton,
              opacity: loading ? 0.65 : 1,
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: loading
                  ? "rotate(360deg)"
                  : "none",
                transition:
                  "transform 0.6s ease",
              }}
            >
              ↻
            </span>

            {loading
              ? "Refreshing..."
              : "Refresh Data"}
          </button>
        </div>

        {/* ======================================================
            ERROR
        ====================================================== */}

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
              onClick={loadDashboard}
              style={styles.retryButton}
            >
              Retry
            </button>
          </div>
        )}

        {/* ======================================================
            KPI CARDS
        ====================================================== */}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                Procurement Overview
              </h2>

              <p style={styles.sectionDescription}>
                Current procurement workload and operational
                indicators.
              </p>
            </div>
          </div>

          <div style={styles.kpiGrid}>

            <KpiCard
              label="Pending Requests"
              value={
                loading
                  ? "..."
                  : pendingRequests
              }
              icon="📝"
              accent="teal"
              helper="Awaiting processing"
              onClick={() =>
                setStatusFilter("all")
              }
            />

            <KpiCard
              label="Purchase Orders"
              value={
                loading
                  ? "..."
                  : purchaseOrders.length
              }
              icon="📦"
              accent="blue"
              helper="All purchase orders"
              onClick={() =>
                setStatusFilter("all")
              }
            />

            <KpiCard
              label="Active Vendors"
              value={
                loading
                  ? "..."
                  : activeVendors
              }
              icon="🏢"
              accent="cyan"
              helper="Currently active"
            />

            <KpiCard
              label="Pending Approvals"
              value={
                loading
                  ? "..."
                  : pendingApprovals
              }
              icon="✓"
              accent="navy"
              helper="Requires attention"
            />

          </div>
        </section>

        {/* ======================================================
            ANALYTICS GRID
        ====================================================== */}

        <section style={styles.section}>

          <div style={styles.analyticsGrid}>

            {/* COST ANALYSIS */}

            <div style={styles.analyticsCard}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>
                    Procurement Cost Analysis
                  </h3>

                  <p style={styles.cardSubtitle}>
                    Purchase order value by vendor
                  </p>
                </div>

                <div style={styles.cardIcon}>
                  ₹
                </div>
              </div>

              <div style={styles.costSummary}>
                <div>
                  <span style={styles.summaryLabel}>
                    Total PO Value
                  </span>

                  <strong style={styles.summaryValue}>
                    {loading
                      ? "..."
                      : formatCurrency(
                          summary.total_po_value ??
                            totalPOValue
                        )}
                  </strong>
                </div>

                <div style={styles.summaryDivider}></div>

                <div>
                  <span style={styles.summaryLabel}>
                    Delivered Value
                  </span>

                  <strong style={styles.summaryValueSmall}>
                    {loading
                      ? "..."
                      : formatCurrency(
                          deliveredPOValue
                        )}
                  </strong>
                </div>
              </div>

              <div style={styles.chartArea}>
                {vendorCostData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  vendorCostData.map(
                    (item, index) => {
                      const percentage =
                        highestVendorCost > 0
                          ? Math.round(
                              (item.amount /
                                highestVendorCost) *
                                100
                            )
                          : 0;

                      return (
                        <div
                          key={item.name}
                          style={
                            styles.horizontalBarRow
                          }
                        >
                          <div
                            style={
                              styles.barLabelRow
                            }
                          >
                            <span
                              style={
                                styles.barLabel
                              }
                              title={item.name}
                            >
                              {item.name}
                            </span>

                            <strong
                              style={
                                styles.barValue
                              }
                            >
                              {formatCurrency(
                                item.amount
                              )}
                            </strong>
                          </div>

                          <div
                            style={
                              styles.barBackground
                            }
                          >
                            <div
                              style={{
                                ...styles.barFill,
                                width: `${percentage}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    }
                  )
                )}
              </div>
            </div>

            {/* PO STATUS */}

            <div style={styles.analyticsCard}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>
                    Purchase Order Status
                  </h3>

                  <p style={styles.cardSubtitle}>
                    Current distribution of purchase orders
                  </p>
                </div>

                <div style={styles.cardIcon}>
                  ◔
                </div>
              </div>

              <div style={styles.statusAnalytics}>

                <div
                  style={{
                    ...styles.donut,
                    background: `conic-gradient(
                      #137388 0 ${statusPercentages.delivered}%,
                      #123f61 ${statusPercentages.delivered}% ${statusPercentages.delivered + statusPercentages.approved}%,
                      #67d7e8 ${statusPercentages.delivered + statusPercentages.approved}% ${statusPercentages.delivered + statusPercentages.approved + statusPercentages.shipped}%,
                      #e5b84b ${statusPercentages.delivered + statusPercentages.approved + statusPercentages.shipped}% ${statusPercentages.delivered + statusPercentages.approved + statusPercentages.shipped + statusPercentages.pending}%,
                      #d65c5c ${statusPercentages.delivered + statusPercentages.approved + statusPercentages.shipped + statusPercentages.pending}% 100%
                    )`,
                  }}
                >
                  <div style={styles.donutInner}>
                    <strong>
                      {totalOrders}
                    </strong>

                    <span>
                      Total POs
                    </span>
                  </div>
                </div>

                <div style={styles.legend}>
                  <StatusLegend
                    label="Delivered"
                    value={
                      statusCounts.delivered
                    }
                    percentage={
                      statusPercentages.delivered
                    }
                    className="teal"
                  />

                  <StatusLegend
                    label="Approved"
                    value={
                      statusCounts.approved
                    }
                    percentage={
                      statusPercentages.approved
                    }
                    className="blue"
                  />

                  <StatusLegend
                    label="Shipped"
                    value={
                      statusCounts.shipped
                    }
                    percentage={
                      statusPercentages.shipped
                    }
                    className="cyan"
                  />

                  <StatusLegend
                    label="Pending"
                    value={
                      statusCounts.pending
                    }
                    percentage={
                      statusPercentages.pending
                    }
                    className="yellow"
                  />

                  <StatusLegend
                    label="Cancelled"
                    value={
                      statusCounts.cancelled
                    }
                    percentage={
                      statusPercentages.cancelled
                    }
                    className="red"
                  />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ======================================================
            PERFORMANCE + DELIVERY
        ====================================================== */}

        <section style={styles.section}>

          <div style={styles.analyticsGrid}>

            {/* VENDOR PERFORMANCE */}

            <div style={styles.analyticsCard}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>
                    Vendor Performance
                  </h3>

                  <p style={styles.cardSubtitle}>
                    Reliability overview of evaluated vendors
                  </p>
                </div>

                <div style={styles.cardIcon}>
                  ★
                </div>
              </div>

              <div style={styles.performanceOverview}>
                <div style={styles.performanceScore}>
                  <span>
                    Average Reliability
                  </span>

                  <strong>
                    {loading
                      ? "..."
                      : `${averageReliability.toFixed(
                          1
                        )}%`}
                  </strong>

                  <div
                    style={
                      styles.largeProgressBackground
                    }
                  >
                    <div
                      style={{
                        ...styles.largeProgressFill,
                        width: `${Math.min(
                          averageReliability,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div style={styles.riskMiniCard}>
                  <span>
                    At-Risk Vendors
                  </span>

                  <strong>
                    {loading
                      ? "..."
                      : atRiskVendors}
                  </strong>

                  <small>
                    Reliability below 80%
                  </small>
                </div>
              </div>

              <div style={styles.vendorPerformanceList}>
                {performanceWithNames.length ===
                0 ? (
                  <EmptyChart />
                ) : (
                  performanceWithNames
                    .slice(0, 6)
                    .map((vendor) => {
                      const score = Number(
                        vendor?.reliability_score
                      );

                      const safeScore =
                        Number.isFinite(score)
                          ? score
                          : 0;

                      let risk = "High";

                      if (safeScore >= 80) {
                        risk = "Low";
                      } else if (
                        safeScore >= 60
                      ) {
                        risk = "Medium";
                      }

                      return (
                        <div
                          key={
                            vendor?.vendor_id
                          }
                          style={
                            styles.vendorRow
                          }
                        >
                          <div
                            style={
                              styles.vendorNameArea
                            }
                          >
                            <strong
                              title={
                                vendor.company_name
                              }
                            >
                              {vendor.company_name}
                            </strong>

                            <span>
                              {vendor.category}
                            </span>
                          </div>

                          <div
                            style={
                              styles.vendorScoreArea
                            }
                          >
                            <div
                              style={
                                styles.vendorProgressBackground
                              }
                            >
                              <div
                                style={{
                                  ...styles.vendorProgress,
                                  width: `${Math.min(
                                    safeScore,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>

                            <strong>
                              {vendor?.reliability_score !=
                              null
                                ? `${safeScore.toFixed(
                                    1
                                  )}%`
                                : "N/A"}
                            </strong>

                            <span
                              style={
                                risk === "Low"
                                  ? styles.riskLow
                                  : risk ===
                                    "Medium"
                                  ? styles.riskMedium
                                  : styles.riskHigh
                              }
                            >
                              {risk}
                            </span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* DELIVERY PERFORMANCE */}

            <div style={styles.analyticsCard}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>
                    Delivery Performance
                  </h3>

                  <p style={styles.cardSubtitle}>
                    Completed delivery performance
                  </p>
                </div>

                <div style={styles.cardIcon}>
                  🚚
                </div>
              </div>

              <div style={styles.deliveryMain}>
                <div style={styles.deliveryCircle}>
                  <div
                    style={{
                      ...styles.deliveryCircleProgress,
                      background: `conic-gradient(
                        #137388 ${onTimePercentage}%,
                        #e8ebf1 ${onTimePercentage}% 100%
                      )`,
                    }}
                  >
                    <div
                      style={
                        styles.deliveryCircleInner
                      }
                    >
                      <strong>
                        {onTimePercentage}%
                      </strong>

                      <span>
                        On Time
                      </span>
                    </div>
                  </div>
                </div>

                <div style={styles.deliveryStats}>
                  <DeliveryStat
                    label="On-Time Deliveries"
                    value={onTimeOrders}
                    percentage={
                      onTimePercentage
                    }
                    icon="✓"
                  />

                  <DeliveryStat
                    label="Delayed Deliveries"
                    value={delayedOrders}
                    percentage={
                      delayedPercentage
                    }
                    icon="!"
                  />

                  <DeliveryStat
                    label="Completed Orders"
                    value={
                      deliveredOrders.length
                    }
                    percentage={
                      totalOrders > 0
                        ? Math.round(
                            (deliveredOrders.length /
                              totalOrders) *
                              100
                          )
                        : 0
                    }
                    icon="●"
                  />
                </div>
              </div>

              <div
                style={
                  styles.deliveryMessage
                }
              >
                <div>
                  <strong>
                    Delivery completion
                  </strong>

                  <span>
                    {completionRate}% of all purchase
                    orders have been completed.
                  </span>
                </div>

                <strong
                  style={{
                    color:
                      completionRate >= 80
                        ? "#157347"
                        : "#9a6700",
                  }}
                >
                  {completionRate}%
                </strong>
              </div>
            </div>

          </div>
        </section>

        {/* ======================================================
            ACTIVE PURCHASE ORDERS
        ====================================================== */}

        <section style={styles.section}>

          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                Active Purchase Orders
              </h2>

              <p style={styles.sectionDescription}>
                Monitor purchase orders currently in progress.
              </p>
            </div>

            <div style={styles.activeBadge}>
              {activePurchaseOrders.length} Active
            </div>
          </div>

          <div style={styles.tableCard}>

            <div style={styles.tableToolbar}>

              <div style={styles.searchBox}>
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search PO number or vendor..."
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                  style={styles.searchInput}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value
                  )
                }
                style={styles.filterSelect}
              >
                <option value="all">
                  All Statuses
                </option>
                <option value="pending">
                  Pending
                </option>
                <option value="approved">
                  Approved
                </option>
                <option value="shipped">
                  Shipped
                </option>
                <option value="delivered">
                  Delivered
                </option>
                <option value="cancelled">
                  Cancelled
                </option>
              </select>

              {(searchTerm ||
                statusFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                  style={
                    styles.clearButton
                  }
                >
                  Clear
                </button>
              )}

            </div>

            <div style={styles.tableContainer}>
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
                      Order Date
                    </th>

                    <th style={styles.th}>
                      Expected Delivery
                    </th>

                    <th
                      style={{
                        ...styles.th,
                        textAlign: "right",
                      }}
                    >
                      Amount
                    </th>

                    <th style={styles.th}>
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan="6"
                        style={
                          styles.loadingCell
                        }
                      >
                        Loading purchase orders...
                      </td>
                    </tr>
                  ) : filteredPurchaseOrders
                      .length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        style={
                          styles.emptyCell
                        }
                      >
                        No purchase orders match
                        the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredPurchaseOrders
                      .slice(0, 10)
                      .map(
                        (order, index) => {
                          const poNumber =
                            order?.order_number ||
                            order?.po_number ||
                            order?.orderNumber ||
                            `PO-${
                              order?.id ||
                              index + 1
                            }`;

                          return (
                            <tr
                              key={
                                order?.id ||
                                poNumber
                              }
                              style={
                                styles.tableRow
                              }
                            >
                              <td
                                style={
                                  styles.td
                                }
                              >
                                <strong
                                  style={
                                    styles.poNumber
                                  }
                                >
                                  {poNumber}
                                </strong>
                              </td>

                              <td
                                style={
                                  styles.td
                                }
                              >
                                <div
                                  style={
                                    styles.vendorCell
                                  }
                                >
                                  <div
                                    style={
                                      styles.vendorAvatar
                                    }
                                  >
                                    {getVendorName(
                                      order,
                                      vendors
                                    )
                                      .charAt(
                                        0
                                      )
                                      .toUpperCase()}
                                  </div>

                                  <span>
                                    {getVendorName(
                                      order,
                                      vendors
                                    )}
                                  </span>
                                </div>
                              </td>

                              <td
                                style={
                                  styles.td
                                }
                              >
                                {formatDate(
                                  order?.order_date ||
                                    order?.created_at
                                )}
                              </td>

                              <td
                                style={
                                  styles.td
                                }
                              >
                                {formatDate(
                                  order?.expected_delivery_date
                                )}
                              </td>

                              <td
                                style={{
                                  ...styles.td,
                                  textAlign:
                                    "right",
                                  fontWeight:
                                    "600",
                                }}
                              >
                                {formatCurrency(
                                  getAmount(
                                    order
                                  )
                                )}
                              </td>

                              <td
                                style={
                                  styles.td
                                }
                              >
                                <span
                                  style={{
                                    ...styles.statusBadge,
                                    ...(styles[
                                      getStatusClass(
                                        order?.status
                                      )
                                    ] ||
                                      styles.warning),
                                  }}
                                >
                                  <span>
                                    ●
                                  </span>

                                  {getStatusLabel(
                                    order?.status
                                  )}
                                </span>
                              </td>
                            </tr>
                          );
                        }
                      )
                  )}
                </tbody>
              </table>
            </div>

            <div style={styles.tableFooter}>
              Showing{" "}
              <strong>
                {Math.min(
                  filteredPurchaseOrders.length,
                  10
                )}
              </strong>{" "}
              of{" "}
              <strong>
                {filteredPurchaseOrders.length}
              </strong>{" "}
              matching purchase orders
            </div>
          </div>
        </section>

        {/* ======================================================
            PROCUREMENT ACTIVITY
        ====================================================== */}

        <section style={styles.section}>

          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                Procurement Activity
              </h2>

              <p style={styles.sectionDescription}>
                Summary of procurement requests and order
                completion.
              </p>
            </div>
          </div>

          <div style={styles.activityGrid}>

            <ActivityCard
              label="Total Procurement Requests"
              value={
                loading ? "..." : totalPRs
              }
              icon="📝"
            />

            <ActivityCard
              label="Converted Requests"
              value={
                loading
                  ? "..."
                  : convertedPRs
              }
              icon="↗"
            />

            <ActivityCard
              label="Delivered Orders"
              value={
                loading
                  ? "..."
                  : deliveredOrders.length
              }
              icon="✓"
            />

            <ActivityCard
              label="Cancelled Orders"
              value={
                loading
                  ? "..."
                  : cancelledOrders.length
              }
              icon="×"
            />

          </div>
        </section>

      </div>
    </DashboardLayout>
  );
}

/* ================================================================
   KPI CARD
================================================================ */

function KpiCard({
  label,
  value,
  icon,
  accent,
  helper,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.kpiCard,
        cursor: onClick
          ? "pointer"
          : "default",
      }}
    >
      <div
        style={{
          ...styles.kpiIcon,
          ...(accent === "blue"
            ? styles.kpiIconBlue
            : accent === "cyan"
            ? styles.kpiIconCyan
            : accent === "navy"
            ? styles.kpiIconNavy
            : styles.kpiIconTeal),
        }}
      >
        {icon}
      </div>

      <div style={styles.kpiContent}>
        <span style={styles.kpiLabel}>
          {label}
        </span>

        <strong style={styles.kpiValue}>
          {value}
        </strong>

        <span style={styles.kpiHelper}>
          {helper}
        </span>
      </div>

      {onClick && (
        <span style={styles.kpiArrow}>
          →
        </span>
      )}
    </button>
  );
}

/* ================================================================
   STATUS LEGEND
================================================================ */

function StatusLegend({
  label,
  value,
  percentage,
  className,
}) {
  const dotStyle =
    className === "blue"
      ? styles.legendDotBlue
      : className === "cyan"
      ? styles.legendDotCyan
      : className === "yellow"
      ? styles.legendDotYellow
      : className === "red"
      ? styles.legendDotRed
      : styles.legendDotTeal;

  return (
    <div style={styles.legendItem}>
      <span
        style={{
          ...styles.legendDot,
          ...dotStyle,
        }}
      ></span>

      <span style={styles.legendLabel}>
        {label}
      </span>

      <strong style={styles.legendValue}>
        {value}
      </strong>

      <span style={styles.legendPercentage}>
        {percentage}%
      </span>
    </div>
  );
}

/* ================================================================
   DELIVERY STAT
================================================================ */

function DeliveryStat({
  label,
  value,
  percentage,
  icon,
}) {
  return (
    <div style={styles.deliveryStat}>
      <div style={styles.deliveryStatIcon}>
        {icon}
      </div>

      <div style={styles.deliveryStatText}>
        <span>{label}</span>

        <strong>{value}</strong>
      </div>

      <span style={styles.deliveryStatPercentage}>
        {percentage}%
      </span>
    </div>
  );
}

/* ================================================================
   ACTIVITY CARD
================================================================ */

function ActivityCard({
  label,
  value,
  icon,
}) {
  return (
    <div style={styles.activityCard}>
      <div style={styles.activityIcon}>
        {icon}
      </div>

      <div>
        <span style={styles.activityLabel}>
          {label}
        </span>

        <strong style={styles.activityValue}>
          {value}
        </strong>
      </div>
    </div>
  );
}

/* ================================================================
   EMPTY CHART
================================================================ */

function EmptyChart() {
  return (
    <div style={styles.emptyChart}>
      <div style={styles.emptyChartIcon}>
        ◌
      </div>

      <span>
        No analytics data available
      </span>
    </div>
  );
}

/* ================================================================
   STYLES
================================================================ */

const styles = {
  page: {
    padding: "30px",
    background: "#f5f7fb",
    minHeight: "calc(100vh - 82px)",
    color: "#172033",
  },

  /* HERO */

  hero: {
    background:
      "linear-gradient(135deg, #0b1f3a 0%, #123f61 58%, #137388 100%)",
    borderRadius: "18px",
    padding: "30px 32px",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "25px",
    marginBottom: "28px",
    boxShadow:
      "0 10px 30px rgba(11,31,58,0.12)",
  },

  heroEyebrow: {
    color: "#67d7e8",
    fontSize: "11px",
    letterSpacing: "1.6px",
    fontWeight: "800",
    marginBottom: "8px",
  },

  heroTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "750",
    letterSpacing: "-0.5px",
  },

  heroDescription: {
    margin: "9px 0 0",
    color: "#d9e7ef",
    fontSize: "13px",
    lineHeight: 1.6,
    maxWidth: "730px",
  },

  heroMeta: {
    marginTop: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#b9d2dd",
    fontSize: "11px",
  },

  liveDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#67d7e8",
    display: "inline-block",
    boxShadow:
      "0 0 0 4px rgba(103,215,232,0.12)",
  },

  metaDivider: {
    color: "#5f8998",
  },

  refreshButton: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    padding: "11px 16px",
    borderRadius: "9px",
    fontSize: "12px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },

  /* ERROR */

  errorBox: {
    background: "#fff4f4",
    border: "1px solid #f0caca",
    borderRadius: "11px",
    padding: "14px 16px",
    marginBottom: "24px",
    color: "#b42318",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
  },

  errorText: {
    margin: "5px 0 0",
    fontSize: "12px",
  },

  retryButton: {
    border: "none",
    background: "#123f61",
    color: "#ffffff",
    borderRadius: "7px",
    padding: "9px 15px",
    cursor: "pointer",
    fontWeight: "600",
  },

  /* SECTIONS */

  section: {
    marginBottom: "28px",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    marginBottom: "15px",
  },

  sectionTitle: {
    margin: 0,
    color: "#142338",
    fontSize: "19px",
    fontWeight: "750",
    letterSpacing: "-0.2px",
  },

  sectionDescription: {
    margin: "5px 0 0",
    color: "#7b8495",
    fontSize: "12px",
  },

  /* KPI */

  kpiGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "16px",
  },

  kpiCard: {
    border: "1px solid #e8ebf1",
    background: "#ffffff",
    borderRadius: "14px",
    padding: "19px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    textAlign: "left",
    boxShadow:
      "0 4px 16px rgba(11,31,58,0.04)",
    transition:
      "transform 0.2s ease, box-shadow 0.2s ease",
    position: "relative",
  },

  kpiIcon: {
    width: "46px",
    height: "46px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "19px",
    flexShrink: 0,
  },

  kpiIconTeal: {
    background: "#edf7f9",
    color: "#137388",
  },

  kpiIconBlue: {
    background: "#edf3f8",
    color: "#123f61",
  },

  kpiIconCyan: {
    background: "#edf9fa",
    color: "#137388",
  },

  kpiIconNavy: {
    background: "#eef1f6",
    color: "#0b1f3a",
  },

  kpiContent: {
    minWidth: 0,
  },

  kpiLabel: {
    display: "block",
    color: "#7b8495",
    fontSize: "11px",
  },

  kpiValue: {
    display: "block",
    marginTop: "3px",
    color: "#142338",
    fontSize: "25px",
    lineHeight: 1.15,
  },

  kpiHelper: {
    display: "block",
    marginTop: "4px",
    color: "#98a2b3",
    fontSize: "10px",
  },

  kpiArrow: {
    position: "absolute",
    right: "15px",
    bottom: "13px",
    color: "#b0b8c5",
    fontSize: "14px",
  },

  /* ANALYTICS */

  analyticsGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1.3fr) minmax(0, 1fr)",
    gap: "17px",
  },

  analyticsCard: {
    background: "#ffffff",
    border: "1px solid #e8ebf1",
    borderRadius: "14px",
    padding: "21px",
    boxShadow:
      "0 4px 16px rgba(11,31,58,0.035)",
    minWidth: 0,
  },

  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "15px",
  },

  cardTitle: {
    margin: 0,
    color: "#142338",
    fontSize: "15px",
    fontWeight: "700",
  },

  cardSubtitle: {
    margin: "5px 0 0",
    color: "#8a94a6",
    fontSize: "11px",
  },

  cardIcon: {
    width: "34px",
    height: "34px",
    borderRadius: "9px",
    background: "#edf7f9",
    color: "#137388",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    flexShrink: 0,
  },

  costSummary: {
    display: "flex",
    alignItems: "center",
    gap: "22px",
    marginTop: "22px",
    paddingBottom: "18px",
    borderBottom: "1px solid #eef0f3",
  },

  summaryLabel: {
    display: "block",
    color: "#8a94a6",
    fontSize: "10px",
    marginBottom: "4px",
  },

  summaryValue: {
    display: "block",
    color: "#142338",
    fontSize: "22px",
  },

  summaryValueSmall: {
    display: "block",
    color: "#137388",
    fontSize: "16px",
  },

  summaryDivider: {
    width: "1px",
    height: "35px",
    background: "#e8ebf1",
  },

  chartArea: {
    marginTop: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  horizontalBarRow: {
    width: "100%",
  },

  barLabelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    marginBottom: "6px",
  },

  barLabel: {
    fontSize: "11px",
    color: "#4d596b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "58%",
  },

  barValue: {
    color: "#344054",
    fontSize: "11px",
  },

  barBackground: {
    height: "7px",
    background: "#edf0f4",
    borderRadius: "10px",
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    background:
      "linear-gradient(90deg, #123f61, #137388)",
    borderRadius: "10px",
    transition:
      "width 0.6s cubic-bezier(.4,0,.2,1)",
  },

  /* DONUT */

  statusAnalytics: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    gap: "25px",
    marginTop: "22px",
  },

  donut: {
    width: "165px",
    height: "165px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  donutInner: {
    width: "112px",
    height: "112px",
    borderRadius: "50%",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  legend: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minWidth: 0,
  },

  legendItem: {
    display: "grid",
    gridTemplateColumns:
      "9px minmax(0, 1fr) auto auto",
    alignItems: "center",
    gap: "7px",
    fontSize: "11px",
  },

  legendDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },

  legendDotTeal: {
    background: "#137388",
  },

  legendDotBlue: {
    background: "#123f61",
  },

  legendDotCyan: {
    background: "#67d7e8",
  },

  legendDotYellow: {
    background: "#e5b84b",
  },

  legendDotRed: {
    background: "#d65c5c",
  },

  legendLabel: {
    color: "#667085",
  },

  legendValue: {
    color: "#344054",
  },

  legendPercentage: {
    color: "#98a2b3",
    width: "35px",
    textAlign: "right",
  },

  /* PERFORMANCE */

  performanceOverview: {
    display: "grid",
    gridTemplateColumns:
      "1fr 150px",
    gap: "20px",
    marginTop: "20px",
    paddingBottom: "18px",
    borderBottom: "1px solid #eef0f3",
  },

  performanceScore: {
    display: "flex",
    flexDirection: "column",
  },

  performanceScore: {
    color: "#667085",
    fontSize: "11px",
  },

  performanceScore: {
    color: "#667085",
    fontSize: "11px",
  },

  largeProgressBackground: {
    height: "9px",
    marginTop: "10px",
    borderRadius: "10px",
    background: "#e8ebf1",
    overflow: "hidden",
  },

  largeProgressFill: {
    height: "100%",
    background:
      "linear-gradient(90deg, #123f61, #137388)",
    borderRadius: "10px",
    transition: "width 0.6s ease",
  },

  riskMiniCard: {
    background: "#fff8e8",
    border: "1px solid #f3e3b2",
    borderRadius: "10px",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
  },

  riskLow: {
    color: "#157347",
    background: "#e8f6ed",
    padding: "3px 7px",
    borderRadius: "12px",
    fontSize: "9px",
    fontWeight: "700",
  },

  riskMedium: {
    color: "#9a6700",
    background: "#fff7df",
    padding: "3px 7px",
    borderRadius: "12px",
    fontSize: "9px",
    fontWeight: "700",
  },

  riskHigh: {
    color: "#b42318",
    background: "#feeceb",
    padding: "3px 7px",
    borderRadius: "12px",
    fontSize: "9px",
    fontWeight: "700",
  },

  vendorPerformanceList: {
    marginTop: "15px",
    display: "flex",
    flexDirection: "column",
    gap: "11px",
  },

  vendorRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    paddingBottom: "10px",
    borderBottom: "1px solid #f0f1f4",
  },

  vendorNameArea: {
    display: "flex",
    flexDirection: "column",
    minWidth: "135px",
    maxWidth: "40%",
  },

  vendorNameAreaStrong: {
    color: "#344054",
    fontSize: "11px",
  },

  vendorScoreArea: {
    display: "grid",
    gridTemplateColumns:
      "minmax(70px, 1fr) 42px 48px",
    alignItems: "center",
    gap: "9px",
    flex: 1,
  },

  vendorProgressBackground: {
    height: "6px",
    background: "#e8ebf1",
    borderRadius: "10px",
    overflow: "hidden",
  },

  vendorProgress: {
    height: "100%",
    background: "#137388",
    borderRadius: "10px",
  },

  /* DELIVERY */

  deliveryMain: {
    display: "flex",
    alignItems: "center",
    gap: "25px",
    marginTop: "22px",
  },

  deliveryCircle: {
    flexShrink: 0,
  },

  deliveryCircleProgress: {
    width: "155px",
    height: "155px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  deliveryCircleInner: {
    width: "105px",
    height: "105px",
    background: "#ffffff",
    borderRadius: "50%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  deliveryStats: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  deliveryStat: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "8px",
    borderRadius: "8px",
    background: "#f7f9fc",
  },

  deliveryStatIcon: {
    width: "26px",
    height: "26px",
    borderRadius: "7px",
    background: "#edf7f9",
    color: "#137388",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "700",
  },

  deliveryStatText: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },

  deliveryStatTextSpan: {
    color: "#7b8495",
    fontSize: "9px",
  },

  deliveryStatTextStrong: {
    color: "#142338",
    fontSize: "14px",
  },

  deliveryStatPercentage: {
    color: "#137388",
    fontWeight: "700",
    fontSize: "11px",
  },

  deliveryMessage: {
    marginTop: "18px",
    padding: "12px 14px",
    background: "#edf7f9",
    borderRadius: "9px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
  },

  /* ACTIVE TABLE */

  activeBadge: {
    background: "#edf7f9",
    color: "#137388",
    borderRadius: "20px",
    padding: "7px 12px",
    fontSize: "11px",
    fontWeight: "700",
  },

  tableCard: {
    background: "#ffffff",
    border: "1px solid #e8ebf1",
    borderRadius: "14px",
    overflow: "hidden",
    boxShadow:
      "0 4px 16px rgba(11,31,58,0.035)",
  },

  tableToolbar: {
    padding: "15px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    borderBottom: "1px solid #e8ebf1",
    background: "#ffffff",
  },

  searchBox: {
    flex: 1,
    maxWidth: "380px",
    height: "38px",
    border: "1px solid #dfe4eb",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "0 11px",
    color: "#98a2b3",
  },

  searchInput: {
    border: "none",
    outline: "none",
    width: "100%",
    fontSize: "12px",
    color: "#172033",
    background: "transparent",
  },

  filterSelect: {
    height: "38px",
    padding: "0 11px",
    border: "1px solid #dfe4eb",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#344054",
    fontSize: "12px",
    outline: "none",
  },

  clearButton: {
    height: "38px",
    padding: "0 12px",
    border: "1px solid #dfe4eb",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#137388",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
  },

  tableContainer: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "850px",
  },

  th: {
    textAlign: "left",
    padding: "12px 15px",
    background: "#f7f9fc",
    borderBottom: "1px solid #e8ebf1",
    color: "#667085",
    fontSize: "10px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },

  td: {
    padding: "13px 15px",
    borderBottom: "1px solid #f0f1f4",
    color: "#344054",
    fontSize: "11px",
    whiteSpace: "nowrap",
  },

  tableRow: {
    transition: "background 0.15s ease",
  },

  poNumber: {
    color: "#123f61",
    fontSize: "11px",
  },

  vendorCell: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  vendorAvatar: {
    width: "28px",
    height: "28px",
    borderRadius: "8px",
    background: "#edf7f9",
    color: "#137388",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: "800",
    flexShrink: 0,
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "5px 9px",
    borderRadius: "15px",
    fontSize: "9px",
    fontWeight: "700",
    whiteSpace: "nowrap",
  },

  success: {
    color: "#157347",
    background: "#e8f6ed",
  },

  danger: {
    color: "#b42318",
    background: "#feeceb",
  },

  warning: {
    color: "#9a6700",
    background: "#fff7df",
  },

  info: {
    color: "#135e75",
    background: "#e8f5f8",
  },

  loadingCell: {
    textAlign: "center",
    padding: "35px",
    color: "#7b8495",
    fontSize: "12px",
  },

  emptyCell: {
    textAlign: "center",
    padding: "35px",
    color: "#7b8495",
    fontSize: "12px",
  },

  tableFooter: {
    padding: "12px 15px",
    background: "#fafbfc",
    color: "#98a2b3",
    fontSize: "10px",
    borderTop: "1px solid #eef0f3",
  },

  /* ACTIVITY */

  activityGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "15px",
  },

  activityCard: {
    background: "#ffffff",
    border: "1px solid #e8ebf1",
    borderRadius: "13px",
    padding: "17px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxShadow:
      "0 4px 14px rgba(11,31,58,0.03)",
  },

  activityIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    background: "#edf7f9",
    color: "#137388",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  activityLabel: {
    display: "block",
    color: "#7b8495",
    fontSize: "10px",
  },

  activityValue: {
    display: "block",
    marginTop: "3px",
    color: "#142338",
    fontSize: "20px",
  },

  /* EMPTY */

  emptyChart: {
    minHeight: "120px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#98a2b3",
    fontSize: "11px",
    gap: "8px",
  },

  emptyChartIcon: {
    fontSize: "25px",
    color: "#c4cbd5",
  },
};

export default ProcurementDashboard;