# Free-Tier Cloud Deployment Guide

This guide walks you step-by-step through deploying the **Vendor Reliability & Procurement Platform** entirely on free-tier cloud infrastructure:
- **Backend API**: [Render.com](https://render.com) (Free Web Service)
- **Database**: [Render.com](https://render.com) (Free Managed PostgreSQL)
- **Cache**: [Render.com](https://render.com) (Free Redis) or [Upstash](https://upstash.com) (Serverless Redis), with built-in in-memory fallback
- **Frontend SPA**: [Vercel](https://vercel.com) (or [Netlify](https://netlify.com))

---

## Architecture Overview

```
                               ┌────────────────────────────────┐
                               │   Vercel / Netlify (Free)      │
                               │   Angular 21 SPA               │
                               │   https://<frontend>.vercel.app│
                               └───────────────┬────────────────┘
                                               │
                                       HTTPS API Calls
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │   Render.com (Free Web Service)│
                               │   FastAPI + Uvicorn            │
                               │   https://<backend>.onrender.com
                               └───────────────┬────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
       ┌───────────────────────────────┐               ┌───────────────────────────────┐
       │   Render PostgreSQL (Free)    │               │   Render / Upstash Redis      │
       │   Internal connection string  │               │   (or In-Memory Fallback)     │
       └───────────────────────────────┘               └───────────────────────────────┘
```

---

## Step 1: Create Free PostgreSQL & Redis Instances on Render

### 1.1 Create Free PostgreSQL Database
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** in the top navigation bar and select **PostgreSQL**.
3. Configure the database details:
   - **Name**: `vendor-reliability-db`
   - **Database**: `procurement_db`
   - **User**: `postgres`
   - **Region**: Choose a region closest to you (e.g., `Oregon (US West)` or `Frankfurt (EU)`). *Note: Ensure your web service will be created in this same region.*
   - **PostgreSQL Version**: `16` (or latest available)
   - **Instance Type**: Select **Free**.
4. Click **Create Database**.
5. Once created (status changes to *Available*), scroll down to the **Connections** section:
   - **Internal Database URL**: Copy this string. It looks like:
     ```text
     postgres://postgres:mypassword@dpg-xxxxxxxx-a:5432/procurement_db
     ```
     > **Note on URL Dialect**: The application automatically normalizes `postgres://` or `postgresql://` into `postgresql+asyncpg://` at runtime. You do **not** need to manually alter the scheme when pasting into Render.
   - **External Database URL**: Save this if you plan to connect or run manual database inspection from your local machine.

---

### 1.2 Create Free Redis Instance (Optional)
The backend contains a built-in `FallbackInMemoryRedis` service. If Redis is omitted, the application functions normally without crashing. However, for distributed token blacklisting and rate-limiting across worker threads:
1. In the Render Dashboard, click **New +** and select **Redis**.
2. Configure:
   - **Name**: `vendor-reliability-redis`
   - **Region**: Same region as your PostgreSQL instance (e.g., `Oregon`).
   - **Plan**: Select **Free** (or Starter).
3. Click **Create Redis**.
4. Copy the **Internal Redis URL** (e.g., `redis://red-xxxxxxxx:6379`).

*(Alternative: You can create a permanent free Redis database on [Upstash.com](https://upstash.com) and copy the `rediss://...` REST/Redis URL).*

---

## Step 2: Deploy Backend to Render

You can deploy the backend using the Render Dashboard or Render Blueprints.

### Option A: Manual Web Service Setup (Recommended)
1. In the Render Dashboard, click **New +** and select **Web Service**.
2. Connect your Git repository (GitHub or GitLab).
3. Configure the service settings:
   - **Name**: `vendor-reliability-backend`
   - **Region**: Same region as your PostgreSQL instance (e.g., `Oregon`).
   - **Branch**: `main` (or your deployment branch).
   - **Root Directory**: `backend` *(Critical: tells Render to run inside the backend folder)*.
   - **Runtime**: `Python 3`.
   - **Build Command**:
     ```bash
     pip install -r requirements.txt && alembic upgrade head
     ```
     *(This installs dependencies and automatically runs all Alembic schema migrations on deployment).*
   - **Start Command**:
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Plan Type**: Select **Free**.

4. Scroll down to **Environment Variables** and add the following variables:

| Key | Value Source / Description | Example Value |
|---|---|---|
| `PORT` | Auto-provided by Render; add fallback | `10000` |
| `DATABASE_URL` | Render PostgreSQL **Internal Database URL** | `postgresql://postgres:pass@dpg-xxx-a:5432/procurement_db` |
| `SYNC_DATABASE_URL` | Same Internal Database URL (used by Alembic) | `postgresql://postgres:pass@dpg-xxx-a:5432/procurement_db` |
| `REDIS_URL` | Render Redis Internal URL (or leave blank for in-memory) | `redis://red-xxx:6379` |
| `SECRET_KEY` | Click **Generate** on Render, or type a 32+ char random string | `e4b3c9a17f8d4239...` |
| `ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifespan | `60` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifespan | `7` |
| `CORS_ORIGINS` | Allowed origins (temporary placeholder until frontend is deployed) | `http://localhost:4200` |

5. Click **Create Web Service**.
6. Monitor the deployment logs. When deployment completes, note your backend URL:
   ```text
   https://vendor-reliability-backend.onrender.com
   ```

### 2.1 Verify Backend Deployment
Open a web browser or use curl to check the endpoints:
- **Root Status**: `https://vendor-reliability-backend.onrender.com/`
- **Health Check**: `https://vendor-reliability-backend.onrender.com/health` (should return `{"status": "healthy", "database": "connected", ...}`)
- **Swagger Documentation**: `https://vendor-reliability-backend.onrender.com/docs`

> **Default Seed Admin Credentials**:
> The app lifespan startup automatically provisions the default administrator account:
> - **Email**: `admin@example.com`
> - **Password**: `Admin@123456`

---

## Step 3: Deploy Frontend to Vercel (or Netlify)

### 3.1 Point Frontend to your Deployed Render Backend
1. Open [`frontend/src/environments/environment.prod.ts`](file:///c:/Users/tejut/OneDrive/Desktop/vendor-reliability-platform/frontend/src/environments/environment.prod.ts).
2. Replace `'__REPLACE_WITH_RENDER_BACKEND_URL__'` with your actual Render backend URL (no trailing slash):
   ```typescript
   export const RENDER_BACKEND_URL = 'https://vendor-reliability-backend.onrender.com';
   ```
3. Commit and push the change to your Git repository:
   ```bash
   git add frontend/src/environments/environment.prod.ts
   git commit -m "chore: point production environment to deployed Render backend"
   git push origin main
   ```

---

### 3.2 Deploy to Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New...** -> **Project**.
2. Select your Git repository and click **Import**.
3. Under **Project Settings**:
   - **Root Directory**: Click **Edit** and select `frontend`.
   - **Framework Preset**: Vercel will detect `Angular` (or choose `Angular`).
   - **Build Command**: `ng build` (or leave default `npm run build`).
   - **Output Directory**: `dist/frontend/browser` *(configured automatically by `vercel.json`)*.
4. Click **Deploy**.
5. Once deployment completes, Vercel provides your live frontend URL:
   ```text
   https://vendor-reliability-platform.vercel.app
   ```

---

### Alternative: Deploy to Netlify
If you prefer Netlify:
1. Log in to [Netlify](https://app.netlify.com) and click **Add new site** -> **Import an existing project**.
2. Select your repository.
3. Configure the build settings:
   - **Base directory**: `frontend`
   - **Build command**: `ng build`
   - **Publish directory**: `dist/frontend/browser`
   *(Netlify will automatically detect [`frontend/netlify.toml`](file:///c:/Users/tejut/OneDrive/Desktop/vendor-reliability-platform/frontend/netlify.toml) which handles SPA routing redirects)*.
4. Click **Deploy site**.

---

## Step 4: Update Backend CORS_ORIGINS

Now that your frontend has a live public URL, allow it in the backend's CORS policy:
1. Go back to the **Render Dashboard**.
2. Open your backend Web Service (`vendor-reliability-backend`).
3. Click **Environment** on the left menu.
4. Locate `CORS_ORIGINS` and edit it to include your frontend domain:
   ```text
   https://vendor-reliability-platform.vercel.app,http://localhost:4200
   ```
   *(Separate multiple origins with commas. Do NOT add trailing slashes to the domains).*
5. Click **Save Changes**. Render will automatically trigger a zero-downtime redeploy with the updated policy.

---

## Step 5: Verification & End-to-End Testing

1. **Open Frontend**: Visit `https://vendor-reliability-platform.vercel.app`.
2. **Login**: Sign in with:
   - Email: `admin@example.com`
   - Password: `Admin@123456`
3. **Verify Functionality**:
   - Navigate to **Vendors** and verify the pre-seeded vendor (`Apex Global Logistics`).
   - Navigate to **Purchase Orders**, create a test PO, and download the PDF.
   - Navigate to **Audit Logs** and **Telemetry** to inspect real-time platform statistics.

---

## Important Free-Tier Notes

1. **Render Free Tier Spin-Down**:
   - Render's free Web Services spin down after 15 minutes of inactivity.
   - When a new request arrives, Render spins the service back up. This cold start may take 30–50 seconds on the very first request. Subsequent requests are instant.
   - The frontend includes loading spinners and toast notifications while requests resolve.
2. **Render Free PostgreSQL Expiry**:
   - Render's free PostgreSQL tier provides 1 GB storage and expires after 30 days.
   - If you require a permanent free database, you can create a free PostgreSQL instance on [Neon.tech](https://neon.tech) or [Supabase.com](https://supabase.com) and paste that connection string into `DATABASE_URL` instead. The backend handles Neon/Supabase PostgreSQL URLs seamlessly.

---

## Local Development (No Regression)

Your local development workflow remains completely unaffected:
- **Backend Local**:
  ```bash
  cd backend
  uvicorn app.main:app --reload --port 8000
  ```
  *(Reads `backend/.env` with local PostgreSQL and Redis).*
- **Frontend Local**:
  ```bash
  cd frontend
  npm start
  ```
  *(Uses `src/environments/environment.ts` which points directly to `http://localhost:8000/api/v1`).*
