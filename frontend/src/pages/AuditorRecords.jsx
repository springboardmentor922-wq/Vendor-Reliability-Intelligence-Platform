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

function AuditorRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = async () => {
    try {
      setLoading(true);

      const token = getToken();

      if (!token) return;

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [vendorsResponse, ordersResponse] =
        await Promise.all([
          fetch(`${API_URL}/vendors`, { headers }),
          fetch(`${API_URL}/purchase-orders`, {
            headers,
          }),
        ]);

      const vendors = vendorsResponse.ok
        ? normalizeArray(
            await vendorsResponse.json()
          )
        : [];

      const orders = ordersResponse.ok
        ? normalizeArray(
            await ordersResponse.json()
          )
        : [];

      const vendorRecords = vendors.map((vendor) => ({
        id: `V-${vendor.id}`,
        type: "Vendor",
        date:
          vendor.created_at ||
          vendor.createdAt ||
          null,
        source: vendor.company_name ||
          vendor.companyName ||
          `Vendor #${vendor.id}`,
        status:
          vendor.approval_status ||
          vendor.vendor_status ||
          "—",
      }));

      const orderRecords = orders.map((order) => ({
        id: `PO-${order.id}`,
        type: "Purchase Order",
        date:
          order.order_date ||
          order.created_at ||
          null,
        source:
          order.order_number ||
          `PO #${order.id}`,
        status: order.status || "—",
      }));

      setRecords([
        ...vendorRecords,
        ...orderRecords,
      ]);
    } catch (error) {
      console.error(error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const reviewed = records.filter(
    (record) =>
      String(record.status).toLowerCase() !==
      "pending"
  ).length;

  const pending = records.filter(
    (record) =>
      String(record.status).toLowerCase() ===
      "pending"
  ).length;

  return (
    <RoleTablePage
      title="Audit Records"
      subtitle="Review actual vendor and procurement records available in the system."
      role="Auditor"
      menuItems={MENU_ITEMS}
      cards={[
        {
          label: "Total Records",
          value: loading ? "..." : records.length,
        },
        {
          label: "Reviewed",
          value: loading ? "..." : reviewed,
        },
        {
          label: "Pending Review",
          value: loading ? "..." : pending,
        },
        {
          label: "System Sources",
          value: "2",
        },
      ]}
      columns={[
        "Record ID",
        "Record Type",
        "Date",
        "Source",
        "Status",
      ]}
      data={records.map((record) => [
        record.id,
        record.type,
        record.date
          ? new Date(
              record.date
            ).toLocaleDateString()
          : "—",
        record.source,
        String(record.status)
          .replaceAll("_", " "),
      ])}
    />
  );
}

export default AuditorRecords;