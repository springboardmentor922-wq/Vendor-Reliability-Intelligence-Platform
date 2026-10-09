# VendorIQ

VendorIQ is a procurement and vendor reliability platform for managing suppliers, purchase orders, contracts, compliance, invoices, and operational risk.

## Features

- Vendor and procurement management
- Purchase orders and approval workflows
- Vendor performance and reliability scoring
- Contract and compliance tracking
- Invoice management and notifications
- Analytics, reports, and audit history

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **Database:** PostgreSQL, SQLAlchemy, Psycopg
- **Migrations:** Alembic
- **Reporting:** Pandas, NumPy, OpenPyXL, ReportLab

## Backend

From the project root:

```bash
cd backend
python -m venv .venv
```

Activate the environment:

```bash
# Windows
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate
```

Install dependencies:

```bash
python -m pip install -r requirements.txt
```

Create `backend/.env` from `.env.example`. Set your PostgreSQL `DATABASE_URL` and a strong `SECRET_KEY`.

Run migrations and seed development data:

```bash
alembic upgrade head
python seed_data.py
```

Start the API:

```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

API documentation: `http://127.0.0.1:8001/docs`

## Frontend

In a separate terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env` from `.env.example` and set:

```env
VITE_API_BASE=http://127.0.0.1:8001
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite.

## Demo Video

Upload a walkthrough to YouTube, add a thumbnail image to your repository, and link it in the README:

[Video Demo](https://drive.google.com/file/d/1ymmz5CRiOWA_JOu6SOwPywXIi2s6OjnU/view?usp=sharing)

## Notes

- Do not commit `.env` files or credentials.
- Use demo accounts only for development.
- Configure production secrets, CORS, and HTTPS before deployment.