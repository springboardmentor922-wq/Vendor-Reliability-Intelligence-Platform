import React, { useEffect, useState } from "react";
import RoleTablePage from "../components/RoleTablePage";

const API_URL = "http://127.0.0.1:8000";

function getToken() {
  var token = localStorage.getItem("access_token");

  if (!token) {
    token = sessionStorage.getItem("access_token");
  }

  if (!token) {
    token = localStorage.getItem("token");
  }

  if (!token) {
    token = sessionStorage.getItem("token");
  }

  return token || "";
}

function VendorPurchaseOrders() {
  var [orders, setOrders] = useState([]);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState("");
  var [processingId, setProcessingId] = useState(null);

  function loadOrders() {
    var token = getToken();

    if (!token) {
      setError("Please login again. Authentication token not found.");
      setLoading(false);
      return;
    }

    fetch(API_URL + "/vendors/purchase-orders", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token
      }
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return {
            ok: response.ok,
            data: data
          };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(
            result.data.detail || "Failed to load purchase orders"
          );
        }

        if (Array.isArray(result.data)) {
          setOrders(result.data);
        } else {
          setOrders([]);
        }

        setError("");
      })
      .catch(function (err) {
        console.error(err);
        setError(err.message || "Unable to load purchase orders");
      })
      .finally(function () {
        setLoading(false);
      });
  }

  useEffect(function () {
    loadOrders();
  }, []);

  function acceptOrder(id) {
    var token = getToken();

    setProcessingId(id);
    setError("");

    fetch(API_URL + "/vendors/purchase-orders/" + id + "/accept", {
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token
      }
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return {
            ok: response.ok,
            data: data
          };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(
            result.data.detail || "Failed to accept purchase order"
          );
        }

        alert("Purchase order accepted successfully.");
        loadOrders();
      })
      .catch(function (err) {
        alert(err.message || "Unable to accept purchase order");
      })
      .finally(function () {
        setProcessingId(null);
      });
  }

  function rejectOrder(id) {
    var confirmed = window.confirm(
      "Are you sure you want to reject this purchase order?"
    );

    if (!confirmed) {
      return;
    }

    var token = getToken();

    setProcessingId(id);
    setError("");

    fetch(API_URL + "/vendors/purchase-orders/" + id + "/reject", {
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token
      }
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return {
            ok: response.ok,
            data: data
          };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(
            result.data.detail || "Failed to reject purchase order"
          );
        }

        alert("Purchase order rejected successfully.");
        loadOrders();
      })
      .catch(function (err) {
        alert(err.message || "Unable to reject purchase order");
      })
      .finally(function () {
        setProcessingId(null);
      });
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }

    return new Date(value).toLocaleDateString("en-IN");
  }

  function formatAmount(value) {
    if (value === null || value === undefined) {
      return "-";
    }

    return "₹" + Number(value).toLocaleString("en-IN");
  }

  function statusStyle(status) {
    var value = String(status || "").toLowerCase();

    if (value === "pending") {
      return {
        padding: "5px 10px",
        borderRadius: "20px",
        background: "#fff3cd",
        color: "#856404",
        fontWeight: "600"
      };
    }

    if (value === "accepted") {
      return {
        padding: "5px 10px",
        borderRadius: "20px",
        background: "#d4edda",
        color: "#155724",
        fontWeight: "600"
      };
    }

    if (value === "shipped") {
      return {
        padding: "5px 10px",
        borderRadius: "20px",
        background: "#cce5ff",
        color: "#004085",
        fontWeight: "600"
      };
    }

    if (value === "delivered") {
      return {
        padding: "5px 10px",
        borderRadius: "20px",
        background: "#d1ecf1",
        color: "#0c5460",
        fontWeight: "600"
      };
    }

    if (value === "cancelled") {
      return {
        padding: "5px 10px",
        borderRadius: "20px",
        background: "#f8d7da",
        color: "#721c24",
        fontWeight: "600"
      };
    }

    return {
      padding: "5px 10px",
      borderRadius: "20px",
      background: "#eeeeee",
      color: "#555555",
      fontWeight: "600"
    };
  }

  function actionButtons(order) {
    var status = String(order.status || "").toLowerCase();

    if (status !== "pending") {
      return <span>No action</span>;
    }

    var busy = processingId === order.id;

    return (
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          disabled={busy}
          onClick={function () {
            acceptOrder(order.id);
          }}
          style={{
            padding: "6px 12px",
            border: "none",
            borderRadius: "5px",
            background: "#137388",
            color: "white",
            cursor: "pointer"
          }}
        >
          {busy ? "Processing" : "Accept"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={function () {
            rejectOrder(order.id);
          }}
          style={{
            padding: "6px 12px",
            border: "1px solid #d9534f",
            borderRadius: "5px",
            background: "white",
            color: "#d9534f",
            cursor: "pointer"
          }}
        >
          Reject
        </button>
      </div>
    );
  }

  var pending = orders.filter(function (item) {
    return String(item.status).toLowerCase() === "pending";
  }).length;

  var accepted = orders.filter(function (item) {
    return String(item.status).toLowerCase() === "accepted";
  }).length;

  var shipped = orders.filter(function (item) {
    return String(item.status).toLowerCase() === "shipped";
  }).length;

  var delivered = orders.filter(function (item) {
    return String(item.status).toLowerCase() === "delivered";
  }).length;

  var rows = orders.map(function (order) {
    return [
      order.order_number || "PO-" + order.id,
      formatDate(order.order_date),
      formatAmount(order.total_amount),
      formatDate(order.expected_delivery_date),
      <span style={statusStyle(order.status)}>
        {order.status || "-"}
      </span>,
      actionButtons(order)
    ];
  });

  var menuItems = [
    "Dashboard",
    "Profile",
    "Purchase Orders",
    "Deliveries",
    "Performance",
    "Risk Status",
    "Notifications"
  ];

  if (loading) {
    return (
      <RoleTablePage
        title="Purchase Orders"
        subtitle="Loading purchase orders..."
        role="Vendor"
        menuItems={menuItems}
        cards={[
          { label: "Total Orders", value: "..." },
          { label: "Pending", value: "..." },
          { label: "Accepted", value: "..." },
          { label: "Shipped", value: "..." },
          { label: "Delivered", value: "..." }
        ]}
        columns={[
          "PO Number",
          "Order Date",
          "Amount",
          "Delivery Date",
          "Status",
          "Action"
        ]}
        data={[]}
      />
    );
  }

  if (error) {
    return (
      <RoleTablePage
        title="Purchase Orders"
        subtitle={error}
        role="Vendor"
        menuItems={menuItems}
        cards={[
          { label: "Total Orders", value: 0 },
          { label: "Pending", value: 0 },
          { label: "Accepted", value: 0 },
          { label: "Shipped", value: 0 },
          { label: "Delivered", value: 0 }
        ]}
        columns={[
          "PO Number",
          "Order Date",
          "Amount",
          "Delivery Date",
          "Status",
          "Action"
        ]}
        data={[]}
      />
    );
  }

  return (
    <RoleTablePage
      title="Purchase Orders"
      subtitle="Purchase orders assigned to your vendor account."
      role="Vendor"
      menuItems={menuItems}
      cards={[
        { label: "Total Orders", value: orders.length },
        { label: "Pending", value: pending },
        { label: "Accepted", value: accepted },
        { label: "Shipped", value: shipped },
        { label: "Delivered", value: delivered }
      ]}
      columns={[
        "PO Number",
        "Order Date",
        "Amount",
        "Delivery Date",
        "Status",
        "Action"
      ]}
      data={rows}
    />
  );
}

export default VendorPurchaseOrders;