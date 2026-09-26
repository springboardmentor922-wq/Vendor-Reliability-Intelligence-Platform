# Requirements Specification — VendorIQ

Vendor Reliability Intelligence & Procurement Risk Management Platform

---

## 1. Objective

Build a full-stack web application using **Angular** and **FastAPI** that lets
organisations evaluate vendor reliability, manage procurement operations,
monitor supplier performance, track delivery history, maintain contract
compliance, and improve procurement decision-making through centralised
dashboards and analytics.

Target users: manufacturing companies, retail businesses, logistics
organisations, healthcare providers, construction firms, and enterprise
procurement departments.

---

## 2. Functional requirements

### FR-1 — User authentication & role management

| ID | Requirement | Status |
| --- | --- | --- |
| FR-1.1 | Users can self-register with name, email, password and role | Done |
| FR-1.2 | Users sign in with email and password | Done |
| FR-1.3 | Sessions use signed JWT access tokens plus a refresh token | Done |
| FR-1.4 | Users can request a password reset and set a new password | Done |
| FR-1.5 | Users can view and edit their profile and change their password | Done |
| FR-1.6 | Access is restricted by role across all six roles | Done |
| FR-1.7 | Administrators can create, edit, activate and deactivate accounts | Done |

**Roles:** Administrator, Procurement Manager, Supply Chain Manager, Vendor,
Finance Officer, Auditor.

Administrator accounts cannot be self-registered; an existing administrator
provisions them. A `Vendor` account must be linked to an approved vendor.

### FR-2 — Vendor management

| ID | Requirement | Status |
| --- | --- | --- |
| FR-2.1 | Register vendors with contact, address, tax and registration details | Done |
| FR-2.2 | View and edit vendor profiles | Done |
| FR-2.3 | Categorise vendors into the six defined categories | Done |
| FR-2.4 | Approval workflow: Pending → Approved / Rejected, plus Suspend and Reactivate | Done |
| FR-2.5 | Monitor vendor status and risk level | Done |
| FR-2.6 | Maintain multiple contacts per vendor with a designated primary | Done |
| FR-2.7 | Every approval decision is recorded in an immutable audit trail | Done |

**Categories:** Raw Material Suppliers, Equipment Vendors, IT Vendors,
Service Providers, Logistics Partners, Maintenance Vendors.

**Statuses:** Pending, Approved, Rejected, Suspended, Inactive.

### FR-3 — Procurement management

| ID | Requirement | Status |
| --- | --- | --- |
| FR-3.1 | Raise procurement requests with quantity, cost, priority and required date | Done |
| FR-3.2 | Approval workflow with mandatory rejection reasons | Done |
| FR-3.3 | Assign an approved vendor to a request | Done |
| FR-3.4 | Create purchase orders, optionally converted from an approved request | Done |
| FR-3.5 | Track orders through their status lifecycle | Done |
| FR-3.6 | Record and settle invoices against purchase orders | Done |

**Procurement statuses:** Pending, Approved, Rejected, Ordered, Delivered,
Completed, Cancelled.

**Purchase order statuses:** Pending, Approved, Ordered, Delivered, Completed,
Cancelled.

### FR-4 — Contract & compliance

| ID | Requirement | Status |
| --- | --- | --- |
| FR-4.1 | Contract repository with type, period, value and terms | Done |
| FR-4.2 | Renewal tracking — a successor contract links back to its predecessor | Done |
| FR-4.3 | Compliance monitoring via recorded checks that roll up onto the contract | Done |
| FR-4.4 | Certification management per vendor with expiry tracking | Done |
| FR-4.5 | Vendor documentation references | Done |
| FR-4.6 | Contract expiry notifications inside the renewal notice window | Done |

### FR-5 — Communication

| ID | Requirement | Status |
| --- | --- | --- |
| FR-5.1 | Threaded messaging between procurement staff and vendors | Done |
| FR-5.2 | Conversations can be linked to an order, request or contract | Done |
| FR-5.3 | Full message history with read state | Done |
| FR-5.4 | File sharing on messages (10 MB cap, allow-listed types) | Done |
| FR-5.5 | Activity log covering every state-changing action | Done |
| FR-5.6 | Email notifications | Milestone 4 |

### FR-6 — Dashboard & analytics

| ID | Requirement | Status |
| --- | --- | --- |
| FR-6.1 | Procurement overview with headline metrics | Done |
| FR-6.2 | Active purchase orders and delivery status | Done |
| FR-6.3 | Procurement cost analysis (monthly spend, top vendors) | Done |
| FR-6.4 | Vendor dashboard scoped to the signed-in supplier | Done |
| FR-6.5 | Admin dashboard with user management and system statistics | Done |
| FR-6.6 | Vendor performance dashboard | Milestone 3 |
| FR-6.7 | Reliability scoring and ranking | Milestone 3 |

### FR-7 — Notifications

| ID | Requirement | Status |
| --- | --- | --- |
| FR-7.1 | Procurement alerts | Done |
| FR-7.2 | Delivery delay notifications | Done |
| FR-7.3 | Vendor approval notifications | Done |
| FR-7.4 | Contract expiry alerts | Done |
| FR-7.5 | Compliance notifications | Done |
| FR-7.6 | Email notifications (SMTP) | Milestone 4 |
| FR-7.7 | SMS notifications (Twilio) | Milestone 4 |

### FR-8 — Reports & export

| ID | Requirement | Status |
| --- | --- | --- |
| FR-8.1–8.7 | Vendor, procurement, PO, compliance and contract reports; PDF and Excel export | Milestone 3 |

---

## 3. Non-functional requirements

| ID | Requirement | Target | Current |
| --- | --- | --- | --- |
| NFR-1 | API response time | < 300 ms | Met on the demo dataset |
| NFR-2 | Dashboard load time | < 2 s | Met |
| NFR-3 | Concurrent users | 1000+ | Needs load testing (M4) |
| NFR-4 | Vendor registration time | < 3 minutes | Single-screen form |
| NFR-5 | Purchase order approval | Within 24 hours | Queue + notifications |
| NFR-6 | On-time delivery monitoring | 95% coverage | Every PO with dates is tracked |
| NFR-7 | Passwords are never stored in plain text | Required | bcrypt |
| NFR-8 | Authorisation enforced server-side | Required | RBAC dependencies on every route |
| NFR-9 | Vendor data isolation | Required | Server-side scoping by `vendor_id` |
| NFR-10 | Responsive UI | Desktop + tablet | CSS grid / flex throughout |
| NFR-11 | Auditability | All state changes | `activity_logs` + per-module approval trails |

---

## 4. Data model summary

18 tables. See `database/schema.sql` for the full DDL and
`database/ER_Diagram.png` for the diagram.

| Group | Tables |
| --- | --- |
| Identity | `users`, `password_reset_tokens` |
| Vendors | `vendors`, `vendor_contacts`, `vendor_approvals` |
| Procurement | `procurement_requests`, `procurement_approvals` |
| Orders | `purchase_orders`, `purchase_order_items`, `invoices` |
| Contracts | `contracts`, `vendor_certifications`, `compliance_checks` |
| Communication | `message_threads`, `messages`, `message_attachments` |
| Platform | `notifications`, `activity_logs` |
| Performance (M3) | `vendor_performance` |

---

## 5. Out of scope for Milestone 2

Reliability scoring, supplier ranking, risk levels derived from performance,
trend analysis, report generation and export, SMTP/SMS/push delivery,
Redis caching, Celery background jobs, Docker packaging and cloud deployment.
