# Milestone 4 - Live dashboards, animated UI and spreadsheet import

This guide covers what was added on top of Milestones 1-3: the three role
dashboards with every mandatory chart, live monitoring, the Excel/CSV import,
the vendor registration application, the Create Purchase Order page and the
redesigned, animated interface.

Everything is database-driven. No chart, KPI or list contains hard-coded
values - every figure is a SQL aggregate computed when the screen asks for it.

---

## 1. Getting it running

```bash
# backend (unchanged steps - new columns are added automatically at start-up)
cd backend
venv\Scripts\activate
python -m uvicorn main:app --reload --port 8000

# frontend - run npm install once: chart.js and local fonts were added
cd frontend
npm install
npx ng serve
```

An existing `vendor_iq` database does **not** need to be reseeded. On start-up
the API applies additive, idempotent upgrades (`services/migrations.py`):
new vendor application columns, `vendor_documents`, `data_imports`,
`purchase_orders.billing_address / department` and
`purchase_order_items.tax_rate`. A fresh `python seed.py` builds the same
schema from `database/schema.sql`.

Sign-in routes each role to its dashboard:

| Role | Lands on | Can open |
| --- | --- | --- |
| Administrator | Admin dashboard | Admin, Procurement, Vendor |
| Procurement / Supply Chain / Finance / Auditor | Procurement dashboard | Procurement, Vendor |
| Vendor | Vendor dashboard (own company only) | Vendor |

---

## 2. Mandatory charts - where each one lives

All three dashboards read one endpoint each (`GET /dashboards/procurement`,
`/dashboards/vendor`, `/dashboards/admin`) and share the date-range control
(30D / 90D / 6M / 12M / All).

### Procurement Dashboard (blue)

| Chart | Type | Data source | Interaction |
| --- | --- | --- | --- |
| Total Purchase Orders / Procurement Cost / Active Vendors / Items Procured | KPI tiles + % change vs previous 30 days | `purchase_orders`, `purchase_order_items`, `vendors` | count-up animation |
| Delivery Status | Semicircle gauge + breakdown (on time, in transit, delayed, cancelled) | expected vs actual delivery dates | link to Performance |
| Procurement Overview | Bars (monthly cost) + line (PO count) | `spend_over_time` | click a month -> PO list for that month |
| Active Purchase Orders | Donut by status | PO status counts | click a segment -> PO list filtered by status |
| Vendor Performance Summary | Radar: top-ranked vendor vs average over the six reliability factors, plus performance score, quality, on-time, response time, issue resolution, completion | latest `vendor_reliability_scores`, `vendor_performance` | click -> top vendor |
| Procurement Cost Analysis | Donut by category, budget vs actual, variance | PO spend vs request estimates | click a category -> filters the whole dashboard |
| Open Purchase Orders | Table (overdue flagged) | open POs by expected date | click -> PO detail |
| Cost by Vendor | Horizontal bars | spend by vendor | click -> vendor |
| Live Activity | Feed | `activity_logs` | new events flash in |

### Vendor Dashboard (green)

| Chart | Type | Data source |
| --- | --- | --- |
| Performance Score / Reliability Score / Active Contracts / Total Orders | KPI tiles with change | reliability history, contracts, POs |
| Vendor Performance | Grouped bars - Delivery, Quality, Communication, Compliance. Staff: the vendor vs its top category peers (click a peer to switch). Vendor login: its own last six scoring periods | `vendor_reliability_scores` |
| Reliability Score Trend | Area line with risk level per point | stored score history |
| Contract Status | Donut: Active, Expiring Soon, Renewed, Expired, Draft, Terminated | `contracts` |
| Order History | Bars (order value) + line (order count) per month | vendor's POs |
| Communication Activity | Donut: buyer messages, vendor replies, open/resolved queries, files shared, notifications | `messages`, `message_threads`, `message_attachments`, `notifications` |
| Reliability Breakdown | Six factor bars, overall score, risk, rank, recommendation, ML predicted delay risk | reliability engine |

A vendor login is always pinned to its own company server-side; it cannot see
another supplier's data even by editing the URL.

### Admin Dashboard (purple)

