import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

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

async function apiRequest(endpoint) {
  const token = getToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
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

function ProcurementApprovals() {
  const [requests, setRequests] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadWorkflow();
  }, []);

  async function loadWorkflow() {
    try {
      setLoading(true);
      setError("");

      const [requestData, poData] = await Promise.all([
        apiRequest("/procurement-requests"),
        apiRequest("/purchase-orders"),
      ]);

      setRequests(Array.isArray(requestData) ? requestData : []);
      setPurchaseOrders(Array.isArray(poData) ? poData : []);
    } catch (err) {
      setError(err.message || "Failed to load workflow status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout
      title="Approval & Workflow Status"
      role="Procurement Manager"
      menuItems={[
        "Dashboard",
        "Vendors",
        "Procurement Requests",
        "Purchase Orders",
        "Approvals",
        "Vendor Performance",
        "Reports",
        "Notifications",
      ]}
    >
      <div style={header}>
        <div>
          <h2 style={{ margin: 0 }}>Approval & Workflow Status</h2>

          <p style={{ color: "#666", marginBottom: 0 }}>
            Track procurement requests and purchase orders through the
            procurement workflow.
          </p>
        </div>

        <button onClick={loadWorkflow} style={refreshButton}>
          Refresh
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {loading ? (
        <div style={loadingStyle}>Loading workflow data...</div>
      ) : (
        <>
          <div style={workflowBox}>
            <h3>Procurement Workflow</h3>

            <p style={{ color: "#666", marginTop: "6px" }}>
              Procurement Manager creates the request, Administrator reviews
              it, and the approved request is converted into a Purchase Order.
            </p>

            <div style={steps}>
              <Step
                number="1"
                title="Create Procurement Request"
                description="Procurement Manager creates the procurement request."
              />

              <Step
                number="2"
                title="Administrator Review"
                description="Administrator approves or rejects the procurement request."
              />

              <Step
                number="3"
                title="Convert to Purchase Order"
                description="Procurement Manager converts an approved request into a Purchase Order."
              />

              <Step
                number="4"
                title="Ship"
                description="The Purchase Order is shipped after approval."
              />

              <Step
                number="5"
                title="Deliver"
                description="The shipped Purchase Order is delivered to complete the workflow."
              />
            </div>
          </div>

          <div style={box}>
            <h3>Procurement Requests</h3>

            <p style={sectionDescription}>
              Requests created by the Procurement Manager and reviewed by the
              Administrator.
            </p>

            {requests.length === 0 ? (
              <p style={{ color: "#777" }}>
                No procurement requests found.
              </p>
            ) : (
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Request</th>
                    <th style={th}>Description</th>
                    <th style={th}>Amount</th>
                    <th style={th}>Status</th>
                    <th style={th}>Next Step</th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td style={td}>
                        <strong>
                          {request.request_number || `REQ-${request.id}`}
                        </strong>
                      </td>

                      <td style={td}>
                        {request.description || "No description"}
                      </td>

                      <td style={td}>
                        ₹
                        {Number(
                          request.estimated_amount || 0
                        ).toLocaleString("en-IN")}
                      </td>

                      <td style={td}>
                        <Status value={request.status} />
                      </td>

                      <td style={td}>
                        <NextStep status={request.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={box}>
            <h3>Purchase Orders</h3>

            <p style={sectionDescription}>
              Approved procurement requests are converted into Purchase
              Orders and then moved through shipping and delivery.
            </p>

            {purchaseOrders.length === 0 ? (
              <p style={{ color: "#777" }}>
                No purchase orders found.
              </p>
            ) : (
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>PO Number</th>
                    <th style={th}>Vendor ID</th>
                    <th style={th}>Amount</th>
                    <th style={th}>Status</th>
                    <th style={th}>Next Step</th>
                  </tr>
                </thead>

                <tbody>
                  {purchaseOrders.map((order) => (
                    <tr key={order.id}>
                      <td style={td}>
                        <strong>
                          {order.order_number || `PO-${order.id}`}
                        </strong>
                      </td>

                      <td style={td}>
                        {order.vendor_id || "N/A"}
                      </td>

                      <td style={td}>
                        ₹
                        {Number(
                          order.total_amount || 0
                        ).toLocaleString("en-IN")}
                      </td>

                      <td style={td}>
                        <Status value={order.status} />
                      </td>

                      <td style={td}>
                        <PONextStep status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

function Step({ number, title, description }) {
  return (
    <div style={step}>
      <div style={stepNumber}>{number}</div>

      <div>
        <strong>{title}</strong>

        <p style={{ margin: "5px 0 0", color: "#777" }}>
          {description}
        </p>
      </div>
    </div>
  );
}

function Status({ value }) {
  const status = String(value || "unknown").toLowerCase();

  let background = "#f1f1f1";
  let color = "#555";

  if (status === "pending") {
    background = "#fff4d6";
    color = "#a66b00";
  }

  if (status === "approved") {
    background = "#e8f7ee";
    color = "#16803c";
  }

  if (status === "rejected" || status === "cancelled") {
    background = "#fdeaea";
    color = "#c0392b";
  }

  if (status === "converted") {
    background = "#e8f0ff";
    color = "#2856a3";
  }

  if (status === "shipped") {
    background = "#e8f0ff";
    color = "#2856a3";
  }

  if (status === "delivered") {
    background = "#e8f7ee";
    color = "#16803c";
  }

  return (
    <span
      style={{
        display: "inline-block",
        background,
        color,
        padding: "6px 12px",
        borderRadius: "20px",
        fontSize: "13px",
        fontWeight: "600",
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

function NextStep({ status }) {
  const currentStatus = String(status || "").toLowerCase();

  if (currentStatus === "pending") {
    return "Waiting for Administrator approval";
  }

  if (currentStatus === "approved") {
    return "Procurement Manager can convert to Purchase Order";
  }

  if (currentStatus === "converted") {
    return "Purchase Order created";
  }

  if (currentStatus === "rejected") {
    return "Request rejected by Administrator";
  }

  return "Continue workflow";
}

function PONextStep({ status }) {
  const currentStatus = String(status || "").toLowerCase();

  if (currentStatus === "pending") {
    return "Ready for shipping";
  }

  if (currentStatus === "approved") {
    return "Ship Purchase Order";
  }

  if (currentStatus === "shipped") {
    return "Deliver Purchase Order";
  }

  if (currentStatus === "delivered") {
    return "Workflow completed";
  }

  if (currentStatus === "cancelled") {
    return "Order cancelled";
  }

  return "Continue workflow";
}

const header = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "22px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
};

const refreshButton = {
  border: "none",
  background: "#17152f",
  color: "#fff",
  padding: "10px 18px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
  flexShrink: 0,
};

const workflowBox = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "22px",
  boxShadow: "0 3px 12px rgba(0,0,0,.06)",
};

const steps = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "14px",
  marginTop: "20px",
};

const step = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "18px",
  background: "#f5f7fb",
  borderRadius: "10px",
  minHeight: "130px",
};

const stepNumber = {
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  background: "#17152f",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  flexShrink: 0,
};

const box = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "22px",
  boxShadow: "0 3px 12px rgba(0,0,0,.06)",
  overflowX: "auto",
};

const sectionDescription = {
  color: "#777",
  marginTop: "5px",
  marginBottom: "0",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "15px",
  minWidth: "800px",
};

const th = {
  textAlign: "left",
  padding: "14px",
  background: "#f5f7fb",
  borderBottom: "1px solid #ddd",
};

const td = {
  padding: "15px 14px",
  borderBottom: "1px solid #eee",
};

const errorStyle = {
  background: "#fdeaea",
  color: "#c0392b",
  padding: "14px",
  borderRadius: "10px",
  marginBottom: "20px",
};

const loadingStyle = {
  background: "#fff",
  padding: "40px",
  borderRadius: "14px",
  textAlign: "center",
};

export default ProcurementApprovals;