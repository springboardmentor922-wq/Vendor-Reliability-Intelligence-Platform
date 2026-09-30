"""
services/procurement_service.py
--------------------------------
Procurement request and purchase order service — full workflow implementation.

Workflow:
  Procurement Manager → Raise PR → Approve → Assign Vendor → Vendor Accepts/Rejects
  → Create PO (only after Vendor Accepts) → Invoice Auto-Created → Finance Officer Verifies
"""

import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple

from bson import ObjectId

from database.connection import get_database
from models.procurement import ProcurementRequest, procurement_from_mongo
from models.purchase_order import PurchaseOrder, po_from_mongo
from utils.helpers import generate_request_number, generate_po_number
from utils.logger import log_audit
from config.settings import (
    COLLECTION_PROCUREMENT_REQUESTS,
    COLLECTION_PURCHASE_ORDERS,
    COLLECTION_DELIVERIES,
)

logger = logging.getLogger(__name__)


# ── Procurement Requests ──────────────────────────────────────────────────────

def create_procurement_request(
    requested_by: str,
    department: str,
    items: List[dict],
    estimated_cost: float,
    priority: str = "Medium",
    justification: Optional[str] = None,
    required_by_date: Optional[datetime] = None,
    product_name: Optional[str] = None,
    category: Optional[str] = None,
    quantity: Optional[float] = None,
    unit_price: Optional[float] = None,
    # Expected budget breakdown (preserved for Finance verification)
    expected_unit_price: Optional[float] = None,
    expected_quantity: Optional[float] = None,
    expected_subtotal: float = 0.0,
    expected_tax: float = 0.0,
    expected_discount: float = 0.0,
    expected_shipping: float = 0.0,
    expected_other_charges: float = 0.0,
    expected_grand_total: float = 0.0,
) -> Tuple[bool, str, Optional[Dict]]:
    """Create a new procurement request. Initial status: Pending."""
    request_number = generate_request_number()
    pr = ProcurementRequest(
        request_number=request_number,
        requested_by=requested_by,
        department=department,
        items=items,
        estimated_cost=estimated_cost,
        priority=priority,
        justification=justification,
        required_by_date=required_by_date,
        product_name=product_name,
        category=category,
        quantity=quantity,
        unit_price=unit_price,
        # Store expected budget breakdown
        expected_unit_price=expected_unit_price or unit_price or 0.0,
        expected_quantity=expected_quantity or quantity or 0.0,
        expected_subtotal=expected_subtotal or estimated_cost,
        expected_tax=expected_tax,
        expected_discount=expected_discount,
        expected_shipping=expected_shipping,
        expected_other_charges=expected_other_charges,
        expected_grand_total=expected_grand_total or estimated_cost,
        status="Pending",
    )
    try:
        db = get_database()
        result = db[COLLECTION_PROCUREMENT_REQUESTS].insert_one(pr.to_mongo_doc())
        pr_id = str(result.inserted_id)
        log_audit(requested_by, "CREATE_PR", "ProcurementRequest", pr_id,
                  {"request_number": request_number})
        # Notify Procurement Managers AND Vendor Manager about new PR
        try:
            from services.notification_service import notify_users_by_role
            cat_display = category or "Not specified"
            _pr_msg = (
                f"New procurement request {request_number} raised for {department}. "
                f"Vendor Category: {cat_display}. "
                f"Estimated cost: USD {estimated_cost:,.2f}. "
                f"Awaiting approval then vendor assignment."
            )
            # Procurement Manager — for approval
            notify_users_by_role(
                role="Procurement Manager",
                title=f"New Procurement Request: {request_number}",
                message=_pr_msg,
                notification_type="procurement_approval",
                reference_id=pr_id,
                reference_entity="ProcurementRequest",
            )
            # Vendor Manager — so they know a request is coming for their category
            notify_users_by_role(
                role="Vendor Manager",
                title=f"New Procurement Request Raised: {request_number}",
                message=(
                    f"A new procurement request ({request_number}) has been raised and requires "
                    f"vendor assignment under category: {cat_display}. "
                    f"It will appear in Procurement Request Approval once approved."
                ),
                notification_type="procurement_approval",
                reference_id=pr_id,
                reference_entity="ProcurementRequest",
            )
        except Exception:
            pass  # Notifications are non-blocking
        doc = pr.to_mongo_doc()
        doc["_id"] = pr_id
        return True, f"Procurement request {request_number} created.", doc
    except Exception as exc:
        logger.error("PR creation failed: %s", exc)
        return False, "Failed to create procurement request.", None


def get_procurement_requests(
    status: Optional[str] = None,
    requested_by: Optional[str] = None,
) -> List[Dict]:
    """Return procurement requests with optional filters."""
    try:
        db = get_database()
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        if requested_by:
            query["requested_by"] = requested_by
        docs = db[COLLECTION_PROCUREMENT_REQUESTS].find(query).sort("created_at", -1)
        return [procurement_from_mongo(d) for d in docs]
    except Exception as exc:
        logger.error("Error fetching PRs: %s", exc)
        return []


def get_procurement_stats() -> Dict[str, int]:
    """Dashboard KPI aggregation for procurement requests."""
    try:
        db = get_database()
        col = db[COLLECTION_PROCUREMENT_REQUESTS]
        return {
            "total": col.count_documents({}),
            "pending": col.count_documents({"status": "Pending"}),
            "draft": col.count_documents({"status": "Draft"}),
            "submitted": col.count_documents({"status": "Submitted"}),
            "under_review": col.count_documents({"status": "Under Review"}),
            "approved": col.count_documents({"status": "Approved"}),
            "vendor_assigned": col.count_documents({"status": "Vendor Assigned"}),
            "vendor_accepted": col.count_documents({"vendor_response_status": "Accepted"}),
            "vendor_rejected": col.count_documents({"vendor_response_status": "Rejected"}),
            "rejected": col.count_documents({"status": "Rejected"}),
            "ordered": col.count_documents({"status": "Ordered"}),
            "completed": col.count_documents({"status": "Completed"}),
        }
    except Exception as exc:
        logger.error("Error getting procurement stats: %s", exc)
        return {}


