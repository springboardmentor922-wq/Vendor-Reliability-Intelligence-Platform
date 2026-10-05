import React, { useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_BASE_URL = "http://127.0.0.1:8000";

const REPORTS = [
  {
    key: "vendor-performance",
    title: "Vendor Performance",
    description:
      "Performance scores, delivery performance and reliability information.",
    icon: "📊",
  },
  {
    key: "procurement",
    title: "Procurement",
    description:
      "Procurement request information, quantities, amounts and status.",
    icon: "🛒",
  },
  {
    key: "purchase-orders",
    title: "Purchase Orders",
    description:
      "Purchase order details, vendors, delivery dates and order status.",
    icon: "📦",
  },
  {
    key: "compliance",
    title: "Compliance",
    description:
      "Vendor approval, status and available compliance-related information.",
    icon: "🛡️",
  },
  {
    key: "contracts",
    title: "Contracts",
    description:
      "Contract details, vendor information, values, dates and status.",
    icon: "📄",
  },
];


function Reports() {

  const [loading, setLoading] = useState("");

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");


  // ==========================================================
  // GET TOKEN
  // ==========================================================

  const getToken = () => {

    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("token");

    return token;
  };


  // ==========================================================
  // DOWNLOAD REPORT
  // ==========================================================

  const downloadReport = async (
    reportType,
    format
  ) => {

    setLoading(`${reportType}-${format}`);

    setError("");

    setSuccess("");


    try {

      const token = getToken();


      if (!token) {

        throw new Error(
          "Authentication token not found. Please login again."
        );

      }


      const url =
        `${API_BASE_URL}/reports/` +
        `${reportType}/${format}`;


      const response = await fetch(
        url,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );


      if (!response.ok) {

        let errorMessage =
          `Report download failed (${response.status})`;


        try {

          const errorData =
            await response.json();

          if (errorData.detail) {

            errorMessage =
              errorData.detail;

          }

        } catch {
          // Ignore JSON parsing error
        }


        throw new Error(
          errorMessage
        );

      }


      const blob =
        await response.blob();


      if (!blob || blob.size === 0) {

        throw new Error(
          "The server returned an empty report."
        );

      }


      // ======================================================
      // CREATE DOWNLOAD
      // ======================================================

      const extension =
        format === "excel"
          ? "xlsx"
          : "pdf";


      const filename =
        `${reportType.replaceAll("-", "_")}_report.${extension}`;


      const blobUrl =
        window.URL.createObjectURL(blob);


      const link =
        document.createElement("a");


      link.href = blobUrl;

      link.download = filename;

      document.body.appendChild(link);

      link.click();

      link.remove();


      window.URL.revokeObjectURL(
        blobUrl
      );


      setSuccess(
        `${format.toUpperCase()} report downloaded successfully.`
      );

    } catch (error) {

      console.error(
        "Report download error:",
        error
      );


      setError(
        error.message ||
        "Unable to download report."
      );

    } finally {

      setLoading("");

    }

  };


  return (

    <DashboardLayout
      title="Reports & Export"
      role="Administrator"
      menuItems={[
        "Dashboard",
        "Users",
        "Vendors",
        "Suppliers",
        "Procurement Requests",
        "Purchase Orders",
        "Contracts",
        "Performance",
        "Risk Status",
        "Analytics",
        "Reports",
        "Communications",
        "Notifications",
      ]}
    >

      <div style={page}>

        {/* ==================================================
            HEADER
        ================================================== */}

        <div style={header}>

          <div>

            <h1 style={title}>
              Reports & Export
            </h1>

            <p style={subtitle}>
              Generate and download procurement,
              vendor performance, purchase order,
              compliance and contract reports.
            </p>

          </div>


          <div style={headerIcon}>
            📑
          </div>

        </div>


        {/* ==================================================
            SUCCESS MESSAGE
        ================================================== */}

        {success && (

          <div style={successBox}>
            ✓ {success}
          </div>

        )}


        {/* ==================================================
            ERROR MESSAGE
        ================================================== */}

        {error && (

          <div style={errorBox}>
            ⚠ {error}
          </div>

        )}


        {/* ==================================================
            REPORT CARDS
        ================================================== */}

        <div style={grid}>

          {REPORTS.map(
            (report) => (

              <div
                key={report.key}
                style={card}
              >

                <div style={cardTop}>

                  <div style={reportIcon}>
                    {report.icon}
                  </div>

                  <div>

                    <h2 style={cardTitle}>
                      {report.title}
                    </h2>

                    <p style={description}>
                      {report.description}
                    </p>

                  </div>

                </div>


                {/* ========================================
                    BUTTONS
                ======================================== */}

                <div style={buttonRow}>

                  <button
                    type="button"
                    style={pdfButton}
                    disabled={
                      loading !== ""
                    }
                    onClick={() =>
                      downloadReport(
                        report.key,
                        "pdf"
                      )
                    }
                  >

                    {loading ===
                    `${report.key}-pdf`
                      ? "Generating..."
                      : "📄 Export PDF"}

                  </button>


                  <button
                    type="button"
                    style={excelButton}
                    disabled={
                      loading !== ""
                    }
                    onClick={() =>
                      downloadReport(
                        report.key,
                        "excel"
                      )
                    }
                  >

                    {loading ===
                    `${report.key}-excel`
                      ? "Generating..."
                      : "📊 Export Excel"}

                  </button>

                </div>

              </div>

            )
          )}

        </div>


        {/* ==================================================
            INFORMATION
        ================================================== */}

        <div style={infoCard}>

          <div style={infoIcon}>
            ℹ️
          </div>

          <div>

            <h3 style={infoTitle}>
              Report Information
            </h3>

            <p style={infoText}>
              Reports are generated from the current
              data stored in the VRIPRM database.
              Excel files can be opened in Microsoft
              Excel or compatible spreadsheet software.
              PDF files are suitable for viewing,
              printing and sharing.
            </p>

          </div>

        </div>

      </div>

    </DashboardLayout>

  );
}


// ============================================================
// STYLES
// ============================================================

const page = {
  padding: "24px",
  background: "#f5f7fb",
  minHeight: "100%",
};


const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#ffffff",
  borderRadius: "16px",
  padding: "24px",
  marginBottom: "24px",
  boxShadow:
    "0 4px 18px rgba(0, 0, 0, 0.06)",
};


