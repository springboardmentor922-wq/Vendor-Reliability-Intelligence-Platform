from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.scoring import calculate_reliability_score
from app.models.user import User, UserRole
from app.models.vendor import Vendor, VendorStatus, VendorCategory
from app.models.purchase_order import PurchaseOrder, OrderStatus
from app.models.contract import Contract, ContractStatus
from app.models.performance import PerformanceRecord
from app.schemas.dashboard import ProcurementDashboard, VendorDashboard, AdminDashboard

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Analytics"])


@router.get("/procurement", response_model=ProcurementDashboard)
def procurement_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_orders = db.query(PurchaseOrder).all()
    total = len(all_orders)

    pending = sum(1 for o in all_orders if o.status == OrderStatus.PENDING)
    approved = sum(1 for o in all_orders if o.status == OrderStatus.APPROVED)
    completed = sum(1 for o in all_orders if o.status == OrderStatus.COMPLETED)
    total_value = sum(o.total_amount for o in all_orders)
    completion_rate = (completed / total * 100) if total else 0.0

    active_statuses = (OrderStatus.APPROVED, OrderStatus.ORDERED)
    active_orders = [o for o in all_orders if o.status in active_statuses]
    now = datetime.utcnow()
    overdue = [
        o for o in active_orders
        if o.expected_delivery_date and o.expected_delivery_date.replace(tzinfo=None) < now
    ]
    active_value = sum(o.total_amount for o in active_orders)

    delivered_or_completed = [
        o for o in all_orders if o.status in (OrderStatus.DELIVERED, OrderStatus.COMPLETED)
    ]
    total_deliveries = len(delivered_or_completed)
    on_time = sum(
        1 for o in delivered_or_completed
        if o.actual_delivery_date and o.expected_delivery_date
        and o.actual_delivery_date <= o.expected_delivery_date
    )
    delayed = total_deliveries - on_time
    pending_deliveries = sum(1 for o in all_orders if o.status in (OrderStatus.ORDERED, OrderStatus.APPROVED))
    delivery_rate = (on_time / total_deliveries * 100) if total_deliveries else 0.0

    return ProcurementDashboard(
        total_requests=total,
        pending_requests=pending,
        approved_requests=approved,
        completed_requests=completed,
        total_procurement_value=round(total_value, 2),
        completion_rate=round(completion_rate, 2),
        active_purchase_orders=len(active_orders),
        pending_orders=pending,
        overdue_orders=len(overdue),
        active_po_value=round(active_value, 2),
        total_deliveries=total_deliveries,
        on_time_deliveries=on_time,
        delayed_deliveries=delayed,
        pending_deliveries=pending_deliveries,
        delivery_rate=round(delivery_rate, 2),
    )


@router.get("/vendor/{vendor_id}", response_model=VendorDashboard)
def vendor_dashboard(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    records = db.query(PerformanceRecord).filter(PerformanceRecord.vendor_id == vendor_id).all()
    score_data = calculate_reliability_score(records)

    contracts = db.query(Contract).filter(Contract.vendor_id == vendor_id).all()
    active_contracts = sum(1 for c in contracts if c.status == ContractStatus.ACTIVE)
    expiring_contracts = sum(1 for c in contracts if c.status == ContractStatus.EXPIRING_SOON)
    expired_contracts = sum(1 for c in contracts if c.status == ContractStatus.EXPIRED)

    orders = db.query(PurchaseOrder).filter(PurchaseOrder.vendor_id == vendor_id).all()
    total_orders = len(orders)
    completed_orders = sum(1 for o in orders if o.status == OrderStatus.COMPLETED)
    pending_orders = sum(1 for o in orders if o.status == OrderStatus.PENDING)
    cancelled_orders = sum(1 for o in orders if o.status == OrderStatus.CANCELLED)
    total_order_value = sum(o.total_amount for o in orders)

    return VendorDashboard(
        vendor_id=vendor.id,
        company_name=vendor.company_name,
        reliability_score=score_data["reliability_score"],
        delivery_rate=score_data["on_time_delivery_rate"],
        avg_quality_rating=score_data["avg_quality_rating"],
        avg_response_time_hours=score_data["avg_response_time_hours"],
        active_contracts=active_contracts,
        expiring_contracts=expiring_contracts,
        expired_contracts=expired_contracts,
        total_orders=total_orders,
        completed_orders=completed_orders,
        pending_orders=pending_orders,
        cancelled_orders=cancelled_orders,
        total_order_value=round(total_order_value, 2),
    )


@router.get("/admin", response_model=AdminDashboard)
def admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    users = db.query(User).all()
    total_users = len(users)
    active_users = sum(1 for u in users if u.is_active)
    users_by_role = {}
    for role in UserRole:
        users_by_role[role.value] = sum(1 for u in users if u.role == role)

    vendors = db.query(Vendor).all()
    total_vendors = len(vendors)
    active_vendors = sum(1 for v in vendors if v.status == VendorStatus.APPROVED)
    vendors_by_category = {}
    for category in VendorCategory:
        vendors_by_category[category.value] = sum(1 for v in vendors if v.category == category)
    high_risk_vendors = sum(1 for v in vendors if v.reliability_score < 50)

    orders = db.query(PurchaseOrder).all()
    total_orders = len(orders)
    total_value = sum(o.total_amount for o in orders)
    pending_approvals = sum(1 for o in orders if o.status == OrderStatus.PENDING)

    contracts = db.query(Contract).all()
    total_contracts = len(contracts)
    compliant_vendors = sum(1 for c in contracts if c.status == ContractStatus.ACTIVE)
    expired_certifications = sum(1 for c in contracts if c.status == ContractStatus.EXPIRED)

    return AdminDashboard(
        total_users=total_users,
        active_users=active_users,
        users_by_role=users_by_role,
        total_vendors=total_vendors,
        active_vendors=active_vendors,
        vendors_by_category=vendors_by_category,
        high_risk_vendors=high_risk_vendors,
        total_purchase_orders=total_orders,
        total_procurement_value=round(total_value, 2),
        pending_approvals=pending_approvals,
        total_contracts=total_contracts,
        compliant_vendors=compliant_vendors,
        expired_certifications=expired_certifications,
    )