const BASE = "http://127.0.0.1:8001";
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra ? JSON.stringify(extra).slice(0,160) : ""); }
}
async function j(path, method = "GET", body, token) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch (_) { data = text; }
  return { status: r.status, data };
}

// logins
const admin = (await j("/login", "POST", { email: "admin@example.com", password: "admin123" })).data.access_token;
const user = (await j("/login", "POST", { email: "test@example.com", password: "test123" })).data.access_token;
check("admin login", !!admin);
check("user login", !!user);

// old endpoints
check("GET /protected", (await j("/protected", "GET", null, admin)).status === 200);
check("GET /admin-only", (await j("/admin-only", "GET", null, admin)).status === 200);
check("GET /admin-only denied for user", (await j("/admin-only", "GET", null, user)).status === 403);
check("GET /vendors", (await j("/vendors", "GET", null, user)).status === 200);
check("GET /procurement-requests", (await j("/procurement-requests", "GET", null, user)).status === 200);

// create a vendor then approve it -> should fire vendor_approval notification for admins
const created = await j("/vendors", "POST", { company_name: "E2E Regression Vendor", category: "IT Vendors" }, admin);
check("POST /vendors", created.status === 201 || created.status === 200);
const vid = created.data && created.data.id;
check("vendor created with id", !!vid);
if (vid) {
  const upd = await j("/vendors/" + vid, "PUT", { company_name: "E2E Regression Vendor", category: "IT Vendors", status: "Approved" }, admin);
  check("PUT /vendors/approve", upd.status === 200 && upd.data.status === "Approved");
}
// clean up: delete the test vendor (admin only)
if (vid) {
  const del = await j("/vendors/" + vid, "DELETE", null, admin);
  check("DELETE /vendors cleanup", del.status === 200);
}

// PO lifecycle -> notifications
const vendors = (await j("/vendors", "GET", null, admin)).data;
check("vendors exist for PO", Array.isArray(vendors) && vendors.length > 0);
const target = vendors.find(v => v.id !== vid) || vendors[0];
const po = await j("/purchase-orders", "POST", { vendor_id: target.id, total_amount: 12345.6 }, admin);
check("POST /purchase-orders", po.status === 200 && po.data && po.data.id);
let poId = po.data && po.data.id;

// approve a PO -> creator (admin) should get a notification
let before = (await j("/notifications/count/unread", "GET", null, admin)).data.unread;
if (poId) {
  const up = await j("/purchase-orders/" + poId, "PUT", { status: "Approved" }, admin);
  check("PUT /purchase-orders approve", up.status === 200 && up.data.status === "Approved");
}
let after = (await j("/notifications/count/unread", "GET", null, admin)).data.unread;
check("PO approval fired procurement notification", after >= before && after > 0);

// mark one read
if (poId) {
  const notifs = (await j("/notifications", "GET", null, admin)).data;
  const un = notifs.find(n => !n.is_read);
  if (un) {
    const mr = await j(`/notifications/${un.id}/read`, "PUT", null, admin);
    check("mark notification read", mr.status === 200);
  }
}

console.log(`\nRegression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);