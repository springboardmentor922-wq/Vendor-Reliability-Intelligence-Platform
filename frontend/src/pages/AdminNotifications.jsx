import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

async function apiGet(endpoint) {
  const token = getToken();

  if (!token) {
    throw new Error("Please login again.");
  }

  const response = await fetch(API_URL + endpoint, {
    method: "GET",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(function () {
    return null;
  });

  if (!response.ok) {
    throw new Error(
      (data && data.detail) || "Failed to load data."
    );
  }

  return data;
}

async function apiAction(endpoint, method) {
  const token = getToken();

  if (!token) {
    throw new Error("Please login again.");
  }

  const response = await fetch(API_URL + endpoint, {
    method: method,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(function () {
    return null;
  });

  if (!response.ok) {
    throw new Error(
      (data && data.detail) || "Request failed."
    );
  }

  return data;
}

function normalizeNotification(notification) {
  return {
    ...notification,
    notification_type:
      notification.notification_type ||
      notification.type ||
      "general",
  };
}

function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      const results = await Promise.all([
        apiGet("/notifications"),
        apiGet("/procurement-requests"),
      ]);

      const databaseNotifications = Array.isArray(results[0])
        ? results[0].map(normalizeNotification)
        : [];

      const requests = Array.isArray(results[1])
        ? results[1]
        : [];

      const activityNotifications = [];

      requests.forEach(function (request) {
        const requestNumber =
          request.request_number ||
          "Procurement Request #" + request.id;

        if (request.status === "pending") {
          activityNotifications.push({
            id: "admin-request-pending-" + request.id,
            title: "Procurement Request Pending",
            message:
              requestNumber +
              " is waiting for administrator approval.",
            notification_type: "warning",
            created_at: request.created_at,
            is_read: false,
            activity: true,
          });
        }

        if (request.status === "approved") {
          activityNotifications.push({
            id: "admin-request-approved-" + request.id,
            title: "Procurement Request Approved",
            message:
              requestNumber +
              " has been approved successfully.",
            notification_type: "success",
            created_at: request.created_at,
            is_read: false,
            activity: true,
          });
        }

        if (request.status === "rejected") {
          activityNotifications.push({
            id: "admin-request-rejected-" + request.id,
            title: "Procurement Request Rejected",
            message:
              requestNumber +
              " was rejected by the administrator.",
            notification_type: "error",
            created_at: request.created_at,
            is_read: false,
            activity: true,
          });
        }
      });

      const combined = databaseNotifications.concat(
        activityNotifications
      );

      combined.sort(function (a, b) {
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
      });

      setNotifications(combined);
    } catch (err) {
      setError(
        err.message || "Unable to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id) {
    if (String(id).indexOf("-") !== -1) {
      return;
    }

    try {
      await apiAction(
        "/notifications/" + id + "/read",
        "PUT"
      );

      setNotifications(function (items) {
        return items.map(function (item) {
          return item.id === id
            ? { ...item, is_read: true }
            : item;
        });
      });
    } catch (err) {
      setError(
        err.message ||
          "Unable to mark notification as read."
      );
    }
  }

  async function markAllAsRead() {
    try {
      await apiAction(
        "/notifications/read-all",
        "PUT"
      );

      setNotifications(function (items) {
        return items.map(function (item) {
          return {
            ...item,
            is_read: true,
          };
        });
      });
    } catch (err) {
      setError(
        err.message ||
          "Unable to mark notifications as read."
      );
    }
  }

  async function deleteNotification(id) {
    if (String(id).indexOf("-") !== -1) {
      setNotifications(function (items) {
        return items.filter(function (item) {
          return item.id !== id;
        });
      });

      return;
    }

    try {
      await apiAction(
        "/notifications/" + id,
        "DELETE"
      );

      setNotifications(function (items) {
        return items.filter(function (item) {
          return item.id !== id;
        });
      });
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete notification."
      );
    }
  }

  useEffect(function () {
    loadNotifications();
  }, []);

  const unreadCount = notifications.filter(function (item) {
    return !item.is_read;
  }).length;

  function formatDate(value) {
    if (!value) {
      return "Recent";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Recent";
    }

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getIcon(type) {
    if (
      type === "success" ||
      type === "approval"
    ) {
      return "✅";
    }

    if (
      type === "warning" ||
      type === "delay"
    ) {
      return "⚠️";
    }

    if (
      type === "error" ||
      type === "rejection"
    ) {
      return "❌";
    }

    if (
      type === "payment"
    ) {
      return "💰";
    }

    if (
      type === "invoice"
    ) {
      return "🧾";
    }

    if (
      type === "contract" ||
      type === "compliance"
    ) {
      return "📄";
    }

    return "ℹ️";
  }

  return (
    <DashboardLayout
      title="Notifications"
      role="Administrator"
      menuItems={[
        "Dashboard",
        "Users",
        "Vendors",
        "Suppliers",
        "Procurement Requests",
        "Purchase Orders",
        "Risk Analysis",
        "Reports",
        "Settings",
        "Notifications",
      ]}
    >
      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.heading}>
              Notifications
            </h2>

            <p style={styles.subHeading}>
              Administrator alerts, approvals and system notifications.
            </p>
          </div>

          <div style={styles.actions}>
            <button
              type="button"
              onClick={loadNotifications}
              style={styles.refresh}
            >
              Refresh
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                style={styles.readAll}
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={styles.empty}>
            <div style={styles.bigIcon}>🔔</div>
            <h3>Loading notifications...</h3>
          </div>
        ) : (
          <>
            <div style={styles.summary}>
              <div>
                <strong style={styles.number}>
                  {notifications.length}
                </strong>

                <div style={styles.label}>
                  Total Notifications
                </div>
              </div>

              <div style={styles.divider}></div>

              <div>
                <strong style={styles.number}>
                  {unreadCount}
                </strong>

                <div style={styles.label}>
                  Unread
                </div>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.bigIcon}>
                  🔔
                </div>

                <h3>No notifications yet</h3>

                <p style={styles.muted}>
                  Administrator notifications will appear here.
                </p>
              </div>
            ) : (
              <div style={styles.list}>
                {notifications.map(function (notification) {
                  return (
                    <div
                      key={String(notification.id)}
                      style={{
                        ...styles.card,
                        background:
                          notification.is_read
                            ? "#fff"
                            : "#f7f9ff",
                        borderLeft:
                          notification.is_read
                            ? "4px solid #e5e7eb"
                            : "4px solid #4f46e5",
                      }}
                    >
                      <div style={styles.icon}>
                        {getIcon(
                          notification.notification_type
                        )}
                      </div>

                      <div style={styles.content}>
                        <div style={styles.top}>
                          <h3 style={styles.title}>
                            {notification.title ||
                              "Notification"}
                          </h3>

                          {!notification.is_read && (
                            <span style={styles.newBadge}>
                              NEW
                            </span>
                          )}

                          {notification.activity && (
                            <span
                              style={
                                styles.activityBadge
                              }
                            >
                              ACTIVITY
                            </span>
                          )}
                        </div>

                        <p style={styles.message}>
                          {notification.message}
                        </p>

                        <div style={styles.bottom}>
                          <span style={styles.date}>
                            {formatDate(
                              notification.created_at
                            )}
                          </span>

                          <div style={styles.buttons}>
                            {!notification.is_read &&
                              !notification.activity && (
                                <button
                                  type="button"
                                  onClick={function () {
                                    markAsRead(
                                      notification.id
                                    );
                                  }}
                                  style={
                                    styles.readButton
                                  }
                                >
                                  Mark as read
                                </button>
                              )}

                            <button
                              type="button"
                              onClick={function () {
                                deleteNotification(
                                  notification.id
                                );
                              }}
                              style={
                                styles.deleteButton
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

const styles = {
  page: {
    padding: "5px 0 30px",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },

  heading: {
    margin: "0 0 6px",
    color: "#17152f",
    fontSize: "28px",
  },

  subHeading: {
    margin: 0,
    color: "#777",
    fontSize: "14px",
  },

  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  refresh: {
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    background: "#17152f",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
  },

  readAll: {
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    background: "#4f46e5",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
  },

  error: {
    background: "#fff1f2",
    color: "#b91c1c",
    padding: "14px 18px",
    borderRadius: "10px",
    marginBottom: "18px",
    border: "1px solid #fecaca",
  },

  summary: {
    background: "#fff",
    padding: "20px 24px",
    borderRadius: "14px",
    boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
    display: "flex",
    alignItems: "center",
    gap: "25px",
    marginBottom: "20px",
  },

  number: {
    fontSize: "24px",
    color: "#17152f",
  },

  label: {
    fontSize: "13px",
    color: "#777",
    marginTop: "3px",
  },

  divider: {
    width: "1px",
    height: "42px",
    background: "#e5e7eb",
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  card: {
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
    display: "flex",
    gap: "16px",
  },

  icon: {
    fontSize: "28px",
    minWidth: "35px",
  },

  content: {
    flex: 1,
    minWidth: 0,
  },

  top: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },

  title: {
    margin: 0,
    color: "#17152f",
    fontSize: "17px",
  },

  newBadge: {
    fontSize: "10px",
    fontWeight: "700",
    background: "#4f46e5",
    color: "#fff",
    borderRadius: "10px",
    padding: "4px 8px",
  },

  activityBadge: {
    fontSize: "10px",
    fontWeight: "700",
    background: "#eef2ff",
    color: "#4f46e5",
    borderRadius: "10px",
    padding: "4px 8px",
  },

  message: {
    margin: "8px 0",
    color: "#555",
    lineHeight: "1.5",
  },

  bottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
    marginTop: "12px",
  },

  date: {
    fontSize: "12px",
    color: "#999",
  },

  buttons: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  readButton: {
    border: "none",
    background: "#eef2ff",
    color: "#4f46e5",
    padding: "7px 11px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },

  deleteButton: {
    border: "none",
    background: "#fff1f2",
    color: "#dc2626",
    padding: "7px 11px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },

  empty: {
    background: "#fff",
    padding: "50px 30px",
    borderRadius: "14px",
    textAlign: "center",
    boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
  },

  bigIcon: {
    fontSize: "45px",
    marginBottom: "10px",
  },

  muted: {
    color: "#777",
    lineHeight: "1.6",
  },
};

export default AdminNotifications;