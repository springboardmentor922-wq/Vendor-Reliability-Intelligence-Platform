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
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

/* ============================================================
   RISK CALCULATION
   ============================================================ */

function getRiskLevel(score) {
  // No reliability score = vendor is not assessed
  if (score === null || score === undefined || score === "") {
    return "Not Assessed";
  }

  const value = Number(score);

  if (Number.isNaN(value)) {
    return "Not Assessed";
  }

  if (value >= 80) return "Low";
  if (value >= 60) return "Medium";

  return "High";
}

function getRecommendation(risk) {
  if (risk === "Low") {
    return "Continue monitoring";
  }

  if (risk === "Medium") {
    return "Monitor performance";
  }

  if (risk === "High") {
    return "Review vendor risk";
  }

  return "Insufficient performance data";
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

function AdminRiskAnalysis() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRiskData();
  }, []);

  async function loadRiskData() {
    try {
      setLoading(true);
      setError("");

      const data = await apiRequest("/vendors");

      if (Array.isArray(data)) {
        setVendors(data);
      } else if (Array.isArray(data?.data)) {
        setVendors(data.data);
      } else if (Array.isArray(data?.items)) {
        setVendors(data.items);
      } else {
        setVendors([]);
      }
    } catch (err) {
      setError(err.message || "Failed to load vendor risk data.");
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     PREPARE RISK DATA
     ============================================================ */

  const riskData = vendors.map((vendor) => {
    const rawScore = vendor.reliability_score;

    const reliability =
      rawScore === null ||
      rawScore === undefined ||
      rawScore === "" ||
      Number.isNaN(Number(rawScore))
        ? null
        : Number(rawScore);

    const risk = getRiskLevel(reliability);

    return {
      ...vendor,
      reliability,
      risk,
      recommendation: getRecommendation(risk),
    };
  });

  /* ============================================================
     RISK COUNTS
     ============================================================ */

  const lowRisk = riskData.filter(
    (vendor) => vendor.risk === "Low"
  ).length;

  const mediumRisk = riskData.filter(
    (vendor) => vendor.risk === "Medium"
  ).length;

  const highRisk = riskData.filter(
    (vendor) => vendor.risk === "High"
  ).length;

  const notAssessed = riskData.filter(
    (vendor) => vendor.risk === "Not Assessed"
  ).length;

  return (
    <DashboardLayout
      title="Risk Analysis"
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
      {/* ======================================================
          HEADER
          ====================================================== */}

      <div style={header}>
        <div>
          <h2 style={{ margin: 0 }}>
            Vendor Risk Analysis
          </h2>

          <p style={{ color: "#666", marginBottom: 0 }}>
            Risk levels calculated from current vendor
            reliability scores.
          </p>
        </div>

        <button
          style={refreshButton}
          onClick={loadRiskData}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={box}>
          Loading vendor risk data...
        </div>
      ) : (
        <>
          {/* ==================================================
              RISK SUMMARY
              ================================================== */}

          <div style={grid}>
            <Card
              title="Low Risk Vendors"
              value={lowRisk}
            />

            <Card
              title="Medium Risk Vendors"
              value={mediumRisk}
            />

            <Card
              title="High Risk Vendors"
              value={highRisk}
            />

            <Card
              title="Not Assessed"
              value={notAssessed}
            />
          </div>

          {/* ==================================================
              RISK TABLE
              ================================================== */}

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>
              Risk Assessment
            </h3>

            {riskData.length === 0 ? (
              <div style={empty}>
                No vendors available for risk analysis.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>
                        Vendor
                      </th>

                      <th style={th}>
                        Category
                      </th>

                      <th style={th}>
                        Reliability Score
                      </th>

                      <th style={th}>
                        Risk Level
                      </th>

                      <th style={th}>
                        Recommendation
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {riskData.map((vendor) => (
                      <tr key={vendor.id}>
                        <td style={td}>
                          <strong>
                            {vendor.company_name}
                          </strong>
                        </td>

                        <td style={td}>
                          {vendor.category ||
                            "Not specified"}
                        </td>

                        <td style={td}>
                          {vendor.reliability === null
                            ? "N/A"
                            : `${vendor.reliability.toFixed(1)}%`}
                        </td>

                        <td style={td}>
                          <RiskBadge
                            risk={vendor.risk}
                          />
                        </td>

                        <td style={td}>
                          {vendor.recommendation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

/* ============================================================
   CARD
   ============================================================ */

function Card({ title, value }) {
  return (
    <div style={card}>
      <p
        style={{
          color: "#777",
          margin: 0,
        }}
      >
        {title}
      </p>

      <h2
        style={{
          marginTop: "10px",
          marginBottom: 0,
        }}
      >
        {value}
      </h2>
    </div>
  );
}

/* ============================================================
   RISK BADGE
   ============================================================ */

function RiskBadge({ risk }) {
  let background = "#f3f4f6";
  let color = "#6b7280";

  if (risk === "Low") {
    background = "#e8f7ee";
    color = "#16803c";
  }

  if (risk === "Medium") {
    background = "#fff4d6";
    color = "#a66b00";
  }

  if (risk === "High") {
    background = "#ffe5e5";
    color = "#c62828";
  }

  if (risk === "Not Assessed") {
    background = "#eef2f7";
    color = "#64748b";
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 12px",
        borderRadius: "20px",
        background,
        color,
        fontWeight: "600",
        fontSize: "13px",
      }}
    >
      {risk}
    </span>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const header = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "22px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 3px 12px rgba(0,0,0,.06)",
};

const refreshButton = {
  border: "none",
  background: "#17152f",
  color: "#fff",
  padding: "10px 16px",
  borderRadius: "8px",
  cursor: "pointer",
};

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "18px",
  marginBottom: "22px",
};

const card = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  boxShadow: "0 3px 12px rgba(0,0,0,.06)",
};

const box = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  boxShadow: "0 3px 12px rgba(0,0,0,.06)",
  overflowX: "auto",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "18px",
  minWidth: "800px",
};

const th = {
  textAlign: "left",
  padding: "14px",
  background: "#f5f7fb",
  borderBottom: "1px solid #ddd",
};

const td = {
  padding: "15px",
  borderBottom: "1px solid #eee",
};

const empty = {
  textAlign: "center",
  padding: "40px",
  color: "#777",
};

const errorStyle = {
  background: "#fdeaea",
  color: "#c0392b",
  padding: "14px",
  borderRadius: "10px",
  marginBottom: "18px",
};

export default AdminRiskAnalysis;