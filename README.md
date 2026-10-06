# Vendor Intelligence & Procurement Management System
## Milestones 1–3 Implementation

This project is based on the uploaded internship milestone requirements.

### Technology
- Frontend: Angular 17+ (standalone components)
- UI: Angular Material
- Backend: FastAPI
- ORM: SQLAlchemy
- Database: PostgreSQL
- Authentication: JWT access token + role-based authorization
- Reports: Excel/CSV and PDF endpoints
- Charts: Chart.js

### Six roles
1. Administrator
2. Procurement Manager
3. Supply Chain Manager
4. Vendor
5. Finance Officer
6. Auditor

### Implemented milestone scope

#### Milestone 1
- Login and registration
- JWT authentication
- Role-based access
- Angular routing/guards
- PostgreSQL schema
- Vendor, PO, contract and activity entities
- Dashboard navigation
- Responsive UI

#### Milestone 2
- Vendor CRUD
- Vendor approval workflow
- Vendor categories and contacts
- Procurement requests
- Purchase orders
- PO lifecycle: Pending → Approved → Ordered → Delivered → Completed / Cancelled
- Contracts and compliance
- Communication/messages
- Notifications

#### Milestone 3
- Vendor performance records
- Reliability score
- Risk classification
- Six reliability factors
- Performance trends
- Interactive analytics
- Recommendations
- Notifications
- Reports

### Quick start

Requirements:
- Python 3.11+
- Node.js 18+
- Angular CLI
- Docker Desktop (recommended for PostgreSQL)

1. Start PostgreSQL:
   `docker compose up -d db`

2. Backend:
   ```
   cd backend
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

3. Frontend:
   ```
   cd frontend
   npm install
   ng serve
   ```

4. Open:
   `http://localhost:4200`

5. API docs:
   `http://localhost:8000/docs`

Demo accounts are seeded by the backend:
- admin@vendorintel.local / Admin@123
- procurement@vendorintel.local / Procure@123
- supply@vendorintel.local / Supply@123
- finance@vendorintel.local / Finance@123
- auditor@vendorintel.local / Audit@123
- vendor@vendorintel.local / Vendor@123

The Vendor account is restricted to its own vendor-related records.

### Important
This is a Milestones 1–3 implementation. Deployment, full production hardening, load testing and final documentation belong to Milestone 4 in the source brief.
