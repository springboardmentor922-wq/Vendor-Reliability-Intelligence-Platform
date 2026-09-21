# ProcuraHub — MySQL Database Schema

This document details the relational schema powering the **Vendor Reliability Intelligence Platform** (Milestones 1 to 3), including core transactional tables, relationship keys, and DataCo supply chain analytical tables.

---

## 1. Users (`users`)
Stores platform user accounts with 6-role RBAC authorization and optional vendor scoping.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT` PK | Unique auto-incrementing user ID |
| `email` | `VARCHAR(120)` UNIQUE | Work email address used for JWT login |
| `password_hash` | `VARCHAR(255)` | Salted bcrypt password hash |
| `full_name` | `VARCHAR(120)` | Full display name |
| `role` | `VARCHAR(50)` | Role: `admin`, `procurement_manager`, `supply_chain_manager`, `vendor`, `finance_officer`, `auditor` |
| `department` | `VARCHAR(100)` | Department affiliation (e.g. Procurement, Operations, Finance) |
| `vendor_id` | `INT` FK (Nullable) | References `vendors(id)` when user is scoped to a specific vendor organization |
| `created_at` | `DATETIME` | Account registration timestamp |

---

## 2. Vendors (`vendors`)
Vendor and supplier master records registered in the system.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT` PK | Unique vendor ID |
| `name` | `VARCHAR(150)` | Company / supplier name |
| `category` | `VARCHAR(100)` | Primary supply category (e.g. IT Vendors, Logistics, Maintenance) |
| `email` | `VARCHAR(120)` | Official vendor contact email |
| `phone` | `VARCHAR(50)` | Contact phone number |
| `address` | `TEXT` | Registered physical / billing address |
| `status` | `VARCHAR(50)` | Status: `Approved`, `Pending`, `Suspended` |
| `created_at` | `DATETIME` | Record creation timestamp |

---

## 3. Procurement Requests (`procurement_requests`)
Internal requisitions submitted by department heads before purchase order generation.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT` PK | Requisition ID |
| `requested_by` | `INT` FK | References `users(id)` |
| `description` | `TEXT` | Requisition items summary / purpose |
| `quantity` | `INT` | Quantity of requested units |
| `department` | `VARCHAR(100)` | Requesting department |
| `required_date` | `DATE` | Target fulfillment date |
| `status` | `VARCHAR(50)` | Status: `Pending`, `Approved`, `Rejected` |
| `created_at` | `DATETIME` | Submission timestamp |

---

## 4. Purchase Orders (`purchase_orders`)
Central order agreements with full lifecycle tracking from requisition to settlement.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT` PK | Unique purchase order ID |
| `po_number` | `VARCHAR(50)` UNIQUE | Document identifier (e.g. `PO-2026-0001`) |
| `vendor_id` | `INT` FK | References `vendors(id)` |
| `procurement_request_id` | `INT` FK (Nullable) | References originating `procurement_requests(id)` |
| `created_by` | `INT` FK | References `users(id)` |
| `department` | `VARCHAR(100)` | Department placing the order |
| `order_date` | `DATE` | Date order was drafted/issued |
| `delivery_date` | `DATE` | Expected delivery arrival date |
| `payment_terms` | `VARCHAR(100)` | Terms: `Net 30`, `Net 60`, `Net 15`, `Immediate` |
| `shipping_address` | `TEXT` | Delivery campus / warehouse address |
| `billing_address` | `TEXT` | Accounts payable invoice address |
| `remarks` | `TEXT` | Delivery instructions or order notes |
| `total_amount` | `FLOAT` | Aggregate total order value (including tax) |
| `status` | `VARCHAR(50)` | Lifecycle: `Draft`, `Pending`, `Approved`, `Ordered`, `Delivered`, `Completed`, `Cancelled` |
| `created_at` | `DATETIME` | Creation timestamp |

---

