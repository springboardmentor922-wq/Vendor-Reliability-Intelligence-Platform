# ProcuraHub API Reference & Technical Specification
## Version: 4.0.0 (Milestones 1 - 4 Comprehensive)

The ProcuraHub API is a high-performance RESTful service built with **FastAPI**, **SQLAlchemy ORM**, and **PyMySQL**. It exposes secure endpoints for enterprise procurement risk analytics, supplier reliability evaluation, purchase order lifecycle management, invoicing, automated notifications, compliance audits, and multi-format reporting.

---

## 1. Authentication & Security Architecture

### Authentication Scheme
- **Protocol**: OAuth2 Bearer Token (JWT - JSON Web Tokens)
- **Token Format**: Header `Authorization: Bearer <access_token>`
- **Token Expiry**: 1,440 minutes (24 hours)
- **Hash Algorithm**: HS256 with Bcrypt password salt hashing

### Role-Based Access Control (RBAC)
| Role Identifier | Description | Accessible Modules |
| :--- | :--- | :--- |
| `admin` | Full System Governance | All endpoints, User admin, DB health, System logs |
| `procurement_manager` | Sourcing & Purchasing Lead | Vendors, Requisitions, PO Creation/Approval, Reports |
| `supply_chain_manager` | Logistics & Risk Specialist | DataCo Telemetry, Reliability Scoring, Risk Leaderboard |
| `vendor` | Supplier Representative | Scoped POs, Delivery status update, Invoice inquiry, Chat |
| `finance_officer` | Accounts Payable Lead | Invoices generation, Matching, Settlement/Payment |
| `auditor` | Compliance & Governance Officer | Immutable Audit Trail, Contracts, Compliance Matrix |

---

## 2. Core API Endpoints

### 2.1 Authentication & User Management
* **`POST /login`**
  - **Description**: Authenticate user credentials and issue signed JWT.
  - **Body**: `{"email": "admin@example.com", "password": "admin123"}`
  - **Response (200)**: `{"access_token": "...", "token_type": "bearer", "user_id": 1, "role": "admin", "full_name": "..."}`

* **`POST /register`**
  - **Description**: Register a new enterprise user.
  - **Body**: `{"name": "...", "email": "...", "password": "...", "role": "procurement_manager"}`

* **`GET /users`** (Admin only)
  - **Description**: List registered users with assigned RBAC roles and departments.

---

### 2.2 Dashboard & Risk Analytics (DataCo Dataset Integration)
* **`GET /dashboard/summary`**
  - **Description**: Real-time KPI counters (Vendors, PRs, Active POs, Risk Stratification).
  - **Response (200)**: `{"total_vendors": 118, "total_procurement_requests": 12, "total_purchase_orders": 14, "risk_summary": {"low": 35, "medium": 52, "high": 31}}`

* **`GET /api/analytics/dashboard`**
  - **Description**: Comprehensive aggregated metrics across 180,519 historical delivery records. Cached with 60s TTL for sub-50ms latency.
  - **Response (200)**: Includes `risk_distribution`, `spend_by_category`, `monthly_trend`, `delivery_status`, and `totals`.

* **`GET /api/suppliers`**
  - **Query Params**: `limit` (int, default: 20), `category` (str), `risk_level` (str), `sort_by` (str)
  - **Description**: Ranked supplier directory calculated via multi-factor reliability scoring.

* **`GET /api/suppliers/{product_card_id}`**
  - **Description**: Detailed telemetry profile, historical monthly trend, sub-score radar components, and automated risk mitigation recommendations.

* **`GET /api/analytics/procurement`**
  - **Description**: Spend summary, shipping mode distribution, and live PO status breakdown.

---

### 2.3 Vendors Directory & Approvals
* **`GET /vendors`**
  - **Description**: Retrieve approved and onboarding vendors.
* **`POST /vendors`**
  - **Description**: Create/onboard a new vendor.
* **`PUT /vendors/{vendor_id}/approve`**
  - **Description**: Approve a pending vendor into the active supply chain.
* **`DELETE /vendors/{vendor_id}`**
  - **Description**: Remove/archive a vendor.

---

### 2.4 Procurement Requisitions & Purchase Orders
* **`GET /procurement-requests`**
  - **Description**: List all procurement requisitions.
* **`POST /procurement-requests`**
  - **Body**: `{"description": "...", "quantity": 10, "department": "IT", "required_date": "2026-10-15T00:00:00"}`

* **`GET /purchase-orders`**
  - **Description**: List purchase orders. Automatically scoped for `vendor` role to their assigned vendor ID.
* **`GET /purchase-orders/{order_id}`**
  - **Description**: Inspect purchase order metadata, shipping/billing address, and line items table.
* **`POST /purchase-orders`**
  - **Body**: `{"po_number": "PO-2026-001", "vendor_id": 1, "department": "...", "payment_terms": "Net 30", "shipping_address": "...", "billing_address": "...", "total_amount": 11800.0, "items": [{"product_name": "...", "quantity": 2, "unit_price": 2500.0, "tax_percent": 18.0, "total_price": 5900.0}]}`
* **`PUT /purchase-orders/{order_id}/approve`**
  - **Description**: Transition PO status from `Pending`/`Draft` to `Approved`. Fires automated notification.
* **`PUT /purchase-orders/{order_id}/status`**
  - **Body**: `{"status": "Ordered" | "Delivered" | "Completed" | "Cancelled"}`

---

### 2.5 Invoices & Accounts Payable
* **`GET /api/invoices`**
  - **Description**: List invoices with linked PO metadata, total amount, tax amount, and due dates.
* **`POST /api/invoices`**
  - **Body**: `{"purchase_order_id": 1, "vendor_id": 1, "amount": 10000.0, "tax_amount": 1800.0, "total_amount": 11800.0, "due_date": "2026-10-30T00:00:00", "notes": "..."}`
* **`PUT /api/invoices/{invoice_id}/status`**
  - **Body**: `{"status": "Paid" | "Pending" | "Overdue" | "Cancelled", "notes": "..."}`

---

### 2.6 Communications & Internal Hub
* **`GET /api/communications/threads`**
  - **Description**: Retrieve conversation threads grouped by vendor.
* **`POST /api/communications/messages`**
  - **Body**: `{"vendor_id": 1, "message": "...", "subject": "PO Inquiry"}`
* **`GET /api/communications/vendors/{vendor_id}/messages`**
  - **Description**: Fetch message history for a specific vendor conversation.

---

### 2.7 Audit Logs & Compliance Matrix
* **`GET /api/audit-logs`**
  - **Query Params**: `entity_type` (str), `action` (str), `limit` (int, default: 100)
  - **Description**: Immutable append-only governance trail capturing all system mutations.

---

### 2.8 Operational Report Exports
* **`GET /api/reports/{report_type}/csv`**
  - **Formats**: `vendor-performance`, `suppliers`, `procurement`, `purchase-orders`, `compliance`, `contracts`
  - **Response**: UTF-8 BOM CSV attachment.
* **`GET /api/reports/{report_type}/download`**
  - **Response**: Formatted OpenXML Excel `.xlsx` workbook.
* **`GET /api/reports/{report_type}/pdf`**
  - **Response**: Formatted Landscape PDF with enterprise styling.
* **`GET /api/reports/{report_type}/preview`**
  - **Response**: JSON preview of report columns and first 50 rows.
