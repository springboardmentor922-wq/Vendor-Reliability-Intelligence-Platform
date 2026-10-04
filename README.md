# VendorIQ – Vendor Reliability Intelligence & Procurement Risk Management Platform

VendorIQ is an enterprise-grade full-stack platform designed to manage supplier onboarding, approval workflows, procurement requests, purchase orders with automated total calculation, commercial invoicing, contract & certification compliance, and real-time vendor communication threads across six distinct organizational roles.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: React 18, React Router v6, Vite, custom bespoke CSS design system (zero heavy UI kit overhead, clean typography, responsive sidebar/dashboard layout).
- **Backend**: Python 3.12, FastAPI, SQLAlchemy ORM (with 13 complete relational models), Pydantic v2 schemas, JWT authentication (OAuth2 Bearer with bcrypt hashing).
- **Database**: PostgreSQL (production / Docker Compose) with automated SQLite fallback for immediate local testing.
- **Containerization**: Dockerfile and `docker-compose.yml` for unified backend and PostgreSQL deployment.

---

## 🗄️ Complete Database Schema (13 Tables)

| # | Table | Purpose | Key Attributes |
|---|-------|---------|----------------|
| 1 | `users` | User credentials & RBAC | `id`, `full_name`, `email`, `hashed_password`, `role` (enum), `phone`, `is_active`, `vendor_id` (FK), timestamps |
| 2 | `vendors` | Supplier master repository | `id`, `company_name`, `category` (enum), `status` (enum: pending, approved, rejected, suspended), `contact_person`, `email`, `phone`, `address`, `gst_number`, `notes`, `approved_by_id` (FK), timestamps |
| 3 | `procurement_requests` | Internal purchase requisitions | `id`, `title`, `description`, `requested_by_id` (FK), `status` (enum), timestamps |
| 4 | `purchase_orders` | Purchase order commitments | `id`, `po_number`, `procurement_request_id` (FK), `vendor_id` (FK), `status` (enum: pending, approved, ordered, delivered, completed, cancelled), `total_amount`, `expected_delivery_date`, `actual_delivery_date`, `created_by_id` (FK), `approved_by_id` (FK), timestamps |
| 5 | `purchase_order_items` | PO line-item breakdown | `id`, `purchase_order_id` (FK), `item_name`, `quantity`, `unit_price` |
| 6 | `invoices` | Commercial billing | `id`, `invoice_number`, `purchase_order_id` (FK), `amount`, `status` (enum: pending, paid, overdue), `due_date`, `paid_date`, `created_at` |
| 7 | `contracts` | Master legal agreements | `id`, `contract_number`, `vendor_id` (FK), `title`, `start_date`, `end_date`, `status` (enum: active, expiring_soon, expired, terminated), `file_path`, `created_at` |
| 8 | `certifications` | Quality & compliance accreditations | `id`, `contract_id` (FK), `vendor_id` (FK), `name`, `issued_date`, `expiry_date`, `document_path`, `created_at` |
| 9 | `messages` | Direct supplier communication thread | `id`, `vendor_id` (FK), `sender_id` (FK), `body`, `file_path`, `is_read`, `timestamp` |
| 10 | `performance_records` | Operational KPIs (M3/M4) | `id`, `vendor_id` (FK), `purchase_order_id` (FK), `on_time`, `quality_rating`, `response_time_hours`, `issue_resolution_hours`, `recorded_at` |
| 11 | `reliability_scores` | Risk and reliability ratings (M3/M4) | `id`, `vendor_id` (FK), `score`, `risk_level`, `calculated_at` |
| 12 | `notifications` | Role-based system alerts (M3/M4) | `id`, `user_id` (FK), `type` (enum), `message`, `is_read`, `created_at` |
| 13 | `audit_logs` | Immutable audit trail | `id`, `user_id` (FK), `action`, `entity`, `details`, `created_at` |

---

## 👥 Role-Based Access Control (RBAC)

The platform enforces strict authorization across **6 distinct user roles**:

