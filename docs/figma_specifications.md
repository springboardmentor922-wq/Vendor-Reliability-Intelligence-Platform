# Figma UI/UX Specifications
## Vendor Reliability Intelligence Platform — All 10 Required Screens

> These specifications are ready for direct implementation in Figma.
> Design System: Dark mode enterprise, Inter typeface, Indigo/Purple accent palette.

---

## Design System Tokens

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `bg-primary` | `#0d1117` | App background |
| `bg-card` | `#0f172a` | Card backgrounds |
| `bg-card-hover` | `#1e293b` | Card hover state |
| `border` | `rgba(99,102,241,0.2)` | Card borders |
| `accent-primary` | `#6366f1` | Primary brand color |
| `accent-secondary` | `#8b5cf6` | Secondary / gradient end |
| `accent-blue` | `#3b82f6` | Info / active states |
| `success` | `#22c55e` | Success / active badges |
| `warning` | `#f59e0b` | Warning / pending badges |
| `danger` | `#ef4444` | Error / suspended badges |
| `text-primary` | `#e2e8f0` | Headings |
| `text-secondary` | `#94a3b8` | Body text |
| `text-muted` | `#64748b` | Labels, captions |

### Typography
| Role | Font | Size | Weight |
|------|------|------|--------|
| Display heading | Inter | 2rem | 800 |
| Page heading | Inter | 1.75rem | 800 |
| Section heading | Inter | 1.1rem | 700 |
| Body | Inter | 0.875rem | 400 |
| Caption | Inter | 0.75rem | 400 |
| Badge | Inter | 0.7rem | 600 |
| Nav label | Inter | 0.875rem | 500 |

### Spacing
Base unit: 4px (0.25rem). Scale: 4, 8, 12, 16, 20, 24, 32, 48, 64px

### Border Radius
| Component | Radius |
|-----------|--------|
| Cards | 12px |
| Buttons | 8px |
| Inputs | 8px |
| Badges | 12px |
| Avatar | 50% |

---

## Screen 1 — Login Page

**Route:** `/` (unauthenticated)  
**Layout:** Full-screen centered card, gradient background

### Layout Structure
```
┌─────────────────────────────────────────────────────┐
│                  GRADIENT BACKGROUND                 │
│              (135deg: #0f0c29 → #302b63)             │
│                                                      │
│         ┌──────────────────────────────┐             │
│         │           ◈ LOGO             │             │
│         │          VendorIQ            │             │
│         │   Vendor Reliability...      │             │
│         │                              │             │
│         │  ┌────────────────────────┐  │             │
│         │  │  Welcome back          │  │             │
│         │  │  Sign in to account   │  │             │
│         │  │                        │  │             │
│         │  │  [Email Input]         │  │             │
│         │  │  [Password Input]      │  │             │
│         │  │                        │  │             │
│         │  │  [Sign In → Button]    │  │             │
│         │  │                        │  │             │
│         │  │  Don't have account?   │  │             │
│         │  │  [Create Account]      │  │             │
│         │  └────────────────────────┘  │             │
│         │                              │             │
│         │  🔐 JWT · 👥 RBAC · 🏢 Ent  │             │
│         └──────────────────────────────┘             │
└─────────────────────────────────────────────────────┘
```

### Components
- **Card:** W=420px, glassmorphism (rgba(15,23,42,0.8)), blur 20px, 1px border
- **Logo:** 40px ◈ icon, gradient text, tag line in muted color
- **Email Input:** Full width, placeholder "you@company.com"
- **Password Input:** Full width, type=password, placeholder "••••••••"
- **Primary Button:** Full width, gradient #6366f1→#8b5cf6, hover: lift + shadow
- **Feature Pills:** 3 pills at bottom (JWT, RBAC, Enterprise)

---

## Screen 2 — Registration Page

**Route:** `/register`  
**Layout:** Full-screen, wider card (520px), scrollable

