"""
services/contract_service.py
-----------------------------
Contract management service — full MongoDB-backed CRUD for Milestone 2.
Uses the existing Contract model and COLLECTION_CONTRACTS from config.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple

from bson import ObjectId

from database.connection import get_database
from models.contract import Contract, contract_from_mongo
from utils.helpers import generate_contract_number
from utils.logger import log_audit
from config.settings import COLLECTION_CONTRACTS

logger = logging.getLogger(__name__)


# ── Create ────────────────────────────────────────────────────────────────────

def create_contract(
    vendor_id: str,
    title: str,
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    contract_value: float,
    created_by: str,
    compliance_status: str = "Compliant",
    contract_type: str = "Service Agreement",
    description: Optional[str] = None,
    payment_schedule: Optional[str] = None,
    renewal_terms: Optional[str] = None,
    auto_renew: bool = False,
    notification_days_before_expiry: int = 30,
) -> Tuple[bool, str, Optional[Dict]]:
    """Create a new vendor contract and persist to MongoDB."""
    if not vendor_id or not title.strip():
        return False, "Vendor and contract title are required.", None

    contract_number = generate_contract_number()
    contract = Contract(
        contract_number=contract_number,
        vendor_id=vendor_id,
        title=title.strip(),
        start_date=start_date,
        end_date=end_date,
        contract_value=contract_value,
        compliance_status=compliance_status,
        description=description,
        payment_schedule=payment_schedule,
        renewal_terms=renewal_terms,
        auto_renew=auto_renew,
        notification_days_before_expiry=notification_days_before_expiry,
        created_by=created_by,
    )

    doc = contract.to_mongo_doc()
    # Store extra fields not on the dataclass
    doc["contract_type"] = contract_type
    doc["status"] = "Active" if start_date and start_date <= datetime.now(timezone.utc) else "Draft"

    try:
        db = get_database()
        result = db[COLLECTION_CONTRACTS].insert_one(doc)
        contract_id = str(result.inserted_id)
        log_audit(
            user_id=created_by,
            action="CREATE_CONTRACT",
            entity="Contract",
            entity_id=contract_id,
            details={"contract_number": contract_number, "vendor_id": vendor_id},
        )
        doc["_id"] = contract_id
        return True, f"Contract {contract_number} created successfully.", doc
    except Exception as exc:
        logger.error("Contract creation failed: %s", exc)
        return False, "Failed to create contract.", None


# ── Read ──────────────────────────────────────────────────────────────────────

def get_all_contracts(
    status: Optional[str] = None,
    vendor_id: Optional[str] = None,
    expiring_within_days: Optional[int] = None,
    compliance_status: Optional[str] = None,
) -> List[Dict]:
    """Return contracts with optional filters."""
    try:
        db = get_database()
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        if vendor_id:
            query["vendor_id"] = vendor_id
        if compliance_status:
            query["compliance_status"] = compliance_status
        if expiring_within_days is not None:
            now = datetime.now(timezone.utc)
            cutoff = now + timedelta(days=expiring_within_days)
            query["end_date"] = {"$gte": now, "$lte": cutoff}

        docs = db[COLLECTION_CONTRACTS].find(query).sort("created_at", -1)
        return [contract_from_mongo(d) for d in docs]
    except Exception as exc:
        logger.error("Error fetching contracts: %s", exc)
        return []


def get_contract_by_id(contract_id: str) -> Optional[Dict]:
    """Retrieve a single contract by ObjectId string."""
    try:
        db = get_database()
        doc = db[COLLECTION_CONTRACTS].find_one({"_id": ObjectId(contract_id)})
        return contract_from_mongo(doc) if doc else None
    except Exception as exc:
        logger.error("Error fetching contract %s: %s", contract_id, exc)
        return None


def get_contract_stats() -> Dict[str, int]:
    """Return aggregate counts for KPI cards."""
    try:
        db = get_database()
        col = db[COLLECTION_CONTRACTS]
        now = datetime.now(timezone.utc)
        cutoff_60 = now + timedelta(days=60)
        return {
            "total": col.count_documents({}),
            "active": col.count_documents({"status": "Active"}),
            "draft": col.count_documents({"status": "Draft"}),
            "expired": col.count_documents({"status": "Expired"}),
            "terminated": col.count_documents({"status": "Terminated"}),
            "expiring_soon": col.count_documents({
                "status": "Active",
                "end_date": {"$gte": now, "$lte": cutoff_60},
            }),
            "compliant": col.count_documents({"compliance_status": "Compliant"}),
            "non_compliant": col.count_documents({"compliance_status": "Non-Compliant"}),
        }
    except Exception as exc:
        logger.error("Error getting contract stats: %s", exc)
        return {
            "total": 0, "active": 0, "draft": 0, "expired": 0,
            "terminated": 0, "expiring_soon": 0, "compliant": 0, "non_compliant": 0,
        }


def get_total_contract_value() -> float:
    """Return the sum of all active contract values."""
    try:
        db = get_database()
        pipeline = [
            {"$match": {"status": "Active"}},
            {"$group": {"_id": None, "total": {"$sum": "$contract_value"}}},
        ]
        results = list(db[COLLECTION_CONTRACTS].aggregate(pipeline))
        return results[0]["total"] if results else 0.0
    except Exception as exc:
        logger.error("Error getting total contract value: %s", exc)
        return 0.0


# ── Update ────────────────────────────────────────────────────────────────────

def update_contract(
    contract_id: str,
    updates: Dict[str, Any],
    updated_by: str,
) -> Tuple[bool, str]:
    """Update contract fields."""
    try:
        db = get_database()
        updates["updated_at"] = datetime.now(timezone.utc)
        result = db[COLLECTION_CONTRACTS].update_one(
            {"_id": ObjectId(contract_id)},
            {"$set": updates},
        )
        if result.matched_count == 0:
            return False, "Contract not found."
        log_audit(updated_by, "UPDATE_CONTRACT", "Contract", contract_id, updates)
        return True, "Contract updated successfully."
    except Exception as exc:
        logger.error("Contract update failed: %s", exc)
        return False, "Failed to update contract."


def update_contract_status(
    contract_id: str,
    new_status: str,
    updated_by: str,
) -> Tuple[bool, str]:
    """Update a contract's status."""
    return update_contract(contract_id, {"status": new_status}, updated_by)


