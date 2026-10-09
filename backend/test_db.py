"""Minimal PostgreSQL smoke check for local development."""

from sqlalchemy import text
from database import engine


if __name__ == "__main__":
    with engine.connect() as conn:
        version = conn.execute(text("SELECT version()")).scalar()
        print(version)
        print("VendorIQ PostgreSQL connection: OK")
