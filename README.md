# Vendor Reliability Intelligence & Procurement Risk Management Platform

A modern, full-stack enterprise web application designed to manage supplier information, procurement operations, authentication, vendor reliability, and supply chain risk intelligence.

---

## 🚀 Overview

The **Vendor Reliability Intelligence Platform** empowers organizations to streamline procurement operations, perform vendor risk evaluations, track purchase order fulfillments, monitor contract compliance, and leverage predictive analytics for supplier selection.

### Milestone 1 Focus: Foundation & Authentication
Milestone 1 establishes the core application architecture, database infrastructure, security subsystem, authentication APIs, user role administration foundation, responsive Angular dashboard, and module placeholder architecture.

---

## 🛠 Tech Stack

### Backend
* **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+)
* **Database ORM:** [SQLAlchemy 2.0](https://www.sqlalchemy.org/)
* **Database Engine:** [PostgreSQL](https://www.postgresql.org/) (with SQLite fallback for local standalone dev)
* **Migrations:** [Alembic](https://alembic.sqlalchemy.org/)
* **Validation & Settings:** [Pydantic v2](https://docs.pydantic.dev/) & Pydantic-Settings
* **Authentication:** JWT (JSON Web Tokens) via `pyjwt` / `python-jose`
* **Password Hashing:** `passlib[bcrypt]` / `bcrypt`
* **ASGI Server:** [Uvicorn](https://www.uvicorn.org/)
* **Testing:** Pytest & HTTPX

### Frontend
* **Framework:** [Angular 17+](https://angular.io/) (Standalone Architecture)
* **Language:** TypeScript 5+
* **UI Components:** [Angular Material](https://material.angular.io/) & Bootstrap 5
* **State & Reactive Streams:** RxJS
* **HTTP Client:** Angular HttpClient with Auth Interceptor

### DevOps & Tools
* **Containerization:** Docker & Docker Compose
* **CI/CD:** GitHub Actions
* **API Documentation:** OpenAPI (Swagger UI) at `/docs`

---

## 📁 Project Folder Structure

```
vendor-reliability-platform/
│
├── README.md
├── .gitignore
├── docker-compose.yml
│
├── docs/
│   ├── requirements/
│   │   ├── project-objectives.md
│   │   ├── functional-requirements.md
│   │   └── non-functional-requirements.md
│   │
│   ├── ui/
│   │   ├── ui-wireframes.md
│   │   ├── user-flows.md
│   │   └── dashboard-layout.md
│   │
│   └── database/
│       ├── database-design.md
│       └── er-diagram.md
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   │
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   │
│   │   ├── database/
│   │   │   ├── __init__.py
│   │   │   ├── connection.py
│   │   │   └── base.py
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── user.py
│   │   │
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   └── user.py
│   │   │
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   └── auth.py
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── auth_service.py
│   │   │
│   │   └── dependencies/
│   │       ├── __init__.py
│   │       └── auth.py
│   │
│   ├── alembic/
│   │   └── versions/
│   │       └── 001_initial_users.py
│   │
│   ├── tests/
│   │   └── test_auth.py
│   │
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── services/
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   └── api.service.ts
│   │   │   │   ├── guards/
│   │   │   │   │   └── auth.guard.ts
│   │   │   │   └── interceptors/
│   │   │   │       └── auth.interceptor.ts
│   │   │   │
│   │   │   ├── shared/
│   │   │   │   ├── components/
│   │   │   │   └── models/
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   └── dashboard/
│   │   │   ├── vendors/
│   │   │   │   └── vendor-management/
│   │   │   ├── procurement/
│   │   │   │   └── procurement-dashboard/
│   │   │   ├── purchase-orders/
│   │   │   │   └── purchase-order-list/
│   │   │   ├── performance/
│   │   │   │   └── vendor-performance/
│   │   │   ├── analytics/
│   │   │   │   └── analytics-dashboard/
│   │   │   ├── reports/
│   │   │   │   └── reports-dashboard/
│   │   │   ├── notifications/
│   │   │   │   └── notification-screen/
│   │   │   │
│   │   │   ├── app.routes.ts
│   │   │   └── app.component.ts
│   │   │
│   │   ├── assets/
│   │   ├── styles.css
│   │   └── index.html
│   │
│   ├── angular.json
│   ├── package.json
│   └── Dockerfile
│
└── .github/
    └── workflows/
        └── ci.yml
```

---

## 👥 User Roles

The system enforces six core user roles:

| Role Name | Description | Key Responsibilities |
| :--- | :--- | :--- |
| **`ADMINISTRATOR`** | System Admin | System administration, user provisioning, global platform settings |
| **`PROCUREMENT_MANAGER`** | Procurement Oversight | Vendor evaluation, requisition approvals, PO management |
| **`SUPPLY_CHAIN_MANAGER`**| Logistics & Operations | Supplier SLA tracking, lead time monitoring, fulfillment risk |
| **`VENDOR`** | External Partner | Profile maintenance, PO acknowledgment, invoice submission |
| **`FINANCE_OFFICER`** | Financial Controls | Invoice matching, payment release, procurement budget tracking |
| **`AUDITOR`** | Compliance & Audit | Read-only access to risk reports, historical logs, audit trails |

---

## ⚡ Quick Start & Installation

### Prerequisites
* Python 3.10+
* Node.js 18+ & npm
* PostgreSQL 14+ (or Docker)

### Environment Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/organization/vendor-reliability-platform.git
   cd vendor-reliability-platform
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate

   pip install -r requirements.txt
   cp .env.example .env
   ```

3. **Run Database Migrations:**
   ```bash
   alembic upgrade head
   ```

4. **Start Backend Server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   * Access API Documentation: `http://localhost:8000/docs`
   * Health Check: `http://localhost:8000/health`

5. **Frontend Setup:**
   ```bash
   cd ../frontend
   npm install
   npm start
   ```
   * Open browser at `http://localhost:4200`

---

## 🔑 Authentication Flow

```
[ Register Page ]  ---> POST /api/auth/register ---> DB Insert (Hashed Pass + Role)
                                                         │
[ Login Page ]     <--- Redirect after Registration <────┘
     │
     └───> POST /api/auth/login ---> Verify Credentials ---> Returns JWT Access Token
                                                                   │
                                 Store JWT in LocalStorage ◄───────┘
                                           │
  Attach 'Authorization: Bearer <token>' ──┼──> Protected GET /api/auth/me
                                           │
                                           └───> Allow Access to Dashboard & Protected Routes
```

---

## 📡 API Endpoints (Milestone 1)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server status health check | No |
| `POST` | `/api/auth/register` | Register new user with assigned role | No |
| `POST` | `/api/auth/login` | Authenticate user and issue JWT token | No |
| `GET` | `/api/auth/me` | Retrieve profile of authenticated user | Yes (JWT) |

---

## 🐳 Docker Deployment

To spin up the entire application stack (PostgreSQL, FastAPI backend, Angular frontend) using Docker Compose:

```bash
docker-compose up --build -d
```

---

## 🎯 Milestone Roadmap

- [x] **Milestone 1 (Completed):** Requirements, Database Schema, FastAPI Setup, JWT Auth, User Roles, Angular Setup, Material UI, Auth Guards/Interceptors, Dashboard & Module Placeholders.
- [ ] **Milestone 2 (Planned):** Vendor Management CRUD, Procurement Workflow, Purchase Orders Backend, Contract Repository, Notifications Subsystem.
- [ ] **Milestone 3 (Planned):** Vendor Reliability Scoring Model, Predictive Risk Intelligence, PDF/Excel Reporting, Advanced Analytics Engine.
