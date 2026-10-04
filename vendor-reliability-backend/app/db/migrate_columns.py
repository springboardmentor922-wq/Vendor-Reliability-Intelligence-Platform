import sqlite3
from app.core.config import settings

def run_sqlite_migrations():
    db_url = settings.DATABASE_URL
    if not db_url.startswith("sqlite"):
        return

    # Extract db path from sqlite:///./vendors.db
    db_path = db_url.replace("sqlite:///", "").replace("sqlite://", "")
    if db_path.startswith("./"):
        db_path = db_path[2:]

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        tables = [
            'purchase_orders',
            'invoices',
            'procurement_requests',
            'financial_approvals',
            'vendor_selections',
            'deliveries',
            'payments',
            'audit_logs',
            'contracts'
        ]

        for t in tables:
            cursor.execute(f"PRAGMA table_info({t})")
            cols = [r[1] for r in cursor.fetchall()]
            if not cols:
                continue
            if 'blockchain_status' not in cols:
                cursor.execute(f"ALTER TABLE {t} ADD COLUMN blockchain_status VARCHAR(50) DEFAULT 'PENDING'")
            if 'blockchain_tx_hash' not in cols:
                cursor.execute(f"ALTER TABLE {t} ADD COLUMN blockchain_tx_hash VARCHAR(100)")
            if 'blockchain_confirmed_at' not in cols:
                cursor.execute(f"ALTER TABLE {t} ADD COLUMN blockchain_confirmed_at DATETIME")

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Column migration notice: {e}")