const title = {
  margin: 0,
  fontSize: "28px",
  fontWeight: 700,
  color: "#172033",
};


const subtitle = {
  marginTop: "8px",
  marginBottom: 0,
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: 1.6,
};


const headerIcon = {
  width: "58px",
  height: "58px",
  borderRadius: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#eef4ff",
  fontSize: "28px",
};


const successBox = {
  background: "#ecfdf3",
  border: "1px solid #bbf7d0",
  color: "#166534",
  padding: "12px 16px",
  borderRadius: "10px",
  marginBottom: "18px",
  fontSize: "14px",
};


const errorBox = {
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#be123c",
  padding: "12px 16px",
  borderRadius: "10px",
  marginBottom: "18px",
  fontSize: "14px",
};


const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "20px",
};


const card = {
  background: "#ffffff",
  borderRadius: "16px",
  padding: "22px",
  boxShadow:
    "0 4px 18px rgba(0, 0, 0, 0.06)",
  border:
    "1px solid #edf0f5",
};


const cardTop = {
  display: "flex",
  gap: "16px",
  alignItems: "flex-start",
};


const reportIcon = {
  width: "52px",
  height: "52px",
  flexShrink: 0,
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f1f5ff",
  fontSize: "25px",
};


const cardTitle = {
  margin: 0,
  color: "#172033",
  fontSize: "19px",
  fontWeight: 700,
};


const description = {
  marginTop: "7px",
  marginBottom: 0,
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: 1.5,
};


const buttonRow = {
  display: "flex",
  gap: "10px",
  marginTop: "22px",
};


const baseButton = {
  flex: 1,
  border: "none",
  borderRadius: "9px",
  padding: "11px 12px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "0.2s",
};


const pdfButton = {
  ...baseButton,
  background: "#f1f5f9",
  color: "#334155",
};


const excelButton = {
  ...baseButton,
  background: "#eaf7ef",
  color: "#166534",
};


const infoCard = {
  marginTop: "24px",
  background: "#ffffff",
  borderRadius: "16px",
  padding: "20px",
  display: "flex",
  gap: "14px",
  alignItems: "flex-start",
  boxShadow:
    "0 4px 18px rgba(0, 0, 0, 0.05)",
};


const infoIcon = {
  fontSize: "22px",
};


const infoTitle = {
  margin: 0,
  color: "#172033",
  fontSize: "16px",
};


const infoText = {
  marginTop: "6px",
  marginBottom: 0,
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: 1.6,
};


export default Reports;