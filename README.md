<<<<<<< HEAD
# VendorIQ — Vendor Reliability Intelligence Platform

Full-stack vendor reliability, procurement and contract management platform.

**Stack:** FastAPI + SQLAlchemy + PostgreSQL · Angular 21 + Angular Material

**Status:** Milestones 1, 2 and 3 complete.

Vendor performance monitoring, six-factor reliability scoring, delivery-delay
prediction, interactive analytics and PDF/Excel reporting are all live, driven
by ~6,000 purchase orders of real trading history loaded from the DataCo
supply chain dataset.

---

## Quick start

### 1. Database

PostgreSQL must be running with a `vendor_iq` database. Connection details live
in `backend/.env`.

```bash
createdb -U postgres vendor_iq
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python seed.py
python -m uvicorn main:app --reload --port 8000
```

`python seed.py` **drops and recreates the `public` schema** from
`database/schema.sql`, then loads the demo dataset. Use `python seed.py --keep`
to seed without rebuilding the schema.

### 2b. Dataset, model and scoring

Milestone 3 needs trading history to measure. Put
`DataCoSupplyChainDataset.csv` in `data/` (or set `DATASET_PATH`), then:

```bash
python -m ml.train_delay_model              # train the delivery-delay model
python -m etl.load_dataco                   # 24 months of purchase orders
python -m services.reliability --backfill 12  # score vendors + build history
python -m services.notifier                 # derive alerts from current data
```

All three loader steps are idempotent — safe to re-run. See
[docs/dataset-guide.md](docs/dataset-guide.md) for what the dataset contains,
which columns are used, what the model predicts and how it is validated.

API docs: <http://127.0.0.1:8000/docs>

### 3. Frontend

```bash
cd frontend
npm install
npx ng serve
```

App: <http://localhost:4200>

The API base URL is set in `frontend/src/environments/environment.ts`.

---

## Demo accounts

Every demo account uses the password **`VendorIQ@2026`**.

| Role | Email |
| --- | --- |
| Administrator | `admin@vendoriq.com` |
| Procurement Manager | `procurement@vendoriq.com` |
| Supply Chain Manager | `supplychain@vendoriq.com` |
| Finance Officer | `finance@vendoriq.com` |
| Auditor | `auditor@vendoriq.com` |
| Vendor | `northwind@vendor.vendoriq.com` |
| Vendor | `meridian@vendor.vendoriq.com` |
| Vendor | `arclight@vendor.vendoriq.com` |

The login screen lists these as click-to-fill chips.

---

## Tests

With the API running on port 8000:

```bash
python tests/smoke_test.py        # 110 checks - Milestones 1 & 2
python tests/milestone3_test.py   # 130 checks - Milestone 3
```

240 end-to-end checks covering authentication, RBAC, every module, the
reliability arithmetic, the model's leakage guards, filter behaviour, the
alert sweep, real PDF/XLSX exports and the 300 ms response-time target.

Both suites derive their expectations from the live data rather than asserting
fixed seed totals, so they are safe to re-run after reloading the dataset.

---

## Project layout

```
backend/
  main.py              FastAPI app, CORS, router registration, model warm-up
  config.py            Settings loaded from .env
  database.py          Engine, session factory, declarative base
  security.py          bcrypt hashing, JWT issue/decode, reset tokens
  deps.py              get_current_user, RBAC guards, vendor scoping
  models/              SQLAlchemy models
  schemas/             Pydantic request/response models
  api/                 Routers, one per module
  services/
    numbering.py       Document numbering (VND-0001, PO-2026-0001, ...)
    events.py          Notification fan-out and activity logging
    performance.py     Vendor performance metrics, aggregated in SQL
    reliability.py     Six-factor scoring, risk, ranking, recommendations
    analytics.py       Filtered aggregations behind the dashboards
    reporting.py       Report datasets + PDF / Excel rendering
    notifier.py        Alert sweep, email (SMTP) and SMS (Twilio) dispatch
  ml/
    dataset.py         DataCo loading, supplier assignment, features
    train_delay_model.py   Trains the classifier (chronological split)
    predictor.py       Cached runtime inference
    artifacts/         Trained model + its metrics
  etl/load_dataco.py   Loads dataset history into PostgreSQL
  seed.py              Schema rebuild + demo dataset
database/
  schema.sql           Full PostgreSQL DDL
  ER_Diagram.png       Entity relationship diagram
  backups/             pg_dump snapshots
frontend/
  src/app/core/        Models, services, auth, interceptor, guards
  src/app/layout/      Application shell (sidebar + top bar)
  src/app/features/    One folder per feature screen
  src/app/shared/      Status pill, confirm dialog, date helpers
  src/app/shared/charts/   Line, bar, donut, radar, gauge (inline SVG)
frontend_legacy/       The original vanilla HTML/JS prototype
data/                  DataCoSupplyChainDataset.csv + its field reference
docs/                  Requirements, wireframes, guides, milestone reports
tests/                 End-to-end API test suites
```

---

## Roles and permissions

