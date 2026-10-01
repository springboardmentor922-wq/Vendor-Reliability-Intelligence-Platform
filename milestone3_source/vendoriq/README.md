# VendorIQ — Vendor Reliability Intelligence & Procurement Risk Management Platform

Full-stack app (Angular + FastAPI + PostgreSQL) implementing:

- **Milestone 1** — JWT auth, role-based access control (6 roles), FastAPI + Angular scaffolding
- **Milestone 2** — Vendor Management, Procurement Management, Purchase Orders, Vendor Approval Workflow, Contract Management, Communication module
- **Milestone 3** — Vendor Performance module, Vendor Reliability (core scoring engine), Analytics Dashboards, Notification System, Reports & Export, Procurement Analytics

Milestone 4 (testing, cloud deployment, documentation polish) is not yet built — this delivers through Milestone 3.

## What's new in Milestone 3

- **Vendor Performance** (`/api/v1/performance`): quality evaluations, issue tracking (with raised/resolved timestamps), and live-computed metrics — on-time/delayed deliveries, quality rating, response time, issue resolution time, order completion rate, vendor ranking. Nothing is typed in by hand; every number is a query over `purchase_orders`, `quality_evaluations`, `issues` and `messages`.
- **Vendor Reliability** (`/api/v1/reliability`, `app/services/reliability_service.py`): the six-factor weighted score (Delivery 25%, Quality 25%, Communication 10%, Compliance 15%, Purchase History 10%, Issue Resolution 15%) from the intern guide's worked example, stored as a new history row on every recalculation so trends are never lost. Produces a risk level (Low ≥80 / Medium ≥60 / High <60), override rules (suspended vendor, expired cert/contract), a trend vs. the previous score, and a plain-language recommendation. Shown on the vendor detail panel and on the procurement Vendor Assignment screen.
- **Analytics Dashboards** (`/api/v1/analytics`): Procurement Dashboard, Vendor Dashboard, Admin Dashboard, Vendor Risk Dashboard, Procurement Spend, Procurement Analytics (cycle time, PO processing time, supplier concentration) — all database-driven, all in the Angular `/analytics` page.
- **Notification System** (`/api/v1/notifications`): an on-demand "run checks" action scans contracts/certifications expiring soon and notifies Admins/Procurement Managers (in-app + a simulated email log, since no live SMTP is configured in this environment — see `app/services/notification_service.py` for the integration point). In production this endpoint would be called by a scheduled job (Celery beat / cron) instead of a button.
- **Reports & Export** (`/api/v1/reports`): Vendor Performance, Procurement, Purchase Order, Compliance and Contract reports, each previewable as JSON or downloadable as Excel (openpyxl) or PDF (reportlab) from the Angular `/reports` page.

Trigger a vendor's first reliability score from its detail panel (Vendors → click a row → "Recalculate Reliability Score") before expecting to see it on Supplier Ranking or the Vendor Risk dashboard — there's no scheduled job running in this environment to do it automatically yet.

## Project layout

```
vendoriq/
  backend/    FastAPI app (SQLAlchemy, JWT, Pydantic v2)
  frontend/   Angular 17 standalone app (Bootstrap 5)
  docker-compose.yml
```

## Quick start (Docker)

```bash
cd vendoriq
cp backend/.env.example backend/.env   # edit SECRET_KEY etc.
docker compose up --build
```

- API: http://localhost:8000 (docs at `/api/docs`)
- Frontend: http://localhost:4200 (served by nginx in the container) — or run `ng serve` locally for dev

## Quick start (local, no Docker)

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```
No `DATABASE_URL` set → it auto-falls back to a local SQLite file (`vendoriq.db`) so you can run it immediately. Set `DATABASE_URL=postgresql://user:pass@host:5432/db` in `.env` to use Postgres, per the project's tech stack.

On first startup the app auto-creates all tables and seeds an admin user:
- Email: `admin@vendoriq.com`
- Password: `Admin@123`
(override via `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` in `.env`)

**Frontend**
```bash
cd frontend
npm install
npm start        # ng serve, http://localhost:4200
```
`src/environments/environment.ts` points at `http://localhost:8000/api/v1` — update if your API runs elsewhere.

## Roles

`administrator`, `procurement_manager`, `supply_chain_manager`, `vendor`, `finance_officer`, `auditor` — set at registration, editable by an admin via `PUT /api/v1/users/{id}`.

## API surface (Milestone 2)

| Module | Base path | Highlights |
|---|---|---|
| Auth | `/api/v1/auth` | register, login, login-json, me |
| Users | `/api/v1/users` | list/update (admin), self profile & password |
| Vendors | `/api/v1/vendors` | register, list/filter, update, `/approval`, contacts |
| Procurement | `/api/v1/procurement` | create, list/filter, `/approval`, `/assign-vendor/{id}` |
| Purchase Orders | `/api/v1/purchase-orders` | create (with line items), `/status`, invoices |
| Contracts | `/api/v1/contracts` | create, list/filter, `/renew`, `/expiring/soon`, certifications |
| Communication | `/api/v1/communication` | messages, `/activity-logs`, `/notifications` |
| Dashboard | `/api/v1/dashboard/summary` | lightweight cross-module counts |
| Vendor Performance | `/api/v1/performance` | quality evals, issues, `/vendors/{id}/metrics`, `/vendors/{id}/history`, `/ranking` |
| Vendor Reliability | `/api/v1/reliability` | `/vendors/{id}/calculate`, `/vendors/{id}/history`, `/ranking`, `/risk-summary` |
| Analytics | `/api/v1/analytics` | `/procurement-dashboard`, `/vendor-dashboard/{id}`, `/admin-dashboard`, `/vendor-risk-dashboard`, `/procurement-spend`, `/procurement-analytics` |
| Notifications | `/api/v1/notifications` | `/run-checks` (contract/cert expiry scan), `/email-logs` |
| Reports & Export | `/api/v1/reports` | `vendor-performance`, `procurement`, `purchase-orders`, `compliance`, `contracts` — each with `?format=json\|xlsx\|pdf` |

Full interactive docs (all request/response schemas) are generated automatically at `/api/docs` once the backend is running.

## Notes for your next milestone

- **Milestone 4**: testing, CI/CD, Docker deployment to a cloud host, and documentation — the Dockerfiles and docker-compose here are a starting point for that. Also worth adding before a real deployment: live SMTP/Twilio credentials (`app/services/notification_service.py` has the single integration point), a Celery beat schedule to call `/api/v1/notifications/run-checks` and create performance snapshots automatically instead of on demand, and Alembic migrations in place of `create_all`.
- I couldn't install packages in the sandbox that built this (no network access), so `py_compile` verified backend syntax but the app hasn't been run end-to-end — run `pip install -r requirements.txt` and start it locally as a first check before you build further on it.
