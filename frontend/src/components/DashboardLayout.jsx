import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

const DashboardLayoutContext =
  createContext(null);

function DashboardLayout({
  children,
  title = "",
  role = "",
  menuItems = [],
}) {
  const navigate = useNavigate();
  const location = useLocation();

  /*
   * Check whether another DashboardLayout
   * is already active.
   */
  const parentLayout = useContext(
    DashboardLayoutContext
  );

  /* ================= ROUTES ================= */

  const routeMap = {
    Administrator: {
      Dashboard: "/admin-dashboard",
      Users: "/admin-users",
      Vendors: "/admin-vendors",
      Suppliers: "/admin-suppliers",
      Procurement: "/admin-procurement",
      "Purchase Orders":
        "/admin-purchase-orders",
      "Risk Analysis":
        "/admin-risk-analysis",
      "Contract & Compliance":
        "/admin-contract-compliance",
      Reports: "/admin-reports",
      Settings: "/admin-settings",
      Notifications:
        "/admin-notifications",
    },

    "Procurement Manager": {
      Dashboard:
        "/procurement-dashboard",
      Vendors: "/vendor-portal",
      Requests: "/procurement-requests",
      "Purchase Orders":
        "/procurement-purchase-orders",
      Approvals:
        "/procurement-approvals",
      Performance:
        "/procurement-performance",
      Reports:
        "/procurement-reports",
      Notifications:
        "/procurement-notifications",
    },

    "Supply Chain Manager": {
      Dashboard:
        "/supply-chain-dashboard",
      Suppliers:
        "/supply-chain-suppliers",
      "Purchase Orders":
        "/supply-chain-purchase-orders",
      Deliveries:
        "/supply-chain-deliveries",
      "Delayed Deliveries":
        "/supply-chain-delayed-deliveries",
      Performance:
        "/supply-chain-performance",
      Risk: "/supply-chain-risk",
    },

    Vendor: {
      Dashboard: "/vendor-dashboard",
      Profile: "/vendor-profile",
      "Purchase Orders":
        "/vendor-purchase-orders",
      Deliveries:
        "/vendor-deliveries",
      "Delayed Deliveries":
        "/vendor-delayed-deliveries",
      Performance:
        "/vendor-performance",
      "Risk Status":
        "/vendor-risk-status",
      Contracts: "/vendor-contracts",
      Compliance: "/vendor-compliance",
      Communications:
        "/vendor-communications",
      Notifications:
        "/vendor-notifications",
    },

    "Finance Officer": {
      Dashboard: "/finance-dashboard",
      "Purchase Orders":
        "/finance-purchase-orders",
      Invoices: "/finance-invoices",
      Payments: "/finance-payments",
      Status: "/finance-status",
      Reports: "/finance-reports",
      Notifications:
        "/finance-notifications",
    },

    Auditor: {
      Dashboard: "/auditor-dashboard",
      Records: "/auditor-records",
      Vendors: "/auditor-vendors",
      Procurement:
        "/auditor-procurement",
      "Risk Assessments":
        "/auditor-risk-assessments",
      Performance:
        "/auditor-performance",
      Reports: "/auditor-reports",
    },
  };

  /* ================= ICONS ================= */

  const icons = {
    Dashboard: "🏠",
    Users: "👥",
    Vendors: "🏢",
    Suppliers: "📦",
    Procurement: "🛒",
    Requests: "📝",
    "Purchase Orders": "📋",
    Approvals: "✅",
    Deliveries: "🚚",
    "Delayed Deliveries": "⏰",
    Performance: "📊",
    Reports: "📄",
    Notifications: "🔔",
    Settings: "⚙️",
    "Risk Analysis": "⚠️",
    Risk: "⚠️",
    Profile: "👤",
    "Risk Status": "🛡️",
    "Contract & Compliance": "📑",
    Communications: "💬",
    Invoices: "🧾",
    Payments: "💳",
    Status: "📌",
    Records: "🗂️",
    "Risk Assessments": "🔍",
  };

  const currentRoutes =
    routeMap[role] || {};

  /* ================= PAGE TITLE ================= */

  const getTitleFromRoute = () => {
    if (title) {
      return title;
    }

    if (
      location.pathname ===
      currentRoutes.Dashboard
    ) {
      return `${role} Dashboard`;
    }

    for (const [
      menuName,
      route,
    ] of Object.entries(currentRoutes)) {
      if (
        location.pathname === route ||
        location.pathname.startsWith(
          `${route}/`
        )
      ) {
        return menuName;
      }
    }

    return `${role} Dashboard`;
  };

  const [pageTitle, setPageTitle] =
    useState(
      title || `${role} Dashboard`
    );

  /* ================= UPDATE TITLE ================= */

  useEffect(() => {
    if (!parentLayout) {
      setPageTitle(
        getTitleFromRoute()
      );
    }
  }, [
    location.pathname,
    role,
    title,
    parentLayout,
  ]);

  useEffect(() => {
    if (
      parentLayout &&
      title
    ) {
      parentLayout.setPageTitle(title);
    }
  }, [parentLayout, title]);

  /*
   * Existing pages can still use DashboardLayout.
   * If a parent layout exists, don't create another
   * sidebar.
   */

  if (parentLayout) {
    return <>{children}</>;
  }

  /* ================= NAVIGATION ================= */

  const handleNavigation = (item) => {
    const route =
      currentRoutes[item];

    if (route) {
      navigate(route);
    }
  };

  /* ================= LOGOUT ================= */

  const handleLogout = () => {
    localStorage.removeItem(
      "access_token"
    );

    sessionStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem("token");
    sessionStorage.removeItem("token");

    localStorage.removeItem("user");
    sessionStorage.removeItem("user");

    navigate("/login");
  };

  return (
    <DashboardLayoutContext.Provider
      value={{ setPageTitle }}
    >
      <div style={styles.page}>

        {/* ================= SIDEBAR ================= */}

        <aside style={styles.sidebar}>

          {/* LOGO */}

          <div style={styles.logoSection}>
            <div style={styles.logoIcon}>
              V
            </div>

            <div>
              <h2 style={styles.logoText}>
                VRIPRM
              </h2>

              <p
                style={
                  styles.logoSubText
                }
              >
                Procurement Intelligence
              </p>
            </div>
          </div>

          {/* CURRENT ROLE */}

          <div style={styles.roleBox}>
            <div style={styles.roleIcon}>
              👤
            </div>

            <div>
              <p
                style={
                  styles.roleLabel
                }
              >
                CURRENT ROLE
              </p>

              <p
                style={
                  styles.roleName
                }
              >
                {role}
              </p>
            </div>
          </div>

          {/* NAVIGATION */}

          <nav style={styles.navigation}>
            {menuItems.map((item) => {
              const route =
                currentRoutes[item];

              const isActive =
                route &&
                (
                  location.pathname ===
                    route ||
                  location.pathname.startsWith(
                    `${route}/`
                  )
                );

              return (
                <button
                  key={item}
                  onClick={() =>
                    handleNavigation(item)
                  }
                  style={{
                    ...styles.menuItem,

                    ...(isActive
                      ? styles.activeMenuItem
                      : {}),
                  }}
                >
                  <span
                    style={
                      styles.menuIcon
                    }
                  >
                    {icons[item] || "•"}
                  </span>

                  <span>
                    {item}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* LOGOUT */}

          <div
            style={
              styles.sidebarBottom
            }
          >
            <button
              onClick={handleLogout}
              style={
                styles.logoutButton
              }
            >
              <span
                style={
                  styles.menuIcon
                }
              >
                🚪
              </span>

              Logout
            </button>
          </div>
        </aside>

        {/* ================= MAIN AREA ================= */}

        <main style={styles.main}>

          {/* HEADER */}

          <header
            style={
              styles.topHeader
            }
          >
            <div>
              <h1
                style={
                  styles.pageTitle
                }
              >
                {pageTitle}
              </h1>

              <p
                style={
                  styles.pageSubtitle
                }
              >
                Vendor Reliability
                Intelligence &
                Procurement Risk
                Management
              </p>
            </div>

            <div
              style={
                styles.headerRight
              }
            >
              <button
                style={
                  styles.notificationButton
                }
                onClick={() => {
                  const notificationRoute =
                    currentRoutes[
                      "Notifications"
                    ];

                  if (
                    notificationRoute
                  ) {
                    navigate(
                      notificationRoute
                    );
                  }
                }}
              >
                🔔
              </button>

              <div
                style={
                  styles.profileCircle
                }
              >
                {role
                  ? role
                      .charAt(0)
                      .toUpperCase()
                  : "U"}
              </div>
            </div>
          </header>

          {/* PAGE CONTENT */}

          <section
            style={styles.content}
          >
            {children}
          </section>

        </main>
      </div>
    </DashboardLayoutContext.Provider>
  );
}

/* =========================
   STYLES
========================= */

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    background: "#f5f7fb",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  sidebar: {
    width: "255px",
    minHeight: "100vh",
    background: "#111827",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    left: 0,
    top: 0,
    bottom: 0,
    overflowY: "auto",
    zIndex: 100,
  },

  logoSection: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "24px 20px",
    borderBottom:
      "1px solid rgba(255,255,255,0.08)",
  },

  logoIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "11px",
    background: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
    fontWeight: "800",
  },

  logoText: {
    margin: 0,
    fontSize: "21px",
    fontWeight: "800",
    letterSpacing: "0.5px",
  },

  logoSubText: {
    margin: "3px 0 0",
    fontSize: "10px",
    color: "#9ca3af",
  },

  roleBox: {
    margin: "18px 14px",
    padding: "13px",
    borderRadius: "10px",
    background:
      "rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  roleIcon: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    background: "#1f2937",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  roleLabel: {
    margin: 0,
    fontSize: "9px",
    color: "#9ca3af",
    letterSpacing: "0.8px",
  },

  roleName: {
    margin: "3px 0 0",
    fontSize: "12px",
    fontWeight: "600",
  },

  navigation: {
    padding: "5px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  menuItem: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#cbd5e1",
    padding: "11px 13px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "14px",
    transition:
      "all 0.2s ease",
  },

  activeMenuItem: {
    background: "#2563eb",
    color: "#fff",
    fontWeight: "600",
  },

  menuIcon: {
    width: "22px",
    textAlign: "center",
    fontSize: "16px",
  },

  sidebarBottom: {
    marginTop: "auto",
    padding: "15px 12px",
    borderTop:
      "1px solid rgba(255,255,255,0.08)",
  },

  logoutButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#fca5a5",
    padding: "11px 13px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    fontSize: "14px",
    textAlign: "left",
  },

  main: {
    marginLeft: "255px",
    width:
      "calc(100% - 255px)",
    minHeight: "100vh",
  },

  topHeader: {
    height: "82px",
    background: "#fff",
    borderBottom:
      "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    padding: "0 30px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },

  pageTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "700",
    color: "#111827",
  },

  pageSubtitle: {
    margin: "5px 0 0",
    fontSize: "12px",
    color: "#6b7280",
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
  },

  notificationButton: {
    width: "38px",
    height: "38px",
    borderRadius: "9px",
    border:
      "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: "17px",
  },

  profileCircle: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    background: "#2563eb",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
  },

  content: {
    padding: "28px 30px",
  },
};

export default DashboardLayout;