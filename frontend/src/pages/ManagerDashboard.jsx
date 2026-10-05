import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

async function apiRequest(endpoint) {
  const token = getToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

function normalizeArray(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function ProcurementDashboard() {
  const [requests, setRequests] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const menuItems = [
    "Dashboard",
    "Vendors",
    "Requests",
    "Purchase Orders",
    "Approvals",
    "Performance",
    "Reports",
    "Notifications",
  ];

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [
        requestData,
        vendorData,
        purchaseOrderData,
      ] = await Promise.all([
        apiRequest("/procurement/requests"),
        apiRequest("/vendors"),
        apiRequest("/purchase-orders"),
      ]);

      setRequests(normalizeArray(requestData));
      setVendors(normalizeArray(vendorData));
      setPurchaseOrders(normalizeArray(purchaseOrderData));
    } catch (err) {
      console.error("Procurement dashboard error:", err);
      setError(
        err.message ||
          "Unable to load procurement dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  const pendingRequests = requests.filter((request) => {
    const status = normalizeStatus(request.status);

    return (
      status === "pending" ||
      status === "pending_approval" ||
      status === "submitted" ||
      status === "under_review"
    );
  }).length;

  const pendingApprovals = requests.filter((request) => {
    const status = normalizeStatus(request.status);

    return (
      status === "pending_approval" ||
      status === "pending" ||
      status === "awaiting_approval"
    );
  }).length;

  const activeVendors = vendors.filter((vendor) => {
    const status = normalizeStatus(
      vendor.vendor_status || vendor.status
    );

    if (!status) {
      return true;
    }

    return (
      status === "active" ||
      status === "approved" ||
      status === "approved_vendor"
    );
  }).length;

  const recentRequests = [...requests]
    .sort((a, b) => {
      const dateA =
        getDate(a.created_at || a.createdAt)?.getTime() ||
        Number(a.id) ||
        0;

      const dateB =
        getDate(b.created_at || b.createdAt)?.getTime() ||
        Number(b.id) ||
        0;

      return dateB - dateA;
    })
    .slice(0, 5);

  const approvedRequests = requests.filter((request) => {
    const status = normalizeStatus(request.status);

    return (
      status === "approved" ||
      status === "completed" ||
      status === "closed"
    );
  }).length;

  const approvedPercentage =
    requests.length > 0
      ? Math.round(
          (approvedRequests / requests.length) * 100
        )
      : 0;

  const deliveredOrders = purchaseOrders.filter((order) => {
    const status = normalizeStatus(order.status);

    return (
      status === "delivered" ||
      status === "completed" ||
      status === "closed"
    );
  });

  const deliveryDataOrders = deliveredOrders.filter(
    (order) =>
      getDate(order.expected_delivery_date) &&
      getDate(order.actual_delivery_date)
  );

  const onTimeOrders = deliveryDataOrders.filter(
    (order) => {
      const expected = getDate(
        order.expected_delivery_date
      );

      const actual = getDate(
        order.actual_delivery_date
      );

      return actual <= expected;
    }
  ).length;

  const onTimePercentage =
    deliveryDataOrders.length > 0
      ? Math.round(
          (onTimeOrders /
            deliveryDataOrders.length) *
            100
        )
      : 0;

  const pendingPurchaseOrders = purchaseOrders.filter(
    (order) => {
      const status = normalizeStatus(order.status);

      return (
        status === "pending" ||
        status === "pending_approval" ||
        status === "awaiting_approval"
      );
    }
  ).length;

  return (
    <DashboardLayout
      title="Procurement Dashboard"
      role="Procurement Manager"
      menuItems={menuItems}
    >
      <div style={page}>
        <div style={welcome}>
          <div>
            <h2>Procurement Overview 👋</h2>

            <p>
              Manage procurement requests, vendors,
              purchase orders and approvals efficiently.
            </p>
          </div>

          <div style={overview}>
            <span>Procurement Status</span>
            <strong>
              {loading ? "Loading..." : "Active"}
            </strong>
          </div>
        </div>

        {error && (
          <div style={errorBox}>
            {error}
          </div>
        )}

        <div style={statsGrid}>
          <StatCard
            label="Pending Requests"
            value={
              loading ? "..." : pendingRequests
            }
            icon="📝"
          />

          <StatCard
            label="Purchase Orders"
            value={
              loading
                ? "..."
                : purchaseOrders.length
            }
            icon="📦"
          />

          <StatCard
            label="Active Vendors"
            value={
              loading ? "..." : activeVendors
            }
            icon="🏢"
          />

          <StatCard
            label="Pending Approvals"
            value={
              loading
                ? "..."
                : pendingApprovals
            }
            icon="✓"
          />
        </div>

        <div style={card}>
          <div style={header}>
            <div>
              <h3>Recent Procurement Requests</h3>

              <p>
                Latest requests from the procurement
                system.
              </p>
            </div>

            <span style={countBadge}>
              {requests.length} Requests
            </span>
          </div>

          {recentRequests.length === 0 ? (
            <div style={emptyState}>
              {loading
                ? "Loading requests..."
                : "No procurement requests found."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>
                      Request ID
                    </th>
                    <th style={th}>
                      Category
                    </th>
                    <th style={th}>
                      Vendor
                    </th>
                    <th style={th}>
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentRequests.map(
                    (request, index) => {
                      const status =
                        normalizeStatus(
                          request.status
                        );

                      const displayStatus =
                        request.status ||
                        "Unknown";

                      const requestId =
                        request.request_number ||
                        request.request_id ||
                        request.id ||
                        `Request ${index + 1}`;

                      const category =
                        request.category ||
                        request.request_type ||
                        request.type ||
                        "Procurement";

                      const vendor =
                        request.vendor_name ||
                        request.vendor?.company_name ||
                        request.vendor?.name ||
                        request.company_name ||
                        "Not assigned";

                      const isApproved =
                        status === "approved" ||
                        status === "completed" ||
                        status === "closed";

                      return (
                        <tr key={request.id || index}>
                          <td style={td}>
                            <strong>
                              {requestId}
                            </strong>
                          </td>

                          <td style={td}>
                            {category}
                          </td>

                          <td style={td}>
                            {vendor}
                          </td>

                          <td style={td}>
                            <span
                              style={
                                isApproved
                                  ? approved
                                  : pending
                              }
                            >
                              ● {displayStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={bottomGrid}>
          <div style={card}>
            <h3>
              Procurement Performance
            </h3>

            <Metric
              label="Approved Requests"
              value={`${approvedPercentage}%`}
            />

            <Metric
              label="On-Time Orders"
              value={`${onTimePercentage}%`}
            />
          </div>

          <div style={card}>
            <h3>Action Required</h3>

            <ActionItem
              value={pendingPurchaseOrders}
              text="Purchase orders awaiting approval"
            />

            <ActionItem
              value={pendingRequests}
              text="Procurement requests requiring attention"
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div style={statCard}>
      <div style={iconStyle}>
        {icon}
      </div>

      <div>
        <p>{label}</p>
        <h2>{value}</h2>
        <small>Live system data</small>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ marginTop: "18px" }}>
      <div style={metric}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <div style={progress}>
        <div
          style={{
            ...progressFill,
            width: value,
          }}
        />
      </div>
    </div>
  );
}

function ActionItem({ value, text }) {
  return (
    <div style={alert}>
      <strong>{value}</strong>
      <span>{text}</span>
    </div>
  );
}

const page = {
  display: "flex",
  flexDirection: "column",
  gap: "22px",
};

const welcome = {
  background:
    "linear-gradient(135deg, #17152f, #37316b)",
  color: "#fff",
  padding: "28px",
  borderRadius: "16px",
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
};

const overview = {
  padding: "14px 20px",
  background: "rgba(255,255,255,.1)",
  borderRadius: "10px",
  display: "flex",
  flexDirection: "column",
  minWidth: "130px",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: "18px",
};

const statCard = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  gap: "15px",
  boxShadow:
    "0 4px 18px rgba(0,0,0,.05)",
};

const iconStyle = {
  width: "52px",
  height: "52px",
  borderRadius: "12px",
  background: "#eef2ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "24px",
  flexShrink: 0,
};

const card = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  boxShadow:
    "0 4px 18px rgba(0,0,0,.05)",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "18px",
  gap: "15px",
};

const countBadge = {
  background: "#eef2ff",
  color: "#4f46e5",
  padding: "7px 12px",
  borderRadius: "20px",
  fontSize: "12px",
  whiteSpace: "nowrap",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const th = {
  textAlign: "left",
  padding: "13px",
  background: "#f8fafc",
  borderBottom:
    "1px solid #e5e7eb",
  fontSize: "13px",
};

const td = {
  padding: "14px 13px",
  borderBottom:
    "1px solid #eef0f3",
  fontSize: "13px",
};

const approved = {
  color: "#15803d",
  background: "#dcfce7",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "12px",
};

const pending = {
  color: "#b45309",
  background: "#fef3c7",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "12px",
};

const bottomGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "20px",
};

const metric = {
  display: "flex",
  justifyContent: "space-between",
};

const progress = {
  height: "8px",
  background: "#e5e7eb",
  borderRadius: "10px",
  marginTop: "8px",
};

const progressFill = {
  height: "100%",
  background: "#4f46e5",
  borderRadius: "10px",
};

const alert = {
  display: "flex",
  gap: "15px",
  padding: "15px",
  background: "#f8fafc",
  borderRadius: "10px",
  marginTop: "12px",
};

const errorBox = {
  padding: "13px 16px",
  background: "#fff4f4",
  color: "#b42318",
  border: "1px solid #f0caca",
  borderRadius: "10px",
};

const emptyState = {
  padding: "30px",
  textAlign: "center",
  color: "#667085",
};

export default ProcurementDashboard;