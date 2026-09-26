# UI Wireframes & User Flows — VendorIQ

Screen inventory and the flows connecting them. Each wireframe below matches
the implemented Angular screen.

---

## 1. Screen inventory

| # | Screen | Route | Access |
| --- | --- | --- | --- |
| 1 | Login | `/login` | Public |
| 2 | Registration | `/register` | Public |
| 3 | Forgot password | `/forgot-password` | Public |
| 4 | Reset password | `/reset-password` | Public |
| 5 | Dashboard | `/dashboard` | All roles |
| 6 | Vendor management | `/vendors` | All roles (vendors see own) |
| 7 | Vendor detail | `/vendors/:id` | All roles (vendors see own) |
| 8 | Approval queue | `/approvals` | Admin, Procurement, Supply Chain |
| 9 | Procurement | `/procurement` | All roles |
| 10 | Procurement detail | `/procurement/:id` | All roles |
| 11 | Purchase orders | `/purchase-orders` | All roles |
| 12 | Purchase order detail | `/purchase-orders/:id` | All roles |
| 13 | Invoices | `/invoices` | Admin, Finance, Procurement |
| 14 | Contracts | `/contracts` | All roles |
| 15 | Contract detail | `/contracts/:id` | All roles |
| 16 | Communication | `/communication` | All roles |
| 17 | Conversation | `/communication/:id` | Participants |
| 18 | Notifications | `/notifications` | All roles |
| 19 | Activity log | `/activity` | All internal roles + Auditor |
| 20 | Profile | `/profile` | All roles |
| 21 | User management | `/users` | Administrator |
| 22–24 | Performance / Analytics / Reports | `/performance`, `/analytics`, `/reports` | All roles (M3 placeholders) |

---

## 2. Layout shell

Every authenticated screen shares one shell:

```
┌──────────────┬────────────────────────────────────────────────────────┐
│              │  [☰]  Vendor Reliability Intelligence Platform         │
│  VendorIQ    │                              [🔔 3]  [AO] David M.  ▾  │
│              ├────────────────────────────────────────────────────────┤
│  MAIN MENU   │                                                        │
│  ▸ Dashboard │   <page heading>                     [action buttons]  │
│  ▸ Vendors   │   <subtitle>                                           │
│  ▸ Approvals │                                                        │
│  ▸ Procure…  │   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│  ▸ Orders    │   │ STAT   │ │ STAT   │ │ STAT   │ │ STAT   │          │
│  ▸ Invoices  │   └────────┘ └────────┘ └────────┘ └────────┘          │
│  ▸ Contracts │                                                        │
│  ▸ Comms     │   [search] [filter ▾] [filter ▾]  [Apply] [Clear]      │
│  ▸ Notifs    │                                                        │
│  ▸ Activity  │   ┌──────────────────────────────────────────────┐     │
│  ▸ Perf.     │   │  data table / cards / detail panes           │     │
│  ▸ Analytics │   └──────────────────────────────────────────────┘     │
│  ▸ Reports   │                                                        │
│  ▸ Users     │                                                        │
│              │                                                        │
│  David M.    │                                                        │
│  Procurem…   │                                                        │
└──────────────┴────────────────────────────────────────────────────────┘
```

Navigation items are filtered by role — a Vendor login never renders
Approvals, Invoices, Activity Log or User Management.

---

## 3. Key wireframes

### 3.1 Login

```
┌─────────────────────────────┬──────────────────────────────────┐
│                             │                                  │
│  ● VendorIQ                 │      ┌────────────────────────┐  │
│                             │      │  Sign in               │  │
│  ✓ Vendor onboarding with   │      │  Use your VendorIQ …   │  │
│    a controlled approval    │      │                        │  │
│  ✓ Procurement requests,    │      │  Email address    [__] │  │
│    approvals, assignment    │      │  Password         [__] │  │
│  ✓ Purchase order tracking  │      │                        │  │
│  ✓ Contract repository      │      │  [     Sign in      ]  │  │
│                             │      │                        │  │
│  Vendor Reliability         │      │  Forgot?    Register   │  │
│  Intelligence & Procurement │      │  ─────────────────────  │  │
│  Risk Management            │      │  DEMO ACCOUNTS         │  │
│                             │      │  [Admin  ] [Procure. ] │  │
│                             │      │  [Supply ] [Finance  ] │  │
└─────────────────────────────┴──────────────────────────────────┘
```

