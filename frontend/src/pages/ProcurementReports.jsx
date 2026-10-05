import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_BASE_URL = "http://127.0.0.1:8000";

const REPORTS = [
  {
    id: "procurement",
    title: "Procurement Summary Report",
    description:
      "Summary of actual procurement requests and their current approval status.",
    valueSuffix: "Requests",
    label: "Requests",
  },
  {
    id: "purchase-orders",
    title: "Purchase Order Report",
    description:
      "Overview of actual purchase orders and their current lifecycle status.",
    valueSuffix: "Orders",
    label: "Orders",
  },
  {
    id: "vendor-performance",
    title: "Vendor Performance Report",
    description:
      "Summary of vendor reliability scores and performance from the vendor database.",
    valueSuffix: "Evaluations",
    label: "Average Reliability",
  },
  {
    id: "contracts",
    title: "Contract Report",
    description:
      "Overview of contracts, contract values, dates and lifecycle status.",
    valueSuffix: "Contracts",
    label: "Contracts",
  },
];

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken")
  );
}

async function apiRequest(endpoint) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data?.detail
        ? data.detail
        : "Unable to fetch report data.";

    throw new Error(message);
  }

  return data;
}

function extractRows(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  if (Array.isArray(data?.records)) {
    return data.records;
  }

  return [];
}

function getAverageReliability(rows) {
  const values = rows
    .map((row) => {
      const value =
        row?.Reliability ??
        row?.reliability ??
        row?.reliability_score ??
        row?.["Reliability Score"];

      if (value === null || value === undefined) {
        return null;
      }

      const numericValue = Number(
        String(value).replace("%", "").replace(",", "")
      );

      return Number.isFinite(numericValue) ? numericValue : null;
    })
    .filter((value) => value !== null);

  if (values.length === 0) {
    return "No data";
  }

  const average =
    values.reduce((total, value) => total + value, 0) / values.length;

  return `${average.toFixed(1)}%`;
}