| Capability | Admin | Procurement Mgr | Supply Chain Mgr | Finance | Auditor | Vendor |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| View vendors / procurement / orders / contracts | ✔ | ✔ | ✔ | ✔ | ✔ | own only |
| Register & edit vendors | ✔ | ✔ | ✔ | — | — | — |
| Approve / reject / suspend vendors | ✔ | ✔ | — | — | — | — |
| Raise & edit procurement requests | ✔ | ✔ | ✔ | — | — | — |
| Approve / reject procurement requests | ✔ | ✔ | — | — | — | — |
| Assign vendors to requests | ✔ | ✔ | ✔ | — | — | — |
| Raise purchase orders, change status | ✔ | ✔ | ✔ | — | — | — |
| Record & settle invoices | ✔ | — | — | ✔ | — | — |
| Create & renew contracts, record compliance | ✔ | ✔ | ✔¹ | — | — | — |
| Read the activity log | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Manage user accounts | ✔ | — | — | — | — | — |
| Message vendors | ✔ | ✔ | ✔ | ✔ | ✔ | own only |

¹ Supply Chain Managers can create contracts and record compliance checks;
renewal and termination are restricted to Administrators and Procurement
Managers.

Vendor logins are scoped server-side to their own `vendor_id` — vendor records,
purchase orders, invoices, contracts, conversations and the dashboard activity
feed are all filtered before they leave the API.

---

## Milestone 3: how the intelligence is computed

**Reliability score** — six factors, each 0-100, combined by configurable
weights: Delivery History (0.30), Product Quality (0.20), Communication
Efficiency (0.15), Contract Compliance (0.15), Purchase History (0.10),
Issue Resolution (0.10). A factor with no evidence is dropped and the
remaining weights renormalise, so a vendor is never punished for a module it
has no history in.

**Risk level** — the score maps onto a band (73 / 65 / 55), then a high
model-predicted delay probability pushes a vendor one band worse, and fewer
than five orders marks the score provisional.

**Delivery-delay model** — predicts the probability that an open purchase
order misses its committed date, from attributes known when the order is
raised. Trained on 135k rows with a chronological split and an automated
leakage audit. Held-out accuracy **0.8008** against a majority baseline of
0.7662 and a Bayes-optimal ceiling of **0.8009** - the model is at the
information limit of the data. Full detail and caveats in
[docs/dataset-guide.md](docs/dataset-guide.md).

**Everything is live** - every dashboard figure is aggregated in SQL from the
operational tables at request time. Changing a filter changes the query, not
the rendering.

See [docs/workflow-guide.md](docs/workflow-guide.md) for the screen-by-screen
walkthrough and the end-to-end demonstration script.

---

## Key business rules

- **Vendor codes, request/PO/contract/invoice numbers** are generated
  automatically (`VND-0001`, `PR-2026-0001`, `PO-2026-0001`, `CT-2026-0001`,
  `INV-2026-0001`).
- **New vendors always start `Pending`** and enter the approval queue.
- **Only `Approved` vendors** can be assigned to requests or receive purchase
  orders.
- **Rejections require a reason**, which is surfaced to the vendor/requester.
- **Purchase order transitions are enforced server-side:**
  `Pending → Approved → Ordered → Delivered → Completed`, with `Cancelled`
  reachable from any pre-delivery state. Illegal jumps are rejected.
- **A purchase order carries its parent request forward** — raising a PO moves
  the request to `Ordered`; completing the PO completes the request.
- **Delivery delays** are computed from `expected_delivery` vs `actual_delivery`
  (or today, for open orders) and raise a notification.
- **Contract lifecycle is date-driven:** `Active` contracts flip to `Expiring`
  inside the renewal notice window and `Expired` past the expiry date.
- **A failed compliance check** flips the contract to `Non-Compliant` and alerts
  procurement and audit.
- **Deletes preserve history:** vendors with transactions become `Inactive`,
  in-progress purchase orders are cancelled rather than deleted, active
  contracts must be terminated, paid invoices cannot be deleted, and user
  accounts are deactivated rather than removed.

---

## Notes

- `SECRET_KEY` in `backend/.env` is a development value and must be replaced
  before any non-local deployment.
- `POST /auth/forgot-password` returns the reset token in the response body so
  the flow is demonstrable without an SMTP server. Wire this to email before
  production and stop returning the token.
- Email (SMTP) and SMS (Twilio) alert delivery are implemented but disabled by
  default. With no credentials configured the alert is still raised in-app and
  the payload is logged, so the flow is demonstrable without a mail server -
  and `email_sent` stays `false` rather than claiming a delivery that did not
  happen. Enable with `EMAIL_ENABLED` / `SMS_ENABLED` in `backend/.env`.
- Docker, cloud deployment and load testing are Milestone 4 scope.
- `frontend_legacy/` holds the original single-file prototype, kept for
  reference. It is not part of the build.
=======
# Vendor-Reliability-Intelligence-Platform
Predictive Vendor Intelligence Platform for Supplier Risk and Performance Management
>>>>>>> cef37cba8743d922078aa9d856f597fbe9c3d722
