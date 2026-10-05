import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_BASE_URL = "http://127.0.0.1:8000";

const REPORTS = [
  {
    id: "procurement",
    title: "Procurement Summary Report",
    description:
      "Summary of actual procurement requests and their current approval status.",
    summaryLabel: "Requests",
    endpoint: "/reports/procurement/data",
  },
  {
    id: "purchase-orders",
    title: "Purchase Order Report",
    description:
      "Overview of actual purchase orders and their current lifecycle status.",
    summaryLabel: "Orders",
    endpoint: "/reports/purchase-orders/data",
  },
  {
    id: "vendor-performance",
    title: "Vendor Performance Report",
    description:
      "Summary of vendor reliability scores and performance from the vendor database.",
    summaryLabel: "Average Reliability",
    endpoint: "/reports/vendor-performance/data",
  },
  {
    id: "compliance",
    title: "Compliance Report",
    description:
      "Overview of vendor approval, status and compliance-related information.",
    summaryLabel: "Vendors",
    endpoint: "/reports/compliance/data",
  },
  {
    id: "contracts",
    title: "Contract Report",
    description:
      "Overview of contracts, contract values, dates and lifecycle status.",
    summaryLabel: "Contracts",
    endpoint: "/reports/contracts/data",
  },
];

function AdminReports() {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");

  const [summaries, setSummaries] = useState({
    procurement: "Loading...",
    "purchase-orders": "Loading...",
    "vendor-performance": "Loading...",
    compliance: "Loading...",
    contracts: "Loading...",
  });

  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");

  const getToken = () => {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("authToken") ||
      ""
    );
  };

  const extractArray = (data) => {
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
  };

  const loadSummaries = async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = getToken();

      if (!token) {
        setMessage("Please login again.");
        setLoading(false);
        return;
      }

      const headers = {
        Authorization: "Bearer " + token,
        Accept: "application/json",
      };

      const newSummaries = {
        procurement: "0 Requests",
        "purchase-orders": "0 Orders",
        "vendor-performance": "0 Evaluations",
        compliance: "0 Vendors",
        contracts: "0 Contracts",
      };

      const results = await Promise.allSettled(
        REPORTS.map((report) =>
          fetch(API_BASE_URL + report.endpoint, {
            method: "GET",
            headers: headers,
          }).then((response) => {
            if (!response.ok) {
              throw new Error(
                report.id +
                  " request failed: " +
                  response.status
              );
            }

            return response.json();
          })
        )
      );

      results.forEach((result, index) => {
        const report = REPORTS[index];

        if (result.status !== "fulfilled") {
          console.error(
            report.id + " summary unavailable:",
            result.reason
          );
          return;
        }

        const items = extractArray(result.value);

        if (report.id === "procurement") {
          newSummaries.procurement =
            items.length + " Requests";
        }

        if (report.id === "purchase-orders") {
          newSummaries["purchase-orders"] =
            items.length + " Orders";
        }

        if (report.id === "vendor-performance") {
          if (items.length === 0) {
            newSummaries["vendor-performance"] =
              "0 Evaluations";
          } else {
            const scores = items
              .map((item) => {
                const value =
                  item.reliability_score !== undefined &&
                  item.reliability_score !== null
                    ? item.reliability_score
                    : item.overall_score !== undefined &&
                      item.overall_score !== null
                    ? item.overall_score
                    : null;

                if (value === null) {
                  return null;
                }

                const number = Number(value);

                if (Number.isNaN(number)) {
                  return null;
                }

                return number;
              })
              .filter((value) => value !== null);

            if (scores.length > 0) {
              const total = scores.reduce(
                (sum, value) => sum + value,
                0
              );

              const average = total / scores.length;

              newSummaries["vendor-performance"] =
                average.toFixed(1) + "%";
            } else {
              newSummaries["vendor-performance"] =
                items.length + " Evaluations";
            }
          }
        }

        if (report.id === "compliance") {
          newSummaries.compliance =
            items.length + " Vendors";
        }

        if (report.id === "contracts") {
          newSummaries.contracts =
            items.length + " Contracts";
        }
      });

      setSummaries(newSummaries);
    } catch (error) {
      console.error(
        "Unable to load report summaries:",
        error
      );

      setMessage(
        error.message ||
          "Unable to refresh report summaries."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummaries();
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const viewReport = async (reportType) => {
    setActionLoading(reportType + "-view");
    setMessage("");

    try {
      const token = getToken();

      if (!token) {
        setMessage("Please login again.");
        return;
      }

      const response = await fetch(
        API_BASE_URL +
          "/reports/" +
          reportType +
          "/pdf",
        {
          method: "GET",
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/pdf",
          },
        }
      );

      if (!response.ok) {
        let errorMessage =
          "Unable to generate report.";

        try {
          const data = await response.json();

          if (data && data.detail) {
            errorMessage =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          }
        } catch (error) {
          errorMessage =
            "Unable to generate report. Status: " +
            response.status;
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error(
          "The generated report is empty."
        );
      }

      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }

      const newPdfUrl =
        URL.createObjectURL(blob);

      setPdfUrl(newPdfUrl);

      const report = REPORTS.find(
        (item) => item.id === reportType
      );

      setSelectedReport(report || null);

      setTimeout(() => {
        const preview =
          document.getElementById(
            "report-preview"
          );

        if (preview) {
          preview.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 150);
    } catch (error) {
      console.error(
        "View report error:",
        error
      );

      setMessage(
        error.message ||
          "Unable to open report."
      );
    } finally {
      setActionLoading("");
    }
  };

  const downloadReport = async (
    reportType,
    format
  ) => {
    setActionLoading(
      reportType + "-" + format
    );

    setMessage("");

    try {
      const token = getToken();

      if (!token) {
        setMessage("Please login again.");
        return;
      }

      const response = await fetch(
        API_BASE_URL +
          "/reports/" +
          reportType +
          "/" +
          format,
        {
          method: "GET",
          headers: {
            Authorization: "Bearer " + token,
          },
        }
      );

      if (!response.ok) {
        let errorMessage =
          "Unable to generate report.";

        try {
          const data = await response.json();

          if (data && data.detail) {
            errorMessage =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          }
        } catch (error) {
          errorMessage =
            "Report generation failed. Status: " +
            response.status;
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error(
          "The generated report is empty."
        );
      }

      const extension =
        format === "excel"
          ? "xlsx"
          : "pdf";

      const fileName =
        reportType +
        "-report." +
        extension;

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      setMessage(
        format === "excel"
          ? "Excel report downloaded successfully."
          : "PDF report downloaded successfully."
      );
    } catch (error) {
      console.error(
        "Download report error:",
        error
      );

      setMessage(
        error.message ||
          "Unable to generate report."
      );
    } finally {
      setActionLoading("");
    }
  };

  const closePreview = () => {
    setSelectedReport(null);

    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl("");
    }
  };

  return (
    <DashboardLayout>
      <div className="admin-reports-page">
        <div className="reports-container">

          <div className="reports-header">
            <div>
              <h1>Reports</h1>

              <p>
                Vendor Reliability Intelligence & Procurement Risk Management
              </p>
            </div>

            <button
              className="refresh-button"
              onClick={loadSummaries}
              disabled={loading}
            >
              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>

          <div className="section-heading">
            <h2>Procurement Reports</h2>

            <p>
              View reports generated from actual procurement system data.
            </p>
          </div>

          {message && (
            <div className="message-box">
              {message}
            </div>
          )}

          <div className="reports-card">

            <div className="reports-table-header">
              <div>REPORT</div>
              <div>LIVE SUMMARY</div>
              <div>ACTIONS</div>
            </div>

            {REPORTS.map((report) => (
              <div
                className="report-row"
                key={report.id}
              >
                <div className="report-information">
                  <div className="report-text">
                    <h3>
                      {report.title}
                    </h3>

                    <p>
                      {report.description}
                    </p>
                  </div>
                </div>

                <div className="report-summary">
                  <div className="summary-value">
                    {summaries[report.id]}
                  </div>

                  <div className="summary-label">
                    {report.summaryLabel}
                  </div>
                </div>

                <div className="report-actions">

                  <button
                    className="view-button"
                    onClick={() =>
                      viewReport(report.id)
                    }
                    disabled={!!actionLoading}
                  >
                    {actionLoading ===
                    report.id + "-view"
                      ? "Opening..."
                      : "View Report"}
                  </button>

                  <button
                    className="pdf-button"
                    onClick={() =>
                      downloadReport(
                        report.id,
                        "pdf"
                      )
                    }
                    disabled={!!actionLoading}
                  >
                    {actionLoading ===
                    report.id + "-pdf"
                      ? "Generating..."
                      : "Download PDF"}
                  </button>

                  <button
                    className="excel-button"
                    onClick={() =>
                      downloadReport(
                        report.id,
                        "excel"
                      )
                    }
                    disabled={!!actionLoading}
                  >
                    {actionLoading ===
                    report.id + "-excel"
                      ? "Exporting..."
                      : "Export Excel"}
                  </button>

                </div>
              </div>
            ))}

          </div>

          {selectedReport && pdfUrl && (
            <div
              id="report-preview"
              className="report-preview"
            >
              <div className="preview-header">

                <div>
                  <span>
                    REPORT PREVIEW
                  </span>

                  <h2>
                    {selectedReport.title}
                  </h2>
                </div>

                <div className="preview-actions">

                  <button
                    onClick={() =>
                      downloadReport(
                        selectedReport.id,
                        "pdf"
                      )
                    }
                  >
                    Download PDF
                  </button>

                  <button
                    onClick={() =>
                      downloadReport(
                        selectedReport.id,
                        "excel"
                      )
                    }
                  >
                    Export Excel
                  </button>

                  <button
                    className="close-button"
                    onClick={closePreview}
                  >
                    Close
                  </button>

                </div>
              </div>

              <div className="pdf-container">
                <iframe
                  src={pdfUrl}
                  title={selectedReport.title}
                  className="pdf-frame"
                />
              </div>
            </div>
          )}

        </div>

        <style>{`
          * {
            box-sizing: border-box;
          }

          .admin-reports-page {
            min-height: 100vh;
            background: #f6f8fb;
            color: #172033;
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }

          .reports-container {
            width: 100%;
            max-width: 1500px;
            margin: 0 auto;
            padding: 30px 36px 42px;
          }

          .reports-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 30px;
          }

          .reports-header h1 {
            margin: 0;
            color: #101828;
            font-size: 27px;
            font-weight: 700;
          }

          .reports-header p {
            margin: 5px 0 0;
            color: #667085;
            font-size: 13px;
          }

          .refresh-button {
            height: 38px;
            padding: 0 16px;
            border: 1px solid #d0d5dd;
            border-radius: 7px;
            background: #ffffff;
            color: #344054;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
          }

          .refresh-button:hover {
            background: #f9fafb;
          }

          .refresh-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .section-heading {
            margin-bottom: 18px;
          }

          .section-heading h2 {
            margin: 0;
            color: #101828;
            font-size: 20px;
            font-weight: 700;
          }

          .section-heading p {
            margin: 5px 0 0;
            color: #667085;
            font-size: 13px;
          }

          .message-box {
            padding: 11px 14px;
            margin-bottom: 16px;
            border: 1px solid #d0d5dd;
            border-radius: 7px;
            background: #ffffff;
            color: #344054;
            font-size: 13px;
          }

          .reports-card {
            overflow: hidden;
            border: 1px solid #e4e7ec;
            border-radius: 10px;
            background: #ffffff;
            box-shadow: 0 1px 4px rgba(16, 24, 40, 0.04);
          }

          .reports-table-header {
            display: grid;
            grid-template-columns: minmax(350px, 1.45fr) minmax(150px, 0.55fr) minmax(410px, 1fr);
            align-items: center;
            min-height: 44px;
            padding: 0 22px;
            border-bottom: 1px solid #eaecf0;
            background: #fafbfc;
            color: #667085;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.7px;
          }

          .report-row {
            display: grid;
            grid-template-columns: minmax(350px, 1.45fr) minmax(150px, 0.55fr) minmax(410px, 1fr);
            align-items: center;
            min-height: 105px;
            padding: 17px 22px;
            border-bottom: 1px solid #eaecf0;
          }

          .report-row:last-child {
            border-bottom: none;
          }

          .report-row:hover {
            background: #fcfcfd;
          }

          .report-information {
            padding-right: 25px;
          }

          .report-text h3 {
            margin: 0 0 6px;
            color: #101828;
            font-size: 15px;
            font-weight: 700;
          }

          .report-text p {
            max-width: 570px;
            margin: 0;
            color: #667085;
            font-size: 12px;
            line-height: 1.5;
          }

          .report-summary {
            padding: 0 15px;
          }

          .summary-value {
            color: #101828;
            font-size: 17px;
            font-weight: 700;
          }

          .summary-label {
            margin-top: 4px;
            color: #98a2b3;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }

          .report-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
          }

          .report-actions button {
            height: 35px;
            padding: 0 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
          }

          .report-actions button:disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }

          .view-button {
            border: 1px solid #344054;
            background: #344054;
            color: #ffffff;
          }

          .view-button:hover {
            background: #1d2939;
          }

          .pdf-button,
          .excel-button {
            border: 1px solid #d0d5dd;
            background: #ffffff;
            color: #344054;
          }

          .pdf-button:hover,
          .excel-button:hover {
            background: #f9fafb;
          }

          .report-preview {
            margin-top: 28px;
            overflow: hidden;
            border: 1px solid #e4e7ec;
            border-radius: 10px;
            background: #ffffff;
            box-shadow: 0 2px 8px rgba(16, 24, 40, 0.05);
          }

          .preview-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding: 16px 20px;
            border-bottom: 1px solid #e4e7ec;
          }

          .preview-header span {
            color: #98a2b3;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.8px;
          }

          .preview-header h2 {
            margin: 4px 0 0;
            color: #101828;
            font-size: 17px;
            font-weight: 700;
          }

          .preview-actions {
            display: flex;
            gap: 8px;
          }

          .preview-actions button {
            height: 35px;
            padding: 0 12px;
            border: 1px solid #d0d5dd;
            border-radius: 6px;
            background: #ffffff;
            color: #344054;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          }

          .preview-actions button:hover {
            background: #f9fafb;
          }

          .preview-actions .close-button {
            border-color: #344054;
            background: #344054;
            color: #ffffff;
          }

          .preview-actions .close-button:hover {
            background: #1d2939;
          }

          .pdf-container {
            width: 100%;
            height: 780px;
            background: #525659;
          }

          .pdf-frame {
            display: block;
            width: 100%;
            height: 100%;
            border: none;
            background: #ffffff;
          }

          @media (max-width: 1150px) {
            .reports-table-header {
              display: none;
            }

            .report-row {
              grid-template-columns: 1fr;
              gap: 13px;
              padding: 18px 20px;
            }

            .report-information {
              padding-right: 0;
            }

            .report-summary {
              padding: 0;
            }

            .report-actions {
              justify-content: flex-start;
            }
          }

          @media (max-width: 700px) {
            .reports-container {
              padding: 20px 14px 30px;
            }

            .reports-header {
              flex-direction: column;
              align-items: flex-start;
            }

            .refresh-button {
              width: 100%;
            }

            .report-actions {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              width: 100%;
            }

            .report-actions button {
              width: 100%;
              padding: 0 5px;
              font-size: 10px;
            }

            .preview-header {
              align-items: flex-start;
              flex-direction: column;
            }

            .preview-actions {
              width: 100%;
              flex-wrap: wrap;
            }
          }

          @media (max-width: 500px) {
            .report-actions {
              grid-template-columns: 1fr;
            }

            .preview-actions {
              display: grid;
              grid-template-columns: 1fr;
            }

            .preview-actions button {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </DashboardLayout>
  );
}

export default AdminReports;