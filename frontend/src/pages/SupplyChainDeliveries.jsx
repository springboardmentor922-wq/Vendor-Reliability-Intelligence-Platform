import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import {
  getPurchaseOrders,
  deliverPurchaseOrder,
} from "../services/procurementService";

function SupplyChainDeliveries() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const data = await getPurchaseOrders();

      setOrders(
        Array.isArray(data)
          ? data
          : data?.items || data?.purchase_orders || []
      );
    } catch (err) {
      setError(err.message || "Unable to load deliveries");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeliver(orderId) {
    try {
      setActionLoading(orderId);
      setError("");
      setSuccess("");

      await deliverPurchaseOrder(orderId);

      setSuccess("Delivery marked as delivered successfully.");

      // Reload actual data from MySQL
      await loadOrders();
    } catch (err) {
      setError(err.message || "Unable to update delivery");
    } finally {
      setActionLoading(null);
    }
  }

  function getDeliveryStatus(order) {
    if (order.status === "delivered") {
      return "Delivered";
    }

    if (order.status === "shipped") {
      if (
        order.expected_delivery_date &&
        new Date(order.expected_delivery_date) < new Date()
      ) {
        return "Delayed";
      }

      return "In Transit";
    }

    if (order.status === "cancelled") {
      return "Cancelled";
    }

    if (order.status === "approved") {
      return "Scheduled";
    }

    if (
      order.expected_delivery_date &&
      new Date(order.expected_delivery_date) < new Date() &&
      order.status !== "delivered"
    ) {
      return "Delayed";
    }

    return "Pending";
  }

  const deliveries = orders.filter(
    (order) => order.status !== "cancelled"
  );

  const total = deliveries.length;

  const delivered = deliveries.filter(
    (order) => order.status === "delivered"
  ).length;

  const inTransit = deliveries.filter(
    (order) => order.status === "shipped"
  ).length;

  const delayed = deliveries.filter(
    (order) => getDeliveryStatus(order) === "Delayed"
  ).length;

  return (
    <DashboardLayout
      title="Deliveries"
      role="Supply Chain Manager"
      menuItems={[
        "Dashboard",
        "Suppliers",
        "Purchase Orders",
        "Deliveries",
        "Delayed Deliveries",
        "Performance",
        "Risk",
      ]}
    >
      <div style={header}>
        <h2>Delivery Tracking</h2>
        <p>
          Track incoming deliveries using actual purchase order data.
        </p>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {success && <div style={successBox}>{success}</div>}

      <div style={cards}>
        <Card label="Total Deliveries" value={total} />
        <Card label="Delivered" value={delivered} />
        <Card label="In Transit" value={inTransit} />
        <Card label="Delayed" value={delayed} />
      </div>

      <div style={box}>
        <div style={tableHeader}>
          <div>
            <h3 style={{ margin: 0 }}>Delivery Records</h3>
            <p style={subText}>
              Data is loaded from the purchase_orders table.
            </p>
          </div>

          <button
            onClick={loadOrders}
            disabled={loading}
            style={refreshButton}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p>Loading delivery records...</p>
        ) : deliveries.length === 0 ? (
          <div style={emptyBox}>
            <h4>No delivery records found</h4>
            <p>
              Approved or shipped purchase orders will appear here.
            </p>
          </div>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>PO Number</th>
                <th style={th}>Vendor ID</th>
                <th style={th}>Expected Date</th>
                <th style={th}>Actual Date</th>
                <th style={th}>Status</th>
                <th style={th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {deliveries.map((order) => {
                const deliveryStatus = getDeliveryStatus(order);

                return (
                  <tr key={order.id}>
                    <td style={td}>
                      <strong>
                        {order.order_number || `PO-${order.id}`}
                      </strong>
                    </td>

                    <td style={td}>
                      {order.vendor_id ?? "—"}
                    </td>

                    <td style={td}>
                      {order.expected_delivery_date || "—"}
                    </td>

                    <td style={td}>
                      {order.actual_delivery_date || "—"}
                    </td>

                    <td style={td}>
                      <span
                        style={getStatusStyle(deliveryStatus)}
                      >
                        {deliveryStatus}
                      </span>
                    </td>

                    <td style={td}>
                      {order.status === "shipped" ? (
                        <button
                          onClick={() => handleDeliver(order.id)}
                          disabled={actionLoading === order.id}
                          style={deliverButton}
                        >
                          {actionLoading === order.id
                            ? "Updating..."
                            : "Mark Delivered"}
                        </button>
                      ) : order.status === "delivered" ? (
                        <span style={completedText}>
                          ✓ Completed
                        </span>
                      ) : (
                        <span style={waitingText}>
                          Waiting for shipment
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}

function Card({ label, value }) {
  return (
    <div style={card}>
      <p style={cardLabel}>{label}</p>
      <strong style={cardValue}>{value}</strong>
    </div>
  );
}

function getStatusStyle(statusValue) {
  if (statusValue === "Delivered") {
    return {
      background: "#e8f7ee",
      color: "#16803c",
      padding: "6px 10px",
      borderRadius: "15px",
      fontSize: "12px",
      fontWeight: "600",
    };
  }

  if (statusValue === "Delayed") {
    return {
      background: "#fff0e0",
      color: "#b54708",
      padding: "6px 10px",
      borderRadius: "15px",
      fontSize: "12px",
      fontWeight: "600",
    };
  }

  if (statusValue === "In Transit") {
    return {
      background: "#e8f0ff",
      color: "#175cd3",
      padding: "6px 10px",
      borderRadius: "15px",
      fontSize: "12px",
      fontWeight: "600",
    };
  }

  if (statusValue === "Scheduled") {
    return {
      background: "#f0eaff",
      color: "#6941c6",
      padding: "6px 10px",
      borderRadius: "15px",
      fontSize: "12px",
      fontWeight: "600",
    };
  }

  return {
    background: "#f2f4f7",
    color: "#475467",
    padding: "6px 10px",
    borderRadius: "15px",
    fontSize: "12px",
    fontWeight: "600",
  };
}

const header = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "22px",
};

const cards = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "18px",
  marginBottom: "22px",
};

const card = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
};

const cardLabel = {
  margin: "0 0 8px",
  color: "#667085",
  fontSize: "14px",
};

const cardValue = {
  fontSize: "28px",
};

const box = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  overflowX: "auto",
};

const tableHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "18px",
};

const subText = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: "13px",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const th = {
  textAlign: "left",
  padding: "14px",
  background: "#f5f7fb",
  whiteSpace: "nowrap",
};

const td = {
  padding: "15px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
};

const deliverButton = {
  border: "none",
  background: "#1570ef",
  color: "#fff",
  padding: "8px 14px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
};

const refreshButton = {
  border: "1px solid #d0d5dd",
  background: "#fff",
  padding: "8px 14px",
  borderRadius: "8px",
  cursor: "pointer",
};

const completedText = {
  color: "#16803c",
  fontWeight: "600",
  fontSize: "13px",
};

const waitingText = {
  color: "#667085",
  fontSize: "13px",
};

const errorBox = {
  background: "#ffe8e8",
  color: "#b42318",
  padding: "12px 16px",
  borderRadius: "10px",
  marginBottom: "20px",
};

const successBox = {
  background: "#e8f7ee",
  color: "#16803c",
  padding: "12px 16px",
  borderRadius: "10px",
  marginBottom: "20px",
};

const emptyBox = {
  padding: "30px",
  textAlign: "center",
  color: "#667085",
};

export default SupplyChainDeliveries;