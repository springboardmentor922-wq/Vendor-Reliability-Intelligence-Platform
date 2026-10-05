import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  FileBarChart2,
  FileText,
  Home,
  Menu,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  X,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { apiGet } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { SearchResult, Role } from "../lib/types";

type Item = {
  label: string;
  route: string;
  icon: LucideIcon;
  roles?: Role[];
};

const nav: Item[] = [
  {
    label: "Overview",
    route: "/dashboard",
    icon: Home,
  },
  {
    label: "Vendors",
    route: "/vendors",
    icon: Building2,
    roles: [
      "administrator",
      "procurement_manager",
      "supply_chain_manager",
      "vendor",
      "auditor",
    ],
  },
  {
    label: "Procurement",
    route: "/procurement",
    icon: ShoppingCart,
    roles: [
      "administrator",
      "procurement_manager",
      "supply_chain_manager",
      "auditor",
    ],
  },
  {
    label: "Purchase Orders",
    route: "/purchase-orders",
    icon: Package,
    roles: [
      "administrator",
      "procurement_manager",
      "supply_chain_manager",
      "vendor",
      "finance_officer",
      "auditor",
    ],
  },
  {
    label: "Performance",
    route: "/performance",
    icon: Activity,
    roles: [
      "administrator",
      "procurement_manager",
      "supply_chain_manager",
      "vendor",
      "auditor",
    ],
  },
  {
    label: "Reliability & Risk",
    route: "/reliability",
    icon: ShieldCheck,
    roles: [
      "administrator",
      "procurement_manager",
      "supply_chain_manager",
      "auditor",
    ],
  },
  {
    label: "Contracts & Compliance",
    route: "/contracts",
    icon: ClipboardCheck,
    roles: [
      "administrator",
      "procurement_manager",
      "supply_chain_manager",
      "vendor",
      "auditor",
    ],
  },
  {
    label: "Invoices",
    route: "/invoices",
    icon: Receipt,
    roles: [
      "administrator",
      "procurement_manager",
      "finance_officer",
      "vendor",
      "auditor",
    ],
  },
  {
    label: "Communications",
    route: "/communications",
    icon: MessageSquare,
    roles: [
      "administrator",
      "procurement_manager",
      "supply_chain_manager",
      "vendor",
      "auditor",
    ],
  },
  {
    label: "Notifications",
    route: "/notifications",
    icon: Bell,
  },
  {
    label: "Analytics",
    route: "/analytics",
    icon: BarChart3,
    roles: [
      "administrator",
      "procurement_manager",
      "supply_chain_manager",
      "auditor",
    ],
  },
  {
    label: "Reports",
    route: "/reports",
    icon: FileBarChart2,
    roles: [
      "administrator",
      "procurement_manager",
      "finance_officer",
      "auditor",
    ],
  },
  {
    label: "Audit",
    route: "/audit",
    icon: FileText,
    roles: ["administrator", "supply_chain_manager", "auditor"],
  },
];

const utilities: Item[] = [
  {
    label: "Profile & Settings",
    route: "/settings",
    icon: Settings,
  },
];

