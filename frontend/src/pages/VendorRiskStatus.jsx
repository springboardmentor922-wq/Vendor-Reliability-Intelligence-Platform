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

function VendorRiskStatus() {
  const [vendor, setVendor] = useState(null);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    loadRiskData();
  }, []);

  async function loadRiskData() {
    try {
      const token = getToken();

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [vendorsResponse, ordersResponse] =
        await Promise.all([
          fetch(`${API_URL}/vendors`, { headers }),
          fetch(`${API_URL}/vendor/purchase-orders`, {
            headers,
          }),
        ]);

      const vendorsData = await vendorsResponse.json();
      const ordersData = await ordersResponse.json();

      if (Array.isArray(vendorsData)) {
        const userId =
          localStorage.getItem("user_id") ||
          sessionStorage.getItem("user_id");

        const currentVendor =
          vendorsData.find(
            (v) =>
              String(v.user_id) === String(userId)
          ) || vendorsData[0];

        setVendor(currentVendor || null);
      }

      if (Array.isArray(ordersData)) {
        setOrders(ordersData);
      }
    } catch (error) {
      console.error("Risk loading error:", error);
    }
  }

  const reliability =
    Number(vendor?.reliability_score) || 0;

  const delivered = orders.filter(
    (order) =>
      String(order.status || "").toLowerCase() ===
      "delivered"
  );

  const delayed = orders.filter((order) => {
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

    return (
      new Date(order.expected_delivery_date) <
      new Date()
    );
  });

  const deliveryRisk =
    delayed.length === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (delayed.length /
              Math.max(orders.length, 1)) *
              100
          )
        );

  const overallRisk = Math.round(
    (100 - reliability + deliveryRisk) / 2
  );

  const getLevel = (score) => {
    if (score <= 30) return "Low";
    if (score <= 60) return "Medium";
    return "High";
  };

  const overallLevel = getLevel(overallRisk);

  const data = [
    [
      "Reliability Risk",
      Math.round(100 - reliability),
      getLevel(100 - reliability),
      "Vendor reliability score",
    ],
    [
      "Delivery Risk",
      deliveryRisk,
      getLevel(deliveryRisk),
      `${delayed.length} delayed order(s)`,
    ],
    [
      "Overall Risk",
      overallRisk,
      overallLevel,
      "Calculated from available data",
    ],
  ];

  return (
    <RoleTablePage
      title="Risk Status"
      subtitle="Risk calculated from vendor reliability and purchase order delivery data."
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
          label: "Risk Score",
          value: overallRisk,
        },
        {
          label: "Risk Level",
          value: overallLevel,
        },
        {
          label: "Delayed Orders",
          value: delayed.length,
        },
        {
          label: "Reliability",
          value: `${reliability}%`,
        },
      ]}
      columns={[
        "Risk Category",
        "Score",
        "Level",
        "Basis",
      ]}
      data={data}
    />
  );
}

export default VendorRiskStatus;