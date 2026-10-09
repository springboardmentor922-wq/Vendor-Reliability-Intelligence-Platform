# VendorIQ Local Setup

## Prerequisites
- Node.js
- Python 3.13+
- Neon/PostgreSQL database

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set DATABASE_URL and SECRET_KEY in .env
python -m alembic upgrade head
python seed_data.py
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

API: `http://127.0.0.1:8001`
Swagger: `http://127.0.0.1:8001/docs`

## Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Web app: `http://localhost:5173`

## DataCo import

Run once when the dataset needs to be loaded:

```bash
cd backend
source .venv/bin/activate
python import_dataset.py --csv "data/DataCoSupplyChainDataset - DataCoSupplyChainDataset.csv"
```
