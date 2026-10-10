# Procurement & Vendor Reliability Platform

A full-stack, role-based procurement management system that tracks vendors, procurement requests, purchase orders, contracts, and vendor performance — with real-time dashboards, reports, notifications, and internal messaging.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Angular 21 (standalone components, Angular Router, Chart.js) |
| **Backend** | FastAPI 0.115, Python 3.12, SQLAlchemy 2 async |
| **Database** | PostgreSQL 16 |
| **Cache / Token Store** | Redis 7 (in-memory fallback if Redis is unavailable) |
| **Auth** | JWT (access + refresh tokens) with bcrypt password hashing |
| **Migrations** | Alembic (6 versioned migration files) |
| **Reports** | ReportLab (PDF) + openpyxl (Excel) |
| **Container** | Docker + Docker Compose |

---

## Folder Structure

```
vendor-reliability-platform/
├── backend/                  # FastAPI Python backend
│   ├── app/
│   │   ├── main.py           # App factory, lifespan hooks, router registration
│   │   ├── config.py         # Pydantic settings (reads from .env)
│   │   ├── database.py       # SQLAlchemy async engine + Redis manager
│   │   ├── models.py         # All ORM models
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── security.py       # JWT helpers, password hashing, auth dependencies
│   │   └── routers/          # auth, admin, vendors, procurement, purchase_orders,
│   │                         # contracts, performance, dashboard, notifications,
│   │                         # reports, communication
│   ├── alembic/              # Database migrations (0001 → 0006)
│   ├── uploads/              # Uploaded files (POs, contracts, messages)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/                 # Angular 21 SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/         # AuthService, ApiService, authInterceptor guard
│   │   │   ├── pages/        # Login, Register, Dashboard, Vendors, Procurement,
│   │   │   │                 # PurchaseOrders, Contracts, Performance, Reports,
│   │   │   │                 # Notifications, Communication
│   │   │   └── components/   # ChartCard, shared UI components
│   │   └── environments/     # environment.ts (API base URL)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docs/
│   ├── API.md                # Endpoint group reference (→ /docs for full detail)
│   └── SETUP.md              # Step-by-step developer setup guide
├── docker-compose.yml        # Full-stack: postgres + redis + backend + frontend
├── .env.example              # Docker environment variable template
└── README.md                 # This file
```

---

## Roles

| Role | Capabilities |
|---|---|
| Administrator | Full system access, user approval/rejection |
| Procurement Manager | PRs, POs, vendors, contracts, reports |
| Supply Chain Manager | Vendors, POs, performance, reliability |
| Finance Officer | POs, contracts, financial reports |
| Vendor | View own data, communication |
| Auditor | Read-only access to all data and reports |

---

## Quick Start

### Option 1 — Docker Compose (recommended)

**Prerequisites:** Docker 24+ with the Compose plugin.

```bash
# 1. Clone
git clone <repo-url> vendor-reliability-platform
cd vendor-reliability-platform

# 2. Configure
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD and SECRET_KEY at minimum

# 3. Build & start everything
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:4200/ |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |

**Default admin credentials:** `admin@example.com` / `Admin@123456`

```bash
# Stop (keeps data)
docker compose down

# Full reset (removes volumes)
docker compose down -v
```

---

### Option 2 — Manual Local Setup

**Prerequisites:** Python 3.11+, Node 20+, PostgreSQL 15+, Redis 7+ (optional).

```bash
# ── Backend ──────────────────────────────────────────────────────────────────
cd backend
python -m venv .venv && .venv\Scripts\Activate.ps1    # Windows
# source .venv/bin/activate                            # macOS / Linux
pip install -r requirements.txt
cp .env.example .env        # fill in DATABASE_URL, SECRET_KEY, etc.
alembic upgrade head
uvicorn app.main:app --reload   # http://localhost:8000

# ── Frontend (second terminal) ────────────────────────────────────────────────
cd frontend
npm install
npm start                       # http://localhost:4200
```

→ See **[docs/SETUP.md](docs/SETUP.md)** for the complete step-by-step guide including environment variable reference and troubleshooting.

---

## API Documentation

All endpoints are described at **[docs/API.md](docs/API.md)**.

Interactive Swagger UI (with live "Try it out"): **http://localhost:8000/docs**

---

## Milestone Summary

### Milestone 1 — Core Foundation
- Database schema and Alembic migrations (users, roles, vendors, procurement requests, line items)
- JWT authentication (register, login, refresh, logout)
- Role-based access control (6 roles)
- Admin user-approval workflow
- Vendor CRUD with status management and contacts
- Procurement Request lifecycle (draft → submitted → approved/rejected)

### Milestone 2 — Procurement Operations
- Purchase Order management (creation from PRs, line items, status workflow)
- Contract management (creation, lifecycle, document uploads)
- Vendor Performance evaluations (KPI ratings, historical tracking)
- Vendor Reliability scoring (SLA compliance, defect rate, delivery punctuality)
- In-app Notifications (auto-created on key state transitions)
- File upload support for PO and contract documents

### Milestone 3 — Dashboards, Reports & Communication
- Role-specific dashboards (Procurement, Vendor, Admin, Supply Chain, Finance) with live Chart.js charts
- Reports module with PDF and Excel export (procurement, vendor-performance, financial)
- Analytics endpoints (spend trend, vendor risk distribution)
- Internal Communication module (threaded messaging with file attachments)
- Activity log for audit trail
- Vendor cascade-delete (safely removes all related records)

### Milestone 4 — Testing, Deployment & Documentation
- **Code quality:** Fixed all `pyflakes` warnings (unused imports in `dashboard.py`, `vendors.py`)
- **Docker:** `backend/Dockerfile`, `frontend/Dockerfile` (multi-stage with nginx), root `docker-compose.yml` (4 services, health checks, volumes)
- **Documentation:** `README.md`, `docs/API.md`, `docs/SETUP.md`
- **Deployment-ready:** Single `docker compose up --build` brings up the entire stack

---

## Production Deployment Notes

The Docker Compose setup is deployment-ready for any Docker-capable host (local machine, cloud VM, Render, Railway, etc.):

1. Copy `.env.example` → `.env` on the host
2. Set `SECRET_KEY`, `POSTGRES_PASSWORD`, `CORS_ORIGINS` (your production domain)
3. Run `docker compose up --build -d`
4. Point a reverse proxy (nginx, Traefik, Caddy) at ports 80 and 8000

> See **[docs/SETUP.md](docs/SETUP.md)** → *Security Notes for Production Deployment* for checklist.

---

## License

Internal project — all rights reserved.
