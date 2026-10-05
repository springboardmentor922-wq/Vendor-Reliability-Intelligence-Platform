import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

import {
  getPurchaseOrders,
  shipPurchaseOrder,
  deliverPurchaseOrder
} from "../services/procurementService";

function SupplyChainPurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(function () {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const data = await getPurchaseOrders();

      if (Array.isArray(data)) {
        setOrders(data);
      } else if (data && Array.isArray(data.items)) {
        setOrders(data.items);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to load purchase orders"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleShip(orderId) {
    try {
      setActionLoading(orderId);
      setError("");

      await shipPurchaseOrder(orderId);

      await loadOrders();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to ship purchase order"
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeliver(orderId) {
    try {
      setActionLoading(orderId);
      setError("");

      await deliverPurchaseOrder(orderId);

      await loadOrders();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to deliver purchase order"
      );
    } finally {
      setActionLoading(null);
    }
  }

  const total = orders.length;

  const pending = orders.filter(function (order) {
    return String(order.status).toLowerCase() === "pending";
  }).length;

  const accepted = orders.filter(function (order) {
    return String(order.status).toLowerCase() === "accepted";
  }).length;

  const shipped = orders.filter(function (order) {
    return String(order.status).toLowerCase() === "shipped";
  }).length;

  const delivered = orders.filter(function (order) {
    return String(order.status).toLowerCase() === "delivered";
  }).length;

  return (
    <DashboardLayout
      title="Supply Chain Purchase Orders"
      role="Supply Chain Manager"
      menuItems={[
        "Dashboard",
        "Suppliers",
        "Purchase Orders",
        "Deliveries",
        "Delayed Deliveries",
        "Performance",
        "Risk"
      ]}
    >
      <div style={header}>
        <h2>Supply Chain Purchase Orders</h2>

        <p>
          Manage shipment and delivery of accepted purchase orders.
        </p>
      </div>

      {error && (
        <div style={errorBox}>
          {error}
        </div>
      )}

      <div style={cards}>
        <Card label="Total Orders" value={total} />
        <Card label="Pending" value={pending} />
        <Card label="Accepted" value={accepted} />
        <Card label="Shipped" value={shipped} />
        <Card label="Delivered" value={delivered} />
      </div>

      <div style={box}>
        <h3>Purchase Orders</h3>

        {loading ? (
          <p>Loading purchase orders...</p>
        ) : orders.length === 0 ? (
          <p>No purchase orders found.</p>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>PO Number</th>
                <th style={th}>Vendor ID</th>
                <th style={th}>Order Date</th>
                <th style={th}>Expected Delivery</th>
                <th style={th}>Amount</th>
                <th style={th}>Status</th>
                <th style={th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {orders.map(function (order) {
                const status = String(
                  order.status || ""
                ).toLowerCase();

                const isProcessing =
                  actionLoading === order.id;

                return (
                  <tr key={order.id}>
                    <td style={td}>
                      {order.order_number || "PO-" + order.id}
                    </td>

                    <td style={td}>
                      {order.vendor_id !== null &&
                      order.vendor_id !== undefined
                        ? order.vendor_id
                        : "-"}
                    </td>

                    <td style={td}>
                      {order.order_date || "-"}
                    </td>

                    <td style={td}>
                      {order.expected_delivery_date || "-"}
                    </td>

                    <td style={td}>
                      {order.total_amount !== null &&
                      order.total_amount !== undefined
                        ? "₹" +
                          Number(
                            order.total_amount
                          ).toLocaleString("en-IN")
                        : "-"}
                    </td>

                    <td style={td}>
                      <span style={getStatusStyle(status)}>
                        {order.status || "Unknown"}
                      </span>
                    </td>

                    <td style={td}>
                      {status === "accepted" && (
                        <button
                          type="button"
                          style={button}
                          disabled={isProcessing}
                          onClick={function () {
                            handleShip(order.id);
                          }}
                        >
                          {isProcessing
                            ? "Processing..."
                            : "Ship"}
                        </button>
                      )}

                      {status === "shipped" && (
                        <button
                          type="button"
                          style={deliverButton}
                          disabled={isProcessing}
                          onClick={function () {
                            handleDeliver(order.id);
                          }}
                        >
                          {isProcessing
                            ? "Processing..."
                            : "Deliver"}
                        </button>
                      )}

                      {status === "delivered" && (
                        <span style={completed}>
                          Completed
                        </span>
                      )}

                      {status === "pending" && (
                        <span style={muted}>
                          Waiting for vendor
                        </span>
                      )}

                      {status === "cancelled" && (
                        <span style={cancelledText}>
                          Cancelled
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

function Card(props) {
  return (
    <div style={card}>
      <p style={cardLabel}>
        {props.label}
      </p>

      <strong style={cardValue}>
        {props.value}
      </strong>
    </div>
  );
}

function getStatusStyle(status) {
  if (status === "pending") {
    return {
      ...statusBase,
      background: "#fff4d6",
      color: "#9a6700"
    };
  }

  if (status === "accepted") {
    return {
      ...statusBase,
      background: "#e8f7ee",
      color: "#16803c"
    };
  }

  if (status === "shipped") {
    return {
      ...statusBase,
      background: "#e8f1ff",
      color: "#175cd3"
    };
  }

  if (status === "delivered") {
    return {
      ...statusBase,
      background: "#e8f7ee",
      color: "#16803c"
    };
  }

  if (status === "cancelled") {
    return {
      ...statusBase,
      background: "#ffe8e8",
      color: "#b42318"
    };
  }

  return {
    ...statusBase,
    background: "#f2f4f7",
    color: "#475467"
  };
}

const header = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "22px"
};

const cards = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "18px",
  marginBottom: "22px"
};

const card = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px"
};

const cardLabel = {
  margin: "0 0 8px",
  color: "#667085"
};

const cardValue = {
  fontSize: "24px"
};

const box = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  overflowX: "auto"
};

const table = {
  width: "100%",
  borderCollapse: "collapse"
};

const th = {
  textAlign: "left",
  padding: "14px",
  background: "#f5f7fb",
  whiteSpace: "nowrap"
};

const td = {
  padding: "15px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap"
};

const statusBase = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "15px",
  fontSize: "12px",
  textTransform: "capitalize"
};

const button = {
  border: "none",
  background: "#2563eb",
  color: "#fff",
  padding: "8px 14px",
  borderRadius: "8px",
  cursor: "pointer"
};

const deliverButton = {
  border: "none",
  background: "#16803c",
  color: "#fff",
  padding: "8px 14px",
  borderRadius: "8px",
  cursor: "pointer"
};

const completed = {
  color: "#16803c",
  fontSize: "13px",
  fontWeight: "600"
};

const muted = {
  color: "#667085",
  fontSize: "13px"
};

const cancelledText = {
  color: "#b42318",
  fontSize: "13px"
};

const errorBox = {
  background: "#ffe8e8",
  color: "#b42318",
  padding: "12px 16px",
  borderRadius: "10px",
  marginBottom: "20px"
};

export default SupplyChainPurchaseOrders;