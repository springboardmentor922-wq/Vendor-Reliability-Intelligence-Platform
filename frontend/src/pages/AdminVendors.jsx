import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

const MENU_ITEMS = [
  "Dashboard",
  "Users",
  "Vendors",
  "Suppliers",
  "Procurement",
  "Purchase Orders",
  "Risk Analysis",
  "Contract & Compliance",
  "Analytics",
  "Reports",
  "Settings",
  "Notifications",
];

const VENDOR_CATEGORIES = [
  "Raw Material Suppliers",
  "Equipment Vendors",
  "IT Vendors",
  "Service Providers",
  "Logistics Partners",
  "Maintenance Vendors",
];

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("authToken")
  );
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...(options.headers || {}),
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    let message = "Request failed";

    if (typeof data?.detail === "string") {
      message = data.detail;
    } else if (Array.isArray(data?.detail)) {
      message = data.detail
        .map((item) => item?.msg || JSON.stringify(item))
        .join(", ");
    } else if (data?.detail) {
      message = JSON.stringify(data.detail);
    } else if (data?.message) {
      message = data.message;
    }

    throw new Error(message);
  }

  return data;
}

// ============================================================
// INPUT STYLE
// ============================================================

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 13px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "14px",
  outline: "none",
  background: "#ffffff",
};

// ============================================================
// BUTTON STYLES
// ============================================================

const primaryButtonStyle = {
  padding: "11px 18px",
  border: "none",
  borderRadius: "8px",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: "600",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "11px 18px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#334155",
  fontWeight: "600",
  cursor: "pointer",
};

const smallButtonStyle = {
  padding: "7px 10px",
  border: "none",
  borderRadius: "6px",
  background: "#e2e8f0",
  color: "#334155",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer",
};

// ============================================================
// TABLE STYLES
// ============================================================

