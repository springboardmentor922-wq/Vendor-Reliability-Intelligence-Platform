# MongoDB Database Schema Documentation
## Vendor Reliability Intelligence Platform

---

## Overview

The platform uses MongoDB (document store) with 9 collections.
All `_id` fields are MongoDB ObjectId. All timestamps are UTC datetime objects.

**Database Name:** `vendor_reliability_db` (configurable via `.env`)

---

## Collections

### 1. `users`

Stores platform user accounts. Password hashes are never returned to the UI.

```json
{
  "_id": "ObjectId",
  "name": "string (required) — full display name",
  "email": "string (required, unique, lowercase) — login identifier",
  "password_hash": "string (required) — bcrypt hash, NEVER exposed",
  "role": "string (required) — one of 6 defined roles",
  "status": "string — Active | Inactive | Suspended",
  "phone": "string (optional)",
  "department": "string (optional)",
  "profile_picture": "string (optional) — URL",
  "created_at": "datetime (UTC)",
  "updated_at": "datetime (UTC)",
  "last_login": "datetime (UTC, nullable)"
}
```

**Indexes:**
| Field | Type | Notes |
|-------|------|-------|
| email | Unique Ascending | Primary login lookup |
| role | Ascending | Role-based queries |
| status | Ascending | Active user filter |
| created_at | Descending | Chronological listing |

---

### 2. `vendors`

Stores vendor/supplier profiles and approval status.

```json
{
  "_id": "ObjectId",
  "vendor_code": "string (unique) — format: VND-YYYY-XXXX",
  "company_name": "string (required)",
  "category": "string — IT & Technology | Manufacturing | etc.",
  "contact_information": {
    "primary_contact_name": "string",
    "primary_email": "string",
    "primary_phone": "string",
    "secondary_contact_name": "string (optional)",
    "secondary_email": "string (optional)",
    "secondary_phone": "string (optional)",
    "website": "string (optional)"
  },
  "address": {
    "street": "string",
    "city": "string",
    "state": "string",
    "country": "string",
    "postal_code": "string"
  },
  "status": "string — Active | Inactive | Suspended | Pending",
  "approval_status": "string — Pending | Approved | Rejected",
  "description": "string (optional)",
  "tax_id": "string (optional)",
  "payment_terms": "string (optional) — Net 30 | Net 45 | etc.",
  "credit_limit": "number (optional)",
  "rating": "number — 0.0 to 5.0 (computed in Milestone 2)",
  "reliability_score": "number — 0 to 100 (computed in Milestone 3)",
  "created_by": "string — user_id of creator",
  "approved_by": "string — user_id of approver (nullable)",
  "created_at": "datetime (UTC)",
  "updated_at": "datetime (UTC)"
}
```

**Indexes:**
| Field | Type | Notes |
|-------|------|-------|
| vendor_code | Unique Ascending | Unique identifier |
| company_name | Ascending | Search/sort |
| status | Ascending | Status filter |
| approval_status | Ascending | Approval workflow |
| category | Ascending | Category filter |
| created_at | Descending | Listing order |

---

### 3. `procurement_requests`

Tracks procurement requests from creation through approval.

```json
{
  "_id": "ObjectId",
  "request_number": "string (unique) — format: PR-YYYYMMDD-NNNN",
  "requested_by": "string — user_id",
  "department": "string",
  "items": [
    {
      "description": "string",
      "quantity": "number",
      "unit": "string",
      "unit_price": "number",
      "total_price": "number"
    }
  ],
  "estimated_cost": "number",
  "vendor_id": "string (optional) — assigned vendor",
  "status": "string — Draft | Submitted | Under Review | Approved | Rejected | Cancelled",
  "priority": "string — Low | Medium | High | Urgent",
  "justification": "string (optional)",
  "required_by_date": "datetime (optional)",
  "approved_by": "string — user_id (nullable)",
  "approved_at": "datetime (nullable)",
  "rejection_reason": "string (nullable)",
  "created_at": "datetime (UTC)",
  "updated_at": "datetime (UTC)"
}
```

**Indexes:** request_number (unique), requested_by, vendor_id, status, created_at

---

### 4. `purchase_orders`

Tracks purchase orders issued to vendors.

```json
{
  "_id": "ObjectId",
  "po_number": "string (unique) — format: PO-YYYYMMDD-NNNN",
  "vendor_id": "string (required) — vendor ObjectId",
  "request_id": "string (optional) — linked procurement request",
  "items": [
    {
      "description": "string",
      "quantity": "number",
      "unit": "string",
      "unit_price": "number",
      "total_price": "number"
    }
  ],
  "total_amount": "number",
  "currency": "string — default USD",
  "order_date": "datetime",
  "expected_delivery_date": "datetime (nullable)",
  "actual_delivery_date": "datetime (nullable)",
  "status": "string — Draft | Issued | Confirmed | In Transit | Delivered | Partially Delivered | Cancelled | Disputed",
  "created_by": "string — user_id",
  "approved_by": "string — user_id (nullable)",
  "shipping_address": "string (optional)",
  "payment_terms": "string (optional)",
  "notes": "string (optional)",
  "created_at": "datetime (UTC)",
  "updated_at": "datetime (UTC)"
}
```

