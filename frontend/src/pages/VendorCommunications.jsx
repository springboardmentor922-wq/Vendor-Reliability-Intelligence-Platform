import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

function VendorCommunications() {
  const [messages, setMessages] = useState([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [receiverId, setReceiverId] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      const response = await fetch(`${API_URL}/communications`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Failed to load communications"
        );
      }

      const uniqueMessages = Array.isArray(data)
        ? data.filter(
            (item, index, array) =>
              index ===
              array.findIndex((x) => x.id === item.id)
          )
        : [];

      setMessages(uniqueMessages);
    } catch (error) {
      console.error("Communication loading error:", error);
      setError(error.message || "Unable to load communications");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();

    if (!receiverId || !subject.trim() || !message.trim()) {
      alert("Please enter receiver ID, subject and message.");
      return;
    }

    try {
      setSending(true);

      const token = getToken();

      const response = await fetch(`${API_URL}/communications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiver_id: Number(receiverId),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Failed to send message"
        );
      }

      alert("Message sent successfully.");

      setReceiverId("");
      setSubject("");
      setMessage("");

      await loadMessages();
    } catch (error) {
      console.error("Message sending error:", error);
      alert(error.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const sentMessages = messages.filter((item) => {
    const currentUserId =
      localStorage.getItem("user_id") ||
      sessionStorage.getItem("user_id");

    return String(item.sender_id) === String(currentUserId);
  });

  const receivedMessages = messages.filter((item) => {
    const currentUserId =
      localStorage.getItem("user_id") ||
      sessionStorage.getItem("user_id");

    return String(item.receiver_id) === String(currentUserId);
  });

  return (
    <DashboardLayout
      title="Communications"
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
      <div style={header}>
        <div>
          <div style={eyebrow}>COMMUNICATION MANAGEMENT</div>

          <h2 style={title}>Communications</h2>

          <p style={subtitle}>
            Manage vendor communication, procurement discussions
            and message history.
          </p>
        </div>

        <button
          style={refreshButton}
          onClick={loadMessages}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div style={stats}>
        <Stat title="Total Messages" value={messages.length} />
        <Stat title="Sent" value={sentMessages.length} />
        <Stat title="Received" value={receivedMessages.length} />
      </div>

      <div style={layout}>
        <div style={messagesCard}>
          <h3 style={cardTitle}>Communication History</h3>

          <p style={cardSubtitle}>
            Messages stored in the VRIPRM communication system.
          </p>

          {loading && (
            <div style={messageBox}>
              Loading communications...
            </div>
          )}

          {!loading && error && (
            <div style={errorBox}>
              {error}
            </div>
          )}

          {!loading &&
            !error &&
            messages.length === 0 && (
              <div style={messageBox}>
                No communications found.
              </div>
            )}

          {!loading &&
            !error &&
            messages.length > 0 && (
              <div>
                {messages.map((item) => (
                  <div
                    key={item.id}
                    style={messageCard}
                  >
                    <div style={messageTop}>
                      <strong>
                        {item.subject || "No Subject"}
                      </strong>

                      <span style={date}>
                        {formatDate(item.created_at)}
                      </span>
                    </div>

                    <p style={messageText}>
                      {item.message || "No message content"}
                    </p>

                    <div style={meta}>
                      Sender ID: {item.sender_id}
                      {" • "}
                      Receiver ID: {item.receiver_id}
                    </div>

                    <span style={statusBadge}>
                      {item.status || "sent"}
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>

        <div style={composeCard}>
          <h3 style={cardTitle}>New Message</h3>

          <p style={cardSubtitle}>
            Send a message to another authorized VRIPRM user.
          </p>

          <form onSubmit={sendMessage}>
            <label style={label}>
              Receiver User ID
            </label>

            <input
              type="number"
              value={receiverId}
              onChange={(e) =>
                setReceiverId(e.target.value)
              }
              style={input}
              placeholder="Enter receiver user ID"
              min="1"
            />

            <label style={label}>
              Subject
            </label>

            <input
              type="text"
              value={subject}
              onChange={(e) =>
                setSubject(e.target.value)
              }
              style={input}
              placeholder="Enter subject"
            />

            <label style={label}>
              Message
            </label>

            <textarea
              rows="8"
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
              style={textarea}
              placeholder="Write your message..."
            />

            <button
              type="submit"
              style={{
                ...sendButton,
                opacity: sending ? 0.7 : 1,
              }}
              disabled={sending}
            >
              {sending ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Stat({ title, value }) {
  return (
    <div style={statCard}>
      <p style={statTitle}>{title}</p>

      <h2 style={statValue}>
        {value}
      </h2>
    </div>
  );
}

const header = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "18px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
};

const eyebrow = {
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "1.4px",
  color: "#777",
};

const title = {
  margin: "6px 0 0",
  color: "#17152f",
};

const subtitle = {
  margin: "7px 0 0",
  color: "#777",
  fontSize: "13px",
};

const refreshButton = {
  border: "none",
  background: "#17152f",
  color: "#fff",
  padding: "9px 16px",
  borderRadius: "7px",
  cursor: "pointer",
};

const stats = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "18px",
  marginBottom: "18px",
};

const statCard = {
  background: "#fff",
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
};

const statTitle = {
  margin: 0,
  color: "#777",
  fontSize: "13px",
};

const statValue = {
  margin: "8px 0 0",
  color: "#17152f",
  fontSize: "28px",
};

const layout = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr",
  gap: "18px",
};

const messagesCard = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
};

const composeCard = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  boxShadow: "0 3px 12px rgba(0,0,0,0.05)",
};

const cardTitle = {
  margin: 0,
  color: "#17152f",
};

const cardSubtitle = {
  color: "#888",
  fontSize: "12px",
  marginTop: "6px",
};

const messageCard = {
  border: "1px solid #e6e7eb",
  borderRadius: "10px",
  padding: "16px",
  marginTop: "12px",
};

const messageTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
};

const date = {
  color: "#888",
  fontSize: "11px",
};

const messageText = {
  color: "#666",
  fontSize: "13px",
  lineHeight: "1.5",
  marginBottom: "8px",
};

const meta = {
  fontSize: "11px",
  color: "#888",
  marginTop: "10px",
};

const statusBadge = {
  display: "inline-block",
  marginTop: "10px",
  background: "#eef1f7",
  padding: "5px 9px",
  borderRadius: "12px",
  fontSize: "11px",
  textTransform: "capitalize",
};

const messageBox = {
  padding: "30px",
  textAlign: "center",
  color: "#777",
  background: "#f8f9fb",
  borderRadius: "10px",
  marginTop: "15px",
};

const errorBox = {
  padding: "15px",
  color: "#c62828",
  background: "#ffeaea",
  borderRadius: "8px",
  marginTop: "15px",
};

const label = {
  display: "block",
  fontSize: "12px",
  fontWeight: "600",
  marginBottom: "7px",
  color: "#333",
  marginTop: "15px",
};

const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px",
  border: "1px solid #d9dce3",
  borderRadius: "8px",
};

const textarea = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px",
  border: "1px solid #d9dce3",
  borderRadius: "8px",
  resize: "vertical",
  fontFamily: "inherit",
};

const sendButton = {
  width: "100%",
  border: "none",
  background: "#17152f",
  color: "#fff",
  padding: "12px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
  marginTop: "15px",
};

export default VendorCommunications;