"""
database/indexes.py
-------------------
Creates all required MongoDB indexes for the Vendor Reliability Intelligence Platform.
Called once on application startup.  Safe to re-run (create_index is idempotent).
"""

import logging
from pymongo import ASCENDING, DESCENDING, IndexModel
from pymongo.database import Database

from config.settings import (
    COLLECTION_USERS,
    COLLECTION_VENDORS,
    COLLECTION_PROCUREMENT_REQUESTS,
    COLLECTION_PURCHASE_ORDERS,
    COLLECTION_DELIVERIES,
    COLLECTION_CONTRACTS,
    COLLECTION_COMMUNICATIONS,
    COLLECTION_NOTIFICATIONS,
    COLLECTION_AUDIT_LOGS,
    COLLECTION_INVOICES,
)

logger = logging.getLogger(__name__)


def create_all_indexes(db: Database) -> dict:
    """
    Create all collection indexes.
    Returns a summary dict: {collection_name: [index_names]}.
    """
    results = {}

    # ── users ─────────────────────────────────────────────────────────────────
    users = db[COLLECTION_USERS]
    users.create_index([("email", ASCENDING)], unique=True, name="idx_users_email_unique")
    users.create_index([("role", ASCENDING)], name="idx_users_role")
    users.create_index([("status", ASCENDING)], name="idx_users_status")
    users.create_index([("created_at", DESCENDING)], name="idx_users_created_at")
    results[COLLECTION_USERS] = ["email (unique)", "role", "status", "created_at"]
    logger.info("Indexes created for collection: %s", COLLECTION_USERS)

    # ── vendors ───────────────────────────────────────────────────────────────
    vendors = db[COLLECTION_VENDORS]
    vendors.create_index(
        [("vendor_code", ASCENDING)], unique=True, name="idx_vendors_code_unique"
    )
    vendors.create_index([("company_name", ASCENDING)], name="idx_vendors_company_name")
    vendors.create_index([("status", ASCENDING)], name="idx_vendors_status")
    vendors.create_index(
        [("approval_status", ASCENDING)], name="idx_vendors_approval_status"
    )
    vendors.create_index([("category", ASCENDING)], name="idx_vendors_category")
    vendors.create_index([("created_at", DESCENDING)], name="idx_vendors_created_at")
    results[COLLECTION_VENDORS] = [
        "vendor_code (unique)", "company_name", "status", "approval_status", "category", "created_at"
    ]
    logger.info("Indexes created for collection: %s", COLLECTION_VENDORS)

    # ── procurement_requests ──────────────────────────────────────────────────
    pr = db[COLLECTION_PROCUREMENT_REQUESTS]
    pr.create_index(
        [("request_number", ASCENDING)], unique=True, name="idx_pr_number_unique"
    )
    pr.create_index([("requested_by", ASCENDING)], name="idx_pr_requested_by")
    pr.create_index([("vendor_id", ASCENDING)], name="idx_pr_vendor_id")
    pr.create_index([("status", ASCENDING)], name="idx_pr_status")
    pr.create_index([("created_at", DESCENDING)], name="idx_pr_created_at")
    results[COLLECTION_PROCUREMENT_REQUESTS] = [
        "request_number (unique)", "requested_by", "vendor_id", "status", "created_at"
    ]
    logger.info("Indexes created for collection: %s", COLLECTION_PROCUREMENT_REQUESTS)

    # ── purchase_orders ───────────────────────────────────────────────────────
    po = db[COLLECTION_PURCHASE_ORDERS]
    po.create_index(
        [("po_number", ASCENDING)], unique=True, name="idx_po_number_unique"
    )
    po.create_index([("vendor_id", ASCENDING)], name="idx_po_vendor_id")
    po.create_index([("request_id", ASCENDING)], name="idx_po_request_id")
    po.create_index([("status", ASCENDING)], name="idx_po_status")
    po.create_index([("payment_status", ASCENDING)], name="idx_po_payment_status")
    po.create_index([("order_date", DESCENDING)], name="idx_po_order_date")
    po.create_index([("created_at", DESCENDING)], name="idx_po_created_at")
    results[COLLECTION_PURCHASE_ORDERS] = [
        "po_number (unique)", "vendor_id", "request_id", "status", "payment_status", "order_date", "created_at"
    ]
    logger.info("Indexes created for collection: %s", COLLECTION_PURCHASE_ORDERS)

    # ── deliveries ────────────────────────────────────────────────────────────
    deliveries = db[COLLECTION_DELIVERIES]
    deliveries.create_index(
        [("delivery_number", ASCENDING)], unique=True, name="idx_del_number_unique"
    )
    deliveries.create_index([("po_id", ASCENDING)], name="idx_del_po_id")
    deliveries.create_index([("po_number", ASCENDING)], name="idx_del_po_number")
    deliveries.create_index([("vendor_id", ASCENDING)], name="idx_del_vendor_id")
    deliveries.create_index([("status", ASCENDING)], name="idx_del_status")
    deliveries.create_index([("expected_date", ASCENDING)], name="idx_del_expected_date")
    deliveries.create_index([("created_at", DESCENDING)], name="idx_del_created_at")
    results[COLLECTION_DELIVERIES] = [
        "delivery_number (unique)", "po_id", "po_number", "vendor_id", "status", "expected_date", "created_at"
    ]
    logger.info("Indexes created for collection: %s", COLLECTION_DELIVERIES)

    # ── contracts ─────────────────────────────────────────────────────────────
    contracts = db[COLLECTION_CONTRACTS]
    contracts.create_index(
        [("contract_number", ASCENDING)], unique=True, name="idx_con_number_unique"
    )
    contracts.create_index([("vendor_id", ASCENDING)], name="idx_con_vendor_id")
    contracts.create_index(
        [("compliance_status", ASCENDING)], name="idx_con_compliance_status"
    )
    contracts.create_index([("end_date", ASCENDING)], name="idx_con_end_date")
    contracts.create_index([("created_at", DESCENDING)], name="idx_con_created_at")
    results[COLLECTION_CONTRACTS] = [
        "contract_number (unique)", "vendor_id", "compliance_status", "end_date", "created_at"
    ]
    logger.info("Indexes created for collection: %s", COLLECTION_CONTRACTS)

    # ── communications ────────────────────────────────────────────────────────
    comms = db[COLLECTION_COMMUNICATIONS]
    comms.create_index([("vendor_id", ASCENDING)], name="idx_comm_vendor_id")
    comms.create_index([("user_id", ASCENDING)], name="idx_comm_user_id")
    comms.create_index([("created_at", DESCENDING)], name="idx_comm_created_at")
    results[COLLECTION_COMMUNICATIONS] = ["vendor_id", "user_id", "created_at"]
    logger.info("Indexes created for collection: %s", COLLECTION_COMMUNICATIONS)

    # ── notifications ─────────────────────────────────────────────────────────
    notifs = db[COLLECTION_NOTIFICATIONS]
    notifs.create_index([("user_id", ASCENDING)], name="idx_notif_user_id")
    notifs.create_index([("is_read", ASCENDING)], name="idx_notif_is_read")
    notifs.create_index([("created_at", DESCENDING)], name="idx_notif_created_at")
    results[COLLECTION_NOTIFICATIONS] = ["user_id", "is_read", "created_at"]
    logger.info("Indexes created for collection: %s", COLLECTION_NOTIFICATIONS)

    # ── audit_logs ────────────────────────────────────────────────────────────
    audit = db[COLLECTION_AUDIT_LOGS]
    audit.create_index([("user_id", ASCENDING)], name="idx_audit_user_id")
    audit.create_index([("entity", ASCENDING)], name="idx_audit_entity")
    audit.create_index([("timestamp", DESCENDING)], name="idx_audit_timestamp")
    results[COLLECTION_AUDIT_LOGS] = ["user_id", "entity", "timestamp"]
    logger.info("Indexes created for collection: %s", COLLECTION_AUDIT_LOGS)

    # ── invoices ────────────────────────────────────────────────────────────────
    invoices = db[COLLECTION_INVOICES]
    invoices.create_index([("po_id", ASCENDING)], name="idx_inv_po_id")
    invoices.create_index([("vendor_id", ASCENDING)], name="idx_inv_vendor_id")
    invoices.create_index([("invoice_status", ASCENDING)], name="idx_inv_status")
    invoices.create_index([("verification_status", ASCENDING)], name="idx_inv_verification_status")
    invoices.create_index([("procurement_request_id", ASCENDING)], name="idx_inv_pr_id")
    invoices.create_index([("created_at", DESCENDING)], name="idx_inv_created_at")
    results[COLLECTION_INVOICES] = [
        "po_id", "vendor_id", "invoice_status", "verification_status", "procurement_request_id", "created_at"
    ]
    logger.info("Indexes created for collection: %s", COLLECTION_INVOICES)

    logger.info("All MongoDB indexes created successfully.")
    return results