1. **Administrator**: Platform administration, user management, overall vendor metrics, system statistics, and immutable audit logs.
2. **Procurement Manager**: Creates & approves procurement requests, issues & approves purchase orders, approves/rejects vendors, tracks spend.
3. **Supply Chain Manager**: Operational fulfillment monitoring, order dispatch & delivery status updates, supplier reliability tracking, delayed order intervention.
4. **Vendor**: Strict data isolation — vendors only access their own company's purchase orders, invoices, active contracts, certifications, and direct communication messages.
5. **Finance Officer**: Commercial invoices lifecycle, payment processing (marking paid/overdue), spending metrics by category/vendor.
6. **Auditor**: Compliance inspection, audit trail verification, contract validity & expiring soon reviews (< 30 days).

---

## ⚡ Quick Start / Local Setup

### Option 1: Docker Compose (Backend + PostgreSQL)

```bash
# From project root
docker-compose up --build
```
- Backend API will be live at: `http://localhost:8000`
- Interactive Swagger API Docs at: `http://localhost:8000/docs`

### Option 2: Local Backend Setup (Python)

```bash
# Navigate to backend folder
cd backend

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server (auto-creates tables and seeds default records)
uvicorn app.main:app --reload --port 8000
```

### Option 3: Local Frontend Setup (React / Vite)

```bash
# Navigate to frontend folder
cd frontend

# Install node dependencies
npm install

# Start Vite development server
npm run dev
```
- Open browser at `http://localhost:5173`

---

## 🔑 Pre-Seeded Demo Credentials

Use the **One-Click Demo Switcher** at the top right of the application or log in manually with the following credentials:

| Role | Email | Password | Pre-linked Entity |
|------|-------|----------|-------------------|
| **Administrator** | `admin@vendoriq.com` | `Admin@123` | System Admin |
| **Procurement Manager** | `procurement@vendoriq.com` | `Procure@123` | Purchasing Dept |
| **Supply Chain Manager** | `supplychain@vendoriq.com` | `Supply@123` | Operations |
| **Vendor** | `vendor@apexmaterials.com` | `Vendor@123` | Apex Raw Materials Ltd |
| **Finance Officer** | `finance@vendoriq.com` | `Finance@123` | Accounts Dept |
| **Auditor** | `auditor@vendoriq.com` | `Audit@123` | Compliance Audit |

---

---

## 📈 Milestone 3 & 4: Predictive Intelligence & Interactive Analytics

### 1. 6-Factor Vendor Reliability Engine (Strict Guide Formula)
The platform evaluates every supplier using the weighted multi-factor formula:
$$\text{Reliability Score} = (0.25 \times D) + (0.25 \times Q) + (0.10 \times C) + (0.15 \times K) + (0.10 \times P) + (0.15 \times R)$$

- **Delivery History ($D$, 25%)**: Historical on-time delivery rate percentage.
- **Product Quality ($Q$, 25%)**: Average quality rating converted to percentage ($(\text{Rating} / 5.0) \times 100$).
- **Communication Efficiency ($C$, 10%)**: Tiered response turnaround ($\le 2\text{h}: 100, \le 4\text{h}: 85, \le 8\text{h}: 70, \le 16\text{h}: 55, > 16\text{h}: 40$).
- **Contract Compliance ($K$, 15%)**: Active contract validation and ISO/aerospace quality certification checks.
- **Purchase History ($P$, 10%)**: PO completion and fulfillment rate.
- **Issue Resolution ($R$, 15%)**: Dispute turnaround ($\le 8\text{h}: 100, \le 16\text{h}: 85, \le 24\text{h}: 70, \le 48\text{h}: 50, > 48\text{h}: 30$).

### 2. Predictive AI Delivery Delay Simulator
- Machine learning/heuristic inference engine calculating delay probabilities and expected delay days based on vendor track record, shipment order volume, and promised lead times.

### 3. Dynamic Reports & Multi-Format Exports
- 5 comprehensive report suites (*Vendor Performance, Requisitions, Purchase Orders, Compliance, Contracts*).
- Instant data export to **CSV**, **PDF**, and formatted **Excel (`.xlsx`) with UTF-8 BOM (`\ufeff`)** for correct Indian Rupee (`₹`) rendering.

