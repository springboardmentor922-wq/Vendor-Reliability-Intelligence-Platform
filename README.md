# Vendor Reliability Intelligence Platform

A web-based platform for vendor management, procurement, performance evaluation, reliability analysis, risk assessment, and reporting.

**Technology Stack:** Angular, FastAPI, SQLAlchemy, and SQLite/PostgreSQL (depending on the active database configuration).

## Quick Start

### 1. Start the Backend

Open Command Prompt:

```cmd
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload
```

Backend health check: `http://127.0.0.1:8000/health`

API documentation: `http://127.0.0.1:8000/docs`

### 2. Start the Frontend

Open a second Command Prompt:

```cmd
cd frontend
ng serve
```

Application: `http://localhost:4200/`

## User Roles

| Role | Purpose |
|---|---|
| Administrator | Platform administration |
| Procurement Manager | Vendor and procurement operations |
| Supply Chain Manager | Supply chain operations |
| Finance Officer | Financial monitoring |
| Auditor | Reporting and audit activities |
| Vendor | Vendor-side operations |

## Modules

- **Dashboard:** Platform overview, KPIs, purchase-order status, and recent activity
- **Vendors:** Vendor registration and management
- **Vendor Approval:** Vendor approval workflow
- **Procurement:** Procurement request management
- **Purchase Orders:** Purchase-order and delivery tracking
- **Contracts:** Contract management
- **Communication:** Vendor and procurement communication
- **Performance:** Vendor performance evaluation
- **Reliability:** Reliability scoring and ranking
- **Analytics:** Vendor and procurement analytics
- **Reports:** Vendor and procurement reports
- **Notifications:** System notifications and alerts

## Project Structure

### Backend

- `app/core` — Configuration and application settings
- `app/database` — Database connection and base models
- `app/dependencies` — Authentication and authorization
- `app/models` — Database models
- `app/routers` — API endpoints
- `app/schemas` — Request and response schemas
- `app/services` — Business logic

### Frontend

Located under `frontend/src/app/`. The application includes authentication, dashboard, vendors, vendor approval, procurement, purchase orders, contracts, communications, performance, reliability, analytics, reports, and notifications.

## Workflow

Vendor Registration → Vendor Approval → Procurement Request → Purchase Order → Delivery and Invoice → Performance Evaluation → Reliability Analysis → Risk Analysis → Procurement Recommendation

## Key Business Rules

- Vendor and procurement operations require appropriate authorization.
- Vendor approval follows an approval workflow.
- Purchase orders support procurement and delivery tracking.
- Performance data contributes to vendor reliability analysis.
- Reliability and risk analysis support procurement decisions.
- Contract information and system notifications support operational monitoring.
- Protected API endpoints use JWT authentication.

## Database and Configuration

- Backend API: FastAPI
- Frontend: Angular
- Database: Determined by the active `DATABASE_URL` in the backend environment configuration.
- Authentication: JWT access tokens
- The project is configured for local development and demonstration.

## License

This project includes an MIT License. See the `LICENSE` file for details.