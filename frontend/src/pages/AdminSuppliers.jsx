import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);

  const [formData, setFormData] = useState({
    company_name: "",
    contact_person: "",
    email: "",
    password: "",
    confirm_password: "",
    phone: "",
    address: "",
    category: "",
  });

  const getToken = () => {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token")
    );
  };

  const getErrorMessage = (data, defaultMessage) => {
    if (!data) {
      return defaultMessage;
    }

    if (typeof data.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          const location = item.loc
            ? item.loc.join(" → ")
            : "Field";

          return `${location}: ${item.msg || "Invalid value"}`;
        })
        .join("\n");
    }

    if (data.detail && typeof data.detail === "object") {
      return JSON.stringify(data.detail);
    }

    if (typeof data.message === "string") {
      return data.message;
    }

    return defaultMessage;
  };

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        throw new Error(
          "Authentication token not found. Please login again."
        );
      }

      const response = await fetch(`${API_URL}/suppliers`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Failed to load suppliers")
        );
      }

      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch suppliers error:", err);
      setError(err.message || "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      company_name: "",
      contact_person: "",
      email: "",
      password: "",
      confirm_password: "",
      phone: "",
      address: "",
      category: "",
    });
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();

    setError("");

    if (!formData.password) {
      alert("Please enter a password.");
      return;
    }

    if (formData.password !== formData.confirm_password) {
      alert("Password and Confirm Password do not match.");
      return;
    }

    if (!formData.email) {
      alert("Email is required because the supplier will use it to login.");
      return;
    }

    try {
      const token = getToken();

      if (!token) {
        throw new Error(
          "Authentication token not found. Please login again."
        );
      }

      const supplierData = {
        company_name: formData.company_name,
        contact_person: formData.contact_person,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        address: formData.address,
        category: formData.category,
      };

      const response = await fetch(`${API_URL}/suppliers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(supplierData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Failed to create supplier")
        );
      }

      alert(
        "Supplier account created successfully!\n\nThe supplier can now login using the registered email and password."
      );

      setShowAddSupplier(false);
      resetForm();

      await fetchSuppliers();
    } catch (err) {
      console.error("Create supplier error:", err);
      alert(err.message || "Failed to create supplier");
    }
  };

  const handleUpdateSupplier = async (e) => {
    e.preventDefault();

    if (!editingSupplier) {
      return;
    }

    try {
      setError("");

      const token = getToken();

      if (!token) {
        throw new Error(
          "Authentication token not found. Please login again."
        );
      }

      const updateData = {
        company_name: formData.company_name,
        contact_person: formData.contact_person,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        category: formData.category,
      };

      const response = await fetch(
        `${API_URL}/suppliers/${editingSupplier.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updateData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Failed to update supplier")
        );
      }

      alert("Supplier updated successfully!");

      setEditingSupplier(null);
      resetForm();

      await fetchSuppliers();
    } catch (err) {
      console.error("Update supplier error:", err);
      alert(err.message || "Failed to update supplier");
    }
  };

  const handleToggleStatus = async (supplier) => {
    try {
      const token = getToken();

      if (!token) {
        throw new Error(
          "Authentication token not found. Please login again."
        );
      }

      const endpoint =
        supplier.supplier_status === "active"
          ? `${API_URL}/suppliers/${supplier.id}/deactivate`
          : `${API_URL}/suppliers/${supplier.id}/activate`;

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Failed to change supplier status"
          )
        );
      }

      await fetchSuppliers();
    } catch (err) {
      console.error("Status change error:", err);
      alert(err.message || "Failed to change supplier status");
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${supplier.company_name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const token = getToken();

      if (!token) {
        throw new Error(
          "Authentication token not found. Please login again."
        );
      }

      const response = await fetch(
        `${API_URL}/suppliers/${supplier.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Failed to delete supplier")
        );
      }

      alert("Supplier deleted successfully!");

      setSelectedSupplier(null);

      await fetchSuppliers();
    } catch (err) {
      console.error("Delete supplier error:", err);
      alert(err.message || "Failed to delete supplier");
    }
  };

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);

    setFormData({
      company_name: supplier.company_name || "",
      contact_person: supplier.contact_person || "",
      email: supplier.email || "",
      password: "",
      confirm_password: "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      category: supplier.category || "",
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowAddSupplier(true);
  };

  const activeSuppliers = suppliers.filter(
    (supplier) => supplier.supplier_status === "active"
  ).length;

  const inactiveSuppliers = suppliers.filter(
    (supplier) => supplier.supplier_status !== "active"
  ).length;

  const pendingSuppliers = suppliers.filter(
    (supplier) => supplier.approval_status === "pending"
  ).length;

  return (
    <DashboardLayout
      title="Supplier Management"
      role="Administrator"
      menuItems={[
        "Dashboard",
        "Users",
        "Vendors",
        "Suppliers",
        "Procurement",
        "Purchase Orders",
        "Risk Analysis",
        "Reports",
        "Settings",
        "Notifications",
      ]}
    >
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0 }}>
            Supplier Management
          </h2>

          <p style={{ color: "#666" }}>
            Manage suppliers, accounts and supplier information.
          </p>
        </div>

        <button
          style={addButton}
          onClick={openAddModal}
        >
          + Add Supplier
        </button>
      </div>

      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}

      <div style={gridStyle}>
        <StatCard
          title="Total Suppliers"
          value={suppliers.length}
        />

        <StatCard
          title="Active Suppliers"
          value={activeSuppliers}
        />

        <StatCard
          title="Pending Approval"
          value={pendingSuppliers}
        />

        <StatCard
          title="Inactive Suppliers"
          value={inactiveSuppliers}
        />
      </div>

      <div style={boxStyle}>
        <div style={tableHeaderStyle}>
          <div>
            <h3 style={{ marginBottom: "5px" }}>
              Registered Suppliers
            </h3>

            <p style={descriptionStyle}>
              All suppliers registered in the VRIPRM system.
            </p>
          </div>

          <button
            style={refreshButton}
            onClick={fetchSuppliers}
          >
            ↻ Refresh
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <div style={messageStyle}>
              Loading suppliers...
            </div>
          ) : suppliers.length === 0 ? (
            <div style={messageStyle}>
              No suppliers found.
            </div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Supplier</th>
                  <th style={thStyle}>Contact Person</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Supply Category</th>
                  <th style={thStyle}>Approval</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>

              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td style={tdStyle}>
                      <strong>
                        {supplier.company_name}
                      </strong>
                    </td>

                    <td style={tdStyle}>
                      {supplier.contact_person || "-"}
                    </td>

                    <td style={tdStyle}>
                      {supplier.email || "-"}
                    </td>

                    <td style={tdStyle}>
                      {supplier.category || "-"}
                    </td>

                    <td style={tdStyle}>
                      <ApprovalStatus
                        status={supplier.approval_status}
                      />
                    </td>

                    <td style={tdStyle}>
                      <Status
                        status={supplier.supplier_status}
                      />
                    </td>

                    <td style={tdStyle}>
                      <button
                        style={viewButton}
                        onClick={() =>
                          setSelectedSupplier(supplier)
                        }
                      >
                        View
                      </button>

                      <button
                        style={editButton}
                        onClick={() =>
                          openEditModal(supplier)
                        }
                      >
                        Edit
                      </button>

                      <button
                        style={statusButton}
                        onClick={() =>
                          handleToggleStatus(supplier)
                        }
                      >
                        {supplier.supplier_status === "active"
                          ? "Deactivate"
                          : "Activate"}
                      </button>

                      <button
                        style={deleteButton}
                        onClick={() =>
                          handleDeleteSupplier(supplier)
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAddSupplier && (
        <SupplierFormModal
          title="Add New Supplier"
          description="Create a supplier account. The supplier can login immediately after creation."
          formData={formData}
          handleInputChange={handleInputChange}
          handleSubmit={handleAddSupplier}
          closeModal={() => {
            setShowAddSupplier(false);
            resetForm();
          }}
          submitText="Create Supplier"
          isEdit={false}
        />
      )}

      {editingSupplier && (
        <SupplierFormModal
          title="Edit Supplier"
          description="Update supplier information."
          formData={formData}
          handleInputChange={handleInputChange}
          handleSubmit={handleUpdateSupplier}
          closeModal={() => {
            setEditingSupplier(null);
            resetForm();
          }}
          submitText="Save Changes"
          isEdit={true}
        />
      )}

      {selectedSupplier && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2>Supplier Details</h2>

                <p style={descriptionStyle}>
                  Supplier information from the database.
                </p>
              </div>

              <button
                style={closeButton}
                onClick={() =>
                  setSelectedSupplier(null)
                }
              >
                ×
              </button>
            </div>

            <div style={detailsStyle}>
              <Detail label="Company Name">
                {selectedSupplier.company_name}
              </Detail>

              <Detail label="Contact Person">
                {selectedSupplier.contact_person || "-"}
              </Detail>

              <Detail label="Email">
                {selectedSupplier.email || "-"}
              </Detail>

              <Detail label="Supply Category">
                {selectedSupplier.category || "-"}
              </Detail>

              <Detail label="Phone">
                {selectedSupplier.phone || "-"}
              </Detail>

              <Detail label="Address">
                {selectedSupplier.address || "-"}
              </Detail>

              <Detail label="Approval Status">
                <ApprovalStatus
                  status={selectedSupplier.approval_status}
                />
              </Detail>

              <Detail label="Account Status">
                <Status
                  status={selectedSupplier.supplier_status}
                />
              </Detail>

              <Detail label="Supplier ID">
                #{selectedSupplier.id}
              </Detail>

              <Detail label="User ID">
                {selectedSupplier.user_id
                  ? `#${selectedSupplier.user_id}`
                  : "Not linked"}
              </Detail>
            </div>

            <div style={modalActionsStyle}>
              <button
                style={cancelButton}
                onClick={() =>
                  setSelectedSupplier(null)
                }
              >
                Close
              </button>

              <button
                style={deleteButtonLarge}
                onClick={() =>
                  handleDeleteSupplier(selectedSupplier)
                }
              >
                Delete Supplier
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function SupplierFormModal({
  title,
  description,
  formData,
  handleInputChange,
  handleSubmit,
  closeModal,
  submitText,
  isEdit,
}) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h2>{title}</h2>

            <p style={descriptionStyle}>
              {description}
            </p>
          </div>

          <button
            style={closeButton}
            onClick={closeModal}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            Company Name
          </label>

          <input
            style={inputStyle}
            type="text"
            name="company_name"
            value={formData.company_name}
            onChange={handleInputChange}
            placeholder="Enter company name"
            required
          />

          <label style={labelStyle}>
            Contact Person
          </label>

          <input
            style={inputStyle}
            type="text"
            name="contact_person"
            value={formData.contact_person}
            onChange={handleInputChange}
            placeholder="Enter contact person"
          />

          <label style={labelStyle}>
            Email
          </label>

          <input
            style={inputStyle}
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter login email"
            required
          />

          {!isEdit && (
            <>
              <label style={labelStyle}>
                Password
              </label>

              <input
                style={inputStyle}
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Create supplier password"
                minLength={6}
                required
              />

              <label style={labelStyle}>
                Confirm Password
              </label>

              <input
                style={inputStyle}
                type="password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleInputChange}
                placeholder="Confirm supplier password"
                minLength={6}
                required
              />
            </>
          )}

          <label style={labelStyle}>
            Supply Category
          </label>

          <select
            style={inputStyle}
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            required
          >
            <option value="">
              Select supply category
            </option>

            <option value="Raw Materials">
              Raw Materials
            </option>

            <option value="Electronic Components">
              Electronic Components
            </option>

            <option value="IT Equipment">
              IT Equipment
            </option>

            <option value="Office Supplies">
              Office Supplies
            </option>

            <option value="Packaging Materials">
              Packaging Materials
            </option>

            <option value="Machinery & Equipment">
              Machinery & Equipment
            </option>

            <option value="Safety Equipment">
              Safety Equipment
            </option>

            <option value="Other">
              Other
            </option>
          </select>

          <label style={labelStyle}>
            Phone
          </label>

          <input
            style={inputStyle}
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="Enter phone number"
          />

          <label style={labelStyle}>
            Address
          </label>

          <textarea
            style={{
              ...inputStyle,
              minHeight: "80px",
              resize: "vertical",
            }}
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="Enter address"
          />

          <div style={modalActionsStyle}>
            <button
              type="button"
              style={cancelButton}
              onClick={closeModal}
            >
              Cancel
            </button>

            <button
              type="submit"
              style={saveButton}
            >
              {submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <span style={detailLabelStyle}>
        {label}
      </span>

      <strong>{children}</strong>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={cardStyle}>
      <p style={{ color: "#777", margin: 0 }}>
        {title}
      </p>

      <h2 style={{ marginBottom: 0 }}>
        {value}
      </h2>
    </div>
  );
}

function Status({ status }) {
  const isActive = status === "active";
  const isSuspended = status === "suspended";

  return (
    <span
      style={{
        padding: "6px 12px",
        borderRadius: "20px",
        background: isActive
          ? "#e8f7ee"
          : isSuspended
          ? "#ffebee"
          : "#fff4d6",
        color: isActive
          ? "#16803c"
          : isSuspended
          ? "#c62828"
          : "#a66b00",
        fontSize: "13px",
        fontWeight: "600",
      }}
    >
      {status
        ? status.charAt(0).toUpperCase() +
          status.slice(1)
        : "Unknown"}
    </span>
  );
}

function ApprovalStatus({ status }) {
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  return (
    <span
      style={{
        padding: "6px 12px",
        borderRadius: "20px",
        background: isApproved
          ? "#e8f7ee"
          : isRejected
          ? "#ffebee"
          : "#fff4d6",
        color: isApproved
          ? "#16803c"
          : isRejected
          ? "#c62828"
          : "#a66b00",
        fontSize: "13px",
        fontWeight: "600",
      }}
    >
      {status
        ? status.charAt(0).toUpperCase() +
          status.slice(1)
        : "Pending"}
    </span>
  );
}

const headerStyle = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "22px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.06)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const addButton = {
  background: "#17152f",
  color: "#fff",
  border: "none",
  padding: "12px 20px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "18px",
  marginBottom: "22px",
};