export default function Shell() {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;

    apiGet<{ count: number }>("/api/notifications/count/unread")
      .then((response) => {
        if (active) {
          setUnread(response.count ?? 0);
        }
      })
      .catch(() => {
        if (active) {
          setUnread(0);
        }
      });

    return () => {
      active = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const query = search.trim().toLowerCase();

      if (query.length < 2) {
        setResults([]);
        setSearchOpen(false);
        return;
      }

      try {
        const [vendors, orders, requests, contracts, invoices, messages] =
          await Promise.all([
            apiGet<any[]>("/vendors").catch(() => []),
            apiGet<any[]>("/purchase-orders").catch(() => []),
            apiGet<any[]>("/procurement-requests").catch(() => []),
            apiGet<any[]>("/contracts").catch(() => []),
            apiGet<any[]>("/api/invoices").catch(() => []),
            apiGet<any[]>("/api/communications").catch(() => []),
          ]);

        const matches: SearchResult[] = [];

        vendors.forEach((vendor) => {
          const haystack =
            `${vendor.company_name ?? ""} ${vendor.category ?? ""} ${vendor.email ?? ""}`.toLowerCase();

          if (haystack.includes(query)) {
            matches.push({
              type: "vendor",
              id: vendor.id,
              title: vendor.company_name ?? `Vendor #${vendor.id}`,
              subtitle: vendor.category ?? "Supplier",
            });
          }
        });

        orders.forEach((order) => {
          const haystack =
            `${order.po_number ?? ""} ${order.status ?? ""} ${order.vendor_id ?? ""}`.toLowerCase();

          if (haystack.includes(query)) {
            matches.push({
              type: "purchase_order",
              id: order.id,
              title: order.po_number ?? `PO #${order.id}`,
              subtitle: `${order.status ?? "Order"} · ₹${Number(
                order.total_amount ?? 0,
              ).toLocaleString("en-IN")}`,
            });
          }
        });

        requests.forEach((request) => {
          const haystack =
            `${request.description ?? ""} ${request.department ?? ""} ${request.status ?? ""}`.toLowerCase();

          if (haystack.includes(query)) {
            matches.push({
              type: "procurement_request",
              id: request.id,
              title: request.description ?? `Request #${request.id}`,
              subtitle: `${request.department ?? "Procurement"} · ${request.status ?? ""}`,
            });
          }
        });

        contracts.forEach((contract) => {
          const haystack =
            `${contract.contract_name ?? ""} ${contract.status ?? ""} ${contract.compliance_status ?? ""}`.toLowerCase();

          if (haystack.includes(query)) {
            matches.push({
              type: "contract",
              id: contract.id,
              title: contract.contract_name ?? `Contract #${contract.id}`,
              subtitle: `${contract.status ?? ""} · ${contract.compliance_status ?? ""}`,
            });
          }
        });

        invoices.forEach((invoice) => {
          const haystack =
            `${invoice.invoice_number ?? ""} ${invoice.po_number ?? ""} ${invoice.vendor_name ?? ""} ${invoice.status ?? ""}`.toLowerCase();

          if (haystack.includes(query)) {
            matches.push({
              type: "invoice",
              id: invoice.id,
              title: invoice.invoice_number ?? `Invoice #${invoice.id}`,
              subtitle: `${invoice.vendor_name ?? "Vendor"} · ${invoice.status ?? ""}`,
            });
          }
        });

        messages.forEach((message) => {
          const haystack =
            `${message.subject ?? ""} ${message.message ?? ""} ${message.vendor_name ?? ""}`.toLowerCase();

          if (haystack.includes(query)) {
            matches.push({
              type: "communication",
              id: message.id,
              title: message.subject ?? "Supplier message",
              subtitle: `${message.vendor_name ?? "Vendor"} · ${message.sender_name ?? ""}`,
            });
          }
        });

        setResults(matches.slice(0, 12));
        setSearchOpen(true);
      } catch {
        setResults([]);
        setSearchOpen(true);
      }
    }, 260);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();

        document.getElementById("global-search")?.focus();
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  const pageTitle = useMemo(() => {
    const currentItem = nav.find((item) => item.route === location.pathname);

    return currentItem?.label ?? "Overview";
  }, [location.pathname]);

  const displayRole =
    user?.role
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase()) ?? "Vendor";

  const initials = user?.name?.trim().charAt(0).toUpperCase() ?? "V";

  const clickNav = () => {
    setMobileOpen(false);
    setSearchOpen(false);
  };

  const linkItems = nav.filter((item) => !item.roles || hasRole(item.roles));

  const goToSearchResult = (result: SearchResult) => {
    const destination =
      result.type === "vendor"
        ? "/vendors"
        : result.type === "purchase_order"
          ? "/purchase-orders"
          : result.type === "procurement_request"
            ? "/procurement"
            : result.type === "contract"
              ? "/contracts"
              : result.type === "invoice"
                ? "/invoices"
                : result.type === "communication"
                  ? "/communications"
                  : "/dashboard";

    setSearch("");
    setSearchOpen(false);
    navigate(destination);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", {
      replace: true,
    });
  };

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={17} />
          </div>

          {!collapsed && (
            <div>
              <strong>
                Vendor<span>IQ</span>
              </strong>
              <small>Reliability intelligence</small>
            </div>
          )}

          {mobileOpen && (
            <button
              type="button"
              className="icon-btn mobile-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="workspace-pill">
            <span className="live-dot" />
            <span>Control workspace</span>
            <span>·</span>
            <span>{displayRole}</span>
          </div>
        )}

        <nav className="nav-section">
          <span className="nav-caption">{collapsed ? "•" : "WORKSPACE"}</span>

          {linkItems.map(({ label, route, icon: Icon }) => (
            <NavLink
              key={route}
              to={route}
              onClick={clickNav}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={1.8} />

              {!collapsed && <span>{label}</span>}

              {label === "Notifications" && unread > 0 && (
                <b className="nav-count">{unread > 9 ? "9+" : unread}</b>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="nav-spacer" />

        <nav className="nav-section">
          <span className="nav-caption">{collapsed ? "•" : "ACCOUNT"}</span>

          {utilities.map(({ label, route, icon: Icon }) => (
            <NavLink
              key={route}
              to={route}
              onClick={clickNav}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={1.8} />

              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && (
            <div className="security-line">
              <span className="secure-dot" />
              <span>Encrypted session</span>
            </div>
          )}

          <button
            type="button"
            className="nav-item logout-link"
            onClick={handleLogout}
          >
            <LogOut size={18} strokeWidth={1.8} />

            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />
      )}

      <div className="shell-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <button
            type="button"
            className="icon-btn desktop-collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
          </button>

          <div className="topbar-context">
            <span>Operations control</span>
            <strong>{pageTitle}</strong>
          </div>

          <div className="topbar-actions">
            <div className={`global-search ${searchOpen ? "open" : ""}`}>
              <Search size={17} />

              <input
                id="global-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onFocus={() => {
                  if (search.trim().length > 1) {
                    setSearchOpen(true);
                  }
                }}
                placeholder="Search vendors, POs, contracts…"
                aria-label="Global search"
              />

              <kbd>⌘ K</kbd>

              {searchOpen && (
                <div
                  className="search-popover"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  {results.length > 0 ? (
                    results.map((result, index) => (
                      <button
                        type="button"
                        key={`${result.type}-${result.id ?? index}`}
                        onClick={() => goToSearchResult(result)}
                      >
                        <span className="search-type">
                          {result.type.replaceAll("_", " ")}
                        </span>

                        <strong>{result.title}</strong>

                        <small>{result.subtitle}</small>
                      </button>
                    ))
                  ) : (
                    <div className="search-empty">
                      <Search size={16} />
                      <span>No matching records.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="icon-btn bell-btn"
              onClick={() => navigate("/notifications")}
              aria-label="Notifications"
            >
              <Bell size={19} />

              {unread > 0 && <span className="bell-dot" />}
            </button>

            <div className="profile-chip">
              <div className="avatar">{initials}</div>

              <div className="profile-copy">
                <strong>{user?.name}</strong>

                <span>{displayRole}</span>
              </div>

              <button
                type="button"
                className="icon-btn profile-logout"
                onClick={handleLogout}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main className="content" onClick={() => setSearchOpen(false)}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
