# Functional Requirements Specification

## 1. Authentication & Security Subsystem (Milestone 1 Core)

### FR-AUTH-001: User Registration
* **Description:** The system must allow new users to register by providing their Full Name, Email Address, Password, and designated User Role.
* **Validation Rules:**
  * Email must be a valid RFC 5322 format and unique across the platform.
  * Password must be minimum 8 characters.
  * Role must be chosen from the 6 system-supported roles (`ADMINISTRATOR`, `PROCUREMENT_MANAGER`, `SUPPLY_CHAIN_MANAGER`, `VENDOR`, `FINANCE_OFFICER`, `AUDITOR`).
* **Security Action:** Passwords must be hashed using `bcrypt` prior to database insertion. Raw passwords must never be stored or logged.

### FR-AUTH-002: User Authentication (Login)
* **Description:** Users must authenticate using their email and password.
* **Verification:** The backend verifies credentials against the hashed password stored in PostgreSQL.
* **Token Generation:** Upon successful authentication, the system generates a signed JSON Web Token (JWT) containing the user identity (sub) and assigned role claim.

### FR-AUTH-003: User Profile (`/api/auth/me`)
* **Description:** Authenticated users can fetch their current user details using a valid Bearer JWT.
* **Payload Safety:** Response includes `id`, `full_name`, `email`, `role`, `is_active`, `created_at`, `updated_at`. `password_hash` is explicitly excluded.

---

## 2. User Roles & Governance

| Role Code | Display Name | Functional Responsibilities & Permissions |
| :--- | :--- | :--- |
| `ADMINISTRATOR` | Administrator | System settings, user provisioning, global auditing, security policies |
| `PROCUREMENT_MANAGER` | Procurement Manager | Vendor vetting, purchase order creation, approval workflows |
| `SUPPLY_CHAIN_MANAGER` | Supply Chain Manager | Logistics tracking, lead time monitoring, inventory risk oversight |
| `VENDOR` | Vendor Partner | Profile management, PO status update, invoice submission |
| `FINANCE_OFFICER` | Finance Officer | Budget alignment, invoice matching, payment approvals |
| `AUDITOR` | Auditor | Read-only compliance access, audit trail review, risk report inspection |

---

## 3. User Interface & Route Placeholders (Milestone 1 Scope)

### FR-UI-001: Navigation Layout & Top Bar
* Responsive header showing app title, current user full name, role badge, navigation drawer toggle, and logout button.

### FR-UI-002: Portal Dashboard (`/dashboard`)
* KPI metrics: Total Vendors, Active Purchase Orders, Pending Orders.
* Visual placeholders for Vendor Performance Summary and Recent Purchase Orders.

### FR-UI-003: Module Placeholders
The platform includes client-side routes, navigation menu items, and UI placeholders for future milestones:
* `/vendors`: Vendor Management Module Placeholder
* `/procurement`: Procurement Operations Dashboard Placeholder
* `/purchase-orders`: Purchase Order Management Placeholder
* `/performance`: Vendor Performance Dashboard Placeholder
* `/analytics`: Predictive Risk Analytics Placeholder
* `/reports`: Procurement Reports & Audit Logs Placeholder
* `/notifications`: System & Risk Notifications Placeholder
