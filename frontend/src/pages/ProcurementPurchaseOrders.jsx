import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_BASE_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

function ProcurementPurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const menuItems = [
    "Dashboard",
    "Vendors",
    "Procurement Requests",
    "Purchase Orders",
    "Approvals",
    "Vendor Performance",
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

      if (
        ordersResponse.status === 401 ||
        vendorsResponse.status === 401
      ) {
        throw new Error("Session expired. Please login again.");
      }

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
      console.error("Purchase order loading error:", err);

      setError(
        err.message || "Unable to load purchase orders."
      );

    } finally {
      setLoading(false);
    }
  };

  const getVendorName = (vendorId) => {
    const vendor = vendors.find(
      (item) => Number(item.id) === Number(vendorId)
    );

    return vendor
      ? vendor.company_name
      : `Vendor #${vendorId}`;
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

  const formatAmount = (amount) => {
    const number = Number(amount || 0);

    return number.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    });
  };

  const getStatusStyle = (status) => {
    const stylesByStatus = {
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
      stylesByStatus[status] || {
        background: "#f1f1f1",
        color: "#555",
      }
    );
  };

  const formatStatus = (status) => {
    if (!status) return "Unknown";

    return (
      status.charAt(0).toUpperCase() +
      status.slice(1)
    );
  };

  const renderStatusMessage = (order) => {
    const status = String(
      order.status || ""
    ).toLowerCase();

    if (status === "pending") {
      return (
        <span style={styles.waitingText}>
          Waiting for Admin approval
        </span>
      );
    }

    if (status === "approved") {
      return (
        <span style={styles.waitingText}>
          Awaiting Supply Chain
        </span>
      );
    }

    if (status === "shipped") {
      return (
        <span style={styles.shippedText}>
          In transit
        </span>
      );
    }

    if (status === "delivered") {
      return (
        <span style={styles.completedText}>
          ✓ Completed
        </span>
      );
    }

    if (status === "cancelled") {
      return (
        <span style={styles.noActionText}>
          Cancelled
        </span>
      );
    }

    return (
      <span style={styles.noActionText}>
        No action
      </span>
    );
  };

  const pendingCount = orders.filter(
    (order) =>
      String(order.status || "").toLowerCase() === "pending"
  ).length;

  const approvedCount = orders.filter(
    (order) =>
      String(order.status || "").toLowerCase() === "approved"
  ).length;

  const shippedCount = orders.filter(
    (order) =>
      String(order.status || "").toLowerCase() === "shipped"
  ).length;

  const deliveredCount = orders.filter(
    (order) =>
      String(order.status || "").toLowerCase() === "delivered"
  ).length;

  return (
    <DashboardLayout
      title="Purchase Orders"
      role="Procurement Manager"
      menuItems={menuItems}
    >
      <div style={styles.card}>

        {/* HEADER */}
        <div style={styles.header}>

          <div>
            <h2 style={styles.title}>
              Purchase Orders
            </h2>

            <p style={styles.subtitle}>
              Track purchase orders generated from approved procurement requests.
            </p>
          </div>

          <button
            style={styles.refreshButton}
            onClick={fetchData}
            disabled={loading}
          >
            {loading
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>

        </div>


        {/* ERROR */}
        {error && (
          <div style={styles.errorBox}>
            <strong>Error:</strong> {error}
          </div>
        )}


        {/* WORKFLOW */}
        <div style={styles.workflowBox}>

          <div style={styles.workflowStep}>
            <span style={styles.stepNumber}>1</span>
            Procurement Request
          </div>

          <div style={styles.arrow}>
            →
          </div>

          <div style={styles.workflowStep}>
            <span style={styles.stepNumber}>2</span>
            Admin Approval
          </div>

          <div style={styles.arrow}>
            →
          </div>

          <div style={styles.workflowStep}>
            <span style={styles.stepNumber}>3</span>
            Convert to PO
          </div>

          <div style={styles.arrow}>
            →
          </div>

          <div style={styles.workflowStep}>
            <span style={styles.stepNumber}>4</span>
            Admin PO Approval
          </div>

          <div style={styles.arrow}>
            →
          </div>

          <div style={styles.workflowStep}>
            <span style={styles.stepNumber}>5</span>
            Supply Chain Ship
          </div>

          <div style={styles.arrow}>
            →
          </div>

          <div style={styles.workflowStep}>
            <span style={styles.stepNumber}>6</span>
            Supply Chain Deliver
          </div>

        </div>


        {/* INFORMATION */}
        <div style={styles.infoBox}>
          <strong>Purchase Order Workflow</strong>

          <p style={styles.infoText}>
            Purchase Orders are generated by converting approved
            Procurement Requests. The Administrator approves the PO,
            after which the Supply Chain Manager handles shipping and delivery.
          </p>
        </div>


        {/* SUMMARY */}
        <div style={styles.summaryRow}>

          <div style={styles.summaryBox}>
            <span style={styles.summaryLabel}>
              Total Orders
            </span>

            <strong style={styles.summaryValue}>
              {orders.length}
            </strong>
          </div>


          <div style={styles.summaryBox}>
            <span style={styles.summaryLabel}>
              Pending Approval
            </span>

            <strong style={styles.summaryValue}>
              {pendingCount}
            </strong>
          </div>


          <div style={styles.summaryBox}>
            <span style={styles.summaryLabel}>
              Approved
            </span>

            <strong style={styles.summaryValue}>
              {approvedCount}
            </strong>
          </div>


          <div style={styles.summaryBox}>
            <span style={styles.summaryLabel}>
              Shipped
            </span>

            <strong style={styles.summaryValue}>
              {shippedCount}
            </strong>
          </div>


          <div style={styles.summaryBox}>
            <span style={styles.summaryLabel}>
              Delivered
            </span>

            <strong style={styles.summaryValue}>
              {deliveredCount}
            </strong>
          </div>

        </div>


        {/* TABLE */}
        <div style={{ overflowX: "auto" }}>

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

                <th style={styles.th}>
                  Amount
                </th>

                <th style={styles.th}>
                  Status
                </th>

                <th style={styles.th}>
                  Workflow
                </th>

              </tr>

            </thead>


            <tbody>

              {loading ? (

                <tr>
                  <td
                    colSpan="7"
                    style={styles.emptyCell}
                  >
                    Loading purchase orders...
                  </td>
                </tr>

              ) : orders.length === 0 ? (

                <tr>
                  <td
                    colSpan="7"
                    style={styles.emptyCell}
                  >
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
                        <strong>
                          {order.order_number}
                        </strong>
                      </td>


                      <td style={styles.td}>
                        {getVendorName(
                          order.vendor_id
                        )}
                      </td>


                      <td style={styles.td}>
                        {formatDate(
                          order.order_date
                        )}
                      </td>


                      <td style={styles.td}>
                        {formatDate(
                          order.expected_delivery_date
                        )}
                      </td>


                      <td style={styles.td}>
                        {formatAmount(
                          order.total_amount
                        )}
                      </td>


                      <td style={styles.td}>

                        <span
                          style={{
                            ...styles.status,
                            ...getStatusStyle(status),
                          }}
                        >
                          {formatStatus(status)}
                        </span>

                      </td>


                      <td style={styles.td}>
                        {renderStatusMessage(order)}
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
    boxShadow:
      "0 4px 15px rgba(0,0,0,0.08)",
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
    marginBottom: 0,
  },

  refreshButton: {
    padding: "11px 16px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    background: "white",
    color: "#333",
    cursor: "pointer",
    fontWeight: "600",
  },

  errorBox: {
    marginTop: "20px",
    padding: "13px 16px",
    borderRadius: "8px",
    background: "#ffebee",
    color: "#c62828",
    border: "1px solid #ffcdd2",
  },

  workflowBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    marginTop: "25px",
    padding: "18px",
    background: "#f7f7f9",
    borderRadius: "10px",
    flexWrap: "wrap",
  },

  workflowStep: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "12px",
    fontWeight: "600",
    color: "#333",
  },

  stepNumber: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    background: "#17152f",
    color: "white",
    fontSize: "11px",
  },

  arrow: {
    color: "#999",
    fontWeight: "bold",
  },

  infoBox: {
    marginTop: "20px",
    padding: "16px 18px",
    borderRadius: "9px",
    background: "#f0f7ff",
    border: "1px solid #d5e8ff",
    color: "#174a7e",
  },

  infoText: {
    margin:
      "7px 0 0 0",
    color: "#555",
    fontSize: "13px",
    lineHeight: "1.5",
  },

  summaryRow: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "15px",
    marginTop: "25px",
  },

  summaryBox: {
    padding: "18px",
    borderRadius: "9px",
    background: "#f7f7f9",
    border:
      "1px solid #ededf0",
  },

  summaryLabel: {
    display: "block",
    fontSize: "13px",
    color: "#777",
    marginBottom: "6px",
  },

  summaryValue: {
    fontSize: "22px",
    color: "#17152f",
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
    borderBottom:
      "1px solid #e5e5e5",
    color: "#444",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "15px 12px",
    borderBottom:
      "1px solid #eeeeee",
    fontSize: "14px",
    color: "#333",
    whiteSpace: "nowrap",
  },

  status: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: "15px",
    fontSize: "13px",
    fontWeight: "600",
  },

  waitingText: {
    color: "#8a6500",
    fontSize: "12px",
    fontWeight: "600",
  },

  shippedText: {
    color: "#1565c0",
    fontSize: "12px",
    fontWeight: "600",
  },

  completedText: {
    color: "#2e7d32",
    fontSize: "12px",
    fontWeight: "600",
  },

  noActionText: {
    color: "#999",
    fontSize: "12px",
  },

  emptyCell: {
    textAlign: "center",
    padding: "35px",
    color: "#777",
  },
};

export default ProcurementPurchaseOrders;