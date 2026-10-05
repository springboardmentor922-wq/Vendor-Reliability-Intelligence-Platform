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

function VendorDelayedDeliveries() {
  const [orders, setOrders] = useState([]);

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
        throw new Error(
          data?.detail || "Failed to load delayed deliveries"
        );
      }

      setOrders(
        Array.isArray(data)
          ? data.filter(
              (item, index, array) =>
                index ===
                array.findIndex((x) => x.id === item.id)
            )
          : []
      );
    } catch (error) {
      console.error(error);
    }
  }

  const today = new Date();

  const delayedOrders = orders.filter((order) => {
    const status = String(order.status || "").toLowerCase();

    if (
      status === "delivered" ||
      status === "cancelled"
    ) {
      return false;
    }

    if (!order.expected_delivery_date) {
      return false;
    }

    return new Date(order.expected_delivery_date) < today;
  });

  const calculateDelay = (date) => {
    const expected = new Date(date);
    const difference = today - expected;

    return Math.max(
      1,
      Math.ceil(difference / (1000 * 60 * 60 * 24))
    );
  };

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const totalDelayDays = delayedOrders.reduce(
    (sum, order) =>
      sum + calculateDelay(order.expected_delivery_date),
    0
  );

  const averageDelay =
    delayedOrders.length > 0
      ? Math.round(
          totalDelayDays / delayedOrders.length
        )
      : 0;

  const tableData = delayedOrders.map((order) => [
    order.order_number || `PO-${order.id}`,
    formatDate(order.expected_delivery_date),
    `${calculateDelay(
      order.expected_delivery_date
    )} Day(s)`,
    order.status || "-",
  ]);

  return (
    <RoleTablePage
      title="Delayed Deliveries"
      subtitle="Purchase orders whose expected delivery date has passed."
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
        {
          label: "Delayed Orders",
          value: delayedOrders.length,
        },
        {
          label: "Average Delay",
          value: `${averageDelay} Day(s)`,
        },
        {
          label: "Total Delay Days",
          value: totalDelayDays,
        },
      ]}
      columns={[
        "PO Number",
        "Expected Date",
        "Delay",
        "Status",
      ]}
      data={tableData}
    />
  );
}

export default VendorDelayedDeliveries;