const cardStyle = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.06)",
};

const boxStyle = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.06)",
};

const tableHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const descriptionStyle = {
  color: "#777",
  fontSize: "14px",
};

const refreshButton = {
  border: "1px solid #ddd",
  background: "#fff",
  padding: "8px 14px",
  borderRadius: "7px",
  cursor: "pointer",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "18px",
};

const thStyle = {
  textAlign: "left",
  padding: "14px",
  background: "#f5f7fb",
  borderBottom: "1px solid #ddd",
};

const tdStyle = {
  padding: "15px 14px",
  borderBottom: "1px solid #eee",
};

const viewButton = {
  border: "none",
  background: "#eef1f7",
  padding: "7px 12px",
  borderRadius: "7px",
  cursor: "pointer",
  marginRight: "5px",
};

const editButton = {
  border: "none",
  background: "#f0eefb",
  padding: "7px 12px",
  borderRadius: "7px",
  cursor: "pointer",
  marginRight: "5px",
};

const statusButton = {
  border: "none",
  background: "#f7f7f7",
  padding: "7px 12px",
  borderRadius: "7px",
  cursor: "pointer",
  marginRight: "5px",
};

const deleteButton = {
  border: "none",
  background: "#fff0f0",
  color: "#c62828",
  padding: "7px 12px",
  borderRadius: "7px",
  cursor: "pointer",
};

