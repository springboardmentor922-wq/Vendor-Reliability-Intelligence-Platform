

def update_vendor(vendor_id, updates, updated_by):
    """Update vendor fields."""
    from datetime import datetime, timezone
    from bson import ObjectId
    try:
        db = get_database()
        updates["updated_at"] = datetime.now(timezone.utc)
        result = db[COLLECTION_VENDORS].update_one(
            {"_id": ObjectId(vendor_id)},
            {"$set": updates},
        )
        if result.matched_count == 0:
            return False, "Vendor not found."
        log_audit(updated_by, "UPDATE_VENDOR", "Vendor", vendor_id, {})
        return True, "Vendor updated successfully."
    except Exception as exc:
        logger.error("Vendor update failed: %s", exc)
        return False, "Failed to update vendor."


def reject_vendor(vendor_id, rejected_by, reason=""):
    """Reject a pending vendor application."""
    from datetime import datetime, timezone
    from bson import ObjectId
    try:
        db = get_database()
        result = db[COLLECTION_VENDORS].update_one(
            {"_id": ObjectId(vendor_id)},
            {"$set": {
                "approval_status": "Rejected",
                "status": "Suspended",
                "rejected_by": rejected_by,
                "rejection_reason": reason,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            return False, "Vendor not found."
        log_audit(rejected_by, "REJECT_VENDOR", "Vendor", vendor_id, {"reason": reason})
        return True, "Vendor application rejected."
    except Exception as exc:
        logger.error("Vendor rejection failed: %s", exc)
        return False, "Failed to reject vendor."


def delete_vendor(vendor_id, deleted_by):
    """Soft-delete a vendor by setting status to Inactive."""
    from datetime import datetime, timezone
    from bson import ObjectId
    try:
        db = get_database()
        result = db[COLLECTION_VENDORS].update_one(
            {"_id": ObjectId(vendor_id)},
            {"$set": {
                "status": "Inactive",
                "deleted_by": deleted_by,
                "deleted_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            return False, "Vendor not found."
        log_audit(deleted_by, "DELETE_VENDOR", "Vendor", vendor_id, {})
        return True, "Vendor deactivated successfully."
    except Exception as exc:
        logger.error("Vendor delete failed: %s", exc)
        return False, "Failed to deactivate vendor."


def get_vendors_for_select(active_only=True):
    """Return minimal list for selectboxes."""
    try:
        db = get_database()
        query = {"status": "Active", "approval_status": "Approved"} if active_only else {}
        docs = db[COLLECTION_VENDORS].find(
            query, {"company_name": 1, "category": 1, "vendor_code": 1}
        ).sort("company_name", 1)
        return [
            {
                "_id": str(d["_id"]),
                "company_name": d.get("company_name", "Unknown"),
                "category": d.get("category", ""),
                "vendor_code": d.get("vendor_code", ""),
            }
            for d in docs
        ]
    except Exception as exc:
        logger.error("Error fetching vendors for select: %s", exc)
        return []
