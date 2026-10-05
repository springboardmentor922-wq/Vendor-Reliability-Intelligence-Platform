import React, { useEffect, useState } from "react";
import RoleTablePage from "../components/RoleTablePage";

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

function VendorDeliveries() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      const token = getToken();

      const response = await fetch(
        `${API_URL}/vendor/purchase-orders`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Failed to load deliveries");
      }

      const unique = Array.isArray(data)
        ? data.filter(
            (item, index, array) =>
              index ===
              array.findIndex((x) => x.id === item.id)
          )
        : [];

      setOrders(unique);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const today = new Date();

  const getDeliveryStatus = (order) => {
    const status = String(order.status || "").toLowerCase();

    if (status === "delivered") return "Delivered";
    if (status === "shipped") return "In Transit";
    if (status === "cancelled") return "Cancelled";

    if (
      order.expected_delivery_date &&
      new Date(order.expected_delivery_date) < today
    ) {
      return "Delayed";
    }

    return "Scheduled";
  };

  const deliveries = orders.filter(
    (order) =>
      String(order.status || "").toLowerCase() !== "cancelled"
  );

  const delivered = deliveries.filter(
    (order) => getDeliveryStatus(order) === "Delivered"
  ).length;

  const inTransit = deliveries.filter(
    (order) => getDeliveryStatus(order) === "In Transit"
  ).length;

  const scheduled = deliveries.filter(
    (order) => getDeliveryStatus(order) === "Scheduled"
  ).length;

  const delayed = deliveries.filter(
    (order) => getDeliveryStatus(order) === "Delayed"
  ).length;

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const tableData = deliveries.map((order) => [
    order.order_number || `PO-${order.id}`,
    formatDate(order.expected_delivery_date),
    order.actual_delivery_date
      ? formatDate(order.actual_delivery_date)
      : "-",
    getDeliveryStatus(order),
  ]);

  return (
    <RoleTablePage
      title="Deliveries"
      subtitle={
        loading
          ? "Loading delivery information..."
          : "Track delivery status from your purchase orders."
      }
      role="Vendor"
      menuItems={[
        "Dashboard",
        "Profile",
        "Purchase Orders",
        "Deliveries",
        "Delayed Deliveries",
        "Performance",
        "Risk Status",
        "Notifications",
      ]}
      cards={[
        { label: "Total Deliveries", value: deliveries.length },
        { label: "Scheduled", value: scheduled },
        { label: "In Transit", value: inTransit },
        { label: "Delivered", value: delivered },
        { label: "Delayed", value: delayed },
      ]}
      columns={[
        "PO Number",
        "Expected Date",
        "Actual Date",
        "Status",
      ]}
      data={tableData}
    />
  );
}

export default VendorDeliveries;