# VendorIQ Platform — Role-Based User Manual & Operating Guide

Welcome to the **Vendor Reliability Intelligence Platform (VendorIQ)**. This guide outlines the dedicated workspace, capabilities, and daily operational workflows for each of the six enterprise roles.

---

## 1. Quick Access Credentials (Demo Environment)

| Role | Login Email | Password | Dedicated Dashboard URL | Primary Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | `admin@vendor-iq.com` | `admin123` | `/dashboard/admin` | User management, vendor approvals, platform health & security |
| **Procurement Manager** | `procurement@vendor-iq.com` | `procure123` | `/dashboard/procurement` | Requisitions, PO issuance, vendor matrix, re-sourcing resolution |
| **Supply Chain Manager**| `supplychain@vendor-iq.com` | `supply123` | `/dashboard/supply-chain` | Freight tracking, buffer stock monitoring, preventive mitigation |
| **Vendor (Supplier)** | `vendor@vendor-iq.com` | `vendor123` | `/dashboard/vendor` | Order fulfillment, delivery confirmation, invoice generation |
| **Finance Officer** | `finance@vendor-iq.com` | `finance123` | `/dashboard/finance` | 3-way matching, invoice authorization, payment disbursements |
| **Auditor** | `auditor@vendor-iq.com` | `audit123` | `/dashboard/auditor` | Immutable audit ledger, SLA compliance, risk diligence, dossier export |

---

## 2. Role Operating Guides

### 2.1 Administrator (`/dashboard/admin`)

#### Purpose
The Administrator manages platform governance, user access controls (RBAC), supplier on-boarding approvals, and system telemetry.

#### Core Workflows
1. **User Directory & RBAC Management**:
   - Filter users by role or search by name/email.
   - Change a user's assigned role using the role dropdown.
   - Toggle user status (**Activate / Deactivate**) to instantly grant or revoke platform access.
2. **Vendor Registration Approval Queue**:
   - Review pending vendor on-boarding submissions.
   - Click **Approve** to authorize the supplier into the Master Directory.
   - Click **Reject** to decline an application with recorded audit reasoning.
3. **System Telemetry & Platform Health**:
   - Monitor platform uptime ($99.98\%$), average API latency, database transaction volumes, and compliance rates.
   - Click **Flush Cache** to clear client and runtime caches for testing fresh configurations.

---

### 2.2 Procurement Manager (`/dashboard/procurement`)

#### Purpose
The Procurement Manager manages purchasing requisitions, evaluates suppliers using the decision support matrix, and addresses supply chain disruption alerts.

#### Core Workflows
1. **Purchase Requisitions Queue**:
   - Review incoming purchase requisitions from enterprise departments.
   - Click **Approve** or **Reject** on pending requisitions.
   - For approved requests, click **Convert to PO** to generate a formal Purchase Order with auto-populated terms.
2. **Vendor Decision Support Matrix**:
   - Filter suppliers by category (e.g., *Raw Materials*, *Equipment*, *IT*).
   - Evaluate suppliers against performance indicators: Delivery Reliability (%), Quality Rating (out of 5.0), and recommendation tags (*Highly Recommended*, *Qualified*, *Caution*).
   - Click **Procure** on any supplier to open a pre-filled Requisition Modal and issue an order directly.
3. **Supply Disruption Rapid Re-sourcing**:
   - Receive high/critical disruption alerts dispatched by the Supply Chain Manager.
   - Click **Re-source** to filter the vendor matrix for qualified alternative suppliers in that exact product category.
   - Assign the replacement supplier to automatically close the disruption ticket.
4. **Direct Purchase Order Dispatch**:
   - Click **Issue Purchase Order** in the header to configure a direct PO with custom quantities, pricing, and shipping destination.

---

### 2.3 Supply Chain Manager (`/dashboard/supply-chain`)

#### Purpose
The Supply Chain Manager tracks real-time inbound material shipments, monitors logistics carrier delays, implements preventive mitigations, and escalates stockout risks.

#### Core Workflows
1. **Freight & Inbound Shipment Tracking**:
   - Monitor live freight status: `On Schedule`, `In Transit`, `Delayed`, or `Critical Delay`.
   - Inspect buffer inventory health: `Adequate Stock`, `Buffer Low`, or `Stockout Risk`.
