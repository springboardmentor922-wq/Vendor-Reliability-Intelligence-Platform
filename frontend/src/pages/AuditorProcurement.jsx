import React, { useEffect, useState } from "react";
import RoleTablePage from "../components/RoleTablePage";

const API_URL = "http://127.0.0.1:8000";

const MENU_ITEMS = [
  "Dashboard",
  "Records",
  "Vendors",
  "Procurement",
  "Risk Assessments",
  "Performance",
  "Reports",
];

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("access_token")
  );
}

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) return "₹0.00";

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatStatus(value) {
  if (!value) return "Unknown";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function AuditorProcurement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      setLoading(true);

      const token = getToken();

      if (!token) return;

      const response = await fetch(
        `${API_URL}/purchase-orders`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load purchase orders."
        );
      }

      const data = await response.json();

      setOrders(normalizeArray(data));
    } catch (error) {
      console.error(error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const approved = orders.filter(
    (order) =>
      String(order.status || "").toLowerCase() ===
      "approved"
  ).length;

  const pending = orders.filter(
    (order) =>
      String(order.status || "").toLowerCase() ===
      "pending"
  ).length;

  const issues = orders.filter(
    (order) =>
      String(order.status || "").toLowerCase() ===
      "cancelled"
  ).length;

  return (
    <RoleTablePage
      title="Procurement Audit"
      subtitle="Review actual purchase orders and procurement transactions."
      role="Auditor"
      menuItems={MENU_ITEMS}
      cards={[
        {
          label: "Orders Reviewed",
          value: loading ? "..." : orders.length,
        },
        {
          label: "Approved",
          value: loading ? "..." : approved,
        },
        {
          label: "Pending",
          value: loading ? "..." : pending,
        },
        {
          label: "Cancelled",
          value: loading ? "..." : issues,
        },
      ]}
      columns={[
        "PO Number",
        "Vendor ID",
        "Amount",
        "Order Date",
        "Status",
      ]}
      data={orders.map((order) => [
        order.order_number ||
          order.orderNumber ||
          `PO #${order.id}`,
        order.vendor_id
          ? `Vendor #${order.vendor_id}`
          : "—",
        formatCurrency(order.total_amount),
        order.order_date
          ? new Date(
              order.order_date
            ).toLocaleDateString()
          : "—",
        formatStatus(order.status),
      ])}
    />
  );
}

export default AuditorProcurement;