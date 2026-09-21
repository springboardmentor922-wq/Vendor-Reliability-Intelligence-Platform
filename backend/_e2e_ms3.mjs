const BASE = "http://127.0.0.1:8001";
let token = null;
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra !== undefined ? JSON.stringify(extra).slice(0,160) : ""); }
}
async function get(path, headers = {}) {
  const r = await fetch(BASE + path, { headers });
  if (!r.ok) throw new Error(path + " -> " + r.status + " " + (await r.text()).slice(0,120));
  const ct = r.headers.get("content-type") || "";
  return ct.includes("json") ? r.json() : r;
}

const lgr = await fetch(BASE + "/login", { method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@example.com", password: "admin123" }) });
const lgd = await lgr.json();
token = lgd.access_token;
const A = { Authorization: "Bearer " + token };
check("login returns token", !!token);

const summary = await get("/dashboard/summary", A);
check("dashboard/summary", summary.total_vendors >= 0 && summary.risk_summary);
const dash = await get("/api/analytics/dashboard", A);
check("analytics/dashboard fields",
  Array.isArray(dash.risk_distribution) && Array.isArray(dash.monthly_trend) &&
  dash.monthly_trend.length > 3 && Array.isArray(dash.spend_by_category) &&
  dash.kpis && typeof dash.kpis.app_contracts === "number" && dash.totals.total_orders > 100000);

const suppliers = await get("/api/suppliers?limit=20", A);
check("suppliers list", Array.isArray(suppliers) && suppliers.length >= 5 && "reliability_score" in suppliers[0]);
const pid = suppliers[0].product_card_id;
const detail = await get("/api/suppliers/" + encodeURIComponent(pid), A);
check("supplier detail", Array.isArray(detail.trend) && detail.trend.length >= 1
  && Array.isArray(detail.recommendations) && detail.components);
check("supplier trend monthly", /^\d{4}-\d{2}$/.test(detail.trend[0].period));
check("supplier detail has score+risk", typeof detail.reliability_score === "number" && typeof detail.risk_level === "string");
const cats = await get("/api/suppliers/categories", A);
check("categories 50", Array.isArray(cats) && cats.length === 50);

const ranking = await get("/api/suppliers/ranking?limit=20", A);
check("ranking ordered", ranking[0].rank === 1 && ranking[0].reliability_score >= ranking[1].reliability_score);

const proc = await get("/api/analytics/procurement", A);
check("procurement analytics", proc.spend_summary.total_spend > 0
  && Array.isArray(proc.app_purchase_order_status) && Array.isArray(proc.spend_by_shipping_mode));

const contracts = await get("/contracts", A);
check("contracts list", Array.isArray(contracts) && contracts.length >= 3);
const comp = await get("/contracts/compliance", A);
check("compliance overview", Array.isArray(comp.summary));
const exp = await get("/contracts/expiring?days=90", A);
check("expiring contracts", Array.isArray(exp) && exp.length >= 1);

const count = await get("/notifications/count/unread", A);
check("unread count", "unread" in count);
const notifs = await get("/notifications?unread_only=false", A);
check("notifications list", Array.isArray(notifs));

const rp = await get("/api/reports/vendor-performance/preview?limit=15", A);
check("report preview", rp.total_rows === 118 && rp.rows.length === 15 && Array.isArray(rp.columns));
const rp2 = await get("/api/reports/contracts/preview?limit=5", A);
check("contracts report preview", rp2.total_rows === contracts.length);

// binary downloads
for (const [t, f] of [["vendor-performance","download"], ["purchase-orders","csv"]]) {
  const r = await fetch(BASE + `/api/reports/${t}/${f}`, { headers: A });
  const buf = Buffer.from(await r.arrayBuffer());
  check(`${t} ${f} downloads`, r.ok && buf.length > 60);
}

console.log(`\nE2E result: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);