2. **Preventive Action Mitigation**:
   - When a shipment is delayed, click **Mitigate** to open the preventive strategy drawer.
   - Select an intervention:
     - **Expedite Express Freight** (Priority Air / Hotshot transport)
     - **Allocate Buffer Stock** (Reserve auxiliary inventory)
     - **Quality Inspection Quarantine** (Pre-line component check)
     - **Formal Supplier SLA Warning** (Contract breach notice)
   - Submit the mitigation note to log it in the immutable audit trail.
3. **Inter-Department Re-sourcing Escalation**:
   - When delays threaten production stoppage, click **Re-source** or **Transmit Re-sourcing Alert**.
   - Specify the delayed vendor, affected SKU, and recommended alternative criteria.
   - Dispatches an urgent alert to the Procurement Manager's dashboard.

---

### 2.4 Vendor Partner Portal (`/dashboard/vendor`)

#### Purpose
An external supplier workspace for vendors to manage purchase orders received from clients, track deliveries, submit invoices, and view contract SLAs.

#### Core Workflows
1. **Order Acceptance & Fulfillment**:
   - Review newly issued Purchase Orders.
   - Click **Accept** to acknowledge receipt and commit to delivery deadlines.
   - Click **Reject** to decline an order with a reason (e.g., temporary plant shutdown).
2. **Delivery Confirmation & Shipment Proof**:
   - Once items are dispatched, click **Confirm Delivery**.
   - Input the carrier name (e.g., DHL Express), tracking waybill number, and delivery notes.
   - Updates the client's procurement and supply chain systems immediately.
3. **Invoice Submission**:
   - For any fulfilled or delivered order, click **Bill Invoice** or **Submit New Invoice**.
   - Enter claim amount, payment due date (Net 30/60), and banking details.
   - Transmits invoice directly to the client's Finance Officer for 3-way matching and payout.
4. **Performance Scorecard & Master Contracts**:
   - Review verified reliability metrics: On-Time Delivery (%), Quality Rating, and Supplier Tier.
   - Check active contract expiration dates and renewal terms.

---

### 2.5 Finance Officer (`/dashboard/finance`)

#### Purpose
The Finance Officer governs procurement expenditures, validates supplier invoices via 3-way matching, and disburses corporate payments.

#### Core Workflows
1. **3-Way Matching Queue**:
   - Automatically cross-references three critical data points for every invoice:
     1. **Purchase Order Value**: Authorized order amount.
     2. **Physical Delivery Status**: Verified delivery confirmation from warehouse.
     3. **Invoiced Amount**: Vendor commercial claim.
   - Displays real-time audit badges: `3-Way Matched`, `Pending Delivery`, or `Price Variance!`.
2. **Invoice Authorization**:
   - Click **Approve** on matched invoices to authorize them for disbursement.
   - Click **Reject / Dispute** to flag irregularities back to the supplier.
3. **Payment Disbursement**:
   - For approved invoices, click **Disburse**.
   - Select the payment method: **Electronic Funds Transfer (EFT / ACH)**, **Fedwire / SWIFT**, or **Corporate Check**.
   - Input the treasury transaction reference to mark the invoice `Paid`.
4. **Spend & Ledger Export**:
   - Click **Export Ledger (.XLS)** or **Spend Audit (.PDF)** for executive financial reporting.

---

### 2.6 Auditor (`/dashboard/auditor`)

#### Purpose
The Auditor conducts independent compliance audits, monitors SLA contract adherence, evaluates high-risk suppliers, and exports official compliance dossiers.

#### Core Workflows
1. **Immutable Audit Trail Investigation**:
   - Search platform activity by keyword (user email, order number, action).
   - Filter transactions by category: `USER`, `PO`, `PROCURE`, `INVOICE`, `CONTRACT`, `VENDOR`.
   - Inspect chronological timestamps, actor identities, and full JSON payload details.
2. **High-Risk Supplier Due Diligence**:
   - Real-time audit list of suppliers with delivery rates $< 80\%$ or high risk flags.
   - Trace chronic failure causes and evaluate SLA breach penalties.
3. **Contract & SLA Compliance Inspection**:
   - Monitor active contract compliance rates ($96.5\%$).
   - Identify expired contracts or contracts within 60 days of expiration.
4. **Official Audit Dossier Generation**:
   - Click **Download Audit Dossier (.PDF)** or **Export Ledger (.XLS)** to produce ISO-9001 and SOC 2 ready audit packages.
