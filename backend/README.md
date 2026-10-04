# VendorIQ Backend (FastAPI + SQLAlchemy)

## Setup & Running

1. **Install Dependencies**:
```bash
pip install -r requirements.txt
```

2. **Configure Environment Variables**:
Copy `.env.example` to `.env` if custom postgres credentials or ports are required:
```bash
cp .env.example .env
```

3. **Run Application**:
```bash
uvicorn app.main:app --reload --port 8000
```

4. **Run Verification Test Suite**:
```bash
python test_api.py
```

The database tables (all 13 models) are automatically created on startup and seeded with realistic multi-role data.
