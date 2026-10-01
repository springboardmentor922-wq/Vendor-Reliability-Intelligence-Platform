from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.deps import get_current_user
from app.db.session_dep import get_db
from app.models.user import User
from app.models.vendor import Vendor, VendorStatus
from app.models.procurement import ProcurementRequest, ProcurementStatus
from app.models.purchase_order import PurchaseOrder, POStatus
from app.models.contract import Contract, ContractStatus

router = APIRouter()


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Lightweight cross-module summary that backs the landing dashboard.
    Full Procurement / Vendor / Admin analytics dashboards are delivered in
    Milestone 3 (Vendor Performance & Analytics)."""

    total_vendors = db.query(func.count(Vendor.id)).scalar() or 0
    pending_vendors = db.query(func.count(Vendor.id)).filter(Vendor.status == VendorStatus.PENDING).scalar() or 0
    approved_vendors = db.query(func.count(Vendor.id)).filter(Vendor.status.in_([VendorStatus.APPROVED, VendorStatus.ACTIVE])).scalar() or 0

    total_requests = db.query(func.count(ProcurementRequest.id)).scalar() or 0
    pending_requests = db.query(func.count(ProcurementRequest.id)).filter(ProcurementRequest.status == ProcurementStatus.PENDING).scalar() or 0
    completed_requests = db.query(func.count(ProcurementRequest.id)).filter(ProcurementRequest.status == ProcurementStatus.COMPLETED).scalar() or 0

    total_pos = db.query(func.count(PurchaseOrder.id)).scalar() or 0
    active_pos = db.query(func.count(PurchaseOrder.id)).filter(PurchaseOrder.status.in_([POStatus.APPROVED, POStatus.ORDERED])).scalar() or 0
    po_value = db.query(func.coalesce(func.sum(PurchaseOrder.total_amount), 0.0)).scalar() or 0.0

    total_contracts = db.query(func.count(Contract.id)).scalar() or 0
    expiring_contracts = db.query(func.count(Contract.id)).filter(Contract.status == ContractStatus.EXPIRING).scalar() or 0

    completion_rate = round((completed_requests / total_requests) * 100, 2) if total_requests else 0.0

    return {
        "vendors": {"total": total_vendors, "pending": pending_vendors, "approved": approved_vendors},
        "procurement": {
            "total_requests": total_requests,
            "pending_requests": pending_requests,
            "completed_requests": completed_requests,
            "completion_rate": completion_rate,
        },
        "purchase_orders": {"total": total_pos, "active": active_pos, "total_value": po_value},
        "contracts": {"total": total_contracts, "expiring_soon": expiring_contracts},
    }
