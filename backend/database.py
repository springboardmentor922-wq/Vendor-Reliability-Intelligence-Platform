"""Database configuration for VendorIQ.

PostgreSQL is the supported database. Alembic manages the schema migration
history, while SQLAlchemy is used by the FastAPI runtime query layer. Connection
details come from DATABASE_URL so local and cloud environments share the same code path.
"""

from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://vendoriq:vendoriq@localhost:5432/vendor_db",
)

# Convert the standard PostgreSQL URL to the psycopg SQLAlchemy driver form.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgresql://"):]

engine_kwargs: dict = {
    "pool_pre_ping": True,
    "pool_recycle": 1800,
}

# Queue/workers may use a short-lived database connection budget.
if not DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update(
        {
            "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
            "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
        }
    )

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)

Base = declarative_base()
