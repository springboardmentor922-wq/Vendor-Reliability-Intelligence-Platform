"""
database/connection.py
----------------------
MongoDB connection management for the Vendor Reliability Intelligence Platform.
Implements a singleton connection pool with error handling.
"""

import sys
import logging
from typing import Optional
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError, ConfigurationError

from config.settings import MONGODB_URI, MONGODB_DATABASE

logger = logging.getLogger(__name__)

# ── Singleton client ──────────────────────────────────────────────────────────
_client: Optional[MongoClient] = None
_database: Optional[Database] = None


def get_client() -> MongoClient:
    """
    Return (and lazily create) the singleton MongoClient.
    Uses a 5-second server selection timeout so failures surface quickly.
    """
    global _client
    if _client is None:
        try:
            _client = MongoClient(
                MONGODB_URI,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                maxPoolSize=50,
                retryWrites=True,
            )
            # Trigger an actual network call to verify connectivity
            _client.admin.command("ping")
            logger.info("MongoDB connection established — URI: %s", MONGODB_URI)
        except (ConnectionFailure, ServerSelectionTimeoutError) as exc:
            logger.error("MongoDB connection failed: %s", exc)
            _client = None
            raise
        except ConfigurationError as exc:
            logger.error("MongoDB configuration error: %s", exc)
            _client = None
            raise
    return _client


def get_database() -> Database:
    """
    Return the application database, creating the client if necessary.
    """
    global _database
    if _database is None:
        client = get_client()
        _database = client[MONGODB_DATABASE]
        logger.info("Using database: %s", MONGODB_DATABASE)
    return _database


def close_connection() -> None:
    """
    Gracefully close the MongoDB connection pool.
    Call this on application shutdown.
    """
    global _client, _database
    if _client is not None:
        _client.close()
        _client = None
        _database = None
        logger.info("MongoDB connection closed.")


def check_connection() -> dict:
    """
    Health-check the MongoDB connection.
    Returns a dict with 'status' and optional 'error'.
    """
    try:
        client = get_client()
        client.admin.command("ping")
        return {"status": "connected", "database": MONGODB_DATABASE, "uri": MONGODB_URI}
    except Exception as exc:
        return {"status": "disconnected", "error": str(exc)}
