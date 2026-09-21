# ProcuraHub Enterprise User Manual
## Platform User Guide & Role-Based Workflows

ProcuraHub is an enterprise vendor reliability intelligence, procurement risk management, and purchase order governance platform.

---

## 1. Accessing ProcuraHub

Open your web browser and navigate to:
**`http://127.0.0.1:5500`**

### Demo 1-Click Login
On the login screen, click any of the 6 quick-access role buttons to pre-fill credentials:
- **Admin**: Full governance, audit oversight, user administration.
- **Procurement**: Requisitions, purchase order creation, approvals.
- **Supply Chain**: Delivery telemetry, supplier risk scoring, delay analytics.
- **Vendor**: Scoped purchase orders, delivery status dispatch, messaging.
- **Finance**: Invoice reconciliation, payment processing.
- **Auditor**: Immutable audit trail, compliance verification.

---

## 2. Role Landing & Dedicated Views

Upon authentication, ProcuraHub automatically routes each user to their designated workspace:

```
+---------------------+-------------------------------+------------------------------------------+
| User Role           | Default Landing Section       | Core Action Capabilities                 |
+---------------------+-------------------------------+------------------------------------------+
| Administrator       | Overview Dashboard            | System KPIs, user admin, audit log       |
| Procurement Manager | Procurement & Orders          | Create PR/PO, calculate tax, approve PO  |
| Supply Chain Mgr    | Reliability & Risk            | Telemetry charts, risk leaderboard       |
| Vendor Rep          | Vendor Portal (Performance)   | Acknowledge PO, inspect items, dispatch  |
| Finance Officer     | Invoices & Payments           | Review billings, reconcile, mark paid    |
| Auditor             | Audit Trail & RBAC            | Review immutable logs, contract matrix   |
+---------------------+-------------------------------+------------------------------------------+
```

---

## 3. End-to-End Procurement Lifecycle Walkthrough

### Step 1: Requisition Creation (Procurement / Admin)
1. Navigate to **Procurement & Orders** -> **Requisitions (PR)**.
2. Click **+ Submit New Requisition**.
3. Fill in Department, Description, Quantity, and Required Date.
4. Click **Submit Requisition**.

### Step 2: Purchase Order Creation & Dynamic Line Items
1. Click **+ Create Purchase Order**.
2. Select the **Assigned Vendor** and link the **Requisition**.
3. Add line items in the dynamic table (Description, Quantity, Unit Price, Tax %).
4. The system automatically calculates **Subtotal**, **Tax**, and **Grand Total**.
5. Click **Create & Submit PO** (or **Save as Draft**).

### Step 3: PO Approval & Dispatch
1. In the **Purchase Orders** list, locate the pending PO.
2. Click **Approve**. The order status updates to `Approved` and triggers an automated notification.
3. Click **Mark Ordered** to dispatch the order to the vendor.

### Step 4: PO Inspection & Vendor Delivery (Vendor View)
1. Switch role to **Vendor** (`vendor@example.com`).
2. The PO list displays only orders assigned to TechNova.
3. Click **Inspect** to view full order line items, shipping address, and tax breakdown in the **PO Inspector Modal**.
4. Click **Dispatch / Deliver** to mark the shipment as `Delivered`.

### Step 5: Invoicing & Payment Settlement (Finance View)
1. Switch role to **Finance Officer** (`finance@example.com`).
2. Navigate to **Invoices & Payments**.
3. Click **+ Create Invoice from PO**, select the delivered PO.
4. Review amount reconciliation and click **Create Invoice**.
5. Once payment is processed, click **Mark Paid**.

### Step 6: Completion & Immutable Audit Trail (Auditor View)
1. Procurement Manager clicks **Complete PO**.
2. Switch role to **Auditor** (`auditor@example.com`).
3. Navigate to **Audit Trail & RBAC Matrix**.
4. Verify that every single action (PR Creation, PO Creation, Approval, Delivery, Invoicing, Payment, Completion) is permanently recorded with timestamp, user identity, and entity ID.

---

## 4. Generating & Exporting Reports

Navigate to **Operational Reports** to export live datasets:
- **Available Reports**: Vendor Performance, Suppliers, Procurement, Purchase Orders, Compliance, Contracts, Invoices, Audit Logs.
- **Export Formats**:
  - **CSV**: Spreadsheet-ready UTF-8 BOM CSV.
  - **Excel (.xlsx)**: Professional multi-column formatted workbook.
  - **PDF**: Print-ready landscape PDF document with corporate headers.
