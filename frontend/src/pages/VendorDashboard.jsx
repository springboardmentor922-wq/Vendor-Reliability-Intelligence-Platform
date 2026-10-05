import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function VendorDashboard() {
  const navigate = useNavigate();

  const [vendor, setVendor] = useState(null);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [communications, setCommunications] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(null);
  const [error, setError] = useState("");

  const [orderFilter, setOrderFilter] = useState("all");
  const [showAllOrders, setShowAllOrders] = useState(false);

  const menuItems = [
    "Dashboard",
    "Profile",
    "Purchase Orders",
    "Deliveries",
    "Delayed Deliveries",
    "Performance",
    "Risk Status",
    "Contracts",
    "Compliance",
    "Communications",
    "Notifications",
  ];

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const isRefresh = !loading;

    try {
      setError("");

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = getToken();

      if (!token) {
        setError("Your session has expired. Please login again.");
        return;
      }

      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };

      // =========================================================
      // CURRENT USER
      // =========================================================

      const meResponse = await fetch(`${API_URL}/me`, {
        headers,
      });

      if (!meResponse.ok) {
        throw new Error("Unable to identify the logged-in user.");
      }

      const me = await meResponse.json();

      // =========================================================
      // FIND CURRENT VENDOR
      // =========================================================

      const vendorsResponse = await fetch(`${API_URL}/vendors`, {
        headers,
      });

      let vendors = [];

      if (vendorsResponse.ok) {
        const data = await vendorsResponse.json();

        vendors = Array.isArray(data)
          ? data
          : Array.isArray(data?.vendors)
          ? data.vendors
          : [];
      }

      const currentVendor = vendors.find(
        (item) => String(item.user_id) === String(me.id)
      );

      if (!currentVendor) {
        setVendor(null);
        setError(
          "No vendor profile is linked to this account. Please contact the administrator."
        );
        return;
      }

      setVendor(currentVendor);

      localStorage.setItem("user_id", String(me.id));
      localStorage.setItem("user_email", me.email || "");
      localStorage.setItem("user_role", me.role || "");

      // =========================================================
      // PURCHASE ORDERS
      // =========================================================

      const ordersResponse = await fetch(
        `${API_URL}/vendor/purchase-orders`,
        {
          headers,
        }
      );

      if (ordersResponse.ok) {
        const data = await ordersResponse.json();

        const vendorOrders = Array.isArray(data)
          ? data
          : Array.isArray(data?.orders)
          ? data.orders
          : [];

        const uniqueOrders = vendorOrders.filter(
          (order, index, array) =>
            index ===
            array.findIndex(
              (item) => String(item.id) === String(order.id)
            )
        );

        setOrders(uniqueOrders);
      } else {
        setOrders([]);
      }

      // =========================================================
      // VENDOR INVOICES
      // =========================================================

      try {
        const invoicesResponse = await fetch(
          `${API_URL}/invoices/vendor/my-invoices`,
          {
            headers,
          }
        );

        if (invoicesResponse.ok) {
          const data = await invoicesResponse.json();

          setInvoices(
            Array.isArray(data)
              ? data
              : Array.isArray(data?.invoices)
              ? data.invoices
              : []
          );
        } else {
          setInvoices([]);
        }
      } catch {
        setInvoices([]);
      }

      // =========================================================
      // PERFORMANCE
      // =========================================================

      const performanceResponse = await fetch(
        `${API_URL}/performance/${currentVendor.id}`,
        {
          headers,
        }
      );

      if (performanceResponse.ok) {
        const data = await performanceResponse.json();

        if (Array.isArray(data)) {
          setPerformance(data[data.length - 1] || null);
        } else {
          setPerformance(data || null);
        }
      } else {
        const fallbackResponse = await fetch(
          `${API_URL}/performance`,
          {
            headers,
          }
        );

        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();

          const ownPerformance = Array.isArray(data)
            ? data.filter(
                (item) =>
                  String(item.vendor_id) ===
                  String(currentVendor.id)
              )
            : [];

          setPerformance(
            ownPerformance.length > 0
              ? ownPerformance[ownPerformance.length - 1]
              : null
          );
        } else {
          setPerformance(null);
        }
      }

      // =========================================================
      // CONTRACTS
      // =========================================================

      try {
        const contractsResponse = await fetch(
          `${API_URL}/contracts`,
          {
            headers,
          }
        );

        if (contractsResponse.ok) {
          const data = await contractsResponse.json();

          const allContracts = Array.isArray(data)
            ? data
            : Array.isArray(data?.contracts)
            ? data.contracts
            : [];

          const ownContracts = allContracts.filter(
            (contract) =>
              String(contract.vendor_id) ===
              String(currentVendor.id)
          );

          setContracts(ownContracts);
        } else {
          setContracts([]);
        }
      } catch {
        setContracts([]);
      }

      // =========================================================
      // COMMUNICATIONS
      // =========================================================

      try {
        const communicationsResponse = await fetch(
          `${API_URL}/communications`,
          {
            headers,
          }
        );

        if (communicationsResponse.ok) {
          const data = await communicationsResponse.json();

          const allCommunications = Array.isArray(data)
            ? data
            : Array.isArray(data?.communications)
            ? data.communications
            : [];

          const ownCommunications = allCommunications.filter(
            (communication) =>
              String(communication.vendor_id) ===
              String(currentVendor.id)
          );

          setCommunications(ownCommunications);
        } else {
          setCommunications([]);
        }
      } catch {
        setCommunications([]);
      }
    } catch (err) {
      console.error("Vendor Dashboard Error:", err);

      setError(
        "Unable to load vendor dashboard. Please make sure the backend is running."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // ===========================================================
  // SUBMIT INVOICE
  // ===========================================================

  async function submitInvoice(order) {
    if (!order) {
      return;
    }

    const status = String(order.status || "").toLowerCase();

    if (status !== "delivered") {
      alert(
        "Invoice can only be submitted after the purchase order is delivered."
      );
      return;
    }

    const existingInvoice = invoices.find(
      (invoice) =>
        String(invoice.purchase_order_id) ===
        String(order.id)
    );

    if (existingInvoice) {
      alert(
        `An invoice already exists for this purchase order.\n\nInvoice: ${existingInvoice.invoice_number}\nStatus: ${existingInvoice.status}`
      );
      return;
    }

    try {
      setInvoiceLoading(order.id);

      const token = getToken();

      if (!token) {
        alert("Your session has expired. Please login again.");
        return;
      }

      const response = await fetch(
        `${API_URL}/invoices/from-purchase-order/${order.id}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to submit invoice."
        );
      }

      alert(
        `Invoice submitted successfully!\n\nInvoice Number: ${data.invoice_number}\nAmount: ${formatCurrency(data.amount)}\nStatus: Pending`
      );

      await loadDashboard();
    } catch (err) {
      console.error("Invoice Submission Error:", err);

      alert(
        err.message ||
          "Unable to submit invoice. Please try again."
      );
    } finally {
      setInvoiceLoading(null);
    }
  }

  // ===========================================================
  // GET INVOICE FOR ORDER
  // ===========================================================

  function getInvoiceForOrder(orderId) {
    return invoices.find(
      (invoice) =>
        String(invoice.purchase_order_id) ===
        String(orderId)
    );
  }

  // ===========================================================
  // ORDER CALCULATIONS
  // ===========================================================

  const deliveredOrders = useMemo(() => {
    return orders.filter(
      (order) =>
        String(order.status || "").toLowerCase() === "delivered"
    );
  }, [orders]);

  const activeOrders = useMemo(() => {
    return orders.filter((order) => {
      const status = String(order.status || "").toLowerCase();

      return (
        status !== "delivered" &&
        status !== "cancelled"
      );
    });
  }, [orders]);

  const pendingDeliveries = useMemo(() => {
    return orders.filter((order) => {
      const status = String(order.status || "").toLowerCase();

      return (
        status === "pending" ||
        status === "approved" ||
        status === "shipped"
      );
    });
  }, [orders]);

  const cancelledOrders = useMemo(() => {
    return orders.filter(
      (order) =>
        String(order.status || "").toLowerCase() ===
        "cancelled"
    );
  }, [orders]);

  // ===========================================================
  // ON TIME DELIVERY
  // ===========================================================

  const evaluatedDeliveries = deliveredOrders.filter(
    (order) =>
      order.actual_delivery_date &&
      order.expected_delivery_date
  );

  const onTimeDeliveries = evaluatedDeliveries.filter(
    (order) =>
      new Date(order.actual_delivery_date) <=
      new Date(order.expected_delivery_date)
  );

  const delayedDeliveries = evaluatedDeliveries.filter(
    (order) =>
      new Date(order.actual_delivery_date) >
      new Date(order.expected_delivery_date)
  );

  const onTimePercentage =
    evaluatedDeliveries.length > 0
      ? Math.round(
          (onTimeDeliveries.length /
            evaluatedDeliveries.length) *
            100
        )
      : null;

  // ===========================================================
  // PERFORMANCE
  // ===========================================================

  function numberOrNull(value) {
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

  const deliveryScore = numberOrNull(
    performance?.delivery_score
  );

  const qualityScore = numberOrNull(
    performance?.quality_score
  );

  const communicationScore = numberOrNull(
    performance?.communication_score
  );

  const complianceScore = numberOrNull(
    performance?.compliance_score
  );

  const overallScore = numberOrNull(
    performance?.overall_score
  );

  const reliabilityScore = numberOrNull(
    vendor?.reliability_score
  );

  const displayReliability =
    reliabilityScore !== null
      ? reliabilityScore
      : overallScore;

  const displayPerformance =
    overallScore !== null
      ? overallScore
      : displayReliability;

  // ===========================================================
  // RISK
  // ===========================================================

  function getRiskLevel() {
    if (displayReliability === null) {
      return "No Data";
    }

    if (displayReliability >= 80) {
      return "Low Risk";
    }

    if (displayReliability >= 60) {
      return "Medium Risk";
    }

    return "High Risk";
  }

  const riskLevel = getRiskLevel();

  // ===========================================================
  // CONTRACTS
  // ===========================================================

  const activeContracts = contracts.filter(
    (contract) =>
      String(contract.status || "").toLowerCase() === "active"
  );

  const expiredContracts = contracts.filter(
    (contract) =>
      String(contract.status || "").toLowerCase() === "expired"
  );

  // ===========================================================
  // FILTERED ORDERS
  // ===========================================================

  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") {
      return orders;
    }

    if (orderFilter === "approved") {
      return orders.filter((order) => {
        const status = String(
          order.status || ""
        ).toLowerCase();

        return (
          status !== "delivered" &&
          status !== "cancelled"
        );
      });
    }

    return orders.filter(
      (order) =>
        String(order.status || "").toLowerCase() ===
        orderFilter
    );
  }, [orders, orderFilter]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort(
      (a, b) =>
        new Date(b.order_date || 0) -
        new Date(a.order_date || 0)
    );
  }, [filteredOrders]);

  const visibleOrders = showAllOrders
    ? sortedOrders
    : sortedOrders.slice(0, 6);

  // ===========================================================
  // HELPERS
  // ===========================================================

  function formatDate(value) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatCurrency(value) {
    const amount = Number(value || 0);

    return `₹${amount.toLocaleString("en-IN")}`;
  }

  function statusClass(status) {
    const value = String(status || "").toLowerCase();

    if (value === "delivered") {
      return "delivered";
    }

    if (
      value === "approved" ||
      value === "shipped"
    ) {
      return "approved";
    }

    if (
      value === "cancelled" ||
      value === "rejected"
    ) {
      return "cancelled";
    }

    return "pending";
  }

  function invoiceStatusClass(status) {
    const value = String(status || "").toLowerCase();

    if (value === "paid") {
      return "invoice-paid";
    }

    if (value === "verified") {
      return "invoice-verified";
    }

    if (value === "rejected") {
      return "invoice-rejected";
    }

    return "invoice-pending";
  }

  function goTo(path) {
    navigate(path);
  }

  // ===========================================================
  // INVOICE DISPLAY
  // ===========================================================

  function renderInvoiceCell(order) {
    const status = String(
      order.status || ""
    ).toLowerCase();

    if (status !== "delivered") {
      return (
        <span className="invoice-not-applicable">
          —
        </span>
      );
    }

    const invoice = getInvoiceForOrder(order.id);

    if (!invoice) {
      return (
        <button
          type="button"
          className="submit-invoice-btn"
          onClick={() => submitInvoice(order)}
          disabled={invoiceLoading === order.id}
        >
          {invoiceLoading === order.id
            ? "Submitting..."
            : "Submit Invoice"}
        </button>
      );
    }

    const invoiceStatus = String(
      invoice.status || ""
    ).toLowerCase();

    if (invoiceStatus === "pending") {
      return (
        <div className="invoice-status-wrapper">
          <span className="invoice-status invoice-pending">
            Invoice Pending
          </span>

          <small>
            {invoice.invoice_number}
          </small>
        </div>
      );
    }

    if (invoiceStatus === "verified") {
      return (
        <div className="invoice-status-wrapper">
          <span className="invoice-status invoice-verified">
            Invoice Verified
          </span>

          <small>
            {invoice.invoice_number}
          </small>
        </div>
      );
    }

    if (invoiceStatus === "paid") {
      return (
        <div className="invoice-status-wrapper">
          <span className="invoice-status invoice-paid">
            Payment Completed
          </span>

          <small>
            {invoice.invoice_number}
          </small>
        </div>
      );
    }

    if (invoiceStatus === "rejected") {
      return (
        <div className="invoice-status-wrapper">
          <span className="invoice-status invoice-rejected">
            Invoice Rejected
          </span>

          <small>
            {invoice.invoice_number}
          </small>

          {invoice.rejection_reason && (
            <div className="invoice-rejection-reason">
              {invoice.rejection_reason}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="invoice-status-wrapper">
        <span className="invoice-status invoice-pending">
          {invoice.status || "Submitted"}
        </span>

        <small>
          {invoice.invoice_number}
        </small>
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Vendor Dashboard"
      role="Vendor"
      menuItems={menuItems}
    >
      <div className="vendor-dashboard">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="dashboard-header">
          <div>
            <div className="eyebrow">
              VENDOR PORTAL
            </div>

            <h1>
              {loading
                ? "Vendor Dashboard"
                : `Welcome, ${
                    vendor?.company_name || "Vendor"
                  }`}
            </h1>

            <p>
              Monitor your orders, delivery performance,
              reliability, contracts and communications.
            </p>
          </div>

          <button
            className="refresh-btn"
            onClick={loadDashboard}
            disabled={loading || refreshing}
          >
            <span className="refresh-icon">↻</span>

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="error-panel">
            <div className="error-symbol">!</div>

            <div className="error-content">
              <strong>
                Dashboard data unavailable
              </strong>

              <p>{error}</p>
            </div>

            <button
              className="retry-btn"
              onClick={loadDashboard}
            >
              Retry
            </button>
          </div>
        )}

        {/* =====================================================
            VENDOR BANNER
        ===================================================== */}

        {vendor && (
          <div className="vendor-banner">
            <div className="vendor-avatar">
              {String(
                vendor.company_name || "V"
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="vendor-banner-main">
              <div className="vendor-title-row">
                <h2>
                  {vendor.company_name}
                </h2>

                <span className="active-pill">
                  {vendor.vendor_status ||
                    "Active"}
                </span>
              </div>

              <p>
                Vendor ID:

                <strong>
                  VEN-
                  {String(vendor.id).padStart(
                    3,
                    "0"
                  )}
                </strong>

                <span>•</span>

                {vendor.category ||
                  "Category not specified"}
              </p>
            </div>

            <div className="vendor-banner-contact">
              <small>
                REGISTERED EMAIL
              </small>

              <strong>
                {vendor.email ||
                  "Not available"}
              </strong>
            </div>
          </div>
        )}

        {/* =====================================================
            KPI CARDS
        ===================================================== */}

        <div className="kpi-grid">

          <KpiCard
            icon="▣"
            title="Purchase Orders"
            value={loading ? "..." : orders.length}
            description="Total orders"
            onClick={() =>
              goTo("/vendor-purchase-orders")
            }
          />

          <KpiCard
            icon="→"
            title="Active Orders"
            value={
              loading
                ? "..."
                : activeOrders.length
            }
            description="Orders in progress"
            onClick={() =>
              setOrderFilter("approved")
            }
          />

          <KpiCard
            icon="✓"
            title="Delivered"
            value={
              loading
                ? "..."
                : deliveredOrders.length
            }
            description="Completed orders"
            onClick={() =>
              setOrderFilter("delivered")
            }
          />

          <KpiCard
            icon="◷"
            title="On-Time Delivery"
            value={
              loading
                ? "..."
                : onTimePercentage === null
                ? "N/A"
                : `${onTimePercentage}%`
            }
            description="Evaluated deliveries"
            onClick={() =>
              goTo("/vendor-deliveries")
            }
          />
        </div>

        {/* =====================================================
            MAIN ANALYTICS
        ===================================================== */}

        <div className="analytics-grid">

          {/* PERFORMANCE */}

          <div className="dashboard-card performance-card">

            <div className="analytics-title">
              <div>
                <span className="section-label">
                  PERFORMANCE ANALYTICS
                </span>

                <h3>
                  Vendor Performance
                </h3>

                <p>
                  Current performance indicators
                  from recorded vendor activity.
                </p>
              </div>

              <button
                className="mini-view-btn"
                onClick={() =>
                  goTo("/vendor-performance")
                }
              >
                Details →
              </button>
            </div>

            <div className="performance-layout">

              <div className="performance-bars">

                <PerformanceBar
                  label="Delivery"
                  value={
                    deliveryScore !== null
                      ? deliveryScore
                      : onTimePercentage
                  }
                  icon="D"
                />

                <PerformanceBar
                  label="Quality"
                  value={qualityScore}
                  icon="Q"
                />

                <PerformanceBar
                  label="Communication"
                  value={communicationScore}
                  icon="C"
                />

                <PerformanceBar
                  label="Compliance"
                  value={complianceScore}
                  icon="✓"
                />

                <PerformanceBar
                  label="Reliability"
                  value={displayReliability}
                  icon="R"
                />

              </div>

              <div className="performance-score-panel">

                <div
                  className="score-ring"
                  style={{
                    "--score":
                      displayPerformance !== null
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              displayPerformance
                            )
                          )
                        : 0,
                  }}
                >
                  <div className="score-ring-inner">
                    <strong>
                      {displayPerformance !== null
                        ? Math.round(
                            displayPerformance
                          )
                        : "—"}
                    </strong>

                    {displayPerformance !== null && (
                      <span>%</span>
                    )}

                    <small>
                      Overall
                    </small>
                  </div>
                </div>

                <div className="score-status">
                  <span className="score-status-dot" />

                  {displayPerformance !== null
                    ? "Performance Score"
                    : "No performance data"}
                </div>

                <button
                  className="circle-action"
                  onClick={() =>
                    goTo("/vendor-performance")
                  }
                >
                  View Performance
                </button>

              </div>
            </div>
          </div>

          {/* RELIABILITY */}

          <div className="dashboard-card reliability-card">

            <div className="analytics-title">
              <div>
                <span className="section-label">
                  RISK MONITORING
                </span>

                <h3>
                  Reliability Status
                </h3>

                <p>
                  Current vendor reliability
                  classification.
                </p>
              </div>

              <div className="shield-icon">
                ✓
              </div>
            </div>

            <div className="reliability-main">

              <div>
                <div className="reliability-number">
                  {displayReliability !== null
                    ? Math.round(
                        displayReliability
                      )
                    : "—"}

                  {displayReliability !== null && (
                    <span>%</span>
                  )}
                </div>

                <div className="reliability-caption">
                  Reliability Score
                </div>
              </div>

              <div
                className={`risk-badge ${riskLevel
                  .toLowerCase()
                  .replace(" ", "-")}`}
              >
                {riskLevel}
              </div>
            </div>

            <div className="reliability-track">
              <div
                className="reliability-fill"
                style={{
                  width: `${
                    displayReliability !== null
                      ? Math.min(
                          100,
                          Math.max(
                            0,
                            displayReliability
                          )
                        )
                      : 0
                  }%`,
                }}
              />
            </div>

            <div className="risk-scale">
              <span>0</span>
              <span>60</span>
              <span>80</span>
              <span>100</span>
            </div>

            <div className="risk-info-box">
              <div className="risk-info-icon">
                ✓
              </div>

              <div>
                <strong>
                  Reliability Monitoring
                </strong>

                <p>
                  {displayReliability === null
                    ? "Reliability information is not available yet."
                    : "Calculated from available vendor performance records."}
                </p>
              </div>
            </div>

            <button
              className="text-action"
              onClick={() =>
                goTo("/vendor-risk-status")
              }
            >
              View risk status →
            </button>
          </div>
        </div>

        {/* =====================================================
            CONTRACT / COMMUNICATION / DELIVERY
        ===================================================== */}

        <div className="three-column-grid">

          {/* CONTRACT STATUS */}

          <div className="dashboard-card">

            <div className="card-heading">
              <div>
                <span className="section-label">
                  CONTRACTS
                </span>

                <h3>
                  Contract Status
                </h3>

                <p>
                  Your current contractual records.
                </p>
              </div>

              <span className="heading-icon">
                C
              </span>
            </div>

            <div className="contract-summary">

              <SummaryItem
                label="Total"
                value={contracts.length}
              />

              <SummaryItem
                label="Active"
                value={activeContracts.length}
                positive
              />

              <SummaryItem
                label="Expired"
                value={expiredContracts.length}
              />

            </div>

            {contracts.length > 0 ? (
              <div className="mini-list">
                {contracts
                  .slice(0, 3)
                  .map((contract) => (
                    <div
                      className="mini-list-row"
                      key={contract.id}
                    >
                      <div>
                        <strong>
                          {contract.contract_number ||
                            `CON-${contract.id}`}
                        </strong>

                        <small>
                          {contract.title ||
                            "Vendor Contract"}
                        </small>
                      </div>

                      <span
                        className={`status-pill ${statusClass(
                          contract.status
                        )}`}
                      >
                        {contract.status ||
                          "Unknown"}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <EmptyMessage
                icon="C"
                text="No contracts available."
              />
            )}

            <button
              className="text-action"
              onClick={() =>
                goTo("/vendor-contracts")
              }
            >
              View contracts →
            </button>
          </div>

          {/* COMMUNICATION */}

          <div className="dashboard-card">

            <div className="card-heading">
              <div>
                <span className="section-label">
                  COMMUNICATION
                </span>

                <h3>
                  Communication Activity
                </h3>

                <p>
                  Recent communication records.
                </p>
              </div>

              <span className="heading-icon">
                M
              </span>
            </div>

            <div className="communication-number">
              {communications.length}

              <span>
                Total messages
              </span>
            </div>

            {communications.length > 0 ? (
              <div className="mini-list">
                {communications
                  .slice(0, 3)
                  .map((communication) => (
                    <div
                      className="communication-row"
                      key={communication.id}
                    >
                      <div className="message-icon">
                        M
                      </div>

                      <div className="communication-main">
                        <strong>
                          {communication.subject ||
                            "Communication"}
                        </strong>

                        <small>
                          {formatDate(
                            communication.created_at
                          )}
                        </small>
                      </div>

                      <span
                        className={`status-dot ${
                          communication.status ===
                          "read"
                            ? "read"
                            : ""
                        }`}
                      />
                    </div>
                  ))}
              </div>
            ) : (
              <EmptyMessage
                icon="M"
                text="No communication records available."
              />
            )}

            <button
              className="text-action"
              onClick={() =>
                goTo("/vendor-communications")
              }
            >
              Open communications →
            </button>
          </div>

          {/* DELIVERY */}

          <div className="dashboard-card">

            <div className="card-heading">
              <div>
                <span className="section-label">
                  FULFILMENT
                </span>

                <h3>
                  Delivery Status
                </h3>

                <p>
                  Current order fulfilment overview.
                </p>
              </div>

              <span className="heading-icon">
                D
              </span>
            </div>

            <div className="delivery-overview">

              <DeliveryStat
                label="Pending"
                value={pendingDeliveries.length}
              />

              <DeliveryStat
                label="Delivered"
                value={deliveredOrders.length}
              />

              <DeliveryStat
                label="Cancelled"
                value={cancelledOrders.length}
              />

            </div>

            <div className="delivery-extra">

              <div>
                <span>
                  On-time
                </span>

                <strong>
                  {onTimePercentage === null
                    ? "N/A"
                    : `${onTimePercentage}%`}
                </strong>
              </div>

              <div>
                <span>
                  Delayed
                </span>

                <strong>
                  {delayedDeliveries.length}
                </strong>
              </div>

            </div>

            <div className="delivery-progress">

              <div className="progress-header">
                <span>
                  Order completion
                </span>

                <strong>
                  {orders.length > 0
                    ? `${Math.round(
                        (deliveredOrders.length /
                          orders.length) *
                          100
                      )}%`
                    : "0%"}
                </strong>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${
                      orders.length > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (deliveredOrders.length /
                                orders.length) *
                                100
                            )
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>

            </div>

            <button
              className="text-action"
              onClick={() =>
                goTo("/vendor-deliveries")
              }
            >
              View deliveries →
            </button>
          </div>
        </div>

        {/* =====================================================
            ORDER HISTORY
        ===================================================== */}

        <div className="dashboard-card order-card">

          <div className="card-heading order-heading">

            <div>
              <span className="section-label">
                PROCUREMENT
              </span>

              <h3>
                Order History
              </h3>

              <p>
                Purchase orders associated with
                your vendor account.
              </p>
            </div>

            <div className="order-actions">

              <span className="total-pill">
                {orders.length} Orders
              </span>

              <button
                className="small-action"
                onClick={() =>
                  goTo("/vendor-purchase-orders")
                }
              >
                View All
              </button>

            </div>
          </div>

          {/* FILTERS */}

          <div className="order-filter-bar">

            <div className="filter-label">
              FILTER
            </div>

            <button
              className={
                orderFilter === "all"
                  ? "filter-btn active"
                  : "filter-btn"
              }
              onClick={() =>
                setOrderFilter("all")
              }
            >
              All
            </button>

            <button
              className={
                orderFilter === "approved"
                  ? "filter-btn active"
                  : "filter-btn"
              }
              onClick={() =>
                setOrderFilter("approved")
              }
            >
              Active
            </button>

            <button
              className={
                orderFilter === "delivered"
                  ? "filter-btn active"
                  : "filter-btn"
              }
              onClick={() =>
                setOrderFilter("delivered")
              }
            >
              Delivered
            </button>

            <button
              className={
                orderFilter === "cancelled"
                  ? "filter-btn active"
                  : "filter-btn"
              }
              onClick={() =>
                setOrderFilter("cancelled")
              }
            >
              Cancelled
            </button>

          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loader" />

              <p>
                Loading order history...
              </p>
            </div>
          ) : visibleOrders.length === 0 ? (
            <EmptyMessage
              icon="Orders"
              text="No purchase orders match the selected filter."
            />
          ) : (
            <>
              <div className="table-container">

                <table>

                  <thead>
                    <tr>
                      <th>PO NUMBER</th>
                      <th>ORDER DATE</th>
                      <th>EXPECTED DELIVERY</th>
                      <th>ACTUAL DELIVERY</th>
                      <th>AMOUNT</th>
                      <th>STATUS</th>
                      <th>INVOICE</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleOrders.map((order) => (
                      <tr key={order.id}>

                        <td>
                          <strong className="po-number">
                            {order.order_number ||
                              `PO-${String(
                                order.id
                              ).padStart(3, "0")}`}
                          </strong>
                        </td>

                        <td>
                          {formatDate(
                            order.order_date
                          )}
                        </td>

                        <td>
                          {formatDate(
                            order.expected_delivery_date
                          )}
                        </td>

                        <td>
                          {formatDate(
                            order.actual_delivery_date
                          )}
                        </td>

                        <td>
                          <strong>
                            {formatCurrency(
                              order.total_amount
                            )}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={`status-pill ${statusClass(
                              order.status
                            )}`}
                          >
                            {order.status ||
                              "Unknown"}
                          </span>
                        </td>

                        <td>
                          {renderInvoiceCell(order)}
                        </td>

                      </tr>
                    ))}
                  </tbody>

                </table>

              </div>

              {sortedOrders.length > 6 && (
                <div className="show-more-wrapper">

                  <button
                    className="show-more-btn"
                    onClick={() =>
                      setShowAllOrders(
                        !showAllOrders
                      )
                    }
                  >
                    {showAllOrders
                      ? "Show Less"
                      : `Show All ${sortedOrders.length} Orders`}
                  </button>

                </div>
              )}
            </>
          )}
        </div>

        {/* =====================================================
            VENDOR ACCOUNT
        ===================================================== */}

        {vendor && (
          <div className="dashboard-card account-card">

            <div className="card-heading">

              <div>
                <span className="section-label">
                  ACCOUNT
                </span>

                <h3>
                  Vendor Account
                </h3>

                <p>
                  Registered information for your
                  vendor account.
                </p>
              </div>

              <span className="verified-pill">
                {vendor.approval_status ||
                  "Approved"}
              </span>

            </div>

            <div className="account-grid">

              <InfoItem
                label="Company Name"
                value={vendor.company_name}
              />

              <InfoItem
                label="Vendor ID"
                value={`VEN-${String(
                  vendor.id
                ).padStart(3, "0")}`}
              />

              <InfoItem
                label="Category"
                value={
                  vendor.category ||
                  "Not available"
                }
              />

              <InfoItem
                label="Contact Person"
                value={
                  vendor.contact_person ||
                  "Not available"
                }
              />

              <InfoItem
                label="Email"
                value={
                  vendor.email ||
                  "Not available"
                }
              />

              <InfoItem
                label="Phone"
                value={
                  vendor.phone ||
                  "Not available"
                }
              />

              <InfoItem
                label="Vendor Status"
                value={
                  vendor.vendor_status ||
                  "Not available"
                }
              />

              <InfoItem
                label="Approval Status"
                value={
                  vendor.approval_status ||
                  "Not available"
                }
              />

            </div>
          </div>
        )}

      </div>

      {/* =========================================================
          COMPLETE STYLING
      ========================================================= */}

      <style>{`

        * {
          box-sizing: border-box;
        }

        .vendor-dashboard {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
          color: #172033;
          font-family: Inter, Arial, sans-serif;
        }

        /* =====================================================
           HEADER
        ===================================================== */

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
        }

        .eyebrow {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.7px;
          color: #137388;
          margin-bottom: 7px;
        }

        .dashboard-header h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.2;
          color: #142338;
          font-weight: 750;
        }

        .dashboard-header p {
          margin: 7px 0 0;
          font-size: 13px;
          color: #7b8495;
          line-height: 1.6;
        }

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: #123f61;
          padding: 10px 16px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .refresh-btn:hover {
          background: #edf7f9;
          border-color: #67d7e8;
          transform: translateY(-1px);
        }

        .refresh-icon {
          font-size: 17px;
        }

        .refresh-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        /* =====================================================
           ERROR
        ===================================================== */

        .error-panel {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 14px 16px;
          margin-bottom: 20px;
          border-radius: 12px;
          background: #fff7f7;
          border: 1px solid #f2caca;
        }

        .error-symbol {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 50%;
          background: #dc3545;
          color: #ffffff;
          font-weight: 700;
        }

        .error-content {
          flex: 1;
        }

        .error-panel strong {
          display: block;
          color: #a52834;
          font-size: 13px;
        }

        .error-panel p {
          margin: 3px 0 0;
          font-size: 11px;
          color: #777;
        }

        .retry-btn {
          border: 0;
          background: #dc3545;
          color: #fff;
          padding: 8px 13px;
          border-radius: 7px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
        }

        /* =====================================================
           VENDOR BANNER
        ===================================================== */

        .vendor-banner {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 22px;
          margin-bottom: 20px;
          border-radius: 14px;
          background: linear-gradient(
            135deg,
            #0b1f3a,
            #123f61
          );
          color: #fff;
          box-shadow: 0 8px 25px rgba(
            11,
            31,
            58,
            0.12
          );
        }

        .vendor-avatar {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 13px;
          background: #67d7e8;
          color: #0b1f3a;
          font-size: 21px;
          font-weight: 800;
        }

        .vendor-banner-main {
          flex: 1;
          min-width: 0;
        }

        .vendor-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .vendor-title-row h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }

        .active-pill {
          padding: 4px 9px;
          border-radius: 20px;
          background: #dff7e8;
          color: #18794e;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .vendor-banner-main p {
          margin: 5px 0 0;
          display: flex;
          gap: 9px;
          color: #c9d9e5;
          font-size: 11px;
          flex-wrap: wrap;
        }

        .vendor-banner-contact {
          min-width: 230px;
          padding-left: 25px;
          border-left: 1px solid rgba(
            255,
            255,
            255,
            0.16
          );
        }

        .vendor-banner-contact small {
          display: block;
          margin-bottom: 5px;
          color: #9bb4c6;
          font-size: 9px;
          letter-spacing: 1px;
        }

        .vendor-banner-contact strong {
          font-size: 11px;
          word-break: break-word;
        }

        /* =====================================================
           KPI
        ===================================================== */

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 16px;
          margin-bottom: 20px;
        }

        .kpi-card {
          display: flex;
          align-items: center;
          gap: 13px;
          min-height: 108px;
          padding: 17px;
          background: #ffffff;
          border: 1px solid #e8ebf1;
          border-radius: 12px;
          transition: all 0.2s ease;
          cursor: pointer;
          text-align: left;
          width: 100%;
        }

        .kpi-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 9px 24px rgba(
            11,
            31,
            58,
            0.08
          );
          border-color: #cfe6eb;
        }

        .kpi-icon {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: #edf7f9;
          color: #137388;
          font-size: 18px;
          font-weight: 800;
        }

        .kpi-title {
          margin: 0;
          color: #7b8495;
          font-size: 11px;
        }

        .kpi-value {
          margin: 3px 0;
          color: #142338;
          font-size: 23px;
          font-weight: 750;
        }

        .kpi-description {
          margin: 0;
          color: #9aa3b1;
          font-size: 9px;
        }

        /* =====================================================
           GENERAL CARDS
        ===================================================== */

        .dashboard-card {
          background: #ffffff;
          border: 1px solid #e8ebf1;
          border-radius: 13px;
          padding: 20px;
          box-shadow: 0 3px 12px rgba(
            11,
            31,
            58,
            0.025
          );
          transition: all 0.2s ease;
        }

        .dashboard-card:hover {
          border-color: #dce7eb;
          box-shadow: 0 6px 20px rgba(
            11,
            31,
            58,
            0.045
          );
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .three-column-grid {
          display: grid;
          grid-template-columns: repeat(
            3,
            minmax(0, 1fr)
          );
          gap: 20px;
          margin-bottom: 20px;
        }

        .card-heading,
        .analytics-title {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 20px;
        }

        .card-heading h3,
        .analytics-title h3 {
          margin: 3px 0 0;
          color: #142338;
          font-size: 15px;
          font-weight: 700;
        }

        .card-heading p,
        .analytics-title p {
          margin: 4px 0 0;
          color: #8a94a3;
          font-size: 10px;
          line-height: 1.5;
        }

        .section-label {
          display: block;
          color: #137388;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1.1px;
        }

        .heading-icon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #edf7f9;
          color: #137388;
          font-size: 10px;
          font-weight: 800;
        }

        .mini-view-btn {
          border: 1px solid #e1e6ec;
          background: #fff;
          color: #137388;
          border-radius: 7px;
          padding: 7px 10px;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .mini-view-btn:hover {
          background: #edf7f9;
          border-color: #bfe1e7;
        }

        /* =====================================================
           PERFORMANCE
        ===================================================== */

        .performance-layout {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 22px;
          align-items: center;
          min-height: 230px;
        }

        .performance-bars {
          padding-right: 8px;
        }

        .performance-item {
          margin-bottom: 15px;
        }

        .performance-item:last-child {
          margin-bottom: 0;
        }

        .performance-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          color: #5e6877;
          font-size: 10px;
        }

        .performance-label-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .performance-mini-icon {
          width: 23px;
          height: 23px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: #edf7f9;
          color: #137388;
          font-size: 8px;
          font-weight: 800;
        }

        .performance-label strong {
          color: #172033;
          font-size: 10px;
        }

        .performance-track {
          height: 7px;
          overflow: hidden;
          border-radius: 10px;
          background: #edf0f4;
        }

        .performance-fill {
          height: 100%;
          border-radius: 10px;
          background: linear-gradient(
            90deg,
            #123f61,
            #137388,
            #67d7e8
          );
          transition: width 0.6s ease;
        }

        .performance-score-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 225px;
          border-left: 1px solid #edf0f3;
          padding-left: 20px;
        }

        .score-ring {
          --score: 0;

          width: 145px;
          height: 145px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;

          background:
            conic-gradient(
              #137388 calc(var(--score) * 1%),
              #e8eef2 0
            );

          position: relative;
          box-shadow:
            0 8px 22px rgba(
              19,
              115,
              136,
              0.08
            );
        }

        .score-ring::after {
          content: "";
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          background: #ffffff;
        }

        .score-ring-inner {
          position: relative;
          z-index: 2;
          width: 115px;
          height: 115px;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #ffffff;
        }

        .score-ring-inner strong {
          color: #123f61;
          font-size: 31px;
          line-height: 1;
          font-weight: 800;
        }

        .score-ring-inner span {
          color: #123f61;
          font-size: 13px;
          font-weight: 800;
          margin-top: 2px;
        }

        .score-ring-inner small {
          margin-top: 7px;
          color: #8a94a3;
          font-size: 9px;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .score-status {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          color: #7b8495;
          font-size: 9px;
        }

        .score-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #24a36a;
        }

        .circle-action {
          margin-top: 12px;
          border: 0;
          background: transparent;
          color: #137388;
          font-size: 9px;
          font-weight: 750;
          cursor: pointer;
        }

        .circle-action:hover {
          color: #0b1f3a;
        }

        /* =====================================================
           RELIABILITY
        ===================================================== */

        .shield-icon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #e8f7ee;
          color: #198754;
          font-weight: 800;
        }

        .reliability-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 18px;
        }

        .reliability-number {
          color: #123f61;
          font-size: 43px;
          line-height: 1;
          font-weight: 800;
        }

        .reliability-number span {
          font-size: 19px;
        }

        .reliability-caption {
          margin-top: 5px;
          color: #8a94a3;
          font-size: 9px;
        }

        .risk-badge {
          padding: 6px 10px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 750;
        }

        .risk-badge.low-risk {
          background: #e8f7ee;
          color: #198754;
        }

        .risk-badge.medium-risk {
          background: #fff4df;
          color: #b7791f;
        }

        .risk-badge.high-risk {
          background: #fff0f0;
          color: #dc3545;
        }

        .risk-badge.no-data {
          background: #f1f3f5;
          color: #6c757d;
        }

        .reliability-track {
          height: 9px;
          overflow: hidden;
          border-radius: 10px;
          background: #edf0f4;
        }

        .reliability-fill {
          height: 100%;
          border-radius: 10px;
          background: linear-gradient(
            90deg,
            #137388,
            #67d7e8
          );
          transition: width 0.6s ease;
        }

        .risk-scale {
          display: flex;
          justify-content: space-between;
          margin-top: 5px;
          color: #a0a8b3;
          font-size: 8px;
        }

        .risk-info-box {
          display: flex;
          gap: 9px;
          margin-top: 18px;
          padding: 11px;
          border-radius: 9px;
          background: #f7f9fc;
        }

        .risk-info-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 7px;
          background: #e8f7ee;
          color: #198754;
          font-size: 9px;
          font-weight: 800;
        }

        .risk-info-box strong {
          display: block;
          color: #263449;
          font-size: 9px;
        }

        .risk-info-box p {
          margin: 3px 0 0;
          color: #8a94a3;
          font-size: 8px;
          line-height: 1.5;
        }

        .text-action {
          border: 0;
          background: transparent;
          padding: 12px 0 0;
          color: #137388;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .text-action:hover {
          color: #0b1f3a;
        }

        /* =====================================================
           CONTRACT
        ===================================================== */

        .contract-summary {
          display: grid;
          grid-template-columns: repeat(
            3,
            1fr
          );
          gap: 8px;
          margin-bottom: 15px;
        }

        .summary-item {
          padding: 11px 9px;
          border-radius: 9px;
          background: #f7f9fc;
          text-align: center;
        }

        .summary-item span {
          display: block;
          margin-bottom: 4px;
          color: #8a94a3;
          font-size: 9px;
        }

        .summary-item strong {
          color: #142338;
          font-size: 18px;
        }

        /* =====================================================
           MINI LIST
        ===================================================== */

        .mini-list {
          border-top: 1px solid #eef0f3;
        }

        .mini-list-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 11px 0;
          border-bottom: 1px solid #f0f2f4;
        }

        .mini-list-row strong {
          display: block;
          color: #253247;
          font-size: 10px;
        }

        .mini-list-row small {
          display: block;
          margin-top: 3px;
          color: #919aa8;
          font-size: 9px;
        }

        /* =====================================================
           COMMUNICATION
        ===================================================== */

        .communication-number {
          display: flex;
          align-items: baseline;
          gap: 7px;
          margin-bottom: 13px;
          color: #123f61;
          font-size: 31px;
          font-weight: 800;
        }

        .communication-number span {
          color: #8a94a3;
          font-size: 10px;
          font-weight: 500;
        }

        .communication-row {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 10px 0;
          border-bottom: 1px solid #f0f2f4;
        }

        .message-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #edf7f9;
          color: #137388;
          font-size: 8px;
          font-weight: 800;
        }

        .communication-main {
          min-width: 0;
          flex: 1;
        }

        .communication-row strong {
          display: block;
          color: #253247;
          font-size: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .communication-row small {
          display: block;
          margin-top: 2px;
          color: #929ba8;
          font-size: 9px;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          margin-left: auto;
          border-radius: 50%;
          background: #f0a43c;
          flex-shrink: 0;
        }

        .status-dot.read {
          background: #198754;
        }

        /* =====================================================
           DELIVERY
        ===================================================== */

        .delivery-overview {
          display: grid;
          grid-template-columns: repeat(
            3,
            1fr
          );
          gap: 8px;
          margin-bottom: 13px;
        }

        .delivery-stat {
          padding: 12px 8px;
          border-radius: 9px;
          background: #f7f9fc;
          text-align: center;
        }

        .delivery-stat strong {
          display: block;
          color: #123f61;
          font-size: 19px;
        }

        .delivery-stat span {
          color: #8a94a3;
          font-size: 9px;
        }

        .delivery-extra {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 18px;
        }

        .delivery-extra div {
          padding: 10px;
          border: 1px solid #edf0f3;
          border-radius: 9px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .delivery-extra span {
          color: #8a94a3;
          font-size: 9px;
        }

        .delivery-extra strong {
          color: #142338;
          font-size: 13px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          color: #687384;
          font-size: 10px;
        }

        .progress-header strong {
          color: #142338;
        }

        .progress-track {
          height: 8px;
          overflow: hidden;
          border-radius: 10px;
          background: #edf0f4;
        }

        .progress-fill {
          height: 100%;
          border-radius: 10px;
          background: #137388;
          transition: width 0.4s ease;
        }

        /* =====================================================
           STATUS
        ===================================================== */

        .status-pill {
          display: inline-block;
          padding: 5px 9px;
          border-radius: 15px;
          font-size: 9px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .status-pill.delivered {
          background: #e7f1ff;
          color: #2563eb;
        }

        .status-pill.approved {
          background: #e8f7ee;
          color: #198754;
        }

        .status-pill.pending {
          background: #fff4df;
          color: #b7791f;
        }

        .status-pill.cancelled {
          background: #fff0f0;
          color: #dc3545;
        }

        .total-pill,
        .verified-pill {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 20px;
          background: #edf7f9;
          color: #123f61;
          font-size: 9px;
          font-weight: 750;
        }

        .verified-pill {
          background: #e8f7ee;
          color: #198754;
          text-transform: uppercase;
        }

        /* =====================================================
           ORDER
        ===================================================== */

        .order-card {
          margin-bottom: 20px;
        }

        .order-heading {
          align-items: center;
        }

        .order-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .small-action {
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: #123f61;
          padding: 7px 11px;
          border-radius: 7px;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        .small-action:hover {
          background: #edf7f9;
          border-color: #67d7e8;
        }

        .order-filter-bar {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 14px;
          padding: 8px;
          background: #f7f9fc;
          border: 1px solid #edf0f3;
          border-radius: 9px;
        }

        .filter-label {
          margin-right: 3px;
          color: #7b8495;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .filter-btn {
          border: 1px solid transparent;
          background: transparent;
          color: #687384;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 9px;
          font-weight: 650;
        }

        .filter-btn:hover {
          background: #ffffff;
          color: #123f61;
        }

        .filter-btn.active {
          background: #ffffff;
          color: #123f61;
          border-color: #dfe4eb;
          box-shadow: 0 1px 3px rgba(
            11,
            31,
            58,
            0.05
          );
        }

        /* =====================================================
           TABLE
        ===================================================== */

        .table-container {
          overflow-x: auto;
        }

        .table-container table {
          width: 100%;
          border-collapse: collapse;
        }

        .table-container th {
          padding: 10px 11px;
          border-bottom: 1px solid #e8ebf1;
          color: #7b8495;
          text-align: left;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .table-container td {
          padding: 13px 11px;
          border-bottom: 1px solid #f0f2f4;
          color: #5f6978;
          font-size: 10px;
          white-space: nowrap;
          vertical-align: middle;
        }

        .table-container tbody tr {
          transition: 0.15s ease;
        }

        .table-container tbody tr:hover {
          background: #f9fbfc;
        }

        .po-number {
          color: #123f61;
        }

        /* =====================================================
           INVOICE
        ===================================================== */

        .submit-invoice-btn {
          border: 0;
          background: #137388;
          color: #ffffff;
          padding: 8px 12px;
          border-radius: 7px;
          font-size: 9px;
          font-weight: 750;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .submit-invoice-btn:hover {
          background: #0b1f3a;
          transform: translateY(-1px);
        }

        .submit-invoice-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .invoice-not-applicable {
          color: #a0a8b3;
          font-size: 12px;
        }

        .invoice-status-wrapper {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          min-width: 120px;
        }

        .invoice-status {
          display: inline-block;
          padding: 5px 8px;
          border-radius: 14px;
          font-size: 8px;
          font-weight: 750;
          white-space: nowrap;
        }

        .invoice-status.invoice-pending {
          background: #fff4df;
          color: #b7791f;
        }

        .invoice-status.invoice-verified {
          background: #e7f1ff;
          color: #2563eb;
        }

        .invoice-status.invoice-paid {
          background: #e8f7ee;
          color: #198754;
        }

        .invoice-status.invoice-rejected {
          background: #fff0f0;
          color: #dc3545;
        }

        .invoice-status-wrapper small {
          color: #8a94a3;
          font-size: 8px;
          font-weight: 600;
        }

        .invoice-rejection-reason {
          max-width: 170px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: normal;
          color: #dc3545;
          font-size: 8px;
          line-height: 1.4;
        }

        .show-more-wrapper {
          display: flex;
          justify-content: center;
          padding-top: 15px;
        }

        .show-more-btn {
          border: 1px solid #dfe4eb;
          background: #ffffff;
          color: #123f61;
          padding: 8px 14px;
          border-radius: 7px;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .show-more-btn:hover {
          background: #edf7f9;
          border-color: #67d7e8;
        }

        /* =====================================================
           ACCOUNT
        ===================================================== */

        .account-card {
          margin-bottom: 20px;
        }

        .account-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          border-top: 1px solid #e8ebf1;
          border-left: 1px solid #e8ebf1;
        }

        .info-item {
          min-height: 68px;
          padding: 13px;
          border-right: 1px solid #e8ebf1;
          border-bottom: 1px solid #e8ebf1;
        }

        .info-label {
          display: block;
          margin-bottom: 5px;
          color: #8a94a3;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .info-value {
          display: block;
          color: #263449;
          font-size: 11px;
          font-weight: 650;
          word-break: break-word;
        }

        /* =====================================================
           EMPTY
        ===================================================== */

        .empty-message {
          min-height: 100px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .empty-message div {
          margin-bottom: 6px;
          color: #137388;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .empty-message p {
          margin: 0;
          color: #8a94a3;
          font-size: 10px;
        }

        /* =====================================================
           LOADING
        ===================================================== */

        .loading-state {
          min-height: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #8a94a3;
          font-size: 11px;
        }

        .loader {
          width: 25px;
          height: 25px;
          margin-bottom: 8px;
          border: 3px solid #dfe4eb;
          border-top-color: #137388;
          border-radius: 50%;
          animation: vendorSpin 0.8s linear infinite;
        }

        @keyframes vendorSpin {
          to {
            transform: rotate(360deg);
          }
        }

        /* =====================================================
           RESPONSIVE
        ===================================================== */

        @media (max-width: 1200px) {

          .performance-layout {
            grid-template-columns: 1fr;
          }

          .performance-score-panel {
            border-left: 0;
            border-top: 1px solid #edf0f3;
            padding-left: 0;
            padding-top: 20px;
            min-height: auto;
          }

        }

        @media (max-width: 1100px) {

          .kpi-grid {
            grid-template-columns: repeat(
              2,
              1fr
            );
          }

          .three-column-grid {
            grid-template-columns: 1fr 1fr;
          }

          .account-grid {
            grid-template-columns: repeat(
              2,
              1fr
            );
          }

        }

        @media (max-width: 950px) {

          .analytics-grid {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 800px) {

          .dashboard-header,
          .vendor-banner {
            flex-direction: column;
          }

          .vendor-banner-contact {
            width: 100%;
            padding-left: 0;
            padding-top: 12px;
            border-left: 0;
            border-top: 1px solid rgba(
              255,
              255,
              255,
              0.16
            );
          }

          .three-column-grid {
            grid-template-columns: 1fr;
          }

          .order-heading {
            align-items: flex-start;
          }

          .order-actions {
            flex-wrap: wrap;
          }

        }

        @media (max-width: 600px) {

          .kpi-grid {
            grid-template-columns: 1fr;
          }

          .account-grid {
            grid-template-columns: 1fr;
          }

          .order-filter-bar {
            flex-wrap: wrap;
          }

          .dashboard-header h1 {
            font-size: 23px;
          }

          .vendor-banner {
            padding: 16px;
          }

          .performance-layout {
            gap: 15px;
          }

          .score-ring {
            width: 125px;
            height: 125px;
          }

          .score-ring-inner {
            width: 99px;
            height: 99px;
          }

          .score-ring-inner strong {
            font-size: 27px;
          }

        }

      `}</style>
    </DashboardLayout>
  );
}

/* =============================================================
   KPI CARD
============================================================= */

function KpiCard({
  icon,
  title,
  value,
  description,
  onClick,
}) {
  return (
    <button
      className="kpi-card"
      onClick={onClick}
      type="button"
    >
      <div className="kpi-icon">
        {icon}
      </div>

      <div>
        <p className="kpi-title">
          {title}
        </p>

        <div className="kpi-value">
          {value}
        </div>

        <p className="kpi-description">
          {description}
        </p>
      </div>
    </button>
  );
}

/* =============================================================
   PERFORMANCE BAR
============================================================= */

function PerformanceBar({
  label,
  value,
  icon,
}) {
  const valid =
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value));

  const safeValue = valid
    ? Math.max(
        0,
        Math.min(100, Number(value))
      )
    : 0;

  return (
    <div className="performance-item">

      <div className="performance-label">

        <div className="performance-label-left">

          <span className="performance-mini-icon">
            {icon}
          </span>

          <span>
            {label}
          </span>

        </div>

        <strong>
          {valid
            ? `${Math.round(safeValue)}%`
            : "N/A"}
        </strong>

      </div>

      <div className="performance-track">

        <div
          className="performance-fill"
          style={{
            width: `${safeValue}%`,
          }}
        />

      </div>

    </div>
  );
}

/* =============================================================
   SUMMARY ITEM
============================================================= */

function SummaryItem({
  label,
  value,
  positive,
}) {
  return (
    <div className="summary-item">

      <span>
        {label}
      </span>

      <strong
        style={
          positive
            ? { color: "#198754" }
            : undefined
        }
      >
        {value}
      </strong>

    </div>
  );
}

/* =============================================================
   DELIVERY STAT
============================================================= */

function DeliveryStat({
  label,
  value,
}) {
  return (
    <div className="delivery-stat">

      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>

    </div>
  );
}

/* =============================================================
   INFO ITEM
============================================================= */

function InfoItem({
  label,
  value,
}) {
  return (
    <div className="info-item">

      <span className="info-label">
        {label}
      </span>

      <span className="info-value">
        {value || "Not available"}
      </span>

    </div>
  );
}

/* =============================================================
   EMPTY MESSAGE
============================================================= */

function EmptyMessage({
  icon,
  text,
}) {
  return (
    <div className="empty-message">

      <div>
        {icon}
      </div>

      <p>
        {text}
      </p>

    </div>
  );
}

export default VendorDashboard;