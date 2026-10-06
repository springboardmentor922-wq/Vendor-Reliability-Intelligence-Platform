# Database Design Specification

## 1. Implemented Table: `users` (Milestone 1 Core)

The `users` table manages user identity, authentication, role assignment, and account status.

### Field Definitions

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY`, `AUTOINCREMENT` | Unique primary surrogate identifier |
| `full_name` | `VARCHAR(255)` | `NOT NULL` | User's full display name |
| `email` | `VARCHAR(255)` | `UNIQUE`, `NOT NULL`, `INDEX` | User's email (login identifier) |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | `bcrypt` salted password hash |
| `role` | `VARCHAR(50)` | `NOT NULL`, `CHECK` | User role (`ADMINISTRATOR`, `PROCUREMENT_MANAGER`, `SUPPLY_CHAIN_MANAGER`, `VENDOR`, `FINANCE_OFFICER`, `AUDITOR`) |
| `is_active` | `BOOLEAN` | `NOT NULL`, `DEFAULT True` | Flag for account suspension or active state |
| `created_at` | `TIMESTAMP WITH TIMEZONE` | `NOT NULL`, `DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMP WITH TIMEZONE` | `NOT NULL`, `DEFAULT NOW()` | Record last update timestamp |

---

## 2. Planned Future Tables (Milestones 2 & 3 Horizon)

### 2.1 `vendors` Table (Planned)
* `id` (PK), `company_name`, `tax_id`, `contact_email`, `phone`, `address`, `status`, `reliability_score`, `created_at`.

### 2.2 `purchase_orders` Table (Planned)
* `id` (PK), `po_number`, `vendor_id` (FK), `created_by` (FK), `total_amount`, `status`, `delivery_date`, `created_at`.

### 2.3 `vendor_performance_logs` Table (Planned)
* `id` (PK), `vendor_id` (FK), `po_id` (FK), `on_time_delivery` (BOOL), `quality_rating` (FLOAT), `defect_rate` (FLOAT), `recorded_at`.

### 2.4 `audit_logs` Table (Planned)
* `id` (PK), `user_id` (FK), `action`, `resource`, `ip_address`, `timestamp`.