**Indexes:** po_number (unique), vendor_id, request_id, status, order_date, created_at

---

### 5. `deliveries`

Tracks physical deliveries associated with purchase orders.

```json
{
  "_id": "ObjectId",
  "delivery_number": "string (unique) — format: DEL-YYYYMMDD-NNNN",
  "po_id": "string — purchase order ObjectId",
  "vendor_id": "string — vendor ObjectId",
  "expected_date": "datetime (nullable)",
  "actual_date": "datetime (nullable)",
  "status": "string — Pending | In Transit | Delivered | Delayed | Returned",
  "quality_rating": "number (nullable) — 1.0 to 5.0",
  "delay_days": "number — default 0",
  "remarks": "string (optional)",
  "received_by": "string — user_id (nullable)",
  "tracking_number": "string (optional)",
  "carrier": "string (optional)",
  "created_at": "datetime (UTC)"
}
```

**Indexes:** delivery_number (unique), po_id, vendor_id, status, expected_date, created_at

---

### 6. `contracts`

Manages vendor contracts and compliance tracking.

```json
{
  "_id": "ObjectId",
  "contract_number": "string (unique) — format: CON-YYYY-NNNN",
  "vendor_id": "string — vendor ObjectId",
  "title": "string",
  "start_date": "datetime (nullable)",
  "end_date": "datetime (nullable)",
  "contract_value": "number",
  "currency": "string — default USD",
  "compliance_status": "string — Compliant | Non-Compliant | Under Review | Expired",
  "document_reference": "string (optional) — file path or URL",
  "description": "string (optional)",
  "payment_schedule": "string (optional)",
  "renewal_terms": "string (optional)",
  "auto_renew": "boolean",
  "notification_days_before_expiry": "number — default 30",
  "certifications_required": ["string"],
  "created_by": "string — user_id",
  "created_at": "datetime (UTC)",
  "updated_at": "datetime (UTC)"
}
```

**Indexes:** contract_number (unique), vendor_id, compliance_status, end_date, created_at

---

### 7. `communications`

Vendor-related messaging and communications.

```json
{
  "_id": "ObjectId",
  "vendor_id": "string — vendor ObjectId",
  "user_id": "string — sender user ObjectId",
  "subject": "string",
  "message": "string",
  "communication_type": "string — Email | Message | Note | Meeting | Phone",
  "attachments": ["string"],
  "created_at": "datetime (UTC)"
}
```

**Indexes:** vendor_id, user_id, created_at

---

### 8. `notifications`

In-platform user notifications.

```json
{
  "_id": "ObjectId",
  "user_id": "string — target user ObjectId",
  "title": "string",
  "message": "string",
  "notification_type": "string — Info | Warning | Alert | Success",
  "is_read": "boolean — default false",
  "created_at": "datetime (UTC)"
}
```

**Indexes:** user_id, is_read, created_at

---

### 9. `audit_logs`

Immutable audit trail for all significant platform actions.

```json
{
  "_id": "ObjectId",
  "user_id": "string — actor user ObjectId",
  "action": "string — e.g. REGISTER | LOGIN | CREATE_VENDOR | APPROVE_VENDOR",
  "entity": "string — e.g. User | Vendor | PurchaseOrder",
  "entity_id": "string — ObjectId of the affected entity",
  "details": {
    "key": "value — action-specific metadata"
  },
  "timestamp": "datetime (UTC)"
}
```

**Indexes:** user_id, entity, timestamp

---

## Index Summary

| Collection | Unique Indexes | Regular Indexes |
|------------|---------------|-----------------|
| users | email | role, status, created_at |
| vendors | vendor_code | company_name, status, approval_status, category, created_at |
| procurement_requests | request_number | requested_by, vendor_id, status, created_at |
| purchase_orders | po_number | vendor_id, request_id, status, order_date, created_at |
| deliveries | delivery_number | po_id, vendor_id, status, expected_date, created_at |
| contracts | contract_number | vendor_id, compliance_status, end_date, created_at |
| communications | — | vendor_id, user_id, created_at |
| notifications | — | user_id, is_read, created_at |
| audit_logs | — | user_id, entity, timestamp |

---

## Relationships (Logical, Non-Enforced)

```
users ──────────────── vendors (created_by, approved_by)
users ──────────────── procurement_requests (requested_by, approved_by)
users ──────────────── purchase_orders (created_by, approved_by)
users ──────────────── notifications (user_id)
users ──────────────── audit_logs (user_id)

vendors ─────────────── procurement_requests (vendor_id)
vendors ─────────────── purchase_orders (vendor_id)
vendors ─────────────── deliveries (vendor_id)
vendors ─────────────── contracts (vendor_id)
vendors ─────────────── communications (vendor_id)

procurement_requests ── purchase_orders (request_id)
purchase_orders ──────── deliveries (po_id)
```

> MongoDB does not enforce foreign key constraints. Referential integrity is handled at the application service layer.