### 3.2 Vendor management

```
Vendor management                              [+ Register vendor]
Register suppliers, categorise them, move them through approval.

[TOTAL 12] [APPROVED 8] [PENDING 2] [SUSPENDED/REJECTED 2]

[Search…………] [Status ▾] [Category ▾]  [Apply] [Clear]

┌──────────┬───────────────┬──────────────┬──────────┬────────┬──────┬────────┬───┐
│ CODE     │ VENDOR        │ CATEGORY     │ LOCATION │ STATUS │ RISK │ RELIAB.│ ⋮ │
├──────────┼───────────────┼──────────────┼──────────┼────────┼──────┼────────┼───┤
│ VND-0001 │ Northwind …   │ Raw Material │ Gothenb. │Approved│ Low  │  92.4  │ ⋮ │
│ VND-0008 │ Halcyon …     │ Logistics    │ Lagos    │Pending │Medium│   —    │ ⋮ │
└──────────┴───────────────┴──────────────┴──────────┴────────┴──────┴────────┴───┘
```

Row menu: View · Edit · Approve · Reject · Suspend · Reactivate · Delete
(each entry gated by role and current status).

### 3.3 Vendor detail

```
← All vendors
Northwind Steel Works
VND-0001 · Raw Material Suppliers      [Edit] [Suspend]
[Approved] [Low risk]

[OPEN POs 1] [TOTAL SPEND 44,746] [ACTIVE CONTRACTS 2] [RELIABILITY 92.4]

┌────────────────────────────────────────┐  ┌──────────────────────┐
│ Profile │Contacts│Orders│Contracts│Cert│  │ Approval history     │
├────────────────────────────────────────┤  ├──────────────────────┤
│ Vendor code    VND-0001                │  │ ● Approved           │
│ Category       Raw Material Suppliers  │  │   David M · 12 Mar   │
│ Contact        Jonas Lindqvist         │  │   Pending → Approved │
│ Email          orders@northwind…       │  │                      │
│ …                                      │  │ ● Submitted          │
└────────────────────────────────────────┘  └──────────────────────┘
```

### 3.4 Purchase order detail

```
← All purchase orders
Hydraulic press seals
PO-2026-0005 · Ironclad Maintenance Co. · from PR-2026-0011
[Completed] [7 days late]              [Mark …] [Record invoice]

⚠ Delivery delay — expected 2 Oct, delivered 9 Oct (7 days late)

[SUBTOTAL 7,080] [TAX 576] [SHIPPING 240] [TOTAL USD 7,896]

┌───────────────────────────────────────┐  ┌────────────────────┐
│ Line items                            │  │ Order details      │
│ ITEM        QTY    UNIT PRICE   TOTAL │  │ PO number  PO-…    │
│ Seal kit A  40 Kits   120.00  4,800.00│  │ Vendor     Ironclad│
│ Seal kit B  20 Kits   114.00  2,280.00│  │ Order date 2 Sep   │
├───────────────────────────────────────┤  │ Expected   2 Oct   │
│ Invoices                              │  │ Actual     9 Oct   │
│ INV-2026-0005  USD 7,656.00    [Paid] │  │ Terms      Net 30  │
└───────────────────────────────────────┘  └────────────────────┘
```

### 3.5 Approval queue

```
Approval queue                                        [Refresh]

[VENDORS PENDING 2]  [REQUESTS PENDING 2]

┌ Vendors (2) ┬ Procurement requests (2) ┐
│                                        │
│  Halcyon Freight Partners              │
│  VND-0008 · Logistics · Lagos, Nigeria │
│  Grace Adeyemi · ops@halcyon…          │
│  [Pending] [Medium]   [✓ Approve] [✗ Reject]
│                                        │
│  Quantum Cloud Networks                │
│  VND-0009 · IT Vendors · Osaka, Japan  │
│  [Pending] [Medium]   [✓ Approve] [✗ Reject]
└────────────────────────────────────────┘
```

### 3.6 Conversation

