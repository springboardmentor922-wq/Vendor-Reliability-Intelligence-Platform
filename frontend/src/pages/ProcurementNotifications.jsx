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

function ProcurementNotifications() {
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
        apiGet("/purchase-orders"),
      ]);

      const databaseNotifications = Array.isArray(results[0])
        ? results[0].map(normalizeNotification)
        : [];

      const requests = Array.isArray(results[1])
        ? results[1]
        : [];

      const orders = Array.isArray(results[2])
        ? results[2]
        : [];

      const activityNotifications = [];

      requests.forEach(function (request) {
        const requestNumber =
          request.request_number ||
          "Procurement Request #" + request.id;

        if (request.status === "pending") {
          activityNotifications.push({
            id: "proc-request-pending-" + request.id,
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
            id: "proc-request-approved-" + request.id,
            title: "Procurement Request Approved",
            message:
              requestNumber +
              " has been approved and can be converted to a Purchase Order.",
            notification_type: "success",
            created_at: request.created_at,
            is_read: false,
            activity: true,
          });
        }

        if (request.status === "rejected") {
          activityNotifications.push({
            id: "proc-request-rejected-" + request.id,
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

        if (request.status === "converted") {
          activityNotifications.push({
            id: "proc-request-converted-" + request.id,
            title: "Procurement Request Converted",
            message:
              requestNumber +
              " has been converted to a Purchase Order.",
            notification_type: "info",
            created_at: request.created_at,
            is_read: false,
            activity: true,
          });
        }
      });

      orders.forEach(function (order) {
        const orderNumber =
          order.order_number ||
          "Purchase Order #" + order.id;

        if (order.status === "pending") {
          activityNotifications.push({
            id: "proc-order-pending-" + order.id,
            title: "Purchase Order Created",
            message:
              orderNumber +
              " has been created and is awaiting vendor action.",
            notification_type: "info",
            created_at: order.created_at,
            is_read: false,
            activity: true,
          });
        }

        if (order.status === "accepted") {
          activityNotifications.push({
            id: "proc-order-accepted-" + order.id,
            title: "Purchase Order Accepted",
            message:
              orderNumber +
              " has been accepted by the vendor.",
            notification_type: "success",
            created_at: order.created_at,
            is_read: false,
            activity: true,
          });
        }

        if (order.status === "shipped") {
          activityNotifications.push({
            id: "proc-order-shipped-" + order.id,
            title: "Purchase Order Shipped",
            message:
              orderNumber +
              " has been shipped and is awaiting delivery.",
            notification_type: "info",
            created_at: order.created_at,
            is_read: false,
            activity: true,
          });
        }

        if (order.status === "delivered") {
          activityNotifications.push({
            id: "proc-order-delivered-" + order.id,
            title: "Purchase Order Delivered",
            message:
              orderNumber +
              " has been delivered successfully.",
            notification_type: "success",
            created_at:
              order.actual_delivery_date ||
              order.created_at,
            is_read: false,
            activity: true,
          });
        }

        if (order.status === "cancelled") {
          activityNotifications.push({
            id: "proc-order-cancelled-" + order.id,
            title: "Purchase Order Cancelled",
            message:
              orderNumber +
              " has been cancelled.",
            notification_type: "error",
            created_at: order.created_at,
            is_read: false,
            activity: true,
          });
        }
      });

      const combinedNotifications =
        databaseNotifications.concat(
          activityNotifications
        );

      combinedNotifications.sort(function (a, b) {
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
      });

      setNotifications(combinedNotifications);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId) {
    if (String(notificationId).indexOf("-") !== -1) {
      return;
    }

    try {
      await apiAction(
        "/notifications/" +
          notificationId +
          "/read",
        "PUT"
      );

      setNotifications(function (previous) {
        return previous.map(function (notification) {
          if (notification.id === notificationId) {
            return {
              ...notification,
              is_read: true,
            };
          }

          return notification;
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

      setNotifications(function (previous) {
        return previous.map(function (notification) {
          return {
            ...notification,
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

  async function deleteNotification(notificationId) {
    if (String(notificationId).indexOf("-") !== -1) {
      setNotifications(function (previous) {
        return previous.filter(function (notification) {
          return notification.id !== notificationId;
        });
      });

      return;
    }

    try {
      await apiAction(
        "/notifications/" +
          notificationId,
        "DELETE"
      );

      setNotifications(function (previous) {
        return previous.filter(function (notification) {
          return notification.id !== notificationId;
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

  const unreadCount = notifications.filter(function (notification) {
    return !notification.is_read;
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
      role="Procurement Manager"
      menuItems={[
        "Dashboard",
        "Vendors",
        "Procurement Requests",
        "Purchase Orders",
        "Approvals",
        "Vendor Performance",
        "Reports",
        "Notifications",
      ]}
    >
      <div style={page}>
        <div style={header}>
          <div>
            <h2 style={heading}>
              Notifications
            </h2>

            <p style={subHeading}>
              Stay updated with procurement, purchase orders and vendor activities.
            </p>
          </div>

          <div style={headerActions}>
            <button
              type="button"
              onClick={loadNotifications}
              style={refreshButton}
            >
              Refresh
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                style={readAllButton}
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={errorCard}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={emptyCard}>
            <div style={largeIcon}>🔔</div>
            <h3>Loading notifications...</h3>
            <p style={mutedText}>
              Please wait while notifications are loaded.
            </p>
          </div>
        ) : (
          <>
            <div style={summaryCard}>
              <div style={summaryItem}>
                <div style={summaryIcon}>🔔</div>

                <div>
                  <div style={summaryNumber}>
                    {notifications.length}
                  </div>

                  <div style={summaryLabel}>
                    Total Notifications
                  </div>
                </div>
              </div>

              <div style={divider}></div>

              <div style={summaryItem}>
                <div style={summaryIcon}>📩</div>

                <div>
                  <div style={summaryNumber}>
                    {unreadCount}
                  </div>

                  <div style={summaryLabel}>
                    Unread
                  </div>
                </div>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div style={emptyCard}>
                <div style={largeIcon}>🔔</div>

                <h3>No notifications yet</h3>

                <p style={mutedText}>
                  Procurement and purchase order activities will appear here.
                </p>
              </div>
            ) : (
              <div style={notificationList}>
                {notifications.map(function (notification) {
                  return (
                    <div
                      key={String(notification.id)}
                      style={{
                        ...notificationCard,
                        backgroundColor:
                          notification.is_read
                            ? "#ffffff"
                            : "#f7f9ff",
                        borderLeft:
                          notification.is_read
                            ? "4px solid #e5e7eb"
                            : "4px solid #4f46e5",
                      }}
                    >
                      <div style={notificationIcon}>
                        {getIcon(
                          notification.notification_type
                        )}
                      </div>

                      <div style={notificationContent}>
                        <div style={notificationTop}>
                          <h3 style={notificationTitle}>
                            {notification.title ||
                              "Notification"}
                          </h3>

                          {!notification.is_read && (
                            <span style={unreadBadge}>
                              NEW
                            </span>
                          )}

                          {notification.activity && (
                            <span style={activityBadge}>
                              ACTIVITY
                            </span>
                          )}
                        </div>

                        <p style={notificationMessage}>
                          {notification.message}
                        </p>

                        <div style={notificationBottom}>
                          <span style={notificationDate}>
                            {formatDate(
                              notification.created_at
                            )}
                          </span>

                          <div style={buttonGroup}>
                            {!notification.is_read &&
                              !notification.activity && (
                                <button
                                  type="button"
                                  onClick={function () {
                                    markAsRead(
                                      notification.id
                                    );
                                  }}
                                  style={readButton}
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
                              style={deleteButton}
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

const page = {
  padding: "5px 0 30px",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "20px",
  flexWrap: "wrap",
};

const headerActions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const heading = {
  margin: "0 0 6px",
  color: "#17152f",
  fontSize: "28px",
};

const subHeading = {
  margin: 0,
  color: "#777",
  fontSize: "14px",
};

const refreshButton = {
  border: "none",
  borderRadius: "8px",
  padding: "10px 16px",
  background: "#17152f",
  color: "#fff",
  fontWeight: "600",
  cursor: "pointer",
};

const readAllButton = {
  border: "none",
  borderRadius: "8px",
  padding: "10px 16px",
  background: "#4f46e5",
  color: "#fff",
  fontWeight: "600",
  cursor: "pointer",
};

const summaryCard = {
  background: "#fff",
  padding: "20px 24px",
  borderRadius: "14px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
  display: "flex",
  alignItems: "center",
  gap: "25px",
  marginBottom: "20px",
};

const summaryItem = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const summaryIcon = {
  fontSize: "28px",
};

const summaryNumber = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#17152f",
};

const summaryLabel = {
  fontSize: "13px",
  color: "#777",
  marginTop: "3px",
};

const divider = {
  width: "1px",
  height: "42px",
  background: "#e5e7eb",
};

const notificationList = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const notificationCard = {
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
  display: "flex",
  gap: "16px",
};

const notificationIcon = {
  fontSize: "28px",
  minWidth: "35px",
};

const notificationContent = {
  flex: 1,
  minWidth: 0,
};

const notificationTop = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const notificationTitle = {
  margin: 0,
  color: "#17152f",
  fontSize: "17px",
};

const unreadBadge = {
  fontSize: "10px",
  fontWeight: "700",
  background: "#4f46e5",
  color: "#fff",
  borderRadius: "10px",
  padding: "4px 8px",
};

const activityBadge = {
  fontSize: "10px",
  fontWeight: "700",
  background: "#eef2ff",
  color: "#4f46e5",
  borderRadius: "10px",
  padding: "4px 8px",
};

const notificationMessage = {
  margin: "8px 0",
  color: "#555",
  lineHeight: "1.5",
};

const notificationBottom = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
  flexWrap: "wrap",
  marginTop: "12px",
};

const notificationDate = {
  fontSize: "12px",
  color: "#999",
};

const buttonGroup = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const readButton = {
  border: "none",
  background: "#eef2ff",
  color: "#4f46e5",
  padding: "7px 11px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "600",
};

const deleteButton = {
  border: "none",
  background: "#fff1f2",
  color: "#dc2626",
  padding: "7px 11px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "600",
};

const emptyCard = {
  background: "#fff",
  padding: "50px 30px",
  borderRadius: "14px",
  textAlign: "center",
  boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
};

const errorCard = {
  background: "#fff1f2",
  color: "#b91c1c",
  padding: "14px 18px",
  borderRadius: "10px",
  marginBottom: "18px",
  border: "1px solid #fecaca",
};

const largeIcon = {
  fontSize: "45px",
  marginBottom: "10px",
};

const mutedText = {
  maxWidth: "650px",
  margin: "10px auto",
  color: "#777",
  lineHeight: "1.6",
};

export default ProcurementNotifications;