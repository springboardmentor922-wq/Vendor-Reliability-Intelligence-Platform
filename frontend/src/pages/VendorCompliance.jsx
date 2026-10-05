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

function VendorCompliance() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCompliance();
  }, []);

  const fetchCompliance = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      const response = await fetch(
        `${API_URL}/contract-compliance/compliance`,
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
          data?.detail ||
            "Failed to load compliance documents"
        );
      }

      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(
        "Compliance loading error:",
        err
      );

      setError(
        err.message ||
          "Unable to load compliance documents"
      );
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

  const getDocumentStatusStyle = (statusValue) => {
    const value = statusValue?.toLowerCase();

    if (value === "valid") {
      return {
        background: "#e8f7ee",
        color: "#16803c",
      };
    }

    if (value === "expiring") {
      return {
        background: "#fff4df",
        color: "#b26a00",
      };
    }

    if (value === "expired") {
      return {
        background: "#ffeaea",
        color: "#c62828",
      };
    }

    return {
      background: "#eeeeee",
      color: "#555",
    };
  };

  const getVerificationStyle = (
    verificationStatus
  ) => {
    const value =
      verificationStatus?.toLowerCase();

    if (value === "verified") {
      return {
        background: "#e8f7ee",
        color: "#16803c",
      };
    }

    if (value === "rejected") {
      return {
        background: "#ffeaea",
        color: "#c62828",
      };
    }

    return {
      background: "#fff4df",
      color: "#b26a00",
    };
  };

  const validDocuments = documents.filter(
    (document) =>
      document.status?.toLowerCase() === "valid"
  ).length;

  const expiringDocuments = documents.filter(
    (document) =>
      document.status?.toLowerCase() === "expiring"
  ).length;

  const expiredDocuments = documents.filter(
    (document) =>
      document.status?.toLowerCase() === "expired"
  ).length;

  const verifiedDocuments = documents.filter(
    (document) =>
      document.verification_status?.toLowerCase() ===
      "verified"
  ).length;

  return (
    <DashboardLayout
      title="Vendor Compliance"
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
          <div style={eyebrow}>
            COMPLIANCE MANAGEMENT
          </div>

          <h2 style={title}>
            Compliance Documents
          </h2>

          <p style={subtitle}>
            View the compliance documents associated
            with your vendor account.
          </p>
        </div>

        <button
          style={refreshButton}
          onClick={fetchCompliance}
        >
          Refresh
        </button>
      </div>

      <div style={stats}>
        <Stat
          title="Total Documents"
          value={documents.length}
        />

        <Stat
          title="Valid"
          value={validDocuments}
        />

        <Stat
          title="Expiring"
          value={expiringDocuments}
        />

        <Stat
          title="Expired"
          value={expiredDocuments}
        />

        <Stat
          title="Verified"
          value={verifiedDocuments}
        />
      </div>

      {expiringDocuments > 0 && (
        <div style={warningBox}>
          ⚠️ {expiringDocuments} compliance document
          {expiringDocuments > 1 ? "s are" : " is"} expiring
          soon. Please contact the procurement team if
          renewal is required.
        </div>
      )}

      {expiredDocuments > 0 && (
        <div style={dangerBox}>
          ⚠️ {expiredDocuments} compliance document
          {expiredDocuments > 1 ? "s have" : " has"} expired.
          Please submit updated documentation through the
          appropriate process.
        </div>
      )}

      <div style={card}>
        <div style={cardHeader}>
          <div>
            <h3 style={cardTitle}>
              Compliance Repository
            </h3>

            <p style={cardSubtitle}>
              Compliance documents submitted for your
              vendor account
            </p>
          </div>
        </div>

        {loading && (
          <div style={messageBox}>
            Loading compliance documents...
          </div>
        )}

        {!loading && error && (
          <div style={errorBox}>
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          documents.length === 0 && (
            <div style={messageBox}>
              No compliance documents available for your
              vendor account.
            </div>
          )}

        {!loading &&
          !error &&
          documents.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Document</th>
                    <th style={th}>Type</th>
                    <th style={th}>Document Number</th>
                    <th style={th}>Issue Date</th>
                    <th style={th}>Expiry Date</th>
                    <th style={th}>Status</th>
                    <th style={th}>Verification</th>
                  </tr>
                </thead>

                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td style={td}>
                        <strong>
                          {document.document_name ||
                            "Unnamed Document"}
                        </strong>

                        {document.remarks && (
                          <div style={description}>
                            {document.remarks}
                          </div>
                        )}
                      </td>

                      <td style={td}>
                        {document.document_type || "—"}
                      </td>

                      <td style={td}>
                        {document.document_number || "—"}
                      </td>

                      <td style={td}>
                        {formatDate(
                          document.issue_date
                        )}
                      </td>

                      <td style={td}>
                        {formatDate(
                          document.expiry_date
                        )}
                      </td>

                      <td style={td}>
                        <span
                          style={{
                            ...badge,
                            ...getDocumentStatusStyle(
                              document.status
                            ),
                          }}
                        >
                          {document.status || "Pending"}
                        </span>
                      </td>

                      <td style={td}>
                        <span
                          style={{
                            ...badge,
                            ...getVerificationStyle(
                              document.verification_status
                            ),
                          }}
                        >
                          {document.verification_status ||
                            "Pending"}
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
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "16px",
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
  marginBottom: "12px",
  fontSize: "13px",
  fontWeight: "600",
};

const dangerBox = {
  background: "#ffeaea",
  border: "1px solid #f0b4b4",
  color: "#c62828",
  padding: "14px 18px",
  borderRadius: "10px",
  marginBottom: "18px",
  fontSize: "13px",
  fontWeight: "600",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1050px",
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

const badge = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "11px",
  fontWeight: "600",
  textTransform: "capitalize",
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

export default VendorCompliance;