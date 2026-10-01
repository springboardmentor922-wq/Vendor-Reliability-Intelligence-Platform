# VendorIQ — Vendor Reliability Intelligence & Procurement Risk Management Platform

Full-stack app (Angular + FastAPI + PostgreSQL) implementing:

- **Milestone 1** — JWT auth, role-based access control (6 roles), FastAPI + Angular scaffolding
- **Milestone 2** — Vendor Management, Procurement Management, Purchase Orders, Vendor Approval Workflow, Contract Management, Communication module

Milestones 3 (Performance/Reliability scoring, full Analytics Dashboards, Notifications, Reports & Export) and 4 (testing/deployment/docs) are not yet built — this delivers through Milestone 2 only, per your current request.

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

Full interactive docs (all request/response schemas) are generated automatically at `/api/docs` once the backend is running.

## Notes for your next milestones

- **Milestone 3** would add: Vendor Performance module (delivery/quality/response metrics computed from PO and message history), Vendor Reliability scoring, the three full Dashboard views (Procurement/Vendor/Admin) with charts, the Notification module's SMS/email delivery, and PDF/Excel report export.
- **Milestone 4**: testing, CI/CD, Docker deployment to a cloud host, and documentation — the Dockerfiles and docker-compose here are a starting point for that.
- I couldn't install packages in the sandbox that built this (no network access), so `py_compile` verified backend syntax but the app hasn't been run end-to-end — run `pip install -r requirements.txt` and start it locally as a first check before you build further on it.
