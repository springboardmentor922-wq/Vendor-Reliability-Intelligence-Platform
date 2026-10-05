import React, { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_BASE_URL = "http://127.0.0.1:8000";

function FinancePayments() {
  const [payments, setPayments] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const getToken = () => {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("access_token")
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "—";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatStatus = (value) => {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getPaymentStatus = (payment) => {
    return String(payment?.status || "pending").toLowerCase();
  };

  const getPurchaseOrderStatus = (order) => {
    return String(order?.status || "").toLowerCase();
  };

  const getPurchaseOrderAmount = (order) => {
    return Number(
      order?.total_amount ??
        order?.amount ??
        order?.expected_amount ??
        order?.estimated_amount ??
        order?.po_amount ??
        0
    );
  };

  const fetchData = useCallback(async () => {
    try {
      setError("");

      const token = getToken();

      if (!token) {
        throw new Error("Please login again.");
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [paymentsResponse, purchaseOrdersResponse] =
        await Promise.all([
          fetch(`${API_BASE_URL}/payments`, {
            method: "GET",
            headers,
          }),

          fetch(`${API_BASE_URL}/purchase-orders`, {
            method: "GET",
            headers,
          }),
        ]);

      if (!paymentsResponse.ok) {
        let message = "Unable to load payment data.";

        try {
          const data = await paymentsResponse.json();

          if (data?.detail) {
            message =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          }
        } catch {
          // Ignore JSON parsing errors.
        }

        throw new Error(message);
      }

      if (!purchaseOrdersResponse.ok) {
        let message = "Unable to load purchase order financial data.";

        try {
          const data = await purchaseOrdersResponse.json();

          if (data?.detail) {
            message =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          }
        } catch {
          // Ignore JSON parsing errors.
        }

        throw new Error(message);
      }

      const paymentsData = await paymentsResponse.json();
      const purchaseOrdersData = await purchaseOrdersResponse.json();

      const paymentItems = Array.isArray(paymentsData)
        ? paymentsData
        : Array.isArray(paymentsData?.items)
        ? paymentsData.items
        : Array.isArray(paymentsData?.data)
        ? paymentsData.data
        : [];

      const purchaseOrderItems = Array.isArray(purchaseOrdersData)
        ? purchaseOrdersData
        : Array.isArray(purchaseOrdersData?.items)
        ? purchaseOrdersData.items
        : Array.isArray(purchaseOrdersData?.data)
        ? purchaseOrdersData.data
        : [];

      console.log("Finance Payments API:", paymentItems);
      console.log("Purchase Orders API:", purchaseOrderItems);

      setPayments(paymentItems);
      setPurchaseOrders(purchaseOrderItems);
    } catch (err) {
      console.error("Finance payments error:", err);

      setError(err.message || "Unable to load finance data.");
      setPayments([]);
      setPurchaseOrders([]);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };

    load();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const paymentData = useMemo(() => {
    const completed = payments.filter(
      (payment) => getPaymentStatus(payment) === "completed"
    );

    const pendingPayments = payments.filter(
      (payment) => getPaymentStatus(payment) === "pending"
    );

    const processing = payments.filter(
      (payment) => getPaymentStatus(payment) === "processing"
    );

    const failed = payments.filter(
      (payment) => getPaymentStatus(payment) === "failed"
    );

    const cancelled = payments.filter(
      (payment) => getPaymentStatus(payment) === "cancelled"
    );

    // Only delivered purchase orders are included
    // in the financial calculation.
    const deliveredPurchaseOrders = purchaseOrders.filter(
      (order) => getPurchaseOrderStatus(order) === "delivered"
    );

    const totalFinancialValue = deliveredPurchaseOrders.reduce(
      (sum, order) => sum + getPurchaseOrderAmount(order),
      0
    );

    // Only completed Payment records count as paid.
    const completedValue = completed.reduce(
      (sum, payment) => sum + Number(payment?.amount || 0),
      0
    );

    const processingValue = processing.reduce(
      (sum, payment) => sum + Number(payment?.amount || 0),
      0
    );

    const pendingPaymentValue = pendingPayments.reduce(
      (sum, payment) => sum + Number(payment?.amount || 0),
      0
    );

    // This is the important calculation.
    // When Mark Paid creates a completed Payment,
    // completedValue increases and remaining value decreases.
    const remainingFinancialValue = Math.max(
      totalFinancialValue - completedValue,
      0
    );

    const completionPercentage =
      totalFinancialValue > 0
        ? Math.min(
            (completedValue / totalFinancialValue) * 100,
            100
          )
        : 0;

    return {
      completed,
      pendingPayments,
      processing,
      failed,
      cancelled,
      deliveredPurchaseOrders,
      totalFinancialValue,
      completedValue,
      processingValue,
      pendingValue: remainingFinancialValue,
      pendingPaymentValue,
      completionPercentage,
    };
  }, [payments, purchaseOrders]);

  return (
    <DashboardLayout
      title="Payments"
      role="Finance Officer"
      menuItems={[
        "Dashboard",
        "Purchase Orders",
        "Invoices",
        "Payments",
        "Financial Status",
        "Finance Reports",
        "Notifications",
      ]}
    >
      <div style={page}>
        <div style={header}>
          <div>
            <h2 style={title}>Payment Management</h2>

            <p style={subtitle}>
              Manage and monitor payments made against verified invoices.
            </p>
          </div>

          <button
            style={refreshButton}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <span style={refreshing ? spin : undefined}>↻</span>

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div style={errorBox}>
            <strong>Unable to load payment data</strong>
            <span>{error}</span>
          </div>
        )}

        <div style={cards}>
          <Card
            label="Completed"
            value={formatCurrency(paymentData.completedValue)}
            icon="✓"
          />

          <Card
            label="Remaining"
            value={formatCurrency(paymentData.pendingValue)}
            icon="◷"
          />

          <Card
            label="Processing"
            value={formatCurrency(paymentData.processingValue)}
            icon="↻"
          />

          <Card
            label="Payment Records"
            value={payments.length}
            icon="₹"
          />
        </div>

        <div style={financialSummary}>
          <div>
            <span style={summaryLabel}>
              Delivered PO Financial Value
            </span>

            <strong style={summaryValue}>
              {formatCurrency(paymentData.totalFinancialValue)}
            </strong>
          </div>

          <div>
            <span style={summaryLabel}>
              Completed Payments
            </span>

            <strong style={summaryValue}>
              {formatCurrency(paymentData.completedValue)}
            </strong>
          </div>

          <div>
            <span style={summaryLabel}>
              Remaining Financial Amount
            </span>

            <strong style={summaryValue}>
              {formatCurrency(paymentData.pendingValue)}
            </strong>
          </div>
        </div>

        <div style={completionBox}>
          <div style={completionHeader}>
            <div>
              <span style={summaryLabel}>
                Payment Completion
              </span>

              <strong style={completionValue}>
                {paymentData.completionPercentage.toFixed(1)}%
              </strong>
            </div>

            <span style={completionText}>
              Based on delivered purchase orders
            </span>
          </div>

          <div style={progressBackground}>
            <div
              style={{
                ...progressBar,
                width: `${paymentData.completionPercentage}%`,
              }}
            />
          </div>
        </div>

        <div style={box}>
          <div style={sectionHeader}>
            <div>
              <h3 style={sectionTitle}>
                Payment Records
              </h3>

              <p style={sectionSubtitle}>
                Actual payment transactions recorded against invoices
              </p>
            </div>

            <span style={recordCount}>
              {payments.length} Records
            </span>
          </div>

          {loading ? (
            <div style={emptyState}>
              <div style={loader}>⟳</div>
              <p>Loading payment records...</p>
            </div>
          ) : payments.length === 0 ? (
            <div style={emptyState}>
              <div style={emptyIcon}>₹</div>

              <h4>No payment records found</h4>

              <p>
                Payments will appear here after Finance processes
                verified invoices.
              </p>
            </div>
          ) : (
            <div style={tableWrapper}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Payment Number</th>
                    <th style={th}>Invoice</th>
                    <th style={th}>PO Number</th>
                    <th style={th}>Vendor</th>
                    <th style={th}>Amount</th>
                    <th style={th}>Payment Date</th>
                    <th style={th}>Method</th>
                    <th style={th}>Transaction Reference</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => {
                    const paymentStatus =
                      getPaymentStatus(payment);

                    return (
                      <tr
                        key={
                          payment.id ||
                          payment.payment_number
                        }
                      >
                        <td style={td}>
                          <strong style={paymentNumber}>
                            {payment.payment_number || "—"}
                          </strong>
                        </td>

                        <td style={td}>
                          {payment.invoice_number ||
                            `INV-${payment.invoice_id ?? "—"}`}
                        </td>

                        <td style={td}>
                          {payment.po_number ||
                            payment.purchase_order_number ||
                            `PO-${payment.purchase_order_id ?? "—"}`}
                        </td>

                        <td style={td}>
                          {payment.vendor_name ||
                            payment.company_name ||
                            `Vendor #${payment.vendor_id ?? "—"}`}
                        </td>

                        <td style={td}>
                          <strong>
                            {formatCurrency(payment.amount)}
                          </strong>
                        </td>

                        <td style={td}>
                          {formatDate(payment.payment_date)}
                        </td>

                        <td style={td}>
                          {payment.payment_method || "—"}
                        </td>

                        <td style={td}>
                          {payment.transaction_reference || "—"}
                        </td>

                        <td style={td}>
                          <StatusBadge
                            value={formatStatus(paymentStatus)}
                            type={paymentStatus}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {payments.length > 0 && (
          <div style={infoBox}>
            <span style={infoIcon}>ℹ</span>

            <span>
              Finance financial totals are calculated only from
              delivered purchase orders. Completed payment
              transactions are treated as paid. Pending and
              processing payments are not treated as completed.
              Cancelled and non-delivered purchase orders are
              excluded from the financial total.
            </span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Card({ label, value, icon }) {
  return (
    <div style={card}>
      <div style={cardIcon}>{icon}</div>

      <div>
        <p style={cardLabel}>{label}</p>

        <strong style={cardValue}>{value}</strong>
      </div>
    </div>
  );
}

function StatusBadge({ value, type }) {
  const normalized = String(type || "").toLowerCase();

  let badgeStyle = {
    background: "#f2f4f7",
    color: "#475467",
  };

  if (normalized === "completed") {
    badgeStyle = {
      background: "#e8f7ee",
      color: "#16803c",
    };
  } else if (normalized === "processing") {
    badgeStyle = {
      background: "#eef4ff",
      color: "#2854c5",
    };
  } else if (normalized === "pending") {
    badgeStyle = {
      background: "#fff7e6",
      color: "#b54708",
    };
  } else if (normalized === "failed") {
    badgeStyle = {
      background: "#fff1f1",
      color: "#b42318",
    };
  } else if (normalized === "cancelled") {
    badgeStyle = {
      background: "#f2f4f7",
      color: "#667085",
    };
  }

  return (
    <span
      style={{
        ...status,
        ...badgeStyle,
      }}
    >
      {value}
    </span>
  );
}

const page = {
  padding: "4px 0 30px",
};

const header = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "22px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "20px",
};

const title = {
  margin: 0,
  fontSize: "24px",
  color: "#17152f",
};

const subtitle = {
  margin: "7px 0 0",
  color: "#667085",
  fontSize: "14px",
};

const refreshButton = {
  border: "1px solid #d0d5dd",
  background: "#fff",
  color: "#344054",
  borderRadius: "9px",
  padding: "10px 16px",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const spin = {
  display: "inline-block",
  animation: "financePaymentsSpin 0.8s linear infinite",
};

const cards = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "18px",
  marginBottom: "22px",
};

const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  padding: "20px",
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  gap: "15px",
};

const cardIcon = {
  width: "46px",
  height: "46px",
  borderRadius: "11px",
  background: "#f0eef8",
  color: "#17152f",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: "18px",
};

const cardLabel = {
  margin: 0,
  color: "#667085",
  fontSize: "13px",
};

const cardValue = {
  display: "block",
  marginTop: "5px",
  color: "#17152f",
  fontSize: "21px",
};

const financialSummary = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "20px 24px",
  marginBottom: "22px",
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "20px",
};

const summaryLabel = {
  display: "block",
  color: "#667085",
  fontSize: "12px",
  marginBottom: "6px",
};

const summaryValue = {
  color: "#17152f",
  fontSize: "18px",
};

const completionBox = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "20px 24px",
  marginBottom: "22px",
};

const completionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "12px",
};

const completionValue = {
  color: "#17152f",
  fontSize: "22px",
};

const completionText = {
  color: "#667085",
  fontSize: "12px",
};

const progressBackground = {
  width: "100%",
  height: "9px",
  background: "#eaecf0",
  borderRadius: "20px",
  overflow: "hidden",
};

const progressBar = {
  height: "100%",
  background: "#17152f",
  borderRadius: "20px",
  transition: "width 0.4s ease",
};

const box = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  border: "1px solid #e5e7eb",
  overflow: "hidden",
};

const sectionHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "20px",
  gap: "15px",
};

const sectionTitle = {
  margin: 0,
  fontSize: "18px",
  color: "#17152f",
};

const sectionSubtitle = {
  margin: "5px 0 0",
  color: "#667085",
  fontSize: "13px",
};

const recordCount = {
  padding: "7px 11px",
  borderRadius: "20px",
  background: "#f2f4f7",
  color: "#475467",
  fontSize: "12px",
  fontWeight: 600,
};

const tableWrapper = {
  overflowX: "auto",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1250px",
};

const th = {
  textAlign: "left",
  padding: "13px 14px",
  background: "#f8fafc",
  color: "#667085",
  fontSize: "12px",
  fontWeight: 700,
  borderBottom: "1px solid #eaecf0",
  whiteSpace: "nowrap",
};

const td = {
  padding: "15px 14px",
  borderBottom: "1px solid #eaecf0",
  color: "#344054",
  fontSize: "13px",
  whiteSpace: "nowrap",
};

const paymentNumber = {
  color: "#17152f",
};

const status = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "11px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const emptyState = {
  padding: "55px 20px",
  textAlign: "center",
  color: "#667085",
};

const loader = {
  fontSize: "28px",
  animation: "financePaymentsSpin 1s linear infinite",
};

const emptyIcon = {
  fontSize: "32px",
  marginBottom: "8px",
};

const errorBox = {
  marginBottom: "18px",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #f0b4b4",
  background: "#fff7f7",
  color: "#b42318",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  fontSize: "13px",
};

const infoBox = {
  marginTop: "18px",
  padding: "15px 17px",
  borderRadius: "10px",
  border: "1px solid #dbe4ff",
  background: "#f7f9ff",
  color: "#344054",
  display: "flex",
  gap: "12px",
  fontSize: "13px",
};

const infoIcon = {
  fontSize: "17px",
};

if (!document.getElementById("finance-payments-style")) {
  const styleElement = document.createElement("style");

  styleElement.id = "finance-payments-style";

  styleElement.innerHTML = `
    @keyframes financePaymentsSpin {
      from {
        transform: rotate(0deg);
      }

      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 1000px) {
      .finance-summary {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 900px) {
      .finance-cards {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 600px) {
      .finance-cards {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(styleElement);
}

export default FinancePayments;