| Chart | Type | Data source |
| --- | --- | --- |
| Total Users / Vendors / Contracts / System Availability | KPI tiles | row counts, request monitor |
| User Management | Donut by role (click -> users filtered by role) | `users` |
| Vendor Analytics | Risk distribution bars Low / Medium / High / Critical (click -> vendors of that risk) | latest reliability snapshots |
| Procurement Reports | Bars (value) + line (PO count) per month | POs |
| Compliance Monitoring | Donut: Compliant, Minor Issues, Major Issues, Non-Compliant | latest compliance check, certification expiry, contract compliance |
| System Statistics | Database size, API response time (avg / p95), active sessions, file storage, uptime, 15-minute latency sparkline - refreshed every 5 s | `pg_database_size`, request-timing middleware |
| Vendor Performance Trend + High-risk vendors | Average reliability over time, at-risk table | reliability history |
| Audit & Activity | Flagged compliance issues + activity feed | `activity_logs` |

**How system statistics are measured.** `services/monitoring.py` is an ASGI
middleware that times every API request and records which user token made it.
API response time is the measured mean / p95 of the last 2,000 requests (the
polling endpoints are excluded so they don't skew it). Active sessions are
users seen in the last 15 minutes. Availability is the share of measured
requests that did not end in a server error. Nothing is simulated.

---

## 3. Live monitoring

`GET /dashboards/live` returns a short fingerprint of the tables behind the
dashboards (latest activity id, PO count and last update, vendor/contract
changes, reliability snapshots, messages, invoices) plus the newest activity
and notification. The frontend `LiveService` polls it every 5 seconds (paused
while the browser tab is hidden). When the fingerprint changes:

- the open dashboard re-fetches its payload and the charts **animate** from the
  old values to the new ones (Chart.js updates in place - no flicker, no reload);
- the activity feed highlights the new events;
- a new notification appears as a toast with a link to the record;
- the bell badge updates.

Verified: creating a purchase order from another session changed the
Procurement dashboard's PO count and activity feed within ~3 seconds.

The top bar shows `Live · synced Ns ago`; clicking it pauses/resumes.

---

## 4. Uploading an Excel sheet

*Administration -> Data Import* (Administrator, Procurement Manager, Supply
Chain Manager).

1. **Upload** an `.xlsx` or `.csv` (drag & drop). Up to 150 MB.
2. **Validate** - the server runs the entire import inside a transaction and
   rolls it back. You see each recognised sheet, how its columns were mapped,
   sample rows, and every rejected row with its row number and reason.
3. **Import** - the same import runs for real. Rows with errors are skipped;
   everything else is written.
4. **Rescore & refresh** - every vendor is rescored, the alert sweep runs, and
   open dashboards update through the live probe.

Every import is recorded in *Import history* and the activity log.

### Workbook layout

*Download template* gives a ready workbook with an Instructions sheet,
drop-down validation and example rows. One record type per sheet; sheet and
column names are matched loosely (e.g. `Supplier Master` -> Vendors,
`PO No` -> po_number, `GST` -> tax_rate).

| Sheet | Required | Useful optional columns |
| --- | --- | --- |
| Vendors | vendor_name, category | vendor_code, status (default Approved), contact_person, email, phone, address, city, state, postal_code, country, tax_id, registration_number, company_type, year_established, products_services |
| Certifications | vendor, certification_name | issuing_authority, certificate_number, issue_date, expiry_date |
| Procurement Requests | item, quantity | request_number, category, unit, estimated_cost, required_date, priority, department, status, vendor |
| Purchase Orders | vendor | po_number (repeat it for multi-line orders), title, department, order_date, expected_delivery, actual_delivery, status, currency, payment_terms, item_name, quantity, unit_price or line_total, tax_rate, quality_rating |
| Invoices | amount | invoice_number, po_number, invoice_date, due_date, tax_amount, status, payment_date |
| Contracts | vendor, start_date, expiry_date | contract_number, title, contract_type, contract_value, status (blank = derived from dates), compliance_status, auto_renew, renewal_notice_days |
| Performance | vendor, quality_rating | po_number, evaluation_date, service_rating, response_time, issue_resolution_time |

Rules applied during import match the application's business rules:

- Vendors are imported first so later sheets can reference them by name or code.
- Blank codes / numbers are generated (`VND-`, `PO-`, `CT-`, `INV-`, `PR-`).
- Re-importing a row with an existing code or number **updates** it.
- Purchase orders can only be raised against **Approved** vendors.
- An `actual_delivery` date marks an order delivered; on-time vs delayed is
  computed from `expected_delivery`, and a performance evaluation is created
  (with `quality_rating` if supplied) - exactly how the ETL builds history.
- `tax_rate` is a percentage (18 = 18%; 0.18 is also understood).

### DataCo dataset

Uploading `DataCoSupplyChainDataset.csv` (or an `.xlsx` copy) is detected
automatically. The preview shows rows, distinct orders and the date span; the
import rebuilds the dataset-derived history through `etl/load_dataco.py`
(same as the command-line loader), backfills 12 months of reliability history
and rescores every vendor. The full 180k-row file imports in about 20 seconds.

---

## 5. Vendor registration application

Opened from the **Register Vendor** button (top-right of every screen) or the
public **Register as Vendor** page (`/apply`, linked from the login screen).

| Step | Captures |
| --- | --- |
| Company | legal name, company type, registration no. (CIN), tax ID (GSTIN/VAT), year established, employees, turnover, website |
| Business | one of the six mandatory categories (visual picker), products & services |
| Contacts | company email/phone, full address, one or more contact persons (name, designation, department, email, phone, primary) |
| Compliance | certifications with expiry dates; supporting documents (drag & drop, typed) |
| Portal Access (public only) | optional vendor login |
| Review | summary with edit links and mandatory declaration |

`POST /vendor-applications` (multipart) creates the vendor as **Pending** with
its contacts, certifications, documents and approval-history entry, logs the
activity and notifies Administrators and Procurement Managers. Duplicate names,
registration numbers or tax IDs are rejected. The new vendor appears in the
Approvals queue; its profile shows the application details and documents.

---

## 6. Create Purchase Order

`/purchase-orders/new` follows the *Order Creation Format* reference:

- **Order details** - auto PO number, order date, expected delivery, procurement
  request (approved requests only; choosing one pre-fills department, vendor and
  the line item), department, vendor (approved vendors only, with reliability
  score and risk in the list), payment terms, title, shipping and billing
  address (with "same as shipping").
- **Order items** - item, quantity, unit, unit price, tax %, live line totals;
  add/remove lines.
- **Order summary** - subtotal, tax, shipping, animated total, currency, remarks
  (500 characters).
- **Vendor intelligence** - the chosen vendor's score, risk, rank, trend,
  predicted delay risk and the engine's recommendation.
- **Save as Draft** keeps the form in the browser until you return;
  **Submit for Approval** creates the PO as Pending.

Line tax rates are stored per item; the order's tax is the sum of the line
taxes.

---

## 7. New API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dashboards/procurement` | Procurement dashboard payload (filters: start, end, category, vendor_id, risk_level, months) |
| GET | `/dashboards/vendor` | Vendor dashboard payload (vendor_id for staff) |
| GET | `/dashboards/admin` | Admin dashboard payload (Administrator only) |
| GET | `/dashboards/live` | Change fingerprint, unread count, newest activity/notification |
| GET | `/dashboards/system` | Live system statistics (Administrator only) |
| GET | `/vendor-applications/options` | Categories, company types, document types (public) |
| POST | `/vendor-applications` | Submit an application (public or staff) |
| POST | `/data-import/preview` | Upload + dry-run validation |
| POST | `/data-import/commit` | Import a previewed upload |
| GET | `/data-import/template` | Excel template |
| GET | `/data-import/history` | Past imports |
| GET | `/purchase-orders?month=YYYY-MM` | Month drill-down (new filter) |

---

## 8. Tests

```bash
python tests/smoke_test.py        # 110 checks
python tests/milestone3_test.py   # 130 checks
python tests/milestone4_test.py   #  59 checks
```

`milestone4_test.py` checks every dashboard block, filters, vendor scoping,
admin-only access, the live fingerprint changing after a new PO, per-line tax
arithmetic, the month filter, the application flow (documents, certifications,
portal login, duplicate and declaration rules) and the import (loose sheet and
column matching, row-level errors, dry run writing nothing, multi-line POs,
tax, completion status, history, single-use upload tokens).

---

## 9. Design notes

- **Theme** - dark by default with a light alternative (sun/moon in the top
  bar); all colours are CSS tokens, so every existing screen follows the theme.
- **Charts** - Chart.js (from the project tech stack), wrapped in
  `shared/viz/viq-chart.ts` so charts read their colours from the theme and
  update in place. Categorical colours come from a colour-blind-validated
  palette and are fixed per entity (a status or category keeps its colour when
  filters change); risk and compliance use a separate status palette.
- **Motion** - route transitions (View Transitions API), staggered card
  entrance, count-up KPIs, animated gauge, shimmer while refreshing, flashing
  new activity. Motion is disabled for users who prefer reduced motion.
- **Offline-ready** - Inter, Plus Jakarta Sans, JetBrains Mono and Material
  Icons are bundled from npm instead of loaded from Google Fonts.
