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

function VendorProfile() {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchVendorProfile();
  }, []);

  async function fetchVendorProfile() {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        setError("Authentication token not found. Please login again.");
        return;
      }

      const response = await fetch(`${API_URL}/vendors/me`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Failed to load vendor profile"
        );
      }

      setVendor(data);
    } catch (err) {
      console.error("Vendor profile loading error:", err);
      setError(err.message || "Unable to load vendor profile");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout
        title="Vendor Profile"
        role="Vendor"
        menuItems={[
          "Dashboard",
          "Profile",
          "Purchase Orders",
          "Deliveries",
          "Performance",
          "Risk Status",
          "Notifications",
        ]}
      >
        <div style={messageStyle}>
          Loading your vendor profile...
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout
        title="Vendor Profile"
        role="Vendor"
        menuItems={[
          "Dashboard",
          "Profile",
          "Purchase Orders",
          "Deliveries",
          "Performance",
          "Risk Status",
          "Notifications",
        ]}
      >
        <div style={errorStyle}>
          {error}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Vendor Profile"
      role="Vendor"
      menuItems={[
        "Dashboard",
        "Profile",
        "Purchase Orders",
        "Deliveries",
        "Performance",
        "Risk Status",
        "Notifications",
      ]}
    >
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>
              VENDOR MANAGEMENT
            </div>

            <h2 style={titleStyle}>
              Vendor Profile
            </h2>

            <p style={subtitleStyle}>
              View your registered vendor information.
            </p>
          </div>

          <button
            onClick={fetchVendorProfile}
            style={refreshButton}
          >
            Refresh
          </button>
        </div>

        <div style={profileCardStyle}>
          <div style={profileTopStyle}>
            <div style={avatarStyle}>
              {vendor?.company_name
                ? vendor.company_name.charAt(0).toUpperCase()
                : "V"}
            </div>

            <div>
              <h3 style={companyNameStyle}>
                {vendor?.company_name || "—"}
              </h3>

              <p style={vendorIdStyle}>
                Vendor ID: VEN-{String(vendor?.id || "").padStart(3, "0")}
              </p>
            </div>
          </div>

          <table style={tableStyle}>
            <tbody>
              <tr>
                <td style={labelStyle}>Company Name</td>
                <td style={valueStyle}>
                  {vendor?.company_name || "—"}
                </td>
              </tr>

              <tr>
                <td style={labelStyle}>Vendor ID</td>
                <td style={valueStyle}>
                  VEN-{String(vendor?.id || "").padStart(3, "0")}
                </td>
              </tr>

              <tr>
                <td style={labelStyle}>Category</td>
                <td style={valueStyle}>
                  {vendor?.category || "—"}
                </td>
              </tr>

              <tr>
                <td style={labelStyle}>Contact Person</td>
                <td style={valueStyle}>
                  {vendor?.contact_person || "—"}
                </td>
              </tr>

              <tr>
                <td style={labelStyle}>Email</td>
                <td style={valueStyle}>
                  {vendor?.email || "—"}
                </td>
              </tr>

              <tr>
                <td style={labelStyle}>Phone</td>
                <td style={valueStyle}>
                  {vendor?.phone || "—"}
                </td>
              </tr>

              <tr>
                <td style={labelStyle}>Address</td>
                <td style={valueStyle}>
                  {vendor?.address || "—"}
                </td>
              </tr>

              <tr>
                <td style={labelStyle}>Vendor Status</td>
                <td style={valueStyle}>
                  <span
                    style={getStatusStyle(
                      vendor?.vendor_status
                    )}
                  >
                    {vendor?.vendor_status || "—"}
                  </span>
                </td>
              </tr>

              <tr>
                <td style={labelStyle}>Approval Status</td>
                <td style={valueStyle}>
                  <span
                    style={getApprovalStyle(
                      vendor?.approval_status
                    )}
                  >
                    {vendor?.approval_status || "—"}
                  </span>
                </td>
              </tr>

              <tr>
                <td style={labelStyle}>Reliability Score</td>
                <td style={valueStyle}>
                  {vendor?.reliability_score !== null &&
                  vendor?.reliability_score !== undefined
                    ? `${vendor.reliability_score}%`
                    : "0%"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

function getStatusStyle(status) {
  const value = String(status || "").toLowerCase();

  if (value === "active") {
    return {
      display: "inline-block",
      padding: "6px 12px",
      borderRadius: "20px",
      background: "#e8f7ee",
      color: "#16803c",
      fontSize: "12px",
      fontWeight: "600",
      textTransform: "capitalize",
    };
  }

  if (value === "suspended") {
    return {
      display: "inline-block",
      padding: "6px 12px",
      borderRadius: "20px",
      background: "#ffeaea",
      color: "#c62828",
      fontSize: "12px",
      fontWeight: "600",
      textTransform: "capitalize",
    };
  }

  return {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: "20px",
    background: "#eeeeee",
    color: "#555",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "capitalize",
  };
}

function getApprovalStyle(status) {
  const value = String(status || "").toLowerCase();

  if (value === "approved") {
    return {
      display: "inline-block",
      padding: "6px 12px",
      borderRadius: "20px",
      background: "#e8f7ee",
      color: "#16803c",
      fontSize: "12px",
      fontWeight: "600",
      textTransform: "capitalize",
    };
  }

  if (value === "rejected") {
    return {
      display: "inline-block",
      padding: "6px 12px",
      borderRadius: "20px",
      background: "#ffeaea",
      color: "#c62828",
      fontSize: "12px",
      fontWeight: "600",
      textTransform: "capitalize",
    };
  }

  return {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: "20px",
    background: "#fff4df",
    color: "#b26a00",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "capitalize",
  };
}

const containerStyle = {
  padding: "0",
};

const headerStyle = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "18px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const eyebrowStyle = {
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "1.4px",
  color: "#777",
};

const titleStyle = {
  margin: "6px 0 0",
  color: "#17152f",
};

const subtitleStyle = {
  margin: "7px 0 0",
  color: "#777",
  fontSize: "13px",
};

const refreshButton = {
  border: "none",
  background: "#17152f",
  color: "#fff",
  padding: "9px 15px",
  borderRadius: "7px",
  cursor: "pointer",
};

const profileCardStyle = {
  background: "#fff",
  padding: "25px",
  borderRadius: "14px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
};

const profileTopStyle = {
  display: "flex",
  alignItems: "center",
  gap: "15px",
  paddingBottom: "22px",
  borderBottom: "1px solid #eee",
  marginBottom: "5px",
};

const avatarStyle = {
  width: "52px",
  height: "52px",
  borderRadius: "50%",
  background: "#17152f",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "21px",
  fontWeight: "700",
};

const companyNameStyle = {
  margin: 0,
  color: "#17152f",
  fontSize: "19px",
};

const vendorIdStyle = {
  margin: "5px 0 0",
  color: "#888",
  fontSize: "12px",
};

const tableStyle = {
  width: "100%",
  maxWidth: "850px",
  borderCollapse: "collapse",
  marginTop: "10px",
};

const labelStyle = {
  padding: "15px",
  fontWeight: "600",
  background: "#f5f7fb",
  borderBottom: "1px solid #eee",
  width: "35%",
  color: "#555",
  fontSize: "13px",
};

const valueStyle = {
  padding: "15px",
  borderBottom: "1px solid #eee",
  color: "#333",
  fontSize: "13px",
};

const messageStyle = {
  background: "#fff",
  padding: "40px",
  borderRadius: "14px",
  textAlign: "center",
  color: "#777",
};

const errorStyle = {
  background: "#ffeaea",
  color: "#c62828",
  padding: "18px",
  borderRadius: "10px",
};

export default VendorProfile;