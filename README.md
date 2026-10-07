Vendor Reliability Intelligence & Procurement Risk Management Platform

Full-stack vendor reliability, procurement and supply chain risk management platform.

**Stack:** FastAPI + SQLAlchemy + SQLite · Angular + TypeScript

**Status:** Core platform modules completed with role-based authentication and authorization.

Vendor management, procurement, purchase orders, vendor performance, reliability scoring, risk analysis, contracts, communication, analytics, reports and notifications are integrated into one platform.

---

## 🚀 Quick Start

### 1. Backend

```cmd
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload

API: http://localhost:8000
Swagger: http://localhost:8000/docs

2. Frontend
cd frontend
ng serve

App: http://localhost:4200

👥 Roles
Role	Purpose
Administrator	System and platform management
Procurement Manager	Vendors, procurement and purchase orders
Supply Chain Manager	Procurement, delivery and reliability
Vendor	Vendor-side operations
Finance Officer	Financial and procurement monitoring
Auditor	Reporting and audit activities
📦 Modules
Dashboard — Platform overview and recent activity
Vendors — Vendor registration and management
Vendor Approval — Vendor approval and rejection workflow
Procurement — Procurement request and approval workflow
Purchase Orders — PO creation, delivery and invoice tracking
Contracts — Contract and certification management
Communication — Vendor and procurement communication
Performance — Vendor delivery and quality evaluation
Reliability — Reliability scoring, ranking and risk levels
Analytics — Vendor and procurement analytics
Reports — Procurement and vendor reports
Notifications — Important system alerts and events
🔄 Workflow
Vendor Registration
        ↓
Vendor Approval
        ↓
Procurement Request
        ↓
Purchase Order
        ↓
Delivery & Invoice
        ↓
Performance Evaluation
        ↓
Reliability & Risk Analysis
        ↓
Procurement Recommendation
🔐 Authentication & Security
JWT-based authentication
Role-Based Access Control (RBAC)
Protected API endpoints
Role-based module and action access
Activity tracking for important operations
📁 Project Structure
predictive_vendor/
├── backend/
│   └── app/
│       ├── core/
│       ├── database/
│       ├── dependencies/
│       ├── models/
│       ├── routers/
│       ├── schemas/
│       └── services/
│
└── frontend/
    └── src/
        └── app/
            ├── auth/
            ├── dashboard/
            ├── vendors/
            ├── vendor-approval/
            ├── procurement/
            ├── purchase-orders/
            ├── contracts/
            ├── communications/
            ├── performance/
            ├── reliability/
            ├── analytics/
            ├── reports/
            └── notifications/
⭐ Key Features
Vendor lifecycle management
Procurement workflow
Purchase order tracking
Delivery and invoice management
Vendor performance evaluation
Reliability and risk analysis
Contract and compliance monitoring
Communication and activity tracking
Analytics and reporting
Role-based access control
System notifications
✅ Project Status

Completed

The core Vendor Reliability Intelligence and Procurement Risk Management platform has been implemented using Angular and FastAPI with integrated backend APIs, database operations, authentication, authorization and business workflows.