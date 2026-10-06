# Dashboard Layout Architecture

## 1. Overview
The platform dashboard (`/dashboard`) serves as the operational launchpad for all user roles. It combines high-level KPI cards, interactive module shortcuts, role-aware status banners, and visual analytical widgets.

---

## 2. Layout Grid Hierarchy

```
+----------------------------------------------------------------------------------+
| HEADER BAR: Logo | Portal Title | Search | Role Badge | User Profile | Logout   |
+----------------------------------------------------------------------------------+
| BREADCRUMB / HERO BANNER: Welcome Back, [User Name] ([Role])                      |
+----------------------------------------------------------------------------------+
| TOP METRIC CARDS (3-4 Columns on Desktop, 1 Column on Mobile)                   |
|  +--------------------+  +--------------------+  +----------------------------+  |
|  | TOTAL VENDORS      |  | ACTIVE POs         |  | PENDING APPROVALS          |  |
|  | 142 Active Vendors |  | 28 Active Orders   |  | 5 Pending Requisitions     |  |
|  +--------------------+  +--------------------+  +----------------------------+  |
+----------------------------------------------------------------------------------+
| MAIN CONTENT GRID (8 Col / 4 Col split on Large Desktop)                         |
|  +---------------------------------------+  +----------------------------------+ |
|  | VENDOR PERFORMANCE SUMMARY            |  | RECENT PURCHASE ORDERS           | |
|  | (Placeholder Chart / Reliability Rate)|  | (Placeholder Table / Status)     | |
|  +---------------------------------------+  +----------------------------------+ |
+----------------------------------------------------------------------------------+
| QUICK NAVIGATION ACCESS CARDS                                                    |
|  [ Vendor Directory ]  [ Create PO ]  [ View Analytics ]  [ Risk Reports ]      |
+----------------------------------------------------------------------------------+
```

---

## 3. Responsive Breakpoints

* **Desktop (X-Large >= 1200px):** 3-column KPI card row; 2-column side-by-side widget area.
* **Tablet (Medium 768px - 1199px):** 2-column KPI card row; stacked widget area; collapsing sidebar navigation drawer.
* **Mobile (Small < 768px):** Single-column stacked KPI cards; scrollable widgets; hamburger navigation overlay.
