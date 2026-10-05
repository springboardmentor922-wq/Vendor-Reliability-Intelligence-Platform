import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

function formatCurrency(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(number);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-IN");
}

function getOrderNumber(order) {
  return (
    order?.po_number ||
    order?.purchase_order_number ||
    order?.order_number ||
    order?.number ||
    "PO-" + String(order?.id || "")
  );
}

function getVendorName(order) {
  if (order?.vendor_name) {
    return order.vendor_name;
  }

  if (order?.vendor?.name) {
    return order.vendor.name;
  }

  if (order?.vendor?.company_name) {
    return order.vendor.company_name;
  }

  if (order?.supplier_name) {
    return order.supplier_name;
  }

  if (order?.vendor_id) {
    return "Vendor #" + String(order.vendor_id);
  }

  return "-";
}

function getAmount(order) {
  return Number(
    order?.total_amount ??
      order?.amount ??
      order?.total_value ??
      order?.estimated_amount ??
      0
  );
}

function getPOStatus(order) {
  return String(
    order?.status ||
      order?.po_status ||
      order?.purchase_order_status ||
      ""
  ).toLowerCase();
}

function getStatusLabel(status) {
  const value = String(status || "").toLowerCase();

  if (value === "delivered") {
    return "Delivered";
  }

  if (value === "cancelled" || value === "canceled") {
    return "Cancelled";
  }

  if (value === "paid") {
    return "Paid";
  }

  if (value === "processing") {
    return "Processing";
  }

  if (value === "payment pending" || value === "pending") {
    return "Payment Pending";
  }

  if (value === "payment failed" || value === "failed") {
    return "Payment Failed";
  }

  if (value === "payment cancelled") {
    return "Payment Cancelled";
  }

  return status || "Payment Pending";
}

function StatusBadge({ status }) {
  const value = String(status || "").toLowerCase();

  let className = "status-badge pending";

  if (value === "paid") {
    className = "status-badge paid";
  } else if (value === "processing") {
    className = "status-badge processing";
  } else if (value === "payment failed" || value === "failed") {
    className = "status-badge failed";
  } else if (value === "payment cancelled") {
    className = "status-badge cancelled";
  }

  return (
    <span className={className}>
      {getStatusLabel(status)}
    </span>
  );
}

function getPaymentsForPO(order, payments) {
  const poId = order?.id;

  if (!poId) {
    return [];
  }

  return payments.filter(function (payment) {
    const paymentPOId =
      payment?.purchase_order_id ??
      payment?.purchaseOrderId ??
      payment?.po_id;

    return Number(paymentPOId) === Number(poId);
  });
}

function getInvoicesForPO(order, invoices) {
  const poId = order?.id;

  if (!poId) {
    return [];
  }

  return invoices.filter(function (invoice) {
    const invoicePOId =
      invoice?.purchase_order_id ??
      invoice?.purchaseOrderId ??
      invoice?.po_id;

    return Number(invoicePOId) === Number(poId);
  });
}

function getFinancialStatus(order, payments, invoices) {
  const poPayments = getPaymentsForPO(order, payments);

  const hasCompletedPayment = poPayments.some(function (payment) {
    return String(payment?.status || "").toLowerCase() === "completed";
  });

  if (hasCompletedPayment) {
    return "Paid";
  }

  const hasProcessingPayment = poPayments.some(function (payment) {
    return String(payment?.status || "").toLowerCase() === "processing";
  });

  if (hasProcessingPayment) {
    return "Processing";
  }

  const hasPendingPayment = poPayments.some(function (payment) {
    return String(payment?.status || "").toLowerCase() === "pending";
  });

  if (hasPendingPayment) {
    return "Payment Pending";
  }

  const hasFailedPayment = poPayments.some(function (payment) {
    return String(payment?.status || "").toLowerCase() === "failed";
  });

  if (hasFailedPayment) {
    return "Payment Failed";
  }

  const hasCancelledPayment = poPayments.some(function (payment) {
    return String(payment?.status || "").toLowerCase() === "cancelled";
  });

  if (hasCancelledPayment) {
    return "Payment Cancelled";
  }

  const poInvoices = getInvoicesForPO(order, invoices);

  const hasPaidInvoice = poInvoices.some(function (invoice) {
    return String(invoice?.status || "").toLowerCase() === "paid";
  });

  if (hasPaidInvoice) {
    return "Paid";
  }

  return "Payment Pending";
}

