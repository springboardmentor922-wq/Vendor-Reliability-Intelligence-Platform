from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def run_migrations(bind_engine):
    """
    Safely adds newly defined schema columns to existing SQLite/Postgres tables.
    """
    with bind_engine.connect() as conn:
        inspector = inspect(bind_engine)
        if "procurement_requests" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("procurement_requests")]
            missing_cols = [
                ("specifications", "TEXT"),
                ("budget_amount", "FLOAT DEFAULT 0.0"),
                ("location", "VARCHAR(255)"),
                ("assigned_vendor_id", "INTEGER"),
                ("is_multi_vendor", "BOOLEAN DEFAULT 0"),
                ("accepted_vendor_id", "INTEGER"),
                ("vendor_accepted_at", "DATETIME"),
                ("finance_status", "VARCHAR(50) DEFAULT 'pending'"),
                ("finance_approved_by_id", "INTEGER"),
                ("finance_notes", "TEXT"),
            ]
            for col_name, col_type in missing_cols:
                if col_name not in columns:
                    try:
                        conn.execute(text(f"ALTER TABLE procurement_requests ADD COLUMN {col_name} {col_type}"))
                        conn.commit()
                    except Exception:
                        pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

