import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const API_URL = "http://127.0.0.1:8000";

const menuItems = [
  "Dashboard",
  "Users",
  "Vendors",
  "Suppliers",
  "Procurement",
  "Purchase Orders",
  "Risk Analysis",
  "Contract & Compliance",
  "Analytics",
  "Reports",
  "Settings",
  "Notifications",
];

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

async function fetchData(endpoint) {
  const token = getToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${endpoint}`);
  }

  return response.json();
}

function formatDate(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (
    value === "active" ||
    value === "approved" ||
    value === "delivered" ||
    value === "verified"
  ) {
    return "success";
  }

  if (
    value === "pending" ||
    value === "draft" ||
    value === "shipped" ||
    value === "expiring"
  ) {
    return "warning";
  }

  if (
    value === "cancelled" ||
    value === "expired" ||
    value === "rejected" ||
    value === "terminated"
  ) {
    return "danger";
  }

  return "neutral";
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
  onClick,
  clickable = false,
}) {
  return (
    <button
      type="button"
      className={`admin-stat-card ${clickable ? "clickable" : ""}`}
      onClick={onClick}
    >
      <div className="admin-stat-top">
        <div className="admin-stat-icon">{icon}</div>

        {clickable && <span className="stat-arrow">→</span>}
      </div>

      <div className="admin-stat-value">{value}</div>

      <div className="admin-stat-title">{title}</div>

      {subtitle && (
        <div className="admin-stat-subtitle">{subtitle}</div>
      )}
    </button>
  );
}

function SectionHeader({ title, subtitle, action, onAction }) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>

        {subtitle && <p>{subtitle}</p>}
      </div>

      {action && (
        <button
          type="button"
          className="section-action"
          onClick={onAction}
        >
          {action} →
        </button>
      )}
    </div>
  );
}

function ProgressBar({ value }) {
  const safeValue = Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );

  return (
    <div className="progress-track">
      <div
        className="progress-fill"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [performance, setPerformance] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");

  const [poSearch, setPoSearch] = useState("");
  const [poFilter, setPoFilter] = useState("all");

  const [showAllVendors, setShowAllVendors] = useState(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        usersData,
        vendorsData,
        suppliersData,
        ordersData,
        performanceData,
      ] = await Promise.all([
        fetchData("/users"),
        fetchData("/vendors"),
        fetchData("/suppliers"),
        fetchData("/purchase-orders"),
        fetchData("/performance").catch(() => []),
      ]);

      const usersList = Array.isArray(usersData)
        ? usersData
        : Array.isArray(usersData?.users)
        ? usersData.users
        : [];

      const vendorsList = Array.isArray(vendorsData)
        ? vendorsData
        : Array.isArray(vendorsData?.vendors)
        ? vendorsData.vendors
        : [];

      const suppliersList = Array.isArray(suppliersData)
        ? suppliersData
        : Array.isArray(suppliersData?.suppliers)
        ? suppliersData.suppliers
        : [];

      const ordersList = Array.isArray(ordersData)
        ? ordersData
        : Array.isArray(ordersData?.purchase_orders)
        ? ordersData.purchase_orders
        : Array.isArray(ordersData?.orders)
        ? ordersData.orders
        : [];

      setUsers(usersList);
      setVendors(vendorsList);
      setSuppliers(suppliersList);
      setPurchaseOrders(ordersList);

      const performanceList = Array.isArray(performanceData)
        ? performanceData
        : Array.isArray(performanceData?.performance)
        ? performanceData.performance
        : Array.isArray(performanceData?.records)
        ? performanceData.records
        : [];

      setPerformance(performanceList);

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Admin dashboard error:", err);

      setError(
        "Unable to load dashboard data. Please check whether the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const statistics = useMemo(() => {
    const activeUsers = users.filter(
      (user) => user.is_active !== false
    ).length;

    const activeVendors = vendors.filter(
      (vendor) =>
        String(vendor.vendor_status || "").toLowerCase() ===
        "active"
    ).length;

    const activeSuppliers = suppliers.filter(
      (supplier) =>
        String(
          supplier.supplier_status || "active"
        ).toLowerCase() !== "inactive"
    ).length;

    const activePOs = purchaseOrders.filter((po) =>
      ["pending", "approved", "shipped"].includes(
        String(po.status || "").toLowerCase()
      )
    ).length;

    const pendingPOs = purchaseOrders.filter(
      (po) =>
        String(po.status || "").toLowerCase() === "pending"
    ).length;

    const approvedPOs = purchaseOrders.filter(
      (po) =>
        String(po.status || "").toLowerCase() === "approved"
    ).length;

    const deliveredPOs = purchaseOrders.filter(
      (po) =>
        String(po.status || "").toLowerCase() === "delivered"
    ).length;

    const cancelledPOs = purchaseOrders.filter(
      (po) =>
        String(po.status || "").toLowerCase() === "cancelled"
    ).length;

    return {
      totalUsers: users.length,
      activeUsers,

      totalVendors: vendors.length,
      activeVendors,

      totalSuppliers: suppliers.length,
      activeSuppliers,

      totalPOs: purchaseOrders.length,
      activePOs,

      pendingPOs,
      approvedPOs,
      deliveredPOs,
      cancelledPOs,
    };
  }, [users, vendors, suppliers, purchaseOrders]);

  const vendorAnalytics = useMemo(() => {
    const scoreMap = new Map();

    // Vendor-level reliability score has priority.
    vendors.forEach((vendor) => {
      const score = Number(vendor.reliability_score);
      if (Number.isFinite(score)) {
        scoreMap.set(String(vendor.id), score);
      }
    });

    // Fill missing vendor scores from performance records.
    performance.forEach((record) => {
      const vendorId =
        record.vendor_id ??
        record.vendor?.id ??
        record.vendorId;

      if (vendorId === null || vendorId === undefined) {
        return;
      }

      const score =
        Number(record.reliability_score);

      const overall =
        Number(record.overall_score);

      const usableScore = Number.isFinite(score)
        ? score
        : Number.isFinite(overall)
        ? overall
        : null;

      if (
        usableScore !== null &&
        !scoreMap.has(String(vendorId))
      ) {
        scoreMap.set(String(vendorId), usableScore);
      }
    });

    const scores = Array.from(scoreMap.values());

    const lowRisk = scores.filter(
      (score) => score >= 80
    ).length;

    const mediumRisk = scores.filter(
      (score) => score >= 60 && score < 80
    ).length;

    const highRisk = scores.filter(
      (score) => score < 60
    ).length;

    const averageReliability =
      scores.length > 0
        ? scores.reduce(
            (sum, score) => sum + score,
            0
          ) / scores.length
        : 0;

    return {
      lowRisk,
      mediumRisk,
      highRisk,
      averageReliability,
      scoredVendors: scores.length,
    };
  }, [vendors, performance]);

  const complianceSummary = useMemo(() => {
    const approved = vendors.filter(
      (vendor) =>
        String(vendor.approval_status || "").toLowerCase() ===
        "approved"
    ).length;

    const pending = vendors.filter(
      (vendor) =>
        String(vendor.approval_status || "").toLowerCase() ===
        "pending"
    ).length;

    const rejected = vendors.filter(
      (vendor) =>
        String(vendor.approval_status || "").toLowerCase() ===
        "rejected"
    ).length;

    return {
      approved,
      pending,
      rejected,
    };
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    let result = [...vendors];

    if (vendorFilter !== "all") {
      result = result.filter((vendor) => {
        const score = Number(
          vendor.reliability_score || 0
        );

        if (vendorFilter === "low") {
          return score >= 80;
        }

        if (vendorFilter === "medium") {
          return score >= 60 && score < 80;
        }

        if (vendorFilter === "high") {
          return score < 60;
        }

        return true;
      });
    }

    if (vendorSearch.trim()) {
      const query = vendorSearch.toLowerCase();

      result = result.filter((vendor) => {
        return (
          String(vendor.company_name || "")
            .toLowerCase()
            .includes(query) ||
          String(vendor.email || "")
            .toLowerCase()
            .includes(query) ||
          String(vendor.category || "")
            .toLowerCase()
            .includes(query)
        );
      });
    }

    return result;
  }, [vendors, vendorSearch, vendorFilter]);

  const displayedVendors = showAllVendors
    ? filteredVendors
    : filteredVendors.slice(0, 6);

  const filteredPOs = useMemo(() => {
    let result = [...purchaseOrders];

    if (poFilter !== "all") {
      result = result.filter(
        (po) =>
          String(po.status || "").toLowerCase() ===
          poFilter.toLowerCase()
      );
    }

    if (poSearch.trim()) {
      const query = poSearch.toLowerCase();

      result = result.filter((po) => {
        return (
          String(po.order_number || "")
            .toLowerCase()
            .includes(query) ||
          String(po.id || "")
            .toLowerCase()
            .includes(query) ||
          String(po.vendor_id || "")
            .toLowerCase()
            .includes(query)
        );
      });
    }

    return result
      .sort((a, b) => {
        const dateA = new Date(
          a.created_at || a.order_date || 0
        );

        const dateB = new Date(
          b.created_at || b.order_date || 0
        );

        return dateB - dateA;
      })
      .slice(0, 8);
  }, [purchaseOrders, poSearch, poFilter]);

  const recentActivity = useMemo(() => {
    const activities = [];

    users.forEach((user) => {
      if (user.created_at) {
        activities.push({
          type: "User",
          title: `User ${
            user.name || user.email || "created"
          }`,
          date: user.created_at,
        });
      }
    });

    vendors.forEach((vendor) => {
      if (vendor.created_at) {
        activities.push({
          type: "Vendor",
          title: `${
            vendor.company_name || "Vendor"
          } added`,
          date: vendor.created_at,
        });
      }
    });

    purchaseOrders.forEach((po) => {
      if (po.created_at || po.order_date) {
        activities.push({
          type: "Order",
          title: `Purchase Order #${
            po.order_number || po.id
          } ${String(po.status || "").toLowerCase()}`,
          date: po.created_at || po.order_date,
        });
      }
    });

    return activities
      .sort(
        (a, b) =>
          new Date(b.date) - new Date(a.date)
      )
      .slice(0, 6);
  }, [users, vendors, purchaseOrders]);

  const navigate = (path) => {
    window.location.href = path;
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Admin Dashboard"
        role="Administrator"
        menuItems={menuItems}
      >
        <div className="admin-loading">
          <div className="loading-spinner" />

          <h3>Loading Admin Dashboard...</h3>

          <p>
            Fetching users, vendors, suppliers and
            procurement data.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Admin Dashboard"
      role="Administrator"
      menuItems={menuItems}
    >
      <div className="admin-dashboard">
        <style>{`
          * {
            box-sizing: border-box;
          }

          .admin-dashboard {
            color: #172033;
            max-width: 1600px;
            margin: 0 auto;
          }

          /* ================= HEADER ================= */

          .admin-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 26px;
          }

          .admin-header h1 {
            margin: 0 0 7px;
            font-size: 28px;
            font-weight: 700;
            color: #142338;
          }

          .admin-header p {
            margin: 0;
            color: #7b8495;
            font-size: 14px;
          }

          .admin-header-right {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .updated-text {
            font-size: 12px;
            color: #7b8495;
          }

          .refresh-button {
            border: 1px solid #dfe4eb;
            background: #ffffff;
            color: #123f61;
            padding: 10px 15px;
            border-radius: 9px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s ease;
          }

          .refresh-button:hover {
            background: #edf7f9;
            border-color: #137388;
          }

          /* ================= ERROR ================= */

          .error-box {
            background: #fff4f4;
            border: 1px solid #f0caca;
            color: #b42318;
            border-radius: 10px;
            padding: 14px 16px;
            margin-bottom: 22px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
          }

          .retry-button {
            border: none;
            background: #123f61;
            color: #ffffff;
            padding: 8px 14px;
            border-radius: 7px;
            cursor: pointer;
            font-weight: 600;
          }

          /* ================= STATISTICS ================= */

          .admin-stat-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          }

          .admin-stat-card {
            width: 100%;
            border: 1px solid #e8ebf1;
            background: #ffffff;
            border-radius: 14px;
            padding: 20px;
            text-align: left;
            box-shadow: 0 2px 8px rgba(20, 35, 56, 0.04);
            cursor: default;
            transition: all 0.2s ease;
          }

          .admin-stat-card.clickable {
            cursor: pointer;
          }

          .admin-stat-card.clickable:hover {
            transform: translateY(-2px);
            border-color: #137388;
            box-shadow: 0 8px 20px rgba(18, 63, 97, 0.09);
          }

          .admin-stat-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 18px;
          }

          .admin-stat-icon {
            width: 42px;
            height: 42px;
            border-radius: 10px;
            background: #edf7f9;
            color: #137388;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 20px;
          }

          .stat-arrow {
            color: #137388;
            font-size: 18px;
          }

          .admin-stat-value {
            font-size: 27px;
            font-weight: 750;
            color: #142338;
            margin-bottom: 5px;
          }

          .admin-stat-title {
            font-size: 14px;
            font-weight: 650;
            color: #344054;
          }

          .admin-stat-subtitle {
            margin-top: 5px;
            color: #7b8495;
            font-size: 11px;
          }

          /* ================= TWO COLUMN ================= */

          .dashboard-grid {
            display: grid;
            grid-template-columns: 1.35fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }

          .dashboard-card {
            background: #ffffff;
            border: 1px solid #e8ebf1;
            border-radius: 14px;
            padding: 22px;
            box-shadow: 0 2px 8px rgba(20, 35, 56, 0.035);
          }

          /* ================= SECTION HEADER ================= */

          .section-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 15px;
            margin-bottom: 20px;
          }

          .section-header h2 {
            margin: 0;
            color: #142338;
            font-size: 17px;
            font-weight: 650;
          }

          .section-header p {
            margin: 5px 0 0;
            color: #7b8495;
            font-size: 12px;
            line-height: 1.5;
          }

          .section-action {
            border: none;
            background: transparent;
            color: #137388;
            font-weight: 700;
            cursor: pointer;
            white-space: nowrap;
            font-size: 13px;
          }

          .section-action:hover {
            text-decoration: underline;
          }

          /* ==================================================
             VENDOR ANALYTICS
             BARS LEFT + CIRCLE RIGHT
          ================================================== */

          .vendor-analytics-content {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 190px;
            gap: 28px;
            align-items: center;
            min-height: 190px;
          }

          .risk-section {
            width: 100%;
          }

          .risk-title {
            font-size: 14px;
            font-weight: 700;
            color: #344054;
            margin-bottom: 20px;
          }

          .risk-row {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }

          .risk-item {
            display: grid;
            grid-template-columns: 85px minmax(0, 1fr) 40px;
            align-items: center;
            gap: 12px;
          }

          .risk-label {
            font-size: 13px;
            color: #344054;
            font-weight: 600;
          }

          .risk-number {
            font-size: 13px;
            color: #667085;
            text-align: right;
            font-weight: 600;
          }

          .risk-bar {
            height: 8px;
            background: #edf0f4;
            border-radius: 99px;
            overflow: hidden;
          }

          .risk-bar-fill {
            height: 100%;
            border-radius: 99px;
            transition: width 0.5s ease;
          }

          .risk-low {
            background: #147f91;
          }

          .risk-medium {
            background: #d9a441;
          }

          .risk-high {
            background: #d05b5b;
          }

          /* ================= CIRCLE ON RIGHT ================= */

          .analytics-score {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            min-height: 180px;
          }

          .score-circle {
            width: 118px;
            height: 118px;
            border-radius: 50%;
            border: 9px solid #eaf5f7;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            flex-shrink: 0;
            background: #ffffff;
          }

          .score-circle strong {
            font-size: 25px;
            color: #123f61;
            font-weight: 750;
          }

          .score-circle span {
            font-size: 9px;
            color: #7b8495;
            margin-top: 2px;
            letter-spacing: 0.4px;
          }

          .score-description {
            color: #667085;
            font-size: 11px;
            line-height: 1.5;
            margin-top: 13px;
            max-width: 170px;
          }

          .score-description strong {
            color: #344054;
          }

          /* ================= COMPLIANCE ================= */

          .compliance-list {
            display: flex;
            flex-direction: column;
            gap: 11px;
          }

          .compliance-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 13px 14px;
            border-radius: 10px;
            background: #f7f9fc;
            border: 1px solid #f0f2f5;
            transition: all 0.2s ease;
          }

          .compliance-row:hover {
            background: #f2f6f8;
            transform: translateX(2px);
          }

          .compliance-row span:first-child {
            font-size: 13px;
            color: #344054;
            font-weight: 600;
          }

          .compliance-count {
            font-weight: 750;
            color: #142338;
            font-size: 14px;
          }

          /* ================= STATUS ================= */

          .status-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 4px 9px;
            border-radius: 99px;
            font-size: 10px;
            font-weight: 650;
            text-transform: capitalize;
            min-width: 28px;
          }

          .status-success {
            background: #edf7f9;
            color: #137388;
          }

          .status-warning {
            background: #fff8e8;
            color: #9a6700;
          }

          .status-danger {
            background: #fff1f1;
            color: #b42318;
          }

          .status-neutral {
            background: #f2f4f7;
            color: #667085;
          }

          /* ================= FILTER ================= */

          .filter-row {
            display: flex;
            gap: 9px;
            margin-bottom: 15px;
          }

          .search-input {
            flex: 1;
            min-width: 0;
            border: 1px solid #dfe4eb;
            border-radius: 8px;
            padding: 10px 12px;
            outline: none;
            color: #172033;
            background: #ffffff;
            font-size: 12px;
          }

          .search-input:focus {
            border-color: #137388;
            box-shadow: 0 0 0 3px rgba(19, 115, 136, 0.08);
          }

          .filter-select {
            border: 1px solid #dfe4eb;
            border-radius: 8px;
            padding: 9px 11px;
            color: #344054;
            background: #ffffff;
            outline: none;
            cursor: pointer;
            font-size: 12px;
          }

          .filter-select:focus {
            border-color: #137388;
          }

          /* ================= VENDORS ================= */

          .vendor-list {
            display: flex;
            flex-direction: column;
          }

          .vendor-row {
            display: grid;
            grid-template-columns: 1.5fr 1fr 100px 90px;
            align-items: center;
            gap: 15px;
            padding: 13px 0;
            border-bottom: 1px solid #eef0f3;
          }

          .vendor-row:last-child {
            border-bottom: none;
          }

          .vendor-name {
            color: #142338;
            font-size: 12px;
            font-weight: 650;
          }

          .vendor-email {
            color: #7b8495;
            font-size: 10px;
            margin-top: 3px;
          }

          .vendor-category {
            color: #667085;
            font-size: 11px;
          }

          .reliability-value {
            font-size: 12px;
            color: #123f61;
            font-weight: 700;
          }

          .small-progress {
            margin-top: 5px;
          }

          .progress-track {
            width: 100%;
            height: 6px;
            background: #edf0f4;
            border-radius: 99px;
            overflow: hidden;
          }

          .progress-fill {
            height: 100%;
            background: #137388;
            border-radius: 99px;
            transition: width 0.4s ease;
          }

          /* ================= TABLE ================= */

          .table-wrapper {
            overflow-x: auto;
          }

          .po-table {
            width: 100%;
            border-collapse: collapse;
          }

          .po-table th {
            text-align: left;
            font-size: 10px;
            color: #7b8495;
            font-weight: 650;
            padding: 11px 8px;
            border-bottom: 1px solid #e8ebf1;
            white-space: nowrap;
          }

          .po-table td {
            padding: 12px 8px;
            border-bottom: 1px solid #eef0f3;
            font-size: 11px;
            color: #344054;
            white-space: nowrap;
          }

          .po-table tr:last-child td {
            border-bottom: none;
          }

          .po-number {
            color: #123f61;
            font-weight: 700;
          }

          /* ================= ACTIVITY ================= */

          .activity-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .activity-item {
            display: flex;
            gap: 11px;
            align-items: flex-start;
          }

          .activity-dot {
            width: 9px;
            height: 9px;
            background: #137388;
            border-radius: 50%;
            margin-top: 4px;
            flex-shrink: 0;
          }

          .activity-title {
            color: #344054;
            font-size: 12px;
            line-height: 1.4;
          }

          .activity-date {
            color: #98a2b3;
            font-size: 10px;
            margin-top: 3px;
          }

          /* ================= SYSTEM ================= */

          .system-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
          }

          .system-box {
            background: #f7f9fc;
            border: 1px solid #e8ebf1;
            border-radius: 10px;
            padding: 15px;
            transition: all 0.2s ease;
          }

          .system-box:hover {
            border-color: #d5e5e8;
            transform: translateY(-1px);
          }

          .system-box-label {
            color: #7b8495;
            font-size: 10px;
            margin-bottom: 6px;
          }

          .system-box-value {
            color: #142338;
            font-size: 19px;
            font-weight: 700;
          }

          /* ================= EMPTY ================= */

          .empty-state {
            text-align: center;
            padding: 25px 10px;
            color: #98a2b3;
            font-size: 12px;
          }

          /* ================= LOADING ================= */

          .admin-loading {
            min-height: 500px;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            color: #7b8495;
          }

          .admin-loading h3 {
            color: #142338;
            margin: 15px 0 5px;
          }

          .admin-loading p {
            margin: 0;
            font-size: 12px;
          }

          .loading-spinner {
            width: 34px;
            height: 34px;
            border: 3px solid #e8ebf1;
            border-top-color: #137388;
            border-radius: 50%;
            animation: adminSpin 0.8s linear infinite;
          }

          @keyframes adminSpin {
            to {
              transform: rotate(360deg);
            }
          }

          /* ================= RESPONSIVE ================= */

          @media (max-width: 1100px) {
            .admin-stat-grid {
              grid-template-columns: repeat(2, 1fr);
            }

            .dashboard-grid {
              grid-template-columns: 1fr;
            }

            .vendor-row {
              grid-template-columns: 1.5fr 1fr 100px 90px;
            }

            .system-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 800px) {
            .vendor-analytics-content {
              grid-template-columns: 1fr;
              gap: 25px;
            }

            .analytics-score {
              order: -1;
              min-height: auto;
            }

            .risk-section {
              width: 100%;
            }
          }

          @media (max-width: 700px) {
            .admin-header {
              flex-direction: column;
            }

            .admin-header-right {
              width: 100%;
              justify-content: space-between;
            }

            .admin-stat-grid {
              grid-template-columns: 1fr;
            }

            .vendor-row {
              grid-template-columns: 1fr;
              gap: 6px;
            }

            .filter-row {
              flex-direction: column;
            }

            .system-grid {
              grid-template-columns: 1fr 1fr;
            }

            .risk-item {
              grid-template-columns: 75px minmax(0, 1fr) 35px;
            }
          }

          @media (max-width: 450px) {
            .dashboard-card {
              padding: 16px;
            }

            .system-grid {
              grid-template-columns: 1fr;
            }

            .section-header {
              flex-direction: column;
            }

            .vendor-analytics-content {
              display: flex;
              flex-direction: column;
            }

            .analytics-score {
              order: -1;
            }
          }
        `}</style>

        {/* ================= HEADER ================= */}

        <div className="admin-header">
          <div>
            <h1>Admin Dashboard</h1>

            <p>
              Monitor users, vendors, procurement activity,
              compliance and system statistics.
            </p>
          </div>

          <div className="admin-header-right">
            {lastUpdated && (
              <span className="updated-text">
                Updated{" "}
                {lastUpdated.toLocaleTimeString("en-IN")}
              </span>
            )}

            <button
              type="button"
              className="refresh-button"
              onClick={loadDashboard}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* ================= ERROR ================= */}

        {error && (
          <div className="error-box">
            <span>{error}</span>

            <button
              type="button"
              className="retry-button"
              onClick={loadDashboard}
            >
              Retry
            </button>
          </div>
        )}

        {/* ================= STATISTICS ================= */}

        <div className="admin-stat-grid">
          <StatCard
            icon="👥"
            title="Total Users"
            value={statistics.totalUsers}
            subtitle={`${statistics.activeUsers} active users`}
            clickable
            onClick={() => navigate("/admin-users")}
          />

          <StatCard
            icon="🏢"
            title="Total Vendors"
            value={statistics.totalVendors}
            subtitle={`${statistics.activeVendors} active vendors`}
            clickable
            onClick={() => navigate("/admin-vendors")}
          />

          <StatCard
            icon="📦"
            title="Active Purchase Orders"
            value={statistics.activePOs}
            subtitle={`${statistics.pendingPOs} pending approval`}
            clickable
            onClick={() =>
              navigate("/admin-purchase-orders")
            }
          />

          <StatCard
            icon="🚚"
            title="Suppliers"
            value={statistics.totalSuppliers}
            subtitle={`${statistics.activeSuppliers} active suppliers`}
            clickable
            onClick={() => navigate("/admin-suppliers")}
          />
        </div>

        {/* =========================================================
            VENDOR ANALYTICS + COMPLIANCE
        ========================================================= */}

        <div className="dashboard-grid">

          {/* ================= VENDOR ANALYTICS ================= */}

          <div className="dashboard-card">
            <SectionHeader
              title="Vendor Analytics"
              subtitle="Reliability and risk distribution across registered vendors."
              action="View Risk Analysis"
              onAction={() =>
                navigate("/admin-risk-analysis")
              }
            />

            <div className="vendor-analytics-content">

              {/* LEFT SIDE - RISK BARS */}

              <div className="risk-section">
                <div className="risk-title">
                  Risk Distribution
                </div>

                <div className="risk-row">

                  <div className="risk-item">
                    <span className="risk-label">
                      Low Risk
                    </span>

                    <div className="risk-bar">
                      <div
                        className="risk-bar-fill risk-low"
                        style={{
                          width: `${
                            vendorAnalytics.scoredVendors
                              ? (vendorAnalytics.lowRisk /
                                  vendorAnalytics.scoredVendors) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <span className="risk-number">
                      {vendorAnalytics.lowRisk}
                    </span>
                  </div>

                  <div className="risk-item">
                    <span className="risk-label">
                      Medium Risk
                    </span>

                    <div className="risk-bar">
                      <div
                        className="risk-bar-fill risk-medium"
                        style={{
                          width: `${
                            vendorAnalytics.scoredVendors
                              ? (vendorAnalytics.mediumRisk /
                                  vendorAnalytics.scoredVendors) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <span className="risk-number">
                      {vendorAnalytics.mediumRisk}
                    </span>
                  </div>

                  <div className="risk-item">
                    <span className="risk-label">
                      High Risk
                    </span>

                    <div className="risk-bar">
                      <div
                        className="risk-bar-fill risk-high"
                        style={{
                          width: `${
                            vendorAnalytics.scoredVendors
                              ? (vendorAnalytics.highRisk /
                                  vendorAnalytics.scoredVendors) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <span className="risk-number">
                      {vendorAnalytics.highRisk}
                    </span>
                  </div>

                </div>
              </div>

              {/* RIGHT SIDE - CIRCLE */}

              <div className="analytics-score">
                <div className="score-circle">
                  <strong>
                    {vendorAnalytics.scoredVendors > 0
                      ? vendorAnalytics.averageReliability.toFixed(
                          1
                        )
                      : "N/A"}
                  </strong>

                  <span>AVG SCORE</span>
                </div>

                <div className="score-description">
                  <strong>
                    {vendorAnalytics.scoredVendors} vendors
                  </strong>{" "}
                  currently have reliability data.
                </div>
              </div>

            </div>
          </div>

          {/* ================= COMPLIANCE ================= */}

          <div className="dashboard-card">
            <SectionHeader
              title="Compliance Monitoring"
              subtitle="Current vendor approval and compliance status."
              action="Manage Compliance"
              onAction={() =>
                navigate("/admin-contract-compliance")
              }
            />

            <div className="compliance-list">

              <div className="compliance-row">
                <span>Approved Vendors</span>

                <span className="compliance-count">
                  {complianceSummary.approved}
                </span>
              </div>

              <div className="compliance-row">
                <span>Pending Review</span>

                <span className="status-badge status-warning">
                  {complianceSummary.pending}
                </span>
              </div>

              <div className="compliance-row">
                <span>Rejected</span>

                <span className="status-badge status-danger">
                  {complianceSummary.rejected}
                </span>
              </div>

              <div className="compliance-row">
                <span>Total Vendors</span>

                <span className="compliance-count">
                  {statistics.totalVendors}
                </span>
              </div>

            </div>
          </div>

        </div>

        {/* ================= VENDOR MANAGEMENT ================= */}

        <div
          className="dashboard-card"
          style={{ marginBottom: 20 }}
        >
          <SectionHeader
            title="Vendor Management"
            subtitle="Search and monitor registered vendors."
            action="View All Vendors"
            onAction={() => navigate("/admin-vendors")}
          />

          <div className="filter-row">
            <input
              className="search-input"
              type="text"
              placeholder="Search company, email or category..."
              value={vendorSearch}
              onChange={(e) =>
                setVendorSearch(e.target.value)
              }
            />

            <select
              className="filter-select"
              value={vendorFilter}
              onChange={(e) => {
                setVendorFilter(e.target.value);
                setShowAllVendors(true);
              }}
            >
              <option value="all">
                All Vendors
              </option>

              <option value="low">
                Low Risk
              </option>

              <option value="medium">
                Medium Risk
              </option>

              <option value="high">
                High Risk
              </option>
            </select>
          </div>

          {displayedVendors.length === 0 ? (
            <div className="empty-state">
              No vendors found.
            </div>
          ) : (
            <div className="vendor-list">
              {displayedVendors.map((vendor) => {
                const score =
                  vendor.reliability_score !== null &&
                  vendor.reliability_score !== undefined
                    ? Number(
                        vendor.reliability_score
                      )
                    : null;

                const risk =
                  score === null
                    ? "N/A"
                    : score >= 80
                    ? "Low"
                    : score >= 60
                    ? "Medium Risk"
                    : "High";

                return (
                  <div
                    className="vendor-row"
                    key={vendor.id}
                  >
                    <div>
                      <div className="vendor-name">
                        {vendor.company_name ||
                          "Unnamed Vendor"}
                      </div>

                      <div className="vendor-email">
                        {vendor.email ||
                          "No email"}
                      </div>
                    </div>

                    <div className="vendor-category">
                      {vendor.category || "—"}
                    </div>

                    <div>
                      {score === null ? (
                        <span className="reliability-value">
                          N/A
                        </span>
                      ) : (
                        <>
                          <div className="reliability-value">
                            {score.toFixed(1)}%
                          </div>

                          <div className="small-progress">
                            <ProgressBar
                              value={score}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <span
                        className={`status-badge ${
                          risk === "Low"
                            ? "status-success"
                            : risk === "Medium Risk"
                            ? "status-warning"
                            : risk === "High"
                            ? "status-danger"
                            : "status-neutral"
                        }`}
                      >
                        {risk}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredVendors.length > 6 && (
            <button
              type="button"
              className="section-action"
              style={{ marginTop: 15 }}
              onClick={() =>
                setShowAllVendors(
                  (value) => !value
                )
              }
            >
              {showAllVendors
                ? "Show Less"
                : "Show All Vendors"}{" "}
              →
            </button>
          )}
        </div>

        {/* ================= PROCUREMENT REPORTS ================= */}

        <div
          className="dashboard-card"
          style={{ marginBottom: 20 }}
        >
          <SectionHeader
            title="Procurement Reports"
            subtitle="Live purchase-order activity and procurement status."
            action="Open Reports"
            onAction={() =>
              navigate("/admin-reports")
            }
          />

          <div className="filter-row">
            <input
              className="search-input"
              type="text"
              placeholder="Search PO number, ID or vendor ID..."
              value={poSearch}
              onChange={(e) =>
                setPoSearch(e.target.value)
              }
            />

            <select
              className="filter-select"
              value={poFilter}
              onChange={(e) =>
                setPoFilter(e.target.value)
              }
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
          </div>

          <div className="table-wrapper">
            <table className="po-table">
              <thead>
                <tr>
                  <th>PO NUMBER</th>
                  <th>VENDOR ID</th>
                  <th>ORDER DATE</th>
                  <th>EXPECTED DELIVERY</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        No purchase orders found.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => (
                    <tr key={po.id}>
                      <td className="po-number">
                        {po.order_number ||
                          `PO-${po.id}`}
                      </td>

                      <td>
                        V-
                        {String(
                          po.vendor_id
                        ).padStart(4, "0")}
                      </td>

                      <td>
                        {formatDate(
                          po.order_date
                        )}
                      </td>

                      <td>
                        {formatDate(
                          po.expected_delivery_date
                        )}
                      </td>

                      <td>
                        {po.total_amount !== null &&
                        po.total_amount !== undefined
                          ? `₹${Number(
                              po.total_amount
                            ).toLocaleString(
                              "en-IN"
                            )}`
                          : "—"}
                      </td>

                      <td>
                        <span
                          className={`status-badge status-${getStatusClass(
                            po.status
                          )}`}
                        >
                          {po.status ||
                            "Unknown"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= SYSTEM STATISTICS + ACTIVITY ================= */}

        <div className="dashboard-grid">

          {/* SYSTEM STATISTICS */}

          <div className="dashboard-card">
            <SectionHeader
              title="System Statistics"
              subtitle="Current system-wide operational counts."
            />

            <div className="system-grid">

              <div className="system-box">
                <div className="system-box-label">
                  TOTAL USERS
                </div>

                <div className="system-box-value">
                  {statistics.totalUsers}
                </div>
              </div>

              <div className="system-box">
                <div className="system-box-label">
                  ACTIVE USERS
                </div>

                <div className="system-box-value">
                  {statistics.activeUsers}
                </div>
              </div>

              <div className="system-box">
                <div className="system-box-label">
                  TOTAL VENDORS
                </div>

                <div className="system-box-value">
                  {statistics.totalVendors}
                </div>
              </div>

              <div className="system-box">
                <div className="system-box-label">
                  TOTAL SUPPLIERS
                </div>

                <div className="system-box-value">
                  {statistics.totalSuppliers}
                </div>
              </div>

              <div className="system-box">
                <div className="system-box-label">
                  TOTAL POS
                </div>

                <div className="system-box-value">
                  {statistics.totalPOs}
                </div>
              </div>

              <div className="system-box">
                <div className="system-box-label">
                  APPROVED POS
                </div>

                <div className="system-box-value">
                  {statistics.approvedPOs}
                </div>
              </div>

              <div className="system-box">
                <div className="system-box-label">
                  DELIVERED POS
                </div>

                <div className="system-box-value">
                  {statistics.deliveredPOs}
                </div>
              </div>

              <div className="system-box">
                <div className="system-box-label">
                  CANCELLED POS
                </div>

                <div className="system-box-value">
                  {statistics.cancelledPOs}
                </div>
              </div>

            </div>
          </div>

          {/* RECENT ACTIVITY */}

          <div className="dashboard-card">
            <SectionHeader
              title="Recent Activity"
              subtitle="Latest users, vendors and procurement activity."
            />

            {recentActivity.length === 0 ? (
              <div className="empty-state">
                No recent activity available.
              </div>
            ) : (
              <div className="activity-list">
                {recentActivity.map(
                  (activity, index) => (
                    <div
                      className="activity-item"
                      key={`${activity.type}-${index}`}
                    >
                      <div className="activity-dot" />

                      <div>
                        <div className="activity-title">
                          {activity.title}
                        </div>

                        <div className="activity-date">
                          {formatDate(
                            activity.date
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}