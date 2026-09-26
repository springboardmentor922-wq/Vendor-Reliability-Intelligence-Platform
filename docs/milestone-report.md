# Milestone Report — Milestones 1 & 2

Project: Vendor Reliability Intelligence & Procurement Risk Management Platform
Stack: FastAPI · PostgreSQL · SQLAlchemy · Angular 21 · Angular Material

---

## Milestone 1 — Requirements, UI design, database design & backend setup

### Tasks

| # | Task | Status | Evidence |
| --- | --- | --- | --- |
| i | Define project objectives | Done | `docs/requirements.md` §1 |
| ii | Gather functional and non-functional requirements | Done | `docs/requirements.md` §2–3 |
| iii | Design UI wireframes | Done | `docs/ui-wireframes-and-user-flows.md` §3 |
| iv | Create user flow diagrams | Done | `docs/ui-wireframes-and-user-flows.md` §4 |
| v | Prepare dashboard layouts | Done | Wireframes §2, implemented in `features/dashboard` |
| vi | Design responsive screens | Done | Breakpoints documented; implemented in `styles.scss` |
| vii | Design database schema | Done | `database/schema.sql`, `database/ER_Diagram.png` |
| viii | Initialise FastAPI project | Done | `backend/main.py` |
| ix | Configure PostgreSQL | Done | `backend/database.py`, `backend/.env` |
| x | Implement JWT authentication | Done | `backend/security.py`, `backend/api/auth.py` |
| xi | Create Angular frontend | Done | `frontend/` (Angular 21) |
| xii | Configure Angular Material | Done | `frontend/src/styles.scss` |

### Outcomes

- ✅ UI wireframes completed — 24 screens documented and implemented
- ✅ User flows finalised — 5 end-to-end flows
- ✅ Database schema completed — 18 tables with full referential integrity
- ✅ FastAPI backend initialised — 11 routers, ~90 endpoints
- ✅ Angular frontend initialised — standalone components, lazy routes
- ✅ Authentication implemented — JWT + refresh, bcrypt, reset tokens, RBAC

### Evaluation criteria

| Criterion | Status |
| --- | --- |
| FastAPI project setup completed | ✅ |
| Angular application initialised | ✅ |
| Database schema finalised | ✅ |
| Authentication implemented | ✅ |
| UI wireframes completed | ✅ |

---

## Milestone 2 — Vendor & procurement management

### Tasks

| # | Task | Status |
| --- | --- | --- |
| i | Develop Vendor Management module | Done |
| ii | Build Procurement Management module | Done |
| iii | Implement Purchase Orders | Done |
| iv | Develop Vendor Approval workflow | Done |
| v | Create Contract Management module | Done |
| vi | Build Communication module | Done |

### What was built

**Vendor management** — registration with auto-generated codes, profile editing,
six-category classification, multiple contacts with a designated primary, risk
levels, search and filtering, statistics, and a detail view aggregating orders,
contracts, certifications and spend.

**Vendor approval workflow** — Pending → Approved / Rejected, plus Suspend and
Reactivate. Rejection requires a reason that is surfaced to the vendor. Every
decision writes an immutable `vendor_approvals` row and notifies the relevant
parties. Only approved vendors can be assigned work.

**Procurement management** — requests with quantity, unit, cost, currency,
priority, department, justification and required date; approval workflow with
its own audit trail; vendor assignment restricted to approved vendors;
cancellation; and delete protection once a purchase order exists.

**Purchase orders** — raised standalone or converted from an approved request
(prefilling vendor, title, dates and line item). Multi-line items with live
subtotal/tax/shipping/total calculation. Server-enforced status transitions.
Automatic delay detection against the expected delivery date, with
notifications. Status changes cascade onto the parent request. Invoices are
recorded against orders by Finance and settled through their own lifecycle.

**Contract management** — repository with type, period, value, terms and
auto-renew flag; date-driven lifecycle that moves contracts into Expiring and
Expired automatically; renewal that creates a linked successor; termination;
compliance checks that roll up onto the contract and alert on failure; per-vendor
certifications with expiry tracking; and an expiry scan that raises alerts.

**Communication** — threaded conversations optionally linked to an order,
request or contract; priority and status; read tracking; file sharing with a
10 MB cap and an allow-list of content types; and an activity log covering every
state-changing action across the platform.

### Outcomes

- ✅ Vendor Management operational
- ✅ Procurement workflow completed
- ✅ Purchase Order module functional
- ✅ Contract Management completed

### Evaluation criteria

| Criterion | Status |
| --- | --- |
| Vendor Management operational | ✅ |
| Procurement module functional | ✅ |
| Purchase Order workflow completed | ✅ |
| Contract Management functional | ✅ |

---

## Verification

`tests/smoke_test.py` — **110 checks, all passing** against a running API.

| Area | Checks |
| --- | --- |
| Authentication | 7 |
| Password reset | 5 |
| Role-based access control | 4 |
| Vendor management & approval workflow | 17 |
| Vendor data isolation | 2 |
| Procurement requests | 13 |
| Purchase orders | 10 |
| PO status transitions | 8 |
| Invoices | 6 |
| PO data isolation | 1 |
| Contracts & compliance | 15 |
| Communication | 9 |
| Notifications | 5 |
| Dashboard | 8 |

The suite covers negative paths as well as happy paths: bad credentials,
expired/reused reset tokens, forbidden role actions, invalid categories and
priorities, zero quantities, assigning rejected vendors, ordering from suspended
vendors, illegal status jumps, deleting paid invoices and active contracts, and
cross-vendor access attempts.

The frontend was additionally driven in a browser: login, dashboard, vendor
list, purchase order detail, approval queue, conversation view and contract
detail all render live API data with no console errors, and a Vendor login
correctly renders a reduced navigation and scoped data.

### Defect found and fixed during verification

The dashboard's *Recent activity* feed was not vendor-scoped — a supplier login
could see other vendors' names, contract numbers and internal finance actions.
Fixed in `backend/api/dashboard.py` by filtering the feed to entities belonging
to the signed-in vendor, and covered by three new regression checks.

---

## Deferred to later milestones

| Feature | Milestone |
| --- | --- |
| Vendor performance monitoring screens | 3 |
| Reliability scoring, ranking, risk levels, trend analysis | 3 |
| Analytics dashboard | 3 |
| Report generation, PDF and Excel export | 3 |
| SMTP email, Twilio SMS, Firebase push delivery | 4 |
| Redis caching and Celery background jobs | 4 |
| Docker, CI/CD and cloud deployment | 4 |
| Load testing to 1000+ concurrent users | 4 |

Routes and navigation for the Milestone 3 screens already exist and render an
explanatory placeholder, so the shell is complete.
