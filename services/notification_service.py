"""
services/notification_service.py
---------------------------------
Notification management service — extended for Milestone 3.

Notification types (M3):
  procurement_approval  — PR created/approved workflow events
  vendor_assignment     — Vendor assigned to PR; vendor accepts/rejects
  po_update             — PO created, approved, delivered
  delivery_delay        — Detected delivery delay
  performance_alert     — Poor performer / high risk vendor
  compliance_alert      — Contract expiry / compliance issues
  invoice_verification  — Invoice verified / discrepancy
  Info / Warning / Alert / Success / Critical  (legacy generic types)
"""

import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple

from bson import ObjectId

from database.connection import get_database
from config.settings import COLLECTION_NOTIFICATIONS

logger = logging.getLogger(__name__)

# ── All valid notification types ──────────────────────────────────────────────
NOTIFICATION_TYPES = [
    # M3 typed
    "procurement_approval",
    "vendor_assignment",
    "po_update",
    "delivery_delay",
    "performance_alert",
    "compliance_alert",
    "invoice_verification",
    # Legacy generic
    "Info",
    "Warning",
    "Alert",
    "Success",
    "Critical",
]

NOTIFICATION_TYPE_LABELS = {
    "procurement_approval": "Procurement",
    "vendor_assignment": "Vendor Assignment",
    "po_update": "Purchase Order",
    "delivery_delay": "Delivery Delay",
    "performance_alert": "Performance Alert",
    "compliance_alert": "Compliance",
    "invoice_verification": "Invoice",
    "Info": "Info",
    "Warning": "Warning",
    "Alert": "Alert",
    "Success": "Success",
    "Critical": "Critical",
}


# ── Create Notification ───────────────────────────────────────────────────────

def create_notification(
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "Info",
    reference_id: Optional[str] = None,
    reference_entity: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Create a notification for a specific user.

    Args:
        user_id:           Target user ID string.
        title:             Short notification title.
        message:           Full notification body.
        notification_type: One of NOTIFICATION_TYPES.
        reference_id:      Optional linked entity ID (e.g. PO ID).
        reference_entity:  Optional entity name (e.g. "PurchaseOrder").
    """
    doc = {
        "user_id": user_id,
        "title": title,
        "message": message,
        "notification_type": notification_type,
        "is_read": False,
        "created_at": datetime.now(timezone.utc),
        "reference_id": reference_id,
        "reference_entity": reference_entity,
    }
    try:
        db = get_database()
        db[COLLECTION_NOTIFICATIONS].insert_one(doc)
        return True, "Notification created."
    except Exception as exc:
        logger.error("Failed to create notification: %s", exc)
        return False, "Failed to create notification."


def create_typed_notification(
    user_id: str,
    notif_type: str,
    title: str,
    message: str,
    reference_id: Optional[str] = None,
    reference_entity: Optional[str] = None,
) -> Tuple[bool, str]:
    """Convenience wrapper — same as create_notification with explicit type."""
    return create_notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notif_type,
        reference_id=reference_id,
        reference_entity=reference_entity,
    )


def notify_users_by_role(
    role: str,
    title: str,
    message: str,
    notification_type: str = "Info",
    reference_id: Optional[str] = None,
    reference_entity: Optional[str] = None,
) -> int:
    """
    Send a notification to ALL users with a given role.
    Returns count of notifications created.
    """
    try:
        from config.settings import COLLECTION_USERS
        db = get_database()
        users = list(db[COLLECTION_USERS].find({"role": role}, {"_id": 1}))
        count = 0
        for u in users:
            ok, _ = create_notification(
                user_id=str(u["_id"]),
                title=title,
                message=message,
                notification_type=notification_type,
                reference_id=reference_id,
                reference_entity=reference_entity,
            )
            if ok:
                count += 1
        return count
    except Exception as exc:
        logger.error("notify_users_by_role failed: %s", exc)
        return 0


# ── Get Notifications ─────────────────────────────────────────────────────────

def get_user_notifications(
    user_id: str,
    unread_only: bool = False,
    notif_type: Optional[str] = None,
    limit: int = 100,
) -> List[Dict]:
    """Return notifications for a user, newest first."""
    try:
        db = get_database()
        query: Dict = {"user_id": user_id}
        if unread_only:
            query["is_read"] = False
        if notif_type and notif_type != "All":
            query["notification_type"] = notif_type
        docs = (
            db[COLLECTION_NOTIFICATIONS]
            .find(query)
            .sort("created_at", -1)
            .limit(limit)
        )
        result = []
        for d in docs:
            d["_id"] = str(d["_id"])
            result.append(d)
        return result
    except Exception as exc:
        logger.error("Error fetching notifications for %s: %s", user_id, exc)
        return []


def get_notification_counts_by_type(user_id: str) -> Dict[str, int]:
    """Return unread counts per notification type for sidebar badges."""
    try:
        db = get_database()
        pipeline = [
            {"$match": {"user_id": user_id, "is_read": False}},
            {"$group": {"_id": "$notification_type", "count": {"$sum": 1}}},
        ]
        results = list(db[COLLECTION_NOTIFICATIONS].aggregate(pipeline))
        counts = {r["_id"]: r["count"] for r in results if r["_id"]}
        counts["total"] = sum(counts.values())
        return counts
    except Exception as exc:
        logger.error("Error getting notification counts: %s", exc)
        return {"total": 0}


# ── Mark Read ─────────────────────────────────────────────────────────────────

def mark_notification_read(notification_id: str) -> Tuple[bool, str]:
    """Mark a single notification as read."""
    try:
        db = get_database()
        result = db[COLLECTION_NOTIFICATIONS].update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"is_read": True}},
        )
        return result.matched_count > 0, "Updated."
    except Exception as exc:
        logger.error("Error marking notification read: %s", exc)
        return False, "Failed to update notification."


def mark_all_read(user_id: str) -> Tuple[bool, str]:
    """Mark all of a user's notifications as read."""
    try:
        db = get_database()
        db[COLLECTION_NOTIFICATIONS].update_many(
            {"user_id": user_id, "is_read": False},
            {"$set": {"is_read": True}},
        )
        return True, "All notifications marked as read."
    except Exception as exc:
        logger.error("Error marking all read for %s: %s", user_id, exc)
        return False, "Failed to update notifications."


def get_unread_count(user_id: str) -> int:
    """Return the number of unread notifications for a user."""
    try:
        db = get_database()
        return db[COLLECTION_NOTIFICATIONS].count_documents(
            {"user_id": user_id, "is_read": False}
        )
    except Exception as exc:
        logger.error("Error counting notifications: %s", exc)
        return 0
