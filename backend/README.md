# VendorIQ Backend (FastAPI)

## Setup

```bash
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edit .env with your PostgreSQL credentials and a random SECRET_KEY
```

## Run migrations

```bash
alembic revision --autogenerate -m "create users and vendors tables"
alembic upgrade head
```

## Start the server

```bash
uvicorn app.main:app --reload
```

Visit http://127.0.0.1:8000/docs for interactive API docs.

## What's included so far
- `users` and `vendors` models (matches the DB schema doc)
- JWT auth: `/auth/register`, `/auth/login`, `/auth/me`
- Role-based access helper: `require_role("admin", "procurement_manager")` — use as a route dependency

## Next models to add (in this order — see schema doc)
procurement_requests → purchase_orders → invoices → vendor_performance →
reliability_scores → contracts → compliance_checks → messages/activity_logs/notifications/reports

Add each as `app/models/<name>.py`, import it in `app/models/__init__.py`, then run
`alembic revision --autogenerate -m "..."` again.