const thStyle = {
  padding: "14px 12px",
  textAlign: "left",
  fontSize: "13px",
  fontWeight: "700",
  color: "#475569",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "14px 12px",
  fontSize: "13px",
  color: "#334155",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

// ============================================================
// STATUS STYLES
// ============================================================

function getStatusStyle(status) {
  const value = String(status || "").toLowerCase();

  if (value === "active") {
    return {
      display: "inline-block",
      padding: "5px 9px",
      borderRadius: "20px",
      background: "#dcfce7",
      color: "#166534",
      fontSize: "12px",
      fontWeight: "600",
    };
  }

  if (value === "inactive") {
    return {
      display: "inline-block",
      padding: "5px 9px",
      borderRadius: "20px",
      background: "#fee2e2",
      color: "#991b1b",
      fontSize: "12px",
      fontWeight: "600",
    };
  }

  return {
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: "20px",
    background: "#f1f5f9",
    color: "#475569",
    fontSize: "12px",
    fontWeight: "600",
  };
}

function getApprovalStyle(status) {
  const value = String(status || "").toLowerCase();

  if (value === "approved") {
    return {
      display: "inline-block",
      padding: "5px 9px",
      borderRadius: "20px",
      background: "#dcfce7",
      color: "#166534",
      fontSize: "12px",
      fontWeight: "600",
    };
  }

  if (value === "rejected") {
    return {
      display: "inline-block",
      padding: "5px 9px",
      borderRadius: "20px",
      background: "#fee2e2",
      color: "#991b1b",
      fontSize: "12px",
      fontWeight: "600",
    };
  }

  return {
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: "20px",
    background: "#fef3c7",
    color: "#92400e",
    fontSize: "12px",
    fontWeight: "600",
  };
}

// ============================================================
// VENDOR FORM
// IMPORTANT:
// This component is OUTSIDE AdminVendors.
// This fixes the cursor/focus issue.
// ============================================================

function VendorForm({
  editingVendor,
  formData,
  handleChange,
  handleCreate,
  handleUpdate,
  resetForm,
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "14px",
        padding: "25px",
        marginBottom: "25px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "22px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "22px",
            fontWeight: "700",
          }}
        >
          {editingVendor ? "Edit Vendor" : "Add New Vendor"}
        </h2>

        <button
          type="button"
          onClick={resetForm}
          style={{
            border: "none",
            background: "transparent",
            fontSize: "24px",
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>

      <form onSubmit={editingVendor ? handleUpdate : handleCreate}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "18px",
          }}
        >
          {/* COMPANY NAME */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: "600",
              }}
            >
              Company Name *
            </label>

            <input
              type="text"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              placeholder="Enter company name"
              required
              style={inputStyle}
            />
          </div>

          {/* CONTACT PERSON */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: "600",
              }}
            >
              Contact Person
            </label>

            <input
              type="text"
              name="contact_person"
              value={formData.contact_person}
              onChange={handleChange}
              placeholder="Enter contact person"
              style={inputStyle}
            />
          </div>

          {/* EMAIL */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: "600",
              }}
            >
              Email *
            </label>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="vendor@example.com"
              required
              style={inputStyle}
            />
          </div>

          {/* PHONE */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: "600",
              }}
            >
              Phone
            </label>

            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter phone number"
              style={inputStyle}
            />
          </div>

          {/* ADDRESS */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: "600",
              }}
            >
              Address
            </label>

            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter address"
              style={inputStyle}
            />
          </div>

          {/* CATEGORY */}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: "600",
              }}
            >
              Vendor Category *
            </label>

            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              style={inputStyle}
            >
              <option value="">
                Select Vendor Category
              </option>

              {VENDOR_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* PASSWORD ONLY WHEN CREATING */}

          {!editingVendor && (
            <>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "7px",
                    fontWeight: "600",
                  }}
                >
                  Password *
                </label>

                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create vendor login password"
                  required
                  minLength={6}
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "7px",
                    fontWeight: "600",
                  }}
                >
                  Confirm Password *
                </label>

                <input
                  type="password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  placeholder="Confirm password"
                  required
                  minLength={6}
                  style={inputStyle}
                />
              </div>
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "25px",
          }}
        >
          <button
            type="button"
            onClick={resetForm}
            style={secondaryButtonStyle}
          >
            Cancel
          </button>

          <button
            type="submit"
            style={primaryButtonStyle}
          >
            {editingVendor ? "Update Vendor" : "Create Vendor"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// ADMIN VENDORS
// ============================================================

function AdminVendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);

  const [formData, setFormData] = useState({
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    category: "",
    password: "",
    confirm_password: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ============================================================
  // LOAD VENDORS
  // ============================================================

  const loadVendors = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await apiRequest("/vendors");

      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load vendors:", err);
      setError(err.message || "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  // ============================================================
  // RESET FORM
  // ============================================================

  const resetForm = () => {
    setFormData({
      company_name: "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      category: "",
      password: "",
      confirm_password: "",
    });

    setEditingVendor(null);
    setShowForm(false);
  };

  // ============================================================
  // HANDLE INPUT
  // ============================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ============================================================
  // OPEN ADD FORM
  // ============================================================

  const openAddForm = () => {
    setMessage("");
    setError("");

    setFormData({
      company_name: "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      category: "",
      password: "",
      confirm_password: "",
    });

    setEditingVendor(null);
    setShowForm(true);
  };

  // ============================================================
  // OPEN EDIT FORM
  // ============================================================

  const openEdit = (vendor) => {
    setMessage("");
    setError("");

    setFormData({
      company_name: vendor.company_name || "",
      contact_person: vendor.contact_person || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      address: vendor.address || "",
      category: vendor.category || "",
      password: "",
      confirm_password: "",
    });

    setEditingVendor(vendor);
    setShowForm(true);
  };

  // ============================================================
  // CREATE VENDOR
  // ============================================================

  const handleCreate = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    const companyName = formData.company_name.trim();
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;
    const confirmPassword = formData.confirm_password;

    if (!companyName) {
      setError("Company name is required.");
      return;
    }

    if (!email) {
      setError("Email is required.");
      return;
    }

    if (!formData.category) {
      setError("Please select a vendor category.");
      return;
    }

    if (!password) {
      setError("Password is required for vendor login.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const data = await apiRequest("/vendors", {
        method: "POST",
        body: JSON.stringify({
          company_name: companyName,
          contact_person:
            formData.contact_person.trim() || null,
          email,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          category: formData.category,
          password,
        }),
      });

      const vendor = data?.vendor;

      const vendorId = vendor?.id
        ? `V-${String(vendor.id).padStart(4, "0")}`
        : "created successfully";

      setMessage(
        `Vendor created successfully. Vendor ID: ${vendorId}`
      );

      resetForm();

      await loadVendors();
    } catch (err) {
      console.error("Create vendor error:", err);
      setError(err.message || "Failed to create vendor.");
    }
  };

  // ============================================================
  // UPDATE VENDOR
  // ============================================================

  const handleUpdate = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!editingVendor) {
      return;
    }

    const companyName = formData.company_name.trim();
    const email = formData.email.trim().toLowerCase();

    if (!companyName) {
      setError("Company name is required.");
      return;
    }

    if (!email) {
      setError("Email is required.");
      return;
    }

    if (!formData.category) {
      setError("Please select a vendor category.");
      return;
    }

    try {
      await apiRequest(`/vendors/${editingVendor.id}`, {
        method: "PUT",
        body: JSON.stringify({
          company_name: companyName,
          contact_person:
            formData.contact_person.trim() || null,
          email,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          category: formData.category,
        }),
      });

      setMessage("Vendor updated successfully.");

      resetForm();

      await loadVendors();
    } catch (err) {
      console.error("Update vendor error:", err);
      setError(err.message || "Failed to update vendor.");
    }
  };

  // ============================================================
  // APPROVE VENDOR
  // ============================================================

  const handleApprove = async (vendorId) => {
    try {
      setMessage("");
      setError("");

      await apiRequest(`/vendors/${vendorId}/approve`, {
        method: "PUT",
      });

      setMessage("Vendor approved successfully.");

      await loadVendors();
    } catch (err) {
      console.error("Approve vendor error:", err);
      setError(err.message || "Failed to approve vendor.");
    }
  };

  // ============================================================
  // REJECT VENDOR
  // ============================================================

  const handleReject = async (vendorId) => {
    try {
      setMessage("");
      setError("");

      await apiRequest(`/vendors/${vendorId}/reject`, {
        method: "PUT",
      });

      setMessage("Vendor rejected successfully.");

      await loadVendors();
    } catch (err) {
      console.error("Reject vendor error:", err);
      setError(err.message || "Failed to reject vendor.");
    }
  };

  // ============================================================
  // ACTIVATE VENDOR
  // ============================================================

  const handleActivate = async (vendorId) => {
    try {
      setMessage("");
      setError("");

      await apiRequest(`/vendors/${vendorId}/activate`, {
        method: "PUT",
      });

      setMessage("Vendor activated successfully.");

      await loadVendors();
    } catch (err) {
      console.error("Activate vendor error:", err);
      setError(err.message || "Failed to activate vendor.");
    }
  };

  // ============================================================
  // DEACTIVATE VENDOR
  // ============================================================

  const handleDeactivate = async (vendorId) => {
    try {
      setMessage("");
      setError("");

      await apiRequest(`/vendors/${vendorId}/deactivate`, {
        method: "PUT",
      });

      setMessage("Vendor deactivated successfully.");

      await loadVendors();
    } catch (err) {
      console.error("Deactivate vendor error:", err);
      setError(err.message || "Failed to deactivate vendor.");
    }
  };

  // ============================================================
  // DELETE VENDOR
  // ============================================================

  const handleDelete = async (vendorId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this vendor?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setMessage("");
      setError("");

      await apiRequest(`/vendors/${vendorId}`, {
        method: "DELETE",
      });

      setMessage("Vendor deleted successfully.");

      await loadVendors();
    } catch (err) {
      console.error("Delete vendor error:", err);
      setError(err.message || "Failed to delete vendor.");
    }
  };

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <DashboardLayout
      title="Vendor Management"
      role="administrator"
      menuItems={MENU_ITEMS}
    >
      <div
        style={{
          padding: "25px",
          background: "#f8fafc",
          minHeight: "100vh",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "25px",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: "700",
              }}
            >
              Vendor Management
            </h1>

            <p
              style={{
                marginTop: "7px",
                color: "#64748b",
              }}
            >
              Manage vendors and vendor login accounts
            </p>
          </div>

          <button
            type="button"
            onClick={openAddForm}
            style={primaryButtonStyle}
          >
            + Add New Vendor
          </button>
        </div>

        {/* SUCCESS MESSAGE */}

        {message && (
          <div
            style={{
              background: "#dcfce7",
              color: "#166534",
              padding: "13px 16px",
              borderRadius: "8px",
              marginBottom: "18px",
              border: "1px solid #86efac",
            }}
          >
            {message}
          </div>
        )}

        {/* ERROR MESSAGE */}

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "13px 16px",
              borderRadius: "8px",
              marginBottom: "18px",
              border: "1px solid #fca5a5",
            }}
          >
            {error}
          </div>
        )}

        {/* FORM */}

        {showForm && (
          <VendorForm
            editingVendor={editingVendor}
            formData={formData}
            handleChange={handleChange}
            handleCreate={handleCreate}
            handleUpdate={handleUpdate}
            resetForm={resetForm}
          />
        )}

        {/* VENDOR TABLE */}

        <div
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            overflow: "hidden",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
              }}
            >
              All Vendors
            </h2>
          </div>

          {loading ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              Loading vendors...
            </div>
          ) : vendors.length === 0 ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              No vendors found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "1100px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                    }}
                  >
                    <th style={thStyle}>Vendor ID</th>
                    <th style={thStyle}>Company</th>
                    <th style={thStyle}>Contact Person</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Approval</th>
                    <th style={thStyle}>Reliability</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {vendors.map((vendor) => (
                    <tr
                      key={vendor.id}
                      style={{
                        borderTop:
                          "1px solid #e5e7eb",
                      }}
                    >
                      <td style={tdStyle}>
                        V-
                        {String(vendor.id).padStart(4, "0")}
                      </td>

                      <td style={tdStyle}>
                        <strong>
                          {vendor.company_name || "-"}
                        </strong>
                      </td>

                      <td style={tdStyle}>
                        {vendor.contact_person || "-"}
                      </td>

                      <td style={tdStyle}>
                        {vendor.email || "-"}
                      </td>

                      <td style={tdStyle}>
                        {vendor.category || "-"}
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={getStatusStyle(
                            vendor.vendor_status
                          )}
                        >
                          {vendor.vendor_status || "unknown"}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={getApprovalStyle(
                            vendor.approval_status
                          )}
                        >
                          {vendor.approval_status || "pending"}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        {Number(
                          vendor.reliability_score || 0
                        ).toFixed(2)}
                      </td>

                      <td style={tdStyle}>
                        <div
                          style={{
                            display: "flex",
                            gap: "7px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => openEdit(vendor)}
                            style={smallButtonStyle}
                          >
                            Edit
                          </button>

                          {vendor.approval_status ===
                            "pending" && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleApprove(vendor.id)
                                }
                                style={{
                                  ...smallButtonStyle,
                                  background: "#dcfce7",
                                  color: "#166534",
                                }}
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleReject(vendor.id)
                                }
                                style={{
                                  ...smallButtonStyle,
                                  background: "#fee2e2",
                                  color: "#991b1b",
                                }}
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {vendor.approval_status ===
                            "approved" &&
                            vendor.vendor_status ===
                              "active" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeactivate(
                                    vendor.id
                                  )
                                }
                                style={{
                                  ...smallButtonStyle,
                                  background: "#fef3c7",
                                  color: "#92400e",
                                }}
                              >
                                Deactivate
                              </button>
                            )}

                          {vendor.vendor_status ===
                            "inactive" &&
                            vendor.approval_status ===
                              "approved" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleActivate(
                                    vendor.id
                                  )
                                }
                                style={{
                                  ...smallButtonStyle,
                                  background: "#dcfce7",
                                  color: "#166534",
                                }}
                              >
                                Activate
                              </button>
                            )}

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(vendor.id)
                            }
                            style={{
                              ...smallButtonStyle,
                              background: "#fee2e2",
                              color: "#991b1b",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AdminVendors;