```
← All conversations
Delivery schedule for PO batch 3
Northwind Steel Works · PO-2026-0001    [Change status ▾]
[Open] [High]

┌──────────────────────────────────────────────────────────┐
│  David Mwangi  [Procurement Manager]        9/2 11:12    │
│  Could you confirm the dispatch date …                   │
│                                                          │
│                 Jonas Lindqvist  [Vendor]   9/2 11:12    │
│                 Dispatch is booked for Tuesday …         │
│                                            📎 schedule.pdf│
├──────────────────────────────────────────────────────────┤
│  Write a reply  [_______________________________]        │
│  [📎 Attach file]                        [Send reply →]  │
└──────────────────────────────────────────────────────────┘
```

---

## 4. User flows

### 4.1 Authentication

```
Login ──valid──▶ Dashboard (role-filtered navigation)
  │
  ├─ invalid ──▶ inline error, stay on Login
  ├─ Register ──▶ Registration ──success──▶ Dashboard
  └─ Forgot ──▶ Forgot password ──token──▶ Reset password ──▶ Login
```

### 4.2 Vendor onboarding

```
Procurement/Supply Chain: Register vendor
        ▼
   status = Pending  ──▶ notification to Admin + Procurement Manager
        ▼
   Approval queue (or vendor detail)
        ▼
  ┌─────┴──────┐
Approve      Reject (reason required)
  ▼             ▼
Approved     Rejected ──▶ vendor notified with the reason
  │
  ├─ eligible for requests, purchase orders and contracts
  └─ Suspend ──▶ Suspended ──▶ Reactivate ──▶ Approved
```

### 4.3 Procurement to delivery

```
Raise procurement request        status = Pending
        ▼
Assign approved vendor           (optional, before or after approval)
        ▼
Approve request                  status = Approved
        ▼
Raise purchase order             request → Ordered, PO = Pending
        ▼
Approve PO                       PO = Approved
        ▼
Place order                      PO = Ordered
        ▼
Record delivery                  PO = Delivered, request → Delivered
                                 late? → delay notification
        ▼
Complete                         PO = Completed, request → Completed
        ▼
Finance records invoice ──▶ mark Paid
```

Cancellation is reachable from Pending, Approved and Ordered.

### 4.4 Contract lifecycle

```
Create contract (Draft)
        ▼
Activate ──▶ Active
        ▼
   expiry date approaches
        ▼
  within renewal notice window ──▶ Expiring ──▶ expiry alerts
        ▼
  ┌─────┴──────┬───────────────┐
Renew      Terminate      (lapse)
  ▼             ▼             ▼
Renewed    Terminated     Expired
  │
  └─▶ successor contract created, linked via renewed_from
```

Compliance checks run against a contract at any point; a `Non-Compliant`
result flips the contract's compliance status and alerts procurement and audit.

### 4.5 Vendor-scoped experience

```
Vendor login
   ▼
Navigation renders: Dashboard, Vendors, Procurement, Purchase Orders,
                    Contracts, Communication, Notifications, + M3 pages
   ▼
Every list is filtered server-side to the linked vendor_id:
   · own vendor record only
   · purchase orders issued to them
   · requests assigned to them
   · their contracts and invoices
   · conversations involving them
   · dashboard metrics and activity feed scoped to their own records
   ▼
Attempting another vendor's record → 403
```

---

## 5. Design system

Derived from the `design/` Modernist tokens, adapted for the Angular Material
build:

| Token | Value | Use |
| --- | --- | --- |
| `--viq-sidebar` | `#14171f` | Sidebar, auth aside |
| `--viq-accent` | `#2f6fed` | Primary actions, active nav, chart fills |
| `--viq-ground` | `#f4f6f9` | Page background |
| `--viq-surface` | `#ffffff` | Cards, tables |
| `--viq-line` | `#e2e6ec` | Borders and dividers |
| `--viq-radius` | `10px` | Cards, inputs, buttons |

Status colours are semantic and consistent everywhere via `<app-status-pill>`:
green for approved/active/complete, amber for pending/expiring, red for
rejected/suspended/expired/non-compliant, blue for in-flight states.

Responsive breakpoints: 1080 px (detail panes stack), 860 px (line-item grid
reflows), 720 px (form grids collapse to one column), 640 px (top bar condenses).
