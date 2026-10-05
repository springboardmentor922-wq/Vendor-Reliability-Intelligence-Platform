import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

function getHeaders() {
  const token = getToken();

  return {
    Accept: "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

function formatDate(value) {
  if (!value) return "-";

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

function formatAmount(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });
}

function getStatusStyle(status) {
  const value = String(status || "").toLowerCase();

  if (value === "paid") {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (value === "verified") {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
    };
  }

  if (value === "pending") {
    return {
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  if (value === "rejected") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#374151",
  };
}

function getVendorName(invoice) {
  if (!invoice) return "-";

  if (invoice.vendor_name) {
    return invoice.vendor_name;
  }

  if (invoice.vendor) {
    if (typeof invoice.vendor === "string") {
      return invoice.vendor;
    }

    if (invoice.vendor.name) {
      return invoice.vendor.name;
    }

    if (invoice.vendor.company_name) {
      return invoice.vendor.company_name;
    }
  }

  if (invoice.vendor_id !== undefined && invoice.vendor_id !== null) {
    return `Vendor #${invoice.vendor_id}`;
  }

  return "-";
}

function getPONumber(invoice) {
  if (!invoice) return "-";

  if (invoice.purchase_order_number) {
    return invoice.purchase_order_number;
  }

  if (invoice.po_number) {
    return invoice.po_number;
  }

  if (invoice.purchase_order) {
    if (typeof invoice.purchase_order === "string") {
      return invoice.purchase_order;
    }

    if (invoice.purchase_order.po_number) {
      return invoice.purchase_order.po_number;
    }

    if (invoice.purchase_order.order_number) {
      return invoice.purchase_order.order_number;
    }
  }

  if (
    invoice.purchase_order_id !== undefined &&
    invoice.purchase_order_id !== null
  ) {
    return `PO #${invoice.purchase_order_id}`;
  }

  return "-";
}

function getInvoiceAmount(invoice) {
  if (!invoice) return 0;

  if (invoice.amount !== undefined && invoice.amount !== null) {
    return Number(invoice.amount);
  }

  if (invoice.total_amount !== undefined && invoice.total_amount !== null) {
    return Number(invoice.total_amount);
  }

  return 0;
}

function getErrorMessage(responseData, fallback) {
  if (!responseData) return fallback;

  if (typeof responseData.detail === "string") {
    return responseData.detail;
  }

  if (Array.isArray(responseData.detail)) {
    return responseData.detail
      .map((item) => item.msg || "Validation error")
      .join(", ");
  }

  if (typeof responseData.message === "string") {
    return responseData.message;
  }

  return fallback;
}

export default function FinanceInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadInvoices() {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      if (!token) {
        setError("You are not logged in. Please login again.");
        setInvoices([]);
        return;
      }

      const response = await fetch(`${API_BASE}/invoices`, {
        method: "GET",
        headers: getHeaders(),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        setError("Session expired. Please login again.");
        setInvoices([]);
        return;
      }

      if (response.status === 403) {
        setError(
          "Access denied. Only Finance Officer, Administrator, or Auditor can view invoices."
        );
        setInvoices([]);
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Failed to load invoices.")
        );
      }

      const invoiceList = Array.isArray(data)
        ? data
        : Array.isArray(data?.invoices)
        ? data.invoices
        : [];

      setInvoices(invoiceList);
    } catch (err) {
      console.error("Error loading invoices:", err);
      setError(err.message || "Unable to load invoices.");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  async function performAction(invoiceId, action, rejectionReason = "") {
    setActionLoading(`${action}-${invoiceId}`);
    setError("");
    setSuccess("");

    try {
      const token = getToken();

      if (!token) {
        setError("You are not logged in. Please login again.");
        return;
      }

      let url = `${API_BASE}/invoices/${invoiceId}/${action}`;

      if (action === "reject") {
        const encodedReason = encodeURIComponent(
          rejectionReason || "Invoice rejected by Finance Officer"
        );

        url += `?rejection_reason=${encodedReason}`;
      }

      const response = await fetch(url, {
        method: "PUT",
        headers: getHeaders(),
      });

      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        setError("Session expired. Please login again.");
        return;
      }

      if (response.status === 403) {
        setError("You do not have permission to perform this action.");
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, `Unable to ${action} invoice.`)
        );
      }

      if (action === "verify") {
        setSuccess("Invoice verified successfully.");
      } else if (action === "reject") {
        setSuccess("Invoice rejected successfully.");
      } else if (action === "pay") {
        setSuccess("Invoice marked as paid successfully.");
      }

      await loadInvoices();
    } catch (err) {
      console.error(`Error during ${action}:`, err);
      setError(err.message || `Unable to ${action} invoice.`);
    } finally {
      setActionLoading(null);
    }
  }

  function handleReject(invoiceId) {
    const reason = window.prompt(
      "Enter the reason for rejecting this invoice:"
    );

    if (reason === null) {
      return;
    }

    const finalReason =
      reason.trim() || "Invoice rejected by Finance Officer";

    performAction(invoiceId, "reject", finalReason);
  }

  const filteredInvoices = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const status = String(invoice.status || "").toLowerCase();

      const matchesStatus =
        statusFilter === "all" || status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      const invoiceNumber = String(
        invoice.invoice_number || ""
      ).toLowerCase();

      const vendorName = getVendorName(invoice).toLowerCase();

      const poNumber = getPONumber(invoice).toLowerCase();

      return (
        invoiceNumber.includes(searchValue) ||
        vendorName.includes(searchValue) ||
        poNumber.includes(searchValue) ||
        status.includes(searchValue)
      );
    });
  }, [invoices, search, statusFilter]);

  const summary = useMemo(() => {
    const total = invoices.length;

    const pending = invoices.filter(
      (invoice) =>
        String(invoice.status || "").toLowerCase() === "pending"
    ).length;

    const verified = invoices.filter(
      (invoice) =>
        String(invoice.status || "").toLowerCase() === "verified"
    ).length;

    const paid = invoices.filter(
      (invoice) =>
        String(invoice.status || "").toLowerCase() === "paid"
    ).length;

    const rejected = invoices.filter(
      (invoice) =>
        String(invoice.status || "").toLowerCase() === "rejected"
    ).length;

    const totalAmount = invoices.reduce(
      (sum, invoice) => sum + getInvoiceAmount(invoice),
      0
    );

    return {
      total,
      pending,
      verified,
      paid,
      rejected,
      totalAmount,
    };
  }, [invoices]);

  return (
    <div
      style={{
        padding: "28px",
        background: "#f8fafc",
        minHeight: "100vh",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              fontWeight: "700",
            }}
          >
            Finance Invoices
          </h1>

          <p
            style={{
              marginTop: "7px",
              marginBottom: 0,
              color: "#64748b",
              fontSize: "15px",
            }}
          >
            Manage vendor invoices, verification and payments
          </p>
        </div>

        <button
          type="button"
          onClick={loadInvoices}
          disabled={loading}
          style={{
            border: "none",
            borderRadius: "9px",
            padding: "11px 18px",
            background: "#2563eb",
            color: "#ffffff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "600",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "18px",
            padding: "14px 16px",
            borderRadius: "10px",
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            marginBottom: "18px",
            padding: "14px 16px",
            borderRadius: "10px",
            background: "#dcfce7",
            color: "#166534",
            border: "1px solid #bbf7d0",
          }}
        >
          {success}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <SummaryCard title="Total Invoices" value={summary.total} icon="🧾" />
        <SummaryCard title="Pending" value={summary.pending} icon="⏳" />
        <SummaryCard title="Verified" value={summary.verified} icon="✓" />
        <SummaryCard title="Paid" value={summary.paid} icon="₹" />
        <SummaryCard title="Rejected" value={summary.rejected} icon="✕" />
        <SummaryCard
          title="Invoice Value"
          value={formatAmount(summary.totalAmount)}
          icon="💰"
        />
      </div>

      <div
        style={{
          background: "#ffffff",
          borderRadius: "14px",
          padding: "18px",
          marginBottom: "20px",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Search invoice, vendor or PO..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{
              flex: "1 1 280px",
              minWidth: "220px",
              padding: "12px 14px",
              border: "1px solid #cbd5e1",
              borderRadius: "9px",
              outline: "none",
              fontSize: "14px",
            }}
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{
              padding: "12px 14px",
              border: "1px solid #cbd5e1",
              borderRadius: "9px",
              background: "#ffffff",
              fontSize: "14px",
              minWidth: "160px",
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: "700",
            }}
          >
            Invoice Records
          </h2>
        </div>

        {loading ? (
          <div
            style={{
              padding: "50px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            Loading invoices...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <div
              style={{
                fontSize: "42px",
                marginBottom: "12px",
              }}
            >
              🧾
            </div>

            <div
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#334155",
                marginBottom: "6px",
              }}
            >
              No invoices available
            </div>

            <div style={{ fontSize: "14px" }}>
              Vendor invoices will appear here after they are submitted.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1050px",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <th style={tableHeaderStyle}>Invoice</th>
                  <th style={tableHeaderStyle}>Vendor</th>
                  <th style={tableHeaderStyle}>Purchase Order</th>
                  <th style={tableHeaderStyle}>Invoice Date</th>
                  <th style={tableHeaderStyle}>Due Date</th>
                  <th style={tableHeaderStyle}>Amount</th>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredInvoices.map((invoice) => {
                  const status = String(
                    invoice.status || ""
                  ).toLowerCase();

                  const invoiceId = invoice.id;

                  return (
                    <tr
                      key={invoiceId}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <td style={tableCellStyle}>
                        <div
                          style={{
                            fontWeight: "700",
                            color: "#1e293b",
                          }}
                        >
                          {invoice.invoice_number ||
                            `INV-${invoiceId}`}
                        </div>
                      </td>

                      <td style={tableCellStyle}>
                        {getVendorName(invoice)}
                      </td>

                      <td style={tableCellStyle}>
                        {getPONumber(invoice)}
                      </td>

                      <td style={tableCellStyle}>
                        {formatDate(invoice.invoice_date)}
                      </td>

                      <td style={tableCellStyle}>
                        {formatDate(invoice.due_date)}
                      </td>

                      <td style={tableCellStyle}>
                        <strong>
                          {formatAmount(getInvoiceAmount(invoice))}
                        </strong>
                      </td>

                      <td style={tableCellStyle}>
                        <span
                          style={{
                            ...getStatusStyle(status),
                            display: "inline-block",
                            padding: "6px 10px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: "700",
                            textTransform: "capitalize",
                          }}
                        >
                          {status || "Unknown"}
                        </span>
                      </td>

                      <td style={tableCellStyle}>
                        {status === "pending" && (
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              disabled={
                                actionLoading ===
                                `verify-${invoiceId}`
                              }
                              onClick={() =>
                                performAction(invoiceId, "verify")
                              }
                              style={actionButtonStyle("#16a34a")}
                            >
                              {actionLoading ===
                              `verify-${invoiceId}`
                                ? "Verifying..."
                                : "Verify"}
                            </button>

                            <button
                              type="button"
                              disabled={
                                actionLoading ===
                                `reject-${invoiceId}`
                              }
                              onClick={() =>
                                handleReject(invoiceId)
                              }
                              style={actionButtonStyle("#dc2626")}
                            >
                              {actionLoading ===
                              `reject-${invoiceId}`
                                ? "Rejecting..."
                                : "Reject"}
                            </button>
                          </div>
                        )}

                        {status === "verified" && (
                          <button
                            type="button"
                            disabled={
                              actionLoading ===
                              `pay-${invoiceId}`
                            }
                            onClick={() =>
                              performAction(invoiceId, "pay")
                            }
                            style={actionButtonStyle("#2563eb")}
                          >
                            {actionLoading === `pay-${invoiceId}`
                              ? "Processing..."
                              : "Mark Paid"}
                          </button>
                        )}

                        {status === "paid" && (
                          <span
                            style={{
                              color: "#166534",
                              fontWeight: "600",
                              fontSize: "13px",
                            }}
                          >
                            ✓ Payment Complete
                          </span>
                        )}

                        {status === "rejected" && (
                          <div>
                            <span
                              style={{
                                color: "#991b1b",
                                fontWeight: "600",
                                fontSize: "13px",
                              }}
                            >
                              Rejected
                            </span>

                            {invoice.rejection_reason && (
                              <div
                                style={{
                                  marginTop: "4px",
                                  color: "#64748b",
                                  fontSize: "12px",
                                  maxWidth: "180px",
                                }}
                              >
                                {invoice.rejection_reason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "18px",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            color: "#64748b",
            fontSize: "13px",
            fontWeight: "600",
          }}
        >
          {title}
        </span>

        <span style={{ fontSize: "20px" }}>{icon}</span>
      </div>

      <div
        style={{
          fontSize: "23px",
          fontWeight: "700",
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const tableHeaderStyle = {
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "12px",
  fontWeight: "700",
  color: "#64748b",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tableCellStyle = {
  padding: "15px 16px",
  fontSize: "13px",
  color: "#334155",
  verticalAlign: "middle",
};

function actionButtonStyle(background) {
  return {
    border: "none",
    borderRadius: "7px",
    padding: "7px 11px",
    background,
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  };
}