# UI Wireframes & Layout Specifications

This document outlines the visual structure, wireframes, and component layouts for all 10 core screens of the Vendor Reliability Intelligence Platform.

---

## 1. Authentication Screens

### 1.1 Login Screen (`/login`)
```
+-----------------------------------------------------------------------+
|                                                                       |
|                     [ VENDOR RELIABILITY PLATFORM ]                   |
|                   Sign in to access your dashboard                    |
|                                                                       |
|     +-----------------------------------------------------------+     |
|     | Email Address                                             |     |
|     | [ user@example.com                                      ] |     |
|     +-----------------------------------------------------------+     |
|                                                                       |
|     +-----------------------------------------------------------+     |
|     | Password                                                  |     |
|     | [ *********                                            ]  |     |
|     +-----------------------------------------------------------+     |
|                                                                       |
|     [  LOGIN  ]   (Forgot Password?)                                  |
|                                                                       |
|     Don't have an account? [ Register Now ]                          |
|                                                                       |
+-----------------------------------------------------------------------+
```

### 1.2 Registration Screen (`/register`)
```
+-----------------------------------------------------------------------+
|                                                                       |
|                     [ VENDOR RELIABILITY PLATFORM ]                   |
|                    Create a new enterprise account                    |
|                                                                       |
|     Full Name:          [ John Doe                             ]      |
|     Email Address:      [ john.doe@company.com                 ]      |
|     Password:           [ *********                            ]      |
|     Confirm Password:   [ *********                            ]      |
|     Select Role:        [ PROCUREMENT_MANAGER  v               ]      |
|                                                                       |
|     [ REGISTER ACCOUNT ]           [ Back to Login ]                  |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

## 2. Main Portal Layout (Shell)

```
+-----------------------------------------------------------------------------------+
| [=] VENDOR RELIABILITY INTEL | Dashboard  Vendors  POs ... | [Role: MANAGER] [Logout]|
+--------------+--------------------------------------------------------------------+
|  NAVIGATION  |  PAGE CONTENT AREA                                                 |
|              |                                                                    |
|  - Dashboard |  +--------------------+  +--------------------+  +-----------------+ |
|  - Vendors   |  | Total Vendors      |  | Active POs         |  | Pending Orders  | |
|  - Operations|  | 142 Active         |  | 28 In-Flight       |  | 5 Approvals     | |
|  - POs       |  +--------------------+  +--------------------+  +-----------------+ |
|  - Perform.  |                                                                    |
|  - Analytics |  +-----------------------------------+ +-------------------------+ |
|  - Reports   |  | Vendor Reliability Performance    | | Recent Purchase Orders  | |
|  - Alerts    |  | [ Chart Placeholder Widget ]      | | [ Table Placeholder ]  | |
|              |  +-----------------------------------+ +-------------------------+ |
+--------------+--------------------------------------------------------------------+
```

---

## 3. Screen Inventory (10 Core Modules)

1. **Login (`/login`)**: Secure credential authentication.
2. **Registration (`/register`)**: Account creation with role selection.
3. **Dashboard (`/dashboard`)**: Summary cards, performance preview, recent PO preview.
4. **Vendor Management (`/vendors`)**: Directory, compliance status, onboarding (Placeholder).
5. **Procurement Dashboard (`/procurement`)**: Requisitions, sourcing requests (Placeholder).
6. **Purchase Orders (`/purchase-orders`)**: PO lifecycle, line items, status (Placeholder).
7. **Vendor Performance (`/performance`)**: SLA metrics, delivery rates, quality scores (Placeholder).
8. **Analytics (`/analytics`)**: Risk trend models, predictive delays (Placeholder).
9. **Reports (`/reports`)**: Compliance audit trail, export options (Placeholder).
10. **Notifications (`/notifications`)**: Real-time alerts, risk flag notifications (Placeholder).
