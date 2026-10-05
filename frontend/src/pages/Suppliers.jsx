import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const [formData, setFormData] = useState({
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
  });

  // ============================================================
  // AUTH TOKEN
  // ============================================================

  const getToken = () => {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token")
    );
  };

  // ============================================================
  // ERROR HANDLER
  // ============================================================

  const getErrorMessage = async (response) => {
    try {
      const data = await response.json();

      if (typeof data.detail === "string") {
        return data.detail;
      }

      if (Array.isArray(data.detail)) {
        return data.detail
          .map((item) => item.msg || "Validation error")
          .join(", ");
      }

      return data.message || "Something went wrong";
    } catch {
      return "Something went wrong";
    }
  };

  // ============================================================
  // LOAD SUPPLIERS
  // ============================================================

  const loadSuppliers = async () => {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      const headers = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/suppliers`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  // ============================================================
  // FORM
  // ============================================================

  const resetForm = () => {
    setFormData({
      company_name: "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
    });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // ============================================================
  // ADD SUPPLIER
  // ============================================================

  const handleAddSupplier = async (e) => {
    e.preventDefault();

    try {
      const token = getToken();

      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/suppliers`, {
        method: "POST",
        headers,
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setShowAdd(false);
      resetForm();

      await loadSuppliers();

      alert("Supplier added successfully");
    } catch (err) {
      alert(err.message || "Unable to add supplier");
    }
  };

  // ============================================================
  // EDIT SUPPLIER
  // ============================================================

  const openEdit = (supplier) => {
    setSelectedSupplier(supplier);

    setFormData({
      company_name: supplier.company_name || "",
      contact_person: supplier.contact_person || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
    });

    setShowEdit(true);
  };

  const handleEditSupplier = async (e) => {
    e.preventDefault();

    if (!selectedSupplier) {
      return;
    }

    try {
      const token = getToken();

      const headers = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_URL}/suppliers/${selectedSupplier.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setShowEdit(false);
      resetForm();
      setSelectedSupplier(null);

      await loadSuppliers();

      alert("Supplier updated successfully");
    } catch (err) {
      alert(err.message || "Unable to update supplier");
    }
  };

  // ============================================================
  // ACTIVATE / DEACTIVATE
  // ============================================================

  const changeStatus = async (supplier, action) => {
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${supplier.company_name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const token = getToken();

      const headers = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_URL}/suppliers/${supplier.id}/${action}`,
        {
          method: "PUT",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await loadSuppliers();
    } catch (err) {
      alert(err.message || "Unable to change supplier status");
    }
  };

  // ============================================================
  // DELETE SUPPLIER
  // ============================================================

  const handleDelete = async (supplier) => {
    const confirmed = window.confirm(
      `Delete ${supplier.company_name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const token = getToken();

      const headers = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_URL}/suppliers/${supplier.id}`,
        {
          method: "DELETE",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      await loadSuppliers();

      alert("Supplier deleted successfully");
    } catch (err) {
      alert(err.message || "Unable to delete supplier");
    }
  };

  // ============================================================
  // STATISTICS
  // ============================================================

  const totalSuppliers = suppliers.length;

  const activeSuppliers = suppliers.filter(
    (supplier) => supplier.supplier_status === "active"
  ).length;

  const inactiveSuppliers = suppliers.filter(
    (supplier) => supplier.supplier_status === "inactive"
  ).length;

  const suspendedSuppliers = suppliers.filter(
    (supplier) => supplier.supplier_status === "suspended"
  ).length;

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <DashboardLayout
      title="Suppliers"
      role="Supply Chain Manager"
      menuItems={[
        "Dashboard",
        "Suppliers",
        "Purchase Orders",
        "Deliveries",
        "Delayed Deliveries",
        "Performance",
        "Risk",
      ]}
    >
      <div style={styles.container}>
        {/* HEADER */}

        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              Supplier Management
            </h1>

            <p style={styles.subtitle}>
              Manage and monitor your suppliers
            </p>
          </div>

          <button
            style={styles.primaryButton}
            onClick={() => {
              resetForm();
              setShowAdd(true);
            }}
          >
            + Add Supplier
          </button>
        </div>

        {/* ERROR */}

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {/* STATISTICS */}

        <div style={styles.statsGrid}>
          <StatCard
            title="Total Suppliers"
            value={totalSuppliers}
            icon="🏢"
          />

          <StatCard
            title="Active"
            value={activeSuppliers}
            icon="✓"
          />

          <StatCard
            title="Inactive"
            value={inactiveSuppliers}
            icon="⏸"
          />

          <StatCard
            title="Suspended"
            value={suspendedSuppliers}
            icon="⚠"
          />
        </div>

        {/* SUPPLIERS TABLE */}

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>
              All Suppliers
            </h2>

            <button
              style={styles.refreshButton}
              onClick={loadSuppliers}
            >
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <div style={styles.empty}>
              Loading suppliers...
            </div>
          ) : suppliers.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>
                🏢
              </div>

              <h3>
                No suppliers found
              </h3>

              <p>
                Add your first supplier to get started.
              </p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>Company</th>
                    <th style={styles.th}>Contact Person</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Phone</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td style={styles.td}>
                        #{supplier.id}
                      </td>

                      <td style={styles.td}>
                        <strong>
                          {supplier.company_name}
                        </strong>
                      </td>

                      <td style={styles.td}>
                        {supplier.contact_person || "—"}
                      </td>

                      <td style={styles.td}>
                        {supplier.email || "—"}
                      </td>

                      <td style={styles.td}>
                        {supplier.phone || "—"}
                      </td>

                      <td style={styles.td}>
                        <StatusBadge
                          status={supplier.supplier_status}
                        />
                      </td>

                      <td style={styles.td}>
                        <div style={styles.actions}>
                          <button
                            style={styles.viewButton}
                            onClick={() => {
                              setSelectedSupplier(supplier);
                              setShowView(true);
                            }}
                          >
                            View
                          </button>

                          <button
                            style={styles.editButton}
                            onClick={() =>
                              openEdit(supplier)
                            }
                          >
                            Edit
                          </button>

                          {supplier.supplier_status === "active" ? (
                            <button
                              style={styles.warningButton}
                              onClick={() =>
                                changeStatus(
                                  supplier,
                                  "deactivate"
                                )
                              }
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              style={styles.successButton}
                              onClick={() =>
                                changeStatus(
                                  supplier,
                                  "activate"
                                )
                              }
                            >
                              Activate
                            </button>
                          )}

                          <button
                            style={styles.deleteButton}
                            onClick={() =>
                              handleDelete(supplier)
                            }
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

        {/* ADD MODAL */}

        {showAdd && (
          <Modal
            title="Add Supplier"
            onClose={() => setShowAdd(false)}
          >
            <SupplierForm
              formData={formData}
              handleChange={handleChange}
              onSubmit={handleAddSupplier}
              submitText="Add Supplier"
              onCancel={() => setShowAdd(false)}
            />
          </Modal>
        )}

        {/* EDIT MODAL */}

        {showEdit && (
          <Modal
            title="Edit Supplier"
            onClose={() => setShowEdit(false)}
          >
            <SupplierForm
              formData={formData}
              handleChange={handleChange}
              onSubmit={handleEditSupplier}
              submitText="Save Changes"
              onCancel={() => setShowEdit(false)}
            />
          </Modal>
        )}

        {/* VIEW MODAL */}

        {showView && selectedSupplier && (
          <Modal
            title="Supplier Details"
            onClose={() => {
              setShowView(false);
              setSelectedSupplier(null);
            }}
          >
            <div style={styles.details}>
              <Detail
                label="Supplier ID"
                value={`#${selectedSupplier.id}`}
              />

              <Detail
                label="Company Name"
                value={selectedSupplier.company_name}
              />

              <Detail
                label="Contact Person"
                value={
                  selectedSupplier.contact_person || "—"
                }
              />

              <Detail
                label="Email"
                value={
                  selectedSupplier.email || "—"
                }
              />

              <Detail
                label="Phone"
                value={
                  selectedSupplier.phone || "—"
                }
              />

              <Detail
                label="Address"
                value={
                  selectedSupplier.address || "—"
                }
              />

              <Detail
                label="Status"
                value={
                  selectedSupplier.supplier_status
                }
              />
            </div>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}

