import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileBarChart2,
  FileText,
  Home,
  Menu,
  MessageSquare,
  Package,
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

type NavGroup = {
  label: string;
  items: Item[];
};

const overviewItem: Item = {
  label: "Overview",
  route: "/dashboard",
  icon: Home,
};

const vendorsItem: Item = {
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
};

const contractsItem: Item = {
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
};

const groups: NavGroup[] = [
  {
    label: "Procurement",
    items: [
      {
        label: "Procurement Requests",
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
    ],
  },
  {
    label: "Risk",
    items: [
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
    ],
  },
  {
    label: "Finance",
    items: [
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
    ],
  },
  {
    label: "Insights",
    items: [
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
        label: "Audit",
        route: "/audit",
        icon: FileText,
        roles: ["administrator", "supply_chain_manager", "auditor"],
      },
    ],
  },
];

const allNavItems: Item[] = [
  overviewItem,
  vendorsItem,
  contractsItem,
  ...groups.flatMap((group) => group.items),
];

export default function Shell() {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const navRef = useRef<HTMLDivElement | null>(null);

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
        setOpenGroup(null);
        setAccountOpen(false);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenGroup(null);
        setAccountOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
    setAccountOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const pageTitle = useMemo(() => {
    const currentItem = allNavItems.find(
      (item) => item.route === location.pathname,
    );

    return currentItem?.label ?? "Overview";
  }, [location.pathname]);

  const displayRole =
    user?.role
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase()) ?? "Vendor";

  const initials = user?.name?.trim().charAt(0).toUpperCase() ?? "V";

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || hasRole(item.roles)),
    }))
    .filter((group) => group.items.length > 0);

  const canSeeOverview = !overviewItem.roles || hasRole(overviewItem.roles);
  const canSeeVendors = !vendorsItem.roles || hasRole(vendorsItem.roles);
  const canSeeContracts = !contractsItem.roles || hasRole(contractsItem.roles);

  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => location.pathname === item.route);

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
    navigate("/login", { replace: true });
  };

  const closeMenus = () => {
    setMobileOpen(false);
    setOpenGroup(null);
    setAccountOpen(false);
    setSearchOpen(false);
  };

  const renderNavLink = (item: Item, compact = false) => {
    const Icon = item.icon;

    return (
      <NavLink
        key={item.route}
        to={item.route}
        onClick={closeMenus}
        className={({ isActive }) =>
          `topnav-link ${isActive ? "active" : ""} ${compact ? "compact" : ""}`
        }
      >
        <Icon size={16} strokeWidth={1.8} />
        <span>{item.label}</span>
        {item.label === "Notifications" && unread > 0 && (
          <b className="topnav-count">{unread > 9 ? "9+" : unread}</b>
        )}
      </NavLink>
    );
  };

  return (
    <div className="topnav-app-shell">
      <header className="topnav-header" ref={navRef}>
        <div className="topnav-main-row">
          <NavLink
            to="/dashboard"
            className="topnav-brand"
            onClick={closeMenus}
          >
            <div className="topnav-brand-mark">
              <Sparkles size={17} />
            </div>
            <div className="topnav-brand-copy">
              <strong>
                Vendor<span>IQ</span>
              </strong>
              <small>Reliability intelligence</small>
            </div>
          </NavLink>

          <div className="topnav-desktop-links">
            {canSeeOverview && renderNavLink(overviewItem)}
            {canSeeVendors && renderNavLink(vendorsItem)}
            {canSeeContracts && renderNavLink(contractsItem)}

            {visibleGroups.map((group) => {
              const active = isGroupActive(group);
              const open = openGroup === group.label;

              return (
                <div className="topnav-dropdown" key={group.label}>
                  <button
                    type="button"
                    className={`topnav-group-button ${active ? "active" : ""} ${open ? "open" : ""}`}
                    onClick={() => {
                      setAccountOpen(false);
                      setOpenGroup((current) =>
                        current === group.label ? null : group.label,
                      );
                    }}
                    aria-expanded={open}
                    aria-haspopup="menu"
                  >
                    <span>{group.label}</span>
                    <ChevronDown size={14} />
                  </button>

                  {open && (
                    <div className="topnav-menu" role="menu">
                      <div className="topnav-menu-heading">{group.label}</div>
                      {group.items.map((item) => renderNavLink(item, true))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="topnav-actions">
            <div
              className={`global-search topnav-search ${searchOpen ? "open" : ""}`}
            >
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
              title="Notifications"
            >
              <Bell size={18} />
              {unread > 0 && <span className="bell-dot" />}
            </button>

            <div className="topnav-account-wrap">
              <button
                type="button"
                className={`topnav-account ${accountOpen ? "open" : ""}`}
                onClick={() => {
                  setOpenGroup(null);
                  setAccountOpen((value) => !value);
                }}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <div className="avatar">{initials}</div>
                <div className="profile-copy">
                  <strong>{user?.name}</strong>
                  <span>{displayRole}</span>
                </div>
                <ChevronDown size={14} />
              </button>

              {accountOpen && (
                <div className="topnav-account-menu" role="menu">
                  <div className="topnav-account-heading">
                    <div className="avatar">{initials}</div>
                    <div>
                      <strong>{user?.name}</strong>
                      <span>{displayRole}</span>
                    </div>
                  </div>
                  {renderNavLink(
                    {
                      label: "Profile & Settings",
                      route: "/settings",
                      icon: Settings,
                    },
                    true,
                  )}
                  <button
                    type="button"
                    className="topnav-account-action"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="icon-btn topnav-mobile-menu"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <div className="topnav-context-row">
          <div>
            <span>Operations control</span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="topnav-role-pill">
            <span className="live-dot" />
            <span>Control workspace</span>
            <span>·</span>
            <span>{displayRole}</span>
          </div>
        </div>

        {mobileOpen && (
          <div className="topnav-mobile-panel">
            <div className="topnav-mobile-heading">Workspace</div>
            <div className="topnav-mobile-links">
              {canSeeOverview && renderNavLink(overviewItem)}
              {canSeeVendors && renderNavLink(vendorsItem)}
              {canSeeContracts && renderNavLink(contractsItem)}
              {visibleGroups.map((group) => (
                <div className="topnav-mobile-group" key={group.label}>
                  <div className="topnav-mobile-group-title">{group.label}</div>
                  {group.items.map((item) => renderNavLink(item, true))}
                </div>
              ))}
              {renderNavLink(
                {
                  label: "Profile & Settings",
                  route: "/settings",
                  icon: Settings,
                },
                true,
              )}
            </div>
          </div>
        )}
      </header>

      <main
        className="topnav-content content"
        onClick={() => setSearchOpen(false)}
      >
        <Outlet />
      </main>
    </div>
  );
}
