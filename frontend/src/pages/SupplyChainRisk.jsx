import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { getVendors } from "../services/procurementService";

function SupplyChainRisk() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
    try {
      const data = await getVendors();

      setVendors(
        Array.isArray(data)
          ? data
          : data?.items || []
      );
    } catch (err) {
      setError(err.message || "Unable to load vendor risk data");
    } finally {
      setLoading(false);
    }
  }

  function getRisk(score) {
    if (score === null || score === undefined) {
      return {
        level: "Not Scored",
        action: "Needs Assessment",
      };
    }

    const value = Number(score);

    if (value >= 85) {
      return {
        level: "Low",
        action: "Monitor",
      };
    }

    if (value >= 70) {
      return {
        level: "Medium",
        action: "Review",
      };
    }

    return {
      level: "High",
      action: "Action Required",
    };
  }

  const scored = vendors.filter(
    (vendor) =>
      vendor.reliability_score !== null &&
      vendor.reliability_score !== undefined
  );

  const highRisk = scored.filter(
    (vendor) => Number(vendor.reliability_score) < 70
  ).length;

  const mediumRisk = scored.filter(
    (vendor) =>
      Number(vendor.reliability_score) >= 70 &&
      Number(vendor.reliability_score) < 85
  ).length;

  const lowRisk = scored.filter(
    (vendor) => Number(vendor.reliability_score) >= 85
  ).length;

  return (
    <DashboardLayout
      title="Supply Chain Risk"
      role="Supply Chain Manager"
      menuItems={[
        "Dashboard",
        "Suppliers",
        "Purchase Orders",
        "Deliveries",
        "Delayed Deliveries",
        "Performance",
        "Risk",
      ]}
    >
      <div style={header}>
        <h2>Supply Chain Risk Analysis</h2>
        <p>
          Identify and monitor vendor reliability risks.
        </p>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={cards}>
        <Card label="Total Scored Vendors" value={scored.length} />
        <Card label="High Risk" value={highRisk} />
        <Card label="Medium Risk" value={mediumRisk} />
        <Card label="Low Risk" value={lowRisk} />
      </div>

      <div style={box}>
        <h3>Risk Assessment</h3>

        {loading ? (
          <p>Loading risk analysis...</p>
        ) : vendors.length === 0 ? (
          <p>No vendor data found.</p>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Vendor</th>
                <th style={th}>Risk Type</th>
                <th style={th}>Risk Level</th>
                <th style={th}>Reliability Score</th>
                <th style={th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {vendors.map((vendor) => {
                const result = getRisk(
                  vendor.reliability_score
                );

                return (
                  <tr key={vendor.id}>
                    <td style={td}>
                      {vendor.company_name}
                    </td>

                    <td style={td}>
                      Vendor Reliability Risk
                    </td>

                    <td style={td}>
                      <span style={risk}>
                        {result.level}
                      </span>
                    </td>

                    <td style={td}>
                      {vendor.reliability_score !== null &&
                      vendor.reliability_score !== undefined
                        ? `${Number(
                            vendor.reliability_score
                          )}%`
                        : "Not Scored"}
                    </td>

                    <td style={td}>
                      {result.action}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}

function Card({ label, value }) {
  return (
    <div style={card}>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

const header = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "22px",
};

const cards = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "18px",
  marginBottom: "22px",
};

const card = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
};

const box = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  overflowX: "auto",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const th = {
  textAlign: "left",
  padding: "14px",
  background: "#f5f7fb",
};

const td = {
  padding: "15px",
  borderBottom: "1px solid #eee",
};

const risk = {
  background: "#fff3cd",
  color: "#856404",
  padding: "6px 10px",
  borderRadius: "15px",
  fontSize: "12px",
};

const errorBox = {
  background: "#ffe8e8",
  color: "#b42318",
  padding: "12px 16px",
  borderRadius: "10px",
  marginBottom: "20px",
};

export default SupplyChainRisk;