from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.scoring import calculate_reliability_score, classify_risk_level
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder, OrderStatus
from app.models.procurement_request import ProcurementRequest, RequestStatus
from app.models.contract import Contract, ContractStatus
from app.models.performance import PerformanceRecord
from app.models.audit_log import AuditLog

router = APIRouter(tags=["Intelligence & Efficiency Tools"])


@router.get("/dashboard/my-tasks")
def my_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pending_pos = db.query(PurchaseOrder).filter(PurchaseOrder.status == OrderStatus.PENDING).count()
    pending_vendors = db.query(Vendor).filter(Vendor.status == "pending").count()
    pending_requests = db.query(ProcurementRequest).filter(ProcurementRequest.status == RequestStatus.PENDING).count()

    all_contracts = db.query(Contract).all()
    from datetime import datetime, timedelta
    soon = datetime.utcnow() + timedelta(days=30)
    expiring_contracts = [
        c for c in all_contracts
        if c.end_date and c.end_date.replace(tzinfo=None) <= soon and c.status != ContractStatus.EXPIRED
    ]

    high_risk_vendors = [v for v in db.query(Vendor).all() if v.reliability_score < 50 and v.reliability_score > 0]

    return {
        "pending_purchase_orders": pending_pos,
        "pending_vendor_approvals": pending_vendors,
        "pending_procurement_requests": pending_requests,
        "contracts_expiring_soon": len(expiring_contracts),
        "high_risk_vendors": len(high_risk_vendors),
        "total_action_items": pending_pos + pending_vendors + pending_requests + len(expiring_contracts) + len(high_risk_vendors),
    }


@router.get("/vendors/check-duplicate")
def check_duplicate_vendor(company_name: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    matches = db.query(Vendor).filter(Vendor.company_name.ilike(f"%{company_name}%")).all()
    return {
        "possible_duplicates": [{"id": v.id, "company_name": v.company_name, "email": v.email} for v in matches]
    }


@router.get("/vendors/compare")
def compare_vendors(ids: str = Query(..., description="Comma-separated vendor IDs, e.g. 1,2,3"),
                     db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vendor_ids = [int(i) for i in ids.split(",")]
    vendors = db.query(Vendor).filter(Vendor.id.in_(vendor_ids)).all()
    result = []
    for v in vendors:
        records = db.query(PerformanceRecord).filter(PerformanceRecord.vendor_id == v.id).all()
        score_data = calculate_reliability_score(records)
        orders = db.query(PurchaseOrder).filter(PurchaseOrder.vendor_id == v.id).all()
        result.append({
            "id": v.id,
            "company_name": v.company_name,
            "category": v.category,
            "reliability_score": score_data["reliability_score"],
            "risk_level": score_data["risk_level"],
            "on_time_delivery_rate": score_data["on_time_delivery_rate"],
            "avg_quality_rating": score_data["avg_quality_rating"],
            "total_orders": len(orders),
            "total_order_value": sum(o.total_amount for o in orders),
        })
    return result


@router.put("/purchase-orders/bulk-approve")
def bulk_approve_orders(order_ids: List[int], db: Session = Depends(get_db),
                         current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER))):
    orders = db.query(PurchaseOrder).filter(PurchaseOrder.id.in_(order_ids)).all()
    for o in orders:
        o.status = OrderStatus.APPROVED
        log_action_inline(db, current_user.id, f"Bulk approved PO {o.order_number}", "purchase_order", o.id)
    db.commit()
    return {"approved_count": len(orders)}


def log_action_inline(db, user_id, action, entity_type, entity_id):
    entry = AuditLog(user_id=user_id, action=action, entity_type=entity_type, entity_id=entity_id)
    db.add(entry)


@router.get("/audit-log")
def get_audit_log(db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUDITOR))):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "created_at": l.created_at,
        }
        for l in logs
    ]


@router.get("/search")
def global_search(q: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vendors = db.query(Vendor).filter(Vendor.company_name.ilike(f"%{q}%")).limit(5).all()
    orders = db.query(PurchaseOrder).filter(PurchaseOrder.order_number.ilike(f"%{q}%")).limit(5).all()
    contracts = db.query(Contract).filter(Contract.title.ilike(f"%{q}%")).limit(5).all()

    return {
        "vendors": [{"id": v.id, "name": v.company_name, "type": "vendor"} for v in vendors],
        "purchase_orders": [{"id": o.id, "name": o.order_number, "type": "purchase_order"} for o in orders],
        "contracts": [{"id": c.id, "name": c.title, "type": "contract"} for c in contracts],
    }