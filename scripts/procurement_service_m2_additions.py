

def approve_procurement_request(pr_id, approved_by):
    """Approve a submitted procurement request."""
    from datetime import datetime, timezone
    from bson import ObjectId
    try:
        db = get_database()
        result = db[COLLECTION_PROCUREMENT_REQUESTS].update_one(
            {"_id": ObjectId(pr_id)},
            {"$set": {
                "status": "Approved",
                "approved_by": approved_by,
                "approved_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            return False, "Procurement request not found."
        log_audit(approved_by, "APPROVE_PR", "ProcurementRequest", pr_id, {})
        return True, "Procurement request approved."
    except Exception as exc:
        logger.error("PR approval failed: %s", exc)
        return False, "Failed to approve procurement request."


def reject_procurement_request(pr_id, rejected_by, reason=""):
    """Reject a procurement request."""
    from datetime import datetime, timezone
    from bson import ObjectId
    try:
        db = get_database()
        result = db[COLLECTION_PROCUREMENT_REQUESTS].update_one(
            {"_id": ObjectId(pr_id)},
            {"$set": {
                "status": "Rejected",
                "rejected_by": rejected_by,
                "rejection_reason": reason,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            return False, "Procurement request not found."
        log_audit(rejected_by, "REJECT_PR", "ProcurementRequest", pr_id, {"reason": reason})
        return True, "Procurement request rejected."
    except Exception as exc:
        logger.error("PR rejection failed: %s", exc)
        return False, "Failed to reject procurement request."


def assign_vendor_to_pr(pr_id, vendor_id, assigned_by):
    """Assign a vendor to an approved procurement request."""
    from datetime import datetime, timezone
    from bson import ObjectId
    try:
        db = get_database()
        result = db[COLLECTION_PROCUREMENT_REQUESTS].update_one(
            {"_id": ObjectId(pr_id)},
            {"$set": {
                "vendor_id": vendor_id,
                "assigned_by": assigned_by,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            return False, "Procurement request not found."
        log_audit(assigned_by, "ASSIGN_VENDOR_PR", "ProcurementRequest", pr_id, {"vendor_id": vendor_id})
        return True, "Vendor assigned to procurement request."
    except Exception as exc:
        logger.error("PR vendor assign failed: %s", exc)
        return False, "Failed to assign vendor."


def get_procurement_request_by_id(pr_id):
    """Retrieve a single procurement request by ID."""
    from bson import ObjectId
    try:
        db = get_database()
        doc = db[COLLECTION_PROCUREMENT_REQUESTS].find_one({"_id": ObjectId(pr_id)})
        return procurement_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("Error fetching PR %s: %s", pr_id, exc)
        return None


def approve_purchase_order(po_id, approved_by):
    """Approve a draft/pending purchase order, setting status to Issued."""
    from datetime import datetime, timezone
    from bson import ObjectId
    try:
        db = get_database()
        result = db[COLLECTION_PURCHASE_ORDERS].update_one(
            {"_id": ObjectId(po_id)},
            {"$set": {
                "status": "Issued",
                "approved_by": approved_by,
                "approved_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            return False, "Purchase order not found."
        log_audit(approved_by, "APPROVE_PO", "PurchaseOrder", po_id, {})
        return True, "Purchase order approved and issued."
    except Exception as exc:
        logger.error("PO approval failed: %s", exc)
        return False, "Failed to approve purchase order."


def update_po_status(po_id, new_status, updated_by):
    """Update purchase order status."""
    from datetime import datetime, timezone
    from bson import ObjectId
    try:
        db = get_database()
        result = db[COLLECTION_PURCHASE_ORDERS].update_one(
            {"_id": ObjectId(po_id)},
            {"$set": {
                "status": new_status,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            return False, "Purchase order not found."
        log_audit(updated_by, "UPDATE_PO_STATUS", "PurchaseOrder", po_id, {"new_status": new_status})
        return True, f"Purchase order status updated to {new_status}."
    except Exception as exc:
        logger.error("PO status update failed: %s", exc)
        return False, "Failed to update purchase order status."


def get_purchase_order_by_id(po_id):
    """Retrieve a single purchase order by ID."""
    from bson import ObjectId
    try:
        db = get_database()
        doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": ObjectId(po_id)})
        return po_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("Error fetching PO %s: %s", po_id, exc)
        return None
