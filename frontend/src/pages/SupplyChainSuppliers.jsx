import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API = "http://127.0.0.1:8000";

const categories = [
  "Raw Material Suppliers",
  "Equipment Vendors",
  "IT Vendors",
  "Service Providers",
  "Logistics Partners",
  "Maintenance Vendors",
];

export default function SupplyChainSuppliers() {
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    company_name: "",
    category: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
  });

  // --------------------------------------------------
  // GET JWT TOKEN
  // Login.jsx stores it as "access_token"
  // --------------------------------------------------
  const getToken = () => {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token")
    );
  };

  // --------------------------------------------------
  // API HEADERS
  // --------------------------------------------------
  const getHeaders = () => {
    const token = getToken();

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  // --------------------------------------------------
  // LOAD MY VENDOR REQUESTS
  // --------------------------------------------------
  const loadRequests = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        setError("You are not logged in. Please login again.");
        return;
      }

      const response = await fetch(
        `${API}/supply-chain/vendor-requests`,
        {
          method: "GET",
          headers: getHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load vendor requests"
        );
      }

      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load vendor requests error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // LOAD DATA WHEN PAGE OPENS
  // --------------------------------------------------
  useEffect(() => {
    loadRequests();
  }, []);

  // --------------------------------------------------
  // FORM INPUT
  // --------------------------------------------------
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // --------------------------------------------------
  // SUBMIT VENDOR REQUEST
  // --------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    // Required field validation
    if (
      !form.company_name.trim() ||
      !form.category ||
      !form.contact_person.trim() ||
      !form.email.trim()
    ) {
      setError("Please fill all required fields.");
      return;
    }

    try {
      setLoading(true);

      const token = getToken();

      if (!token) {
        throw new Error("Your session has expired. Please login again.");
      }

      const response = await fetch(`${API}/vendors`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to create vendor request"
        );
      }

      // Success message
      setMessage("Vendor request submitted successfully.");

      // Clear form
      setForm({
        company_name: "",
        category: "",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
      });

      // Close modal
      setShowForm(false);

      // Reload requests
      await loadRequests();
    } catch (err) {
      console.error("Submit vendor request error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // CANCEL VENDOR REQUEST
  // --------------------------------------------------
  const handleCancel = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this vendor request?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setLoading(true);

      const token = getToken();

      if (!token) {
        throw new Error("Your session has expired. Please login again.");
      }

      const response = await fetch(
        `${API}/vendors/${id}/cancel`,
        {
          method: "PUT",
          headers: getHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to cancel request"
        );
      }

      setMessage("Vendor request cancelled successfully.");

      await loadRequests();
    } catch (err) {
      console.error("Cancel request error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // STATUS CSS CLASS
  // --------------------------------------------------
  const getStatusClass = (status) => {
    switch (status) {
      case "approved":
        return "status approved";

      case "rejected":
        return "status rejected";

      case "cancelled":
        return "status cancelled";

      case "pending":
      default:
        return "status pending";
    }
  };

  return (
    <DashboardLayout>
      <div className="supplier-page">

        {/* =========================================
            HEADER
        ========================================= */}
        <div className="page-header">
          <div>
            <h1>Supplier & Vendor Requests</h1>

            <p>
              Submit new vendor requests and track their
              approval status.
            </p>
          </div>

          <button
            className="primary-btn"
            onClick={() => {
              setError("");
              setMessage("");
              setShowForm(true);
            }}
          >
            + Add Vendor Request
          </button>
        </div>

        {/* =========================================
            SUCCESS MESSAGE
        ========================================= */}
        {message && (
          <div className="success-message">
            ✓ {message}
          </div>
        )}

        {/* =========================================
            ERROR MESSAGE
        ========================================= */}
        {error && (
          <div className="error-message">
            ⚠ {error}
          </div>
        )}

        {/* =========================================
            STATISTICS
        ========================================= */}
        <div className="stats-grid">

          <div className="stat-card">
            <div className="stat-number">
              {requests.length}
            </div>

            <div className="stat-label">
              Total Requests
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-number">
              {
                requests.filter(
                  (r) => r.approval_status === "pending"
                ).length
              }
            </div>

            <div className="stat-label">
              Pending
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-number">
              {
                requests.filter(
                  (r) => r.approval_status === "approved"
                ).length
              }
            </div>

            <div className="stat-label">
              Approved
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-number">
              {
                requests.filter(
                  (r) => r.approval_status === "rejected"
                ).length
              }
            </div>

            <div className="stat-label">
              Rejected
            </div>
          </div>

        </div>

        {/* =========================================
            REQUESTS TABLE
        ========================================= */}
        <div className="table-card">

          <div className="table-header">
            <div>
              <h2>My Vendor Requests</h2>

              <p>
                Track vendors submitted by your team.
              </p>
            </div>
          </div>

          {loading && requests.length === 0 ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <p>Loading vendor requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>

              <h3>No vendor requests yet</h3>

              <p>
                Click "Add Vendor Request" to submit your
                first vendor.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Category</th>
                    <th>Contact</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((vendor) => (
                    <tr key={vendor.id}>

                      <td>
                        <strong>
                          {vendor.company_name}
                        </strong>
                      </td>

                      <td>
                        {vendor.category || "-"}
                      </td>

                      <td>
                        {vendor.contact_person || "-"}
                      </td>

                      <td>
                        {vendor.email || "-"}
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            vendor.approval_status
                          )}
                        >
                          {vendor.approval_status ||
                            "pending"}
                        </span>
                      </td>

                      <td>
                        {vendor.approval_status ===
                          "pending" && (
                          <button
                            className="cancel-btn"
                            onClick={() =>
                              handleCancel(vendor.id)
                            }
                            disabled={loading}
                          >
                            Cancel
                          </button>
                        )}

                        {vendor.approval_status ===
                          "approved" && (
                          <span className="action-text approved-text">
                            ✓ Approved
                          </span>
                        )}

                        {vendor.approval_status ===
                          "rejected" && (
                          <span className="action-text rejected-text">
                            Rejected
                          </span>
                        )}

                        {vendor.approval_status ===
                          "cancelled" && (
                          <span className="action-text">
                            Cancelled
                          </span>
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =========================================
            ADD VENDOR REQUEST MODAL
        ========================================= */}
        {showForm && (
          <div
            className="modal-overlay"
            onClick={() => {
              if (!loading) {
                setShowForm(false);
              }
            }}
          >

            <div
              className="vendor-modal"
              onClick={(e) => e.stopPropagation()}
            >

              {/* Modal Header */}
              <div className="modal-header">

                <div>
                  <h2>Add Vendor Request</h2>

                  <p>
                    Submit a new vendor for approval.
                  </p>
                </div>

                <button
                  className="close-btn"
                  onClick={() => {
                    if (!loading) {
                      setShowForm(false);
                    }
                  }}
                  disabled={loading}
                >
                  ×
                </button>

              </div>

              {/* Form */}
              <form onSubmit={handleSubmit}>

                {/* Company Name */}
                <div className="form-group">

                  <label>
                    Company Name{" "}
                    <span>*</span>
                  </label>

                  <input
                    type="text"
                    name="company_name"
                    value={form.company_name}
                    onChange={handleChange}
                    placeholder="Enter company name"
                  />

                </div>

                {/* Category */}
                <div className="form-group">

                  <label>
                    Category{" "}
                    <span>*</span>
                  </label>

                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                  >
                    <option value="">
                      Select category
                    </option>

                    {categories.map((category) => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    ))}
                  </select>

                </div>

                {/* Contact Person */}
                <div className="form-group">

                  <label>
                    Contact Person{" "}
                    <span>*</span>
                  </label>

                  <input
                    type="text"
                    name="contact_person"
                    value={form.contact_person}
                    onChange={handleChange}
                    placeholder="Enter contact person"
                  />

                </div>

                {/* Email + Phone */}
                <div className="form-row">

                  <div className="form-group">

                    <label>
                      Email{" "}
                      <span>*</span>
                    </label>

                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="vendor@example.com"
                    />

                  </div>

                  <div className="form-group">

                    <label>
                      Phone
                    </label>

                    <input
                      type="text"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="Phone number"
                    />

                  </div>

                </div>

                {/* Address */}
                <div className="form-group">

                  <label>
                    Address
                  </label>

                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Enter vendor address"
                    rows="3"
                  />

                </div>

                {/* Modal Actions */}
                <div className="modal-actions">

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      if (!loading) {
                        setShowForm(false);
                      }
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={loading}
                  >
                    {loading
                      ? "Submitting..."
                      : "Submit Request"}
                  </button>

                </div>

              </form>
            </div>
          </div>
        )}

      </div>

      {/* =========================================
          PAGE CSS
      ========================================= */}
      <style>{`

        .supplier-page {
          padding: 10px;
        }

        /* Header */

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          gap: 20px;
        }

        .page-header h1 {
          margin: 0 0 6px;
          font-size: 28px;
          color: #111827;
        }

        .page-header p {
          margin: 0;
          color: #6b7280;
        }

        /* Buttons */

        .primary-btn {
          border: none;
          background: #111827;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
        }

        .primary-btn:hover {
          background: #1f2937;
        }

        .primary-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .secondary-btn {
          background: white;
          border: 1px solid #d1d5db;
          color: #374151;
          padding: 11px 18px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .secondary-btn:hover {
          background: #f9fafb;
        }

        .secondary-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Messages */

        .success-message,
        .error-message {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 18px;
          font-weight: 500;
        }

        .success-message {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .error-message {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        /* Stats */

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-bottom: 25px;
        }

        .stat-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          transition: 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
        }

        .stat-number {
          font-size: 27px;
          font-weight: 700;
          color: #111827;
        }

        .stat-label {
          color: #6b7280;
          margin-top: 5px;
          font-size: 14px;
        }

        /* Table */

        .table-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        .table-header {
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .table-header h2 {
          margin: 0 0 5px;
          color: #111827;
        }

        .table-header p {
          margin: 0;
          color: #6b7280;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          padding: 14px 18px;
          background: #f9fafb;
          color: #6b7280;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        td {
          padding: 16px 18px;
          border-top: 1px solid #f0f0f0;
          color: #374151;
          font-size: 14px;
        }

        td strong {
          color: #111827;
        }

        tbody tr:hover {
          background: #fafafa;
        }

        /* Status */

        .status {
          display: inline-block;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .status.pending {
          background: #fff7ed;
          color: #c2410c;
        }

        .status.approved {
          background: #ecfdf5;
          color: #047857;
        }

        .status.rejected {
          background: #fef2f2;
          color: #b91c1c;
        }

        .status.cancelled {
          background: #f3f4f6;
          color: #4b5563;
        }

        /* Actions */

        .cancel-btn {
          background: #fee2e2;
          color: #b91c1c;
          border: none;
          padding: 7px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }

        .cancel-btn:hover {
          background: #fecaca;
        }

        .cancel-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .action-text {
          color: #6b7280;
          font-size: 13px;
        }

        .approved-text {
          color: #047857;
          font-weight: 600;
        }

        .rejected-text {
          color: #b91c1c;
          font-weight: 600;
        }

        /* Empty State */

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #6b7280;
        }

        .empty-state h3 {
          color: #111827;
          margin: 10px 0 5px;
        }

        .empty-state p {
          margin: 0;
        }

        .empty-icon {
          font-size: 40px;
          margin-bottom: 10px;
        }

        /* Loading */

        .loading-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid #e5e7eb;
          border-top-color: #111827;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Modal */

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          justify-content: flex-end;
          z-index: 9999;
        }

        .vendor-modal {
          width: min(520px, 100%);
          height: 100%;
          background: white;
          padding: 28px;
          overflow-y: auto;
          box-shadow: -5px 0 25px rgba(0, 0, 0, 0.15);
          box-sizing: border-box;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 25px;
        }

        .modal-header h2 {
          margin: 0 0 5px;
          color: #111827;
        }

        .modal-header p {
          margin: 0;
          color: #6b7280;
        }

        .close-btn {
          border: none;
          background: #f3f4f6;
          width: 35px;
          height: 35px;
          border-radius: 50%;
          font-size: 24px;
          cursor: pointer;
          color: #374151;
        }

        .close-btn:hover {
          background: #e5e7eb;
        }

        .close-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Form */

        .form-group {
          margin-bottom: 18px;
        }

        .form-group label {
          display: block;
          margin-bottom: 7px;
          font-weight: 600;
          color: #374151;
        }

        .form-group label span {
          color: #dc2626;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 11px 13px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          font-family: inherit;
          background: white;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: #111827;
          box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.08);
        }

        .form-group textarea {
          resize: vertical;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        /* Modal Actions */

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 25px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        /* Responsive */

        @media (max-width: 800px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .page-header .primary-btn {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .vendor-modal {
            padding: 20px;
          }
        }

      `}</style>
    </DashboardLayout>
  );
}