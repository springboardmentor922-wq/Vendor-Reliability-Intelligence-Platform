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

function getLevel(score) {
  const value = Number(score) || 0;

  if (value >= 80) {
    return "Good";
  }

  if (value >= 60) {
    return "Medium";
  }

  return "Needs Attention";
}

function VendorPerformance() {
  const [performance, setPerformance] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const token = getToken();

      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      // Get real performance data from backend
      const performanceResponse = await fetch(
        `${API_URL}/performance`,
        {
          method: "GET",
          headers,
        }
      );

      if (!performanceResponse.ok) {
        throw new Error(
          `Performance API error: ${performanceResponse.status}`
        );
      }

      const performanceData = await performanceResponse.json();

      setPerformance(
        Array.isArray(performanceData)
          ? performanceData
          : []
      );

      // Get purchase orders only for completed-delivery count
      const ordersResponse = await fetch(
        `${API_URL}/vendor/purchase-orders`,
        {
          method: "GET",
          headers,
        }
      );

      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();

        const uniqueOrders = Array.isArray(ordersData)
          ? ordersData.filter(
              (item, index, array) =>
                index ===
                array.findIndex(
                  (x) => x.id === item.id
                )
            )
          : [];

        setOrders(uniqueOrders);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error(
        "Failed to load vendor performance:",
        error
      );

      setPerformance([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  // Latest performance evaluation
  const latestPerformance =
    performance.length > 0
      ? [...performance].sort(
          (a, b) =>
            new Date(b.evaluation_date) -
            new Date(a.evaluation_date)
        )[0]
      : null;

  const overallScore = Number(
    latestPerformance?.overall_score
  ) || 0;

  const deliveryScore = Number(
    latestPerformance?.delivery_score
  ) || 0;

  const reliabilityScore = Number(
    latestPerformance?.reliability_score
  ) || 0;

  const qualityScore = Number(
    latestPerformance?.quality_score
  ) || 0;

  const communicationScore = Number(
    latestPerformance?.communication_score
  ) || 0;

  const complianceScore = Number(
    latestPerformance?.compliance_score
  ) || 0;

  const completedDeliveries = orders.filter(
    (order) =>
      String(order.status || "").toLowerCase() ===
      "delivered"
  ).length;

  const tableData = [
    [
      "Delivery Performance",
      `${deliveryScore}%`,
      getLevel(deliveryScore),
      "Performance Evaluation",
    ],
    [
      "Vendor Reliability",
      `${reliabilityScore}%`,
      getLevel(reliabilityScore),
      "Vendor Database",
    ],
    [
      "Quality",
      `${qualityScore}%`,
      getLevel(qualityScore),
      qualityScore > 0
        ? "Performance Evaluation"
        : "No quality data",
    ],
    [
      "Communication",
      `${communicationScore}%`,
      getLevel(communicationScore),
      communicationScore > 0
        ? "Performance Evaluation"
        : "No communication data",
    ],
    [
      "Contract Compliance",
      `${complianceScore}%`,
      getLevel(complianceScore),
      complianceScore > 0
        ? "Performance Evaluation"
        : "No compliance data",
    ],
  ];

  if (loading) {
    return (
      <RoleTablePage
        title="Vendor Performance"
        subtitle="Loading vendor performance data..."
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
            label: "Overall Score",
            value: "...",
          },
          {
            label: "On-Time Delivery",
            value: "...",
          },
          {
            label: "Reliability",
            value: "...",
          },
          {
            label: "Completed Deliveries",
            value: "...",
          },
        ]}
        columns={[
          "Metric",
          "Score",
          "Level",
          "Source",
        ]}
        data={[]}
      />
    );
  }

  return (
    <RoleTablePage
      title="Vendor Performance"
      subtitle={
        latestPerformance
          ? `Latest evaluation: ${latestPerformance.evaluation_date}`
          : "No performance evaluation available yet."
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
        {
          label: "Overall Score",
          value: `${overallScore}%`,
        },
        {
          label: "On-Time Delivery",
          value: `${deliveryScore}%`,
        },
        {
          label: "Reliability",
          value: `${reliabilityScore}%`,
        },
        {
          label: "Completed Deliveries",
          value: completedDeliveries,
        },
      ]}
      columns={[
        "Metric",
        "Score",
        "Level",
        "Source",
      ]}
      data={tableData}
    />
  );
}

export default VendorPerformance;