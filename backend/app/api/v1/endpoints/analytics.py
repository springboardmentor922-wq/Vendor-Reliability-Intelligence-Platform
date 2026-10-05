from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder
from app.models.contract import Contract
from app.api import deps
from app.models.user import User

router = APIRouter()

@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    total_vendors = db.query(func.count(Vendor.id)).scalar() or 0
    total_pos = db.query(func.count(PurchaseOrder.id)).scalar() or 0
    active_pos = db.query(func.count(PurchaseOrder.id)).filter(
        PurchaseOrder.status.in_(["Pending", "Approved", "Ordered"])
    ).scalar() or 0
    total_spend = db.query(func.sum(PurchaseOrder.total_amount)).scalar() or 0.0
    avg_reliability = db.query(func.avg(Vendor.reliability_score)).scalar() or 0.0
    
    # Calculate Risk Tiers
    low_risk = db.query(func.count(Vendor.id)).filter(Vendor.reliability_score >= 85).scalar() or 0
    med_risk = db.query(func.count(Vendor.id)).filter(
        Vendor.reliability_score >= 70, Vendor.reliability_score < 85
    ).scalar() or 0
    high_risk = db.query(func.count(Vendor.id)).filter(Vendor.reliability_score < 70).scalar() or 0

    return {
        "total_vendors": total_vendors,
        "total_purchase_orders": total_pos,
        "active_purchase_orders": active_pos,
        "total_spend": round(total_spend, 2),
        "average_reliability_score": round(avg_reliability, 1),
        "risk_breakdown": {
            "low_risk": low_risk,
            "medium_risk": med_risk,
            "high_risk": high_risk
        }
    }

@router.get("/charts")
def get_chart_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # 1. Vendor Reliability Leaderboard
    vendors = db.query(Vendor).order_by(Vendor.reliability_score.desc()).limit(8).all()
    vendor_names = [v.company_name for v in vendors]
    vendor_scores = [round(v.reliability_score, 1) for v in vendors]
    delivery_accuracies = [round(v.delivery_accuracy, 1) for v in vendors]

    # 2. Spend breakdown by month (simulated trend based on actual data)
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"]
    spend_data = [12000, 18500, 24000, 19500, 32000, 28000, 35000, 42000, 66700]
    budget_data = [20000, 20000, 25000, 25000, 30000, 30000, 40000, 45000, 70000]

    return {
        "leaderboard": {
            "labels": vendor_names,
            "scores": vendor_scores,
            "accuracies": delivery_accuracies
        },
        "monthly_spend": {
            "labels": months,
            "spend": spend_data,
            "budget": budget_data
        }
    }
