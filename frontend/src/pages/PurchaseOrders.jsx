import React, { useEffect, useState } from "react";


const API_URL = "http://127.0.0.1:8000";


function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}


function getLoggedInRole() {
  const possibleUsers = [
    localStorage.getItem("user"),
    localStorage.getItem("currentUser"),
    sessionStorage.getItem("user"),
    sessionStorage.getItem("currentUser"),
  ];

  for (const value of possibleUsers) {
    if (!value) continue;

    try {
      const parsed = JSON.parse(value);

      if (parsed?.role) {
        return parsed.role;
      }

      if (parsed?.user?.role) {
        return parsed.user.role;
      }
    } catch {
      // Ignore invalid values
    }
  }

  return (
    localStorage.getItem("role") ||
    sessionStorage.getItem("role") ||
    ""
  );
}


function PurchaseOrders() {
  const [orders, setOrders] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [role, setRole] = useState("");


  const isAdmin =
    role === "administrator";

  const isProcurementManager =
    role === "procurement_manager";


  // =========================================================
  // LOAD ROLE
  // =========================================================

  useEffect(() => {
    setRole(getLoggedInRole());
  }, []);


  // =========================================================
  // LOAD PURCHASE ORDERS
  // =========================================================

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      const response = await fetch(
        `${API_URL}/procurement-requests/purchase-orders/list`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },
        }
      );


      if (!response.ok) {
        let message =
          "Failed to load Purchase Orders.";

        try {
          const data =
            await response.json();

          message =
            data.detail || message;
        } catch {
          // Ignore JSON parsing error
        }

        throw new Error(message);
      }


      const data =
        await response.json();

      setOrders(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (err) {
      console.error(
        "Purchase Order loading error:",
        err
      );

      setError(
        err.message ||
          "Failed to load Purchase Orders."
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadPurchaseOrders();
  }, []);


  // =========================================================
  // GENERIC PO ACTION
  // =========================================================

  const updateOrder = async (
    id,
    action,
    successMessage
  ) => {
    try {
      setError("");
      setSuccess("");

      const token = getToken();

      const response = await fetch(
        `${API_URL}/procurement-requests/purchase-orders/${id}/${action}`,
        {
          method: "PUT",
          headers: {
            Authorization:
              `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },
        }
      );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Purchase Order action failed."
        );
      }


      setSuccess(
        data.message ||
          successMessage
      );

      await loadPurchaseOrders();

    } catch (err) {
      console.error(
        "Purchase Order action error:",
        err
      );

      setError(
        err.message ||
          "Purchase Order action failed."
      );
    }
  };


  // =========================================================
  // APPROVE PO
  // ADMIN ONLY
  // =========================================================

  const handleApprove = async (order) => {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `Approve Purchase Order ${order.order_number}?`
    );

    if (!confirmed) return;

    await updateOrder(
      order.id,
      "approve",
      "Purchase Order approved successfully."
    );
  };


  // =========================================================
  // REJECT PO
  // ADMIN ONLY
  // =========================================================

  const handleReject = async (order) => {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `Reject Purchase Order ${order.order_number}?`
    );

    if (!confirmed) return;

    await updateOrder(
      order.id,
      "reject",
      "Purchase Order rejected successfully."
    );
  };


  // =========================================================
  // CHANGE PO STATUS
  // PROCUREMENT MANAGER
  // =========================================================

  const handleStatusChange = async (
    order,
    newStatus
  ) => {
    if (!isProcurementManager) return;

    let message = "";

    if (newStatus === "shipped") {
      message =
        `Mark ${order.order_number} as shipped?`;
    }

    if (newStatus === "delivered") {
      message =
        `Mark ${order.order_number} as delivered?`;
    }

    if (newStatus === "cancelled") {
      message =
        `Cancel ${order.order_number}?`;
    }

    const confirmed =
      window.confirm(message);

    if (!confirmed) return;


    await updateOrder(
      order.id,
      `status/${newStatus}`,
      `Purchase Order marked as ${newStatus}.`
    );
  };


  // =========================================================
  // FILTER
  // =========================================================

  const filteredOrders =
    orders.filter((order) => {
      const searchText =
        search.toLowerCase().trim();

      const matchesSearch =
        order.order_number
          ?.toLowerCase()
          .includes(searchText) ||

        order.vendor_name
          ?.toLowerCase()
          .includes(searchText) ||

        String(
          order.vendor_id || ""
        ).includes(searchText);

      const matchesStatus =
        statusFilter === "all" ||
        order.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });


  // =========================================================
  // STATISTICS
  // =========================================================

  const totalOrders =
    orders.length;

  const pendingOrders =
    orders.filter(
      (order) =>
        order.status === "pending"
    ).length;

  const approvedOrders =
    orders.filter(
      (order) =>
        order.status === "approved"
    ).length;

  const deliveredOrders =
    orders.filter(
      (order) =>
        order.status === "delivered"
    ).length;


  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div>

      {/* HEADER */}

      <div style={styles.header}>

        <div>

          <div style={styles.eyebrow}>
            PROCUREMENT
          </div>

          <h2 style={styles.title}>
            Purchase Orders
          </h2>

          <p style={styles.subtitle}>
            Manage approved procurement requests,
            purchase order approvals and order
            fulfillment.
          </p>

        </div>

      </div>


      {/* ROLE INFO */}

      <div style={styles.roleInfo}>

        Logged in role:{" "}

        <strong>
          {role || "Unknown"}
        </strong>


        {isAdmin && (
          <span>
            {" "}— You can approve or reject
            pending Purchase Orders.
          </span>
        )}


        {isProcurementManager && (
          <span>
            {" "}— You can update approved
            Purchase Orders through fulfillment.
          </span>
        )}

      </div>


      {/* MESSAGES */}

      {error && (
        <div style={styles.errorMessage}>
          ⚠️ {error}
        </div>
      )}


      {success && (
        <div style={styles.successMessage}>
          ✓ {success}
        </div>
      )}


      {/* STATISTICS */}

      <div style={styles.statsGrid}>

        <StatCard
          title="Total POs"
          value={totalOrders}
          icon="📦"
        />

        <StatCard
          title="Pending Approval"
          value={pendingOrders}
          icon="⏳"
        />

        <StatCard
          title="Approved"
          value={approvedOrders}
          icon="✅"
        />

        <StatCard
          title="Delivered"
          value={deliveredOrders}
          icon="🚚"
        />

      </div>


      {/* FILTERS */}

      <div style={styles.filterBox}>

        <input
          type="text"
          placeholder="Search PO number or vendor..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          style={styles.searchInput}
        />


        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value
            )
          }
          style={styles.select}
        >

          <option value="all">
            All Status
          </option>

          <option value="pending">
            Pending
          </option>

          <option value="approved">
            Approved
          </option>

          <option value="shipped">
            Shipped
          </option>

          <option value="delivered">
            Delivered
          </option>

          <option value="cancelled">
            Cancelled
          </option>

        </select>


        <button
          style={styles.refreshButton}
          onClick={
            loadPurchaseOrders
          }
        >
          🔄 Refresh
        </button>

      </div>


      {/* TABLE */}

      <div style={styles.tableBox}>

        <div style={styles.tableHeader}>

          <h3 style={{ margin: 0 }}>
            Purchase Order List
          </h3>

          <span style={styles.countText}>
            {filteredOrders.length} orders
          </span>

        </div>


        {loading ? (

          <div style={styles.loading}>
            Loading Purchase Orders...
          </div>

        ) : filteredOrders.length === 0 ? (

          <div style={styles.empty}>

            <div style={styles.emptyIcon}>
              📦
            </div>

            <h3>
              No Purchase Orders
            </h3>

            <p>
              Purchase Orders will appear here
              after an approved procurement request
              is converted into a PO.
            </p>

          </div>

        ) : (

          <div
            style={{
              overflowX: "auto",
            }}
          >

            <table style={styles.table}>

              <thead>

                <tr>

                  <th style={styles.th}>
                    PO Number
                  </th>

                  <th style={styles.th}>
                    Vendor
                  </th>

                  <th style={styles.th}>
                    Order Date
                  </th>

                  <th style={styles.th}>
                    Expected Delivery
                  </th>

                  <th style={styles.th}>
                    Amount
                  </th>

                  <th style={styles.th}>
                    Status
                  </th>

                  <th style={styles.th}>
                    Actions
                  </th>

                </tr>

              </thead>


              <tbody>

                {filteredOrders.map(
                  (order) => (

                    <tr key={order.id}>

                      <td style={styles.td}>

                        <strong>
                          {order.order_number}
                        </strong>

                      </td>


                      <td style={styles.td}>

                        <div>
                          {order.vendor_name}
                        </div>

                        <small
                          style={
                            styles.smallText
                          }
                        >
                          Vendor ID:{" "}
                          {order.vendor_id}
                        </small>

                      </td>


                      <td style={styles.td}>
                        {order.order_date ||
                          "—"}
                      </td>


                      <td style={styles.td}>
                        {order.expected_delivery_date ||
                          "Not Set"}
                      </td>


                      <td style={styles.td}>

                        ₹
                        {Number(
                          order.total_amount ||
                            0
                        ).toLocaleString(
                          "en-IN"
                        )}

                      </td>


                      <td style={styles.td}>

                        <StatusBadge
                          status={
                            order.status
                          }
                        />

                      </td>


                      <td style={styles.td}>

                        <div
                          style={
                            styles.actions
                          }
                        >

                          {/* ADMIN APPROVAL */}

                          {isAdmin &&
                            order.status ===
                              "pending" && (
                              <>

                                <button
                                  style={
                                    styles.approveButton
                                  }
                                  onClick={() =>
                                    handleApprove(
                                      order
                                    )
                                  }
                                >
                                  Approve
                                </button>


                                <button
                                  style={
                                    styles.rejectButton
                                  }
                                  onClick={() =>
                                    handleReject(
                                      order
                                    )
                                  }
                                >
                                  Reject
                                </button>

                              </>
                            )}


                          {/* PROCUREMENT MANAGER:
                              APPROVED → SHIPPED */}

                          {isProcurementManager &&
                            order.status ===
                              "approved" && (
                              <button
                                style={
                                  styles.shipButton
                                }
                                onClick={() =>
                                  handleStatusChange(
                                    order,
                                    "shipped"
                                  )
                                }
                              >
                                Mark Shipped
                              </button>
                            )}


                          {/* PROCUREMENT MANAGER:
                              SHIPPED → DELIVERED */}

                          {isProcurementManager &&
                            order.status ===
                              "shipped" && (
                              <button
                                style={
                                  styles.deliverButton
                                }
                                onClick={() =>
                                  handleStatusChange(
                                    order,
                                    "delivered"
                                  )
                                }
                              >
                                Mark Delivered
                              </button>
                            )}


                          {/* PROCUREMENT MANAGER:
                              CANCEL */}

                          {isProcurementManager &&
                            [
                              "pending",
                              "approved",
                              "shipped",
                            ].includes(
                              order.status
                            ) && (
                              <button
                                style={
                                  styles.cancelOrderButton
                                }
                                onClick={() =>
                                  handleStatusChange(
                                    order,
                                    "cancelled"
                                  )
                                }
                              >
                                Cancel
                              </button>
                            )}


                          {/* DELIVERED */}

                          {order.status ===
                            "delivered" && (
                            <span
                              style={
                                styles.completedText
                              }
                            >
                              ✓ Order Completed
                            </span>
                          )}


                          {/* CANCELLED */}

                          {order.status ===
                            "cancelled" && (
                            <span
                              style={
                                styles.cancelledText
                              }
                            >
                              Order Cancelled
                            </span>
                          )}

                        </div>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>
  );
}


// =========================================================
// STAT CARD
// =========================================================

function StatCard({
  title,
  value,
  icon,
}) {
  return (
    <div style={styles.statCard}>

      <div style={styles.statIcon}>
        {icon}
      </div>

      <div>

        <p style={styles.statTitle}>
          {title}
        </p>

        <h2 style={styles.statValue}>
          {value}
        </h2>

      </div>

    </div>
  );
}


// =========================================================
// STATUS BADGE
// =========================================================

function StatusBadge({ status }) {
  const statusStyles = {

    pending: {
      background: "#fff4d6",
      color: "#a66b00",
    },

    approved: {
      background: "#e8f7ee",
      color: "#16803c",
    },

    shipped: {
      background: "#e8f0ff",
      color: "#2563eb",
    },

    delivered: {
      background: "#dcfce7",
      color: "#15803d",
    },

    cancelled: {
      background: "#feecec",
      color: "#c62828",
    },

  };


  const current =
    statusStyles[status] || {
      background: "#f1f5f9",
      color: "#475569",
    };


  return (
    <span
      style={{
        ...styles.statusBadge,
        background:
          current.background,
        color: current.color,
      }}
    >
      {status
        ? status.charAt(0).toUpperCase() +
          status.slice(1)
        : "Unknown"}
    </span>
  );
}


// =========================================================
// STYLES
// =========================================================

const styles = {

  header: {
    background: "#fff",
    padding: "24px",
    borderRadius: "14px",
    marginBottom: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow:
      "0 3px 12px rgba(0,0,0,.04)",
  },

  eyebrow: {
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.5px",
    color: "#777",
    marginBottom: "5px",
  },

  title: {
    margin: 0,
    color: "#111827",
  },

  subtitle: {
    margin: "7px 0 0",
    color: "#6b7280",
    fontSize: "14px",
  },

  roleInfo: {
    background: "#eef4ff",
    border: "1px solid #dbe7ff",
    color: "#334155",
    padding: "12px 16px",
    borderRadius: "9px",
    marginBottom: "18px",
    fontSize: "13px",
  },

  errorMessage: {
    background: "#feecec",
    color: "#b91c1c",
    padding: "13px 16px",
    borderRadius: "9px",
    marginBottom: "18px",
    border: "1px solid #fecaca",
  },

  successMessage: {
    background: "#e8f7ee",
    color: "#16803c",
    padding: "13px 16px",
    borderRadius: "9px",
    marginBottom: "18px",
    border: "1px solid #bbf7d0",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "18px",
    marginBottom: "22px",
  },

  statCard: {
    background: "#fff",
    padding: "20px",
    borderRadius: "14px",
    boxShadow:
      "0 3px 12px rgba(0,0,0,.06)",
    display: "flex",
    alignItems: "center",
    gap: "15px",
  },

  statIcon: {
    width: "45px",
    height: "45px",
    borderRadius: "11px",
    background: "#eef4ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
  },

  statTitle: {
    margin: 0,
    color: "#777",
    fontSize: "13px",
  },

  statValue: {
    margin: "4px 0 0",
    color: "#111827",
  },

  filterBox: {
    background: "#fff",
    padding: "18px",
    borderRadius: "14px",
    marginBottom: "22px",
    display: "flex",
    gap: "12px",
    alignItems: "center",
    boxShadow:
      "0 3px 12px rgba(0,0,0,.05)",
  },

  searchInput: {
    flex: 1,
    minWidth: "220px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "11px 13px",
    outline: "none",
    fontSize: "14px",
  },

  select: {
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "11px 13px",
    background: "#fff",
    fontSize: "14px",
    cursor: "pointer",
  },

  refreshButton: {
    border: "1px solid #d1d5db",
    background: "#fff",
    padding: "10px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },

  tableBox: {
    background: "#fff",
    padding: "24px",
    borderRadius: "14px",
    boxShadow:
      "0 3px 12px rgba(0,0,0,.06)",
  },

  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "5px",
  },

  countText: {
    color: "#6b7280",
    fontSize: "13px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "18px",
    minWidth: "1100px",
  },

  th: {
    textAlign: "left",
    padding: "14px",
    background: "#f5f7fb",
    color: "#374151",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "15px 14px",
    borderBottom: "1px solid #eee",
    color: "#374151",
    fontSize: "14px",
    verticalAlign: "middle",
  },

  smallText: {
    color: "#9ca3af",
    fontSize: "11px",
  },

  statusBadge: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
  },

  actions: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },

  approveButton: {
    border: "none",
    background: "#e8f7ee",
    color: "#16803c",
    padding: "7px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },

  rejectButton: {
    border: "none",
    background: "#feecec",
    color: "#c62828",
    padding: "7px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },

  shipButton: {
    border: "none",
    background: "#e8f0ff",
    color: "#2563eb",
    padding: "7px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },

  deliverButton: {
    border: "none",
    background: "#dcfce7",
    color: "#15803d",
    padding: "7px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },

  cancelOrderButton: {
    border: "none",
    background: "#fff1f2",
    color: "#be123c",
    padding: "7px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },

  completedText: {
    color: "#16803c",
    fontWeight: "600",
    fontSize: "12px",
  },

  cancelledText: {
    color: "#c62828",
    fontWeight: "600",
    fontSize: "12px",
  },

  loading: {
    padding: "50px",
    textAlign: "center",
    color: "#6b7280",
  },

  empty: {
    padding: "60px 20px",
    textAlign: "center",
    color: "#6b7280",
  },

  emptyIcon: {
    fontSize: "40px",
    marginBottom: "10px",
  },

};


export default PurchaseOrders;