const errorStyle = {
  background: "#ffebee",
  color: "#c62828",
  padding: "12px 16px",
  borderRadius: "8px",
  marginBottom: "20px",
  whiteSpace: "pre-line",
};

const messageStyle = {
  padding: "35px",
  textAlign: "center",
  color: "#777",
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalStyle = {
  width: "520px",
  maxWidth: "90%",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "white",
  borderRadius: "14px",
  padding: "28px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "22px",
};

const closeButton = {
  border: "none",
  background: "transparent",
  fontSize: "28px",
  cursor: "pointer",
  color: "#777",
};

const labelStyle = {
  display: "block",
  marginBottom: "7px",
  marginTop: "15px",
  fontWeight: "600",
  fontSize: "14px",
};

const inputStyle = {
  width: "100%",
  padding: "11px 12px",
  border: "1px solid #ddd",
  borderRadius: "7px",
  boxSizing: "border-box",
  fontSize: "14px",
};

const modalActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "25px",
};

const cancelButton = {
  padding: "10px 16px",
  border: "1px solid #ddd",
  borderRadius: "7px",
  background: "white",
  cursor: "pointer",
};

const saveButton = {
  padding: "10px 18px",
  border: "none",
  borderRadius: "7px",
  background: "#17152f",
  color: "white",
  cursor: "pointer",
  fontWeight: "600",
};

const deleteButtonLarge = {
  padding: "10px 18px",
  border: "none",
  borderRadius: "7px",
  background: "#c62828",
  color: "white",
  cursor: "pointer",
};

const detailsStyle = {
  display: "grid",
  gap: "18px",
};

const detailLabelStyle = {
  display: "block",
  color: "#777",
  fontSize: "13px",
  marginBottom: "5px",
};

export default AdminSuppliers;