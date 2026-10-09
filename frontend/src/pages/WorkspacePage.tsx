import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  FileBarChart2,
  FileCheck2,
  FileText,
  Filter,
  Flag,
  Gauge,
  Mail,
  MessageSquare,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import KpiCard from "../components/KpiCard";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import {
  apiDelete,
  apiDownload,
  apiGet,
  apiPost,
  apiPostForm,
  apiPut,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { DATACO_SUMMARY } from "../data/dataco-summary";

export const pageRoles: Record<string, string[] | undefined> = {
  dashboard: undefined,
  vendors: [
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
    "vendor",
    "auditor",
  ],
  procurement: [
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
    "auditor",
  ],
  "purchase-orders": [
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
    "vendor",
    "finance_officer",
    "auditor",
  ],
  performance: [
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
    "vendor",
    "auditor",
  ],
  reliability: [
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
    "auditor",
  ],
  contracts: [
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
    "vendor",
    "auditor",
  ],
  invoices: [
    "administrator",
    "procurement_manager",
    "finance_officer",
    "vendor",
    "auditor",
  ],
  communications: [
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
    "vendor",
    "auditor",
  ],
  notifications: undefined,
  analytics: [
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
    "auditor",
  ],
  reports: [
    "administrator",
    "procurement_manager",
    "finance_officer",
    "auditor",
  ],
  audit: ["administrator", "supply_chain_manager", "auditor"],
  settings: undefined,
};

const workspaceCache = new Map<string, { data: any; updatedAt: number }>();
const WORKSPACE_CACHE_TTL = 90_000;

const meta: Record<string, { eyebrow: string; title: string; desc: string }> = {
  dashboard: {
    eyebrow: "CONTROL TOWER",
    title: "Operational overview",
    desc: "A calm, decision-ready view of supplier health, buying flow and financial exposure.",
  },
  vendors: {
    eyebrow: "SUPPLIER MASTER",
    title: "Vendors",
    desc: "Manage supplier onboarding, approvals, contacts and the evidence behind them.",
  },
  procurement: {
    eyebrow: "BUYING WORKFLOW",
    title: "Procurement requests",
    desc: "Turn internal demand into governed, traceable purchasing decisions.",
  },
  "purchase-orders": {
    eyebrow: "ORDER CONTROL",
    title: "Purchase orders",
    desc: "Track every order from approval through delivery and completion.",
  },
  performance: {
    eyebrow: "SERVICE QUALITY",
    title: "Vendor performance",
    desc: "Capture current operational scorecards and understand where service is drifting.",
  },
  reliability: {
    eyebrow: "RISK INTELLIGENCE",
    title: "Reliability & risk",
    desc: "Explore transparent historical supplier-proxy intelligence and risk signals.",
  },
  contracts: {
    eyebrow: "GOVERNANCE",
    title: "Contracts & compliance",
    desc: "Keep renewals, documentation and compliance exposure visible.",
  },
  invoices: {
    eyebrow: "FINANCE CONTROL",
    title: "Invoices",
    desc: "Connect invoices to purchase orders and keep payment state reviewable.",
  },
  communications: {
    eyebrow: "RELATIONSHIP WORKSPACE",
    title: "Communications",
    desc: "Keep supplier conversations structured, searchable and contextual.",
  },
  notifications: {
    eyebrow: "ALERT CENTER",
    title: "Notifications",
    desc: "Review operational alerts and close the loop on items needing attention.",
  },
  analytics: {
    eyebrow: "INTELLIGENCE",
    title: "Analytics",
    desc: "Compare trends across procurement, suppliers, risk and spend.",
  },
  reports: {
    eyebrow: "REPORTING",
    title: "Reports & exports",
    desc: "Generate live reports from the current database state.",
  },
  audit: {
    eyebrow: "GOVERNANCE TRACE",
    title: "Audit trail",
    desc: "Review who changed what, when, and on which business object.",
  },
  settings: {
    eyebrow: "ACCOUNT",
    title: "Profile & settings",
    desc: "Manage your profile and account-level preferences.",
  },
};

const rolesByName: Record<string, string> = {
  administrator: "Administrator",
  procurement_manager: "Procurement Manager",
  supply_chain_manager: "Supply Chain Manager",
  vendor: "Vendor",
  finance_officer: "Finance Officer",
  auditor: "Auditor",
};

const money = (value: any) =>
  Number(value ?? 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
const number = (value: any) => Number(value ?? 0).toLocaleString("en-IN");
const date = (value: any) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const titleize = (value: string) =>
  String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

function normalizeMonthlyRows(rows: any[]) {
  const fallbackByMonth = new Map(
    DATACO_SUMMARY.monthly.map((item: any) => [item.month_key, item]),
  );

  return rows.map((row: any) => {
    const monthKey = String(
      row.month_key ?? row.period ?? row.month ?? "",
    ).slice(0, 7);
    const fallback = fallbackByMonth.get(monthKey);

    const rawUniqueOrders = Number(
      row.unique_orders ?? row.order_count ?? row.orders,
    );
    const fallbackOrders = Number(fallback?.orders ?? 0);

    // Older API payloads used COUNT(*) for `orders`, which is actually the
    // number of order-item rows. Prefer true unique-order counts when
    // available; otherwise repair the legacy payload using the verified
    // month-level summary shipped with this frontend.
    const orders =
      Number.isFinite(Number(row.unique_orders)) ||
      Number.isFinite(Number(row.order_count))
        ? rawUniqueOrders
        : rawUniqueOrders > 3000 && fallback
          ? fallbackOrders
          : rawUniqueOrders;

    const monthLabel =
      row.month_label ??
      fallback?.month_label ??
      (monthKey ? `${monthKey.slice(5, 7)}/${monthKey.slice(0, 4)}` : "");

    return {
      ...row,
      month_key: monthKey,
      month_label: monthLabel,
      orders,
    };
  });
}

function normalizeAnalytics(raw: any, procurement?: any) {
  const local = DATACO_SUMMARY;
  const historical = raw?.historical ?? {};
  const choose = (apiValue: any, fallback: any) =>
    Array.isArray(apiValue)
      ? apiValue.length
        ? apiValue
        : fallback
      : (apiValue ?? fallback);

  const monthlyRows = choose(historical.monthly, local.monthly);

  return {
    ...(raw ?? {}),
    historical: {
      ...historical,
      monthly: normalizeMonthlyRows(monthlyRows),
      risk_distribution: choose(
        historical.risk_distribution,
        local.risk_distribution,
      ),
      category_spend: choose(historical.category_spend, local.category_spend),
      delivery_status: choose(
        historical.delivery_status,
        local.delivery_status,
      ),
      order_status: choose(historical.order_status, local.order_status),
      top_suppliers: choose(historical.top_suppliers, local.top_suppliers),
      supplier_comparison: choose(
        historical.supplier_comparison,
        local.supplier_comparison,
      ),
      supplier_count: Number(
        historical.supplier_count ?? local.supplier_proxies,
      ),
      avg_reliability: Number(
        historical.avg_reliability ?? local.avg_reliability,
      ),
      total_sales: Number(historical.total_sales ?? local.total_sales),
      unique_orders: Number(
        historical.total_orders ??
          historical.unique_orders ??
          local.unique_orders,
      ),
      total_items: Number(historical.total_items ?? local.total_items),
      overall_on_time_rate: Number(
        historical.overall_on_time_rate ?? local.overall_on_time_rate,
      ),
    },
    current: raw?.current ??
      raw?.operational ?? {
        spend: procurement?.spend ?? 0,
        purchase_orders: procurement?.purchase_orders ?? 0,
      },
  };
}

export default function WorkspacePage({ page }: { page: string }) {
  const { user, hasRole } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const canManage = hasRole([
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
  ]);
  const canFinance = hasRole(["administrator", "finance_officer"]);
  const canApprove = hasRole([
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
  ]);

  const action = useMemo(() => {
    if (page === "vendors" && canManage)
      return { label: "Add vendor", type: "vendor" as const };
    if (page === "procurement" && canManage)
      return { label: "New request", type: "request" as const };
    if (page === "purchase-orders" && canManage)
      return { label: "New purchase order", type: "po" as const };
    if (page === "performance" && canManage)
      return { label: "Record scorecard", type: "performance" as const };
    if (page === "contracts" && canManage)
      return { label: "New contract", type: "contract" as const };
    if (page === "invoices" && canFinance)
      return { label: "Record invoice", type: "invoice" as const };
    if (page === "communications")
      return { label: "New message", type: "message" as const };
    return undefined;
  }, [page, canManage, canFinance]);

  const pageMeta = meta[page] ?? meta.dashboard;

  return (
    <div className="workspace">
      <PageHeader
        eyebrow={pageMeta.eyebrow}
        title={pageMeta.title}
        description={pageMeta.desc}
        onRefresh={() => setRefreshKey((v) => v + 1)}
        action={
          action ? (
            <ActionButton
              label={action.label}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("vendoriq:modal", { detail: action.type }),
                )
              }
            />
          ) : null
        }
      />
      <WorkspaceBody
        key={refreshKey}
        page={page}
        canManage={canManage}
        canApprove={canApprove}
        canFinance={canFinance}
        user={user}
      />
    </div>
  );
}

function ActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="button primary" onClick={onClick}>
      <Plus size={15} />
      {label}
    </button>
  );
}

