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

function VendorContracts() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      const response = await fetch(
        `${API_URL}/contract-compliance/contracts`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Failed to load contracts"
        );
      }

      setContracts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Contract loading error:", err);
      setError(err.message || "Unable to load contracts");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) {
      return "—";
    }

    return `₹${Number(value).toLocaleString("en-IN")}`;
  };

  const getStatusStyle = (statusValue) => {
    const value = statusValue?.toLowerCase();

    if (value === "active") {
      return {
        background: "#e8f7ee",
        color: "#16803c",
      };
    }

    if (value === "expired") {
      return {
        background: "#ffeaea",
        color: "#c62828",
      };
    }

    if (value === "terminated") {
      return {
        background: "#eeeeee",
        color: "#555",
      };
    }

    return {
      background: "#fff4df",
      color: "#b26a00",
    };
  };

  const isExpiringSoon = (contract) => {
    if (!contract.end_date) return false;

    if (contract.status?.toLowerCase() !== "active") {
      return false;
    }

    const today = new Date();
    const endDate = new Date(contract.end_date);

    const difference =
      (endDate - today) / (1000 * 60 * 60 * 24);

    return difference >= 0 && difference <= 30;
  };

  const activeContracts = contracts.filter(
    (contract) =>
      contract.status?.toLowerCase() === "active"
  ).length;

  const expiringContracts = contracts.filter(
    (contract) => isExpiringSoon(contract)
  ).length;

  const expiredContracts = contracts.filter(
    (contract) =>
      contract.status?.toLowerCase() === "expired"
  ).length;

  return (
    <DashboardLayout
      title="Contracts"
      role="Vendor"
      menuItems={[
        "Dashboard",
        "Profile",
        "Purchase Orders",
        "Deliveries",
        "Delayed Deliveries",
        "Performance",
        "Risk Status",
        "Contracts",
        "Compliance",
        "Communications",
        "Notifications",
      ]}
    >
      <div style={header}>
        <div>
          <div style={eyebrow}>CONTRACT MANAGEMENT</div>

          <h2 style={title}>
            Contracts
          </h2>

          <p style={subtitle}>
            View your contracts, agreements and renewal
            information.
          </p>
        </div>

        <button
          style={refreshButton}
          onClick={fetchContracts}
        >
          Refresh
        </button>
      </div>

      <div style={stats}>
        <Stat
          title="Total Contracts"
          value={contracts.length}
        />

        <Stat
          title="Active Contracts"
          value={activeContracts}
        />

        <Stat
          title="Expiring Soon"
          value={expiringContracts}
        />

        <Stat
          title="Expired Contracts"
          value={expiredContracts}
        />
      </div>

      {expiringContracts > 0 && (
        <div style={warningBox}>
          ⚠️ You have {expiringContracts} contract
          {expiringContracts > 1 ? "s" : ""} expiring
          within the next 30 days.
        </div>
      )}

      <div style={card}>
        <div style={cardHeader}>
          <div>
            <h3 style={cardTitle}>
              Contract Repository
            </h3>

            <p style={cardSubtitle}>
              Contracts available for your vendor account
            </p>
          </div>
        </div>

        {loading && (
          <div style={messageBox}>
            Loading contracts...
          </div>
        )}

        {!loading && error && (
          <div style={errorBox}>
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          contracts.length === 0 && (
            <div style={messageBox}>
              No contracts available for your vendor account.
            </div>
          )}

        {!loading &&
          !error &&
          contracts.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Contract</th>
                    <th style={th}>Contract Number</th>
                    <th style={th}>Start Date</th>
                    <th style={th}>Expiry Date</th>
                    <th style={th}>Value</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {contracts.map((contract) => (
                    <tr key={contract.id}>
                      <td style={td}>
                        <strong>
                          {contract.title ||
                            "Untitled Contract"}
                        </strong>

                        {contract.description && (
                          <div style={description}>
                            {contract.description}
                          </div>
                        )}
                      </td>

                      <td style={td}>
                        {contract.contract_number || "—"}
                      </td>

                      <td style={td}>
                        {formatDate(
                          contract.start_date
                        )}
                      </td>

                      <td style={td}>
                        {formatDate(
                          contract.end_date
                        )}

                        {isExpiringSoon(contract) && (
                          <div style={expiringLabel}>
                            Expiring Soon
                          </div>
                        )}
                      </td>

                      <td style={td}>
                        {formatCurrency(
                          contract.contract_value
                        )}
                      </td>

                      <td style={td}>
                        <span
                          style={{
                            ...status,
                            ...getStatusStyle(
                              contract.status
                            ),
                          }}
                        >
                          {contract.status || "Draft"}
                        </span>
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

function Stat({ title, value }) {
  return (
    <div style={statCard}>
      <p style={statTitle}>{title}</p>

      <h2 style={statValue}>
        {value}
      </h2>
    </div>
  );
}

const header = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "18px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const eyebrow = {
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "1.4px",
  color: "#777",
};

const title = {
  margin: "6px 0 0",
  color: "#17152f",
};

const subtitle = {
  margin: "7px 0 0",
  color: "#777",
  fontSize: "13px",
};

const stats = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "18px",
  marginBottom: "18px",
};

const statCard = {
  background: "#fff",
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
};

const statTitle = {
  margin: 0,
  color: "#777",
  fontSize: "13px",
};

const statValue = {
  margin: "8px 0 0",
  color: "#17152f",
  fontSize: "28px",
};

const card = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
};

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "15px",
};

const cardTitle = {
  marginTop: 0,
  marginBottom: "5px",
  color: "#17152f",
};

const cardSubtitle = {
  color: "#888",
  fontSize: "12px",
  margin: 0,
};

const refreshButton = {
  border: "none",
  background: "#17152f",
  color: "#fff",
  padding: "9px 16px",
  borderRadius: "7px",
  cursor: "pointer",
  fontWeight: "600",
};

const warningBox = {
  background: "#fff8e8",
  border: "1px solid #f5d98a",
  color: "#9a6700",
  padding: "14px 18px",
  borderRadius: "10px",
  marginBottom: "18px",
  fontSize: "13px",
  fontWeight: "600",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "900px",
};

const th = {
  textAlign: "left",
  padding: "13px",
  background: "#f5f7fb",
  color: "#555",
  fontSize: "12px",
};

const td = {
  padding: "14px 13px",
  borderBottom: "1px solid #eee",
  fontSize: "13px",
};

const description = {
  color: "#888",
  fontSize: "11px",
  marginTop: "5px",
};

const status = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "11px",
  fontWeight: "600",
  textTransform: "capitalize",
};

const expiringLabel = {
  marginTop: "5px",
  color: "#b26a00",
  fontSize: "10px",
  fontWeight: "700",
};

const messageBox = {
  padding: "30px",
  textAlign: "center",
  color: "#777",
  background: "#f8f9fb",
  borderRadius: "10px",
};

const errorBox = {
  padding: "15px",
  color: "#c62828",
  background: "#ffeaea",
  borderRadius: "8px",
};

export default VendorContracts;