function extractArray(data) {
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

export default function FinanceStatus() {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchFinancialData = useCallback(async function () {
    try {
      setError("");

      const token = getToken();

      const headers = {
        Accept: "application/json",
      };

      if (token) {
        headers.Authorization = "Bearer " + token;
      }

      const responses = await Promise.all([
        fetch(API_BASE_URL + "/purchase-orders", {
          method: "GET",
          headers: headers,
        }),

        fetch(API_BASE_URL + "/payments", {
          method: "GET",
          headers: headers,
        }),

        fetch(API_BASE_URL + "/invoices", {
          method: "GET",
          headers: headers,
        }),
      ]);

      if (!responses[0].ok) {
        throw new Error(
          "Failed to load purchase orders. Status: " +
            responses[0].status
        );
      }

      if (!responses[1].ok) {
        throw new Error(
          "Failed to load payments. Status: " +
            responses[1].status
        );
      }

      if (!responses[2].ok) {
        throw new Error(
          "Failed to load invoices. Status: " +
            responses[2].status
        );
      }

      const purchaseOrderData = await responses[0].json();
      const paymentData = await responses[1].json();
      const invoiceData = await responses[2].json();

      const purchaseOrderList = extractArray(purchaseOrderData);
      const paymentList = extractArray(paymentData);
      const invoiceList = extractArray(invoiceData);

      setPurchaseOrders(purchaseOrderList);
      setPayments(paymentList);
      setInvoices(invoiceList);

      console.log("Financial Status - Purchase Orders:", purchaseOrderList);
      console.log("Financial Status - Payments:", paymentList);
      console.log("Financial Status - Invoices:", invoiceList);
    } catch (err) {
      console.error("Financial Status error:", err);

      setError(
        err?.message ||
          "Unable to load financial status data."
      );
    }
  }, []);

  useEffect(
    function () {
      async function loadData() {
        setLoading(true);
        await fetchFinancialData();
        setLoading(false);
      }

      loadData();
    },
    [fetchFinancialData]
  );

  async function handleRefresh() {
    setRefreshing(true);
    await fetchFinancialData();
    setRefreshing(false);
  }

  const deliveredOrders = useMemo(
    function () {
      return purchaseOrders.filter(function (order) {
        return getPOStatus(order) === "delivered";
      });
    },
    [purchaseOrders]
  );

  const totalFinancialValue = useMemo(
    function () {
      return deliveredOrders.reduce(function (total, order) {
        return total + getAmount(order);
      }, 0);
    },
    [deliveredOrders]
  );

  const completedValue = useMemo(
    function () {
      return deliveredOrders.reduce(function (total, order) {
        const poPayments = getPaymentsForPO(order, payments);

        const amount = poPayments
          .filter(function (payment) {
            return (
              String(payment?.status || "").toLowerCase() ===
              "completed"
            );
          })
          .reduce(function (sum, payment) {
            return sum + Number(payment?.amount || 0);
          }, 0);

        return total + amount;
      }, 0);
    },
    [deliveredOrders, payments]
  );

  const pendingValue = Math.max(
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

  if (loading) {
    return (
      <div className="finance-status-page">
        <div className="finance-status-loading">
          Loading Financial Status...
        </div>
      </div>
    );
  }

  return (
    <div className="finance-status-page">
      <div className="finance-status-header">
        <div>
          <h1>Financial Status</h1>
          <p>
            Track payment status against delivered purchase orders.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="refresh-button"
        >
          {refreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <div className="finance-status-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="financial-summary-grid">
        <div className="financial-card">
          <div className="financial-card-icon">₹</div>

          <div>
            <p>Total Financial Value</p>
            <h2>{formatCurrency(totalFinancialValue)}</h2>
          </div>
        </div>

        <div className="financial-card">
          <div className="financial-card-icon">✓</div>

          <div>
            <p>Completed Value</p>
            <h2>{formatCurrency(completedValue)}</h2>
          </div>
        </div>

        <div className="financial-card">
          <div className="financial-card-icon">◷</div>

          <div>
            <p>Pending Value</p>
            <h2>{formatCurrency(pendingValue)}</h2>
          </div>
        </div>

        <div className="financial-card">
          <div className="financial-card-icon">%</div>

          <div>
            <p>Payment Completion</p>
            <h2>{completionPercentage.toFixed(1)}%</h2>
          </div>
        </div>
      </div>

      <div className="financial-status-section">
        <div className="section-header">
          <div>
            <h2>Financial Status Records</h2>
            <p>
              Payment status for delivered purchase orders
            </p>
          </div>

          <span className="record-count">
            {deliveredOrders.length} Records
          </span>
        </div>

        {deliveredOrders.length === 0 ? (
          <div className="empty-state">
            <h3>No delivered purchase orders</h3>
            <p>
              Financial status records will appear after a purchase
              order is delivered.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="financial-status-table">
              <thead>
                <tr>
                  <th>Purchase Order</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>PO Status</th>
                  <th>Financial Status</th>
                </tr>
              </thead>

              <tbody>
                {deliveredOrders.map(function (order) {
                  const financialStatus = getFinancialStatus(
                    order,
                    payments,
                    invoices
                  );

                  return (
                    <tr key={order.id}>
                      <td>
                        <strong>
                          {getOrderNumber(order)}
                        </strong>
                      </td>

                      <td>{getVendorName(order)}</td>

                      <td>
                        {formatCurrency(getAmount(order))}
                      </td>

                      <td>
                        <span className="po-status-badge">
                          {getPOStatus(order) === "delivered"
                            ? "Delivered"
                            : getPOStatus(order)}
                        </span>
                      </td>

                      <td>
                        <StatusBadge status={financialStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="financial-note">
        <strong>Note:</strong> Total Financial Value represents the
        value of delivered purchase orders. Completed Value represents
        payments recorded as completed. Pending Value is the remaining
        amount.
      </div>

      <style>{`
        .finance-status-page {
          padding: 24px;
          background: #f8fafc;
          min-height: 100vh;
        }

        .finance-status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        .finance-status-header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: #111827;
        }

        .finance-status-header p {
          margin: 6px 0 0;
          color: #6b7280;
        }

        .refresh-button {
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          background: #111827;
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        }

        .refresh-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .finance-status-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 14px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .financial-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-bottom: 28px;
        }

        .financial-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .financial-card-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          color: #111827;
          font-weight: 700;
          font-size: 20px;
          flex-shrink: 0;
        }

        .financial-card p {
          margin: 0 0 5px;
          color: #6b7280;
          font-size: 13px;
        }

        .financial-card h2 {
          margin: 0;
          color: #111827;
          font-size: 21px;
        }

        .financial-status-section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        .section-header {
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .section-header h2 {
          margin: 0;
          font-size: 20px;
          color: #111827;
        }

        .section-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .record-count {
          background: #f3f4f6;
          padding: 7px 12px;
          border-radius: 20px;
          font-size: 13px;
          color: #374151;
          font-weight: 600;
        }

        .table-container {
          width: 100%;
          overflow-x: auto;
        }

        .financial-status-table {
          width: 100%;
          border-collapse: collapse;
        }

        .financial-status-table th {
          text-align: left;
          padding: 14px 18px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .financial-status-table td {
          padding: 15px 18px;
          border-bottom: 1px solid #f1f5f9;
          color: #374151;
          font-size: 14px;
        }

        .financial-status-table tbody tr:hover {
          background: #f9fafb;
        }

        .status-badge,
        .po-status-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .po-status-badge {
          background: #ecfdf5;
          color: #047857;
        }

        .status-badge.paid {
          background: #dcfce7;
          color: #166534;
        }

        .status-badge.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status-badge.processing {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .status-badge.failed {
          background: #fee2e2;
          color: #b91c1c;
        }

        .status-badge.cancelled {
          background: #f3f4f6;
          color: #4b5563;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-state h3 {
          margin: 0 0 8px;
          color: #111827;
        }

        .empty-state p {
          margin: 0;
          color: #6b7280;
        }

        .financial-note {
          margin-top: 18px;
          padding: 14px 16px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          color: #6b7280;
          font-size: 13px;
        }

        .finance-status-loading {
          padding: 50px;
          text-align: center;
          color: #6b7280;
        }

        @media (max-width: 1000px) {
          .financial-summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .finance-status-page {
            padding: 14px;
          }

          .finance-status-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .financial-summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}