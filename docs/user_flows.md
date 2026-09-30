# User Flow Diagrams
## Vendor Reliability Intelligence Platform — Milestone 1

---

## 1. Authentication Flow

### 1.1 Registration Flow

```
┌─────────────┐
│  Visit App  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Login Page     │
│ "Create Account"│
└──────┬──────────┘
       │
       ▼
┌─────────────────────────────┐
│  Registration Form          │
│  - Full Name                │
│  - Email Address            │
│  - Phone (optional)         │
│  - Department (optional)    │
│  - Role Selection           │
│  - Password                 │
│  - Confirm Password         │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Validation                 │
│  ✓ All required fields      │
│  ✓ Valid email format       │
│  ✓ Password strength        │
│  ✓ Passwords match          │
│  ✓ Unique email check       │
└──────┬──────────────────────┘
       │
       ├── FAIL ──► Error Message ──► Back to Form
       │
       ▼ PASS
┌─────────────────────────────┐
│  Hash Password (bcrypt)     │
│  Insert User to MongoDB     │
│  Write Audit Log            │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Success Message            │
│  "Account created. Log in." │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Redirect to Login Page     │
└─────────────────────────────┘
```

### 1.2 Login Flow

```
┌─────────────────────────────┐
│  Login Page                 │
│  Email + Password           │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Validate Input             │
│  ✓ Fields not empty         │
│  ✓ Email format valid       │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Lookup User by Email       │
│  (MongoDB query)            │
└──────┬──────────────────────┘
       │
       ├── NOT FOUND ──► "Invalid email or password"
       │
       ▼ FOUND
┌─────────────────────────────┐
│  Verify Password            │
│  (bcrypt.verify)            │
└──────┬──────────────────────┘
       │
       ├── MISMATCH ──► "Invalid email or password"
       │
       ▼ MATCH
┌─────────────────────────────┐
│  Check Account Status       │
│  (Active / Suspended)       │
└──────┬──────────────────────┘
       │
       ├── NOT ACTIVE ──► "Account not active"
       │
       ▼ ACTIVE
┌─────────────────────────────┐
│  Generate JWT Token         │
│  Claims: user_id, email,    │
│          role, iat, exp     │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Update last_login          │
│  Write Audit Log            │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Create Streamlit Session   │
│  Store: token, user, role   │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Load Role Permissions      │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Open Role-Specific         │
│  Dashboard                  │
└─────────────────────────────┘
```

### 1.3 Session Validation Flow (Every Page Load)

```
┌─────────────────────────────┐
│  Page Request               │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Check Session Token        │
└──────┬──────────────────────┘
       │
       ├── NO TOKEN ──► Redirect to Login
       │
       ▼ TOKEN EXISTS
┌─────────────────────────────┐
│  Decode JWT                 │
│  Validate Signature         │
│  Check Expiration           │
└──────┬──────────────────────┘
       │
       ├── EXPIRED ──► Clear Session ──► Login
       ├── INVALID ──► Clear Session ──► Login
       │
       ▼ VALID
┌─────────────────────────────┐
│  Check Page Permission      │
│  for User's Role            │
└──────┬──────────────────────┘
       │
       ├── DENIED ──► "Access Denied" ──► Dashboard
       │
       ▼ ALLOWED
┌─────────────────────────────┐
│  Render Page                │
└─────────────────────────────┘
```

---

## 2. Vendor Management Flow

### 2.1 Vendor Registration Flow

```
┌─────────────────┐
│   Dashboard     │
└──────┬──────────┘
       │ Navigate to Vendors
       ▼
┌─────────────────────────────┐
│  Vendor Management          │
│  "Register Vendor" tab      │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Vendor Registration Form   │
│  - Company Name             │
│  - Category                 │
│  - Tax ID                   │
│  - Payment Terms            │
│  - Primary Contact          │
│  - Address                  │
│  - Description              │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Validate Input             │
│  Generate vendor_code       │
│  Set status = "Pending"     │
│  Set approval = "Pending"   │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Insert to MongoDB          │
│  Write Audit Log            │
│  Notify Admin               │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  "Pending Approval" Queue   │
└─────────────────────────────┘
```

### 2.2 Vendor Approval Flow

```
┌─────────────────────────────┐
│  Vendors → Pending Tab      │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Review Vendor Details      │
│  (Procurement Manager /     │
│   Administrator)            │
└──────┬──────────────────────┘
       │
       ├── APPROVE ──────────────────────┐
       │                                 ▼
       │                    ┌────────────────────────┐
       │                    │  status = "Active"     │
       │                    │  approval = "Approved" │
       │                    │  approved_by = user_id │
       │                    │  Notify Requestor      │
       │                    └────────────────────────┘
       │
       └── REJECT ───────────────────────┐
                                         ▼
                            ┌────────────────────────┐
                            │  status = "Suspended"  │
                            │  approval = "Rejected" │
                            │  Write Audit Log       │
                            └────────────────────────┘
```

---

## 3. Procurement Flow (Foundation — Milestone 2 will expand)

```
┌─────────────────────────────┐
│  Procurement Dashboard      │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Create Procurement Request │
│  - Department               │
│  - Items (multi-line)       │
│  - Estimated Cost           │
│  - Priority                 │
│  - Justification            │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Auto-generate PR Number    │
│  Status = "Draft"/"Submitted"│
│  Write to MongoDB           │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Approval Review            │
│  (Procurement Manager)      │
└──────┬──────────────────────┘
       │
       ├── APPROVED ─────────────────────┐
       │                                 ▼
       │                    ┌────────────────────────┐
       │                    │  Select Vendor         │
       │                    │  Create Purchase Order │
       │                    │  Issue PO to Vendor    │
       │                    └──────────┬─────────────┘
       │                               │
       │                               ▼
       │                    ┌────────────────────────┐
       │                    │  Track Delivery        │
       │                    │  Receive Goods         │
       │                    │  Rate Quality          │
       │                    └────────────────────────┘
       │
       └── REJECTED ─────► Close Request
```

---

## 4. Role-Based Navigation Flow

```
User Authenticates
       │
       ├── Administrator ──► Full sidebar (all 9 pages + Admin)
       │
       ├── Procurement Manager ──► Dashboard, Vendors, Procurement,
       │                           POs, Performance, Analytics, Reports,
       │                           Notifications, Profile
       │
       ├── Supply Chain Manager ──► Dashboard, Vendors, Procurement,
       │                            POs, Performance, Analytics,
       │                            Notifications, Profile
       │
       ├── Vendor ──► Dashboard, Purchase Orders, Performance,
       │              Notifications, Profile
       │
       ├── Finance Officer ──► Dashboard, Procurement, Purchase Orders,
       │                       Reports, Notifications, Profile
       │
       └── Auditor ──► Dashboard, Vendors, Procurement, POs,
                       Performance, Analytics, Reports,
                       Notifications, Profile (all read-only)
```
