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
      (data && data.detail) || "Failed to load notifications."
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

function FinanceNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const previousNotifications = [
    {
      id: "finance-static-1",
      title: "Invoice requires approval",
      message: "An invoice is waiting for finance verification.",
      created_at: "2026-08-21T10:00:00",
      notification_type: "invoice",
      category: "Invoice",
      is_read: false,
      activity: true,
    },
    {
      id: "finance-static-2",
      title: "Payment due reminder",
      message: "A payment is approaching its due date.",
      created_at: "2026-08-20T10:00:00",
      notification_type: "payment",
      category: "Payment",
      is_read: false,
      activity: true,
    },
    {
      id: "finance-static-3",
      title: "Purchase order financial review",
      message: "A purchase order requires financial review.",
      created_at: "2026-08-18T10:00:00",
      notification_type: "info",
      category: "Purchase Order",
      is_read: true,
      activity: true,
    },
    {
      id: "finance-static-4",
      title: "Payment successfully processed",
      message: "A payment has been successfully processed.",
      created_at: "2026-08-17T10:00:00",
      notification_type: "success",
      category: "Payment",
      is_read: true,
      activity: true,
    },
  ];

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      const databaseNotifications = await apiGet("/notifications");

      const dynamicNotifications = Array.isArray(databaseNotifications)
        ? databaseNotifications.map(function (notification) {
            const type =
              notification.notification_type ||
              notification.type ||
              "general";

            return {
              ...notification,
              notification_type: type,
              category: type,
              activity: false,
            };
          })
        : [];

      const combined = previousNotifications.concat(
        dynamicNotifications
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
    if (String(id).indexOf("finance-static-") === 0) {
      setNotifications(function (items) {
        return items.map(function (item) {
          return item.id === id
            ? {
                ...item,
                is_read: true,
              }
            : item;
        });
      });

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
            ? {
                ...item,
                is_read: true,
              }
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
    if (String(id).indexOf("finance-static-") === 0) {
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

  const paymentAlerts = notifications.filter(function (item) {
    const type =
      item.notification_type ||
      item.type ||
      "";

    return (
      type === "payment" ||
      String(item.title || "")
        .toLowerCase()
        .includes("payment")
    );
  }).length;

  const resolvedCount = notifications.filter(function (item) {
    return item.is_read;
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
    if (type === "success") {
      return "✅";
    }

    if (type === "warning") {
      return "⚠️";
    }

    if (type === "error") {
      return "❌";
    }

    if (type === "payment") {
      return "💰";
    }

    if (type === "invoice") {
      return "🧾";
    }

    if (type === "contract") {
      return "📄";
    }

    if (type === "compliance") {
      return "🛡️";
    }

    return "ℹ️";
  }

  return (
    <DashboardLayout
      title="Notifications"
      role="Finance Officer"
      menuItems={[
        "Dashboard",
        "Purchase Orders",
        "Invoices",
        "Payments",
        "Financial Status",
        "Finance Reports",
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
              View financial and payment-related notifications.
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
            <div style={styles.summaryGrid}>
              <div style={styles.summaryCard}>
                <div style={styles.summaryIcon}>🔔</div>

                <div>
                  <div style={styles.number}>
                    {notifications.length}
                  </div>

                  <div style={styles.label}>
                    Total
                  </div>
                </div>
              </div>

              <div style={styles.summaryCard}>
                <div style={styles.summaryIcon}>📩</div>

                <div>
                  <div style={styles.number}>
                    {unreadCount}
                  </div>

                  <div style={styles.label}>
                    Unread
                  </div>
                </div>
              </div>

              <div style={styles.summaryCard}>
                <div style={styles.summaryIcon}>💰</div>

                <div>
                  <div style={styles.number}>
                    {paymentAlerts}
                  </div>

                  <div style={styles.label}>
                    Payment Alerts
                  </div>
                </div>
              </div>

              <div style={styles.summaryCard}>
                <div style={styles.summaryIcon}>✅</div>

                <div>
                  <div style={styles.number}>
                    {resolvedCount}
                  </div>

                  <div style={styles.label}>
                    Resolved
                  </div>
                </div>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.bigIcon}>🔔</div>

                <h3>No notifications yet</h3>

                <p style={styles.muted}>
                  Finance notifications will appear here.
                </p>
              </div>
            ) : (
              <div style={styles.list}>
                {notifications.map(function (notification) {
                  const notificationType =
                    notification.notification_type ||
                    notification.type ||
                    "general";

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
                        {getIcon(notificationType)}
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
                            <span style={styles.activityBadge}>
                              PREVIOUS
                            </span>
                          )}

                          {notification.category && (
                            <span style={styles.categoryBadge}>
                              {notification.category}
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
                            {!notification.is_read && (
                              <button
                                type="button"
                                onClick={function () {
                                  markAsRead(
                                    notification.id
                                  );
                                }}
                                style={styles.readButton}
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
                              style={styles.deleteButton}
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

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "15px",
    marginBottom: "20px",
  },

  summaryCard: {
    background: "#fff",
    padding: "20px",
    borderRadius: "14px",
    boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  summaryIcon: {
    fontSize: "28px",
  },

  number: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#17152f",
  },

  label: {
    fontSize: "13px",
    color: "#777",
    marginTop: "3px",
  },

  error: {
    background: "#fff1f2",
    color: "#b91c1c",
    padding: "14px 18px",
    borderRadius: "10px",
    marginBottom: "18px",
    border: "1px solid #fecaca",
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

  categoryBadge: {
    fontSize: "10px",
    fontWeight: "700",
    background: "#f3f4f6",
    color: "#555",
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

export default FinanceNotifications;