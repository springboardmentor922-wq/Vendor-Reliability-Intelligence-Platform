# VendorIQ

Vendor Reliability Intelligence & Procurement Risk Management Platform.

### Stack
React + TypeScript + Vite · FastAPI · SQLAlchemy · PostgreSQL (Neon) · Alembic

### Start

**Backend**
```bash
cd backend
python -m venv .venv
.venv/bin/activate
pip install -r requirements.txt
# Add your Neon DATABASE_URL and SECRET_KEY
python -m alembic upgrade head
python seed_data.py
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

**Frontend** — open a second terminal:
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

**Demo:** `admin@vendoriq.local` / `VendorIQ@2026`

For the DataCo import, see `docs/deployment_guide.md`.
