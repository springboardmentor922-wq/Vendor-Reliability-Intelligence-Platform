"""
services/communication_service.py
-----------------------------------
Vendor conversation and procurement discussion service — Milestone 3.

Persists threaded messages to MongoDB COLLECTION_COMMUNICATIONS.
Thread types: "vendor" | "procurement" | "general" | "purchase_order"

M3 additions:
  - Per-thread unread tracking (unread_by: List[user_id])
  - get_unread_thread_count(user_id)
  - mark_thread_read(thread_id, user_id)
  - get_messages_for_auditor() — all messages, newest first (Auditor only)
  - get_all_messages_for_audit() — alias for auditor view
"""

import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple

from bson import ObjectId

from database.connection import get_database
from utils.logger import log_audit
from config.settings import COLLECTION_COMMUNICATIONS

logger = logging.getLogger(__name__)


# ── Send Message ──────────────────────────────────────────────────────────────

def send_message(
    sender_id: str,
    sender_name: str,
    thread_type: str,          # "vendor" | "procurement" | "general" | "purchase_order"
    thread_id: str,            # vendor_id or procurement_request_id or "general"
    thread_label: str,         # Human-readable thread name
    content: str,
    attachments: Optional[List[str]] = None,
    recipient_ids: Optional[List[str]] = None,
    sender_role: Optional[str] = None,
) -> Tuple[bool, str]:
    """Send a message and persist it to the communications collection."""
    if not content.strip():
        return False, "Message content cannot be empty."

    doc = {
        "sender_id": sender_id,
        "sender_name": sender_name,
        "sender_role": sender_role or "",
        "thread_type": thread_type,
        "thread_id": thread_id,
        "thread_label": thread_label,
        "content": content.strip(),
        "attachments": attachments or [],
        "recipient_ids": recipient_ids or [],
        # Unread tracking: list of user IDs who haven't read this message
        "unread_by": recipient_ids or [],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc),
    }

    try:
        db = get_database()
        result = db[COLLECTION_COMMUNICATIONS].insert_one(doc)
        msg_id = str(result.inserted_id)
        log_audit(sender_id, "SEND_MESSAGE", "Communication", msg_id,
                  {"thread_type": thread_type, "thread_id": thread_id})
        return True, "Message sent."
    except Exception as exc:
        logger.error("Failed to send message: %s", exc)
        return False, "Failed to send message."


# ── Get Thread Messages ───────────────────────────────────────────────────────

def get_messages(
    thread_type: str,
    thread_id: str,
    limit: int = 100,
) -> List[Dict]:
    """Return all messages in a thread, oldest first."""
    try:
        db = get_database()
        query = {
            "thread_type": thread_type,
            "thread_id": thread_id,
            "is_deleted": {"$ne": True},
        }
        docs = (
            db[COLLECTION_COMMUNICATIONS]
            .find(query)
            .sort("created_at", 1)
            .limit(limit)
        )
        result = []
        for d in docs:
            d["_id"] = str(d["_id"])
            result.append(d)
        return result
    except Exception as exc:
        logger.error("Error fetching messages for thread %s/%s: %s", thread_type, thread_id, exc)
        return []


# ── Get All Threads ───────────────────────────────────────────────────────────

def get_all_threads(
    thread_type: Optional[str] = None,
    limit: int = 50,
) -> List[Dict]:
    """
    Return unique threads with last-message preview.
    Returns list of {thread_type, thread_id, thread_label, last_message,
                      last_sender, last_at, message_count}.
    """
    try:
        db = get_database()
        match_stage: Dict[str, Any] = {"is_deleted": {"$ne": True}}
        if thread_type:
            match_stage["thread_type"] = thread_type

        pipeline = [
            {"$match": match_stage},
            {"$sort": {"created_at": -1}},
            {"$group": {
                "_id": {"thread_type": "$thread_type", "thread_id": "$thread_id"},
                "thread_label": {"$first": "$thread_label"},
                "last_message": {"$first": "$content"},
                "last_sender": {"$first": "$sender_name"},
                "last_sender_role": {"$first": "$sender_role"},
                "last_at": {"$first": "$created_at"},
                "message_count": {"$sum": 1},
            }},
            {"$sort": {"last_at": -1}},
            {"$limit": limit},
        ]
        results = list(db[COLLECTION_COMMUNICATIONS].aggregate(pipeline))
        threads = []
        for r in results:
            threads.append({
                "thread_type": r["_id"]["thread_type"],
                "thread_id": r["_id"]["thread_id"],
                "thread_label": r.get("thread_label", r["_id"]["thread_id"]),
                "last_message": r.get("last_message", ""),
                "last_sender": r.get("last_sender", ""),
                "last_sender_role": r.get("last_sender_role", ""),
                "last_at": r.get("last_at"),
                "message_count": r.get("message_count", 0),
            })
        return threads
    except Exception as exc:
        logger.error("Error fetching threads: %s", exc)
        return []


# ── Thread Stats ──────────────────────────────────────────────────────────────

