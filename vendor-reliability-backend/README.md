# VendorIQ — Backend Service (FastAPI & SQLAlchemy)

**Platform Title**: Vendor Reliability Intelligence Platform: Vendor Reliability Intelligence & Procurement Risk Management Platform  
**Target Milestone**: Milestone 4 (Testing, Deployment & Documentation)  
**Backend Framework**: FastAPI 0.115+ (Python 3.11 / 3.13)  
**ORM & Database**: SQLAlchemy 2.0+ | SQLite / PostgreSQL 16 (Dual Engine)  
**Authentication**: JWT (OAuth2 Password Bearer) with Role-Based Access Control (RBAC)

---

## 1. System Overview

The **VendorIQ Backend** delivers an enterprise-grade RESTful API service supporting multi-role procurement workflows, vendor performance analysis, multi-factor reliability scoring, contract lifecycle monitoring, 3-way invoice matching, audit logging, and realtime notifications.

### 6 Supported Enterprise Roles
1. **Administrator**: User verification & lifecycle, system settings, governance, vendor approvals.
2. **Procurement Manager**: Purchase requisitions, category-based supplier evaluation, vendor selection.
3. **Supply Chain Manager**: Purchase Order creation & issuance, shipment dispatch tracking, physical dock delivery confirmation.
4. **Vendor**: Order acceptance/rejection with justification, order dispatch & tracking, fulfillment logs.
5. **Finance Officer**: Requisition budget approval, 3-way match invoice verification, electronic payment disbursement.
6. **Auditor**: End-to-end transaction chain traceability, exception detection, audit finding logs, regulatory verification.

---

## 2. API Endpoints Directory

| Router Prefix | Primary Responsibilities |
| :--- | :--- |
| `/auth` | User registration, admin approval check, JWT login, password reset tokens, demo accounts. |
| `/users` | User directory, profile updates, role assignments, activation status toggling. |
| `/admin` | Pending user verification, approval/rejection with audit comments, platform statistics. |
| `/vendors` | Registered vendor directory, category list (6 official categories), profile details, comparison. |
| `/requisitions` | Purchase requisition creation, departmental budget verification, submission lifecycle. |
| `/procurement` | Eligible requisition evaluation, category vendor scoring, vendor selection & nomination. |
| `/finance` | Financial approval/rejection, invoice review, 3-way match, payment disbursement & ledger. |
| `/purchase-orders` | SCM PO creation & issuance, vendor accept/reject, dispatch, tracking, delivery updates. |
| `/deliveries` | Physical delivery receipt confirmation by Supply Chain Manager upon dock inspection. |
| `/invoices` | Commercial invoice submission, status tracking, payment association. |
| `/contracts` | Master service agreements, renewal countdowns, compliance certification monitoring. |
| `/communications` | Real-time discussion threads, notifications, immutable audit log records. |
| `/notifications` | Role-targeted notifications, unread badges, mark-as-read controls. |
| `/dashboard` | Role-specific summary analytics (`/stats`, `/procurement-summary`, `/vendor-summary`, `/admin-summary`, `/finance-summary`, `/supply-chain-summary`, `/audit-summary`). |
| `/audit` | End-to-end transaction chain reconstruction, discrepancy reporting, audit findings. |

---

## 3. End-to-End Business Workflow

The system strictly enforces the approved multi-role procurement governance flow:

```
USER REGISTRATION
        ↓
ADMIN VERIFICATION (Admin verifies user & assigns role)
        ↓
ROLE ACCESS
        ↓
PURCHASE REQUIREMENT (Requisition submitted)
        ↓
PROCUREMENT MANAGER (Evaluates vendors in required category & selects vendor)
        ↓
FINANCE OFFICER (Budget / Financial approval)
        ↓
SUPPLY CHAIN MANAGER (Creates and issues Purchase Order)
        ↓
VENDOR (Accepts or Rejects PO with reason)
        ↓
VENDOR (Dispatches shipment with tracking number & carrier)
        ↓
DELIVERY (Status moves to 'In Transit')
        ↓
SUPPLY CHAIN MANAGER (Confirms physical delivery upon dock inspection)
        ↓
FINANCE OFFICER (3-Way match invoice verification & payment processing)
        ↓
AUDITOR (Verifies complete transaction chain & audit log)
        ↓
PERFORMANCE & RISK RECORDS (Reliability score & risk recalculation)
```

---

## 4. Database Entities & Relational Architecture

The relational database models are organized cleanly in `app/models`:
- **Users & Roles**: `users`, `password_resets`
- **Vendors**: `vendors`, `vendor_categories`, `vendor_contacts`
- **Procurement & Sourcing**: `procurement_requests`, `purchase_requisition_items`, `vendor_selections`, `financial_approvals`
- **Fulfillment & Logistics**: `purchase_orders`, `purchase_order_items`, `deliveries`
- **Finance & Invoicing**: `invoices`, `payments`
- **Governance & Audit**: `contracts`, `audit_logs`, `audit_findings`, `audit_review_statuses`
- **Communications**: `communication_messages`, `notifications`

---

## 5. How to Run Locally

### Prerequisites
- Python 3.10+ (tested with 3.11 and 3.13)
- Virtual environment (`venv`)

### Setup Commands
```bash
# Navigate to backend directory
cd vendor-reliability-backend

# Create virtual environment
py -m venv venv
.\venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Run FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive Swagger documentation is available at: `http://localhost:8000/docs`

---

## 6. How to Run via Docker

```bash
docker build -t vendoriq-backend .
docker run -p 8000:8000 vendoriq-backend
```
Or orchestrate with PostgreSQL and Angular using Docker Compose from the root/frontend directory:
```bash
docker-compose up -d --build
```
