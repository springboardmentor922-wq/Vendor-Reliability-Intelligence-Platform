# Vendor Reliability Intelligence Platform

A web-based platform for vendor management, procurement, performance evaluation, reliability analysis, risk assessment and reporting.

**Stack:** FastAPI + SQLite · Angular

## Quick start

### 1. Backend

`cd backend`

`venv\Scripts\activate`

`python -m uvicorn app.main:app --reload`

### 2. Frontend

`cd frontend`

`ng serve`

**Application:** `http://localhost:4200/`

**API docs:** `http://localhost:8000/docs`

## Roles

| Role | Purpose |
|---|---|
| Administrator | Full platform management |
| Procurement Manager | Procurement and vendor operations |
| Supply Chain Manager | Supply chain and reliability operations |
| Finance Officer | Procurement and financial monitoring |
| Auditor | Reporting and audit activities |
| Vendor | Vendor-side operations |

## Modules

- **Dashboard** - Platform overview and recent activity
- **Vendors** - Vendor registration and management
- **Vendor Approval** - Vendor approval workflow
- **Procurement** - Procurement request management
- **Purchase Orders** - Purchase order and delivery tracking
- **Contracts** - Contract and certification management
- **Communication** - Vendor and procurement communication
- **Performance** - Vendor performance evaluation
- **Reliability** - Reliability scoring, ranking and risk analysis
- **Analytics** - Vendor and procurement analytics
- **Reports** - Vendor and procurement reports
- **Notifications** - System notifications and alerts

## Project layout

**Backend**

- `app/core` - Application configuration
- `app/database` - Database configuration
- `app/dependencies` - Authentication and authorization
- `app/models` - Database models
- `app/routers` - API routes
- `app/schemas` - Request and response schemas
- `app/services` - Business logic

**Frontend**

- `src/app/auth` - Login and authentication
- `src/app/dashboard` - Dashboard
- `src/app/vendors` - Vendor management
- `src/app/vendor-approval` - Vendor approval
- `src/app/procurement` - Procurement
- `src/app/purchase-orders` - Purchase orders
- `src/app/contracts` - Contracts
- `src/app/communications` - Communication
- `src/app/performance` - Vendor performance
- `src/app/reliability` - Reliability analysis
- `src/app/analytics` - Analytics
- `src/app/reports` - Reports
- `src/app/notifications` - Notifications

## Roles and permissions

| Capability | Admin | Procurement Mgr | Supply Chain Mgr | Finance | Auditor | Vendor |
|---|---:|---:|---:|---:|---:|---:|
| View vendor information | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Create vendors | ✔ | ✔ | — | — | — | — |
| Edit vendors | ✔ | ✔ | — | — | — | — |
| Approve / reject vendors | ✔ | ✔ | — | — | — | — |
| Create procurement requests | ✔ | ✔ | ✔ | — | — | — |
| Approve procurement requests | ✔ | ✔ | — | — | — | — |
| Create purchase orders | ✔ | ✔ | — | — | — | — |
| Track procurement data | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| View reliability data | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| View reports | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| View notifications | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

## Workflow

**Vendor Registration** → **Vendor Approval** → **Procurement Request** → **Purchase Order** → **Delivery & Invoice** → **Performance Evaluation** → **Reliability Analysis** → **Risk Analysis** → **Procurement Recommendation**

## Key business rules

- New vendors go through the vendor approval workflow.
- Only authorized users can perform vendor and procurement actions.
- Purchase orders follow the procurement workflow.
- Delivery information is used for vendor performance evaluation.
- Vendor performance contributes to reliability analysis.
- Reliability analysis provides risk levels and procurement recommendations.
- Contract and certification information is monitored.
- Important system activities generate notifications and activity records.

## Notes

- The backend uses SQLite as the project database.
- The frontend communicates with the FastAPI backend through REST APIs.
- Authentication uses JWT tokens.
- Role-based authorization controls access to protected operations.
- The project is intended for local development and demonstration.