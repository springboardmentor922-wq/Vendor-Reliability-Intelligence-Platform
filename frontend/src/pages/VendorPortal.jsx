import React, { useEffect, useMemo, useState } from "react";

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

function VendorPortal() {
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadVendorPortal();
  }, []);

  async function loadVendorPortal() {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };

      const [vendorsResponse, ordersResponse] = await Promise.all([
        fetch(`${API_URL}/vendors`, { headers }),
        fetch(`${API_URL}/purchase-orders`, { headers }),
      ]);

      if (!vendorsResponse.ok) {
        throw new Error("Unable to load vendors.");
      }

      const vendorsData = await vendorsResponse.json();

      const ordersData = ordersResponse.ok
        ? await ordersResponse.json()
        : [];

      const cleanVendors = Array.isArray(vendorsData)
        ? vendorsData
        : [];

      const cleanOrders = Array.isArray(ordersData)
        ? ordersData
        : [];

      setVendors(cleanVendors);
      setPurchaseOrders(cleanOrders);

      if (cleanVendors.length > 0) {
        setSelectedVendor(cleanVendors[0]);
      } else {
        setSelectedVendor(null);
      }
    } catch (err) {
      console.error("Vendor Portal error:", err);
      setError(
        err.message || "Unable to load vendor portal."
      );
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo(() => {
    const values = vendors
      .map((vendor) => vendor.category)
      .filter(Boolean);

    return ["All", ...new Set(values)];
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return vendors.filter((vendor) => {
      const matchesSearch =
        !searchValue ||
        String(vendor.company_name || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(vendor.contact_person || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(vendor.email || "")
          .toLowerCase()
          .includes(searchValue);

      const matchesCategory =
        category === "All" ||
        String(vendor.category || "") === category;

      return matchesSearch && matchesCategory;
    });
  }, [vendors, search, category]);

  const selectedOrders = useMemo(() => {
    if (!selectedVendor) return [];

    return purchaseOrders.filter(
      (order) =>
        String(order.vendor_id) ===
        String(selectedVendor.id)
    );
  }, [purchaseOrders, selectedVendor]);

  const deliveredOrders = selectedOrders.filter(
    (order) =>
      String(order.status || "").toLowerCase() ===
      "delivered"
  );

  const activeOrders = selectedOrders.filter((order) => {
    const status = String(
      order.status || ""
    ).toLowerCase();

    return (
      status !== "delivered" &&
      status !== "cancelled"
    );
  });

  const cancelledOrders = selectedOrders.filter(
    (order) =>
      String(order.status || "").toLowerCase() ===
      "cancelled"
  );

  const reliability = Number(
    selectedVendor?.reliability_score || 0
  );

  function formatDate(date) {
    if (!date) return "-";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "-";
    }

    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getStatusStyle(status) {
    const value = String(status || "").toLowerCase();

    if (value === "delivered") {
      return {
        ...statusBadge,
        background: "#e8f7ee",
        color: "#15803d",
      };
    }

    if (value === "cancelled") {
      return {
        ...statusBadge,
        background: "#feecec",
        color: "#dc2626",
      };
    }

    if (
      value === "approved" ||
      value === "shipped"
    ) {
      return {
        ...statusBadge,
        background: "#e8f1ff",
        color: "#2563eb",
      };
    }

    return {
      ...statusBadge,
      background: "#fff4df",
      color: "#b7791f",
    };
  }

  function getRiskLevel(score) {
    if (score >= 80) return "Low";
    if (score >= 60) return "Medium";
    return "High";
  }

  return (
    <div style={page}>
      {/* HEADER */}
      <div style={portalHeader}>
        <div>
          <div style={eyebrow}>VRIPRM</div>

          <h1 style={portalTitle}>
            Vendor Portal
          </h1>

          <p style={portalSubtitle}>
            Centralized vendor intelligence, procurement
            activity and performance monitoring.
          </p>
        </div>

        <button
          onClick={loadVendorPortal}
          style={refreshButton}
        >
          ↻ Refresh
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div style={summaryGrid}>
        <SummaryCard
          icon="🏢"
          title="Total Vendors"
          value={vendors.length}
          text="Registered vendors"
        />

        <SummaryCard
          icon="✓"
          title="Approved Vendors"
          value={
            vendors.filter(
              (v) =>
                String(v.approval_status || "")
                  .toLowerCase() === "approved"
            ).length
          }
          text="Currently approved"
        />

        <SummaryCard
          icon="📦"
          title="Purchase Orders"
          value={purchaseOrders.length}
          text="Across all vendors"
        />

        <SummaryCard
          icon="🚚"
          title="Delivered Orders"
          value={
            purchaseOrders.filter(
              (po) =>
                String(po.status || "")
                  .toLowerCase() === "delivered"
            ).length
          }
          text="Completed deliveries"
        />
      </div>

      {/* ERROR */}
      {error && (
        <div style={errorBox}>
          <strong>
            Unable to load Vendor Portal
          </strong>

          <p>{error}</p>
        </div>
      )}

      {/* MAIN PORTAL */}
      <div style={portalGrid}>
        {/* VENDOR DIRECTORY */}
        <section style={vendorListCard}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>
                Vendor Directory
              </h2>

              <p style={sectionSubtitle}>
                Select a vendor to view detailed information.
              </p>
            </div>

            <span style={countBadge}>
              {filteredVendors.length}
            </span>
          </div>

          {/* SEARCH AND FILTER */}
          <div style={filterArea}>
            <input
              type="text"
              placeholder="Search vendor, contact or email..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              style={searchInput}
            />

            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value)
              }
              style={categorySelect}
            >
              {categories.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* VENDOR LIST */}
          <div style={vendorList}>
            {loading ? (
              <div style={emptyState}>
                Loading vendors...
              </div>
            ) : filteredVendors.length === 0 ? (
              <div style={emptyState}>
                No vendors found.
              </div>
            ) : (
              filteredVendors.map((vendor) => {
                const isSelected =
                  selectedVendor?.id === vendor.id;

                const vendorPOs =
                  purchaseOrders.filter(
                    (po) =>
                      String(po.vendor_id) ===
                      String(vendor.id)
                  );

                const approved =
                  String(
                    vendor.approval_status || ""
                  ).toLowerCase() === "approved";

                return (
                  <button
                    key={vendor.id}
                    onClick={() =>
                      setSelectedVendor(vendor)
                    }
                    style={{
                      ...vendorItem,
                      ...(isSelected
                        ? selectedVendorItem
                        : {}),
                    }}
                  >
                    <div style={vendorLogo}>
                      {String(
                        vendor.company_name || "V"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div style={vendorItemContent}>
                      <div style={vendorNameRow}>
                        <strong style={vendorName}>
                          {vendor.company_name ||
                            "Unnamed Vendor"}
                        </strong>

                        <span
                          style={
                            approved
                              ? approvedDot
                              : pendingDot
                          }
                        />
                      </div>

                      <span style={vendorCategory}>
                        {vendor.category ||
                          "Category not specified"}
                      </span>

                      <div style={vendorMeta}>
                        <span>
                          📦 {vendorPOs.length} POs
                        </span>

                        <span>
                          ★{" "}
                          {Number(
                            vendor.reliability_score || 0
                          ).toFixed(0)}
                        </span>
                      </div>
                    </div>

                    <span style={arrow}>
                      →
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* VENDOR DETAILS */}
        <section style={detailsCard}>
          {!selectedVendor ? (
            <div style={emptyDetails}>
              <div style={emptyDetailsIcon}>
                🏢
              </div>

              <h3>Select a vendor</h3>

              <p>
                Select a vendor from the directory to
                view details.
              </p>
            </div>
          ) : (
            <>
              {/* PROFILE HEADER */}
              <div style={vendorProfileHeader}>
                <div style={largeVendorLogo}>
                  {String(
                    selectedVendor.company_name || "V"
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={profileTitleRow}>
                    <h2 style={profileTitle}>
                      {selectedVendor.company_name ||
                        "Unnamed Vendor"}
                    </h2>

                    <span
                      style={
                        String(
                          selectedVendor.approval_status ||
                            ""
                        ).toLowerCase() ===
                        "approved"
                          ? approvedBadge
                          : pendingBadge
                      }
                    >
                      {selectedVendor.approval_status ||
                        "Pending"}
                    </span>
                  </div>

                  <p style={profileCategory}>
                    {selectedVendor.category ||
                      "Vendor"}
                  </p>

                  <p style={profileId}>
                    Vendor ID: V-
                    {String(
                      selectedVendor.id
                    ).padStart(4, "0")}
                  </p>
                </div>
              </div>

              {/* CONTACT DETAILS */}
              <div style={detailSection}>
                <h3 style={detailSectionTitle}>
                  Vendor Information
                </h3>

                <div style={infoGrid}>
                  <InfoItem
                    label="Contact Person"
                    value={
                      selectedVendor.contact_person
                    }
                  />

                  <InfoItem
                    label="Email"
                    value={selectedVendor.email}
                  />

                  <InfoItem
                    label="Phone"
                    value={selectedVendor.phone}
                  />

                  <InfoItem
                    label="Location"
                    value={selectedVendor.address}
                  />

                  <InfoItem
                    label="Vendor Status"
                    value={
                      selectedVendor.vendor_status
                    }
                  />

                  <InfoItem
                    label="Created"
                    value={formatDate(
                      selectedVendor.created_at
                    )}
                  />
                </div>
              </div>

              {/* PERFORMANCE */}
              <div style={detailSection}>
                <div style={performanceHeader}>
                  <h3 style={detailSectionTitle}>
                    Vendor Performance
                  </h3>

                  <strong style={score}>
                    {reliability.toFixed(0)}%
                  </strong>
                </div>

                <div style={progressBackground}>
                  <div
                    style={{
                      ...progress,
                      width: `${Math.min(
                        100,
                        Math.max(0, reliability)
                      )}%`,
                    }}
                  />
                </div>

                <div style={performanceFooter}>
                  <span>
                    Reliability Score
                  </span>

                  <span>
                    {getRiskLevel(reliability)} Risk
                  </span>
                </div>
              </div>

              {/* ORDER SUMMARY */}
              <div style={detailSection}>
                <h3 style={detailSectionTitle}>
                  Procurement Summary
                </h3>

                <div style={miniStats}>
                  <MiniStat
                    label="Total POs"
                    value={selectedOrders.length}
                    icon="📋"
                  />

                  <MiniStat
                    label="Active"
                    value={activeOrders.length}
                    icon="⏳"
                  />

                  <MiniStat
                    label="Delivered"
                    value={deliveredOrders.length}
                    icon="✓"
                  />

                  <MiniStat
                    label="Cancelled"
                    value={cancelledOrders.length}
                    icon="✕"
                  />
                </div>
              </div>

              {/* PURCHASE ORDERS */}
              <div style={detailSection}>
                <div style={performanceHeader}>
                  <h3 style={detailSectionTitle}>
                    Purchase Orders
                  </h3>

                  <span style={orderCount}>
                    {selectedOrders.length} Orders
                  </span>
                </div>

                {selectedOrders.length === 0 ? (
                  <div style={noOrders}>
                    No purchase orders are currently
                    associated with this vendor.
                  </div>
                ) : (
                  <div style={orderList}>
                    {selectedOrders
                      .slice(0, 5)
                      .map((order) => (
                        <div
                          key={order.id}
                          style={orderRow}
                        >
                          <div>
                            <strong style={orderNumber}>
                              {order.order_number ||
                                `PO-${order.id}`}
                            </strong>

                            <span style={orderDate}>
                              {formatDate(
                                order.order_date
                              )}
                            </span>
                          </div>

                          <div style={orderRight}>
                            <strong>
                              ₹
                              {Number(
                                order.total_amount || 0
                              ).toLocaleString("en-IN")}
                            </strong>

                            <span
                              style={getStatusStyle(
                                order.status
                              )}
                            >
                              {order.status ||
                                "Pending"}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  text,
}) {
  return (
    <div style={summaryCard}>
      <div style={summaryIcon}>
        {icon}
      </div>

      <div>
        <p style={summaryTitle}>
          {title}
        </p>

        <h2 style={summaryValue}>
          {value}
        </h2>

        <p style={summaryText}>
          {text}
        </p>
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={infoItem}>
      <span style={infoLabel}>
        {label}
      </span>

      <strong style={infoValue}>
        {value || "Not available"}
      </strong>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
}) {
  return (
    <div style={miniStat}>
      <span style={miniStatIcon}>
        {icon}
      </span>

      <div>
        <strong style={miniStatValue}>
          {value}
        </strong>

        <span style={miniStatLabel}>
          {label}
        </span>
      </div>
    </div>
  );
}

/* =========================
   STYLES
========================= */

const page = {
  minHeight: "100%",
};

const portalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
};

const eyebrow = {
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "1.5px",
  color: "#2563eb",
  marginBottom: "5px",
};

const portalTitle = {
  margin: 0,
  fontSize: "28px",
  fontWeight: "750",
  color: "#111827",
};

const portalSubtitle = {
  margin: "7px 0 0",
  color: "#6b7280",
  fontSize: "13px",
};

const refreshButton = {
  border: "1px solid #dbe2ea",
  background: "#fff",
  color: "#374151",
  padding: "10px 16px",
  borderRadius: "9px",
  cursor: "pointer",
  fontWeight: "600",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: "16px",
  marginBottom: "22px",
};

const summaryCard = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "18px",
  display: "flex",
  gap: "14px",
  alignItems: "center",
};

const summaryIcon = {
  width: "44px",
  height: "44px",
  borderRadius: "10px",
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "19px",
};

const summaryTitle = {
  margin: 0,
  fontSize: "12px",
  color: "#6b7280",
};

const summaryValue = {
  margin: "3px 0",
  fontSize: "24px",
  color: "#111827",
};

const summaryText = {
  margin: 0,
  fontSize: "10px",
  color: "#9ca3af",
};

const portalGrid = {
  display: "grid",
  gridTemplateColumns:
    "390px minmax(0, 1fr)",
  gap: "20px",
  alignItems: "start",
};

const vendorListCard = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  overflow: "hidden",
};

const detailsCard = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "24px",
};

const sectionHeader = {
  padding: "20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #eef0f3",
};

const sectionTitle = {
  margin: 0,
  fontSize: "17px",
  color: "#111827",
};

const sectionSubtitle = {
  margin: "4px 0 0",
  fontSize: "11px",
  color: "#6b7280",
};

const countBadge = {
  minWidth: "28px",
  height: "28px",
  padding: "0 8px",
  borderRadius: "20px",
  background: "#eff6ff",
  color: "#2563eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "12px",
  fontWeight: "700",
};

const filterArea = {
  padding: "15px",
  borderBottom: "1px solid #eef0f3",
  display: "flex",
  flexDirection: "column",
  gap: "9px",
};

const searchInput = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #dbe2ea",
  borderRadius: "8px",
  padding: "10px 12px",
  outline: "none",
  fontSize: "12px",
};

const categorySelect = {
  width: "100%",
  border: "1px solid #dbe2ea",
  borderRadius: "8px",
  padding: "10px 12px",
  background: "#fff",
  fontSize: "12px",
  color: "#374151",
};

const vendorList = {
  maxHeight: "650px",
  overflowY: "auto",
};

const vendorItem = {
  width: "100%",
  border: "none",
  borderBottom: "1px solid #f0f2f5",
  background: "#fff",
  padding: "15px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  textAlign: "left",
  cursor: "pointer",
};

const selectedVendorItem = {
  background: "#f5f8ff",
  boxShadow:
    "inset 3px 0 0 #2563eb",
};

const vendorLogo = {
  width: "40px",
  height: "40px",
  borderRadius: "10px",
  background: "#eef2ff",
  color: "#2563eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "800",
  flexShrink: 0,
};

const vendorItemContent = {
  flex: 1,
  minWidth: 0,
};

const vendorNameRow = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
};

const vendorName = {
  color: "#111827",
  fontSize: "13px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const approvedDot = {
  width: "7px",
  height: "7px",
  borderRadius: "50%",
  background: "#16a34a",
  flexShrink: 0,
};

const pendingDot = {
  width: "7px",
  height: "7px",
  borderRadius: "50%",
  background: "#f59e0b",
  flexShrink: 0,
};

const vendorCategory = {
  display: "block",
  marginTop: "3px",
  color: "#6b7280",
  fontSize: "10px",
};

const vendorMeta = {
  display: "flex",
  gap: "12px",
  marginTop: "6px",
  color: "#9ca3af",
  fontSize: "10px",
};

const arrow = {
  color: "#9ca3af",
  fontSize: "18px",
};

const vendorProfileHeader = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  paddingBottom: "22px",
  borderBottom: "1px solid #eef0f3",
};

const largeVendorLogo = {
  width: "62px",
  height: "62px",
  borderRadius: "15px",
  background: "#111827",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "25px",
  fontWeight: "800",
  flexShrink: 0,
};

const profileTitleRow = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

const profileTitle = {
  margin: 0,
  fontSize: "21px",
  color: "#111827",
};

const profileCategory = {
  margin: "5px 0 0",
  fontSize: "12px",
  color: "#2563eb",
  fontWeight: "600",
};

const profileId = {
  margin: "4px 0 0",
  fontSize: "10px",
  color: "#9ca3af",
};

const approvedBadge = {
  background: "#e8f7ee",
  color: "#15803d",
  padding: "5px 9px",
  borderRadius: "20px",
  fontSize: "10px",
  fontWeight: "700",
  textTransform: "capitalize",
};

const pendingBadge = {
  background: "#fff4df",
  color: "#b7791f",
  padding: "5px 9px",
  borderRadius: "20px",
  fontSize: "10px",
  fontWeight: "700",
  textTransform: "capitalize",
};

const detailSection = {
  paddingTop: "22px",
};

const detailSectionTitle = {
  margin: "0 0 14px",
  fontSize: "14px",
  color: "#111827",
};

const infoGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "10px",
};

const infoItem = {
  padding: "12px",
  background: "#f8fafc",
  borderRadius: "9px",
};

const infoLabel = {
  display: "block",
  fontSize: "10px",
  color: "#9ca3af",
  marginBottom: "4px",
};

const infoValue = {
  display: "block",
  fontSize: "12px",
  color: "#374151",
  wordBreak: "break-word",
};

const performanceHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const score = {
  fontSize: "19px",
  color: "#2563eb",
};

const progressBackground = {
  height: "8px",
  borderRadius: "10px",
  background: "#e5e7eb",
  overflow: "hidden",
};

const progress = {
  height: "100%",
  background: "#2563eb",
  borderRadius: "10px",
  transition: "width 0.3s ease",
};

const performanceFooter = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: "7px",
  color: "#6b7280",
  fontSize: "10px",
};

const miniStats = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: "10px",
};

const miniStat = {
  padding: "12px",
  border: "1px solid #eef0f3",
  borderRadius: "9px",
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

const miniStatIcon = {
  fontSize: "14px",
};

const miniStatValue = {
  display: "block",
  fontSize: "15px",
  color: "#111827",
};

const miniStatLabel = {
  display: "block",
  fontSize: "9px",
  color: "#9ca3af",
  marginTop: "2px",
};

const orderCount = {
  fontSize: "11px",
  color: "#6b7280",
};

const orderList = {
  border: "1px solid #eef0f3",
  borderRadius: "9px",
  overflow: "hidden",
};

const orderRow = {
  padding: "12px 14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #f0f2f5",
};

const orderNumber = {
  display: "block",
  fontSize: "12px",
  color: "#111827",
};

const orderDate = {
  display: "block",
  marginTop: "3px",
  fontSize: "10px",
  color: "#9ca3af",
};

const orderRight = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  fontSize: "11px",
};

const statusBadge = {
  padding: "5px 9px",
  borderRadius: "15px",
  fontSize: "9px",
  fontWeight: "700",
  textTransform: "capitalize",
};

const noOrders = {
  padding: "18px",
  borderRadius: "9px",
  background: "#f8fafc",
  color: "#6b7280",
  fontSize: "12px",
  textAlign: "center",
};

const emptyState = {
  padding: "40px 20px",
  textAlign: "center",
  color: "#9ca3af",
  fontSize: "12px",
};

const emptyDetails = {
  minHeight: "450px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: "#6b7280",
  textAlign: "center",
};

const emptyDetailsIcon = {
  fontSize: "42px",
  marginBottom: "12px",
};

const errorBox = {
  marginBottom: "20px",
  padding: "15px",
  borderRadius: "10px",
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#be123c",
  fontSize: "12px",
};

export default VendorPortal;