"""
Vendor Performance & Reliability Scoring Engine

Calculates metrics dynamically from actual purchase orders, dock delivery records,
quality inspection ratings, communication response times, and contract SLA compliance.

Formula (matching Enterprise Supplier Intelligence Standard):
1. Delivery Accuracy (35% weight):
   On-Time Deliveries (actual_delivery_date <= expected_delivery_date) / Total Delivered Orders * 100%
2. Quality Rating (30% weight):
   Average Receiving Dock QA Inspection Rating (out of 5.0) normalized to 100%
3. Response Time (15% weight):
   Average vendor communication response time in hours, scored against SLA benchmark
4. Contract SLA Compliance (20% weight):
   Compliant (100%), Under Review (80%), Expired (65%), Breached/None (40%)

Overall Reliability Score = (DeliveryAcc * 0.35) + (QualityScore * 0.30) + (RespScore * 0.15) + (SLAScore * 0.20)
"""

from typing import Dict, Any, Optional
from datetime import date
from sqlalchemy.orm import Session

from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder
from app.models.contract import Contract


def calculate_vendor_metrics(db: Session, vendor_id: int, persist: bool = True) -> Dict[str, Any]:
    """
    Computes mathematical vendor performance metrics directly from database records.
    Updates the vendor record in the database if persist=True.
    """
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        return {}

    # 1. Fetch all purchase orders for this vendor
    all_orders = db.query(PurchaseOrder).filter(PurchaseOrder.vendor_id == vendor_id).all()
    delivered_orders = [
        o for o in all_orders 
        if o.status in ["Delivered", "Completed"] and o.actual_delivery_date and o.expected_delivery_date
    ]

    total_orders_count = len(all_orders)
    delivered_count = len(delivered_orders)

    # 2. Delivery Accuracy Calculation (35% Weight)
    if delivered_count > 0:
        on_time_orders = sum(1 for o in delivered_orders if o.actual_delivery_date <= o.expected_delivery_date)
        late_orders = delivered_count - on_time_orders
        delivery_accuracy = round((on_time_orders / delivered_count) * 100.0, 1)
    else:
        # Default for newly registered vendors without delivery records
        on_time_orders = 0
        late_orders = 0
        delivery_accuracy = 95.0

    delivery_weighted_pts = round(delivery_accuracy * 0.35, 2)

    # 3. Dock Receiving Quality QA Calculation (30% Weight)
    qa_ratings = [o.quality_rating for o in delivered_orders if o.quality_rating is not None]
    if qa_ratings:
        avg_quality_rating = round(sum(qa_ratings) / len(qa_ratings), 2)
    else:
        avg_quality_rating = 4.5

    quality_score_percent = round((avg_quality_rating / 5.0) * 100.0, 1)
    quality_weighted_pts = round(quality_score_percent * 0.30, 2)

    # 4. Response Time Calculation (15% Weight)
    resp_times = [o.response_time_hours for o in all_orders if o.response_time_hours is not None]
    if resp_times:
        avg_resp_hours = round(sum(resp_times) / len(resp_times), 1)
    else:
        avg_resp_hours = 2.4

    # Response SLA Benchmark: <= 1.0 hr is 100%, each additional hour deducts 10 points (min 15%)
    resp_score_percent = round(max(15.0, min(100.0, 100.0 - max(0.0, avg_resp_hours - 1.0) * 10.0)), 1)
    resp_weighted_pts = round(resp_score_percent * 0.15, 2)

    # 5. Contract SLA Compliance (20% Weight)
    contract = db.query(Contract).filter(Contract.vendor_id == vendor_id).first()
    if contract:
        status_norm = (contract.compliance_status or "").strip().lower()
        if "compliant" in status_norm and "non" not in status_norm:
            sla_score_percent = 100.0
            contract_status = "Compliant"
        elif "review" in status_norm:
            sla_score_percent = 80.0
            contract_status = "Under Review"
        elif "expired" in status_norm:
            sla_score_percent = 65.0
            contract_status = "Expired"
        else:
            sla_score_percent = 40.0
            contract_status = contract.compliance_status or "Breached"
    else:
        sla_score_percent = 50.0
        contract_status = "No Active SLA"

    sla_weighted_pts = round(sla_score_percent * 0.20, 2)

    # 6. Overall Reliability Score Computation
    reliability_score = round(
        delivery_weighted_pts + quality_weighted_pts + resp_weighted_pts + sla_weighted_pts,
        1
    )
    reliability_score = min(100.0, max(0.0, reliability_score))

    # 7. Dynamic Risk Tier Classification
    if reliability_score >= 85.0:
        risk_tier = "Low Risk"
    elif reliability_score >= 70.0:
        risk_tier = "Medium Risk"
    else:
        risk_tier = "High Risk"

    # Persist updated calculated values to database
    if persist:
        vendor.delivery_accuracy = delivery_accuracy
        vendor.response_time = avg_resp_hours
        vendor.reliability_score = reliability_score
        vendor.risk_tier = risk_tier
        db.commit()
        db.refresh(vendor)

    return {
        "vendor_id": vendor.id,
        "company_name": vendor.company_name,
        "category": vendor.category,
        "status": vendor.status,
        "risk_tier": risk_tier,
        "total_orders": total_orders_count,
        "delivered_orders": delivered_count,
        "on_time_orders": on_time_orders,
        "late_orders": late_orders,
        "delivery_accuracy": delivery_accuracy,
        "delivery_weight": 0.35,
        "delivery_weighted_points": delivery_weighted_pts,
        "avg_quality_rating": avg_quality_rating,
        "quality_score_percentage": quality_score_percent,
        "quality_weight": 0.30,
        "quality_weighted_points": quality_weighted_pts,
        "avg_response_time_hours": avg_resp_hours,
        "response_time_score_percentage": resp_score_percent,
        "response_time_weight": 0.15,
        "response_time_weighted_points": resp_weighted_pts,
        "contract_status": contract_status,
        "contract_sla_score_percentage": sla_score_percent,
        "contract_sla_weight": 0.20,
        "contract_sla_weighted_points": sla_weighted_pts,
        "reliability_score": reliability_score,
        "formula": "Reliability Score = (Delivery Accuracy × 35%) + (Quality Score × 30%) + (Response Score × 15%) + (Contract SLA × 20%)"
    }


def recalculate_all_vendors(db: Session) -> Dict[str, Any]:
    """
    Recalculates dynamic scores for all registered vendors.
    """
    vendors = db.query(Vendor).all()
    results = []
    for v in vendors:
        res = calculate_vendor_metrics(db, v.id, persist=True)
        results.append(res)
    return {"total_recalculated": len(results), "vendors": results}
