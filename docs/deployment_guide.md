# ProcuraHub Deployment & Infrastructure Guide
## Milestone 4 Enterprise Deployment Architecture

This document provides step-by-step instructions for deploying ProcuraHub across bare-metal, virtualized, and containerized Docker environments.

---

## 1. System Requirements & Architecture

### Prerequisites
- **Operating System**: Linux (Ubuntu 20.04+/Debian 11+), macOS 12+, or Windows 10/11 / Server 2022
- **Python**: Python 3.11+
- **Node.js**: Node.js 18+ (for automated verification & test runners)
- **Database Engine**: MySQL 8.0+ or MariaDB 10.6+
- **Containerization**: Docker Engine 24.0+ and Docker Compose v2+

### Architectural Port Allocations
- **Port 8001**: FastAPI Backend REST API
- **Port 5500**: ProcuraHub Web Application (HTTP Server / Nginx)
- **Port 3306**: MySQL Database Server

---

## 2. Option A: Docker Compose Deployment (Recommended)

Docker Compose orchestrates the full 3-tier stack:
1. `procurahub-mysql`: MySQL 8.0 with persistent storage.
2. `procurahub-backend`: Multi-stage Python 3.11 container running 4 Uvicorn workers.
3. `procurahub-frontend`: High-performance Nginx Alpine container serving static assets with gzip compression and API reverse proxying.

### Step 1: Clone Repository & Configure Environment
```bash
git clone https://github.com/your-org/Vendor-reliability-platform.git
cd Vendor-reliability-platform
```

### Step 2: Build & Start Services
```bash
docker-compose up -d --build
```

### Step 3: Verify Container Health
```bash
docker-compose ps
```
Both `procurahub-backend` and `procurahub-mysql` include automated Docker healthchecks that probe `/dashboard/summary` and `mysqladmin ping`.

---

## 3. Option B: Local Native Deployment (Windows / Linux)

### Step 1: Database Initialization
1. Ensure MySQL is running on `127.0.0.1:3306`.
2. Create the target database:
```sql
CREATE DATABASE IF NOT EXISTS vendor_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 2: Backend Setup
```powershell
cd C:\Vendor-reliability-platform\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python seed_data.py
```

### Step 3: Launch FastAPI Server
```powershell
cd C:\Vendor-reliability-platform\backend
.\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

### Step 4: Launch Frontend UI
```powershell
cd C:\Vendor-reliability-platform\frontend
python -m http.server 5500
```

### Step 5: 1-Click Startup Script (Windows)
Run `start_ms4.bat` from the project root to launch both backend and frontend servers simultaneously in separate process shells.

---

## 4. Database Migrations & Seeding

The database auto-initializes all tables on FastAPI startup via SQLAlchemy ORM `Base.metadata.create_all(bind=engine)`.
To re-seed sample users, contracts, POs, and invoices:
```powershell
cd backend
python seed_data.py
```

### Seeded Role Accounts:
| Role | Email | Default Password |
| :--- | :--- | :--- |
| Administrator | `admin@example.com` | `admin123` |
| Procurement Manager | `procurement@example.com` | `admin123` |
| Supply Chain Manager | `scm@example.com` | `admin123` |
| Vendor Representative | `vendor@example.com` | `admin123` |
| Finance Officer | `finance@example.com` | `admin123` |
| Auditor | `auditor@example.com` | `admin123` |

---

## 5. Automated Verification & Continuous Integration

Run the comprehensive 99-test verification suite to validate the entire platform:
```powershell
cd backend
node _regression_ms12.mjs
node _e2e_ms3.mjs
node _test_ms3_comprehensive.mjs
node _e2e_full_workflow.mjs
node _ms4_benchmarks.mjs
```
