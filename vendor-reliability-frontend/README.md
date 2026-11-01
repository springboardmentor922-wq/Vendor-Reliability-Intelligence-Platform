# VendorIQ — Vendor Reliability Intelligence & Procurement Risk Management Platform

![Platform Architecture](https://img.shields.io/badge/Architecture-Angular%2021%20%7C%20FastAPI%20%7C%20PostgreSQL-blue)
![Milestone 4](https://img.shields.io/badge/Milestone-4%20Completed-success)
![Tests](https://img.shields.io/badge/Unit%20Tests-20%2F20%20Passing-brightgreen)
![Docker](https://img.shields.io/badge/Docker-Multi--Container%20Ready-blue)

A full-stack enterprise platform built using **Angular** and **FastAPI** that enables organizations to evaluate vendor reliability, manage procurement operations, monitor supplier performance, track delivery history, maintain contract compliance, and streamline procurement decision-making through centralized dashboards and analytics.

---

## 🌟 Key Architecture & Milestone 4 Highlights

- **Multi-Role RBAC with Dedicated Dashboards**: Decoupled, independent dashboards for each of the 6 enterprise roles with strict role-based access control.
- **Vendor Reliability Algorithm**: Multi-factor scoring incorporating on-time delivery rates, product quality, communication speed, contract compliance, and dispute resolution.
- **Closed-Loop Sourcing & Logistics**: Supply Chain Managers can monitor logistics flows, apply preventive actions, and trigger re-sourcing alerts directly to Procurement Managers.
- **3-Way Matching & Invoicing**: Finance Officers cross-reference Purchase Orders, physical delivery confirmations, and commercial invoices before disbursement.
- **Immutable Audit Trail**: Chronological, searchable transaction ledger for ISO-9001 and SOC 2 audits.
- **Multi-Container Docker Orchestration**: Production-ready containerization for PostgreSQL 16, FastAPI backend, and Angular frontend (served via Nginx).

---

## 👥 Supported Roles & Dedicated Workspaces

| Role | Workspace Route | Primary Capabilities |
| :--- | :--- | :--- |
| **Administrator** | `/dashboard/admin` | User management (activate/deactivate, role reassignment), vendor approvals, platform health metrics. |
| **Procurement Manager** | `/dashboard/procurement` | Purchase requisitions, PO issuance, vendor decision support matrix, rapid re-sourcing resolution. |
| **Supply Chain Manager**| `/dashboard/supply-chain` | Live freight tracking, buffer stock monitoring, preventive mitigation actions, disruption alerts. |
| **Vendor (External Portal)**| `/dashboard/vendor` | Order acceptance/rejection, shipment delivery confirmation, commercial invoice generation. |
| **Finance Officer** | `/dashboard/finance` | 3-way invoice matching, invoice approvals, payment disbursements (EFT, Wire, Check). |
| **Auditor** | `/dashboard/auditor` | Chronological audit ledger search, contract SLA compliance, high-risk supplier diligence, dossier export. |

> Detailed step-by-step operating instructions for each role are available in [USER_GUIDES.md](USER_GUIDES.md).

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: `v20+` or `v22+`
- **Python**: `v3.10+` or `v3.11+`
- **Package Managers**: `npm` and `pip`

### 2. Backend Setup (FastAPI)
```bash
# Navigate to the backend directory
cd ../vendor-reliability-backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API and interactive Swagger documentation will be available at:
- **API Base**: `http://127.0.0.1:8000`
- **Swagger Docs**: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup (Angular)
```bash
# Navigate to the frontend directory
cd vendor-reliability-frontend

# Install dependencies
npm install

# Start local development server
npm start
```
Open your browser and navigate to `http://localhost:4200/`.

---

## 🐳 Docker Deployment (Milestone 4)

The entire platform can be deployed with a single command using Docker Compose:

```bash
# From vendor-reliability-frontend directory:
docker-compose up --build -d
```

### Services Deployed:
1. **vendoriq-postgres**: PostgreSQL 16 Alpine database with health checks and persistent volume storage.
2. **vendoriq-backend**: FastAPI Python 3.11 container with automatic DB connectivity.
3. **vendoriq-frontend**: Multi-stage Angular build served by Nginx with reverse proxy and gzip compression.

### Access Endpoints:
- **Web Application**: `http://localhost:4200`
- **API Documentation**: `http://localhost:8000/docs`

To stop the containers:
```bash
docker-compose down
```

---

## 🧪 Testing & Quality Assurance

Run the automated unit test suite using Angular's test runner:

```bash
npx ng test --watch=false
```

### Test Suite Summary:
- **Suites**: 14 Test Files Passed
- **Tests**: 20 Unit Tests Passed
- **Pass Rate**: **100%**
- **Coverage Areas**: App initialization, authentication, user administration, vendor evaluation matrix, shipment calculation, financial liability modeling, and audit categorization.

---

## 📑 Milestone Verification & Documentation

- [MILESTONES.md](MILESTONES.md): Full breakdown and evaluation criteria verification for Milestones 1, 2, 3, and 4.
- [USER_GUIDES.md](USER_GUIDES.md): User operation manuals for each of the 6 roles.