function WorkspaceBody({
  page,
  canManage,
  canApprove,
  canFinance,
  user,
}: {
  page: string;
  canManage: boolean;
  canApprove: boolean;
  canFinance: boolean;
  user: any;
}) {
  const [modal, setModal] = useState<{ type: ModalType; item?: any } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [activeThread, setActiveThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const cached = workspaceCache.get(page);

    if (cached) {
      setData(cached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      let next: any = {};
      switch (page) {
        case "dashboard": {
          // Render the operational shell immediately. Historical analytics can be
          // refreshed in the background because the local DataCo summary provides
          // a complete, truthful fallback while the heavier aggregation runs.
          const [summary, procurement, apiRanking] = await Promise.all([
            apiGet("/dashboard/summary"),
            apiGet("/api/analytics/procurement"),
            apiGet("/api/suppliers/ranking", { limit: 6 }),
          ]);

          const ranking =
            Array.isArray(apiRanking) && apiRanking.length
              ? apiRanking
              : DATACO_SUMMARY.top_suppliers;

          const preliminary = {
            summary,
            analytics: normalizeAnalytics({}, procurement),
            procurement,
            ranking,
          };

          workspaceCache.set(page, {
            data: preliminary,
            updatedAt: Date.now(),
          });
          setData(preliminary);
          setLoading(false);

          try {
            const rawAnalytics = await apiGet("/api/analytics/dashboard");
            const analytics = normalizeAnalytics(rawAnalytics, procurement);
            const finalData = { ...preliminary, analytics };
            workspaceCache.set(page, {
              data: finalData,
              updatedAt: Date.now(),
            });
            setData(finalData);
          } catch {
            // The DataCo fallback remains visible if the historical aggregation fails.
          }
          return;
        }
        case "vendors":
          next = {
            vendors: await apiGet("/vendors"),
            documents: await apiGet("/api/files").catch(() => []),
          };
          break;
        case "procurement": {
          const [requests, vendors, orders] = await Promise.all([
            apiGet("/procurement-requests"),
            apiGet("/vendors"),
            apiGet("/purchase-orders"),
          ]);
          next = { requests, vendors, orders };
          break;
        }
        case "purchase-orders": {
          const [orders, vendors] = await Promise.all([
            apiGet("/purchase-orders"),
            apiGet("/vendors"),
          ]);
          next = { orders, vendors };
          break;
        }
        case "performance": {
          const [performance, vendors] = await Promise.all([
            apiGet("/vendor-performance"),
            apiGet("/vendors"),
          ]);
          next = { performance, vendors };
          break;
        }
        case "reliability":
          next = {
            ranking: await apiGet("/api/suppliers/ranking", { limit: 100 }),
          };
          break;
        case "contracts": {
          const [contracts, compliance, expiring, vendors] = await Promise.all([
            apiGet("/contracts"),
            apiGet("/contracts/compliance"),
            apiGet("/contracts/expiring", { days: 90 }),
            apiGet("/vendors"),
          ]);
          next = { contracts, compliance, expiring, vendors };
          break;
        }
        case "invoices": {
          const [invoices, summary, orders] = await Promise.all([
            apiGet("/api/invoices"),
            apiGet("/api/invoices/summary"),
            apiGet("/purchase-orders"),
          ]);
          next = { invoices, summary, orders };
          break;
        }
        case "communications": {
          const [threads, communicationVendors] = await Promise.all([
            apiGet("/api/communications/threads"),
            apiGet("/vendors"),
          ]);
          next = { threads, vendors: communicationVendors };
          break;
        }
        case "notifications":
          next = { notifications: await apiGet("/api/notifications") };
          break;
        case "analytics": {
          const [rawAnalytics, procurement] = await Promise.all([
            apiGet("/api/analytics/dashboard"),
            apiGet("/api/analytics/procurement"),
          ]);
          next = { analytics: normalizeAnalytics(rawAnalytics, procurement) };
          break;
        }
        case "reports":
          next = {
            reports: [
              [
                "vendor-performance",
                "Vendor performance",
                "Scorecards, reliability and current supplier health",
              ],
              [
                "suppliers",
                "Supplier intelligence",
                "Historical supplier-proxy performance",
              ],
              ["procurement", "Procurement", "Requests and historical spend"],
              [
                "purchase-orders",
                "Purchase orders",
                "PO lifecycle and financial exposure",
              ],
              [
                "compliance",
                "Compliance",
                "Contract compliance and governance exposure",
              ],
              [
                "contracts",
                "Contracts",
                "Agreement register and renewal context",
              ],
            ],
          };
          break;
        case "audit": {
          const [logs, summary] = await Promise.all([
            apiGet("/api/audit-logs"),
            apiGet("/api/audit-logs/summary"),
          ]);
          next = { logs, summary };
          break;
        }
        case "settings": {
          const users =
            user?.role === "administrator"
              ? await apiGet("/users").catch(() => [])
              : [];
          next = { users };
          break;
        }
      }
      workspaceCache.set(page, { data: next, updatedAt: Date.now() });
      setData(next);
    } catch (e: any) {
      // Keep a usable cached view when a background refresh fails.
      if (!cached) {
        setError(e?.detail || e?.message || "Unable to load this workspace.");
      }
    } finally {
      if (!cached) setLoading(false);
    }
  }, [page, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<ModalType>;
      setModal({ type: custom.detail });
    };
    window.addEventListener("vendoriq:modal", handler);
    return () => window.removeEventListener("vendoriq:modal", handler);
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const closeModal = () => {
    setModal(null);
    setSelectedFile(null);
  };

  const vendors = (data.vendors ?? []) as any[];
  const orders = (data.orders ?? []) as any[];

  const doAction = async (
    path: string,
    method: "put" | "post" | "delete",
    body?: any,
    message = "Saved",
  ) => {
    try {
      if (method === "put") await apiPut(path, body);
      else if (method === "delete") await apiDelete(path);
      else await apiPost(path, body ?? {});
      notify(message);
      closeModal();
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || "Action failed.");
    }
  };

  const markRead = async (notification: any) => {
    try {
      await apiPut(`/api/notifications/${notification.id}/read`);
      notification.is_read = true;
      setData((v: any) => ({ ...v, notifications: [...v.notifications] }));
    } catch (e: any) {
      setError(e?.message);
    }
  };

  const filtered = <T extends Record<string, any>>(rows: T[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row).some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  };

  if (loading)
    return (
      <div className="loading-card">
        <div className="loader-ring" />
        <span>Refreshing live data…</span>
      </div>
    );

  return (
    <>
      {error && (
        <div className="inline-alert">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}

      {page === "dashboard" && (
        <DashboardView
          summary={data.summary}
          analytics={data.analytics}
          procurement={data.procurement}
          ranking={data.ranking ?? []}
        />
      )}
      {page === "vendors" && (
        <VendorsView
          data={filtered(vendors)}
          documents={data.documents ?? []}
          search={search}
          setSearch={setSearch}
          canManage={canManage}
          onOpen={(item: any) => setModal({ type: "vendor", item })}
          onDelete={(item: any) =>
            doAction(
              `/vendors/${item.id}`,
              "delete",
              undefined,
              "Vendor removed",
            )
          }
          onStatus={(item: any, status: string) =>
            doAction(
              `/vendors/${item.id}`,
              "put",
              { ...item, status },
              `Vendor ${status.toLowerCase()}`,
            )
          }
          onUpload={(item: any) => setModal({ type: "document", item })}
        />
      )}
      {page === "procurement" && (
        <ProcurementView
          requests={filtered(data.requests ?? [])}
          search={search}
          setSearch={setSearch}
          vendors={vendors}
          canManage={canManage}
          onOpen={() => setModal({ type: "request" })}
          onStatus={(r: any, status: string) =>
            doAction(
              `/procurement-requests/${r.id}`,
              "put",
              { status },
              `Request ${status.toLowerCase()}`,
            )
          }
        />
      )}
      {page === "purchase-orders" && (
        <OrdersView
          orders={filtered(orders)}
          vendors={vendors}
          search={search}
          setSearch={setSearch}
          canManage={canManage}
          user={user}
          onOpen={() => setModal({ type: "po" })}
          onStatus={(o: any, status: string) =>
            doAction(
              `/purchase-orders/${o.id}/status`,
              "put",
              { status },
              `PO ${status.toLowerCase()}`,
            )
          }
        />
      )}
      {page === "performance" && (
        <PerformanceView
          rows={data.performance ?? []}
          vendors={vendors}
          search={search}
          setSearch={setSearch}
          canManage={canManage}
          onOpen={() => setModal({ type: "performance" })}
        />
      )}
      {page === "reliability" && (
        <ReliabilityView
          rows={filtered(data.ranking ?? [])}
          search={search}
          setSearch={setSearch}
          onSelect={async (row: any) => {
            try {
              setSelectedSupplier(
                await apiGet(
                  `/api/suppliers/${encodeURIComponent(row.product_card_id)}`,
                ),
              );
            } catch (e: any) {
              setError(e?.message);
            }
          }}
          selected={selectedSupplier}
        />
      )}
      {page === "contracts" && (
        <ContractsView
          contracts={data.contracts ?? []}
          summary={data.compliance}
          search={search}
          setSearch={setSearch}
          canManage={canManage}
          onOpen={(item: any) => setModal({ type: "contract", item })}
          onDelete={(c: any) =>
            doAction(
              `/contracts/${c.id}`,
              "delete",
              undefined,
              "Contract deleted",
            )
          }
        />
      )}
      {page === "invoices" && (
        <InvoicesView
          invoices={filtered(data.invoices ?? [])}
          orders={orders}
          summary={data.summary}
          search={search}
          setSearch={setSearch}
          canFinance={canFinance}
          onOpen={() => setModal({ type: "invoice" })}
          onStatus={(i: any, status: string) =>
            doAction(
              `/api/invoices/${i.id}/status`,
              "put",
              { status },
              `Invoice ${status.toLowerCase()}`,
            )
          }
        />
      )}
      {page === "communications" && (
        <CommunicationsView
          threads={data.threads ?? []}
          active={activeThread}
          messages={messages}
          vendors={data.vendors ?? vendors}
          onNew={() => setModal({ type: "message" })}
          onOpen={async (thread: any) => {
            setActiveThread(thread);
            try {
              setMessages(
                await apiGet("/api/communications", {
                  vendor_id: thread.vendor_id,
                  limit: 100,
                }),
              );
            } catch (e: any) {
              setError(e?.message);
            }
          }}
          onReply={async (thread: any, message: string) => {
            try {
              await apiPost("/api/communications", {
                vendor_id: thread.vendor_id,
                subject: thread.subject || "General Inquiry",
                message,
              });
              setMessages(
                await apiGet("/api/communications", {
                  vendor_id: thread.vendor_id,
                  limit: 100,
                }),
              );
              notify("Reply sent");
            } catch (e: any) {
              setError(e?.message || "Reply failed.");
            }
          }}
        />
      )}
      {page === "notifications" && (
        <NotificationsView
          rows={data.notifications ?? []}
          canApprove={canApprove}
          onMark={markRead}
          onGenerate={async () => {
            await doAction(
              "/api/notifications/generate",
              "post",
              {},
              "Alert scan completed",
            );
          }}
        />
      )}
      {page === "analytics" && (
        <AnalyticsView analytics={data.analytics ?? {}} />
      )}
      {page === "reports" && (
        <ReportsView
          reports={data.reports ?? []}
          preview={preview}
          onPreview={async (type: string) => {
            try {
              setPreview(
                await apiGet(`/api/reports/${type}/preview`, { limit: 12 }),
              );
            } catch (e: any) {
              setError(e?.message);
            }
          }}
          onDownload={(type: string, format: string) =>
            apiDownload(`/api/reports/${type}/${format}`)
              .then(() => notify("Export generated"))
              .catch((e) => setError(e?.message))
          }
        />
      )}
      {page === "audit" && (
        <AuditView
          logs={data.logs ?? []}
          summary={data.summary ?? {}}
          search={search}
          setSearch={setSearch}
        />
      )}
      {page === "settings" && (
        <SettingsView
          user={user}
          users={data.users ?? []}
          onSave={async (name: string) => {
            try {
              await apiPut("/users/me", { name });
              notify("Profile updated");
            } catch (e: any) {
              setError(e?.message);
            }
          }}
        />
      )}

      {modal?.type === "vendor" && (
        <VendorModal
          item={modal.item}
          canManage={canManage}
          onClose={closeModal}
          onSave={(payload: any) =>
            doAction("/vendors", "post", payload, "Vendor created")
          }
        />
      )}
      {modal?.type === "request" && (
        <RequestModal
          onClose={closeModal}
          onSave={(payload: any) =>
            doAction(
              "/procurement-requests",
              "post",
              payload,
              "Request submitted",
            )
          }
        />
      )}
      {modal?.type === "po" && (
        <PoModal
          vendors={vendors}
          onClose={closeModal}
          onSave={(payload: any) =>
            doAction(
              "/purchase-orders",
              "post",
              payload,
              "Purchase order created",
            )
          }
        />
      )}
      {modal?.type === "performance" && (
        <PerformanceModal
          vendors={vendors}
          onClose={closeModal}
          onSave={(payload: any) =>
            doAction(
              "/vendor-performance",
              "post",
              payload,
              "Scorecard recorded",
            )
          }
        />
      )}
      {modal?.type === "contract" && (
        <ContractModal
          vendors={vendors}
          item={modal.item}
          onClose={closeModal}
          onSave={(payload: any) =>
            doAction(
              modal.item ? `/contracts/${modal.item.id}` : "/contracts",
              modal.item ? "put" : "post",
              payload,
              modal.item ? "Contract updated" : "Contract created",
            )
          }
        />
      )}
      {modal?.type === "invoice" && (
        <InvoiceModal
          orders={orders}
          vendors={vendors}
          onClose={closeModal}
          onSave={(payload: any) =>
            doAction("/api/invoices", "post", payload, "Invoice recorded")
          }
        />
      )}
      {modal?.type === "message" && (
        <MessageModal
          vendors={vendors}
          onClose={closeModal}
          onSave={(payload: any) =>
            doAction("/api/communications", "post", payload, "Message sent")
          }
        />
      )}
      {modal?.type === "document" && (
        <DocumentModal
          item={modal.item}
          file={selectedFile}
          setFile={setSelectedFile}
          onClose={closeModal}
          onSave={async () => {
            if (!selectedFile || !modal.item?.id) return;
            try {
              const form = new FormData();
              form.append("file", selectedFile);
              await apiPostForm(
                `/api/files/upload?vendor_id=${modal.item.id}&document_type=vendor_document`,
                form,
              );
              notify("Document uploaded");
              closeModal();
              await load();
            } catch (e: any) {
              setError(e?.message);
            }
          }}
        />
      )}
    </>
  );
}

type ModalType =
  | "vendor"
  | "request"
  | "po"
  | "performance"
  | "contract"
  | "invoice"
  | "message"
  | "document";

function DashboardView({ summary, analytics, procurement, ranking }: any) {
  const historical = analytics?.historical ?? {};
  const monthly = normalizeMonthlyRows(
    historical.monthly ?? DATACO_SUMMARY.monthly,
  );
  const orderAxisMax = Math.max(
    500,
    Math.ceil(
      Math.max(...monthly.map((item: any) => Number(item.orders ?? 0)), 0) /
        500,
    ) * 500,
  );
  const risk = historical.risk_distribution ?? DATACO_SUMMARY.risk_distribution;
  const delivery = historical.delivery_status ?? DATACO_SUMMARY.delivery_status;
  const orderStatus = historical.order_status ?? DATACO_SUMMARY.order_status;
  const categorySpend =
    historical.category_spend ?? DATACO_SUMMARY.category_spend;
  const topSuppliers = ranking?.length
    ? ranking
    : (historical.top_suppliers ?? DATACO_SUMMARY.top_suppliers);
  const comparison =
    historical.supplier_comparison ?? DATACO_SUMMARY.supplier_comparison;

  const deliveryTotal = delivery.reduce(
    (sum: number, item: any) => sum + Number(item.count ?? 0),
    0,
  );
  const onTimeCount = delivery
    .filter((item: any) =>
      /advance shipping|shipping on time/i.test(String(item.name)),
    )
    .reduce((sum: number, item: any) => sum + Number(item.count ?? 0), 0);
  const deliveryShare = deliveryTotal
    ? Math.round((onTimeCount / deliveryTotal) * 100)
    : 0;

  const pieColors = [
    "#6C7BC1",
    "#D2B15D",
    "#5A9276",
    "#C66B67",
    "#8FA2C1",
    "#B18CC7",
  ];
  const riskColors: Record<string, string> = {
    Low: "#5A9276",
    Medium: "#D2B15D",
    High: "#D48D45",
    Critical: "#C66B67",
  };

  return (
    <div className="page-stack dashboard-page">
      <div className="hero-signal">
        <div>
          <span className="eyebrow light">LIVE OPERATIONS</span>
          <h2>Good morning, your supplier signal is ready.</h2>
          <p>
            Operational procurement records and historical supply-chain
            intelligence are presented together without losing their source
            context.
          </p>
        </div>
        <div className="signal-state">
          <span className="live-dot" /> Data synced
        </div>
      </div>

      <div className="kpi-grid dashboard-kpis">
        <KpiCard
          label="Active vendors"
          value={number(summary?.total_vendors)}
          detail="Supplier master"
          icon={Building2}
          trend="Live"
        />
        <KpiCard
          label="Purchase orders"
          value={number(summary?.total_purchase_orders)}
          detail={`${number(summary?.total_procurement_requests)} procurement requests`}
          icon={PackageCheck}
          trend="Operational"
        />
        <KpiCard
          label="Operational spend"
          value={money(summary?.total_spend)}
          detail="Current PO commitments"
          icon={Wallet}
          trend="Live"
        />
        <KpiCard
          label="Historical reliability"
          value={`${Number(historical.avg_reliability ?? DATACO_SUMMARY.avg_reliability).toFixed(1)} /100`}
          detail="118 product-level proxies"
          icon={Gauge}
          trend={`${Number(historical.overall_on_time_rate ?? DATACO_SUMMARY.overall_on_time_rate).toFixed(1)}% on-time`}
        />
      </div>

      <div className="dashboard-chart-grid primary-charts">
        <Panel
          title="Procurement overview"
          subtitle="Sales and order volume by month."
          tag="Supply-chain data"
          className="chart-panel chart-panel-large"
        >
          <ChartBox height={330}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthly}
                margin={{ top: 10, right: 16, left: 4, bottom: 28 }}
              >
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7282C5" stopOpacity={0.27} />
                    <stop
                      offset="100%"
                      stopColor="#7282C5"
                      stopOpacity={0.03}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis
                  dataKey="month_label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                  interval={2}
                  height={28}
                  tickFormatter={(label) => String(label)}
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#7E899A" }}
                  tickFormatter={(v) => `₹${(v / 1000000).toFixed(1)}M`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, orderAxisMax]}
                  tickCount={6}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#7E899A" }}
                />
                <Tooltip
                  formatter={(value: any, name: any) =>
                    name === "sales"
                      ? [money(value), "Sales"]
                      : [number(value), "Orders"]
                  }
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={32}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "#697588" }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="sales"
                  name="Sales"
                  fill="url(#salesFill)"
                  stroke="#6C7BC1"
                  radius={[5, 5, 0, 0]}
                  barSize={18}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="orders"
                  name="Orders"
                  stroke="#D08C49"
                  strokeWidth={2.6}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>

        <Panel
          title="Delivery status"
          subtitle="Historical fulfillment mix."
          className="chart-panel"
        >
          <ChartBox height={330}>
            <div className="donut-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={delivery}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={72}
                    outerRadius={104}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {delivery.map((item: any, index: number) => (
                      <Cell
                        key={item.name}
                        fill={pieColors[index % pieColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      number(value),
                      String(name),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <strong>{deliveryShare}%</strong>
                <span>on-time / early</span>
              </div>
            </div>
            <div className="legend-list">
              {delivery.map((item: any, index: number) => (
                <div key={item.name} className="legend-row">
                  <span
                    className="legend-dot"
                    style={{ background: pieColors[index % pieColors.length] }}
                  />
                  <span>{item.name}</span>
                  <strong>
                    {Math.round(
                      (Number(item.count) / Math.max(1, deliveryTotal)) * 100,
                    )}
                    %
                  </strong>
                </div>
              ))}
            </div>
          </ChartBox>
        </Panel>
      </div>

      <div className="dashboard-chart-grid secondary-charts">
        <Panel
          title="Reliability trend"
          subtitle="Average historical supplier-proxy reliability context."
          className="chart-panel"
        >
          <ChartBox height={285}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthly}
                margin={{ top: 10, right: 14, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5A9276" stopOpacity={0.25} />
                    <stop
                      offset="100%"
                      stopColor="#5A9276"
                      stopOpacity={0.03}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis
                  dataKey="month_label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                  interval={3}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                />
                <Tooltip
                  formatter={(value: any) => [
                    `${Number(value).toFixed(1)}%`,
                    "On-time rate",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="on_time_rate"
                  stroke="#5A9276"
                  strokeWidth={2.5}
                  fill="url(#trendFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>

        <Panel
          title="Risk distribution"
          subtitle="Historical supplier-proxy risk levels."
        >
          <ChartBox height={285}>
            <div className="dashboard-risk-layout">
              <div className="dashboard-risk-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={risk}
                      dataKey="count"
                      nameKey="risk_level"
                      innerRadius={62}
                      outerRadius={91}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {risk.map((item: any) => (
                        <Cell
                          key={item.risk_level}
                          fill={
                            riskColors[String(item.risk_level)] ?? "#8392AA"
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        number(value),
                        String(name),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <strong>
                    {number(
                      risk.reduce(
                        (s: number, item: any) => s + Number(item.count ?? 0),
                        0,
                      ),
                    )}
                  </strong>
                  <span>historical records</span>
                </div>
              </div>
              <div className="dashboard-risk-breakdown">
                {risk.map((item: any) => {
                  const total = risk.reduce(
                    (s: number, x: any) => s + Number(x.count ?? 0),
                    0,
                  );
                  const count = Number(item.count ?? 0);
                  const pct = total ? Math.round((count / total) * 100) : 0;
                  return (
                    <div className="dashboard-risk-row" key={item.risk_level}>
                      <span
                        className="risk-swatch"
                        style={{
                          background:
                            riskColors[String(item.risk_level)] ?? "#8392AA",
                        }}
                      />
                      <span>{item.risk_level}</span>
                      <strong>{pct}%</strong>
                      <small>{number(count)}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          </ChartBox>
        </Panel>

        <Panel
          title="Spend by category"
          subtitle="Top historical categories by sales."
        >
          <ChartBox height={285}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categorySpend}
                layout="vertical"
                margin={{ left: 8, right: 12 }}
              >
                <CartesianGrid stroke="#edf0f4" horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                  tickFormatter={(v) => `₹${(v / 1000000).toFixed(1)}M`}
                />
                <YAxis
                  dataKey="category_name"
                  type="category"
                  width={118}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#647084" }}
                />
                <Tooltip formatter={(value: any) => [money(value), "Sales"]} />
                <Bar
                  dataKey="sales"
                  fill="#C49D55"
                  radius={[0, 5, 5, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>

        <Panel title="Order lifecycle" subtitle="Historical order-status mix.">
          <ChartBox height={285}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={orderStatus.slice(0, 7)}
                margin={{ top: 8, right: 16, left: 2, bottom: 32 }}
              >
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  angle={-26}
                  textAnchor="end"
                  interval={0}
                  height={52}
                  tick={{ fontSize: 9, fill: "#7E899A" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                />
                <Tooltip
                  formatter={(value: any) => [number(value), "Records"]}
                />
                <Bar
                  dataKey="count"
                  fill="#6879BD"
                  radius={[5, 5, 0, 0]}
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>
      </div>

      <div className="dashboard-bottom-grid">
        <Panel
          title="Supplier performance"
          subtitle="Top historical supplier proxies by reliability score."
          action={
            <a className="text-link" href="/reliability">
              View all <ChevronRight size={13} />
            </a>
          }
        >
          <div className="supplier-bars">
            {comparison.slice(0, 6).map((row: any) => (
              <div className="supplier-bar-row" key={row.name}>
                <div className="supplier-bar-label">
                  <span>{row.name}</span>
                  <strong>{Number(row.reliability).toFixed(0)}</strong>
                </div>
                <div className="supplier-bar-track">
                  <i
                    style={{
                      width: `${Math.max(4, Math.min(100, Number(row.reliability)))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Approval backlog" subtitle="Current procurement flow.">
          <div className="big-metric large">
            {number(procurement?.approval_backlog ?? 0)}
            <span>pending approvals</span>
          </div>
          <div className="mini-metrics">
            <Metric label="Requests" value={number(procurement?.requests)} />
            <Metric
              label="Orders"
              value={number(procurement?.purchase_orders)}
            />
            <Metric label="Spend" value={money(procurement?.spend)} />
          </div>
          <div className="dashboard-source-note">
            Historical charts use the bundled DataCo summary when the API
            dataset tables are not populated yet.
          </div>
        </Panel>
      </div>
    </div>
  );
}

function VendorsView({
  data,
  documents,
  search,
  setSearch,
  canManage,
  onOpen,
  onDelete,
  onStatus,
  onUpload,
}: any) {
  return (
    <div className="page-stack">
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search supplier, category, email…"
        count={`${data.length} vendors`}
      />
      <Panel>
        <Table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Category</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Added</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((v: any) => (
              <tr key={v.id}>
                <td>
                  <Entity
                    name={v.company_name}
                    meta={`#${v.id} · ${v.category ?? "Uncategorized"}`}
                    icon={<Building2 size={16} />}
                  />
                </td>
                <td>{v.category ?? "—"}</td>
                <td>
                  <div className="cell-stack">
                    <span>{v.email || "—"}</span>
                    <small>{v.phone || v.address || ""}</small>
                  </div>
                </td>
                <td>
                  <StatusBadge value={v.status} />
                </td>
                <td>{date(v.created_at)}</td>
                <td>
                  <RowActions>
                    <button onClick={() => onOpen(v)}>Details</button>
                    {canManage && v.status !== "Approved" && (
                      <button onClick={() => onStatus(v, "Approved")}>
                        Approve
                      </button>
                    )}
                    {canManage && (
                      <button onClick={() => onUpload(v)}>Document</button>
                    )}
                    {canManage && (
                      <button
                        className="danger-text"
                        onClick={() => onDelete(v)}
                      >
                        Delete
                      </button>
                    )}
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!data.length && (
          <EmptyState
            title="No vendors found"
            text="Try a different search or add a supplier."
          />
        )}
      </Panel>
      {documents?.length > 0 && (
        <Panel
          title="Vendor evidence"
          subtitle="Uploaded supplier documentation."
        >
          <div className="document-grid">
            {documents.slice(0, 8).map((d: any) => (
              <div className="doc-card" key={d.id}>
                <FileCheck2 size={17} />
                <div>
                  <strong>{d.original_name}</strong>
                  <small>Vendor document · {date(d.created_at)}</small>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function ProcurementView({
  requests,
  search,
  setSearch,
  onOpen,
  onStatus,
  canManage,
}: any) {
  return (
    <div className="page-stack">
      <div className="stat-strip">
        <StripStat
          icon={Archive}
          label="Open"
          value={requests.filter((r: any) => r.status === "Pending").length}
        />
        <StripStat
          icon={Check}
          label="Approved"
          value={requests.filter((r: any) => r.status === "Approved").length}
        />
        <StripStat
          icon={Archive}
          label="Completed"
          value={requests.filter((r: any) => r.status === "Completed").length}
        />
        <StripStat
          icon={Wallet}
          label="Planned budget"
          value={money(
            requests.reduce(
              (s: number, r: any) => s + Number(r.estimated_budget ?? 0),
              0,
            ),
          )}
        />
      </div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search request, department, status…"
        count={`${requests.length} requests`}
        action={
          canManage ? (
            <button className="button primary" onClick={onOpen}>
              <Plus size={15} /> New request
            </button>
          ) : undefined
        }
      />
      <Panel
        title="Procurement requests"
        subtitle="Every state change is recorded in the audit trail."
      >
        <Table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Department</th>
              <th>Required</th>
              <th>Qty</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {requests.map((r: any) => (
              <tr key={r.id}>
                <td>
                  <Entity
                    name={r.description}
                    meta={`Request #${r.id}`}
                    icon={<Archive size={16} />}
                  />
                </td>
                <td>{r.department || "—"}</td>
                <td>{date(r.required_date)}</td>
                <td>{number(r.quantity)}</td>
                <td>
                  <StatusBadge value={r.status} />
                </td>
                <td>
                  <RowActions>
                    {canManage && r.status === "Pending" && (
                      <button onClick={() => onStatus(r, "Approved")}>
                        Approve
                      </button>
                    )}
                    {canManage && r.status === "Approved" && (
                      <button onClick={() => onStatus(r, "Completed")}>
                        Complete
                      </button>
                    )}
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!requests.length && <EmptyState title="No procurement requests" />}
      </Panel>
    </div>
  );
}

function OrdersView({
  orders,
  vendors,
  search,
  setSearch,
  onOpen,
  onStatus,
  canManage,
  user,
}: any) {
  const statuses = [
    "Pending",
    "Approved",
    "Ordered",
    "Delivered",
    "Completed",
    "Cancelled",
  ];
  return (
    <div className="page-stack">
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search PO number, vendor, status…"
        count={`${orders.length} orders`}
        action={
          canManage ? (
            <button className="button primary" onClick={onOpen}>
              <Plus size={15} /> New purchase order
            </button>
          ) : undefined
        }
      />
      <Panel>
        <Table>
          <thead>
            <tr>
              <th>PO</th>
              <th>Vendor</th>
              <th>Delivery</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((o: any) => (
              <tr key={o.id}>
                <td>
                  <Entity
                    name={o.po_number || `PO #${o.id}`}
                    meta={`Created ${date(o.created_at)}`}
                    icon={<PackageCheck size={16} />}
                  />
                </td>
                <td>{vendorName(vendors, o.vendor_id)}</td>
                <td>{date(o.expected_delivery)}</td>
                <td>
                  <strong>{money(o.total_amount)}</strong>
                </td>
                <td>{o.payment_terms || "—"}</td>
                <td>
                  <StatusBadge value={o.status} />
                </td>
                <td>
                  <RowActions>
                    {canManage && o.status === "Pending" && (
                      <button onClick={() => onStatus(o, "Approved")}>
                        Approve
                      </button>
                    )}
                    {canManage && o.status === "Approved" && (
                      <button onClick={() => onStatus(o, "Ordered")}>
                        Mark ordered
                      </button>
                    )}
                    {user?.role === "vendor" && o.status === "Ordered" && (
                      <button onClick={() => onStatus(o, "Delivered")}>
                        Mark delivered
                      </button>
                    )}
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!orders.length && (
          <EmptyState
            title="No purchase orders"
            text="Create an order once a procurement request is ready."
          />
        )}
      </Panel>
    </div>
  );
}

function PerformanceView({
  rows,
  vendors,
  search,
  setSearch,
  onOpen,
  canManage,
}: any) {
  const enriched = rows.map((row: any) => ({
    ...row,
    vendor_name: vendorName(vendors, row.vendor_id),
  }));
  return (
    <div className="page-stack">
      <div className="insight-banner">
        <div>
          <span className="eyebrow">CURRENT SCORECARDS</span>
          <h3>Operational performance without spreadsheet drift.</h3>
          <p>
            Each scorecard contributes to the vendor's current reliability
            signal.
          </p>
        </div>
        <div className="mini-legend">
          <span>
            <i className="dot success" />
            Healthy
          </span>
          <span>
            <i className="dot warning" />
            Watch
          </span>
          <span>
            <i className="dot danger" />
            Risk
          </span>
        </div>
      </div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search supplier or risk…"
        count={`${enriched.length} scorecards`}
        action={
          canManage ? (
            <button className="button primary" onClick={onOpen}>
              <Plus size={15} /> Record scorecard
            </button>
          ) : undefined
        }
      />
      <Panel>
        <Table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Delivery</th>
              <th>Quality</th>
              <th>Cost</th>
              <th>Reliability</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {enriched
              .filter((r: any) =>
                [r.vendor_name, r.risk_level]
                  .join(" ")
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <Entity
                      name={r.vendor_name}
                      meta={`Vendor #${r.vendor_id}`}
                      icon={<Activity size={16} />}
                    />
                  </td>
                  <td>
                    <Score score={r.delivery_score} />
                  </td>
                  <td>
                    <Score score={r.quality_score} />
                  </td>
                  <td>
                    <Score score={r.cost_score} />
                  </td>
                  <td>
                    <Score score={r.reliability_score} prominent />
                  </td>
                  <td>
                    <StatusBadge value={r.risk_level} />
                  </td>
                </tr>
              ))}
          </tbody>
        </Table>
        {!enriched.length && (
          <EmptyState
            title="No scorecards yet"
            text="Add a scorecard to start tracking current vendor performance."
          />
        )}
      </Panel>
    </div>
  );
}

function ReliabilityView({ rows, search, setSearch, onSelect, selected }: any) {
  return (
    <div className="page-stack">
      <div className="intelligence-hero">
        <div className="intelligence-icon">
          <Sparkles size={20} />
        </div>
        <div>
          <span className="eyebrow">DATA PROVENANCE</span>
          <h3>Historical supplier-proxy intelligence</h3>
          <p>
            DataCo records do not contain vendor identities. VendorIQ keeps this
            intelligence visibly separate from operational supplier records.
          </p>
        </div>
      </div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search supplier proxy…"
        count={`${rows.length} historical rows`}
      />
      <div className="two-column-main">
        <Panel>
          <Table compact>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Supplier proxy</th>
                <th>Orders</th>
                <th>Reliability</th>
                <th>Risk</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={`${r.product_card_id}-${r.rank}`}>
                  <td>
                    <span className="rank-index">{r.rank}</span>
                  </td>
                  <td>
                    <Entity
                      name={r.product_name}
                      meta={r.category_name}
                      icon={<Sparkles size={15} />}
                    />
                  </td>
                  <td>{number(r.order_count)}</td>
                  <td>
                    <Score score={r.reliability_score} prominent />
                  </td>
                  <td>
                    <StatusBadge value={r.risk_level} />
                  </td>
                  <td>
                    <button className="table-link" onClick={() => onSelect(r)}>
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!rows.length && <EmptyState title="No historical intelligence" />}
        </Panel>
        {selected && (
          <Panel title="Reliability scorecard" subtitle={selected.provenance}>
            <div className="score-hero">
              <div className="score-ring">
                {Number(selected.reliability_score ?? 0).toFixed(0)}
              </div>
              <div>
                <span>Reliability</span>
                <strong>{selected.risk_level}</strong>
                <small>Data-driven historical proxy</small>
              </div>
            </div>
            <div className="factor-list">
              <Factor
                label="Delivery history"
                value={selected.delivery_score ?? selected.on_time_rate}
              />
              <Factor
                label="Product quality"
                value={selected.quality_score ?? 0}
              />
              <Factor
                label="Cancellation control"
                value={
                  selected.cancel_rate != null
                    ? 100 - Number(selected.cancel_rate)
                    : 0
                }
                inverse
              />
              <Factor
                label="Purchase history"
                value={
                  selected.order_count != null
                    ? Math.min(100, Number(selected.order_count))
                    : 0
                }
              />
              <Factor label="Punctuality" value={selected.on_time_rate} />
            </div>
            <div className="recommendation">
              <ShieldCheck size={16} />
              <div>
                <strong>Decision cue</strong>
                <p>
                  {selected.risk_level === "Low"
                    ? "Stable historical pattern. Continue reviewing operational data before sourcing decisions."
                    : selected.risk_level === "Medium"
                      ? "Mixed historical pattern. Add context from current scorecards, contracts and issue history."
                      : "Higher historical exposure. Review current delivery, quality and contract evidence before reliance."}
                </p>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function ContractsView({
  contracts,
  summary,
  search,
  setSearch,
  onOpen,
  onDelete,
  canManage,
}: any) {
  const filtered = contracts.filter((contract: any) => {
    const haystack = [
      contract.contract_name,
      contract.compliance_status,
      contract.status,
      contract.contract_reference,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const compliantCount = Array.isArray(summary?.summary)
    ? (summary.summary.find((item: any) => item.status === "Compliant")
        ?.count ?? 0)
    : 0;

  const expiringCount = contracts.filter((contract: any) => {
    const days = contract.days_left;
    return days != null && days >= 0 && days <= 90;
  }).length;

  return (
    <div className="page-stack">
      <div className="stat-strip">
        <StripStat
          icon={FileText}
          label="Agreements"
          value={contracts.length}
        />
        <StripStat
          icon={ShieldCheck}
          label="Compliant"
          value={compliantCount}
        />
        <StripStat icon={Clock3} label="Expiring 90d" value={expiringCount} />
      </div>

      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search contract, compliance or status…"
        count={`${filtered.length} agreements`}
        action={
          canManage ? (
            <button className="button primary" onClick={onOpen}>
              <Plus size={15} /> New contract
            </button>
          ) : undefined
        }
      />

      <Panel>
        <Table>
          <thead>
            <tr>
              <th>Agreement</th>
              <th>Vendor</th>
              <th>End date</th>
              <th>Days left</th>
              <th>Compliance</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {filtered.map((contract: any) => {
              const reference =
                contract.contract_reference ?? `CTR-${contract.id}`;

              const nearExpiry =
                contract.days_left != null && contract.days_left <= 30;

              return (
                <tr key={contract.id}>
                  <td>
                    <Entity
                      name={contract.contract_name}
                      meta={`Ref ${reference}`}
                      icon={<FileText size={16} />}
                    />
                  </td>

                  <td>Vendor #{contract.vendor_id}</td>

                  <td>{date(contract.end_date)}</td>

                  <td>
                    <strong className={nearExpiry ? "danger-text" : ""}>
                      {contract.days_left ?? "—"}
                    </strong>
                  </td>

                  <td>
                    <StatusBadge value={contract.compliance_status} />
                  </td>

                  <td>
                    <StatusBadge value={contract.status} />
                  </td>

                  <td>
                    <RowActions>
                      {canManage && (
                        <button onClick={() => onOpen(contract)}>Edit</button>
                      )}

                      {canManage && (
                        <button
                          className="danger-text"
                          onClick={() => onDelete(contract)}
                        >
                          Delete
                        </button>
                      )}
                    </RowActions>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>

        {!filtered.length && <EmptyState title="No contracts found" />}
      </Panel>
    </div>
  );
}

function InvoicesView({
  invoices,
  orders,
  summary,
  search,
  setSearch,
  onOpen,
  onStatus,
  canFinance,
}: any) {
  return (
    <div className="page-stack">
      <div className="stat-strip">
        <StripStat
          icon={ReceiptIcon}
          label="Total"
          value={summary?.total ?? invoices.length}
        />
        <StripStat
          icon={Clock3}
          label="Pending"
          value={summary?.pending ?? 0}
        />
        <StripStat icon={Check} label="Paid" value={summary?.paid ?? 0} />
        <StripStat
          icon={ShieldAlert}
          label="Overdue"
          value={summary?.overdue ?? 0}
        />
      </div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search invoice, PO, vendor or status…"
        count={`${invoices.length} invoices`}
        action={
          canFinance ? (
            <button className="button primary" onClick={onOpen}>
              <Plus size={15} /> Record invoice
            </button>
          ) : undefined
        }
      />
      <Panel>
        <Table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>PO</th>
              <th>Vendor</th>
              <th>Total</th>
              <th>Due</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.map((i: any) => (
              <tr key={i.id}>
                <td>
                  <Entity
                    name={i.invoice_number}
                    meta={`Created ${date(i.created_at)}`}
                    icon={<ReceiptIcon size={16} />}
                  />
                </td>
                <td>{i.po_number || `PO #${i.purchase_order_id}`}</td>
                <td>{i.vendor_name || `Vendor #${i.vendor_id}`}</td>
                <td>
                  <strong>{money(i.total)}</strong>
                </td>
                <td>{date(i.due_date)}</td>
                <td>
                  <StatusBadge value={i.status} />
                </td>
                <td>
                  <RowActions>
                    {canFinance && i.status === "Pending" && (
                      <button onClick={() => onStatus(i, "Paid")}>
                        Mark paid
                      </button>
                    )}
                    {canFinance && i.status !== "Cancelled" && (
                      <button onClick={() => onStatus(i, "Cancelled")}>
                        Cancel
                      </button>
                    )}
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!invoices.length && (
          <EmptyState
            title="No invoices found"
            text={
              orders.length
                ? "Invoices can be linked to existing purchase orders."
                : "Create a purchase order before recording an invoice."
            }
          />
        )}
      </Panel>
    </div>
  );
}

function CommunicationsView({
  threads,
  active,
  messages,
  vendors,
  onOpen,
  onReply,
}: any) {
  const [reply, setReply] = useState("");

  const visibleThreads = useMemo(() => {
    if (threads.length) return threads;
    return vendors.map((vendor: any) => ({
      thread_id: `vendor-${vendor.id}`,
      vendor_id: vendor.id,
      vendor_name: vendor.company_name,
      subject: "Start a conversation",
      last_message: "No messages yet",
      message_count: 0,
      is_virtual: true,
    }));
  }, [threads, vendors]);

  return (
    <div className="page-stack">
      <div className="comm-layout">
        <Panel
          title="Supplier threads"
          subtitle={
            threads.length
              ? "Structured relationship history."
              : "Choose a supplier to start or review a conversation."
          }
          className="thread-panel"
        >
          <div className="thread-list">
            {visibleThreads.map((t: any) => (
              <button
                key={t.thread_id}
                className={`thread-item ${active?.vendor_id === t.vendor_id ? "active" : ""}`}
                onClick={() => onOpen(t)}
              >
                <div className="thread-avatar">
                  {String(t.vendor_name ?? "V")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div>
                  <strong>{t.subject || "General inquiry"}</strong>
                  <small>{t.vendor_name ?? `Vendor #${t.vendor_id}`}</small>
                  <em>
                    {t.message_count
                      ? `${t.message_count} message${t.message_count === 1 ? "" : "s"}`
                      : "No messages yet"}
                  </em>
                </div>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          {!visibleThreads.length && (
            <EmptyState
              title="No suppliers available"
              text="Create a vendor first, then start a supplier conversation here."
            />
          )}
        </Panel>

        <Panel
          title={active?.subject || "Conversation"}
          subtitle={active ? active.vendor_name : "Select a supplier"}
          className="conversation-panel"
        >
          {active ? (
            <>
              <div className="conversation-context-strip">
                <div>
                  <span className="eyebrow">SUPPLIER CHANNEL</span>
                  <strong>{active.vendor_name}</strong>
                </div>
                <span className="conversation-count">
                  {messages.length} message{messages.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="conversation-history">
                {messages.length ? (
                  messages.map((m: any) => (
                    <div
                      className={`message-bubble ${m.sender_role === "vendor" ? "vendor" : "internal"}`}
                      key={m.id}
                    >
                      <div className="message-meta">
                        <strong>{m.sender_name || "VendorIQ user"}</strong>
                        <span>{date(m.created_at)}</span>
                      </div>
                      <p>{m.message}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No messages yet"
                    text="Start the relationship record by sending the first message below."
                  />
                )}
              </div>

              <div className="reply-box">
                <textarea
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write a response…"
                />
                <button
                  className="button primary"
                  disabled={!reply.trim()}
                  onClick={async () => {
                    const text = reply.trim();
                    if (!text) return;
                    await onReply(active, text);
                    setReply("");
                  }}
                >
                  Send reply <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <EmptyState
              title="Select a supplier"
              text="Choose a supplier on the left to view or start its conversation history."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function NotificationsView({ rows, onMark, onGenerate, canApprove }: any) {
  return (
    <div className="page-stack">
      <div className="toolbar simple">
        <div />
        <div className="page-actions">
          <button
            className="button ghost"
            onClick={async () => {
              try {
                await apiPut("/api/notifications/read-all");
                rows.forEach((r: any) => (r.is_read = true));
                window.location.reload();
              } catch {
                /* handled by parent load on next navigation */
              }
            }}
          >
            Mark all read
          </button>
          {canApprove && (
            <button className="button primary" onClick={onGenerate}>
              <Sparkles size={15} /> Run alert scan
            </button>
          )}
        </div>
      </div>
      <div className="notification-list">
        {rows.map((n: any) => (
          <button
            className={`notification-row ${n.is_read ? "" : "unread"}`}
            key={n.id}
            onClick={() => onMark(n)}
          >
            <div className="notification-icon">
              <Bell size={16} />
            </div>
            <div>
              <div className="notification-head">
                <strong>{n.title}</strong>
                <span>{date(n.created_at)}</span>
              </div>
              <p>{n.message}</p>
              <small>{titleize(n.notification_type)}</small>
            </div>
            {!n.is_read && <span className="unread-dot" />}
          </button>
        ))}
      </div>
      {!rows.length && (
        <Panel>
          <EmptyState
            title="You're all caught up"
            text="No notifications are currently waiting for review."
          />
        </Panel>
      )}
    </div>
  );
}

function AnalyticsView({ analytics }: any) {
  const historical = analytics?.historical ?? {};
  const monthly = normalizeMonthlyRows(
    historical.monthly ?? DATACO_SUMMARY.monthly,
  );
  const orderAxisMax = Math.max(
    500,
    Math.ceil(
      Math.max(...monthly.map((item: any) => Number(item.orders ?? 0)), 0) /
        500,
    ) * 500,
  );
  const risk = historical.risk_distribution ?? DATACO_SUMMARY.risk_distribution;
  const spend = historical.category_spend ?? DATACO_SUMMARY.category_spend;
  const delivery = historical.delivery_status ?? DATACO_SUMMARY.delivery_status;
  const orderStatus = historical.order_status ?? DATACO_SUMMARY.order_status;
  const comparison =
    historical.supplier_comparison ?? DATACO_SUMMARY.supplier_comparison;
  const onTime = Number(
    historical.overall_on_time_rate ?? DATACO_SUMMARY.overall_on_time_rate,
  );
  const deliveryTotal = delivery.reduce(
    (sum: number, item: any) => sum + Number(item.count ?? 0),
    0,
  );
  const lowRisk = Number(
    risk.find((x: any) => String(x.risk_level).toLowerCase() === "low")
      ?.count ?? 0,
  );
  const mediumRisk = Number(
    risk.find((x: any) => String(x.risk_level).toLowerCase() === "medium")
      ?.count ?? 0,
  );
  const highRisk = Number(
    risk.find((x: any) => String(x.risk_level).toLowerCase() === "high")
      ?.count ?? 0,
  );
  const criticalRisk = Number(
    risk.find((x: any) => String(x.risk_level).toLowerCase() === "critical")
      ?.count ?? 0,
  );
  const riskColors: Record<string, string> = {
    Low: "#5A9276",
    Medium: "#D2B15D",
    High: "#D48D45",
    Critical: "#C66B67",
  };

  return (
    <div className="page-stack analytics-page">
      <div className="kpi-grid analytics-kpis">
        <KpiCard
          label="Historical supplier proxies"
          value={number(historical.supplier_count)}
          detail="Product-level intelligence"
          icon={Sparkles}
          trend={`${number(historical.unique_orders)} historical orders`}
        />
        <KpiCard
          label="Average reliability"
          value={`${Number(historical.avg_reliability).toFixed(1)}`}
          detail="Historical proxy score /100"
          icon={Gauge}
          trend={`${onTime.toFixed(1)}% on-time`}
        />
        <KpiCard
          label="Historical sales"
          value={money(historical.total_sales)}
          detail="DataCo source records"
          icon={Wallet}
          trend={`${number(historical.total_items)} items`}
        />
        <KpiCard
          label="Open operational orders"
          value={number(analytics?.current?.purchase_orders)}
          detail="Current VendorIQ records"
          icon={PackageCheck}
          trend={money(analytics?.current?.spend)}
        />
      </div>

      <div className="analytics-grid top-row">
        <Panel
          title="Monthly performance"
          subtitle="Sales and order volume by month."
          className="chart-panel analytics-wide"
        >
          <ChartBox height={345}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthly}
                margin={{ top: 12, right: 18, left: 4, bottom: 30 }}
              >
                <defs>
                  <linearGradient
                    id="analyticsSalesFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#6C7BC1" stopOpacity={0.25} />
                    <stop
                      offset="100%"
                      stopColor="#6C7BC1"
                      stopOpacity={0.03}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis
                  dataKey="month_label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                  interval={2}
                  height={28}
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                  tickFormatter={(v) => `₹${(v / 1000000).toFixed(1)}M`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, orderAxisMax]}
                  tickCount={6}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                />
                <Tooltip
                  labelFormatter={(label) => `Month: ${label}`}
                  formatter={(value: any, name: any) =>
                    name === "sales"
                      ? [money(value), "Sales"]
                      : [number(value), "Orders"]
                  }
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={34}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "#697588" }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="sales"
                  name="Sales"
                  fill="url(#analyticsSalesFill)"
                  stroke="#6C7BC1"
                  radius={[4, 4, 0, 0]}
                  barSize={17}
                />
                <Line
                  yAxisId="right"
                  dataKey="orders"
                  name="Orders"
                  type="monotone"
                  stroke="#D08C49"
                  strokeWidth={2.4}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>

        <Panel
          title="Risk distribution"
          subtitle="Historical supplier-proxy classification."
        >
          <ChartBox height={345}>
            <div className="risk-summary-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={risk}
                    dataKey="count"
                    nameKey="risk_level"
                    innerRadius={72}
                    outerRadius={105}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {risk.map((item: any) => (
                      <Cell
                        key={item.risk_level}
                        fill={riskColors[String(item.risk_level)] ?? "#8998AD"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      number(value),
                      String(name),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <strong>{number(historical.supplier_count)}</strong>
                <span>proxies</span>
              </div>
            </div>
            <div className="risk-breakdown">
              <div>
                <span className="risk-swatch low" />
                Low<strong>{lowRisk}</strong>
              </div>
              <div>
                <span className="risk-swatch medium" />
                Medium<strong>{mediumRisk}</strong>
              </div>
              <div>
                <span className="risk-swatch high" />
                High<strong>{highRisk}</strong>
              </div>
              <div>
                <span className="risk-swatch critical" />
                Critical<strong>{criticalRisk}</strong>
              </div>
            </div>
          </ChartBox>
        </Panel>
      </div>

      <div className="analytics-grid middle-row">
        <Panel
          title="Category value"
          subtitle="Historical sales concentration across major categories."
        >
          <ChartBox height={310}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={spend}
                layout="vertical"
                margin={{ left: 4, right: 16 }}
              >
                <CartesianGrid stroke="#edf0f4" horizontal={false} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                  tickFormatter={(v) => `₹${(v / 1000000).toFixed(1)}M`}
                />
                <YAxis
                  type="category"
                  dataKey="category_name"
                  width={118}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#647084" }}
                />
                <Tooltip formatter={(value: any) => [money(value), "Sales"]} />
                <Bar
                  dataKey="sales"
                  fill="#C49D55"
                  radius={[0, 5, 5, 0]}
                  barSize={19}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>

        <Panel
          title="Supplier comparison"
          subtitle="Top proxy suppliers by reliability score."
        >
          <ChartBox height={310}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparison}
                margin={{ top: 6, right: 14, left: 0, bottom: 48 }}
              >
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  angle={-26}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 9, fill: "#6F7B8E" }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${Number(value).toFixed(1)}`,
                    titleize(String(name)),
                  ]}
                />
                <Legend
                  verticalAlign="top"
                  height={26}
                  wrapperStyle={{ fontSize: 10, color: "#697588" }}
                />
                <Bar
                  dataKey="delivery"
                  name="Delivery"
                  fill="#6C7BC1"
                  radius={[4, 4, 0, 0]}
                  barSize={13}
                />
                <Bar
                  dataKey="quality"
                  name="Quality"
                  fill="#5A9276"
                  radius={[4, 4, 0, 0]}
                  barSize={13}
                />
                <Bar
                  dataKey="reliability"
                  name="Reliability"
                  fill="#C49D55"
                  radius={[4, 4, 0, 0]}
                  barSize={13}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>

        <Panel
          title="Delivery mix"
          subtitle="Historical fulfillment state across all records."
        >
          <ChartBox height={310}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={delivery}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={64}
                  outerRadius={98}
                  paddingAngle={3}
                  stroke="none"
                >
                  {delivery.map((item: any, index: number) => (
                    <Cell
                      key={item.name}
                      fill={
                        ["#5A9276", "#6C7BC1", "#D48D45", "#C66B67"][index % 4]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [
                    number(value),
                    String(name),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>
      </div>

      <div className="analytics-grid bottom-row">
        <Panel
          title="Order lifecycle"
          subtitle="Most common historical order states."
        >
          <ChartBox height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={orderStatus.slice(0, 8)}
                margin={{ top: 8, right: 14, left: 2, bottom: 42 }}
              >
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  angle={-28}
                  textAnchor="end"
                  height={58}
                  tick={{ fontSize: 9, fill: "#6F7B8E" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                />
                <Tooltip
                  formatter={(value: any) => [number(value), "Records"]}
                />
                <Bar
                  dataKey="count"
                  fill="#6C7BC1"
                  radius={[5, 5, 0, 0]}
                  barSize={25}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>

        <Panel
          title="On-time delivery trend"
          subtitle="Month-by-month service level from the DataCo records."
        >
          <ChartBox height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthly}
                margin={{ top: 10, right: 14, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="otFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5A9276" stopOpacity={0.26} />
                    <stop
                      offset="100%"
                      stopColor="#5A9276"
                      stopOpacity={0.03}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#edf0f4" vertical={false} />
                <XAxis
                  dataKey="month_label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                  interval={3}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#7E899A" }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: any) => [
                    `${Number(value).toFixed(1)}%`,
                    "On-time",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="on_time_rate"
                  stroke="#5A9276"
                  fill="url(#otFill)"
                  strokeWidth={2.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>

        <Panel
          title="Historical source"
          subtitle="What these charts represent."
        >
          <div className="source-panel">
            <div className="source-metric">
              <strong>{number(DATACO_SUMMARY.rows)}</strong>
              <span>source rows</span>
            </div>
            <div className="source-metric">
              <strong>{money(DATACO_SUMMARY.total_sales)}</strong>
              <span>historical sales</span>
            </div>
            <div className="source-metric">
              <strong>{number(DATACO_SUMMARY.unique_orders)}</strong>
              <span>unique orders</span>
            </div>
            <p>{DATACO_SUMMARY.provenance}</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ReportsView({ reports, preview, onPreview, onDownload }: any) {
  return (
    <div className="page-stack">
      <div className="report-grid">
        {reports.map(([type, label, desc]: string[]) => (
          <article className="report-card" key={type}>
            <div className="report-icon">
              <FileBarChart2 size={18} />
            </div>
            <div className="report-copy">
              <span className="eyebrow">
                {type.replaceAll("-", " ").toUpperCase()}
              </span>
              <h3>{label}</h3>
              <p>{desc}</p>
            </div>
            <div className="report-actions">
              <button onClick={() => onPreview(type)}>Preview</button>
              <button onClick={() => onDownload(type, "csv")}>
                <Download size={14} />
                CSV
              </button>
              <button onClick={() => onDownload(type, "pdf")}>
                <Download size={14} />
                PDF
              </button>
            </div>
          </article>
        ))}
      </div>
      {preview && (
        <Panel
          title={`${titleize(preview.report_type)} preview`}
          subtitle={`${number(preview.total_rows)} rows · generated ${date(preview.generated_at)}`}
        >
          <div className="preview-table">
            <Table>
              <thead>
                <tr>
                  {Object.keys(preview.rows?.[0] ?? {}).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(preview.rows ?? []).map((row: any, index: number) => (
                  <tr key={index}>
                    {Object.values(row).map((value: any, i) => (
                      <td key={i}>{String(value ?? "—")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function AuditView({ logs, summary, search, setSearch }: any) {
  const filtered = logs.filter((l: any) =>
    [l.user_name, l.action, l.entity_type, l.entity_id, l.details]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="page-stack">
      <div className="stat-strip">
        <StripStat
          icon={Flag}
          label="Events"
          value={summary.total_events ?? filtered.length}
        />
        <StripStat
          icon={FileText}
          label="Entities"
          value={summary.entities?.length ?? 0}
        />
        <StripStat
          icon={Activity}
          label="Actions"
          value={summary.actions?.length ?? 0}
        />
      </div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search user, entity, action…"
        count={`${filtered.length} events`}
      />
      <Panel>
        <Table compact>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l: any) => (
              <tr key={l.id}>
                <td>{date(l.created_at)}</td>
                <td>
                  <Entity
                    name={l.user_name}
                    meta={titleize(l.user_role)}
                    icon={<UsersIcon size={15} />}
                  />
                </td>
                <td>
                  <span className="audit-action">{titleize(l.action)}</span>
                </td>
                <td>
                  {titleize(l.entity_type)} #{l.entity_id ?? "—"}
                </td>
                <td>{l.details || "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!filtered.length && <EmptyState title="No matching audit events" />}
      </Panel>
    </div>
  );
}

function SettingsView({ user, users, onSave }: any) {
  const [name, setName] = useState(user?.name ?? "");
  return (
    <div className="page-stack">
      <div className="settings-grid">
        <Panel
          title="Your profile"
          subtitle="Your identity appears in approvals, messages and audit history."
        >
          <div className="profile-header">
            <div className="profile-avatar large">
              {String(user?.name ?? "V").charAt(0)}
            </div>
            <div>
              <h3>{user?.name}</h3>
              <span>{rolesByName[user?.role] ?? user?.role}</span>
            </div>
          </div>
          <div className="form-stack">
            <label className="field">
              <span>Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>Work email</span>
              <input value={user?.email ?? ""} disabled />
            </label>
            <label className="field">
              <span>Role</span>
              <input value={rolesByName[user?.role] ?? user?.role} disabled />
            </label>
            <button
              className="button primary"
              disabled={!name.trim() || name.trim() === user?.name}
              onClick={() => onSave(name.trim())}
            >
              Save profile
            </button>
          </div>
        </Panel>
        <Panel
          title="Access model"
          subtitle="Permissions are enforced on the API, not only hidden in the interface."
        >
          <div className="role-cards">
            {Object.entries(rolesByName).map(([role, label]) => (
              <div className="role-card" key={role}>
                <div className="role-icon">
                  <ShieldCheck size={15} />
                </div>
                <div>
                  <strong>{label}</strong>
                  <small>
                    {role === user?.role
                      ? "Current role"
                      : "Available role in VendorIQ"}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      {user?.role === "administrator" && (
        <Panel
          title="User directory"
          subtitle="Read-only overview of workspace identities."
        >
          <Table compact>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Vendor</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td>
                    <Entity name={u.name} icon={<UsersIcon size={15} />} />
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <StatusBadge value={rolesByName[u.role] ?? u.role} />
                  </td>
                  <td>{u.vendor_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </div>
  );
}

function VendorModal({ item, canManage, onClose, onSave }: any) {
  const [form, setForm] = useState({
    company_name: item?.company_name ?? "",
    category: item?.category ?? "Equipment Vendors",
    email: item?.email ?? "",
    phone: item?.phone ?? "",
    address: item?.address ?? "",
  });
  const [details, setDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(Boolean(item?.id));

  useEffect(() => {
    let active = true;
    if (!item?.id) return;

    setLoadingDetails(true);
    Promise.all([
      apiGet(`/vendors/${item.id}/contacts`).catch(() => []),
      apiGet(`/vendors/${item.id}/risk`).catch(() => null),
      apiGet(`/vendor-performance`).catch(() => []),
    ])
      .then(([contacts, risk, performanceRows]) => {
        if (!active) return;
        const latest =
          (performanceRows as any[])
            .filter((row) => Number(row.vendor_id) === Number(item.id))
            .sort(
              (a, b) =>
                new Date(b.measured_at ?? 0).getTime() -
                new Date(a.measured_at ?? 0).getTime(),
            )[0] ?? null;
        setDetails({
          contacts: Array.isArray(contacts) ? contacts : [],
          risk,
          risk_level:
            (risk as { risk_level?: string | null } | null)?.risk_level ??
            item.risk_level,
          latest_performance: latest,
          counts: {
            communications: undefined,
            contracts: undefined,
            invoices: undefined,
            purchase_orders: undefined,
          },
        });
      })
      .catch(() => {
        if (active) setDetails(null);
      })
      .finally(() => {
        if (active) setLoadingDetails(false);
      });

    return () => {
      active = false;
    };
  }, [item?.id, item?.risk_level]);

  const performance = details?.latest_performance;

  if (item?.id) {
    return (
      <Modal
        eyebrow="SUPPLIER PROFILE"
        title={item.company_name || "Vendor details"}
        onClose={onClose}
        footer={
          <button className="button primary" onClick={onClose}>
            Close
          </button>
        }
      >
        <div className="vendor-detail-modal">
          <div className="vendor-detail-hero">
            <div className="vendor-detail-avatar">
              {String(item.company_name ?? "V")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div>
              <h3>{item.company_name}</h3>
              <p>{item.category || "Uncategorized"}</p>
            </div>
            <StatusBadge value={item.status} />
          </div>

          {loadingDetails ? (
            <div className="vendor-detail-loading">
              <div className="loader-ring" />
              <span>Loading supplier intelligence…</span>
            </div>
          ) : (
            <>
              <div className="vendor-detail-grid">
                <div className="vendor-detail-card">
                  <span>Email</span>
                  <strong>{item.email || "—"}</strong>
                </div>
                <div className="vendor-detail-card">
                  <span>Phone</span>
                  <strong>{item.phone || "—"}</strong>
                </div>
                <div className="vendor-detail-card wide">
                  <span>Address</span>
                  <strong>{item.address || "—"}</strong>
                </div>
                <div className="vendor-detail-card">
                  <span>Risk level</span>
                  <StatusBadge value={details?.risk_level ?? item.risk_level} />
                </div>
                <div className="vendor-detail-card">
                  <span>Joined</span>
                  <strong>{date(item.created_at)}</strong>
                </div>
              </div>

              <div className="vendor-detail-section">
                <div className="vendor-detail-section-head">
                  <div>
                    <span className="eyebrow">CURRENT PERFORMANCE</span>
                    <h4>Operational service signal</h4>
                  </div>
                  {performance && (
                    <strong className="vendor-score-pill">
                      {Number(performance.reliability_score ?? 0).toFixed(0)} /
                      100
                    </strong>
                  )}
                </div>
                {performance ? (
                  <div className="vendor-factor-grid">
                    <Factor
                      label="Delivery"
                      value={performance.delivery_score}
                    />
                    <Factor label="Quality" value={performance.quality_score} />
                    <Factor label="Cost" value={performance.cost_score} />
                    <Factor
                      label="Communication"
                      value={performance.communication_score}
                    />
                    <Factor label="Service" value={performance.service_score} />
                    <Factor
                      label="Resolution"
                      value={performance.issue_resolution_score}
                    />
                  </div>
                ) : (
                  <EmptyState
                    title="No operational scorecard"
                    text="Record a performance scorecard to start measuring this supplier."
                  />
                )}
              </div>

              <div className="vendor-detail-summary-grid">
                <Metric label="Status" value={item.status || "—"} />
                <Metric
                  label="Risk"
                  value={details?.risk_level || item.risk_level || "—"}
                />
                <Metric
                  label="Contacts"
                  value={number(details?.contacts?.length)}
                />
                <Metric
                  label="Scorecard"
                  value={
                    performance
                      ? `${Number(performance.reliability_score ?? 0).toFixed(0)} / 100`
                      : "—"
                  }
                />
              </div>

              <div className="vendor-detail-section">
                <div className="vendor-detail-section-head">
                  <div>
                    <span className="eyebrow">PRIMARY CONTACTS</span>
                    <h4>Supplier relationship contacts</h4>
                  </div>
                </div>
                {details?.contacts?.length ? (
                  <div className="contact-list">
                    {details.contacts.map((contact: any) => (
                      <div className="contact-row" key={contact.id}>
                        <div className="contact-avatar">
                          {String(contact.contact_name ?? "C")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div>
                          <strong>{contact.contact_name}</strong>
                          <span>
                            {contact.designation || "Account contact"}
                          </span>
                        </div>
                        <div className="contact-meta">
                          <span>{contact.email || "—"}</span>
                          <span>{contact.phone || "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="detail-muted">
                    No supplier contacts have been added.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      eyebrow="NEW SUPPLIER"
      title="Add a vendor"
      onClose={onClose}
      footer={
        <>
          <button className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={() => onSave(form)}
            disabled={!form.company_name.trim()}
          >
            Save vendor
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Company name" wide>
          <input
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
          />
        </Field>
        <Field label="Category">
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {[
              "Raw Material Suppliers",
              "Equipment Vendors",
              "IT Vendors",
              "Service Providers",
              "Logistics Partners",
              "Maintenance Vendors",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Address" wide>
          <textarea
            rows={3}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function RequestModal({ onClose, onSave }: any) {
  const [form, setForm] = useState({
    description: "",
    quantity: 1,
    department: "Information Technology",
    required_date: "",
  });
  return (
    <Modal
      eyebrow="PROCUREMENT"
      title="New procurement request"
      onClose={onClose}
      footer={
        <>
          <button className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={() =>
              onSave({
                ...form,
                required_date: form.required_date
                  ? `${form.required_date}T00:00:00`
                  : null,
              })
            }
            disabled={!form.description.trim()}
          >
            Submit request
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Requirement" wide>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What needs to be procured?"
          />
        </Field>
        <Field label="Quantity">
          <input
            type="number"
            min={1}
            value={form.quantity}
            onChange={(e) =>
              setForm({ ...form, quantity: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Department">
          <input
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
        </Field>
        <Field label="Required date">
          <input
            type="date"
            value={form.required_date}
            onChange={(e) =>
              setForm({ ...form, required_date: e.target.value })
            }
          />
        </Field>
      </div>
    </Modal>
  );
}

function PoModal({ vendors, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({
    vendor_id: "",
    expected_delivery: "",
    department: "Information Technology",
    payment_terms: "Net 30",
    shipping_address: "",
    billing_address: "",
    remarks: "",
  });
  const [items, setItems] = useState<any[]>([
    { product_name: "", quantity: 1, unit_price: 0, tax_percent: 18 },
  ]);
  const subtotal = items.reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0,
  );
  const tax = items.reduce(
    (sum, item) =>
      sum +
      (Number(item.quantity || 0) *
        Number(item.unit_price || 0) *
        Number(item.tax_percent || 0)) /
        100,
    0,
  );
  return (
    <Modal
      eyebrow="ORDER CONTROL"
      title="Create purchase order"
      wide
      onClose={onClose}
      footer={
        <>
          <button className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={() =>
              onSave({
                ...form,
                vendor_id: Number(form.vendor_id),
                expected_delivery: form.expected_delivery
                  ? `${form.expected_delivery}T00:00:00`
                  : null,
                subtotal,
                tax_amount: tax,
                total_amount: subtotal + tax,
                items,
              })
            }
            disabled={!form.vendor_id || !items[0].product_name.trim()}
          >
            Create purchase order
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Vendor">
          <select
            value={form.vendor_id}
            onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
          >
            <option value="">Select vendor</option>
            {vendors.map((v: any) => (
              <option
                key={v.id}
                value={v.id}
                disabled={v.status !== "Approved" && v.status !== "Active"}
              >
                {v.company_name} · {v.status}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expected delivery">
          <input
            type="date"
            value={form.expected_delivery}
            onChange={(e) =>
              setForm({ ...form, expected_delivery: e.target.value })
            }
          />
        </Field>
        <Field label="Department">
          <input
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
        </Field>
        <Field label="Payment terms">
          <input
            value={form.payment_terms}
            onChange={(e) =>
              setForm({ ...form, payment_terms: e.target.value })
            }
          />
        </Field>
        <Field label="Shipping address" wide>
          <input
            value={form.shipping_address}
            onChange={(e) =>
              setForm({ ...form, shipping_address: e.target.value })
            }
          />
        </Field>
      </div>
      <div className="line-items">
        <div className="line-head">
          <div>
            <h3>Line items</h3>
            <p>Taxes and totals are calculated locally before submission.</p>
          </div>
          <button
            className="button ghost small"
            onClick={() =>
              setItems([
                ...items,
                {
                  product_name: "",
                  quantity: 1,
                  unit_price: 0,
                  tax_percent: 18,
                },
              ])
            }
          >
            <Plus size={14} /> Add item
          </button>
        </div>
        {items.map((item, i) => (
          <div className="line-row" key={i}>
            <input
              placeholder="Item"
              value={item.product_name}
              onChange={(e) =>
                updateAt(items, setItems, i, "product_name", e.target.value)
              }
            />
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) =>
                updateAt(items, setItems, i, "quantity", Number(e.target.value))
              }
            />
            <input
              type="number"
              min={0}
              value={item.unit_price}
              onChange={(e) =>
                updateAt(
                  items,
                  setItems,
                  i,
                  "unit_price",
                  Number(e.target.value),
                )
              }
            />
            <input
              type="number"
              min={0}
              value={item.tax_percent}
              onChange={(e) =>
                updateAt(
                  items,
                  setItems,
                  i,
                  "tax_percent",
                  Number(e.target.value),
                )
              }
            />
            {items.length > 1 && (
              <button
                className="icon-btn"
                onClick={() => setItems(items.filter((_, idx) => idx !== i))}
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
        <div className="totals">
          <span>
            Subtotal <strong>{money(subtotal)}</strong>
          </span>
          <span>
            Tax <strong>{money(tax)}</strong>
          </span>
          <span>
            Total <strong>{money(subtotal + tax)}</strong>
          </span>
        </div>
      </div>
    </Modal>
  );
}

function PerformanceModal({ vendors, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({
    vendor_id: "",
    delivery_score: 85,
    quality_score: 85,
    cost_score: 85,
  });
  return (
    <Modal
      eyebrow="SERVICE QUALITY"
      title="Record performance scorecard"
      onClose={onClose}
      footer={
        <>
          <button className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={() =>
              onSave({
                ...form,
                vendor_id: Number(form.vendor_id),
                delivery_score: Number(form.delivery_score),
                quality_score: Number(form.quality_score),
                cost_score: Number(form.cost_score),
              })
            }
            disabled={!form.vendor_id}
          >
            Record scorecard
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Vendor" wide>
          <select
            value={form.vendor_id}
            onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
          >
            <option value="">Select vendor</option>
            {vendors.map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.company_name}
              </option>
            ))}
          </select>
        </Field>
        {[
          ["Delivery score", "delivery_score"],
          ["Quality score", "quality_score"],
          ["Cost score", "cost_score"],
        ].map(([label, key]) => (
          <Field key={key} label={label}>
            <input
              type="number"
              min={0}
              max={100}
              value={form[key]}
              onChange={(e) =>
                setForm({ ...form, [key]: Number(e.target.value) })
              }
            />
          </Field>
        ))}
      </div>
    </Modal>
  );
}

function ContractModal({ vendors, item, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({
    vendor_id: item?.vendor_id ?? "",
    contract_name: item?.contract_name ?? "",
    start_date: item?.start_date?.slice(0, 10) ?? "",
    end_date: item?.end_date?.slice(0, 10) ?? "",
    status: item?.status ?? "Active",
    compliance_status: item?.compliance_status ?? "Pending",
    document_path: item?.document_path ?? "",
  });
  const submit = () =>
    onSave({
      ...form,
      vendor_id: Number(form.vendor_id),
      start_date: form.start_date ? `${form.start_date}T00:00:00` : null,
      end_date: form.end_date ? `${form.end_date}T00:00:00` : null,
    });
  return (
    <Modal
      eyebrow="GOVERNANCE"
      title={item ? "Edit contract" : "New contract"}
      onClose={onClose}
      footer={
        <>
          <button className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={submit}
            disabled={!form.vendor_id || !form.contract_name.trim()}
          >
            {item ? "Save changes" : "Create contract"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Vendor">
          <select
            value={form.vendor_id}
            onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
          >
            <option value="">Select vendor</option>
            {vendors.map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.company_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contract name">
          <input
            value={form.contract_name}
            onChange={(e) =>
              setForm({ ...form, contract_name: e.target.value })
            }
          />
        </Field>
        <Field label="Start date">
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
        </Field>
        <Field label="End date">
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option>Active</option>
            <option>Draft</option>
            <option>Expired</option>
          </select>
        </Field>
        <Field label="Compliance">
          <select
            value={form.compliance_status}
            onChange={(e) =>
              setForm({ ...form, compliance_status: e.target.value })
            }
          >
            <option>Pending</option>
            <option>Compliant</option>
            <option>Non-compliant</option>
          </select>
        </Field>
        <Field label="Document path" wide>
          <input
            value={form.document_path}
            onChange={(e) =>
              setForm({ ...form, document_path: e.target.value })
            }
            placeholder="Optional reference or stored path"
          />
        </Field>
      </div>
    </Modal>
  );
}

function InvoiceModal({ orders, vendors, onClose, onSave }: any) {
  const [form, setForm] = useState<any>({
    purchase_order_id: "",
    amount: "",
    tax_amount: "",
    due_date: "",
    notes: "",
  });
  return (
    <Modal
      eyebrow="FINANCE"
      title="Record invoice"
      onClose={onClose}
      footer={
        <>
          <button className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={() =>
              onSave({
                ...form,
                purchase_order_id: Number(form.purchase_order_id),
                amount: form.amount === "" ? null : Number(form.amount),
                tax_amount:
                  form.tax_amount === "" ? null : Number(form.tax_amount),
                due_date: form.due_date ? `${form.due_date}T00:00:00` : null,
                vendor_id:
                  vendors.find(
                    (v: any) =>
                      v.id ===
                      Number(
                        orders.find(
                          (o: any) => o.id === Number(form.purchase_order_id),
                        )?.vendor_id,
                      ),
                  )?.id ?? undefined,
              })
            }
            disabled={!form.purchase_order_id}
          >
            Record invoice
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Purchase order" wide>
          <select
            value={form.purchase_order_id}
            onChange={(e) =>
              setForm({ ...form, purchase_order_id: e.target.value })
            }
          >
            <option value="">Select PO</option>
            {orders.map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.po_number || `PO #${o.id}`} · {money(o.total_amount)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount">
          <input
            type="number"
            min={0}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </Field>
        <Field label="Tax amount">
          <input
            type="number"
            min={0}
            value={form.tax_amount}
            onChange={(e) => setForm({ ...form, tax_amount: e.target.value })}
          />
        </Field>
        <Field label="Due date">
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
        </Field>
        <Field label="Notes" wide>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function MessageModal({ vendors, onClose, onSave }: any) {
  const [form, setForm] = useState({
    vendor_id: "",
    subject: "General Inquiry",
    message: "",
  });
  return (
    <Modal
      eyebrow="COMMUNICATIONS"
      title="Start supplier conversation"
      onClose={onClose}
      footer={
        <>
          <button className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={() =>
              onSave({ ...form, vendor_id: Number(form.vendor_id) })
            }
            disabled={!form.vendor_id || !form.message.trim()}
          >
            Send message
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Vendor" wide>
          <select
            value={form.vendor_id}
            onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
          >
            <option value="">Select vendor</option>
            {vendors.map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.company_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subject" wide>
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
        </Field>
        <Field label="Message" wide>
          <textarea
            rows={6}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Write a clear procurement or service message…"
          />
        </Field>
      </div>
    </Modal>
  );
}

function DocumentModal({ item, file, setFile, onClose, onSave }: any) {
  return (
    <Modal
      eyebrow="EVIDENCE"
      title={`Upload document · ${item?.company_name ?? "Vendor"}`}
      onClose={onClose}
      footer={
        <>
          <button className="button ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" onClick={onSave} disabled={!file}>
            Upload file
          </button>
        </>
      }
    >
      <div className="upload-zone">
        <FileText size={22} />
        <strong>Attach supplier evidence</strong>
        <p>PDF, image or office document. The backend validates the upload.</p>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && <span className="selected-file">{file.name}</span>}
      </div>
    </Modal>
  );
}

function Toolbar({ search, setSearch, placeholder, count, action }: any) {
  return (
    <div className="toolbar">
      <div className="search-field">
        <Search size={15} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
        />
        <kbd>⌘ K</kbd>
      </div>
      <div className="toolbar-right">
        <span className="result-count">{count}</span>
        {action}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, action, children, className = "" }: any) {
  return (
    <section className={`panel ${className}`}>
      <div className={`panel-head ${title ? "" : "no-title"}`}>
        {title ? (
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
        ) : (
          <span />
        )}
        {action}
      </div>
      {children}
    </section>
  );
}

function Table({ children, compact = false }: any) {
  return (
    <div className={`table-scroll ${compact ? "compact" : ""}`}>
      <table>{children}</table>
    </div>
  );
}
function Entity({ name, meta, icon }: any) {
  return (
    <div className="entity-cell">
      <span className="entity-icon">{icon}</span>
      <div>
        <strong>{name}</strong>
        {meta && <small>{meta}</small>}
      </div>
    </div>
  );
}
function RowActions({ children }: any) {
  return <div className="row-actions">{children}</div>;
}
function Field({ label, children, wide = false }: any) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function ChartBox({ children, height }: any) {
  return (
    <div className="chart-box" style={{ height }}>
      {children}
    </div>
  );
}
function Metric({ label, value }: any) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function StripStat({ icon: Icon, label, value }: any) {
  return (
    <div className="strip-stat">
      <div className="strip-icon">
        <Icon size={15} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
function Score({ score, prominent }: { score: any; prominent?: boolean }) {
  const s = Number(score ?? 0);
  return (
    <div className={`score-inline ${prominent ? "prominent" : ""}`}>
      <strong>{s.toFixed(0)}</strong>
      <span>/100</span>
    </div>
  );
}
function Factor({
  label,
  value,
}: {
  label: string;
  value: any;
  inverse?: boolean;
}) {
  const v = Math.max(0, Math.min(100, Number(value ?? 0)));
  return (
    <div className="factor">
      <div>
        <span>{label}</span>
        <strong>{v.toFixed(0)}</strong>
      </div>
      <div className="factor-bar">
        <i style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
function ReceiptIcon(props: any) {
  return <Receipt {...props} />;
}
function UsersIcon(props: any) {
  return <Building2 {...props} />;
}

function vendorName(vendors: any[], id: any) {
  const v = vendors.find((x: any) => Number(x.id) === Number(id));
  return v?.company_name ?? `Vendor #${id ?? "—"}`;
}
function updateAt(
  rows: any[],
  setRows: (x: any[]) => void,
  index: number,
  key: string,
  value: any,
) {
  setRows(rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
}
