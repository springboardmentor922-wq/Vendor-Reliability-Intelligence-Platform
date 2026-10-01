# Developer Setup Guide

This document walks a **new developer** through every step needed to run the Procurement & Vendor Reliability Platform locally — both the traditional manual way and via Docker Compose.

---

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Git | any | To clone the repo |
| Python | 3.11+ | Backend runtime |
| Node.js | 20 LTS+ | Angular CLI and frontend build |
| npm | 9+ | Comes with Node.js |
| PostgreSQL | 15+ | Database (manual setup only) |
| Redis | 7+ | Token store (manual setup only; optional — app falls back to in-memory) |
| Docker | 24+ | Docker Compose setup only |
| Docker Compose | 2.x (`compose` plugin) | Docker Compose setup only |

---

## Option A — Manual Local Setup

### 1. Clone the repository

```bash
git clone <repo-url> vendor-reliability-platform
cd vendor-reliability-platform
```

### 2. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Configure environment variables (backend)

```bash
# Copy the example file
cp .env.example .env   # (or copy manually on Windows)
```

Open `backend/.env` and fill in your local values:

```dotenv
DATABASE_URL=postgresql+asyncpg://YOUR_PG_USER:YOUR_PG_PASSWORD@localhost:5432/procurement_db
SYNC_DATABASE_URL=postgresql://YOUR_PG_USER:YOUR_PG_PASSWORD@localhost:5432/procurement_db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-long-random-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
```

> **Note:** If Redis is not running locally, the backend falls back to an in-memory token store automatically — all features still work.

### 4. Create the PostgreSQL database

```sql
-- Run in psql or pgAdmin
CREATE DATABASE procurement_db;
```

### 5. Run database migrations

```bash
# Still inside backend/, with venv activated
alembic upgrade head
```

This applies all 6 migration files (0001 → 0006) and seeds the default admin user `admin@example.com / Admin@123456` on first startup.

### 6. Start the backend server

```bash
uvicorn app.main:app --reload
```

Backend is now running at **http://localhost:8000**  
Swagger UI: **http://localhost:8000/docs**

### 7. Frontend setup

Open a **second terminal**:

```bash
cd frontend

# Install Node dependencies
npm install

# Start the Angular dev server
npm start
```

Frontend is now running at **http://localhost:4200**

### 8. Default credentials

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `Admin@123456` | Administrator |

---

## Option B — Docker Compose (recommended for quick start)

### 1. Clone the repository

```bash
git clone <repo-url> vendor-reliability-platform
cd vendor-reliability-platform
```

### 2. Configure environment variables

```bash
# Copy the root-level example file
cp .env.example .env
```

Open `.env` and set at minimum:

```dotenv
POSTGRES_PASSWORD=your_strong_db_password
SECRET_KEY=your-long-random-secret-key-change-in-production
```

All other values have working defaults — see `.env.example` for the full list.

### 3. Build and start the full stack

```bash
docker compose up --build
```

This single command:
1. Builds the backend image (Python 3.12, installs requirements, runs `alembic upgrade head`)
2. Builds the frontend image (Node 22, `ng build`, served by nginx)
3. Starts PostgreSQL 16 + Redis 7
4. Starts the backend (waits for Postgres + Redis health checks to pass)
5. Starts the frontend nginx server

### 4. Access the application

| Service | URL |
|---|---|
| Frontend | http://localhost |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |

### 5. Stopping the stack

```bash
# Stop (preserves data volumes)
docker compose down

# Stop and remove all data volumes (full reset)
docker compose down -v
```

### 6. Rebuilding after code changes

```bash
docker compose up --build
```

---

## Environment Variable Reference

| Variable | Default (Docker) | Description |
|---|---|---|
| `POSTGRES_USER` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | *(required)* | PostgreSQL password |
| `POSTGRES_DB` | `procurement_db` | Database name |
| `POSTGRES_PORT` | `5432` | Host port for PostgreSQL |
| `REDIS_PORT` | `6379` | Host port for Redis |
| `SECRET_KEY` | *(required)* | JWT signing secret — change in production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | JWT access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `CORS_ORIGINS` | `http://localhost,http://localhost:80` | Comma-separated allowed CORS origins |
| `BACKEND_PORT` | `8000` | Host port for the backend container |
| `FRONTEND_PORT` | `80` | Host port for the frontend nginx container |

---

## Project Structure Overview

```
vendor-reliability-platform/
├── backend/                  # FastAPI Python backend
│   ├── app/
│   │   ├── main.py           # App factory, lifespan, router registration
│   │   ├── config.py         # Pydantic settings (reads from .env)
│   │   ├── database.py       # SQLAlchemy engine, Redis manager
│   │   ├── models.py         # ORM models
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── security.py       # JWT, password hashing, auth dependencies
│   │   └── routers/          # One file per feature area
│   ├── alembic/              # Database migrations
│   ├── uploads/              # Uploaded files (POs, contracts, comms)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/                 # Angular 21 SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/         # Auth service, API service, route guard
│   │   │   ├── pages/        # Page-level components
│   │   │   └── components/   # Reusable UI components
│   │   └── environments/     # environment.ts (API base URL)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docs/
│   ├── API.md                # API endpoint group reference
│   └── SETUP.md              # This file
├── docker-compose.yml        # Full-stack Docker Compose definition
├── .env.example              # Docker environment variable template
└── README.md                 # Project overview
```

---

## Running Database Migrations Manually (Docker)

If you need to run Alembic commands inside the running backend container:

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend alembic history
docker compose exec backend alembic current
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Backend fails to start — `could not connect to server` | Ensure PostgreSQL is running and `DATABASE_URL` credentials are correct |
| `alembic upgrade head` fails | Check that the database exists and `SYNC_DATABASE_URL` is set correctly |
| Frontend blank screen | Open browser DevTools → Network tab; verify API calls reach `http://localhost:8000` |
| Port already in use | Change `BACKEND_PORT` / `FRONTEND_PORT` / `POSTGRES_PORT` in `.env` |
| Docker build fails on `npm ci` | Ensure `package-lock.json` is committed to the repo |

---

## Security Notes for Production Deployment

- Set `SECRET_KEY` to a cryptographically random value (e.g., `openssl rand -hex 32`).
- Set `POSTGRES_PASSWORD` to a strong, unique password.
- Restrict `CORS_ORIGINS` to your production domain only.
- Run behind HTTPS (e.g., a reverse proxy with Let's Encrypt).
- Do **not** commit `.env` to version control — it is in `.gitignore`.
