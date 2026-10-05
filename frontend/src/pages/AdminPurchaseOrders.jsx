import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_BASE_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

function AdminPurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const menuItems = [
    "Dashboard",
    "Users",
    "Vendors",
    "Suppliers",
    "Purchase Orders",
    "Approvals",
    "Contracts",
    "Reports",
    "Notifications",
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    const token = getToken();

    if (!token) {
      setError("You are not logged in. Please login again.");
      setLoading(false);
      return;
    }

    try {
      const [ordersResponse, vendorsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/purchase-orders`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }),

        fetch(`${API_BASE_URL}/vendors`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }),
      ]);

      if (!ordersResponse.ok) {
        const data = await ordersResponse.json().catch(() => ({}));
        throw new Error(
          data.detail || "Failed to load purchase orders."
        );
      }

      if (!vendorsResponse.ok) {
        const data = await vendorsResponse.json().catch(() => ({}));
        throw new Error(
          data.detail || "Failed to load vendors."
        );
      }

      const ordersData = await ordersResponse.json();
      const vendorsData = await vendorsResponse.json();

      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setVendors(Array.isArray(vendorsData) ? vendorsData : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load purchase orders.");
    } finally {
      setLoading(false);
    }
  };

  const getVendorName = (vendorId) => {
    const vendor = vendors.find(
      (item) => Number(item.id) === Number(vendorId)
    );

    return vendor ? vendor.company_name : `Vendor #${vendorId}`;
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatAmount = (amount) => {
    return Number(amount || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    });
  };

  const getStatusStyle = (status) => {
    const styles = {
      pending: {
        background: "#fff4cc",
        color: "#8a6500",
      },
      approved: {
        background: "#e8f5e9",
        color: "#2e7d32",
      },
      shipped: {
        background: "#e3f2fd",
        color: "#1565c0",
      },
      delivered: {
        background: "#e8f5e9",
        color: "#1b5e20",
      },
      cancelled: {
        background: "#ffebee",
        color: "#c62828",
      },
    };

    return (
      styles[status] || {
        background: "#f1f1f1",
        color: "#555",
      }
    );
  };

  const handleAction = async (orderId, action) => {
    const token = getToken();

    if (!token) {
      setError("You are not logged in.");
      return;
    }

    setActionLoading(`${orderId}-${action}`);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/purchase-orders/${orderId}/${action}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || `Unable to ${action} purchase order.`
        );
      }

      await fetchData();
    } catch (err) {
      setError(err.message || "Action failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const renderActions = (order) => {
    const status = String(order.status || "").toLowerCase();

    if (status === "pending") {
      return (
        <div style={styles.actionGroup}>
          <button
            style={{
              ...styles.actionButton,
              ...styles.approveButton,
            }}
            disabled={actionLoading !== null}
            onClick={() => handleAction(order.id, "approve")}
          >
            {actionLoading === `${order.id}-approve`
              ? "Approving..."
              : "Approve"}
          </button>

          <button
            style={{
              ...styles.actionButton,
              ...styles.cancelButton,
            }}
            disabled={actionLoading !== null}
            onClick={() => {
              if (
                window.confirm(
                  `Cancel purchase order ${order.order_number}?`
                )
              ) {
                handleAction(order.id, "cancel");
              }
            }}
          >
            {actionLoading === `${order.id}-cancel`
              ? "..."
              : "Reject / Cancel"}
          </button>
        </div>
      );
    }

    if (status === "approved") {
      return (
        <span style={styles.waitingText}>
          Waiting for shipment
        </span>
      );
    }

    if (status === "shipped") {
      return (
        <span style={styles.waitingText}>
          Waiting for delivery
        </span>
      );
    }

    if (status === "delivered") {
      return (
        <span style={styles.completedText}>
          ✓ Delivered
        </span>
      );
    }

    if (status === "cancelled") {
      return (
        <span style={styles.cancelledText}>
          Cancelled
        </span>
      );
    }

    return <span>No action</span>;
  };

  const pending = orders.filter(
    (o) => String(o.status).toLowerCase() === "pending"
  ).length;

  const approved = orders.filter(
    (o) => String(o.status).toLowerCase() === "approved"
  ).length;

  const shipped = orders.filter(
    (o) => String(o.status).toLowerCase() === "shipped"
  ).length;

  const delivered = orders.filter(
    (o) => String(o.status).toLowerCase() === "delivered"
  ).length;

  return (
    <DashboardLayout
      title="Purchase Orders"
      role="Administrator"
      menuItems={menuItems}
    >
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Purchase Order Approval</h2>

            <p style={styles.subtitle}>
              Review and approve purchase orders created by
              Procurement Managers.
            </p>
          </div>

          <button
            style={styles.refreshButton}
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        <div style={styles.infoBox}>
          <strong>Administrator responsibility:</strong>
          {" "}
          Review pending purchase orders and approve or reject them.
          Shipment and delivery are handled by Procurement / Supply
          Chain.
        </div>

        {error && (
          <div style={styles.errorBox}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <div style={styles.summaryRow}>
          <div style={styles.summaryBox}>
            <span>Total Orders</span>
            <strong>{orders.length}</strong>
          </div>

          <div style={styles.summaryBox}>
            <span>Pending Approval</span>
            <strong>{pending}</strong>
          </div>

          <div style={styles.summaryBox}>
            <span>Approved</span>
            <strong>{approved}</strong>
          </div>

          <div style={styles.summaryBox}>
            <span>Shipped</span>
            <strong>{shipped}</strong>
          </div>

          <div style={styles.summaryBox}>
            <span>Delivered</span>
            <strong>{delivered}</strong>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>PO Number</th>
                <th style={styles.th}>Vendor</th>
                <th style={styles.th}>Order Date</th>
                <th style={styles.th}>Expected Delivery</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Admin Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={styles.emptyCell}>
                    Loading purchase orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="7" style={styles.emptyCell}>
                    No purchase orders found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const status = String(
                    order.status || ""
                  ).toLowerCase();

                  return (
                    <tr key={order.id}>
                      <td style={styles.td}>
                        <strong>{order.order_number}</strong>
                      </td>

                      <td style={styles.td}>
                        {getVendorName(order.vendor_id)}
                      </td>

                      <td style={styles.td}>
                        {formatDate(order.order_date)}
                      </td>

                      <td style={styles.td}>
                        {formatDate(
                          order.expected_delivery_date
                        )}
                      </td>

                      <td style={styles.td}>
                        {formatAmount(order.total_amount)}
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.status,
                            ...getStatusStyle(status),
                          }}
                        >
                          {status
                            ? status.charAt(0).toUpperCase() +
                              status.slice(1)
                            : "Unknown"}
                        </span>
                      </td>

                      <td style={styles.td}>
                        {renderActions(order)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

const styles = {
  card: {
    background: "white",
    padding: "30px",
    marginTop: "30px",
    borderRadius: "12px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
  },

  title: {
    margin: 0,
    color: "#17152f",
  },

  subtitle: {
    color: "#777",
    marginTop: "8px",
  },

  refreshButton: {
    padding: "11px 16px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    background: "white",
    cursor: "pointer",
    fontWeight: "600",
  },

  infoBox: {
    marginTop: "20px",
    padding: "15px",
    borderRadius: "8px",
    background: "#eef4ff",
    color: "#24508f",
    border: "1px solid #d7e4ff",
    fontSize: "14px",
  },

  errorBox: {
    marginTop: "20px",
    padding: "13px 16px",
    borderRadius: "8px",
    background: "#ffebee",
    color: "#c62828",
    border: "1px solid #ffcdd2",
  },

  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "15px",
    marginTop: "25px",
  },

  summaryBox: {
    padding: "18px",
    borderRadius: "9px",
    background: "#f7f7f9",
    border: "1px solid #ededf0",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "25px",
    minWidth: "1050px",
  },

  th: {
    textAlign: "left",
    padding: "14px 12px",
    background: "#f7f7f9",
    borderBottom: "1px solid #e5e5e5",
    color: "#444",
    fontSize: "13px",
  },

  td: {
    padding: "15px 12px",
    borderBottom: "1px solid #eeeeee",
    fontSize: "14px",
    color: "#333",
  },

  status: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: "15px",
    fontSize: "13px",
    fontWeight: "600",
  },

  actionGroup: {
    display: "flex",
    gap: "7px",
    flexWrap: "wrap",
  },

  actionButton: {
    padding: "8px 12px",
    border: "none",
    borderRadius: "6px",
    color: "white",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },

  approveButton: {
    background: "#2e7d32",
  },

  cancelButton: {
    background: "#c62828",
  },

  waitingText: {
    color: "#777",
    fontSize: "12px",
    fontWeight: "600",
  },

  completedText: {
    color: "#2e7d32",
    fontWeight: "600",
    fontSize: "12px",
  },

  cancelledText: {
    color: "#c62828",
    fontWeight: "600",
    fontSize: "12px",
  },

  emptyCell: {
    textAlign: "center",
    padding: "35px",
    color: "#777",
  },
};

export default AdminPurchaseOrders;