# ── Delete (soft) ─────────────────────────────────────────────────────────────

def delete_contract(contract_id: str, deleted_by: str) -> Tuple[bool, str]:
    """Soft-delete a contract by setting status to Terminated."""
    return update_contract(
        contract_id,
        {"status": "Terminated", "deleted_by": deleted_by},
        deleted_by,
    )


# ── Auto-expire contracts past end_date ───────────────────────────────────────

def expire_overdue_contracts() -> int:
    """Set status=Expired for Active contracts past their end_date. Returns count updated."""
    try:
        db = get_database()
        now = datetime.now(timezone.utc)
        cutoff_30 = now + timedelta(days=30)
        # Mark expired
        result_expired = db[COLLECTION_CONTRACTS].update_many(
            {"status": {"$in": ["Active", "Expiring Soon"]}, "end_date": {"$lt": now}},
            {"$set": {"status": "Expired", "updated_at": now}},
        )
        # Mark expiring soon
        db[COLLECTION_CONTRACTS].update_many(
            {"status": "Active", "end_date": {"$gte": now, "$lte": cutoff_30}},
            {"$set": {"status": "Expiring Soon", "updated_at": now}},
        )
        return result_expired.modified_count
    except Exception as exc:
        logger.error("Error expiring contracts: %s", exc)
        return 0


def get_upcoming_expiries(limit: int = 5) -> List[Dict]:
    """Return contracts expiring within 60 days for dashboard display."""
    try:
        db = get_database()
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=60)
        docs = list(
            db[COLLECTION_CONTRACTS]
            .find({"status": {"$in": ["Active", "Expiring Soon"]}, "end_date": {"$gte": now, "$lte": cutoff}})
            .sort("end_date", 1)
            .limit(limit)
        )
        return [contract_from_mongo(d) for d in docs]
    except Exception as exc:
        logger.error("Error getting upcoming expiries: %s", exc)
        return []
