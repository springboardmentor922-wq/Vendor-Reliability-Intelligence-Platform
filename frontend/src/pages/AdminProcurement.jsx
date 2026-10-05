import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    ""
  );
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.detail || `Request failed with status ${response.status}`
    );
  }

  return data;
}

function AdminProcurement() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);
      setError("");

      const data = await apiRequest("/procurement-requests");

      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load procurement requests.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id) {
    try {
      setActionLoading(id);
      setError("");
      setSuccess("");

      await apiRequest(`/procurement-requests/${id}/approve`, {
        method: "PUT",
      });

      setSuccess("Procurement request approved successfully.");
      await loadRequests();
    } catch (err) {
      setError(err.message || "Failed to approve request.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id) {
    try {
      setActionLoading(id);
      setError("");
      setSuccess("");

      await apiRequest(`/procurement-requests/${id}/reject`, {
        method: "PUT",
      });

      setSuccess("Procurement request rejected.");
      await loadRequests();
    } catch (err) {
      setError(err.message || "Failed to reject request.");
    } finally {
      setActionLoading(null);
    }
  }

  const totalRequests = requests.length;

  const pendingRequests = requests.filter(
    (request) => request.status === "pending"
  ).length;

  const approvedRequests = requests.filter(
    (request) => request.status === "approved"
  ).length;

  const rejectedRequests = requests.filter(
    (request) => request.status === "rejected"
  ).length;

  return (
    <DashboardLayout
      title="Procurement Requests"
      role="Administrator"
      menuItems={[
        "Dashboard",
        "Users",
        "Vendors",
        "Suppliers",
        "Procurement Requests",
        "Purchase Orders",
        "Risk Analysis",
        "Reports",
        "Settings",
        "Notifications",
      ]}
    >
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0 }}>Procurement Requests</h2>

          <p style={{ color: "#666", marginTop: "8px" }}>
            Review and approve procurement requests submitted by procurement
            managers.
          </p>
        </div>

        <button
          onClick={loadRequests}
          style={refreshButton}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {success && <div style={successStyle}>{success}</div>}

      <div style={gridStyle}>
        <Card title="Total Requests" value={totalRequests} />

        <Card title="Pending Requests" value={pendingRequests} />

        <Card title="Approved Requests" value={approvedRequests} />

        <Card title="Rejected Requests" value={rejectedRequests} />
      </div>

      <div style={boxStyle}>
        <div style={sectionHeader}>
          <div>
            <h3 style={{ margin: 0 }}>Request List</h3>

            <p style={{ margin: "6px 0 0", color: "#777" }}>
              Requests submitted by procurement managers
            </p>
          </div>
        </div>

        {loading ? (
          <div style={emptyStyle}>Loading procurement requests...</div>
        ) : requests.length === 0 ? (
          <div style={emptyStyle}>
            <div style={{ fontSize: "40px", marginBottom: "10px" }}>📋</div>

            <h3>No Procurement Requests</h3>

            <p style={{ color: "#777" }}>
              No procurement requests have been submitted yet.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>Request ID</th>
                  <th style={th}>Requirement</th>
                  <th style={th}>Vendor ID</th>
                  <th style={th}>Quantity</th>
                  <th style={th}>Estimated Amount</th>
                  <th style={th}>Status</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td style={td}>
                      <strong>{request.request_number}</strong>
                    </td>

                    <td style={td}>
                      {request.description}
                    </td>

                    <td style={td}>
                      {request.vendor_id || "Not assigned"}
                    </td>

                    <td style={td}>
                      {request.quantity}
                    </td>

                    <td style={td}>
                      ₹{Number(request.estimated_amount || 0).toLocaleString()}
                    </td>

                    <td style={td}>
                      <Status value={request.status} />
                    </td>

                    <td style={td}>
                      {request.status === "pending" ? (
                        <div style={actionContainer}>
                          <button
                            onClick={() => handleApprove(request.id)}
                            disabled={actionLoading === request.id}
                            style={approveButton}
                          >
                            {actionLoading === request.id
                              ? "Processing..."
                              : "Approve"}
                          </button>

                          <button
                            onClick={() => handleReject(request.id)}
                            disabled={actionLoading === request.id}
                            style={rejectButton}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "#777" }}>
                          No action required
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Card({ title, value }) {
  return (
    <div style={card}>
      <p style={{ color: "#777", margin: 0 }}>{title}</p>

      <h2 style={{ marginTop: "10px", marginBottom: 0 }}>{value}</h2>
    </div>
  );
}

function Status({ value }) {
  const status = String(value || "").toLowerCase();

  let background = "#f1f1f1";
  let color = "#555";

  if (status === "approved") {
    background = "#e8f7ee";
    color = "#16803c";
  }

  if (status === "pending") {
    background = "#fff4d6";
    color = "#a66b00";
  }

  if (status === "rejected") {
    background = "#fdeaea";
    color = "#c0392b";
  }

  if (status === "converted") {
    background = "#e8f0ff";
    color = "#2856a3";
  }

  return (
    <span
      style={{
        padding: "6px 12px",
        borderRadius: "20px",
        background,
        color,
        fontSize: "13px",
        fontWeight: "600",
        textTransform: "capitalize",
      }}
    >
      {status || "Unknown"}
    </span>
  );
}

const headerStyle = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "22px",
  boxShadow: "0 3px 12px rgba(0,0,0,.06)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
};

const refreshButton = {
  padding: "10px 18px",
  border: "none",
  borderRadius: "8px",
  background: "#1f2937",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "600",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "18px",
  marginBottom: "22px",
};

const card = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  boxShadow: "0 3px 12px rgba(0,0,0,.06)",
};

const boxStyle = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  boxShadow: "0 3px 12px rgba(0,0,0,.06)",
  overflowX: "auto",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "10px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "18px",
  minWidth: "900px",
};

const th = {
  textAlign: "left",
  padding: "14px",
  background: "#f5f7fb",
  borderBottom: "1px solid #ddd",
  whiteSpace: "nowrap",
};

const td = {
  padding: "15px 14px",
  borderBottom: "1px solid #eee",
  verticalAlign: "middle",
};

const actionContainer = {
  display: "flex",
  gap: "8px",
};

const approveButton = {
  padding: "8px 14px",
  border: "none",
  borderRadius: "7px",
  background: "#16803c",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "600",
};

const rejectButton = {
  padding: "8px 14px",
  border: "none",
  borderRadius: "7px",
  background: "#c0392b",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "600",
};

const errorStyle = {
  background: "#fdeaea",
  color: "#c0392b",
  padding: "14px 18px",
  borderRadius: "10px",
  marginBottom: "18px",
};

const successStyle = {
  background: "#e8f7ee",
  color: "#16803c",
  padding: "14px 18px",
  borderRadius: "10px",
  marginBottom: "18px",
};

const emptyStyle = {
  textAlign: "center",
  padding: "50px 20px",
  color: "#555",
};

export default AdminProcurement;