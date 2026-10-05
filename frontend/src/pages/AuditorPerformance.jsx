import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

const MENU_ITEMS = [
  "Dashboard",
  "Records",
  "Vendors",
  "Procurement",
  "Risk Assessments",
  "Performance",
  "Reports"
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
  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.items)) {
    return data.items;
  }

  if (data && Array.isArray(data.data)) {
    return data.data;
  }

  if (data && Array.isArray(data.results)) {
    return data.results;
  }

  return [];
}

function getReliability(item) {
  if (!item) {
    return 0;
  }

  const value =
    item.reliability_score !== undefined
      ? item.reliability_score
      : item.overall_score !== undefined
      ? item.overall_score
      : 0;

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function getNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return day + "/" + month + "/" + year;
}

function PerformanceCard({ label, value }) {
  return (
    <div style={card}>
      <p style={cardLabel}>{label}</p>

      <strong style={cardValue}>{value}</strong>

      <small style={cardSmall}>
        From actual performance records
      </small>
    </div>
  );
}

function AuditorPerformance() {
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPerformance() {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        setError("Please login again.");
        return;
      }

      const response = await fetch(API_URL + "/performance", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(
          "Performance request failed (" + response.status + ")"
        );
      }

      const data = await response.json();

      const records = normalizeArray(data);

      const sortedRecords = records.slice().sort(function (a, b) {
        const vendorA = Number(a.vendor_id || 0);
        const vendorB = Number(b.vendor_id || 0);

        if (vendorA !== vendorB) {
          return vendorA - vendorB;
        }

        const dateA = new Date(a.evaluation_date || 0).getTime();
        const dateB = new Date(b.evaluation_date || 0).getTime();

        return dateA - dateB;
      });

      setPerformance(sortedRecords);
    } catch (err) {
      console.error(err);

      setError(
        err.message || "Unable to load performance records."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(function () {
    loadPerformance();
  }, []);

  function average(field) {
    if (performance.length === 0) {
      return 0;
    }

    const total = performance.reduce(function (sum, item) {
      return sum + getNumber(item[field]);
    }, 0);

    return total / performance.length;
  }

  const averageOverall = average("overall_score");
  const averageDelivery = average("delivery_score");
  const averageQuality = average("quality_score");

  const averageReliability =
    performance.length > 0
      ? performance.reduce(function (sum, item) {
          return sum + getReliability(item);
        }, 0) / performance.length
      : 0;

  return (
    <DashboardLayout
      title="Performance Audit"
      role="Auditor"
      menuItems={MENU_ITEMS}
    >
      <div style={page}>

        <div style={header}>
          <div>
            <h2 style={{ margin: 0 }}>
              Performance Audit
            </h2>

            <p style={subtitle}>
              Review actual historical vendor performance indicators.
            </p>
          </div>

          <button
            style={refreshButton}
            onClick={loadPerformance}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {error && (
          <div style={errorBox}>
            ⚠ {error}
          </div>
        )}

        <div style={cards}>

          <PerformanceCard
            label="Average Performance"
            value={
              loading
                ? "..."
                : averageOverall.toFixed(1) + "%"
            }
          />

          <PerformanceCard
            label="On-Time Delivery"
            value={
              loading
                ? "..."
                : averageDelivery.toFixed(1) + "%"
            }
          />

          <PerformanceCard
            label="Quality"
            value={
              loading
                ? "..."
                : averageQuality.toFixed(1) + "%"
            }
          />

          <PerformanceCard
            label="Reliability"
            value={
              loading
                ? "..."
                : averageReliability.toFixed(1) + "%"
            }
          />

        </div>

        <div style={box}>

          <div style={boxHeader}>

            <div>
              <h3 style={{ margin: 0 }}>
                Vendor Performance History
              </h3>

              <p style={subtitle}>
                Data is loaded from the Vendor Performance API.
              </p>
            </div>

            <span style={readOnlyBadge}>
              Read Only
            </span>

          </div>

          {loading ? (
            <div style={empty}>
              Loading performance records...
            </div>
          ) : performance.length === 0 ? (
            <div style={empty}>
              No performance records available.
            </div>
          ) : (
            <div style={tableWrapper}>

              <table style={table}>

                <thead>
                  <tr>

                    <th>Vendor ID</th>
                    <th>Evaluation Date</th>
                    <th>On-Time Delivery</th>
                    <th>Quality</th>
                    <th>Reliability</th>
                    <th>Overall</th>

                  </tr>
                </thead>

                <tbody>

                  {performance.map(function (item, index) {

                    const overall = getNumber(
                      item.overall_score
                    );

                    const reliability = getReliability(item);

                    const delivery = getNumber(
                      item.delivery_score
                    );

                    const quality = getNumber(
                      item.quality_score
                    );

                    return (
                      <tr key={item.id || index}>

                        <td>
                          <strong>
                            Vendor #{item.vendor_id}
                          </strong>
                        </td>

                        <td>
                          {formatDate(item.evaluation_date)}
                        </td>

                        <td>
                          {delivery.toFixed(1)}%
                        </td>

                        <td>
                          {quality.toFixed(1)}%
                        </td>

                        <td>
                          <span
                            style={{
                              ...reliabilityBadge,
                              background:
                                reliability >= 80
                                  ? "#e8f7ef"
                                  : reliability >= 60
                                  ? "#fff5df"
                                  : "#fff0f0",
                              color:
                                reliability >= 80
                                  ? "#16845b"
                                  : reliability >= 60
                                  ? "#b7791f"
                                  : "#c94747"
                            }}
                          >
                            {reliability.toFixed(1)}%
                          </span>
                        </td>

                        <td>
                          <span
                            style={{
                              ...score,
                              background:
                                overall >= 80
                                  ? "#e8f7ef"
                                  : overall >= 60
                                  ? "#fff5df"
                                  : "#fff0f0",
                              color:
                                overall >= 80
                                  ? "#16845b"
                                  : overall >= 60
                                  ? "#b7791f"
                                  : "#c94747"
                            }}
                          >
                            {overall.toFixed(1)}%
                          </span>
                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </div>
    </DashboardLayout>
  );
}

const page = {
  display: "flex",
  flexDirection: "column",
  gap: "22px"
};

const header = {
  background: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: "1px solid #e8ebf1"
};

const subtitle = {
  margin: "7px 0 0",
  color: "#667085",
  fontSize: "14px"
};

const refreshButton = {
  border: "1px solid #d0d5dd",
  background: "#ffffff",
  color: "#344054",
  padding: "9px 14px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 600
};

const cards = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "18px"
};

const card = {
  background: "#ffffff",
  padding: "22px",
  borderRadius: "14px",
  border: "1px solid #e8ebf1",
  boxShadow: "0 4px 18px rgba(0,0,0,0.05)"
};

const cardLabel = {
  margin: 0,
  color: "#667085",
  fontSize: "13px",
  fontWeight: 600
};

const cardValue = {
  display: "block",
  marginTop: "7px",
  fontSize: "26px",
  color: "#0b1f3a"
};

const cardSmall = {
  display: "block",
  marginTop: "6px",
  color: "#98a2b3",
  fontSize: "11px"
};

const box = {
  background: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  border: "1px solid #e8ebf1"
};

const boxHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "20px"
};

const readOnlyBadge = {
  background: "#eef7f9",
  color: "#137388",
  padding: "7px 12px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: 700
};

const tableWrapper = {
  overflowX: "auto"
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "850px"
};

const score = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: 700
};

const reliabilityBadge = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: 700
};

const empty = {
  padding: "35px",
  textAlign: "center",
  background: "#f8fafc",
  borderRadius: "10px",
  color: "#667085"
};

const errorBox = {
  background: "#fff4f4",
  color: "#b42318",
  border: "1px solid #f1b4b4",
  padding: "13px 16px",
  borderRadius: "10px"
};

export default AuditorPerformance;