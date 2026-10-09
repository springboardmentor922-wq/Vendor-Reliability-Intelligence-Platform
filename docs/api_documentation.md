# VendorIQ API Reference

Base URL in local development: `http://localhost:8001`

Docker frontend calls the same endpoints through the `/backend/` Nginx proxy.

Authentication is a bearer JWT returned by `POST /login`.

## Authentication

| Method | Path | Purpose |
|---|---|---|
| POST | `/register` | Create vendor/auditor account |
| POST | `/login` | Obtain JWT |
| GET | `/users/me` | Current profile |
| PUT | `/users/me` | Update current name |
| POST | `/auth/password-reset/request` | Request password reset |
| POST | `/auth/password-reset/confirm` | Confirm reset token |

## Core operations

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/vendors` | List/create vendors |
| GET/PUT/DELETE | `/vendors/{id}` | Vendor lifecycle |
| GET | `/vendors/{id}/contacts` | Vendor contacts |
| POST | `/vendors/{id}/contacts` | Add vendor contact |
| GET/POST | `/procurement-requests` | Procurement requests |
| PUT | `/procurement-requests/{id}` | Change request status |
| GET/POST | `/purchase-orders` | Purchase orders |
| GET | `/purchase-orders/{id}` | PO detail |
| PUT | `/purchase-orders/{id}/status` | PO lifecycle status |
| PUT | `/purchase-orders/{id}/approve` | Approve PO |
| PUT | `/purchase-orders/{id}/reject` | Reject PO |
| GET/POST | `/vendor-performance` | Operational scorecards |
| GET | `/vendors/{id}/risk` | Vendor risk signal |
| GET | `/dashboard/summary` | Current operational KPIs |

## Intelligence

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/suppliers` | Historical supplier proxies |
| GET | `/api/suppliers/ranking` | Ranked historical proxies |
| GET | `/api/suppliers/{product_card_id}` | Transparent scorecard |
| GET | `/api/analytics/dashboard` | Historical analytics |
| GET | `/api/analytics/procurement` | Procurement KPIs |

## Governance & finance

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/contracts` | Contract repository |
| GET | `/contracts/{id}` | Contract detail |
| PUT/DELETE | `/contracts/{id}` | Contract lifecycle |
| GET | `/contracts/expiring` | Renewal window |
| GET | `/contracts/compliance` | Compliance summary |
| GET/POST | `/api/invoices` | Invoice records |
| PUT | `/api/invoices/{id}/status` | Invoice lifecycle |
| GET | `/api/invoices/summary` | Finance KPIs |
| GET/POST | `/api/communications` | Message records |
| GET | `/api/communications/threads` | Thread summary |
| GET | `/api/notifications` | Notifications |
| PUT | `/api/notifications/{id}/read` | Mark read |
| PUT | `/api/notifications/read-all` | Mark all read |
| POST | `/api/notifications/generate` | Run alert scan |
| GET | `/api/audit-logs` | Audit events |
| GET | `/api/audit-logs/summary` | Audit summary |

## Search & files

`GET /api/search?q=<term>` groups results across relevant business entities.

`POST /api/files/upload` accepts validated PDF, images, text and spreadsheet files, enforcing configured size limits. `GET /api/files` lists file metadata within the requester's permitted vendor scope.

## Reports

Use:

- `GET /api/reports/{type}/preview`
- `GET /api/reports/{type}/csv`
- `GET /api/reports/{type}/pdf`
- `GET /api/reports/{type}/download` for Excel

Supported report types are `vendor-performance`, `procurement`, `purchase-orders`, `compliance`, `contracts`, `invoices`, and `audit`.

## Authorization model

The backend enforces role checks and vendor scoping. The React route guards and role-aware navigation are UX controls, not the security boundary.