// ============================================================
// STAT CARD
// ============================================================

function StatCard({ title, value, icon }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>
        {icon}
      </div>

      <div>
        <div style={styles.statTitle}>
          {title}
        </div>

        <div style={styles.statValue}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({ status }) {
  const statusStyle =
    status === "active"
      ? styles.activeBadge
      : status === "inactive"
      ? styles.inactiveBadge
      : styles.suspendedBadge;

  return (
    <span style={statusStyle}>
      {status || "Unknown"}
    </span>
  );
}

// ============================================================
// MODAL
// ============================================================

function Modal({ title, children, onClose }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>
            {title}
          </h2>

          <button
            style={styles.closeButton}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div style={styles.modalBody}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUPPLIER FORM
// ============================================================

function SupplierForm({
  formData,
  handleChange,
  onSubmit,
  submitText,
  onCancel,
}) {
  return (
    <form onSubmit={onSubmit}>
      <FormField
        label="Company Name"
        name="company_name"
        value={formData.company_name}
        onChange={handleChange}
        required
      />

      <FormField
        label="Contact Person"
        name="contact_person"
        value={formData.contact_person}
        onChange={handleChange}
      />

      <FormField
        label="Email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
      />

      <FormField
        label="Phone"
        name="phone"
        value={formData.phone}
        onChange={handleChange}
      />

      <FormField
        label="Address"
        name="address"
        value={formData.address}
        onChange={handleChange}
      />

      <div style={styles.formActions}>
        <button
          type="button"
          style={styles.cancelButton}
          onClick={onCancel}
        >
          Cancel
        </button>

        <button
          type="submit"
          style={styles.primaryButton}
        >
          {submitText}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// FORM FIELD
// ============================================================

function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  required = false,
}) {
  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>
        {label}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        style={styles.input}
      />
    </div>
  );
}

// ============================================================
// DETAIL
// ============================================================

function Detail({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>
        {label}
      </span>

      <span style={styles.detailValue}>
        {value}
      </span>
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = {
  container: {
    padding: "24px",
    background: "#f8fafc",
    minHeight: "100%",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },

  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "700",
    color: "#111827",
  },

  subtitle: {
    marginTop: "6px",
    color: "#6b7280",
  },

  primaryButton: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "11px 18px",
    fontWeight: "600",
    cursor: "pointer",
  },

  refreshButton: {
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: "7px",
    padding: "8px 14px",
    cursor: "pointer",
  },

  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "12px 16px",
    borderRadius: "8px",
    marginBottom: "20px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },

  statCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  statIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    background: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "21px",
  },

  statTitle: {
    fontSize: "13px",
    color: "#6b7280",
  },

  statValue: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#111827",
    marginTop: "3px",
  },

  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    overflow: "hidden",
  },

  cardHeader: {
    padding: "18px 20px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cardTitle: {
    margin: 0,
    fontSize: "18px",
    color: "#111827",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "14px 16px",
    background: "#f9fafb",
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "15px 16px",
    borderTop: "1px solid #f0f0f0",
    color: "#374151",
    fontSize: "14px",
    whiteSpace: "nowrap",
  },

  actions: {
    display: "flex",
    gap: "6px",
  },

  viewButton: {
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: "6px",
    padding: "6px 9px",
    cursor: "pointer",
  },

  editButton: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: "6px",
    padding: "6px 9px",
    cursor: "pointer",
  },

  successButton: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#15803d",
    borderRadius: "6px",
    padding: "6px 9px",
    cursor: "pointer",
  },

  warningButton: {
    border: "1px solid #fde68a",
    background: "#fffbeb",
    color: "#b45309",
    borderRadius: "6px",
    padding: "6px 9px",
    cursor: "pointer",
  },

  deleteButton: {
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#dc2626",
    borderRadius: "6px",
    padding: "6px 9px",
    cursor: "pointer",
  },

  activeBadge: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "12px",
    fontWeight: "600",
  },

  inactiveBadge: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: "999px",
    background: "#f3f4f6",
    color: "#4b5563",
    fontSize: "12px",
    fontWeight: "600",
  },

  suspendedBadge: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: "12px",
    fontWeight: "600",
  },

  empty: {
    padding: "60px 20px",
    textAlign: "center",
    color: "#6b7280",
  },

  emptyIcon: {
    fontSize: "42px",
    marginBottom: "10px",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },

  modal: {
    width: "100%",
    maxWidth: "600px",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: "14px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 22px",
    borderBottom: "1px solid #e5e7eb",
  },

  modalTitle: {
    margin: 0,
    fontSize: "20px",
  },

  closeButton: {
    border: "none",
    background: "transparent",
    fontSize: "28px",
    cursor: "pointer",
    color: "#6b7280",
  },

  modalBody: {
    padding: "22px",
  },

  formGroup: {
    marginBottom: "16px",
  },

  label: {
    display: "block",
    marginBottom: "7px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "7px",
    fontSize: "14px",
    outline: "none",
  },

  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "22px",
  },

  cancelButton: {
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "10px 17px",
    cursor: "pointer",
  },

  details: {
    display: "flex",
    flexDirection: "column",
  },

  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    padding: "13px 0",
    borderBottom: "1px solid #f1f5f9",
  },

  detailLabel: {
    color: "#6b7280",
    fontWeight: "500",
  },

  detailValue: {
    color: "#111827",
    textAlign: "right",
    maxWidth: "60%",
    wordBreak: "break-word",
  },
};

export default Suppliers;