# Vendor Reliability Intelligence Platform (VendorIQ)

![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?logo=tailwind-css&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## Overview

**Vendor Reliability Intelligence Platform (VendorIQ)** is an enterprise-oriented vendor management and supply chain governance platform designed to help procurement teams monitor supplier reliability, assess operational risks, manage purchase orders, and support data-driven procurement decisions.

The platform combines vendor performance analytics, reliability scoring, purchase order lifecycle management, role-based access control, compliance monitoring, reporting, and notification workflows into a centralized procurement environment.

VendorIQ is designed for multiple stakeholders across the procurement lifecycle, including administrators, procurement managers, supply chain directors, finance controllers, compliance auditors, and vendors.

---

## Key Capabilities

- **Vendor Reliability Scoring**  
  Calculates composite vendor reliability scores on a 0–100 scale using weighted operational performance factors.

- **Risk Classification**  
  Classifies vendors into Low, Medium, High, and Critical risk categories based on reliability metrics.

- **Purchase Order Lifecycle Management**  
  Supports purchase order creation, vendor review, acceptance, approval, dispatch, transit, delivery, and completion workflows.

- **Governed Vendor Onboarding**  
  Provides administrator-controlled vendor registration, qualification, approval, and activation workflows.

- **Role-Based Access Control**  
  Provides role-specific dashboards and workflows for different procurement and supply chain stakeholders.

- **Procurement Analytics**  
  Provides insights into vendor performance, procurement spend, order volumes, risk distribution, and logistics status.

- **Reporting and Notifications**  
  Supports CSV exports, print-ready procurement documents, and automated email/SMS notification workflows.

---

## Core Features

### 1. Vendor Reliability Scoring

VendorIQ evaluates supplier performance across six operational dimensions:

| Factor | Weight | Description |
|---|---:|---|
| On-Time Delivery Rate | 30% | Measures delivery punctuality and delay frequency. |
| Quality and Defect Ratio | 25% | Evaluates product quality, defect rates, returns, and quality compliance. |
| Contract and SLA Adherence | 15% | Measures compliance with contractual obligations and service-level milestones. |
| Communication Responsiveness | 10% | Evaluates average vendor response turnaround time. |
| Issue Resolution Speed | 10% | Measures the time required to resolve supply-related issues and claims. |
| Historical Order Volume and Spend | 10% | Considers fulfillment consistency across historical procurement activity. |

The weighted factors contribute to an overall vendor reliability score ranging from **0 to 100**.

---

### 2. Purchase Order Lifecycle Management

VendorIQ provides an end-to-end purchase order workflow.

#### Purchase Order Creation

Procurement managers can create purchase orders containing:

- Multiple line items
- Product and quantity details
- Unit pricing
- Delivery dates
- Payment terms
- Assigned vendor information

Supported payment terms include:

- Net 15
- Net 30
- Net 60

New purchase orders initially enter a **Pending Vendor Acceptance** state.

#### Vendor Review and Confirmation

Assigned vendors can review purchase order details through the Vendor Portal and formally accept the order terms.

#### Automatic Approval

After vendor confirmation, the purchase order automatically transitions to the **Approved** state across the relevant dashboards.

#### Procurement Execution

Procurement managers can proceed with order execution and update the purchase order through operational states such as:

- Ordered
- In Transit
- Delivered
- Completed
- Cancelled

#### Delivery and Completion

The workflow supports milestone tracking for:

- Shipment and dispatch
- Delivery
- Receipt confirmation
- Quality verification
- Purchase order completion

---

## 3. Role-Based Access Control

VendorIQ provides dedicated workflows and dashboards for six operational roles.

### Administrator

Responsible for system-level governance and configuration.

Capabilities include:

- Vendor registration approval and rejection
- User and permission management
- System configuration
- Audit trail monitoring
- Vendor qualification
- Platform governance

### Procurement Manager

Responsible for procurement operations and purchase order management.

Capabilities include:

- Purchase order creation
- Vendor evaluation
- Requisition management
- Order acceptance
- Procurement spend monitoring
- Category-level analysis

### Supply Chain Director

Responsible for logistics and supply chain oversight.

Capabilities include:

- Shipment monitoring
- Transit delay analysis
- Carrier tracking
- Regional supply bottleneck analysis
- Logistics performance monitoring

Supported carrier examples include DHL, FedEx, and Maersk.

### Finance Controller

Responsible for procurement-related financial operations.

Capabilities include:

- Accounts payable monitoring
- Invoice verification
- Payment processing
- Disbursement tracking
- Committed procurement capital monitoring

### Compliance Auditor

Responsible for procurement compliance and audit activities.

Capabilities include:

- SLA breach monitoring
- Contract compliance analysis
- Contract expiration tracking
- ISO/ESG compliance monitoring
- Regulatory reporting support

### Vendor

Provides a self-service portal for suppliers.

Capabilities include:

- Reviewing assigned purchase orders
- Accepting purchase orders
- Updating shipment information
- Providing tracking details
- Submitting invoices
- Reviewing vendor reliability metrics

---

## 4. Analytics and Data Visualization

VendorIQ provides interactive visualizations to support procurement and supply chain decision-making.

### Purchase Order Lifecycle Distribution

Displays the distribution of active purchase orders across operational states such as Pending, Approved, In Transit, Delivered, and Cancelled.

### Spend and Order Volume Analysis

Provides a timeline-based view of procurement expenditure and purchase order volume.

### Vendor Performance Radar

Provides multi-dimensional comparisons across vendor performance attributes such as:

- Quality
- Delivery
- Compliance
- Pricing
- Responsiveness

### Vendor Risk Distribution

Displays the distribution of vendors across:

- Low Risk
- Medium Risk
- High Risk
- Critical Risk

### Carrier Transit Status

Provides visual monitoring of shipment and logistics progress across carriers and freight lanes.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend Framework | React 18 |
| Programming Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | Lucide React |
| Build Tool | Vite |
| Data Visualization | Recharts, SVG-based visualizations, Interactive Canvas Charts |
| Data Processing | Client-side CSV parsing and export utilities |
| State Management | React Context API |
| Data Formatting | Indian Rupee (INR) localization, ISO 8601 timestamps |
| Export | CSV and print-ready reports |

---

## Project Architecture

```text
Vendor-Reliability-Intelligence-Platform/
│
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── Authentication and role-switching components
│   │   │
│   │   ├── common/
│   │   │   └── Reusable UI components
│   │   │
│   │   ├── effects/
│   │   │   └── UI animation and visual effects
│   │   │
│   │   ├── landing/
│   │   │   └── Platform landing page
│   │   │
│   │   ├── layout/
│   │   │   └── Navigation, sidebar, and role-switching components
│   │   │
│   │   └── modules/
│   │       ├── admin/
│   │       │   └── Administrative and system management
│   │       │
│   │       ├── communication/
│   │       │   └── Vendor-procurement communication
│   │       │
│   │       ├── contracts/
│   │       │   └── Contract and SLA management
│   │       │
│   │       ├── dashboard/
│   │       │   ├── AdminDashboardView.tsx
│   │       │   ├── ProcurementDashboardView.tsx
│   │       │   ├── SupplyChainDashboardView.tsx
│   │       │   ├── FinanceDashboardView.tsx
│   │       │   ├── AuditorDashboardView.tsx
│   │       │   ├── VendorDashboardView.tsx
│   │       │   ├── VendorPOAcceptModal.tsx
│   │       │   └── VendorProfileModal.tsx
│   │       │
│   │       ├── dataset/
│   │       │   └── Dataset upload and batch re-scoring
│   │       │
│   │       ├── notifications/
│   │       │   └── Notification center and action alerts
│   │       │
│   │       ├── performance/
│   │       │   └── Vendor scorecards and benchmarking
│   │       │
│   │       ├── procurement/
│   │       │   └── Purchase order and requisition management
│   │       │
│   │       ├── reliability/
│   │       │   └── Reliability scoring and risk analysis
│   │       │
│   │       ├── reports/
│   │       │   └── Report generation and printable exports
│   │       │
│   │       └── vendors/
│   │           └── Vendor directory and onboarding
│   │
│   ├── context/
│   │   └── AppContext.tsx
│   │       └── Global application state and action dispatchers
│   │
│   ├── data/
│   │   └── mockData.ts
│   │       └── Application seed data
│   │
│   ├── types/
│   │   └── index.ts
│   │       └── TypeScript interfaces and domain models
│   │
│   └── utils/
│       ├── csvParser.ts
│       ├── currencyUtils.ts
│       ├── exportUtils.ts
│       ├── notificationDispatcher.ts
│       └── predictiveEngine.ts
│
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