def get_procurement_requests_paginated(
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    requested_by: Optional[str] = None,
    search: Optional[str] = None,
    vendor_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Server-side paginated procurement requests."""
    try:
        db = get_database()
        col = db[COLLECTION_PROCUREMENT_REQUESTS]
        query: Dict[str, Any] = {}
        if status and status != "All":
            query["status"] = status
        if requested_by:
            query["requested_by"] = requested_by
        if vendor_id:
            query["vendor_id"] = vendor_id
        if search:
            s = search.strip()
            query["$or"] = [
                {"request_number": {"$regex": s, "$options": "i"}},
                {"department": {"$regex": s, "$options": "i"}},
                {"product_name": {"$regex": s, "$options": "i"}},
            ]
        total = col.count_documents(query)
        total_pages = max(1, (total + page_size - 1) // page_size)
        page = max(1, min(page, total_pages))
        skip = (page - 1) * page_size
        docs = list(col.find(query).sort("created_at", -1).skip(skip).limit(page_size))
        items = [procurement_from_mongo(d) for d in docs]
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        }
    except Exception as exc:
        logger.error("Error in get_procurement_requests_paginated: %s", exc)
        return {"items": [], "total": 0, "page": 1, "page_size": page_size, "total_pages": 1, "has_next": False, "has_prev": False}


def get_recent_procurement_requests(limit: int = 5) -> List[Dict]:
    """Return most recent procurement requests for dashboard."""
    try:
        db = get_database()
        docs = list(
            db[COLLECTION_PROCUREMENT_REQUESTS]
            .find({})
            .sort("created_at", -1)
            .limit(limit)
        )
        return [procurement_from_mongo(d) for d in docs]
    except Exception as exc:
        logger.error("Error getting recent PRs: %s", exc)
        return []


def get_recent_purchase_orders(limit: int = 5) -> List[Dict]:
    """Return most recent purchase orders for dashboard."""
    try:
        db = get_database()
        docs = list(
            db[COLLECTION_PURCHASE_ORDERS]
            .find({})
            .sort("created_at", -1)
            .limit(limit)
        )
        return [po_from_mongo(d) for d in docs]
    except Exception as exc:
        logger.error("Error getting recent POs: %s", exc)
        return []


def get_po_by_request_id(request_id: str) -> Optional[Dict]:
    """Return the purchase order linked to a procurement request."""
    try:
        db = get_database()
        doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"request_id": request_id})
        return po_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("Error fetching PO for request %s: %s", request_id, exc)
        return None


def get_pos_by_vendor(vendor_id: str, limit: int = 10) -> List[Dict]:
    """Return purchase orders for a specific vendor."""
    try:
        db = get_database()
        docs = list(
            db[COLLECTION_PURCHASE_ORDERS]
            .find({"vendor_id": vendor_id})
            .sort("created_at", -1)
            .limit(limit)
        )
        return [po_from_mongo(d) for d in docs]
    except Exception as exc:
        logger.error("Error fetching POs for vendor %s: %s", vendor_id, exc)
        return []


def get_prs_by_vendor(vendor_id: str, limit: int = 50) -> List[Dict]:
    """Return procurement requests assigned to a specific vendor."""
    try:
        db = get_database()
        docs = list(
            db[COLLECTION_PROCUREMENT_REQUESTS]
            .find({"vendor_id": vendor_id})
            .sort("created_at", -1)
            .limit(limit)
        )
        return [procurement_from_mongo(d) for d in docs]
    except Exception as exc:
        logger.error("Error fetching PRs for vendor %s: %s", vendor_id, exc)
        return []


def get_prs_awaiting_vendor_response(vendor_id: str) -> List[Dict]:
    """Return PRs assigned to vendor that are awaiting accept/reject."""
    try:
        db = get_database()
        docs = list(
            db[COLLECTION_PROCUREMENT_REQUESTS]
            .find({
                "vendor_id": vendor_id,
                "vendor_response_status": {"$in": [None, "Pending"]},
                "status": {"$in": ["Approved", "Vendor Assigned"]},
            })
            .sort("created_at", -1)
        )
        return [procurement_from_mongo(d) for d in docs]
    except Exception as exc:
        logger.error("Error fetching PRs awaiting vendor response: %s", exc)
        return []


def get_prs_for_vendor_manager(category: Optional[str] = None, limit: int = 100) -> List[Dict]:
    """
    Return procurement requests relevant to the Vendor Manager view.

    Shows PRs that are in any status that the VM needs to act on or track:
      - Pending         → just raised by PM, visible to VM for awareness
      - Approved        → ready for vendor assignment
      - Vendor Assigned → assigned, pending VM acceptance
      - Vendor Accepted → confirmed, PO can be raised
      - Vendor Rejected → vendor declined, re-assignment needed

    If `category` is specified, filters by that category.
    If `category` is None, returns PRs for all 6 canonical categories.
    Ordered newest first.
    """
    from config.settings import VENDOR_CATEGORIES as _CANONICAL_CATS
    try:
        db = get_database()
        query: Dict[str, Any] = {
            "status": {"$in": [
                "Pending",
                "Approved",
                "Vendor Assigned",
                "Vendor Accepted",
                "Vendor Rejected",
            ]},
        }
        if category and category != "All":
            query["category"] = category
        else:
            query["category"] = {"$in": list(_CANONICAL_CATS)}

        docs = list(
            db[COLLECTION_PROCUREMENT_REQUESTS]
            .find(query)
            .sort("created_at", -1)
            .limit(limit)
        )
        return [procurement_from_mongo(d) for d in docs]
    except Exception as exc:
        logger.error("Error fetching PRs for vendor manager: %s", exc)
        return []


def get_all_prs_for_vendor_manager() -> Dict[str, List[Dict]]:
    """
    Return PRs grouped by canonical vendor category, for the Vendor Manager view.
    Returns a dict: {category_name: [pr, ...]}
    All 6 categories are always present as keys (may have empty lists).

    Includes ALL statuses relevant to the VM: Pending, Approved,
    Vendor Assigned, Vendor Accepted, Vendor Rejected.
    """
    from config.settings import VENDOR_CATEGORIES as _CANONICAL_CATS
    grouped: Dict[str, List[Dict]] = {cat: [] for cat in _CANONICAL_CATS}
    try:
        db = get_database()
        docs = list(
            db[COLLECTION_PROCUREMENT_REQUESTS]
            .find({
                "status": {"$in": [
                    "Pending",
                    "Approved",
                    "Vendor Assigned",
                    "Vendor Accepted",
                    "Vendor Rejected",
                ]},
                "category": {"$in": list(_CANONICAL_CATS)},
            })
            .sort("created_at", -1)
            .limit(200)
        )
        for d in docs:
            cat = d.get("category", "")
            if cat in grouped:
                grouped[cat].append(procurement_from_mongo(d))
    except Exception as exc:
        logger.error("Error in get_all_prs_for_vendor_manager: %s", exc)
    return grouped




# ── Procurement Request Workflow Actions ──────────────────────────────────────

def approve_procurement_request(pr_id: str, approved_by: str) -> Tuple[bool, str]:
    """Approve a pending procurement request. Status → Approved."""
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
        # Notify the requester
        try:
            pr_doc2 = db[COLLECTION_PROCUREMENT_REQUESTS].find_one({"_id": ObjectId(pr_id)}, {"requested_by": 1, "request_number": 1})
            if pr_doc2 and pr_doc2.get("requested_by"):
                from services.notification_service import create_typed_notification
                create_typed_notification(
                    user_id=pr_doc2["requested_by"],
                    notif_type="procurement_approval",
                    title=f"PR Approved: {pr_doc2.get('request_number', pr_id)}",
                    message="Your procurement request has been approved and is now ready for vendor assignment.",
                    reference_id=pr_id, reference_entity="ProcurementRequest",
                )
        except Exception:
            pass
        return True, "Procurement request approved."
    except Exception as exc:
        logger.error("PR approval failed: %s", exc)
        return False, "Failed to approve procurement request."


def reject_procurement_request(pr_id: str, rejected_by: str, reason: str = "") -> Tuple[bool, str]:
    """Reject a procurement request. Status → Rejected."""
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


def assign_vendor_to_pr(pr_id: str, vendor_id: str, assigned_by: str, vendor_name: str = "") -> Tuple[bool, str]:
    """
    Assign an approved vendor to a procurement request.
    Sets status to 'Vendor Assigned' and vendor_response_status to 'Pending'.
    Only call after PR is Approved.
    """
    try:
        db = get_database()
        pr_doc = db[COLLECTION_PROCUREMENT_REQUESTS].find_one({"_id": ObjectId(pr_id)})
        if not pr_doc:
            return False, "Procurement request not found."
        if pr_doc.get("status") not in ("Approved", "Vendor Assigned", "Vendor Rejected"):
            return False, "Vendor can only be assigned to an Approved procurement request."

        result = db[COLLECTION_PROCUREMENT_REQUESTS].update_one(
            {"_id": ObjectId(pr_id)},
            {"$set": {
                "vendor_id": vendor_id,
                "assigned_vendor_name": vendor_name,
                "assigned_by": assigned_by,
                "assigned_at": datetime.now(timezone.utc),
                "status": "Vendor Assigned",
                "vendor_response_status": "Pending",
                "vendor_response_date": None,
                "vendor_rejection_reason": None,
                "vendor_response_by": None,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            return False, "Procurement request not found."
        log_audit(assigned_by, "ASSIGN_VENDOR_PR", "ProcurementRequest", pr_id,
                  {"vendor_id": vendor_id, "vendor_name": vendor_name})
        # Notify the assigned vendor + Vendor Manager about assignment
        try:
            from services.notification_service import notify_users_by_role, create_typed_notification
            from config.settings import COLLECTION_USERS
            pr_num_disp = pr_doc.get("request_number", pr_id[:8])
            cat_disp    = pr_doc.get("category", "Not specified")
            prod_disp   = pr_doc.get("product_name") or pr_doc.get("title") or "See request details"
            qty_disp    = str(pr_doc.get("quantity") or "N/A")
            _assign_msg = (
                f"Procurement request {pr_num_disp} has been assigned to you.\n"
                f"Category: {cat_disp} | Product/Service: {prod_disp} | Quantity: {qty_disp}.\n"
                f"Please review and Accept or Reject this assignment."
            )
            # Notify vendor users linked to this vendor_id
            vendor_users = list(db[COLLECTION_USERS].find({"vendor_id": vendor_id}, {"_id": 1}))
            if vendor_users:
                for vu in vendor_users:
                    create_typed_notification(
                        user_id=str(vu["_id"]),
                        notif_type="vendor_assignment",
                        title=f"New Procurement Request Assigned: {pr_num_disp}",
                        message=_assign_msg,
                        reference_id=pr_id,
                        reference_entity="ProcurementRequest",
                    )
            else:
                # Fallback: broadcast to all Vendor role users
                notify_users_by_role(
                    role="Vendor",
                    title=f"New Procurement Request Assigned: {pr_num_disp}",
                    message=_assign_msg,
                    notification_type="vendor_assignment",
                    reference_id=pr_id,
                    reference_entity="ProcurementRequest",
                )
            # Also notify Vendor Manager (assignment status tracking)
            notify_users_by_role(
                role="Vendor Manager",
                title=f"Vendor Assigned to {pr_num_disp}",
                message=(
                    f"{vendor_name} has been assigned to procurement request {pr_num_disp} "
                    f"(Category: {cat_disp}). Status: Pending Vendor Acceptance."
                ),
                notification_type="vendor_assignment",
                reference_id=pr_id,
                reference_entity="ProcurementRequest",
            )
        except Exception:
            pass
        return True, f"Vendor assigned. Awaiting vendor acceptance."
    except Exception as exc:
        logger.error("PR vendor assign failed: %s", exc)
        return False, "Failed to assign vendor."


def vm_accept_vendor_assignment(pr_id: str, accepted_by: str) -> Tuple[bool, str]:
    """
    Vendor Manager accepts/confirms the vendor assignment on behalf of the process.

    This is the internal acceptance step performed by the Vendor Manager role:
      - Confirms the assigned vendor is the right choice for this PR
      - Sets status to 'Vendor Accepted' and vendor_response_status to 'Accepted'
      - Enables the Procurement Manager to create a Purchase Order

    Unlike vendor_accept_pr (which requires the Vendor user to be logged in),
    this function is called by the Vendor Manager (internal staff) to confirm
    the assignment is approved and ready for PO creation.
    """
    try:
        db = get_database()
        pr_doc = db[COLLECTION_PROCUREMENT_REQUESTS].find_one({"_id": ObjectId(pr_id)})
        if not pr_doc:
            return False, "Procurement request not found."
        if pr_doc.get("status") != "Vendor Assigned":
            current = pr_doc.get("status", "Unknown")
            return False, f"Only 'Vendor Assigned' requests can be accepted. Current status: {current}."
        if not pr_doc.get("vendor_id"):
            return False, "No vendor is assigned to this request yet."

        now = datetime.now(timezone.utc)
        result = db[COLLECTION_PROCUREMENT_REQUESTS].update_one(
            {"_id": ObjectId(pr_id)},
            {"$set": {
                "status": "Vendor Accepted",
                "vendor_response_status": "Accepted",
                "vendor_response_date": now,
                "vendor_response_by": accepted_by,
                "vm_accepted_by": accepted_by,
                "vm_accepted_at": now,
                "updated_at": now,
            }},
        )
        if result.matched_count == 0:
            return False, "Procurement request not found."

        vendor_name = pr_doc.get("assigned_vendor_name", "the assigned vendor")
        log_audit(accepted_by, "VM_ACCEPT_VENDOR_ASSIGNMENT", "ProcurementRequest", pr_id,
                  {"vendor_name": vendor_name, "accepted_by": accepted_by})

        # Notify PM + SCM + Vendor Manager that VM has confirmed the assignment
        try:
            from services.notification_service import notify_users_by_role
            pr_num_disp = pr_doc.get("request_number", pr_id[:8])
            cat_disp    = pr_doc.get("category", "")
            _vm_acc_msg = (
                f"Vendor Manager confirmed assignment of {vendor_name} to "
                f"procurement request {pr_num_disp} (Category: {cat_disp}). "
                f"Vendor Approved — You can proceed with Purchase Order creation."
            )
            for _role in ("Procurement Manager", "Supply Chain Manager", "Vendor Manager"):
                notify_users_by_role(
                    role=_role,
                    title=f"Vendor Approved — PO Ready: {pr_num_disp}",
                    message=_vm_acc_msg,
                    notification_type="vendor_assignment",
                    reference_id=pr_id,
                    reference_entity="ProcurementRequest",
                )
        except Exception:
            pass

        return True, f"Assignment accepted. {vendor_name} is confirmed. Procurement Manager can now create a Purchase Order."
    except Exception as exc:
        logger.error("VM accept vendor assignment failed: %s", exc)
        return False, "Failed to accept vendor assignment."


def vm_reject_vendor_assignment(
    pr_id: str,
    rejected_by: str,
    reason: str = "",
) -> Tuple[bool, str]:
    """
    Vendor Manager rejects the current vendor assignment and resets the PR
    back to 'Approved' status so a different vendor can be assigned.

    Does NOT mark the PR as Rejected — it only clears the vendor assignment
    so the Vendor Manager can select a different vendor from the same category.
    """
    try:
        db = get_database()
        pr_doc = db[COLLECTION_PROCUREMENT_REQUESTS].find_one({"_id": ObjectId(pr_id)})
        if not pr_doc:
            return False, "Procurement request not found."
        if pr_doc.get("status") != "Vendor Assigned":
            return False, "Only 'Vendor Assigned' requests can be rejected/reassigned."

        prev_vendor = pr_doc.get("assigned_vendor_name", "previous vendor")
        now = datetime.now(timezone.utc)
        result = db[COLLECTION_PROCUREMENT_REQUESTS].update_one(
            {"_id": ObjectId(pr_id)},
            {"$set": {
                "status": "Approved",              # reset → ready for re-assignment
                "vendor_id": None,
                "assigned_vendor_name": None,
                "assigned_by": None,
                "assigned_at": None,
                "vendor_response_status": None,
                "vendor_response_date": None,
                "vendor_response_by": None,
                "vm_rejection_reason": reason,
                "vm_rejected_by": rejected_by,
                "vm_rejected_at": now,
                "updated_at": now,
            }},
        )
        if result.matched_count == 0:
            return False, "Procurement request not found."

        log_audit(rejected_by, "VM_REJECT_VENDOR_ASSIGNMENT", "ProcurementRequest", pr_id,
                  {"prev_vendor": prev_vendor, "reason": reason})
        return True, f"Assignment rejected. Request is now open for re-assignment to another vendor."
    except Exception as exc:
        logger.error("VM reject vendor assignment failed: %s", exc)
        return False, "Failed to reject vendor assignment."



def vendor_accept_pr(pr_id: str, vendor_id: str, vendor_user_id: str) -> Tuple[bool, str]:
    """
    Vendor accepts a procurement request.
    Sets vendor_response_status = 'Accepted'.
    This enables PO creation by the Procurement Manager.
    """
    try:
        db = get_database()
        pr_doc = db[COLLECTION_PROCUREMENT_REQUESTS].find_one({"_id": ObjectId(pr_id)})
        if not pr_doc:
            return False, "Procurement request not found."
        if str(pr_doc.get("vendor_id") or "") != str(vendor_id or ""):
            return False, "You are not the assigned vendor for this request."
        if pr_doc.get("status") not in ("Vendor Assigned", "Approved", "Approved / Vendor Assigned"):
            return False, "This request is not in a state that allows vendor response."

        now = datetime.now(timezone.utc)
        db[COLLECTION_PROCUREMENT_REQUESTS].update_one(
            {"_id": ObjectId(pr_id)},
            {"$set": {
                "vendor_response_status": "Accepted",
                "status": "Vendor Accepted",
                "vendor_response_date": now,
                "vendor_response_by": vendor_user_id,
                "updated_at": now,
            }},
        )
        log_audit(vendor_user_id, "VENDOR_ACCEPT_PR", "ProcurementRequest", pr_id,
                  {"vendor_id": vendor_id})
        # Notify PM + SCM + Vendor Manager that vendor accepted
        try:
            from services.notification_service import notify_users_by_role
            from datetime import timezone as _tz
            pr_num_disp  = pr_doc.get("request_number", pr_id[:8])
            cat_disp     = pr_doc.get("category", "")
            v_name_disp  = pr_doc.get("assigned_vendor_name", "Assigned vendor")
            accepted_ts  = now.strftime("%Y-%m-%d %H:%M UTC")
            _va_msg = (
                f"Vendor Approved — You can proceed with Purchase Order.\n"
                f"Request: {pr_num_disp} | Vendor: {v_name_disp} | "
                f"Category: {cat_disp} | Accepted: {accepted_ts}."
            )
            for _role in ("Procurement Manager", "Supply Chain Manager", "Vendor Manager"):
                notify_users_by_role(
                    role=_role,
                    title=f"Vendor Accepted — PO Ready: {pr_num_disp}",
                    message=_va_msg,
                    notification_type="vendor_assignment",
                    reference_id=pr_id,
                    reference_entity="ProcurementRequest",
                )
        except Exception:
            pass
        return True, "You have accepted this procurement request. The Procurement Manager can now create a Purchase Order."
    except Exception as exc:
        logger.error("Vendor accept PR failed: %s", exc)
        return False, "Failed to accept request."


def vendor_reject_pr(pr_id: str, vendor_id: str, vendor_user_id: str, reason: str = "") -> Tuple[bool, str]:
    """
    Vendor rejects a procurement request.
    Sets vendor_response_status = 'Rejected'.
    Procurement Manager must assign another vendor.
    """
    try:
        db = get_database()
        pr_doc = db[COLLECTION_PROCUREMENT_REQUESTS].find_one({"_id": ObjectId(pr_id)})
        if not pr_doc:
            return False, "Procurement request not found."
        if str(pr_doc.get("vendor_id") or "") != str(vendor_id or ""):
            return False, "You are not the assigned vendor for this request."

        now = datetime.now(timezone.utc)
        db[COLLECTION_PROCUREMENT_REQUESTS].update_one(
            {"_id": ObjectId(pr_id)},
            {"$set": {
                "vendor_response_status": "Rejected",
                "vendor_rejection_reason": reason,
                "vendor_response_date": now,
                "vendor_response_by": vendor_user_id,
                "status": "Vendor Rejected",
                "updated_at": now,
            }},
        )
        log_audit(vendor_user_id, "VENDOR_REJECT_PR", "ProcurementRequest", pr_id,
                  {"vendor_id": vendor_id, "reason": reason})
        # Notify PM + Vendor Manager that vendor rejected
        try:
            from services.notification_service import notify_users_by_role
            pr_num_disp = pr_doc.get("request_number", pr_id[:8])
            v_name_disp = pr_doc.get("assigned_vendor_name", "Assigned vendor")
            cat_disp    = pr_doc.get("category", "")
            _vr_msg = (
                f"Vendor Rejected procurement request {pr_num_disp}.\n"
                f"Vendor: {v_name_disp} | Category: {cat_disp}.\n"
                f"Reason: {reason or 'Not specified'}.\n"
                f"Please assign an alternative vendor from the same category."
            )
            for _role in ("Procurement Manager", "Vendor Manager"):
                notify_users_by_role(
                    role=_role,
                    title=f"Vendor Rejected Request: {pr_num_disp}",
                    message=_vr_msg,
                    notification_type="vendor_assignment",
                    reference_id=pr_id,
                    reference_entity="ProcurementRequest",
                )
        except Exception:
            pass
        return True, "You have rejected this procurement request. The Procurement Manager will be notified."
    except Exception as exc:
        logger.error("Vendor reject PR failed: %s", exc)
        return False, "Failed to reject request."


def get_procurement_request_by_id(pr_id: str) -> Optional[Dict]:
    """Retrieve a single procurement request by ID."""
    try:
        db = get_database()
        doc = db[COLLECTION_PROCUREMENT_REQUESTS].find_one({"_id": ObjectId(pr_id)})
        return procurement_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("Error fetching PR %s: %s", pr_id, exc)
        return None


# ── Purchase Orders ───────────────────────────────────────────────────────────

def create_purchase_order(
    vendor_id: str,
    items: List[dict],
    total_amount: float,
    created_by: str,
    request_id: Optional[str] = None,
    expected_delivery_date: Optional[datetime] = None,
    notes: Optional[str] = None,
    vendor_name: Optional[str] = None,
    product_name: Optional[str] = None,
    category: Optional[str] = None,
    quantity: Optional[float] = None,
    unit_price: Optional[float] = None,
    procurement_request_number: Optional[str] = None,
) -> Tuple[bool, str, Optional[Dict]]:
    """
    Create a new purchase order (basic version, no vendor-acceptance validation).
    For the validated workflow, use create_purchase_order_validated().
    """
    po_number = generate_po_number()
    po = PurchaseOrder(
        po_number=po_number,
        vendor_id=vendor_id,
        vendor_name=vendor_name or "",
        request_id=request_id,
        procurement_request_number=procurement_request_number,
        items=items,
        total_amount=total_amount,
        expected_delivery_date=expected_delivery_date,
        created_by=created_by,
        notes=notes,
        product_name=product_name,
        category=category,
        quantity=quantity,
        unit_price=unit_price,
        status="Pending",
        vendor_acceptance_status="Accepted",
    )
    try:
        db = get_database()
        result = db[COLLECTION_PURCHASE_ORDERS].insert_one(po.to_mongo_doc())
        po_id = str(result.inserted_id)
        log_audit(created_by, "CREATE_PO", "PurchaseOrder", po_id,
                  {"po_number": po_number, "vendor_id": vendor_id})
        doc = po.to_mongo_doc()
        doc["_id"] = po_id
        # Notify assigned vendor + Supply Chain Manager about new PO
        try:
            from services.notification_service import notify_users_by_role, create_typed_notification
            from config.settings import COLLECTION_USERS as _COLL_USERS
            _po_msg_scm = (
                f"Purchase Order {po_number} created for {vendor_name or 'vendor'}. "
                f"Total: USD {total_amount:,.2f}. Awaiting supply chain coordination."
            )
            notify_users_by_role(
                role="Supply Chain Manager",
                title=f"New Purchase Order: {po_number}",
                message=_po_msg_scm,
                notification_type="po_update",
                reference_id=po_id,
                reference_entity="PurchaseOrder",
            )
            # Notify the vendor directly
            if vendor_id:
                _po_msg_vendor = (
                    f"New Purchase Order Generated — Review Required.\n"
                    f"PO Number: {po_number} | Amount: USD {total_amount:,.2f}.\n"
                    f"Please review the purchase order and prepare for delivery."
                )
                v_users = list(db[_COLL_USERS].find({"vendor_id": vendor_id}, {"_id": 1}))
                for _vu in v_users:
                    create_typed_notification(
                        user_id=str(_vu["_id"]),
                        notif_type="po_update",
                        title=f"New Purchase Order: {po_number}",
                        message=_po_msg_vendor,
                        reference_id=po_id,
                        reference_entity="PurchaseOrder",
                    )
        except Exception:
            pass
        return True, f"Purchase order {po_number} created.", doc
    except Exception as exc:
        logger.error("PO creation failed: %s", exc)
        return False, "Failed to create purchase order.", None


def create_purchase_order_validated(
    pr_id: str,
    created_by: str,
    expected_delivery_date: Optional[datetime] = None,
    notes: Optional[str] = None,
    unit_price: Optional[float] = None,
    tax_amount: float = 0.0,
    discount_amount: float = 0.0,
    shipping_freight: float = 0.0,
    other_charges: float = 0.0,
) -> Tuple[bool, str, Optional[Dict]]:
    """
    Create a PO from an approved PR — enforces vendor acceptance requirement.

    Business rules (enforced in backend):
      1. PR must be Approved or Vendor Assigned status
      2. PR must have a vendor assigned (vendor_id)
      3. vendor_response_status must be 'Accepted'

    Accepts financial breakdown fields (tax, discount, shipping, other_charges)
    from the PO creation form. These are stored in the PO and used for Finance
    3-way verification: REQUEST vs PO vs INVOICE.

    Auto-creates an Invoice after PO creation.
    """
    try:
        db = get_database()
        pr_doc = db[COLLECTION_PROCUREMENT_REQUESTS].find_one({"_id": ObjectId(pr_id)})
        if not pr_doc:
            return False, "Procurement request not found.", None

        # ── Backend validation (Prompt Section 6 rule) ───────────────────────
        vendor_response = pr_doc.get("vendor_response_status", "")
        if vendor_response != "Accepted":
            return (
                False,
                "Purchase Order cannot be created until the assigned vendor accepts the procurement request.",
                None,
            )

        vendor_id = pr_doc.get("vendor_id", "")
        if not vendor_id:
            return (
                False,
                "Purchase Order cannot be created until the assigned vendor accepts the procurement request.",
                None,
            )

        pr_status = pr_doc.get("status", "")
        if pr_status not in ("Approved", "Vendor Assigned", "Vendor Accepted"):
            return False, f"Purchase Order cannot be created. Procurement Request status is '{pr_status}'.", None

        # ── Existing PO check ────────────────────────────────────────────────
        existing_po = db[COLLECTION_PURCHASE_ORDERS].find_one({"request_id": pr_id})
        if existing_po:
            return False, f"A Purchase Order already exists for this request: {existing_po.get('po_number')}.", None

        # ── Build PO ─────────────────────────────────────────────────────────
        po_number = generate_po_number()
        vendor_name = pr_doc.get("assigned_vendor_name", "")
        product_name = pr_doc.get("product_name") or pr_doc.get("title") or "Item"
        category = pr_doc.get("category") or "General"
        items = pr_doc.get("items", [])
        quantity = float(pr_doc.get("quantity") or 1.0)
        total_amount = float(pr_doc.get("estimated_cost") or pr_doc.get("estimated_budget") or 0.0)
        eff_unit_price = unit_price or pr_doc.get("unit_price") or (total_amount / quantity if quantity and total_amount > 0 else 0.0)
        if eff_unit_price and quantity and total_amount == 0.0:
            total_amount = round(eff_unit_price * quantity, 2)

        # ── Compute final grand total ─────────────────────────────────────────
        subtotal = round(float(eff_unit_price or 0) * quantity, 2)
        tax_f     = round(float(tax_amount), 2)
        disc_f    = round(float(discount_amount), 2)
        ship_f    = round(float(shipping_freight), 2)
        other_f   = round(float(other_charges), 2)
        grand_total = round(subtotal + tax_f - disc_f + ship_f + other_f, 2)
        if grand_total == 0.0:
            grand_total = total_amount

        # ── PR Snapshot: Immutable baseline captured at PO creation ──────────
        # Stores the ORIGINAL approved requisition values that were pre-filled
        # into the PO form.  Finance comparison uses this as the source-of-truth
        # for the Requisition → PO leg.  Never mutated after this point.
        pr_grand_expected = float(
            pr_doc.get("expected_grand_total") or pr_doc.get("estimated_cost") or grand_total
        )
        pr_subtotal_expected = float(pr_doc.get("expected_subtotal") or 0)
        if pr_subtotal_expected <= 0:
            pr_subtotal_expected = round(
                float(pr_doc.get("expected_quantity") or quantity) *
                float(pr_doc.get("expected_unit_price") or eff_unit_price), 2
            )
        pr_snapshot = {
            "pr_id": pr_id,
            "request_number": pr_doc.get("request_number"),
            "product_name": product_name,
            "quantity": quantity,
            "unit_price": float(pr_doc.get("expected_unit_price") or eff_unit_price),
            "subtotal": pr_subtotal_expected,
            "tax_amount": float(pr_doc.get("expected_tax") or 0),
            "discount_amount": float(pr_doc.get("expected_discount") or 0),
            "shipping_freight": float(pr_doc.get("expected_shipping") or 0),
            "other_charges": float(pr_doc.get("expected_other_charges") or 0),
            "grand_total": pr_grand_expected,
            "has_expected_data": bool(
                pr_doc.get("expected_grand_total") or pr_doc.get("expected_unit_price")
            ),
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "captured_by": created_by,
        }

        # ── PO actual values snapshot (for audit trail) ───────────────────────
        po_snapshot = {
            "quantity": quantity,
            "unit_price": float(eff_unit_price or 0),
            "subtotal": subtotal,
            "tax_amount": tax_f,
            "discount_amount": disc_f,
            "shipping_freight": ship_f,
            "other_charges": other_f,
            "grand_total": grand_total,
        }

        # Detect if any PO values differ from the PR snapshot (procurement changes)
        pr_po_changes = {}
        tol = 0.01
        for field in ("quantity", "unit_price", "tax_amount", "discount_amount",
                      "shipping_freight", "other_charges", "grand_total"):
            pr_val = pr_snapshot.get(field, 0)
            po_val = po_snapshot.get(field, 0)
            if abs(float(pr_val or 0) - float(po_val or 0)) > tol:
                pr_po_changes[field] = {"pr_value": pr_val, "po_value": po_val,
                                        "diff": round(float(po_val or 0) - float(pr_val or 0), 4)}

        po = PurchaseOrder(
            po_number=po_number,
            vendor_id=vendor_id,
            vendor_name=vendor_name,
            request_id=pr_id,
            procurement_request_number=pr_doc.get("request_number"),
            items=items,
            total_amount=grand_total,
            expected_delivery_date=expected_delivery_date,
            created_by=created_by,
            notes=notes,
            product_name=product_name,
            category=category,
            quantity=quantity,
            unit_price=eff_unit_price,
            subtotal=subtotal,
            tax_amount=tax_f,
            discount_amount=disc_f,
            shipping_freight=ship_f,
            other_charges=other_f,
            grand_total=grand_total,
            status="Pending",
            vendor_acceptance_status="Accepted",
        )

        po_doc = po.to_mongo_doc()
        # Embed the immutable PR snapshot directly in the PO document
        po_doc["pr_snapshot"] = pr_snapshot
        po_doc["pr_po_changes_at_creation"] = pr_po_changes  # empty dict = unchanged

        result = db[COLLECTION_PURCHASE_ORDERS].insert_one(po_doc)
        po_id = str(result.inserted_id)
        po_doc["_id"] = po_id

        log_audit(created_by, "CREATE_PO_VALIDATED", "PurchaseOrder", po_id,
                  {"po_number": po_number, "pr_id": pr_id, "vendor_id": vendor_id,
                   "grand_total": grand_total, "pr_snapshot": pr_snapshot,
                   "po_snapshot": po_snapshot, "pr_po_changes": pr_po_changes})

        # ── Auto-create Invoice ───────────────────────────────────────────────
        try:
            from services.invoice_service import create_invoice_for_po
            create_invoice_for_po(po_id, po_doc, created_by=created_by)
        except Exception as inv_exc:
            logger.warning("Invoice auto-creation failed (non-fatal): %s", inv_exc)

        return True, f"Purchase order {po_number} created successfully.", po_doc

    except Exception as exc:
        logger.error("PO validated creation failed: %s", exc)
        return False, "Failed to create purchase order.", None


def get_purchase_orders(
    status: Optional[str] = None,
    vendor_id: Optional[str] = None,
    payment_status: Optional[str] = None,
    limit: Optional[int] = 50,
) -> List[Dict]:
    """Return purchase orders with optional filters and database-level limit."""
    try:
        db = get_database()
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        if vendor_id:
            query["vendor_id"] = vendor_id
        if payment_status:
            query["payment_status"] = payment_status
        cursor = db[COLLECTION_PURCHASE_ORDERS].find(query).sort("created_at", -1)
        if limit and limit > 0:
            cursor = cursor.limit(limit)
        return [po_from_mongo(d) for d in cursor]
    except Exception as exc:
        logger.error("Error fetching POs: %s", exc)
        return []


def get_purchase_order_by_id(po_id: str) -> Optional[Dict]:
    """Retrieve a single purchase order by ID (ObjectId or str)."""
    try:
        db = get_database()
        try:
            doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": ObjectId(po_id)})
        except Exception:
            doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": po_id})
        return po_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("Error fetching PO %s: %s", po_id, exc)
        return None



def get_po_stats() -> Dict[str, int]:
    """Dashboard KPI aggregation for purchase orders."""
    try:
        db = get_database()
        col = db[COLLECTION_PURCHASE_ORDERS]
        return {
            "total": col.count_documents({}),
            "active": col.count_documents({"status": {"$in": ["Pending", "Approved", "Ordered"]}}),
            "delivered": col.count_documents({"status": "Delivered"}),
            "pending": col.count_documents({"status": "Pending"}),
            "cancelled": col.count_documents({"status": "Cancelled"}),
            "completed": col.count_documents({"status": "Completed"}),
        }
    except Exception as exc:
        logger.error("Error getting PO stats: %s", exc)
        return {}


def get_po_spend_by_month(limit_months: int = 12) -> Dict[str, list]:
    """Aggregate monthly procurement spend from purchase orders."""
    try:
        db = get_database()
        col = db[COLLECTION_PURCHASE_ORDERS]
        pipeline = [
            {"$match": {"order_date": {"$ne": None}, "total_amount": {"$gt": 0}}},
            {"$group": {
                "_id": {
                    "year": {"$year": "$order_date"},
                    "month": {"$month": "$order_date"},
                },
                "total_spend": {"$sum": "$total_amount"},
            }},
            {"$sort": {"_id.year": 1, "_id.month": 1}},
            {"$limit": limit_months},
        ]
        results = list(col.aggregate(pipeline))
        if not results:
            return {"months": [], "values": []}

        import calendar
        months = []
        values = []
        for r in results:
            month_name = calendar.month_abbr[r["_id"]["month"]]
            year_short = str(r["_id"]["year"])[2:]
            months.append(f"{month_name} '{year_short}")
            values.append(round(r["total_spend"], 2))
        return {"months": months, "values": values}
    except Exception as exc:
        logger.error("Error getting spend by month: %s", exc)
        return {"months": [], "values": []}


def get_po_status_distribution() -> Dict[str, int]:
    """Get count of POs per status for chart display."""
    try:
        db = get_database()
        col = db[COLLECTION_PURCHASE_ORDERS]
        pipeline = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        results = list(col.aggregate(pipeline))
        return {r["_id"]: r["count"] for r in results if r["_id"]}
    except Exception as exc:
        logger.error("Error getting PO status distribution: %s", exc)
        return {}


def get_delivery_stats() -> Dict[str, Any]:
    """Aggregate delivery performance stats."""
    try:
        db = get_database()
        from config.settings import COLLECTION_DELIVERIES
        col = db[COLLECTION_DELIVERIES]
        total = col.count_documents({})
        delivered = col.count_documents({"status": "Delivered"})
        pending = col.count_documents({"status": "Pending"})
        partially = col.count_documents({"status": "Partially Delivered"})
        return {
            "total": total,
            "delivered": delivered,
            "pending": pending,
            "partially_delivered": partially,
        }
    except Exception as exc:
        logger.error("Error getting delivery stats: %s", exc)
        return {"total": 0, "delivered": 0, "pending": 0, "partially_delivered": 0}


def get_delivery_performance_by_month() -> Dict[str, list]:
    """Aggregate monthly delivery counts (delivered vs pending)."""
    try:
        db = get_database()
        from config.settings import COLLECTION_DELIVERIES
        col = db[COLLECTION_DELIVERIES]
        pipeline = [
            {"$match": {"expected_date": {"$ne": None}}},
            {"$group": {
                "_id": {
                    "year": {"$year": "$expected_date"},
                    "month": {"$month": "$expected_date"},
                    "status": "$status",
                },
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id.year": 1, "_id.month": 1}},
        ]
        results = list(col.aggregate(pipeline))
        if not results:
            return {"months": [], "delivered": [], "pending": []}

        import calendar
        monthly: Dict[str, Dict[str, int]] = {}
        for r in results:
            key = f"{calendar.month_abbr[r['_id']['month']]} '{str(r['_id']['year'])[2:]}"
            if key not in monthly:
                monthly[key] = {"delivered": 0, "pending": 0}
            status = r["_id"]["status"]
            if status == "Delivered":
                monthly[key]["delivered"] += r["count"]
            elif status in ("Pending", "Partially Delivered"):
                monthly[key]["pending"] += r["count"]

        months = list(monthly.keys())
        delivered = [monthly[m]["delivered"] for m in months]
        pending = [monthly[m]["pending"] for m in months]
        return {"months": months, "delivered": delivered, "pending": pending}
    except Exception as exc:
        logger.error("Error getting delivery performance: %s", exc)
        return {"months": [], "delivered": [], "pending": []}


def get_total_po_value() -> float:
    """Return the total procurement value across all purchase orders."""
    try:
        db = get_database()
        col = db[COLLECTION_PURCHASE_ORDERS]
        pipeline = [
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}},
        ]
        results = list(col.aggregate(pipeline))
        return results[0]["total"] if results else 0.0
    except Exception as exc:
        logger.error("Error getting total PO value: %s", exc)
        return 0.0


def get_vendor_po_summary() -> List[Dict]:
    """Get per-vendor summary of PO activity."""
    try:
        db = get_database()
        col = db[COLLECTION_PURCHASE_ORDERS]
        pipeline = [
            {"$group": {
                "_id": "$vendor_id",
                "total_pos": {"$sum": 1},
                "delivered": {"$sum": {"$cond": [{"$eq": ["$status", "Delivered"]}, 1, 0]}},
                "cancelled": {"$sum": {"$cond": [{"$eq": ["$status", "Cancelled"]}, 1, 0]}},
                "pending": {"$sum": {"$cond": [{"$eq": ["$status", "Pending"]}, 1, 0]}},
                "total_amount": {"$sum": "$total_amount"},
                "defective_units_sum": {"$sum": {"$ifNull": ["$defective_units", 0]}},
                "compliant_count": {"$sum": {"$cond": [{"$eq": ["$compliance", True]}, 1, 0]}},
            }},
            {"$sort": {"total_pos": -1}},
        ]
        return list(col.aggregate(pipeline))
    except Exception as exc:
        logger.error("Error getting vendor PO summary: %s", exc)
        return []


def approve_purchase_order(po_id: str, approved_by: str) -> Tuple[bool, str]:
    """Approve a pending purchase order. Status → Approved."""
    try:
        db = get_database()
        result = db[COLLECTION_PURCHASE_ORDERS].update_one(
            {"_id": ObjectId(po_id)},
            {"$set": {
                "status": "Approved",
                "approved_by": approved_by,
                "approved_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        if result.matched_count == 0:
            return False, "Purchase order not found."
        log_audit(approved_by, "APPROVE_PO", "PurchaseOrder", po_id, {})
        return True, "Purchase order approved."
    except Exception as exc:
        logger.error("PO approval failed: %s", exc)
        return False, "Failed to approve purchase order."


def update_po_status(po_id: str, new_status: str, updated_by: str) -> Tuple[bool, str]:
    """
    Update purchase order status.

    IMPORTANT — Delivery Sync:
    When new_status is "Delivered" or "Completed" we also upsert a delivery
    record in the deliveries collection (keyed by po_id) so that Finance's
    get_delivery_for_po() always resolves the correct, live delivery status
    from the database instead of falling back to the stale default
    "Not Dispatched".  This is the single authoritative write that keeps
    procurement PO status and Finance delivery status in sync.
    """
    try:
        db = get_database()
        now = datetime.now(timezone.utc)
        update = {
            "status": new_status,
            "updated_at": now,
        }
        if new_status in ("Delivered", "Completed"):
            update["actual_delivery_date"] = now

        # 1. Update the purchase_orders document
        po_doc = db[COLLECTION_PURCHASE_ORDERS].find_one_and_update(
            {"_id": ObjectId(po_id)},
            {"$set": update},
            return_document=True,  # Returns the updated document
        )
        if not po_doc:
            return False, "Purchase order not found."

        # 2. When delivery-complete, upsert the deliveries record so Finance
        #    can always find a live delivery status keyed to this PO.
        if new_status in ("Delivered", "Completed"):
            po_str_id = str(po_doc["_id"])
            po_number  = po_doc.get("po_number", "")
            vendor_id  = po_doc.get("vendor_id", "")

            delivery_upsert = {
                "po_id":         po_str_id,
                "po_number":     po_number,
                "vendor_id":     vendor_id,
                "status":        new_status,         # "Delivered" or "Completed"
                "actual_date":   now,
                "received_by":   updated_by,
                "source":        "po_status_sync",   # Identifies auto-synced records
                "updated_at":    now,
            }
            # Use upsert so existing delivery records are updated, not duplicated
            db[COLLECTION_DELIVERIES].update_one(
                {"po_id": po_str_id},
                {"$set": delivery_upsert, "$setOnInsert": {"created_at": now}},
                upsert=True,
            )
            logger.info(
                "Delivery record upserted for PO %s (status=%s) by %s",
                po_number or po_str_id, new_status, updated_by,
            )

        log_audit(
            updated_by, "UPDATE_PO_STATUS", "PurchaseOrder", po_id,
            {"new_status": new_status}
        )

        # ── Delivery status notifications ─────────────────────────────────────
        # Fired for every meaningful shipment/delivery status change so all
        # relevant parties stay informed in real time.
        try:
            from services.notification_service import (
                notify_users_by_role, create_typed_notification,
            )
            from config.settings import COLLECTION_USERS as _COLL_USERS
            po_number  = po_doc.get("po_number", po_id[:8])
            vendor_id  = po_doc.get("vendor_id")
            vendor_nm  = po_doc.get("vendor_name", "Vendor")
            del_date   = now.strftime("%Y-%m-%d %H:%M UTC")

            # Status-specific messages
            _DELIVERY_STATUS_MSGS = {
                "Dispatched": (
                    "po_update",
                    f"PO {po_number} has been dispatched. "
                    f"Shipment is now in progress.",
                ),
                "In Transit": (
                    "po_update",
                    f"PO {po_number} is in transit. "
                    f"Expected delivery in progress. Updated: {del_date}.",
                ),
                "Delivered": (
                    "po_update",
                    f"PO {po_number} has been delivered. "
                    f"Delivery completed on {del_date}.",
                ),
                "Completed": (
                    "po_update",
                    f"PO {po_number} is fully completed. "
                    f"Delivery confirmed on {del_date}.",
                ),
                "Partially Delivered": (
                    "po_update",
                    f"PO {po_number} has been partially delivered. "
                    f"Remaining items pending. Updated: {del_date}.",
                ),
            }

            if new_status in _DELIVERY_STATUS_MSGS:
                notif_type, del_msg = _DELIVERY_STATUS_MSGS[new_status]

                # Notify assigned vendor
                if vendor_id:
                    v_users = list(db[_COLL_USERS].find(
                        {"vendor_id": vendor_id}, {"_id": 1}
                    ))
                    for _vu in v_users:
                        create_typed_notification(
                            user_id=str(_vu["_id"]),
                            notif_type=notif_type,
                            title=f"Delivery Update: {new_status} — {po_number}",
                            message=del_msg,
                            reference_id=po_id,
                            reference_entity="PurchaseOrder",
                        )

                # Notify Procurement Manager
                notify_users_by_role(
                    role="Procurement Manager",
                    title=f"PO {new_status}: {po_number}",
                    message=del_msg,
                    notification_type=notif_type,
                    reference_id=po_id,
                    reference_entity="PurchaseOrder",
                )

            # On delivery completion — additionally notify Finance Officer
            if new_status in ("Delivered", "Completed"):
                _finance_msg = (
                    f"Delivery Completed — Invoice Verification Required.\n"
                    f"PO {po_number} (Vendor: {vendor_nm}) was delivered on {del_date}.\n"
                    f"Please verify the invoice and proceed with payment verification."
                )
                notify_users_by_role(
                    role="Finance Officer",
                    title=f"Invoice Verification Required: {po_number}",
                    message=_finance_msg,
                    notification_type="invoice_verification",
                    reference_id=po_id,
                    reference_entity="PurchaseOrder",
                )
                # Also notify Supply Chain Manager on final completion
                notify_users_by_role(
                    role="Supply Chain Manager",
                    title=f"Delivery Completed: {po_number}",
                    message=del_msg,
                    notification_type=notif_type,
                    reference_id=po_id,
                    reference_entity="PurchaseOrder",
                )
        except Exception as _ne:
            logger.warning("Delivery notification failed (non-blocking): %s", _ne)

        return True, f"Purchase order status updated to {new_status}."
    except Exception as exc:
        logger.error("PO status update failed: %s", exc)
        return False, "Failed to update purchase order status."




def get_purchase_order_by_id(po_id: str) -> Optional[Dict]:
    """Retrieve a single purchase order by ID."""
    try:
        db = get_database()
        doc = db[COLLECTION_PURCHASE_ORDERS].find_one({"_id": ObjectId(po_id)})
        return po_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("Error fetching PO %s: %s", po_id, exc)
        return None
