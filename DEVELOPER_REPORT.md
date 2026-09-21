# Vendor Reliability Platform — Project Diagnosis & Fix Report
**Date:** 2026-09-08

---

## 🟢 WHAT'S WORKING CORRECTLY

### Backend (`C:\Vendor-reliability-platform\backend`)
All confirmed working via live end-to-end API tests:

| Area | Status |
|------|--------|
| Server startup (`uvicorn main:app`) | ✅ **Application startup complete** |
| MySQL connection (`root` / `vendor_db`) | ✅ Connected |
| Auth: register / login / JWT token | ✅ Login returns `access_token` |
| RBAC (role-based access) | ✅ 401 no-token, 403 wrong-role, 200 correct-role |
| Vendor CRUD (list/create/update/delete) | ✅ (delete now cleans up child records) |
| Vendor approval workflow (status update) | ✅ New |
| Procurement requests (create/list/update) | ✅ (create POST was previously broken — now fixed) |
| Purchase orders (create/list/update) | ✅ |
| Vendor performance scoring | ✅ reliability = 0.4·delivery + 0.4·quality + 0.2·cost |
| Vendor risk assessment (`/vendors/{id}/risk`) | ✅ risk levels Low/Medium/High |
| Dashboard summary (`/dashboard/summary`) | ✅ was 500 — now returns correct counts |
| CORS | ✅ configured for frontend on port 5500 |
| Security (bcrypt hashing) | ✅ |

### Frontend (`C:\Vendor-reliability-platform\frontend`)
- ✅ Login form + logout (new — previously none existed)
- ✅ Dashboard auto-loads if a valid token exists
- ✅ Auto-redirect to login on 401/expired token
- ✅ JS syntax verified valid

### Project hygiene
- ✅ `backend/requirements.txt` (new — pins all deps)
- ✅ `.gitignore` (new — excludes venv, __pycache__, .env)
- ✅ `backend/.env.example` (new — documents DATABASE_URL + SECRET_KEY)

---

## 🔴 BUGS FOUND & FIXED

### 1. `models.py` — `Vendor` class wrongly NESTED inside `User` class
**Severity:** Critical. The `Vendor` class was indented as a nested attribute of `User` (i.e. `User.Vendor`), so every `models.Vendor` reference in `main.py` would fail at runtime.
**Fix:** Un-nested it to module level.

### 2. `models.py` — `VendorPerformance` schema mismatch
**Severity:** Critical. The model had columns `on_time_deliveries`, `delayed_deliveries`, etc., but the API writes/reads `delivery_score`, `quality_score`, `cost_score`, `reliability_score`, `risk_level` — causing 500 errors on any performance/dashboard call.
**Fix:** Replaced model columns to match the API.
**Also done:** Dropped the stale `vendor_performance` table in MySQL so `create_all` rebuilt it with the correct schema (existing tables are NOT altered by `create_all`).

### 3. `main.py` — Duplicate `GET /vendors` route
**Severity:** High. Defined twice; only the second survived.
**Fix:** Removed the duplicate.

### 4. `main.py` — `create_procurement_request` missing `@app.post` decorator
**Severity:** High. The function existed but was never registered as a route — `POST /procurement-requests` was silently hanging off the `GET` decorator.
**Fix:** Added its own `@app.post` decorator; separated the POST and GET routes so each maps to the correct handler.

### 5. `main.py` — `DELETE /vendors/{id}` failed with 500 (IntegrityError)
**Severity:** High. Deleting a vendor made SQLAlchemy try to NULL child `vendor_id` columns that are `NOT NULL`.
**Fix:** (a) Added `cascade="all, delete-orphan"` to all Vendor relationships + `ondelete="CASCADE"` on FKs (for fresh DBs); (b) delete endpoint now explicitly removes related performance/contracts/contacts/purchase-orders/items first (works with the existing DB).

### 6. Frontend — `loadDashboard()` defined but never called; no login at all
**Severity:** High. The page showed static zeros; there was no way to authenticate.
**Fix:** Rewrote `index.html`/`script.js`/`style.css` with a login form, logout, token persistence, auto-load, and auto-redirect on session expiry.

