import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import DashboardLayout from "../components/DashboardLayout";

const API_BASE_URL = "http://127.0.0.1:8000";

function FinanceDashboard() {
  const menuItems = [
    "Dashboard",
    "Purchase Orders",
    "Invoices",
    "Payments",
    "Financial Status",
    "Finance Reports",
    "Notifications",
  ];

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [procurementRequests, setProcurementRequests] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const getToken = () => {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("access_token")
    );
  };

  const normalizeArray = (data) => {
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
  };

  const fetchAPI = async (endpoint, token) => {
    let response;

    try {
      response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (networkError) {
      throw new Error(
        "Cannot connect to backend. Please make sure FastAPI is running."
      );
    }

    if (response.status === 401) {
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
      let message = `Backend request failed (${response.status})`;

      try {
        const data = await response.json();

        if (data?.detail) {
          message =
            typeof data.detail === "string"
              ? data.detail
              : JSON.stringify(data.detail);
        }
      } catch {
        // Ignore invalid error JSON.
      }

      throw new Error(message);
    }

    try {
      return await response.json();
    } catch {
      throw new Error(
        "Backend returned an invalid response."
      );
    }
  };

  const loadFinanceData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const token = getToken();

        if (!token) {
          setError("Please login again.");
          return;
        }

        /*
         * Fetch:
         * 1. Purchase Orders
         * 2. Procurement Requests
         * 3. Vendors
         * 4. Payments
         *
         * Payments are IMPORTANT because the
         * Pending Value must change when Finance
         * marks a payment as completed.
         */
        const results = await Promise.allSettled([
          fetchAPI("/purchase-orders", token),
          fetchAPI("/procurement-requests", token),
          fetchAPI("/vendors", token),
          fetchAPI("/payments", token),
        ]);

        const poResult = results[0];
        const procurementResult = results[1];
        const vendorResult = results[2];
        const paymentResult = results[3];

        let poData = [];
        let procurementData = [];
        let vendorData = [];
        let paymentData = [];

        if (poResult.status === "fulfilled") {
          poData = normalizeArray(poResult.value);
        }

        if (procurementResult.status === "fulfilled") {
          procurementData = normalizeArray(
            procurementResult.value
          );
        }

        if (vendorResult.status === "fulfilled") {
          vendorData = normalizeArray(
            vendorResult.value
          );
        }

        if (paymentResult.status === "fulfilled") {
          paymentData = normalizeArray(
            paymentResult.value
          );
        }

        if (
          poResult.status === "rejected" &&
          procurementResult.status === "rejected" &&
          vendorResult.status === "rejected" &&
          paymentResult.status === "rejected"
        ) {
          throw new Error(
            "Unable to load finance data from the backend."
          );
        }

        /*
         * Remove duplicate purchase orders.
         */
        const uniquePOs = Array.from(
          new Map(
            poData.map((po, index) => [
              po?.id ??
                po?.order_number ??
                po?.orderNumber ??
                `po-${index}`,
              po,
            ])
          ).values()
        );

        /*
         * Remove duplicate vendors.
         */
        const uniqueVendors = Array.from(
          new Map(
            vendorData.map((vendor, index) => [
              vendor?.id ?? `vendor-${index}`,
              vendor,
            ])
          ).values()
        );

        /*
         * Remove duplicate payments.
         */
        const uniquePayments = Array.from(
          new Map(
            paymentData.map((payment, index) => [
              payment?.id ??
                payment?.payment_number ??
                `payment-${index}`,
              payment,
            ])
          ).values()
        );

        setPurchaseOrders(uniquePOs);
        setProcurementRequests(procurementData);
        setVendors(uniqueVendors);
        setPayments(uniquePayments);

        const failed = [];

        if (poResult.status === "rejected") {
          failed.push("purchase orders");
        }

        if (procurementResult.status === "rejected") {
          failed.push("procurement requests");
        }

        if (vendorResult.status === "rejected") {
          failed.push("vendors");
        }

        if (paymentResult.status === "rejected") {
          failed.push("payments");
        }

        if (failed.length > 0) {
          setError(
            `Some data could not be loaded: ${failed.join(
              ", "
            )}. Available data is shown.`
          );
        }
      } catch (err) {
        console.error(
          "Finance dashboard error:",
          err
        );

        setError(
          err?.message ||
            "Unable to load Finance Dashboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const getAmount = (po) => {
    const value =
      po?.total_amount ??
      po?.totalAmount ??
      po?.amount ??
      po?.estimated_amount ??
      po?.estimatedAmount ??
      0;

    const amount = Number(value);

    return Number.isFinite(amount) ? amount : 0;
  };

  const getPaymentAmount = (payment) => {
    const value =
      payment?.amount ??
      payment?.payment_amount ??
      payment?.paymentAmount ??
      0;

    const amount = Number(value);

    return Number.isFinite(amount) ? amount : 0;
  };

  const getStatus = (po) => {
    return String(
      po?.status ??
        po?.order_status ??
        po?.orderStatus ??
        "pending"
    )
      .trim()
      .toLowerCase();
  };

  const getPaymentStatus = (payment) => {
    return String(
      payment?.status ?? ""
    )
      .trim()
      .toLowerCase();
  };

  const getPaymentPurchaseOrderId = (payment) => {
    return (
      payment?.purchase_order_id ??
      payment?.purchaseOrderId ??
      payment?.purchase_order?.id ??
      null
    );
  };

  const getVendorId = (po) => {
    return (
      po?.vendor_id ??
      po?.vendorId ??
      po?.vendor?.id ??
      null
    );
  };

  const getVendorName = (po) => {
    if (po?.vendor_name) {
      return po.vendor_name;
    }

    if (po?.vendorName) {
      return po.vendorName;
    }

    if (po?.vendor?.company_name) {
      return po.vendor.company_name;
    }

    if (po?.vendor?.companyName) {
      return po.vendor.companyName;
    }

    const vendorId = getVendorId(po);

    const vendor = vendors.find(
      (item) =>
        String(item?.id) === String(vendorId)
    );

    if (vendor) {
      return (
        vendor.company_name ||
        vendor.companyName ||
        vendor.name ||
        `Vendor #${vendorId}`
      );
    }

    if (vendorId) {
      return `Vendor #${vendorId}`;
    }

    return "Unassigned Vendor";
  };

  const getOrderNumber = (po, index = 0) => {
    return (
      po?.order_number ||
      po?.orderNumber ||
      po?.po_number ||
      po?.poNumber ||
      `PO-${String(
        po?.id ?? index + 1
      ).padStart(4, "0")}`
    );
  };

  const formatCurrency = (amount) => {
    const value = Number(amount) || 0;

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompactCurrency = (amount) => {
    const value = Number(amount) || 0;

    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(1)}Cr`;
    }

    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    }

    if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}K`;
    }

    return `₹${Math.round(value)}`;
  };

  const formatDate = (value) => {
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
  };

  const getDisplayStatus = (status) => {
    const value = String(status || "")
      .trim()
      .toLowerCase();

    if (
      value === "delivered" ||
      value === "completed"
    ) {
      return "Delivered";
    }

    if (value === "shipped") {
      return "Shipped";
    }

    if (value === "approved") {
      return "Approved";
    }

    if (
      value === "cancelled" ||
      value === "canceled"
    ) {
      return "Cancelled";
    }

    return "Pending";
  };

  /*
   * ==========================================================
   * FINANCIAL CALCULATIONS
   * ==========================================================
   *
   * IMPORTANT:
   *
   * The old dashboard calculated Pending Value
   * from PO lifecycle status.
   *
   * That is NOT payment status.
   *
   * Now:
   *
   * Delivered PO Value
   *       -
   * Completed Payment Value
   *       =
   * Pending Payment Value
   *
   * Example:
   *
   * Delivered PO Value = ₹57,57,000
   * Completed Payments = ₹45,95,000
   *
   * Pending Payment Value =
   * ₹57,57,000 - ₹45,95,000
   * = ₹11,62,000
   *
   * If Finance completes another payment,
   * Completed Payment Value increases and
   * Pending Payment Value automatically decreases.
   */

  const financialData = useMemo(() => {
    let totalValue = 0;

    let pendingValue = 0;
    let approvedValue = 0;
    let shippedValue = 0;
    let deliveredValue = 0;
    let cancelledValue = 0;

    let pendingCount = 0;
    let approvedCount = 0;
    let shippedCount = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;

    /*
     * Existing PO lifecycle calculations.
     * These are kept so the dashboard design
     * and charts continue working exactly
     * as before.
     */
    purchaseOrders.forEach((po) => {
      const amount = getAmount(po);
      const status = getStatus(po);

      totalValue += amount;

      if (status === "approved") {
        approvedValue += amount;
        approvedCount += 1;
      } else if (status === "shipped") {
        shippedValue += amount;
        shippedCount += 1;
      } else if (
        status === "delivered" ||
        status === "completed"
      ) {
        deliveredValue += amount;
        deliveredCount += 1;
      } else if (
        status === "cancelled" ||
        status === "canceled"
      ) {
        cancelledValue += amount;
        cancelledCount += 1;
      } else {
        pendingValue += amount;
        pendingCount += 1;
      }
    });

    /*
     * ========================================================
     * PAYMENT-AWARE FINANCIAL VALUE
     * ========================================================
     */

    /*
     * Only Delivered POs are considered for
     * actual payment tracking.
     */
    const deliveredPOs = purchaseOrders.filter(
      (po) => {
        const status = getStatus(po);

        return (
          status === "delivered" ||
          status === "completed"
        );
      }
    );

    /*
     * Total value of Delivered POs.
     */
    const deliveredPOFinancialValue =
      deliveredPOs.reduce(
        (sum, po) => sum + getAmount(po),
        0
      );

    /*
     * Store Delivered PO IDs so that completed
     * payments belonging to other POs do not
     * get counted.
     */
    const deliveredPOIds = new Set(
      deliveredPOs
        .map((po) => po?.id)
        .filter(
          (id) =>
            id !== undefined &&
            id !== null
        )
        .map((id) => String(id))
    );

    /*
     * Actual completed payment value.
     *
     * This comes directly from /payments.
     */
    const completedPaymentValue =
      payments
        .filter((payment) => {
          const paymentStatus =
            getPaymentStatus(payment);

          const purchaseOrderId =
            getPaymentPurchaseOrderId(
              payment
            );

          return (
            paymentStatus === "completed" &&
            deliveredPOIds.has(
              String(purchaseOrderId)
            )
          );
        })
        .reduce(
          (sum, payment) =>
            sum + getPaymentAmount(payment),
          0
        );

    /*
     * Processing payment value.
     */
    const processingPaymentValue =
      payments
        .filter((payment) => {
          const paymentStatus =
            getPaymentStatus(payment);

          const purchaseOrderId =
            getPaymentPurchaseOrderId(
              payment
            );

          return (
            paymentStatus === "processing" &&
            deliveredPOIds.has(
              String(purchaseOrderId)
            )
          );
        })
        .reduce(
          (sum, payment) =>
            sum + getPaymentAmount(payment),
          0
        );

    /*
     * Pending payment records.
     */
    const pendingPaymentRecordValue =
      payments
        .filter((payment) => {
          const paymentStatus =
            getPaymentStatus(payment);

          const purchaseOrderId =
            getPaymentPurchaseOrderId(
              payment
            );

          return (
            paymentStatus === "pending" &&
            deliveredPOIds.has(
              String(purchaseOrderId)
            )
          );
        })
        .reduce(
          (sum, payment) =>
            sum + getPaymentAmount(payment),
          0
        );

    /*
     * THIS IS THE IMPORTANT VALUE.
     *
     * Pending financial value is the remaining
     * amount of Delivered PO value after
     * completed payments.
     */
    const pendingPaymentValue = Math.max(
      deliveredPOFinancialValue -
        completedPaymentValue,
      0
    );

    /*
     * Payment completion percentage.
     */
    const paymentCompletionPercentage =
      deliveredPOFinancialValue > 0
        ? Math.min(
            100,
            (completedPaymentValue /
              deliveredPOFinancialValue) *
              100
          )
        : 0;

    /*
     * Active PO value remains based on
     * PO lifecycle, not payment status.
     */
    const activeValue =
      totalValue - cancelledValue;

    const deliveredPercentage =
      totalValue > 0
        ? (deliveredValue / totalValue) * 100
        : 0;

    const activePercentage =
      totalValue > 0
        ? (activeValue / totalValue) * 100
        : 0;

    return {
      totalOrders: purchaseOrders.length,

      totalValue,

      /*
       * Keep old lifecycle pending value separately.
       */
      poPendingValue: pendingValue,

      /*
       * IMPORTANT:
       * Dashboard Pending Value now uses
       * actual payment records.
       */
      pendingValue: pendingPaymentValue,

      approvedValue,
      shippedValue,
      deliveredValue,
      cancelledValue,

      pendingCount,
      approvedCount,
      shippedCount,
      deliveredCount,
      cancelledCount,

      activeValue,

      deliveredPercentage,
      activePercentage,

      /*
       * New payment-aware values.
       */
      deliveredPOFinancialValue,
      completedPaymentValue,
      processingPaymentValue,
      pendingPaymentRecordValue,
      paymentCompletionPercentage,
    };
  }, [purchaseOrders, payments]);

  /*
   * ==========================================================
   * STATUS CHART DATA
   * ==========================================================
   */

  const statusChart = useMemo(() => {
    const values = [
      {
        label: "Delivered",
        value: financialData.deliveredCount,
        color: "#137388",
      },
      {
        label: "Approved",
        value: financialData.approvedCount,
        color: "#6d5bd0",
      },
      {
        label: "Shipped",
        value: financialData.shippedCount,
        color: "#3b82b6",
      },
      {
        label: "Pending",
        value: financialData.pendingCount,
        color: "#d79b32",
      },
      {
        label: "Cancelled",
        value: financialData.cancelledCount,
        color: "#c75b5b",
      },
    ];

    const total =
      values.reduce(
        (sum, item) => sum + item.value,
        0
      ) || 1;

    let current = 0;

    const segments = values
      .filter((item) => item.value > 0)
      .map((item) => {
        const start = current;

        current +=
          (item.value / total) * 100;

        return {
          ...item,
          start,
          end: current,
          percentage:
            (item.value / total) * 100,
        };
      });

    return {
      values,
      total,
      segments,
    };
  }, [financialData]);

  const statusGradient = useMemo(() => {
    if (statusChart.segments.length === 0) {
      return "#e8edf2";
    }

    return `conic-gradient(${statusChart.segments
      .map(
        (item) =>
          `${item.color} ${item.start}% ${item.end}%`
      )
      .join(", ")})`;
  }, [statusChart]);

  /*
   * ==========================================================
   * VENDOR SPEND
   * ==========================================================
   */

  const vendorSpend = useMemo(() => {
    const grouped = {};

    purchaseOrders.forEach((po) => {
      const name = getVendorName(po);

      if (!grouped[name]) {
        grouped[name] = {
          name,
          amount: 0,
          orders: 0,
        };
      }

      grouped[name].amount += getAmount(po);
      grouped[name].orders += 1;
    });

    return Object.values(grouped)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [purchaseOrders, vendors]);

  const maxVendorSpend = useMemo(() => {
    return Math.max(
      ...vendorSpend.map(
        (item) => item.amount
      ),
      1
    );
  }, [vendorSpend]);

  /*
   * ==========================================================
   * PROCUREMENT REQUEST DATA
   * ==========================================================
   */

  const procurementData = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let converted = 0;

    procurementRequests.forEach((request) => {
      const status = String(
        request?.status ??
          request?.request_status ??
          ""
      )
        .trim()
        .toLowerCase();

      if (status === "approved") {
        approved += 1;
      } else if (
        status === "rejected"
      ) {
        rejected += 1;
      } else if (
        status === "converted"
      ) {
        converted += 1;
      } else {
        pending += 1;
      }
    });

    return {
      total: procurementRequests.length,
      pending,
      approved,
      rejected,
      converted,
    };
  }, [procurementRequests]);

  /*
   * ==========================================================
   * FILTERED PURCHASE ORDERS
   * ==========================================================
   */

  const filteredOrders = useMemo(() => {
    const search = searchText
      .trim()
      .toLowerCase();

    return purchaseOrders.filter((po) => {
      const displayStatus =
        getDisplayStatus(
          getStatus(po)
        );

      const orderNumber =
        getOrderNumber(po).toLowerCase();

      const vendorName =
        getVendorName(po).toLowerCase();

      const matchesSearch =
        !search ||
        orderNumber.includes(search) ||
        vendorName.includes(search);

      const matchesStatus =
        statusFilter === "All" ||
        displayStatus === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    purchaseOrders,
    searchText,
    statusFilter,
    vendors,
  ]);

  /*
   * ==========================================================
   * RECENT ORDERS
   * ==========================================================
   */

  const recentTransactions = useMemo(() => {
    return [...filteredOrders]
      .sort((a, b) => {
        const dateA = new Date(
          a?.order_date ||
            a?.created_at ||
            0
        ).getTime();

        const dateB = new Date(
          b?.order_date ||
            b?.created_at ||
            0
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 8);
  }, [filteredOrders]);

  /*
   * ==========================================================
   * KPI DATA
   * ==========================================================
   */

  const stats = [
    {
      label: "Purchase Orders",
      value: financialData.totalOrders,
      icon: "▣",
      helper: "Live system records",
    },
    {
      label: "Total PO Value",
      value: formatCompactCurrency(
        financialData.totalValue
      ),
      icon: "₹",
      helper: "All purchase orders",
    },
    {
      /*
       * IMPORTANT:
       * This is now payment-aware.
       */
      label: "Pending Value",
      value: formatCompactCurrency(
        financialData.pendingValue
      ),
      icon: "◷",
      helper: "Remaining unpaid amount",
    },
    {
      label: "Delivered Value",
      value: formatCompactCurrency(
        financialData.deliveredValue
      ),
      icon: "✓",
      helper: `${financialData.deliveredCount} delivered orders`,
    },
  ];

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <DashboardLayout
      title="Finance Dashboard"
      role="Finance Officer"
      menuItems={menuItems}
    >
      <div style={page}>
        <section style={welcome}>
          <div>
            <div style={welcomeTag}>
              FINANCIAL OPERATIONS
            </div>

            <h2 style={welcomeTitle}>
              Finance Overview 👋
            </h2>

            <p style={welcomeText}>
              Monitor procurement value, purchase
              orders, financial status and vendor
              spending from live VRIPRM data.
            </p>
          </div>

          <div style={statusBox}>
            <div style={statusTop}>
              <span style={statusDot}></span>
              <span>Finance System</span>
            </div>

            <strong>Operational</strong>

            <small>
              Live backend data
            </small>
          </div>
        </section>

        {error && (
          <div style={errorBox}>
            <div style={errorIcon}>
              !
            </div>

            <div style={{ flex: 1 }}>
              <strong>
                Dashboard Notice
              </strong>

              <p style={errorText}>
                {error}
              </p>
            </div>
          </div>
        )}

        <div style={toolbar}>
          <div>
            <strong style={toolbarTitle}>
              Financial Control Center
            </strong>

            <span style={toolbarSubtitle}>
              Analyze actual purchase order
              and procurement activity.
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              loadFinanceData(true)
            }
            disabled={
              loading || refreshing
            }
            style={{
              ...refreshButton,
              opacity:
                loading || refreshing
                  ? 0.65
                  : 1,
            }}
          >
            <span
              style={
                refreshing
                  ? refreshIconSpin
                  : refreshIcon
              }
            >
              ↻
            </span>

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div style={loadingCard}>
            <div style={loader}></div>

            <strong>
              Loading financial dashboard...
            </strong>

            <p>
              Fetching purchase orders,
              procurement requests, vendors
              and payment records.
            </p>
          </div>
        ) : (
          <>
            <div style={statsGrid}>
              {stats.map((item) => (
                <div
                  key={item.label}
                  style={statCard}
                >
                  <div style={statIcon}>
                    {item.icon}
                  </div>

                  <div style={statContent}>
                    <span style={label}>
                      {item.label}
                    </span>

                    <strong style={number}>
                      {item.value}
                    </strong>

                    <small style={statHelper}>
                      {item.helper}
                    </small>
                  </div>
                </div>
              ))}
            </div>

            <div style={chartGrid}>
              <div style={card}>
                <div style={header}>
                  <div>
                    <h3 style={cardTitle}>
                      Purchase Order Status
                    </h3>

                    <p style={cardSubtitle}>
                      Distribution of actual
                      purchase order lifecycle
                      statuses.
                    </p>
                  </div>

                  <span style={badge}>
                    {financialData.totalOrders} POs
                  </span>
                </div>

                <div style={donutArea}>
                  <div
                    style={{
                      ...donut,
                      background:
                        statusGradient,
                    }}
                  >
                    <div style={donutInner}>
                      <strong>
                        {financialData.totalOrders}
                      </strong>

                      <span>
                        Orders
                      </span>
                    </div>
                  </div>

                  <div style={legend}>
                    {statusChart.values.map(
                      (item) => (
                        <div
                          key={item.label}
                          style={legendItem}
                        >
                          <span
                            style={{
                              ...legendDot,
                              background:
                                item.color,
                            }}
                          />

                          <span
                            style={
                              legendLabel
                            }
                          >
                            {item.label}
                          </span>

                          <strong
                            style={
                              legendValue
                            }
                          >
                            {item.value}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div style={card}>
                <div style={header}>
                  <div>
                    <h3 style={cardTitle}>
                      Financial Value by Status
                    </h3>

                    <p style={cardSubtitle}>
                      PO value grouped by its
                      current lifecycle state.
                    </p>
                  </div>

                  <span style={sectionIcon}>
                    ₹
                  </span>
                </div>

                <div style={valueChart}>
                  <FinanceBar
                    label="Pending"
                    amount={
                      financialData.pendingValue
                    }
                    total={
                      financialData.deliveredPOFinancialValue ||
                      financialData.totalValue
                    }
                    color="#d79b32"
                  />

                  <FinanceBar
                    label="Approved"
                    amount={
                      financialData.approvedValue
                    }
                    total={
                      financialData.totalValue
                    }
                    color="#6d5bd0"
                  />

                  <FinanceBar
                    label="Shipped"
                    amount={
                      financialData.shippedValue
                    }
                    total={
                      financialData.totalValue
                    }
                    color="#3b82b6"
                  />

                  <FinanceBar
                    label="Delivered"
                    amount={
                      financialData.deliveredValue
                    }
                    total={
                      financialData.totalValue
                    }
                    color="#137388"
                  />

                  <FinanceBar
                    label="Cancelled"
                    amount={
                      financialData.cancelledValue
                    }
                    total={
                      financialData.totalValue
                    }
                    color="#c75b5b"
                  />
                </div>

                <div style={chartFooter}>
                  <span>
                    Total tracked value
                  </span>

                  <strong>
                    {formatCurrency(
                      financialData.totalValue
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <div style={chartGrid}>
              <div style={card}>
                <div style={header}>
                  <div>
                    <h3 style={cardTitle}>
                      Vendor-wise PO Value
                    </h3>

                    <p style={cardSubtitle}>
                      Top vendors by actual
                      purchase order value.
                    </p>
                  </div>

                  <span style={badge}>
                    Top {vendorSpend.length}
                  </span>
                </div>

                {vendorSpend.length === 0 ? (
                  <div style={miniEmpty}>
                    No vendor spending data
                    available.
                  </div>
                ) : (
                  <div style={vendorChart}>
                    {vendorSpend.map(
                      (vendor) => {
                        const width =
                          (vendor.amount /
                            maxVendorSpend) *
                          100;

                        return (
                          <div
                            key={vendor.name}
                            style={vendorRow}
                          >
                            <div
                              style={
                                vendorRowTop
                              }
                            >
                              <div
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  gap: "8px",
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  style={
                                    vendorAvatar
                                  }
                                >
                                  {vendor.name
                                    .charAt(
                                      0
                                    )
                                    .toUpperCase()}
                                </span>

                                <span
                                  style={
                                    vendorName
                                  }
                                >
                                  {vendor.name}
                                </span>
                              </div>

                              <strong
                                style={
                                  vendorAmount
                                }
                              >
                                {formatCompactCurrency(
                                  vendor.amount
                                )}
                              </strong>
                            </div>

                            <div
                              style={
                                vendorTrack
                              }
                            >
                              <div
                                style={{
                                  ...vendorFill,
                                  width: `${width}%`,
                                }}
                              />
                            </div>

                            <div
                              style={
                                vendorMeta
                              }
                            >
                              {vendor.orders}{" "}
                              {vendor.orders ===
                              1
                                ? "order"
                                : "orders"}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>

              <div style={card}>
                <div style={header}>
                  <div>
                    <h3 style={cardTitle}>
                      Financial Health
                    </h3>

                    <p style={cardSubtitle}>
                      Current value movement
                      across purchase orders.
                    </p>
                  </div>

                  <span style={sectionIcon}>
                    ✓
                  </span>
                </div>

                <div style={healthMetric}>
                  <div
                    style={healthMetricTop}
                  >
                    <span>
                      Delivered Value
                    </span>

                    <strong>
                      {Math.round(
                        financialData.deliveredPercentage
                      )}
                      %
                    </strong>
                  </div>

                  <div
                    style={healthTrack}
                  >
                    <div
                      style={{
                        ...healthFill,
                        width: `${Math.min(
                          100,
                          financialData.deliveredPercentage
                        )}%`,
                      }}
                    />
                  </div>

                  <small>
                    {formatCurrency(
                      financialData.deliveredValue
                    )}{" "}
                    delivered from{" "}
                    {formatCurrency(
                      financialData.totalValue
                    )}{" "}
                    total PO value.
                  </small>
                </div>

                <div style={healthGrid}>
                  <div style={healthBox}>
                    <span>
                      Active PO Value
                    </span>

                    <strong>
                      {formatCompactCurrency(
                        financialData.activeValue
                      )}
                    </strong>
                  </div>

                  <div style={healthBox}>
                    <span>
                      Cancelled Value
                    </span>

                    <strong
                      style={redText}
                    >
                      {formatCompactCurrency(
                        financialData.cancelledValue
                      )}
                    </strong>
                  </div>
                </div>

                <div style={healthNotice}>
                  <div
                    style={
                      healthNoticeIcon
                    }
                  >
                    i
                  </div>

                  <div>
                    <strong>
                      Finance tracking status
                    </strong>

                    <p>
                      Payment values are now
                      calculated from actual
                      payment records. Completed
                      payments reduce the remaining
                      pending financial value.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div style={card}>
              <div style={header}>
                <div>
                  <h3 style={cardTitle}>
                    Financial Transactions
                  </h3>

                  <p style={cardSubtitle}>
                    Search and monitor actual
                    purchase order financial
                    records.
                  </p>
                </div>

                <span style={badge}>
                  {filteredOrders.length} Records
                </span>
              </div>

              <div style={filterBar}>
                <div
                  style={searchContainer}
                >
                  <span
                    style={searchIcon}
                  >
                    ⌕
                  </span>

                  <input
                    value={searchText}
                    onChange={(event) =>
                      setSearchText(
                        event.target.value
                      )
                    }
                    placeholder="Search PO number or vendor..."
                    style={searchInput}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  style={select}
                >
                  <option value="All">
                    All Statuses
                  </option>

                  <option value="Pending">
                    Pending
                  </option>

                  <option value="Approved">
                    Approved
                  </option>

                  <option value="Shipped">
                    Shipped
                  </option>

                  <option value="Delivered">
                    Delivered
                  </option>

                  <option value="Cancelled">
                    Cancelled
                  </option>
                </select>

                {(searchText ||
                  statusFilter !==
                    "All") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchText("");
                      setStatusFilter(
                        "All"
                      );
                    }}
                    style={clearButton}
                  >
                    Clear
                  </button>
                )}
              </div>

              {recentTransactions.length ===
              0 ? (
                <div style={emptyState}>
                  <div
                    style={emptyIcon}
                  >
                    ▣
                  </div>

                  <strong>
                    No matching transactions
                  </strong>

                  <p>
                    Try changing the search
                    or status filter.
                  </p>
                </div>
              ) : (
                <div
                  style={tableWrapper}
                >
                  <table
                    style={table}
                  >
                    <thead>
                      <tr>
                        <th style={th}>
                          Purchase Order
                        </th>

                        <th style={th}>
                          Vendor
                        </th>

                        <th style={th}>
                          Order Date
                        </th>

                        <th style={th}>
                          Expected Delivery
                        </th>

                        <th style={th}>
                          Amount
                        </th>

                        <th style={th}>
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {recentTransactions.map(
                        (po, index) => {
                          const status =
                            getDisplayStatus(
                              getStatus(po)
                            );

                          return (
                            <tr
                              key={
                                po?.id ??
                                getOrderNumber(
                                  po,
                                  index
                                )
                              }
                            >
                              <td style={td}>
                                <strong
                                  style={
                                    poNumber
                                  }
                                >
                                  {getOrderNumber(
                                    po,
                                    index
                                  )}
                                </strong>
                              </td>

                              <td style={td}>
                                <div
                                  style={
                                    vendorCell
                                  }
                                >
                                  <span
                                    style={
                                      smallAvatar
                                    }
                                  >
                                    {getVendorName(
                                      po
                                    )
                                      .charAt(
                                        0
                                      )
                                      .toUpperCase()}
                                  </span>

                                  <span>
                                    {getVendorName(
                                      po
                                    )}
                                  </span>
                                </div>
                              </td>

                              <td style={td}>
                                {formatDate(
                                  po?.order_date ||
                                    po?.created_at
                                )}
                              </td>

                              <td style={td}>
                                {formatDate(
                                  po?.expected_delivery_date
                                )}
                              </td>

                              <td style={td}>
                                <strong>
                                  {formatCurrency(
                                    getAmount(
                                      po
                                    )
                                  )}
                                </strong>
                              </td>

                              <td style={td}>
                                <StatusBadge
                                  status={
                                    status
                                  }
                                />
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

            <div style={card}>
              <div style={header}>
                <div>
                  <h3 style={cardTitle}>
                    Procurement Financial Snapshot
                  </h3>

                  <p style={cardSubtitle}>
                    Current procurement requests
                    feeding the finance workflow.
                  </p>
                </div>

                <span style={badge}>
                  {procurementData.total} Requests
                </span>
              </div>

              <div style={requestGrid}>
                <RequestMetric
                  label="Pending"
                  value={
                    procurementData.pending
                  }
                  icon="◷"
                />

                <RequestMetric
                  label="Approved"
                  value={
                    procurementData.approved
                  }
                  icon="✓"
                />

                <RequestMetric
                  label="Converted"
                  value={
                    procurementData.converted
                  }
                  icon="↗"
                />

                <RequestMetric
                  label="Rejected"
                  value={
                    procurementData.rejected
                  }
                  icon="!"
                />
              </div>
            </div>

            <div style={dataNote}>
              <div style={dataNoteIcon}>
                ✓
              </div>

              <div>
                <strong>
                  Live Financial Data
                </strong>

                <p>
                  This dashboard calculates
                  financial values from actual
                  purchase orders and payment
                  records. When a payment is
                  marked completed, the completed
                  amount increases and the
                  remaining pending amount
                  decreases automatically.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

/* ============================================================
   SMALL COMPONENTS
============================================================ */

function FinanceBar({
  label,
  amount,
  total,
  color,
}) {
  const percentage =
    total > 0
      ? Math.min(
          100,
          (amount / total) * 100
        )
      : 0;

  return (
    <div style={financeBarRow}>
      <div style={financeBarHeader}>
        <span>
          {label}
        </span>

        <strong>
          {new Intl.NumberFormat(
            "en-IN",
            {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            }
          ).format(amount)}
        </strong>
      </div>

      <div style={financeBarTrack}>
        <div
          style={{
            ...financeBarFill,
            width: `${percentage}%`,
            background: color,
          }}
        />
      </div>

      <small style={financeBarPercent}>
        {percentage.toFixed(1)}% of total
      </small>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Pending: pendingStatus,
    Approved: approvedStatus,
    Shipped: shippedStatus,
    Delivered: completedStatus,
    Cancelled: cancelledStatus,
  };

  return (
    <span
      style={
        styles[status] || pendingStatus
      }
    >
      <span style={statusDotSmall}>
        ●
      </span>

      {status}
    </span>
  );
}

function RequestMetric({
  label,
  value,
  icon,
}) {
  return (
    <div style={requestCard}>
      <span style={requestIcon}>
        {icon}
      </span>

      <div>
        <span style={requestLabel}>
          {label}
        </span>

        <strong style={requestNumber}>
          {value}
        </strong>
      </div>
    </div>
  );
}

/* ============================================================
   PAGE
============================================================ */

const page = {
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  width: "100%",
};

/* ============================================================
   WELCOME
============================================================ */

const welcome = {
  background:
    "linear-gradient(135deg, #0b1f3a 0%, #123f61 55%, #137388 100%)",
  color: "#fff",
  padding: "30px",
  borderRadius: "16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "25px",
  boxShadow:
    "0 8px 30px rgba(11,31,58,.16)",
};

const welcomeTag = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "1.5px",
  opacity: 0.72,
  marginBottom: "8px",
};

const welcomeTitle = {
  margin: 0,
  fontSize: "25px",
  fontWeight: 700,
};

const welcomeText = {
  margin: "8px 0 0",
  color: "rgba(255,255,255,.8)",
  fontSize: "14px",
  lineHeight: 1.55,
  maxWidth: "650px",
};

const statusBox = {
  minWidth: "190px",
  background:
    "rgba(255,255,255,.09)",
  border:
    "1px solid rgba(255,255,255,.13)",
  padding: "16px 18px",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const statusTop = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  fontSize: "12px",
  color: "rgba(255,255,255,.75)",
};

const statusDot = {
  width: "7px",
  height: "7px",
  borderRadius: "50%",
  background: "#67d7e8",
  display: "inline-block",
  boxShadow:
    "0 0 0 4px rgba(103,215,232,.12)",
};

/* ============================================================
   ERROR
============================================================ */

const errorBox = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
  padding: "13px 16px",
  borderRadius: "10px",
  border: "1px solid #f3c6c6",
  background: "#fff7f7",
  color: "#8f2424",
};

const errorIcon = {
  width: "25px",
  height: "25px",
  borderRadius: "50%",
  background: "#fee4e2",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontWeight: 700,
};

const errorText = {
  margin: "4px 0 0",
  fontSize: "12px",
};

/* ============================================================
   TOOLBAR
============================================================ */

const toolbar = {
  background: "#fff",
  border: "1px solid #e8ebf1",
  borderRadius: "12px",
  padding: "14px 17px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
};

const toolbarTitle = {
  display: "block",
  color: "#142338",
  fontSize: "14px",
};

const toolbarSubtitle = {
  display: "block",
  marginTop: "3px",
  color: "#7b8495",
  fontSize: "12px",
};

const refreshButton = {
  height: "38px",
  padding: "0 14px",
  border: "1px solid #dfe4eb",
  borderRadius: "8px",
  background: "#fff",
  color: "#123f61",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "7px",
};

const refreshIcon = {
  fontSize: "18px",
};

const refreshIconSpin = {
  fontSize: "18px",
  display: "inline-block",
  animation:
    "financeSpin .8s linear infinite",
};

/* ============================================================
   LOADING
============================================================ */

const loadingCard = {
  background: "#fff",
  minHeight: "280px",
  borderRadius: "14px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  border: "1px solid #e8ebf1",
  color: "#344054",
};

const loader = {
  width: "32px",
  height: "32px",
  border: "3px solid #e8ebf1",
  borderTop:
    "3px solid #137388",
  borderRadius: "50%",
  animation:
    "financeSpin .8s linear infinite",
  marginBottom: "13px",
};

/* ============================================================
   KPI
============================================================ */

const statsGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: "17px",
};

const statCard = {
  background: "#fff",
  padding: "21px",
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  border: "1px solid #e8ebf1",
  boxShadow:
    "0 4px 18px rgba(11,31,58,.035)",
  transition:
    "transform .2s ease, box-shadow .2s ease",
};

const statIcon = {
  width: "51px",
  height: "51px",
  flexShrink: 0,
  background: "#edf7f9",
  borderRadius: "12px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: "21px",
  color: "#137388",
  fontWeight: 700,
};

const statContent = {
  minWidth: 0,
};

const label = {
  display: "block",
  color: "#7b8495",
  fontSize: "12px",
  fontWeight: 500,
};

const number = {
  display: "block",
  margin: "5px 0 2px",
  color: "#142338",
  fontSize: "22px",
  fontWeight: 700,
};

const statHelper = {
  color: "#98a2b3",
  fontSize: "10px",
};

/* ============================================================
   CARDS
============================================================ */

const card = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  border: "1px solid #e8ebf1",
  boxShadow:
    "0 4px 18px rgba(11,31,58,.035)",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "15px",
  marginBottom: "18px",
};

const cardTitle = {
  margin: 0,
  color: "#142338",
  fontSize: "16px",
  fontWeight: 700,
};

const cardSubtitle = {
  margin: "5px 0 0",
  color: "#7b8495",
  fontSize: "12px",
  lineHeight: 1.45,
};

const badge = {
  background: "#edf7f9",
  color: "#137388",
  padding: "7px 11px",
  borderRadius: "20px",
  fontSize: "11px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const sectionIcon = {
  width: "34px",
  height: "34px",
  borderRadius: "9px",
  background: "#edf7f9",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: "#137388",
  fontWeight: 700,
};

/* ============================================================
   CHARTS
============================================================ */

const chartGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "20px",
};

const donutArea = {
  display: "flex",
  alignItems: "center",
  gap: "35px",
  minHeight: "220px",
};

const donut = {
  width: "180px",
  height: "180px",
  flexShrink: 0,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
};

const donutInner = {
  width: "118px",
  height: "118px",
  borderRadius: "50%",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  boxShadow:
    "0 2px 10px rgba(11,31,58,.05)",
};

const legend = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const legendItem = {
  display: "grid",
  gridTemplateColumns:
    "10px 1fr auto",
  alignItems: "center",
  gap: "8px",
};

const legendDot = {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
};

const legendLabel = {
  color: "#667085",
  fontSize: "12px",
};

const legendValue = {
  color: "#142338",
  fontSize: "12px",
};

const valueChart = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const financeBarRow = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
};

const financeBarHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "#667085",
  fontSize: "11px",
};

const financeBarTrack = {
  width: "100%",
  height: "8px",
  background: "#edf0f3",
  borderRadius: "20px",
  overflow: "hidden",
};

const financeBarFill = {
  height: "100%",
  borderRadius: "20px",
  transition:
    "width .5s ease",
};

const financeBarPercent = {
  color: "#98a2b3",
  fontSize: "9px",
};

const chartFooter = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "20px",
  paddingTop: "14px",
  borderTop:
    "1px solid #eef0f3",
  color: "#7b8495",
  fontSize: "11px",
};

/* ============================================================
   VENDOR CHART
============================================================ */

const vendorChart = {
  display: "flex",
  flexDirection: "column",
  gap: "15px",
};

const vendorRow = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const vendorRowTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
};

const vendorAvatar = {
  width: "27px",
  height: "27px",
  borderRadius: "8px",
  background: "#edf7f9",
  color: "#137388",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: "11px",
  fontWeight: 700,
  flexShrink: 0,
};

const vendorName = {
  color: "#475467",
  fontSize: "11px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const vendorAmount = {
  color: "#142338",
  fontSize: "11px",
  whiteSpace: "nowrap",
};

const vendorTrack = {
  width: "100%",
  height: "7px",
  borderRadius: "20px",
  background: "#eef1f4",
  overflow: "hidden",
};

const vendorFill = {
  height: "100%",
  borderRadius: "20px",
  background:
    "linear-gradient(90deg, #123f61, #137388)",
  transition:
    "width .5s ease",
};

const vendorMeta = {
  color: "#98a2b3",
  fontSize: "9px",
};

/* ============================================================
   HEALTH
============================================================ */

const healthMetric = {
  padding: "15px",
  borderRadius: "11px",
  background: "#f8fafc",
  border: "1px solid #eef0f3",
};

const healthMetricTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "#475467",
  fontSize: "12px",
  marginBottom: "9px",
};

const healthTrack = {
  width: "100%",
  height: "9px",
  background: "#e9edf2",
  borderRadius: "20px",
  overflow: "hidden",
};

const healthFill = {
  height: "100%",
  borderRadius: "20px",
  background:
    "linear-gradient(90deg, #137388, #67d7e8)",
  transition:
    "width .5s ease",
};

const healthGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "12px",
  marginTop: "13px",
};

const healthBox = {
  padding: "14px",
  background: "#fff",
  border: "1px solid #e8ebf1",
  borderRadius: "10px",
};

const redText = {
  color: "#b42318",
};

const healthNotice = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-start",
  padding: "13px",
  marginTop: "13px",
  background: "#edf7f9",
  borderRadius: "10px",
  color: "#123f61",
};

const healthNoticeIcon = {
  width: "26px",
  height: "26px",
  flexShrink: 0,
  borderRadius: "7px",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: "12px",
};

const miniEmpty = {
  minHeight: "200px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: "#98a2b3",
  fontSize: "12px",
};

/* ============================================================
   FILTERS
============================================================ */

const filterBar = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "15px",
};

const searchContainer = {
  flex: 1,
  minWidth: "220px",
  height: "38px",
  border:
    "1px solid #dfe4eb",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  padding: "0 11px",
  background: "#fff",
};

const searchIcon = {
  color: "#98a2b3",
  fontSize: "17px",
  marginRight: "7px",
};

const searchInput = {
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#344054",
  fontSize: "12px",
};

const select = {
  height: "38px",
  border:
    "1px solid #dfe4eb",
  borderRadius: "8px",
  padding: "0 12px",
  background: "#fff",
  color: "#475467",
  fontSize: "12px",
  outline: "none",
};

const clearButton = {
  height: "38px",
  border: "none",
  background: "#edf7f9",
  color: "#137388",
  borderRadius: "8px",
  padding: "0 12px",
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
};

/* ============================================================
   TABLE
============================================================ */

const tableWrapper = {
  width: "100%",
  overflowX: "auto",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "850px",
};

const th = {
  textAlign: "left",
  padding: "12px 10px",
  background: "#fafbfc",
  borderBottom:
    "1px solid #eaecf0",
  color: "#667085",
  fontSize: "10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".5px",
};

const td = {
  padding: "14px 10px",
  borderBottom:
    "1px solid #f0f1f3",
  color: "#475467",
  fontSize: "12px",
};

const poNumber = {
  color: "#123f61",
};

const vendorCell = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const smallAvatar = {
  width: "26px",
  height: "26px",
  borderRadius: "7px",
  background: "#edf7f9",
  color: "#137388",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "10px",
  fontWeight: 700,
  flexShrink: 0,
};

/* ============================================================
   STATUS
============================================================ */

const statusDotSmall = {
  fontSize: "7px",
  marginRight: "5px",
};

const completedStatus = {
  color: "#087443",
  background: "#ecfdf3",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "10px",
  fontWeight: 600,
};

const shippedStatus = {
  color: "#1d4ed8",
  background: "#eff6ff",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "10px",
  fontWeight: 600,
};

const approvedStatus = {
  color: "#6d28d9",
  background: "#f5f3ff",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "10px",
  fontWeight: 600,
};

const pendingStatus = {
  color: "#b45309",
  background: "#fff7e6",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "10px",
  fontWeight: 600,
};

const cancelledStatus = {
  color: "#b42318",
  background: "#fff1f0",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "10px",
  fontWeight: 600,
};

/* ============================================================
   REQUESTS
============================================================ */

const requestGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: "12px",
};

const requestCard = {
  padding: "16px",
  background: "#f8fafc",
  border:
    "1px solid #edf0f3",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const requestIcon = {
  width: "35px",
  height: "35px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  borderRadius: "9px",
  background: "#edf7f9",
  color: "#137388",
  fontWeight: 700,
};

const requestLabel = {
  display: "block",
  color: "#7b8495",
  fontSize: "10px",
  marginBottom: "2px",
};

const requestNumber = {
  display: "block",
  color: "#142338",
  fontSize: "18px",
};

/* ============================================================
   EMPTY / NOTE
============================================================ */

const emptyState = {
  minHeight: "190px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: "#475467",
};

const emptyIcon = {
  width: "50px",
  height: "50px",
  borderRadius: "12px",
  background: "#f2f4f7",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "21px",
  color: "#137388",
  marginBottom: "10px",
};

const dataNote = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
  padding: "15px 17px",
  background: "#f8fafc",
  border:
    "1px solid #e4e7ec",
  borderRadius: "11px",
  color: "#475467",
};

const dataNoteIcon = {
  width: "30px",
  height: "30px",
  flexShrink: 0,
  borderRadius: "8px",
  background: "#ecfdf3",
  color: "#087443",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "13px",
  fontWeight: 700,
};

/* ============================================================
   RESPONSIVE CSS
============================================================ */

const styleSheet = `
@keyframes financeSpin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1200px) {
  .finance-dashboard-stats {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .finance-dashboard-charts {
    grid-template-columns:
      1fr;
  }

  .finance-dashboard-request-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 650px) {
  .finance-dashboard-stats {
    grid-template-columns:
      1fr;
  }

  .finance-dashboard-request-grid {
    grid-template-columns:
      1fr;
  }
}
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById(
    "finance-dashboard-styles"
  )
) {
  const styleElement =
    document.createElement("style");

  styleElement.id =
    "finance-dashboard-styles";

  styleElement.innerHTML =
    styleSheet;

  document.head.appendChild(
    styleElement
  );
}

export default FinanceDashboard;