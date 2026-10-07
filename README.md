Vendor Reliability Intelligence & Procurement Risk Management Platform

A full-stack web application for managing vendors, procurement operations, purchase orders, vendor performance, reliability, contracts, communication, analytics, reports, and procurement risk.

🚀 Overview

The Vendor Reliability Intelligence Platform provides a centralized system for managing the complete vendor and procurement lifecycle.

The platform connects vendor management, procurement, performance evaluation, reliability analysis, risk assessment, and procurement recommendations in a single application.

Core Workflow

Vendor Registration → Vendor Approval → Procurement → Purchase Order → Delivery → Performance → Reliability → Risk → Recommendation

🛠 Tech Stack
Backend
FastAPI – REST API development
Python – Backend programming
SQLAlchemy – Database ORM
SQLite – Local database
Alembic – Database migrations
Pydantic – Data validation
JWT – Authentication
Uvicorn – Application server
Frontend
Angular – Web application framework
TypeScript – Frontend programming
Angular Router – Application navigation
Angular HttpClient – Backend API communication
Standalone Components – Angular application architecture
👥 User Roles

The platform supports six user roles:

Role	Responsibility
ADMINISTRATOR	System administration and overall platform management
PROCUREMENT_MANAGER	Vendor management, procurement, approvals, and purchase orders
SUPPLY_CHAIN_MANAGER	Procurement operations, delivery, performance, and reliability
VENDOR	Vendor-side access to permitted platform functions
FINANCE_OFFICER	Financial and procurement monitoring
AUDITOR	Reporting, monitoring, and audit-related activities

Role-based authorization controls which operations each user can perform.

📦 Main Modules
1. Dashboard

Provides an overview of vendors, purchase orders, approvals, reliability, contracts, and recent activities.

2. Vendor Management
Vendor registration
Vendor information management
Vendor categorization
Vendor status monitoring
Vendor search
3. Vendor Approval
Vendor verification
Approval and rejection workflow
Approval status tracking
Activity traceability
4. Procurement
Procurement requests
Approval workflow
Vendor assignment
Procurement status tracking
5. Purchase Orders
PO creation
Vendor assignment
Order tracking
Delivery updates
Invoice processing
Order completion
6. Contracts & Compliance
Contract management
Contract status tracking
Certification management
Expiry monitoring
Compliance monitoring
7. Communication
Vendor communication
Procurement discussions
Read/unread tracking
Communication history
8. Performance
Delivery performance
Quality performance
Vendor reliability evaluation
Performance classification
9. Reliability
Reliability scoring
Vendor ranking
Risk classification
Performance trend
Procurement recommendations
10. Analytics
Vendor statistics
Purchase-order statistics
Procurement metrics
Vendor analytics
Search and filtering
11. Reports

Provides summarized vendor, procurement, performance, and reliability information.

12. Notifications

Provides notifications for important system events such as approvals, contract expiry, and compliance-related events.

🔐 Authentication & Authorization

The application uses JWT-based authentication and role-based access control (RBAC).

User Registration
       ↓
Login
       ↓
JWT Token
       ↓
Authenticated API Requests
       ↓
Role Verification
       ↓
Authorized Actions

Protected backend APIs verify both the authenticated user and the user's role before allowing restricted operations.

🔄 System Workflow
Vendor Registration
        ↓
Vendor Approval
        ↓
Procurement Request
        ↓
Procurement Approval
        ↓
Vendor Assignment
        ↓
Purchase Order
        ↓
Delivery
        ↓
Invoice Processing
        ↓
Performance Evaluation
        ↓
Reliability Analysis
        ↓
Risk Assessment
        ↓
Procurement Recommendation
📁 Project Structure
predictive_vendor/
│
├── README.md
├── .gitignore
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── database/
│   │   ├── dependencies/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   │
│   ├── alembic/
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   └── app/
    │       ├── auth/
    │       ├── dashboard/
    │       ├── vendors/
    │       ├── vendor-approval/
    │       ├── procurement/
    │       ├── purchase-orders/
    │       ├── contracts/
    │       ├── communications/
    │       ├── performance/
    │       ├── reliability/
    │       ├── analytics/
    │       ├── reports/
    │       └── notifications/
    │
    ├── angular.json
    ├── package.json
    └── tsconfig.json
▶️ How to Run
Backend

Open CMD:

cd C:\Users\mudda\OneDrive\Dokumen\predictive_vendor\backend

Activate the virtual environment:

venv\Scripts\activate

Start the FastAPI server:

python -m uvicorn app.main:app --reload

Backend:

http://localhost:8000

Swagger API documentation:

http://localhost:8000/docs
Frontend

Open another CMD:

cd C:\Users\mudda\OneDrive\Dokumen\predictive_vendor\frontend

Start Angular:

ng serve

Application:

http://localhost:4200
📊 Key Features
JWT authentication
Role-based authorization
Vendor management
Vendor approval workflow
Procurement management
Purchase-order management
Delivery and invoice tracking
Vendor performance evaluation
Reliability scoring
Risk assessment
Procurement recommendations
Contract and compliance monitoring
Communication management
Activity tracking
Analytics dashboard
Reports
Notifications
✅ Project Status

Completed

The major functional modules of the Vendor Reliability Intelligence Platform have been implemented and integrated with the FastAPI backend and Angular frontend.