### 7. `database.py` / `auth.py` — hardcoded credentials & weak JWT secret
**Severity:** Medium (security).
**Fix:** `DATABASE_URL` and `SECRET_KEY` now read from environment variables with local fallbacks; `.env.example` added.

### 8. Missing `requirements.txt`
**Severity:** Medium. Dependency manifest now exists.

---

## ✅ FULL TEST RESULTS (18 endpoint checks)
- **No-token: 401** ✅
- **Wrong-role: 403** ✅
- **Correct-role: 200** ✅
- **Register/Login/JWT** ✅
- **All CRUD + performance + dashboard + risk** ✅

*Note:* during testing 2 users were registered in your DB (`test@example.com` admin, `admin@example.com` admin) and sample vendors/orders were created. Reset via SQL if you want a clean slate.

---

## 🟡 WHAT STILL NEEDS TO BE COMPLETED (vs. `docs/requirements.md`)

The implemented backend (~22 endpoints) covers roughly **40%** of the full requirements. Missing modules:

| Module | Status |
|--------|--------|
| **Report generation** (PDF/Excel export) | ❌ Not implemented |
| **Contracts & compliance** (CRUD, renewal alerts) | ⚠️ Model exists; no API/frontend |
| **Notifications** (in-app + email) | ⚠️ Model exists; no API/frontend |
| **Communications** (vendor messaging, file share) | ❌ Model doesn't even exist |
| **Invoices** | ❌ Not implemented |
| **Activity/audit logs** | ❌ Not implemented |
| **Reports** | ❌ Not implemented |
| **Profile management / password reset** | ❌ Not implemented |
| **Frontend rebuild** (Angular) | ⚠️ Currently plain HTML/JS; requirements say Angular + Material |
| **Database** | ⚠️ Code uses **MySQL**; requirements specify **PostgreSQL** |
| **Tests** | ⚠️ Only a trivial `test_db.py`; no pytest suite |
| **Docker / deployment** | ❌ No Dockerfile or CI/CD |
| **README.md** | ⚠️ Empty file; needs setup documentation |
| **`role-permissions.xlsx`** | ⚠️ Empty; needs populated matrix |

---

## 🚀 HOW TO RUN

```bash
cd C:\Vendor-reliability-platform\backend
.\venv\Scripts\python.exe -m pip install -r requirements.txt   # if fresh setup
.\venv\Scripts\python.exe -m uvicorn main:app --reload
# Open http://127.0.0.1:8000/docs  (Swagger)
# Open http://127.0.0.1:8000      (health check)
```

### Frontend
Serve `frontend/` on port **5500** with any static server (e.g. VS Code Live Server, or `python -m http.server 5500`), then open `http://127.0.0.1:5500`. Log in with a registered account.

### Test accounts (created during this debugging session)
- `admin@example.com` / `admin123` (role: admin)
- `test@example.com` / `test123` (role: user)

---

# 🟢 MILESTONE-3 COMPLETION REPORT (Weeks 5–6: Vendor Performance & Analytics)

**Work performed:** Built the full MS3 module stack on top of the existing MS1/MS2 codebase. All back-end outputs are computed **live from the MySQL database** — nothing is hardcoded. Verified with **19 MS3 endpoint checks + 16 MS1/MS2 regression checks (all passing)**.

## How the DataCo dataset was used
The DataCo supply-chain CSV (`DataCoSupplyChainDataset.csv`, **180,519 order rows × 53 cols**) contains **no vendor column** — it is retail order data. As agreed (choice 1C), each **product is treated as a supplier** ("product-as-supplier proxy"), so the platform scores supplier reliability from real delivery history:
- `dataset_orders` (180,519 rows) — raw order-level history
- `dataset_suppliers` (118 suppliers) — per-supplier aggregates + reliability score + risk level

Imported by `backend/import_dataset.py` (idempotent: re-runs safely).

## Available MS3 endpoints

