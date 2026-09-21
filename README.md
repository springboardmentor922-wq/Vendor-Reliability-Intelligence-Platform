# ProcuraHub ? Vendor Reliability Intelligence & Procurement Platform
### Enterprise Risk Scoring, PO Lifecycle Governance, and DataCo Supply Chain Analytics
### Comprehensive Implementation: Milestones 1, 2, 3, and 4

---

## ?? Overview

**ProcuraHub** is an enterprise-grade procurement and vendor reliability platform engineered to evaluate supply chain risks, streamline the purchase order lifecycle, automate invoice reconciliation, and maintain immutable compliance audit trails.

The platform integrates the real-world **DataCo Supply Chain dataset (180,519 records)** to power predictive reliability scoring and delivery risk classification.

---

## ?? Key Features by Milestone

### ?? Milestone 1: Authentication & Core Architecture
- **JWT OAuth2 Authentication** with Bcrypt password security.
- **MySQL 8.0 / SQLAlchemy ORM** integration with 180k+ real supply chain records.
- **Core CRUD**: Vendors directory, Procurement Requests, Purchase Orders.
- **Event Notifications**: Automated alerts on vendor status and PO approvals.

### ?? Milestone 2: Role-Based Access Control & PO Workflows
- **6 Discrete RBAC Roles**: Administrator, Procurement Manager, Supply Chain Manager, Vendor, Finance Officer, Auditor.
- **Purchase Order Engine**: Dynamic multi-line items, auto-tax calculation (18%), shipping/billing addresses, payment terms.
- **Status Lifecycle State Machine**: `Draft` $\rightarrow$ `Pending` $\rightarrow$ `Approved` $\rightarrow$ `Ordered` $\rightarrow$ `Delivered` $\rightarrow$ `Completed`.
- **Role-Scoped Access**: Strict data isolation ensuring vendors only see their assigned orders.

### ?? Milestone 3: Advanced Analytics, Finance & Governance
- **Multi-Factor Reliability Scoring**: Six weighted dimensions (Delivery history 30%, Quality 20%, Purchase history 15%, Issue resolution 15%, Communication 10%, Contract compliance 10%).
- **Finance & Invoicing**: PO-linked invoices, tax reconciliation, payment settlement tracking.
- **Communications Hub**: Real-time internal and vendor-facing messaging threads.
- **Multi-Format Reports**: Live live export to **CSV** (UTF-8 BOM), **Excel** (`.xlsx`), and formatted **PDF**.
- **Immutable Audit Trail**: Append-only activity logging for compliance auditors.

### ?? Milestone 4: Testing, Integration, Benchmarking & Deployment
- **Modern Dark UI Theme**: High-contrast ProcuraHub dark theme with role landing redirection and PO Inspector modal.
- **Performance Optimizations**: 60s TTL memory caching layer achieving sub-50ms latency across 180k dataset rows.
- **Automated Verification**: 5 test suites covering regression, E2E 6-role workflows, and SLA benchmarks (**99/99 tests passing**).
- **Production Containerization**: Multi-stage Dockerfiles and `docker-compose.yml` for 1-click cloud/local deployment.
- **Complete Documentation Suite**: Full OpenAPI reference, deployment guide, user manual, and performance report in `docs/`.

---

## ??? Quick Start

### Native Local Start (Windows)
Double-click `start_ms4.bat` or run:
```powershell
# Start Backend
cd backend
.\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload

# Start Frontend
cd ..\frontend
python -m http.server 5500
```
Open **`http://127.0.0.1:5500`** in your browser.

### Docker Compose Start
```bash
docker-compose up -d --build
```

---

## ?? Demo User Credentials

| Role | Email | Password | Landing Page |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@example.com` | `admin123` | Overview Dashboard |
| **Procurement Manager** | `procurement@example.com` | `admin123` | Procurement & Orders |
| **Supply Chain Manager**| `scm@example.com` | `admin123` | Reliability & Risk |
| **Vendor Representative**| `vendor@example.com` | `admin123` | Vendor Portal |
| **Finance Officer** | `finance@example.com` | `admin123` | Invoices & Payments |
| **Auditor** | `auditor@example.com` | `admin123` | Audit Trail & RBAC |

---

## ?? Running Automated Tests

```bash
cd backend
node _regression_ms12.mjs            # 16 tests
node _e2e_ms3.mjs                    # 19 tests
node _test_ms3_comprehensive.mjs     # 23 tests
node _e2e_full_workflow.mjs          # 19 tests
node _ms4_benchmarks.mjs             # 22 tests
# Total: 99/99 Passing Tests
```

---

## ?? Documentation Index

- [API Reference & Technical Specification](docs/api_documentation.md)
- [Deployment & Infrastructure Guide](docs/deployment_guide.md)
- [Enterprise User Manual](docs/user_manual.md)
- [Performance Benchmark & SLA Report](docs/performance_benchmark_report.md)