def get_thread_stats() -> Dict[str, int]:
    """Return aggregate stats for the communication dashboard."""
    try:
        db = get_database()
        col = db[COLLECTION_COMMUNICATIONS]

        vendor_threads = len(col.distinct("thread_id", {"thread_type": "vendor"}))
        proc_threads = len(col.distinct("thread_id", {"thread_type": "procurement"}))
        po_threads = len(col.distinct("thread_id", {"thread_type": "purchase_order"}))
        total_messages = col.count_documents({"is_deleted": {"$ne": True}})

        return {
            "total_messages": total_messages,
            "vendor_threads": vendor_threads,
            "procurement_threads": proc_threads,
            "po_threads": po_threads,
        }
    except Exception as exc:
        logger.error("Error getting communication stats: %s", exc)
        return {"total_messages": 0, "vendor_threads": 0, "procurement_threads": 0, "po_threads": 0}


# ── Unread Tracking (M3) ──────────────────────────────────────────────────────

def get_unread_thread_count(user_id: str) -> int:
    """Count threads that have at least one message the user hasn't read."""
    try:
        db = get_database()
        col = db[COLLECTION_COMMUNICATIONS]
        # Threads with at least one message where user_id is in unread_by
        pipeline = [
            {"$match": {"unread_by": user_id, "is_deleted": {"$ne": True}}},
            {"$group": {"_id": {"thread_type": "$thread_type", "thread_id": "$thread_id"}}},
            {"$count": "total"},
        ]
        result = list(col.aggregate(pipeline))
        return result[0]["total"] if result else 0
    except Exception as exc:
        logger.error("Error counting unread threads for %s: %s", user_id, exc)
        return 0


def get_thread_unread_count(thread_type: str, thread_id: str, user_id: str) -> int:
    """Count unread messages in a specific thread for a user."""
    try:
        db = get_database()
        return db[COLLECTION_COMMUNICATIONS].count_documents({
            "thread_type": thread_type,
            "thread_id": thread_id,
            "unread_by": user_id,
            "is_deleted": {"$ne": True},
        })
    except Exception as exc:
        logger.error("Error counting thread unread: %s", exc)
        return 0


def get_batch_unread_counts(user_id: str) -> dict:
    """
    Return unread message counts for ALL threads in one aggregation.

    Returns a dict keyed by (thread_type, thread_id) -> unread_count.
    Eliminates N+1 query pattern when rendering thread lists.
    """
    try:
        db = get_database()
        pipeline = [
            {"$match": {"unread_by": user_id, "is_deleted": {"$ne": True}}},
            {"$group": {
                "_id": {"thread_type": "$thread_type", "thread_id": "$thread_id"},
                "count": {"$sum": 1},
            }},
        ]
        results = list(db[COLLECTION_COMMUNICATIONS].aggregate(pipeline))
        return {
            (r["_id"]["thread_type"], r["_id"]["thread_id"]): r["count"]
            for r in results
        }
    except Exception as exc:
        logger.error("Error in get_batch_unread_counts for %s: %s", user_id, exc)
        return {}




def mark_thread_read(thread_type: str, thread_id: str, user_id: str) -> None:
    """Remove user_id from unread_by for all messages in a thread."""
    try:
        db = get_database()
        db[COLLECTION_COMMUNICATIONS].update_many(
            {"thread_type": thread_type, "thread_id": thread_id, "unread_by": user_id},
            {"$pull": {"unread_by": user_id}},
        )
    except Exception as exc:
        logger.error("Error marking thread read: %s", exc)


# ── Auditor Access (M3) ───────────────────────────────────────────────────────

def get_messages_for_auditor(
    thread_type: Optional[str] = None,
    limit: int = 200,
    skip: int = 0,
) -> List[Dict]:
    """
    Return all messages (including deleted) for Auditor read-only view.
    Paginated; includes sender role and thread context.
    """
    try:
        db = get_database()
        query: Dict[str, Any] = {}
        if thread_type and thread_type != "All":
            query["thread_type"] = thread_type

        docs = (
            db[COLLECTION_COMMUNICATIONS]
            .find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        result = []
        for d in docs:
            d["_id"] = str(d["_id"])
            result.append(d)
        return result
    except Exception as exc:
        logger.error("Error fetching messages for auditor: %s", exc)
        return []


def get_message_count_for_auditor(thread_type: Optional[str] = None) -> int:
    """Total message count for auditor pagination."""
    try:
        db = get_database()
        query: Dict[str, Any] = {}
        if thread_type and thread_type != "All":
            query["thread_type"] = thread_type
        return db[COLLECTION_COMMUNICATIONS].count_documents(query)
    except Exception as exc:
        logger.error("Error counting messages for auditor: %s", exc)
        return 0


# ── Delete Message ────────────────────────────────────────────────────────────

def delete_message(message_id: str, deleted_by: str) -> Tuple[bool, str]:
    """Soft-delete a message."""
    try:
        db = get_database()
        result = db[COLLECTION_COMMUNICATIONS].update_one(
            {"_id": ObjectId(message_id)},
            {"$set": {
                "is_deleted": True,
                "deleted_by": deleted_by,
                "deleted_at": datetime.now(timezone.utc),
            }},
        )
        return (
            result.matched_count > 0,
            "Message deleted." if result.matched_count > 0 else "Message not found.",
        )
    except Exception as exc:
        logger.error("Error deleting message %s: %s", message_id, exc)
        return False, "Failed to delete message."