### 4. Structured GST Tax Invoice PDF Generator
- Built-in enterprise standard A4 GST Tax Invoice modal with itemized line items, HSN/SAC codes (`7208 90 00`), statutory **CGST (9%) + SGST (9%)** breakdown, **Amount in Words**, bank remittance information, and instant PDF download/print.

### 5. Multi-Channel Communication & SMS Gateway
- Two-way operational live chat.
- Formal Gmail direct composer pre-populated with audit reference headers.
- SMS Gateway mobile dispatch simulation with real-time audit registry.

---

## ⚡ System Performance Benchmarks (Audited)

Verified using `python benchmark_performance.py`:

| Metric | Target | Actual Measured | Result |
| :--- | :---: | :---: | :---: |
| **API Response Time (Mean)** | `< 300 ms` | **29.73 ms** | ✅ **10x Faster than target** |
| **Max Single API Latency** | `< 300 ms` | **71.95 ms** | ✅ **4x Faster than target** |
| **Dashboard Load Time (Mean)** | `< 2,000 ms` | **77.80 ms** | ✅ **25x Faster than target** |
| **50 Concurrent User Requests** | `100% Available` | **50/50 Succeeded (100%)** | ✅ **Passed** |
| **Automated Backend Tests** | `100% Pass` | **20 / 20 Test Suites Passed** | ✅ **Passed** |
| **Frontend Production Build** | `Zero Errors` | **Built in 2.76s** | ✅ **Passed** |

---

## 🚀 Complete End-to-End Demonstration Walkthrough

Follow this step-by-step sequence to demonstrate the complete integrated system:

1. **Role Access & Security**:
   - Log in as **Administrator** (`admin@vendoriq.com`).
   - Observe live system statistics, User Management donut chart (`roles_donut`), Risk Distribution bar chart, and promote/reassign a staff member.
2. **Vendor Registration & Self-Confirmation**:
   - Register a new supplier from `/register`. Note that initial status is `pending` and initial reliability score is exactly `0.0`.
   - Log in as the new **Vendor** &rarr; approve onboarding confirmation (Procurement Manager is blocked with 403 Forbidden).
3. **Procurement Request & PO Creation**:
   - Log in as **Procurement Manager** (`procurement@vendoriq.com`).
   - Create and approve a Procurement Requisition.
   - Issue a Purchase Order &rarr; select a category to see the vendor dropdown automatically filter only matching approved suppliers.
4. **Order Progression & Automated Performance Recording**:
   - Progress the PO: `Pending` &rarr; `Approved` &rarr; `Ordered` &rarr; `Delivered`.
   - Notice the backend automatically records a `PerformanceRecord` and recalculates the supplier's live `ReliabilityScore`.
5. **Invoices & GST Tax Invoice PDF**:
   - Generate an invoice against the delivered PO.
   - Click **📥 PDF Invoice** &rarr; inspect the structured A4 GST Tax Invoice template with itemized HSN lines, CGST/SGST 9%, Amount in Words, and bank remittance.
   - Switch role to **Finance Officer** &rarr; view cashflow trajectory chart and settle the invoice (`Mark Paid`).
6. **Supply Chain Operations**:
   - Log in as **Supply Chain Manager** (`supplychain@vendoriq.com`).
   - Review Delivery Performance Trend dual-axis chart, Shipment Pipeline donut, and Logistics SLA radar.
7. **Predictive AI Delay Simulator & Analytics**:
   - Navigate to `/analytics` &rarr; run the AI Risk Simulator with custom lead times to predict delay probability.
8. **Compliance, Communication & Reports**:
   - Check `/contracts` for the automatic `< 30-day` expiring soon badge.
   - Dispatch an alert via the **SMS Gateway** and direct Gmail composer in `/messages`.
   - Export reports in **Excel (`.xlsx`)** and verify Indian Rupee (`₹`) symbols render cleanly.
9. **Auditor Review**:
   - Log in as **Auditor** (`auditor@vendoriq.com`) &rarr; inspect the immutable audit log recording every single action performed during the demo.

