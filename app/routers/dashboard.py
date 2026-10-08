from datetime import datetime, timedelta
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.scoring import calculate_reliability_score
from app.models.user import User, UserRole
from app.models.vendor import Vendor, VendorStatus, VendorCategory
from app.models.purchase_order import PurchaseOrder, OrderStatus
from app.models.contract import Contract, ContractStatus
from app.models.performance import PerformanceRecord
from app.models.score_history import ScoreHistory
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


@router.get("/procurement/charts")
def procurement_charts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_orders = db.query(PurchaseOrder).all()

    # Monthly cost + PO count trend
    monthly = defaultdict(lambda: {"cost": 0.0, "po_count": 0})
    for o in all_orders:
        if o.order_date:
            key = o.order_date.strftime("%b")
            monthly[key]["cost"] += o.total_amount
            monthly[key]["po_count"] += 1
    month_order = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_trend = [
        {"month": m, "cost": round(monthly[m]["cost"], 2), "po_count": monthly[m]["po_count"]}
        for m in month_order if m in monthly
    ]

    # PO status breakdown
    status_breakdown = {}
    for s in OrderStatus:
        status_breakdown[s.value] = sum(1 for o in all_orders if o.status == s)

    # Vendor performance radar (top vendors by reliability score)
    vendors = db.query(Vendor).filter(Vendor.status == VendorStatus.APPROVED).all()
    radar = []
    for v in vendors[:6]:
        score_data = calculate_reliability_score(db, v.id)
        fb = score_data.get("factor_breakdown")
        if fb:
            radar.append({
                "vendor": v.company_name,
                "delivery": fb["delivery_history"]["score"],
                "quality": fb["product_quality"]["score"],
                "compliance": fb["contract_compliance"]["score"],
                "communication": fb["communication_efficiency"]["score"],
            })

    # Cost by vendor category
    category_cost = defaultdict(float)
    for o in all_orders:
        vendor = db.query(Vendor).filter(Vendor.id == o.vendor_id).first()
        if vendor:
            category_cost[vendor.category.value] += o.total_amount
    cost_by_category = [{"category": k, "cost": round(v, 2)} for k, v in category_cost.items()]

    return {
        "monthly_trend": monthly_trend,
        "po_status_breakdown": status_breakdown,
        "vendor_performance_radar": radar,
        "cost_by_category": cost_by_category,
    }


@router.get("/vendor/{vendor_id}", response_model=VendorDashboard)
def vendor_dashboard(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    score_data = calculate_reliability_score(db, vendor_id)

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


@router.get("/vendor/{vendor_id}/charts")
def vendor_charts(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    score_data = calculate_reliability_score(db, vendor_id)
    fb = score_data.get("factor_breakdown") or {}

    performance_bars = [
        {"metric": "Delivery", "score": fb.get("delivery_history", {}).get("score", 0)},
        {"metric": "Quality", "score": fb.get("product_quality", {}).get("score", 0)},
        {"metric": "Communication", "score": fb.get("communication_efficiency", {}).get("score", 0)},
        {"metric": "Compliance", "score": fb.get("contract_compliance", {}).get("score", 0)},
    ]

    history = db.query(ScoreHistory).filter(ScoreHistory.vendor_id == vendor_id).order_by(ScoreHistory.recorded_at).all()
    reliability_trend = [{"point": f"#{i+1}", "score": h.score} for i, h in enumerate(history)]

    contracts = db.query(Contract).filter(Contract.vendor_id == vendor_id).all()
    contract_breakdown = {}
    for s in ContractStatus:
        contract_breakdown[s.value] = sum(1 for c in contracts if c.status == s)

    orders = db.query(PurchaseOrder).filter(PurchaseOrder.vendor_id == vendor_id).all()
    monthly_orders = defaultdict(lambda: {"value": 0.0, "count": 0})
    for o in orders:
        if o.order_date:
            key = o.order_date.strftime("%b")
            monthly_orders[key]["value"] += o.total_amount
            monthly_orders[key]["count"] += 1
    month_order = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    order_history = [
        {"month": m, "value": round(monthly_orders[m]["value"], 2), "count": monthly_orders[m]["count"]}
        for m in month_order if m in monthly_orders
    ]

    return {
        "performance_bars": performance_bars,
        "reliability_trend": reliability_trend,
        "contract_status_breakdown": contract_breakdown,
        "order_history": order_history,
    }


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
    high_risk_vendors = sum(1 for v in vendors if v.reliability_score < 60 and v.reliability_score > 0)

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


@router.get("/admin/charts")
def admin_charts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    vendors = db.query(Vendor).all()

    risk_distribution = {"low_risk": 0, "medium_risk": 0, "high_risk": 0}
    for v in vendors:
        if v.reliability_score == 0:
            continue
        score_data = calculate_reliability_score(db, v.id)
        risk_distribution[score_data["risk_level"]] += 1

    users = db.query(User).all()
    users_by_role = {}
    for role in UserRole:
        users_by_role[role.value] = sum(1 for u in users if u.role == role)

    all_orders = db.query(PurchaseOrder).all()
    monthly = defaultdict(lambda: {"cost": 0.0, "po_count": 0})
    for o in all_orders:
        if o.order_date:
            key = o.order_date.strftime("%b")
            monthly[key]["cost"] += o.total_amount
            monthly[key]["po_count"] += 1
    month_order = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_trend = [
        {"month": m, "cost": round(monthly[m]["cost"], 2), "po_count": monthly[m]["po_count"]}
        for m in month_order if m in monthly
    ]

    contracts = db.query(Contract).all()
    compliance_breakdown = {}
    for s in ContractStatus:
        compliance_breakdown[s.value] = sum(1 for c in contracts if c.status == s)

    return {
        "vendor_risk_distribution": risk_distribution,
        "users_by_role": users_by_role,
        "procurement_monthly_trend": monthly_trend,
        "compliance_breakdown": compliance_breakdown,
    }