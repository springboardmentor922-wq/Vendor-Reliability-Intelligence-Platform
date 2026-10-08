from sqlalchemy.orm import Session
from app.models.performance import PerformanceRecord
from app.models.purchase_order import PurchaseOrder, OrderStatus
from app.models.contract import Contract, ContractStatus
from app.models.issue import Issue, IssueStatus


def classify_risk_level(score: float) -> str:
    if score >= 80:
        return "low_risk"
    elif score >= 60:
        return "medium_risk"
    else:
        return "high_risk"


def get_recommendation(risk_level: str, trend: str = None) -> str:
    if risk_level == "low_risk":
        return "Preferred vendor — safe to assign"
    elif risk_level == "medium_risk":
        if trend == "declining":
            return "Use with monitoring — recent decline flagged"
        return "Acceptable with monitoring — review recent issues"
    else:
        return "Avoid for critical orders — needs review before assignment"


def calculate_reliability_score(db: Session, vendor_id: int) -> dict:
    records = db.query(PerformanceRecord).filter(PerformanceRecord.vendor_id == vendor_id).all()
    orders = db.query(PurchaseOrder).filter(PurchaseOrder.vendor_id == vendor_id).all()
    contracts = db.query(Contract).filter(Contract.vendor_id == vendor_id).all()
    issues = db.query(Issue).filter(Issue.vendor_id == vendor_id).all()

    if not records:
        return {
            "reliability_score": 0.0,
            "total_records": 0,
            "on_time_delivery_rate": None,
            "avg_quality_rating": None,
            "avg_communication_rating": None,
            "avg_response_time_hours": None,
            "risk_level": "high_risk",
            "recommendation": get_recommendation("high_risk"),
            "factor_breakdown": None,
        }

    delivery_records = [r for r in records if r.on_time_delivery is not None]
    on_time_rate = (
        sum(1 for r in delivery_records if r.on_time_delivery) / len(delivery_records)
        if delivery_records else None
    )
    delivery_score = (on_time_rate * 100) if on_time_rate is not None else 0

    quality_records = [r.quality_rating for r in records if r.quality_rating is not None]
    avg_quality = sum(quality_records) / len(quality_records) if quality_records else None
    quality_score = (avg_quality / 5 * 100) if avg_quality is not None else 0

    response_records = [r.response_time_hours for r in records if r.response_time_hours is not None]
    avg_response = sum(response_records) / len(response_records) if response_records else None
    if avg_response is not None:
        if avg_response <= 12:
            comm_score = 100
        elif avg_response <= 24:
            comm_score = 70
        else:
            comm_score = 40
    else:
        comm_score = 0

    if contracts:
        compliant = sum(1 for c in contracts if c.status == ContractStatus.ACTIVE)
        compliance_score = (compliant / len(contracts)) * 100
    else:
        compliance_score = 50

    if orders:
        completed = sum(1 for o in orders if o.status == OrderStatus.COMPLETED)
        completion_rate = completed / len(orders)
        purchase_history_score = completion_rate * 100
        if len(orders) < 3:
            purchase_history_score *= 0.8
    else:
        purchase_history_score = 50

    resolved_issues = [i for i in issues if i.status == IssueStatus.RESOLVED and i.resolved_at]
    if resolved_issues:
        resolution_hours = [(i.resolved_at - i.raised_at).total_seconds() / 3600 for i in resolved_issues]
        avg_resolution = sum(resolution_hours) / len(resolution_hours)
        if avg_resolution <= 24:
            issue_score = 100
        elif avg_resolution <= 72:
            issue_score = 70
        else:
            issue_score = 40
    elif issues:
        issue_score = 50
    else:
        issue_score = 70

    final_score = round(
        delivery_score * 0.25
        + quality_score * 0.25
        + comm_score * 0.10
        + compliance_score * 0.15
        + purchase_history_score * 0.10
        + issue_score * 0.15,
        2,
    )

    risk_level = classify_risk_level(final_score)

    return {
        "reliability_score": final_score,
        "total_records": len(records),
        "on_time_delivery_rate": round(on_time_rate * 100, 2) if on_time_rate is not None else None,
        "avg_quality_rating": round(avg_quality, 2) if avg_quality is not None else None,
        "avg_communication_rating": None,
        "avg_response_time_hours": round(avg_response, 2) if avg_response is not None else None,
        "risk_level": risk_level,
        "recommendation": get_recommendation(risk_level),
        "factor_breakdown": {
            "delivery_history": {"weight": 25, "score": round(delivery_score, 1)},
            "product_quality": {"weight": 25, "score": round(quality_score, 1)},
            "communication_efficiency": {"weight": 10, "score": round(comm_score, 1)},
            "contract_compliance": {"weight": 15, "score": round(compliance_score, 1)},
            "purchase_history": {"weight": 10, "score": round(purchase_history_score, 1)},
            "issue_resolution": {"weight": 15, "score": round(issue_score, 1)},
        },
    }