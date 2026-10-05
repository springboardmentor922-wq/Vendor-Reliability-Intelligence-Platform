import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "vendor",
    is_active: true,
  });

  const getToken = () =>
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      const response = await fetch("http://127.0.0.1:8000/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load users");
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();

    try {
      const token = getToken();

      const response = await fetch("http://127.0.0.1:8000/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to create user");
      }

      alert("User created successfully!");

      setShowAddUser(false);

      setFormData({
        name: "",
        email: "",
        password: "",
        role: "vendor",
        is_active: true,
      });

      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const token = getToken();

      const endpoint = user.is_active
        ? `http://127.0.0.1:8000/users/${user.id}/deactivate`
        : `http://127.0.0.1:8000/users/${user.id}/activate`;

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to change user status");
      }

      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (user) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${user.name}?`
    );

    if (!confirmed) return;

    try {
      const token = getToken();

      const response = await fetch(
        `http://127.0.0.1:8000/users/${user.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to delete user");
      }

      alert("User deleted successfully!");

      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const activeUsers = users.filter((user) => user.is_active).length;
  const inactiveUsers = users.filter((user) => !user.is_active).length;

  const formatRole = (role) => {
    if (!role) return "-";

    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <DashboardLayout
      title="User Management"
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
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.heading}>User Management</h2>

          <p style={styles.description}>
            Manage system users, roles and account status.
          </p>
        </div>

        <button
          style={styles.addButton}
          onClick={() => setShowAddUser(true)}
        >
          + Add User
        </button>
      </div>

      {/* ERROR */}
      {error && <div style={styles.error}>{error}</div>}

      {/* STATS */}
      <div style={styles.stats}>
        <div style={styles.card}>
          <p style={styles.cardTitle}>Total Users</p>
          <h2>{users.length}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardTitle}>Active Users</p>
          <h2>{activeUsers}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.cardTitle}>Inactive Users</p>
          <h2>{inactiveUsers}</h2>
        </div>
      </div>

      {/* TABLE */}
      <div style={styles.tableBox}>
        <div style={styles.tableHeader}>
          <div>
            <h3 style={{ marginBottom: "5px" }}>System Users</h3>

            <p style={styles.tableDescription}>
              All registered users in the VRIPRM system.
            </p>
          </div>

          <button style={styles.refreshButton} onClick={fetchUsers}>
            ↻ Refresh
          </button>
        </div>

        <div style={styles.tableContainer}>
          {loading ? (
            <div style={styles.loading}>Loading users...</div>
          ) : users.length === 0 ? (
            <div style={styles.empty}>No users found.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={styles.td}>
                      <strong>{user.name}</strong>
                    </td>

                    <td style={styles.td}>{user.email}</td>

                    <td style={styles.td}>
                      <span style={styles.role}>
                        {formatRole(user.role)}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <span
                        style={
                          user.is_active
                            ? styles.activeStatus
                            : styles.inactiveStatus
                        }
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td style={styles.td}>
                      <button
                        style={styles.viewButton}
                        onClick={() => setSelectedUser(user)}
                      >
                        View
                      </button>

                      <button
                        style={styles.statusButton}
                        onClick={() => handleToggleStatus(user)}
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </button>

                      <button
                        style={styles.deleteButton}
                        onClick={() => handleDeleteUser(user)}
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

      {/* ADD USER MODAL */}
      {showAddUser && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2>Add New User</h2>
                <p style={styles.modalDescription}>
                  Create a new VRIPRM system account.
                </p>
              </div>

              <button
                style={styles.closeButton}
                onClick={() => setShowAddUser(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddUser}>
              <label style={styles.label}>Name</label>

              <input
                style={styles.input}
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter full name"
                required
              />

              <label style={styles.label}>Email</label>

              <input
                style={styles.input}
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter email"
                required
              />

              <label style={styles.label}>Password</label>

              <input
                style={styles.input}
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter password"
                required
              />

              <label style={styles.label}>Role</label>

              <select
                style={styles.input}
                name="role"
                value={formData.role}
                onChange={handleInputChange}
              >
                <option value="administrator">Administrator</option>
                <option value="procurement_manager">
                  Procurement Manager
                </option>
                <option value="supply_chain_manager">
                  Supply Chain Manager
                </option>
                <option value="vendor">Vendor</option>
                <option value="finance_officer">Finance Officer</option>
                <option value="auditor">Auditor</option>
              </select>

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                />

                Active account
              </label>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={() => setShowAddUser(false)}
                >
                  Cancel
                </button>

                <button type="submit" style={styles.saveButton}>
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW USER MODAL */}
      {selectedUser && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2>User Details</h2>

                <p style={styles.modalDescription}>
                  User account information.
                </p>
              </div>

              <button
                style={styles.closeButton}
                onClick={() => setSelectedUser(null)}
              >
                ×
              </button>
            </div>

            <div style={styles.details}>
              <div>
                <span style={styles.detailLabel}>Name</span>
                <strong>{selectedUser.name}</strong>
              </div>

              <div>
                <span style={styles.detailLabel}>Email</span>
                <strong>{selectedUser.email}</strong>
              </div>

              <div>
                <span style={styles.detailLabel}>Role</span>
                <strong>{formatRole(selectedUser.role)}</strong>
              </div>

              <div>
                <span style={styles.detailLabel}>Status</span>

                <strong>
                  {selectedUser.is_active ? "Active" : "Inactive"}
                </strong>
              </div>

              <div>
                <span style={styles.detailLabel}>User ID</span>
                <strong>#{selectedUser.id}</strong>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.cancelButton}
                onClick={() => setSelectedUser(null)}
              >
                Close
              </button>

              <button
                style={styles.deleteButtonLarge}
                onClick={() => handleDeleteUser(selectedUser)}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

const styles = {
  header: {
    background: "white",
    padding: "25px",
    marginTop: "25px",
    borderRadius: "12px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  heading: {
    marginBottom: "8px",
  },

  description: {
    color: "#777",
    marginBottom: 0,
  },

  addButton: {
    padding: "11px 18px",
    border: "none",
    borderRadius: "8px",
    background: "#17152f",
    color: "white",
    cursor: "pointer",
    fontWeight: "600",
  },

  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "20px",
    marginTop: "20px",
  },

  card: {
    background: "white",
    padding: "22px",
    borderRadius: "12px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
    border: "1px solid #eee",
  },

  cardTitle: {
    color: "#777",
    marginBottom: "8px",
  },

  tableBox: {
    background: "white",
    padding: "25px",
    marginTop: "20px",
    borderRadius: "12px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
  },

  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  tableDescription: {
    color: "#777",
    fontSize: "14px",
  },

  refreshButton: {
    padding: "8px 14px",
    border: "1px solid #ddd",
    borderRadius: "7px",
    background: "white",
    cursor: "pointer",
  },

  tableContainer: {
    overflowX: "auto",
    marginTop: "15px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "15px",
    background: "#f5f7fb",
    borderBottom: "2px solid #e5e5e5",
  },

  td: {
    padding: "15px",
    borderBottom: "1px solid #eee",
  },

  role: {
    background: "#f0eefb",
    padding: "6px 10px",
    borderRadius: "15px",
    fontSize: "12px",
  },

  activeStatus: {
    background: "#e8f5e9",
    color: "#2e7d32",
    padding: "6px 12px",
    borderRadius: "15px",
    fontSize: "12px",
    fontWeight: "600",
  },

  inactiveStatus: {
    background: "#ffebee",
    color: "#c62828",
    padding: "6px 12px",
    borderRadius: "15px",
    fontSize: "12px",
    fontWeight: "600",
  },

  viewButton: {
    padding: "7px 12px",
    marginRight: "6px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    background: "white",
    cursor: "pointer",
  },

  statusButton: {
    padding: "7px 12px",
    marginRight: "6px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    background: "#f7f7f7",
    cursor: "pointer",
  },

  deleteButton: {
    padding: "7px 12px",
    border: "none",
    borderRadius: "6px",
    background: "#fff0f0",
    color: "#c62828",
    cursor: "pointer",
  },

  error: {
    marginTop: "20px",
    padding: "12px 16px",
    background: "#ffebee",
    color: "#c62828",
    borderRadius: "8px",
  },

  loading: {
    padding: "30px",
    textAlign: "center",
    color: "#777",
  },

  empty: {
    padding: "30px",
    textAlign: "center",
    color: "#777",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },

  modal: {
    width: "500px",
    maxWidth: "90%",
    background: "white",
    borderRadius: "14px",
    padding: "28px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "22px",
  },

  modalDescription: {
    color: "#777",
    fontSize: "14px",
  },

  closeButton: {
    border: "none",
    background: "transparent",
    fontSize: "28px",
    cursor: "pointer",
    color: "#777",
  },

  label: {
    display: "block",
    marginBottom: "7px",
    marginTop: "15px",
    fontWeight: "600",
    fontSize: "14px",
  },

  input: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #ddd",
    borderRadius: "7px",
    boxSizing: "border-box",
    fontSize: "14px",
  },

  checkboxLabel: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginTop: "18px",
    fontSize: "14px",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "25px",
  },

  cancelButton: {
    padding: "10px 16px",
    border: "1px solid #ddd",
    borderRadius: "7px",
    background: "white",
    cursor: "pointer",
  },

  saveButton: {
    padding: "10px 18px",
    border: "none",
    borderRadius: "7px",
    background: "#17152f",
    color: "white",
    cursor: "pointer",
    fontWeight: "600",
  },

  deleteButtonLarge: {
    padding: "10px 18px",
    border: "none",
    borderRadius: "7px",
    background: "#c62828",
    color: "white",
    cursor: "pointer",
  },

  details: {
    display: "grid",
    gap: "18px",
  },

  detailLabel: {
    display: "block",
    color: "#777",
    fontSize: "13px",
    marginBottom: "5px",
  },
};

export default AdminUsers;