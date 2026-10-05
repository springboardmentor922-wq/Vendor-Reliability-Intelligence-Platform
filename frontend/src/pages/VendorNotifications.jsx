import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

function VendorNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getToken = () => {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("token")
    );
  };

  const getNotifications = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        setError("Please login again.");
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/notifications`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load notifications.");
      }

      const data = await response.json();

      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Notification error:", err);
      setError(err.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getNotifications();
  }, []);

  const markAsRead = async (notificationId) => {
    try {
      const token = getToken();

      if (!token) {
        setError("Please login again.");
        return;
      }

      const response = await fetch(
        `${API_URL}/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark notification as read.");
      }

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification
        )
      );
    } catch (err) {
      console.error("Mark as read error:", err);
      setError(err.message || "Unable to mark notification as read.");
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = getToken();

      if (!token) {
        setError("Please login again.");
        return;
      }

      const response = await fetch(
        `${API_URL}/notifications/read-all`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read.");
      }

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );
    } catch (err) {
      console.error("Mark all as read error:", err);
      setError(
        err.message || "Unable to mark all notifications as read."
      );
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const token = getToken();

      if (!token) {
        setError("Please login again.");
        return;
      }

      const response = await fetch(
        `${API_URL}/notifications/${notificationId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete notification.");
      }

      setNotifications((previous) =>
        previous.filter(
          (notification) => notification.id !== notificationId
        )
      );
    } catch (err) {
      console.error("Delete notification error:", err);
      setError(
        err.message || "Unable to delete notification."
      );
    }
  };

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return date.toLocaleString();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "success":
        return "✅";

      case "warning":
        return "⚠️";

      case "error":
        return "❌";

      case "info":
      default:
        return "ℹ️";
    }
  };

  return (
    <DashboardLayout
      title="Notifications"
      role="Vendor"
      menuItems={[
        "Dashboard",
        "Profile",
        "Purchase Orders",
        "Deliveries",
        "Delayed Deliveries",
        "Performance",
        "Risk Status",
        "Contracts",
        "Compliance",
        "Communications",
        "Notifications",
      ]}
    >
      <div style={page}>
        <div style={header}>
          <div>
            <h2 style={heading}>Notifications</h2>

            <p style={subHeading}>
              Stay updated with your purchase orders, deliveries,
              approvals and other important activities.
            </p>
          </div>

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

        {loading && (
          <div style={emptyCard}>
            <div style={largeIcon}>🔔</div>

            <h3>Loading notifications...</h3>

            <p style={mutedText}>
              Please wait while we load your notifications.
            </p>
          </div>
        )}

        {!loading && error && (
          <div style={errorCard}>
            <div style={largeIcon}>⚠️</div>

            <h3>Unable to load notifications</h3>

            <p style={mutedText}>{error}</p>

            <button
              type="button"
              onClick={getNotifications}
              style={retryButton}
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div style={summaryCard}>
              <div style={summaryIcon}>🔔</div>

              <div>
                <div style={summaryNumber}>
                  {notifications.length}
                </div>

                <div style={summaryLabel}>
                  Total Notifications
                </div>
              </div>

              <div style={divider}></div>

              <div>
                <div style={summaryNumber}>
                  {unreadCount}
                </div>

                <div style={summaryLabel}>
                  Unread
                </div>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div style={emptyCard}>
                <div style={largeIcon}>🔔</div>

                <h3>No notifications yet</h3>

                <p style={mutedText}>
                  You will see notifications here when there are
                  updates related to your vendor account.
                </p>
              </div>
            ) : (
              <div style={notificationList}>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    style={{
                      ...notificationCard,
                      backgroundColor: notification.is_read
                        ? "#ffffff"
                        : "#f7f9ff",
                      borderLeft: notification.is_read
                        ? "4px solid #e5e7eb"
                        : "4px solid #4f46e5",
                    }}
                  >
                    <div style={notificationIcon}>
                      {getNotificationIcon(
                        notification.notification_type
                      )}
                    </div>

                    <div style={notificationContent}>
                      <div style={notificationTop}>
                        <h3 style={notificationTitle}>
                          {notification.title}
                        </h3>

                        {!notification.is_read && (
                          <span style={unreadBadge}>
                            NEW
                          </span>
                        )}
                      </div>

                      <p style={notificationMessage}>
                        {notification.message}
                      </p>

                      <div style={notificationBottom}>
                        <span style={notificationDate}>
                          {formatDate(notification.created_at)}
                        </span>

                        <div style={actions}>
                          {!notification.is_read && (
                            <button
                              type="button"
                              onClick={() =>
                                markAsRead(notification.id)
                              }
                              style={readButton}
                            >
                              Mark as read
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              deleteNotification(notification.id)
                            }
                            style={deleteButton}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
  gap: "18px",
  marginBottom: "20px",
};

const summaryIcon = {
  fontSize: "30px",
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
  margin: "0 10px",
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
  transition: "0.2s",
};

const notificationIcon = {
  fontSize: "28px",
  minWidth: "35px",
};

const notificationContent = {
  flex: 1,
};

const notificationTop = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
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

const actions = {
  display: "flex",
  gap: "8px",
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
  ...emptyCard,
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

const retryButton = {
  marginTop: "12px",
  border: "none",
  borderRadius: "8px",
  padding: "10px 18px",
  background: "#4f46e5",
  color: "#fff",
  fontWeight: "600",
  cursor: "pointer",
};

export default VendorNotifications;