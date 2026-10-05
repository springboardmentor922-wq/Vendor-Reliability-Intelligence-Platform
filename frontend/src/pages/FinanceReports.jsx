import React, {
  useEffect,
  useState,
} from "react";

import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

const MENU_ITEMS = [
  "Dashboard",
  "Purchase Orders",
  "Invoices",
  "Payments",
  "Financial Status",
  "Finance Reports",
  "Notifications",
];

const REPORTS = [
  {
    id: "invoices",
    title: "Invoice Report",
    description:
      "Overview of actual invoices, amounts, verification and payment status.",
    summaryLabel: "Invoices",
  },
  {
    id: "payments",
    title: "Payment Report",
    description:
      "Overview of actual payments, transaction details and payment status.",
    summaryLabel: "Payments",
  },
];

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

async function fetchReportData(reportId) {
  const token = getToken();

  const response = await fetch(
    `${API_URL}/reports/${reportId}/data`,
    {
      headers: {
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
    }
  );

  if (!response.ok) {
    const errorData =
      await response.json().catch(() => null);

    throw new Error(
      errorData?.detail ||
        `Unable to load ${reportId} report.`
    );
  }

  return response.json();
}

function FinanceReports() {
  const [summaries, setSummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState("");
  const [message, setMessage] = useState("");
  const [selectedReport, setSelectedReport] =
    useState(null);
  const [reportUrl, setReportUrl] = useState("");

  useEffect(() => {
    loadSummaries();

    return () => {
      if (reportUrl) {
        window.URL.revokeObjectURL(reportUrl);
      }
    };
  }, []);

  async function loadSummaries() {
    try {
      setLoading(true);
      setMessage("");

      const token = getToken();

      if (!token) {
        setMessage("Please login again.");
        return;
      }

      const results = {};

      await Promise.all(
        REPORTS.map(async (report) => {
          try {
            const data =
              await fetchReportData(
                report.id
              );

            results[report.id] =
              data?.record_count ??
              (Array.isArray(data?.data)
                ? data.data.length
                : 0);
          } catch (error) {
            console.warn(
              `Unable to load ${report.id}:`,
              error
            );

            results[report.id] = 0;
          }
        })
      );

      setSummaries(results);
    } catch (error) {
      console.error(
        "Finance reports error:",
        error
      );

      setMessage(
        error.message ||
          "Unable to load report summaries."
      );
    } finally {
      setLoading(false);
    }
  }

  async function openReport(reportId) {
    try {
      setActionLoading(
        `${reportId}-view`
      );

      setMessage("");

      const token = getToken();

      if (!token) {
        setMessage("Please login again.");
        return;
      }

      const response = await fetch(
        `${API_URL}/reports/${reportId}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData =
          await response.json().catch(
            () => null
          );

        throw new Error(
          errorData?.detail ||
            `Unable to open report (${response.status}).`
        );
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error(
          "Generated report is empty."
        );
      }

      if (reportUrl) {
        window.URL.revokeObjectURL(
          reportUrl
        );
      }

      const url =
        window.URL.createObjectURL(blob);

      const report = REPORTS.find(
        (item) => item.id === reportId
      );

      setSelectedReport(
        report || {
          id: reportId,
          title: "Report",
        }
      );

      setReportUrl(url);
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Unable to open report."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function downloadReport(
    reportId,
    format
  ) {
    try {
      setActionLoading(
        `${reportId}-${format}`
      );

      setMessage("");

      const token = getToken();

      if (!token) {
        setMessage("Please login again.");
        return;
      }

      const response = await fetch(
        `${API_URL}/reports/${reportId}/${format}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData =
          await response.json().catch(
            () => null
          );

        throw new Error(
          errorData?.detail ||
            `Report generation failed (${response.status}).`
        );
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error(
          "Generated report is empty."
        );
      }

      const extension =
        format === "excel"
          ? "xlsx"
          : "pdf";

      const filename =
        `${reportId}-report.${extension}`;

      const url =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

      setMessage(
        `${
          format === "excel"
            ? "Excel"
            : "PDF"
        } report downloaded successfully.`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
          "Unable to generate report."
      );
    } finally {
      setActionLoading("");
    }
  }

  function closePreview() {
    if (reportUrl) {
      window.URL.revokeObjectURL(
        reportUrl
      );
    }

    setReportUrl("");
    setSelectedReport(null);
  }

  return (
    <DashboardLayout
      title="Finance Reports"
      role="Finance Officer"
      menuItems={MENU_ITEMS}
    >
      <div style={page}>
        <div style={header}>
          <div>
            <h2 style={heading}>
              Reports
            </h2>

            <p style={subtitle}>
              Vendor Reliability Intelligence &
              Procurement Risk Management
            </p>
          </div>

          <button
            style={refreshButton}
            onClick={loadSummaries}
            disabled={loading}
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        {message && (
          <div style={messageBox}>
            {message}
          </div>
        )}

        <div style={tableContainer}>
          <div style={tableHeader}>
            <div style={reportColumn}>
              REPORT
            </div>

            <div style={summaryColumn}>
              LIVE SUMMARY
            </div>

            <div style={actionsColumn}>
              ACTIONS
            </div>
          </div>

          {REPORTS.map((report) => {
            const count =
              summaries[report.id] ?? 0;

            return (
              <div
                key={report.id}
                style={reportRow}
              >
                <div style={reportColumn}>
                  <div style={reportTitle}>
                    {report.title}
                  </div>

                  <div
                    style={reportDescription}
                  >
                    {report.description}
                  </div>
                </div>

                <div style={summaryColumn}>
                  <div style={summaryValue}>
                    {loading
                      ? "..."
                      : count}
                  </div>

                  <div style={summaryLabel}>
                    {report.summaryLabel}
                  </div>
                </div>

                <div style={actionsColumn}>
                  <button
                    style={viewButton}
                    onClick={() =>
                      openReport(
                        report.id
                      )
                    }
                    disabled={
                      actionLoading !== ""
                    }
                  >
                    {actionLoading ===
                    `${report.id}-view`
                      ? "Opening..."
                      : "View Report"}
                  </button>

                  <button
                    style={pdfButton}
                    onClick={() =>
                      downloadReport(
                        report.id,
                        "pdf"
                      )
                    }
                    disabled={
                      actionLoading !== ""
                    }
                  >
                    {actionLoading ===
                    `${report.id}-pdf`
                      ? "Generating..."
                      : "Download PDF"}
                  </button>

                  <button
                    style={excelButton}
                    onClick={() =>
                      downloadReport(
                        report.id,
                        "excel"
                      )
                    }
                    disabled={
                      actionLoading !== ""
                    }
                  >
                    {actionLoading ===
                    `${report.id}-excel`
                      ? "Exporting..."
                      : "Export Excel"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {selectedReport && reportUrl && (
          <div style={previewSection}>
            <div style={previewHeader}>
              <div>
                <h3 style={previewTitle}>
                  {selectedReport.title}
                </h3>

                <p style={previewSubtitle}>
                  Generated report preview
                </p>
              </div>

              <button
                style={closeButton}
                onClick={closePreview}
              >
                Close Preview
              </button>
            </div>

            <div style={iframeContainer}>
              <iframe
                src={reportUrl}
                title={
                  selectedReport.title
                }
                style={iframe}
              />
            </div>

            <div
              style={previewActions}
            >
              <button
                style={pdfButton}
                onClick={() =>
                  downloadReport(
                    selectedReport.id,
                    "pdf"
                  )
                }
                disabled={
                  actionLoading !== ""
                }
              >
                {actionLoading ===
                `${selectedReport.id}-pdf`
                  ? "Generating..."
                  : "Download PDF"}
              </button>

              <button
                style={excelButton}
                onClick={() =>
                  downloadReport(
                    selectedReport.id,
                    "excel"
                  )
                }
                disabled={
                  actionLoading !== ""
                }
              >
                {actionLoading ===
                `${selectedReport.id}-excel`
                  ? "Exporting..."
                  : "Export Excel"}
              </button>
            </div>
          </div>
        )}

        <div style={infoBox}>
          <div style={infoTitle}>
            Finance Officer Access
          </div>

          <p style={infoText}>
            Reports are generated from current
            invoice and payment records in the
            system. Finance Officer access is
            read-only for reporting purposes.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

const page = {
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const header = {
  background: "#ffffff",
  padding: "24px 28px",
  borderRadius: "12px",
  border: "1px solid #eaecf0",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
};

const heading = {
  margin: 0,
  fontSize: "22px",
  fontWeight: 700,
  color: "#101828",
};

const subtitle = {
  margin: "6px 0 0",
  color: "#667085",
  fontSize: "14px",
};

const refreshButton = {
  border: "1px solid #d0d5dd",
  background: "#ffffff",
  color: "#344054",
  padding: "9px 16px",
  borderRadius: "7px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "13px",
};

const messageBox = {
  padding: "12px 16px",
  background: "#f8f9fc",
  color: "#344054",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  fontSize: "13px",
};

const tableContainer = {
  background: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  overflow: "hidden",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns:
    "minmax(360px, 1.7fr) minmax(150px, 0.7fr) minmax(350px, 1.3fr)",
  gap: "20px",
  padding: "14px 22px",
  background: "#f9fafb",
  borderBottom: "1px solid #eaecf0",
  alignItems: "center",
};

const reportRow = {
  display: "grid",
  gridTemplateColumns:
    "minmax(360px, 1.7fr) minmax(150px, 0.7fr) minmax(350px, 1.3fr)",
  gap: "20px",
  padding: "20px 22px",
  borderBottom: "1px solid #eaecf0",
  alignItems: "center",
};

const reportColumn = {
  minWidth: 0,
};

const summaryColumn = {
  minWidth: 0,
};

const actionsColumn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "8px",
  flexWrap: "wrap",
};

const reportTitle = {
  fontSize: "15px",
  fontWeight: 650,
  color: "#101828",
  marginBottom: "5px",
};

const reportDescription = {
  fontSize: "13px",
  color: "#667085",
  lineHeight: 1.45,
};

const summaryValue = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#101828",
};

const summaryLabel = {
  marginTop: "3px",
  fontSize: "12px",
  color: "#667085",
};

const viewButton = {
  padding: "8px 13px",
  borderRadius: "7px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
  border: "1px solid #d0d5dd",
  background: "#ffffff",
  color: "#344054",
};

const pdfButton = {
  padding: "8px 13px",
  borderRadius: "7px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
  border: "1px solid #d0d5dd",
  background: "#ffffff",
  color: "#344054",
};

const excelButton = {
  padding: "8px 13px",
  borderRadius: "7px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
  border: "1px solid #d0d5dd",
  background: "#ffffff",
  color: "#344054",
};

const previewSection = {
  background: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "20px",
};

const previewHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  marginBottom: "16px",
};

const previewTitle = {
  margin: 0,
  fontSize: "17px",
  color: "#101828",
};

const previewSubtitle = {
  margin: "5px 0 0",
  fontSize: "13px",
  color: "#667085",
};

const closeButton = {
  padding: "8px 13px",
  borderRadius: "7px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
  border: "1px solid #d0d5dd",
  background: "#ffffff",
  color: "#344054",
};

const iframeContainer = {
  width: "100%",
  height: "720px",
  border: "1px solid #d0d5dd",
  borderRadius: "8px",
  overflow: "hidden",
  background: "#f9fafb",
};

const iframe = {
  width: "100%",
  height: "100%",
  border: "none",
};

const previewActions = {
  display: "flex",
  gap: "8px",
  marginTop: "14px",
  justifyContent: "flex-end",
};

const infoBox = {
  background: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "12px",
  padding: "18px 20px",
};

const infoTitle = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#101828",
};

const infoText = {
  margin: "7px 0 0",
  fontSize: "13px",
  lineHeight: 1.55,
  color: "#667085",
};

export default FinanceReports;