### Layout Structure
```
┌─────────────────────────────────────────────┐
│  GRADIENT BACKGROUND                         │
│                                              │
│   ┌────────────────────────────────────┐    │
│   │  ◈ Create Account                  │    │
│   │  Join the VendorIQ Platform        │    │
│   │                                    │    │
│   │  PERSONAL INFORMATION              │    │
│   │  [Full Name]  [Phone]              │    │
│   │  [Email Address]                   │    │
│   │  [Department]                      │    │
│   │  ─────────────────────────         │    │
│   │  ACCOUNT ROLE                      │    │
│   │  [Role Selector ▼]                 │    │
│   │  ℹ Role description caption        │    │
│   │  ─────────────────────────         │    │
│   │  SET PASSWORD                      │    │
│   │  [Password]  [Confirm Password]    │    │
│   │  📌 Requirements caption           │    │
│   │                                    │    │
│   │  [Create Account → Button]         │    │
│   │                                    │    │
│   │  ← Back to Login                   │    │
│   └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Components
- 2-column grid for paired fields
- Section labels in CAPS with `accent-primary` color
- Horizontal dividers between sections
- Role description contextual help text
- Same card styling as Login

---

## Screen 3 — Dashboard

**Layout:** Wide layout, persistent sidebar

### Layout Structure
```
┌────────┬────────────────────────────────────────────┐
│        │  DASHBOARD                                  │
│        │  Welcome back, [Name]!                      │
│        │                                             │
│        │  [Date/Time Info Bar]                       │
│        │                                             │
│ SIDE   │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  BAR   │  │ KPI  │ │ KPI  │ │ KPI  │ │ KPI  │     │
│        │  │Card 1│ │Card 2│ │Card 3│ │Card 4│     │
│        │  └──────┘ └──────┘ └──────┘ └──────┘     │
│        │                                             │
│        │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│        │  │ KPI  │ │ KPI  │ │ KPI  │ │ KPI  │     │
│        │  │Card 5│ │Card 6│ │Card 7│ │Card 8│     │
│        │  └──────┘ └──────┘ └──────┘ └──────┘     │
│        │                                             │
│        │  ─── Procurement Overview ───               │
│        │  ┌─────────────────┐ ┌──────────────────┐  │
│        │  │  Line Chart     │ │  Donut Chart     │  │
│        │  │  Spend Trend    │ │  Vendor Status   │  │
│        │  └─────────────────┘ └──────────────────┘  │
│        │                                             │
│        │  ┌──────────────┐ ┌───────────────────┐    │
│        │  │  Bar Chart   │ │  Grouped Bar      │    │
│        │  │  PO Status   │ │  Delivery Perf.   │    │
│        │  └──────────────┘ └───────────────────┘    │
│        │                                             │
│        │  ┌────────────────────┐ ┌───────────────┐  │
│        │  │  Recent Activity   │ │  Quick Stats  │  │
│        │  │  (Feed)            │ │  (List)       │  │
│        │  └────────────────────┘ └───────────────┘  │
└────────┴────────────────────────────────────────────┘
```

### KPI Card Design
- Size: ~200px wide × 110px tall
- Left border: 4px accent color
- Icon: 2rem, right-aligned, 70% opacity
- Value: 2rem, 800 weight, primary text
- Label: 0.75rem, UPPERCASE, muted
- Delta: 0.75rem, success/danger colored

---

## Screen 4 — Vendor Management

**Layout:** Wide layout with sidebar

### Tabs
1. 📋 All Vendors — filterable table
2. ⏳ Pending Approval — expandable review cards
3. ➕ Register Vendor — form (role-gated)

### Vendor Table Columns
`Vendor Code | Company Name | Category | Status | Approval | Rating`

### Status Badge Colors
- Active: `#22c55e` background 20% opacity, full color text
- Pending: `#f59e0b` 
- Suspended: `#ef4444`

---

## Screen 5 — Procurement Dashboard

**Layout:** Wide layout with sidebar

### Components
- 4 KPI cards (Total, Under Review, Approved, Rejected)
- Tabs: All Requests / New Request
- Status filter dropdown + "My requests" checkbox
- Tabular request list

---

## Screen 6 — Purchase Orders

**Layout:** Wide layout with sidebar

### Components
- 4 KPI cards (Total, Active, Delivered, Draft)
- Tabs: All Orders / Create PO
- Vendor filter dropdown + status filter
- PO list table

---

## Screen 7 — Vendor Performance Dashboard

### Components
- 4 KPI cards (Avg Rating, On-time %, Quality Score, High-Risk)
- Performance scorecard table with star ratings and risk badges
- 2-column chart row: Delivery bar chart + Radar chart

---

## Screen 8 — Analytics Dashboard

### Components
- 4 KPI cards (YTD Spend, Total Orders, Avg PO Value, Cost Savings)
- Full-width 12-month spend trend line chart
- 2-column: PO volume line chart + Delivery performance bar
- 2-column: Category pie chart + Vendor status donut

---

## Screen 9 — Reports Dashboard

### Components
- Type filter dropdown
- 2-column card grid (6 report cards)
- Each card: Icon + Title + Milestone tag + Description + Format badges + Disabled generate button

---

## Screen 10 — Notifications Center

### Components
- Unread count header
- "Unread only" filter checkbox
- "Mark all read" button
- Notification list: type-colored left border, icon, title, time, message
- Unread indicator: purple dot
- "Mark read" action per notification

---

## Sidebar Component

```
┌────────────────────┐
│  ◈ VendorIQ       │
│  Reliability Intl │
├────────────────────┤
│  [Avatar] Name    │
│           Role    │
├────────────────────┤
│  NAVIGATION        │
│  🏠 Dashboard     │  ← Active: gradient pill
│  👥 Vendors       │
│  📦 Procurement   │
│  📋 Purchase Ord. │
│  📊 Performance   │
│  📈 Analytics     │
│  📄 Reports       │
│  🔔 Notif. 🔴 3  │  ← Unread count badge
│  👤 Profile       │
├────────────────────┤
│  🚪 Logout        │
└────────────────────┘
  v1.0.0 · M1
```

### Active State
- Background: gradient `linear-gradient(135deg, #6366f120, #8b5cf620)`
- Left border: 3px `#6366f1`
- Text: `#c7d2fe`

### Hover State
- Background: `rgba(99,102,241,0.08)`
- Text: `#a5b4fc`
