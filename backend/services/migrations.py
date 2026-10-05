"""Idempotent, additive schema upgrades applied at API start-up.

``seed.py`` rebuilds the whole schema from ``database/schema.sql``, but an
existing database that already holds real data should not have to be wiped
to pick up the Milestone 4 columns. Every statement here is additive and
guarded with ``IF NOT EXISTS``, so running it repeatedly is harmless.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine

STATEMENTS = [
    # ---- vendor application form ---------------------------------
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS state VARCHAR(100)",
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)",
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS company_type VARCHAR(60)",
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS year_established INTEGER",
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS employee_count VARCHAR(30)",
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS annual_turnover VARCHAR(60)",
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS products_services TEXT",
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS application_source VARCHAR(30)",
    """
    CREATE TABLE IF NOT EXISTS vendor_documents (
        id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        vendor_id      BIGINT        NOT NULL
                       REFERENCES vendors (id) ON DELETE CASCADE,
        document_type  VARCHAR(80)   NOT NULL,
        file_name      VARCHAR(255)  NOT NULL,
        file_path      TEXT          NOT NULL,
        file_size      BIGINT,
        content_type   VARCHAR(120),
        status         VARCHAR(30)   NOT NULL DEFAULT 'Submitted',
        uploaded_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_vendor_documents_vendor ON vendor_documents (vendor_id)",

    # ---- create purchase order screen ----------------------------
    "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS billing_address TEXT",
    "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS department VARCHAR(100)",
    "ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0",

    # ---- spreadsheet import history ------------------------------
    """
    CREATE TABLE IF NOT EXISTS data_imports (
        id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        file_name      VARCHAR(255)  NOT NULL,
        file_format    VARCHAR(30)   NOT NULL,
        mode           VARCHAR(30)   NOT NULL,
        status         VARCHAR(30)   NOT NULL,
        rows_read      INTEGER       NOT NULL DEFAULT 0,
        rows_created   INTEGER       NOT NULL DEFAULT 0,
        rows_updated   INTEGER       NOT NULL DEFAULT 0,
        rows_skipped   INTEGER       NOT NULL DEFAULT 0,
        summary        TEXT,
        imported_by    BIGINT        REFERENCES users (id) ON DELETE SET NULL,
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
]


def apply(engine: Engine) -> None:
    with engine.begin() as connection:
        for statement in STATEMENTS:
            connection.execute(text(statement))