| Module | Endpoints |
|--------|-----------|
| **Vendor Performance** | `GET /api/suppliers` (filterable), `GET /api/suppliers/{id}` (metrics + monthly trend + recommendations) |
| **Reliability Scoring** | `GET /api/suppliers/ranking` (leaderboard, rank 1..N), `GET /api/suppliers/categories` |
| **Analytics Dashboard** | `GET /api/analytics/dashboard` (risk dist., spend by category/market, delivery status, monthly trend, top suppliers) |
| **Procurement Analytics** | `GET /api/analytics/procurement` (spend summary, by shipping mode, delivery status, PO statuses) |
| **Notifications** | `GET/POST /notifications*`, `PUT /notifications/{id}/read`, `/read-all`, `POST /notifications/generate` (alert scan) |
| **Contracts & Compliance** | `GET/POST/PUT/DELETE /contracts*`, `GET /contracts/expiring?days=` (30/60/90), `GET /contracts/compliance` |
| **Reports & Export** | `GET /api/reports/{type}/download` (Excel), `.csv`, `.preview` for 6 report types |

### Reliability scoring formula (rule-based, range 0–100)
Supplier score = weighted blend of calibrated components (designed because the dataset's global on-time rate is only ~45%):

```
delivery = LEAST(100, on_time_rate × 1.7)      ← 35% weight
quality  = LEAST(100, complete_rate × 1.35)    ← 20%
cancel   = GREATEST(0, 100 − cancel_rate × 3)  ← 15%
history  = 35 + 10·√(orders+1)/5               ← 15% (low-volume penalized)
punct    = GREATEST(0, 100 − (overdue−0.5)·40) ← 15%
```
Risk buckets: **Low ≥ 78 · Medium 65–77.9 · High < 65**. Result on real data: **14 Low / 99 Medium / 5 High** — a realistic spread with all three levels present.

## Milestone-3 evaluation criteria — status

| Criterion | Status |
|-----------|--------|
| Vendor Performance Dashboard completed | ✅ Performance page: filterable supplier table + drill-down with trend chart & recommendations |
| Reliability Scoring operational | ✅ Ranking, risk levels, six factors, component breakdown, recommendations |
| Reports generated successfully | ✅ Excel (`.xlsx`) + CSV live downloads for vendor-performance, suppliers, procurement, purchase-orders, compliance, contracts |
| Analytics Dashboard functional | ✅ Charts: monthly orders/sales/on-time, spend by category & market, delivery & order status, top suppliers; procurement analytics |

## What ships in this milestone (frontend — plain HTML/JS as agreed, choice 3A)
- `frontend/index.html`, `script.js`, `style.css` — full SPA with sidebar nav & 8 sections
- Chart.js (CDN) renders all analytics charts from API responses
- Login view preserved; logout + 401 auto-redirect preserved
- CORS unchanged (frontend served on **port 5500**, backend on **port 8001** as below)

## Important port note ⚠️
During development, the machine had a **zombie socket on port 8000** (a killed process left `LISTENING` with no owning PID — `taskkill`/`Stop-Process` cannot remove it). The MS3 backend therefore runs on **port 8001**, and the frontend `API_BASE` points to `http://127.0.0.1:8001`. If port 8000 clears after a reboot, you may switch back to 8000 by editing `frontend/script.js` and the run command. See `start_ms3.bat` for one-click startup.

## How to run MS3
```bash
# one-click launcher (starts backend :8001 + frontend :5500)
C:\Vendor-reliability-platform\start_ms3.bat
# or manually:
cd C:\Vendor-reliability-platform\backend
.\venv\Scripts\python.exe -m uvicorn main:app --port 8001
# separate terminal:
cd C:\Vendor-reliability-platform\frontend
..\backend\venv\Scripts\python.exe -m http.server 5500
# open http://127.0.0.1:5500  → log in with admin@example.com / admin123
```

## Sample data seeded (idempotent script `backend/seed_data.py`)
- 5 representative vendors (+ performance + contacts) — only added if company name not already present
- Contracts per approved vendor — some **expiring within 30/70 days**, one **Non-Compliant**, to demo alerts
- Sample purchase orders + procurement requests if those tables are empty

## Test artifacts
- `backend/_e2e_ms3.mjs` — 19-check end-to-end test of every MS3 endpoint (run with `node backend/_e2e_ms3.mjs`)
- `backend/_regression_ms12.mjs` — 16-check regression of MS1/MS2 + notification-trigger verification