"""
utils/logger.py
---------------
Structured logging and audit trail for the Vendor Reliability Intelligence Platform.
"""

import logging
import logging.handlers
import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from config.settings import LOG_LEVEL, LOG_FILE

# ── Module logger ─────────────────────────────────────────────────────────────
_initialized = False


def setup_logging() -> None:
    """
    Configure root logger with console + rotating file handlers.
    Safe to call multiple times — only initializes once.
    """
    global _initialized
    if _initialized:
        return

    level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)

    # Ensure log directory exists
    log_dir = os.path.dirname(LOG_FILE)
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)

    # Rotating file handler (max 10 MB, 5 backups)
    try:
        file_handler = logging.handlers.RotatingFileHandler(
            LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    except Exception:
        pass  # File logging optional

    root_logger.addHandler(console_handler)
    _initialized = True


def get_logger(name: str) -> logging.Logger:
    """Return a named logger (call setup_logging first)."""
    setup_logging()
    return logging.getLogger(name)


def log_audit(
    user_id: str,
    action: str,
    entity: str,
    entity_id: str,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Write an audit log entry to MongoDB.
    Fails silently so that audit logging never breaks the main flow.
    """
    try:
        from database.connection import get_database
        from config.settings import COLLECTION_AUDIT_LOGS

        doc = {
            "user_id": user_id,
            "action": action,
            "entity": entity,
            "entity_id": entity_id,
            "details": details or {},
            "timestamp": datetime.now(timezone.utc),
        }
        db = get_database()
        db[COLLECTION_AUDIT_LOGS].insert_one(doc)
    except Exception as exc:
        logging.getLogger(__name__).warning("Audit log write failed: %s", exc)