## 5. Purchase Order Line Items (`purchase_order_items`)
Granular line items contained within a purchase order.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT` PK | Line item ID |
| `purchase_order_id` | `INT` FK | References `purchase_orders(id)` (CASCADE DELETE) |
| `item_description` | `VARCHAR(255)` | Line item description / SKU name |
| `quantity` | `INT` | Number of units |
| `unit_price` | `FLOAT` | Unit price in USD |
| `tax_rate` | `FLOAT` | Applicable tax rate (default: 18.0%) |
| `total_price` | `FLOAT` | Calculated line amount: `(qty * unit_price) * (1 + tax_rate/100)` |

---

## 6. Contracts (`contracts`)
Vendor SLAs, legal agreements, and expiration monitoring records.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT` PK | Contract ID |
| `vendor_id` | `INT` FK | References `vendors(id)` |
| `contract_name` | `VARCHAR(150)` | Name of agreement (e.g. Annual IT Cloud SLA) |
| `start_date` | `DATE` | Agreement effective date |
| `end_date` | `DATE` | Contract expiration date |
| `status` | `VARCHAR(50)` | Status: `Active`, `Pending`, `Expired` |
| `compliance_status` | `VARCHAR(50)` | Compliance: `Compliant`, `Non-Compliant`, `Under Review` |
| `created_at` | `DATETIME` | Record timestamp |

---

## 7. Invoices & Accounts Payable (`invoices`)
Financial billing records and settlement tracking linked to fulfilled purchase orders.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT` PK | Invoice ID |
| `invoice_number` | `VARCHAR(50)` UNIQUE | Billing reference (e.g. `INV-2026-0001`) |
| `purchase_order_id` | `INT` FK | References `purchase_orders(id)` |
| `vendor_id` | `INT` FK | References `vendors(id)` |
| `amount` | `FLOAT` | Subtotal base amount (pre-tax) |
| `tax_amount` | `FLOAT` | Tax portion |
| `total_amount` | `FLOAT` | Grand total payable: `amount + tax_amount` |
| `status` | `VARCHAR(50)` | Settlement: `Pending`, `Paid`, `Overdue`, `Cancelled` |
| `due_date` | `DATE` | Payment due date |
| `paid_date` | `DATE` (Nullable) | Date payment was settled |
| `notes` | `TEXT` | Remittance notes and wire instructions |
| `created_at` | `DATETIME` | Invoice generation timestamp |

---

## 8. Communications & Messages (`communications`)
Two-way communication threads between procurement officers and vendor representatives.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT` PK | Message ID |
| `vendor_id` | `INT` FK | References `vendors(id)` |
| `sender_user_id` | `INT` FK (Nullable) | References `users(id)` |
| `sender_name` | `VARCHAR(120)` | Sender display name |
| `subject` | `VARCHAR(200)` | Thread topic / inquiry subject |
| `message_body` | `TEXT` | Message content |
| `message_type` | `VARCHAR(50)` | Category: `Inquiry`, `SLA Notice`, `Order Update` |
| `is_read` | `BOOLEAN` | Read status |
| `created_at` | `DATETIME` | Dispatch timestamp |

---

## 9. Notifications (`notifications`)
Event-triggered alerts generated automatically for contract expiries, late orders, and risk warnings.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT` PK | Notification ID |
| `user_id` | `INT` FK (Nullable) | References `users(id)` (NULL = Global) |
| `title` | `VARCHAR(150)` | Alert title |
| `message` | `TEXT` | Detailed alert description |
| `notification_type` | `VARCHAR(50)` | Type: `Delay`, `Contract`, `Vendor`, `System` |
| `is_read` | `BOOLEAN` | Read flag |
| `created_at` | `DATETIME` | Generation timestamp |

---

## 10. Audit Logs (`audit_logs`)
Immutable system activity records capturing all CRUD operations, approvals, and security events.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT` PK | Audit log ID |
| `user_id` | `INT` FK (Nullable) | User who executed the action |
| `user_email` | `VARCHAR(120)` | User email snapshot |
| `action` | `VARCHAR(80)` | Action executed (e.g. `CREATE_PO`, `APPROVE_PO`, `SETTLE_INVOICE`) |
| `entity_type` | `VARCHAR(80)` | Target entity (`PurchaseOrder`, `Invoice`, `Vendor`, `User`) |
| `entity_id` | `VARCHAR(80)` | Primary key of modified entity |
| `details` | `TEXT` | Contextual JSON or narrative details |
| `ip_address` | `VARCHAR(60)` | Client IP address |
| `created_at` | `DATETIME` | Event timestamp |

---

## 11. DataCo Orders & Items (`orders`, `order_items`)
Historical supply chain dataset (180,519 records) utilized for live statistical benchmarking, multi-factor reliability calculations, on-time rates, and category spend analytics.