function ProcurementReports() {
  const [summaries, setSummaries] = useState({
    procurement: {
      value: "Loading...",
      label: "Requests",
    },
    "purchase-orders": {
      value: "Loading...",
      label: "Orders",
    },
    "vendor-performance": {
      value: "Loading...",
      label: "Average Reliability",
    },
    contracts: {
      value: "Loading...",
      label: "Contracts",
    },
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedReport, setSelectedReport] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState("");

  const loadReportData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const results = await Promise.all(
        REPORTS.map(async (report) => {
          const data = await apiRequest(`/reports/${report.id}/data`);
          return {
            id: report.id,
            rows: extractRows(data),
          };
        })
      );

      const newSummaries = {
        procurement: {
          value: "0 Requests",
          label: "Requests",
        },
        "purchase-orders": {
          value: "0 Orders",
          label: "Orders",
        },
        "vendor-performance": {
          value: "0 Evaluations",
          label: "Average Reliability",
        },
        contracts: {
          value: "0 Contracts",
          label: "Contracts",
        },
      };

      results.forEach((result) => {
        const count = result.rows.length;

        if (result.id === "procurement") {
          newSummaries.procurement = {
            value: `${count} Requests`,
            label: "Requests",
          };
        }

        if (result.id === "purchase-orders") {
          newSummaries["purchase-orders"] = {
            value: `${count} Orders`,
            label: "Orders",
          };
        }

        if (result.id === "vendor-performance") {
          newSummaries["vendor-performance"] = {
            value: `${count} Evaluations`,
            label: "Average Reliability",
          };
        }

        if (result.id === "contracts") {
          newSummaries.contracts = {
            value: `${count} Contracts`,
            label: "Contracts",
          };
        }
      });

      setSummaries(newSummaries);
    } catch (err) {
      console.error("Report loading error:", err);
      setError(err.message || "Unable to load report data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  const viewReport = async (report) => {
    try {
      setPreviewLoading(true);
      setError("");

      if (selectedReport?.url) {
        URL.revokeObjectURL(selectedReport.url);
      }

      const token = getToken();

      const response = await fetch(
        `${API_BASE_URL}/reports/${report.id}/pdf`,
        {
          method: "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        const text = await response.text();

        let message = "Unable to generate report.";

        try {
          const data = JSON.parse(text);
          message = data?.detail || message;
        } catch {
          if (text) {
            message = text;
          }
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      setSelectedReport({
        id: report.id,
        title: report.title,
        url,
      });
    } catch (err) {
      console.error("Report preview error:", err);
      setError(err.message || "Unable to preview report.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadReport = async (report, format) => {
    const downloadKey = `${report.id}-${format}`;

    try {
      setDownloadingReport(downloadKey);
      setError("");

      const token = getToken();

      const response = await fetch(
        `${API_BASE_URL}/reports/${report.id}/${format}`,
        {
          method: "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        const text = await response.text();

        let message = "Unable to download report.";

        try {
          const data = JSON.parse(text);
          message = data?.detail || message;
        } catch {
          if (text) {
            message = text;
          }
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;

      const extension = format === "pdf" ? "pdf" : "xlsx";

      link.download = `${report.id}-report.${extension}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Report download error:", err);
      setError(err.message || "Unable to download report.");
    } finally {
      setDownloadingReport("");
    }
  };

  const closePreview = () => {
    if (selectedReport?.url) {
      URL.revokeObjectURL(selectedReport.url);
    }

    setSelectedReport(null);
  };

  useEffect(() => {
    return () => {
      if (selectedReport?.url) {
        URL.revokeObjectURL(selectedReport.url);
      }
    };
  }, [selectedReport]);

  return (
    <DashboardLayout>
      <div className="reports-page">
        <div className="reports-header">
          <div>
            <h1>Reports</h1>
            <p>
              Vendor Reliability Intelligence &amp; Procurement Risk Management
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={() => loadReportData(true)}
            disabled={loading || refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="reports-section">
          <div className="section-heading">
            <h2>Procurement Reports</h2>
            <p>
              View reports generated from actual procurement system data.
            </p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="reports-table">
            <div className="reports-table-header">
              <div>REPORT</div>
              <div>LIVE SUMMARY</div>
              <div>ACTIONS</div>
            </div>

            {REPORTS.map((report) => (
              <div className="report-row" key={report.id}>
                <div className="report-information">
                  <h3>{report.title}</h3>
                  <p>{report.description}</p>
                </div>

                <div className="report-summary">
                  <strong>
                    {loading
                      ? "Loading..."
                      : summaries[report.id]?.value || "0"}
                  </strong>

                  <span>
                    {summaries[report.id]?.label || report.label}
                  </span>

                  {report.id === "vendor-performance" &&
                    !loading &&
                    summaries[report.id]?.value !== "0 Evaluations" && (
                      <small>
                        Reliability data available in the generated report
                      </small>
                    )}
                </div>

                <div className="report-actions">
                  <button
                    className="action-button primary"
                    onClick={() => viewReport(report)}
                    disabled={previewLoading}
                  >
                    {previewLoading && selectedReport?.id === report.id
                      ? "Opening..."
                      : "View Report"}
                  </button>

                  <button
                    className="action-button secondary"
                    onClick={() => downloadReport(report, "pdf")}
                    disabled={downloadingReport !== ""}
                  >
                    {downloadingReport === `${report.id}-pdf`
                      ? "Downloading..."
                      : "Download PDF"}
                  </button>

                  <button
                    className="action-button secondary"
                    onClick={() => downloadReport(report, "excel")}
                    disabled={downloadingReport !== ""}
                  >
                    {downloadingReport === `${report.id}-excel`
                      ? "Exporting..."
                      : "Export Excel"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedReport && (
          <div className="report-preview-section">
            <div className="preview-header">
              <div>
                <h2>{selectedReport.title}</h2>
                <p>Generated report preview</p>
              </div>

              <button
                className="close-preview-button"
                onClick={closePreview}
              >
                Close Preview
              </button>
            </div>

            <div className="pdf-container">
              <iframe
                src={selectedReport.url}
                title={`${selectedReport.title} Preview`}
                className="pdf-frame"
              />
            </div>

            <div className="preview-actions">
              <button
                className="action-button secondary"
                onClick={() => {
                  const report = REPORTS.find(
                    (item) => item.id === selectedReport.id
                  );

                  if (report) {
                    downloadReport(report, "pdf");
                  }
                }}
              >
                Download PDF
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .reports-page {
          width: 100%;
          min-height: 100%;
          padding: 28px 32px 40px;
          background: #f7f8fa;
          box-sizing: border-box;
        }

        .reports-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 32px;
        }

        .reports-header h1 {
          margin: 0 0 6px;
          font-size: 30px;
          font-weight: 700;
          color: #1f2937;
        }

        .reports-header p {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        .refresh-button {
          min-width: 110px;
          height: 40px;
          padding: 0 18px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: #ffffff;
          color: #374151;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .refresh-button:hover:not(:disabled) {
          background: #f3f4f6;
        }

        .refresh-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .reports-section {
          width: 100%;
        }

        .section-heading {
          margin-bottom: 18px;
        }

        .section-heading h2 {
          margin: 0 0 5px;
          font-size: 21px;
          font-weight: 700;
          color: #1f2937;
        }

        .section-heading p {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        .error-message {
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 16px;
          padding: 12px 14px;
          border: 1px solid #fecaca;
          border-radius: 6px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 14px;
        }

        .reports-table {
          width: 100%;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .reports-table-header {
          display: grid;
          grid-template-columns: minmax(320px, 1.7fr) minmax(190px, 0.8fr) minmax(410px, 1.4fr);
          align-items: center;
          min-height: 48px;
          padding: 0 24px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .report-row {
          display: grid;
          grid-template-columns: minmax(320px, 1.7fr) minmax(190px, 0.8fr) minmax(410px, 1.4fr);
          align-items: center;
          min-height: 118px;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
          box-sizing: border-box;
          gap: 24px;
        }

        .report-row:last-child {
          border-bottom: none;
        }

        .report-information h3 {
          margin: 0 0 8px;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .report-information p {
          max-width: 620px;
          margin: 0;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.55;
        }

        .report-summary {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .report-summary strong {
          color: #111827;
          font-size: 20px;
          font-weight: 700;
          white-space: nowrap;
        }

        .report-summary span {
          color: #6b7280;
          font-size: 12px;
          font-weight: 500;
        }

        .report-summary small {
          margin-top: 3px;
          color: #9ca3af;
          font-size: 11px;
          line-height: 1.4;
        }

        .report-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .action-button {
          height: 38px;
          padding: 0 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }

        .action-button.primary {
          border: 1px solid #1f2937;
          background: #1f2937;
          color: #ffffff;
        }

        .action-button.primary:hover:not(:disabled) {
          background: #111827;
        }

        .action-button.secondary {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .action-button.secondary:hover:not(:disabled) {
          background: #f3f4f6;
        }

        .action-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .report-preview-section {
          width: 100%;
          margin-top: 28px;
          padding: 22px;
          box-sizing: border-box;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }

        .preview-header h2 {
          margin: 0 0 5px;
          color: #111827;
          font-size: 19px;
          font-weight: 700;
        }

        .preview-header p {
          margin: 0;
          color: #6b7280;
          font-size: 13px;
        }

        .close-preview-button {
          height: 38px;
          padding: 0 15px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: #ffffff;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .close-preview-button:hover {
          background: #f3f4f6;
        }

        .pdf-container {
          width: 100%;
          height: 720px;
          border: 1px solid #d1d5db;
          background: #f3f4f6;
          overflow: hidden;
        }

        .pdf-frame {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
        }

        .preview-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 16px;
        }

        @media (max-width: 1200px) {
          .reports-table-header,
          .report-row {
            grid-template-columns: 1.5fr 0.8fr 1.2fr;
          }

          .report-actions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 900px) {
          .reports-page {
            padding: 22px 18px 32px;
          }

          .reports-table-header {
            display: none;
          }

          .report-row {
            display: block;
            padding: 22px;
          }

          .report-summary {
            margin-top: 18px;
          }

          .report-actions {
            margin-top: 18px;
            justify-content: flex-start;
          }

          .reports-header {
            align-items: flex-start;
          }
        }

        @media (max-width: 600px) {
          .reports-header {
            flex-direction: column;
          }

          .refresh-button {
            width: 100%;
          }

          .report-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .action-button {
            width: 100%;
          }

          .preview-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .close-preview-button {
            width: 100%;
          }

          .pdf-container {
            height: 550px;
          }

          .preview-actions {
            justify-content: stretch;
          }

          .preview-actions .action-button {
            width: 100%;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}

export default ProcurementReports;