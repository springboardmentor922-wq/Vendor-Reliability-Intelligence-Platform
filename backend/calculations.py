"""
VendorIQ Calculations Engine
Implements the official 6-factor Reliability Score, Performance Metrics,
Risk Assessment with overrides, and Procurement Recommendations.
"""
from datetime import datetime, date
import sqlite3

def compute_vendor_performance_and_reliability(vendor_id: int, conn: sqlite3.Connection) -> dict:
    """
    Computes all performance metrics and the 6-factor reliability score
    directly from stored database records.
    """
    cursor = conn.cursor()

    # 1. Fetch vendor basic status
    cursor.execute("SELECT id, company_name, category, status FROM vendors WHERE id = ?", (vendor_id,))
    vendor = cursor.fetchone()
    if not vendor:
        return None

    # 2. Purchase Orders Performance Data
    cursor.execute("""
        SELECT id, order_date, expected_delivery_date, actual_delivery_date, status, total_amount
        FROM purchase_orders
        WHERE vendor_id = ?
    """, (vendor_id,))
    pos = cursor.fetchall()

    total_orders = len(pos)
    delivered_orders = [p for p in pos if p["status"] in ("Delivered", "Completed")]
    completed_orders = [p for p in pos if p["status"] == "Completed"]

    on_time_count = 0
    delayed_count = 0
    total_delay_days = 0

    for p in delivered_orders:
        if p["actual_delivery_date"] and p["expected_delivery_date"]:
            exp_date = datetime.strptime(str(p["expected_delivery_date"])[:10], "%Y-%m-%d").date()
            act_date = datetime.strptime(str(p["actual_delivery_date"])[:10], "%Y-%m-%d").date()
            if act_date <= exp_date:
                on_time_count += 1
            else:
                delayed_count += 1
                total_delay_days += (act_date - exp_date).days

    total_delivered = len(delivered_orders)
    if total_delivered > 0:
        delivery_history_score = round((on_time_count / total_delivered) * 100.0, 1)
        avg_delay_days = round(total_delay_days / max(1, delayed_count), 1)
    else:
        delivery_history_score = 85.0  # baseline if no deliveries yet
        avg_delay_days = 0.0

    order_completion_rate = round((len(completed_orders) / total_orders * 100.0), 1) if total_orders > 0 else 100.0

    # 3. Product Quality Evaluation
    cursor.execute("""
        SELECT quality_rating, inspected_quantity, defective_quantity, rejected_quantity
        FROM quality_evaluations
        WHERE vendor_id = ?
    """, (vendor_id,))
    evals = cursor.fetchall()

    if evals:
        avg_rating = sum(e["quality_rating"] for e in evals) / len(evals)
        total_inspected = sum(e["inspected_quantity"] for e in evals)
        total_defects = sum(e["defective_quantity"] for e in evals)
        defect_rate = (total_defects / max(1, total_inspected)) * 100.0
        # Convert 5-point scale to 100, deducting defect rate
        quality_score = max(0.0, min(100.0, round((avg_rating / 5.0) * 100.0 - (defect_rate * 0.5), 1)))
    else:
        avg_rating = 4.2
        defect_rate = 0.0
        quality_score = 84.0

    # 4. Communication Efficiency
    cursor.execute("""
        SELECT communication_type, response_time_hours, timestamp
        FROM communication_records
        WHERE vendor_id = ?
    """, (vendor_id,))
    comms = cursor.fetchall()

    timed_comms = [c for c in comms if c["response_time_hours"] is not None]
    if timed_comms:
        avg_response_hours = sum(c["response_time_hours"] for c in timed_comms) / len(timed_comms)
        if avg_response_hours <= 4:
            comm_score = 100.0
        elif avg_response_hours <= 12:
            comm_score = 85.0
        elif avg_response_hours <= 24:
            comm_score = 70.0
        elif avg_response_hours <= 48:
            comm_score = 50.0
        else:
            comm_score = 35.0
    else:
        avg_response_hours = 6.0
        comm_score = 80.0

    # 5. Contract & Compliance
    cursor.execute("SELECT id, status, end_date FROM contracts WHERE vendor_id = ?", (vendor_id,))
    contracts = cursor.fetchall()

    cursor.execute("SELECT id, compliance_status, expiry_date FROM certifications WHERE vendor_id = ?", (vendor_id,))
    certs = cursor.fetchall()

    today = date.today()
    active_contracts = 0
    expired_contracts = 0
    for c in contracts:
        if c["end_date"]:
            end = datetime.strptime(str(c["end_date"])[:10], "%Y-%m-%d").date()
            if end < today or c["status"] == "Expired":
                expired_contracts += 1
            else:
                active_contracts += 1
        elif c["status"] == "Active":
            active_contracts += 1

    valid_certs = 0
    expired_certs = 0
    for cert in certs:
        if cert["expiry_date"]:
            exp = datetime.strptime(str(cert["expiry_date"])[:10], "%Y-%m-%d").date()
            if exp < today or cert["compliance_status"] in ("Non-Compliant/Expired", "Expired"):
                expired_certs += 1
            else:
                valid_certs += 1
        elif cert["compliance_status"] == "Compliant":
            valid_certs += 1

    total_compliance_items = len(contracts) + len(certs)
    if total_compliance_items > 0:
        valid_items = active_contracts + valid_certs
        compliance_score = round((valid_items / total_compliance_items) * 100.0, 1)
    else:
        compliance_score = 90.0

    # 6. Purchase History Factor
    # Combines completion rate and purchase volume credibility
    if total_orders >= 10:
        volume_factor = 1.0
    elif total_orders >= 5:
        volume_factor = 0.95
    elif total_orders >= 1:
        volume_factor = 0.90
    else:
        volume_factor = 0.85
    purchase_history_score = round(order_completion_rate * volume_factor, 1)

    # 7. Issue Resolution
    cursor.execute("""
        SELECT id, severity, status, created_at, resolved_at, resolution_time_hours
        FROM issues
        WHERE vendor_id = ?
    """, (vendor_id,))
    issues = cursor.fetchall()

    total_issues = len(issues)
    resolved_issues = [i for i in issues if i["status"] == "Resolved"]
    # SLA threshold: 48 hours for standard issues, 24 for high/critical
    resolved_within_sla = 0
    total_res_time = 0
    for i in resolved_issues:
        hrs = i["resolution_time_hours"] or 24
        total_res_time += hrs
        sla = 24 if i["severity"] in ("High", "Critical") else 48
        if hrs <= sla:
            resolved_within_sla += 1

    if total_issues > 0:
        resolution_score = round((resolved_within_sla / total_issues) * 100.0, 1)
        avg_resolution_hours = round(total_res_time / max(1, len(resolved_issues)), 1)
    else:
        resolution_score = 95.0
        avg_resolution_hours = 0.0

    # 8. Compute Overall Reliability Score (Official Weights)
    # Delivery History: 25%
    # Product Quality: 25%
    # Communication Efficiency: 10%
    # Contract Compliance: 15%
    # Purchase History: 10%
    # Issue Resolution: 15%
    overall_reliability = round(
        (delivery_history_score * 0.25) +
        (quality_score * 0.25) +
        (comm_score * 0.10) +
        (compliance_score * 0.15) +
        (purchase_history_score * 0.10) +
        (resolution_score * 0.15),
        1
    )

    # 9. Risk Level & Overrides
    override_reason = None
    if vendor["status"] == "Suspended":
        risk_level = "High"
        override_reason = "Vendor is currently Suspended"
    elif expired_certs > 0:
        risk_level = "High"
        override_reason = f"Vendor has {expired_certs} expired mandatory certification(s)"
    elif expired_contracts > 0 and active_contracts == 0:
        risk_level = "High"
        override_reason = "All vendor contracts have expired"
    else:
        if overall_reliability >= 80.0:
            risk_level = "Low"
        elif overall_reliability >= 60.0:
            risk_level = "Medium"
        else:
            risk_level = "High"

    # 10. Procurement Recommendation
    if risk_level == "Low":
        recommendation = "Preferred vendor. Safe to assign."
        recommendation_badge = "success"
    elif risk_level == "Medium":
        recommendation = "Acceptable with monitoring. Review recent issues."
        recommendation_badge = "warning"
    else:
        recommendation = "Avoid for critical orders. Needs review before assignment."
        recommendation_badge = "danger"

    # 11. Trend Analysis (from snapshots)
    cursor.execute("""
        SELECT overall_reliability, period_month
        FROM performance_snapshots
        WHERE vendor_id = ?
        ORDER BY period_month DESC
        LIMIT 2
    """, (vendor_id,))
    snapshots = cursor.fetchall()
    if len(snapshots) >= 2:
        diff = snapshots[0]["overall_reliability"] - snapshots[1]["overall_reliability"]
        if diff >= 2.0:
            trend = "Improving"
        elif diff <= -2.0:
            trend = "Declining"
        else:
            trend = "Stable"
    else:
        trend = "Stable"

    return {
        "vendor_id": vendor_id,
        "company_name": vendor["company_name"],
        "category": vendor["category"],
        "status": vendor["status"],
        # Performance
        "total_orders": total_orders,
        "delivered_orders": total_delivered,
        "completed_orders": len(completed_orders),
        "on_time_deliveries": on_time_count,
        "delayed_deliveries": delayed_count,
        "avg_delay_days": avg_delay_days,
        "delivery_rate": delivery_history_score,
        "order_completion_rate": order_completion_rate,
        "avg_quality_rating": round(avg_rating, 2),
        "defect_rate": round(defect_rate, 2),
        "avg_response_hours": round(avg_response_hours, 1),
        "total_issues": total_issues,
        "resolved_issues": len(resolved_issues),
        "avg_resolution_hours": avg_resolution_hours,
        # 6 Factors
        "factors": {
            "delivery_history": {
                "score": delivery_history_score,
                "weight": 0.25,
                "weighted_points": round(delivery_history_score * 0.25, 2),
                "description": f"{on_time_count} on-time out of {total_delivered} deliveries"
            },
            "product_quality": {
                "score": quality_score,
                "weight": 0.25,
                "weighted_points": round(quality_score * 0.25, 2),
                "description": f"Avg rating {round(avg_rating, 2)} / 5.0 (Defect rate: {round(defect_rate, 1)}%)"
            },
            "communication_efficiency": {
                "score": comm_score,
                "weight": 0.10,
                "weighted_points": round(comm_score * 0.10, 2),
                "description": f"Avg response time: {round(avg_response_hours, 1)} hours"
            },
            "contract_compliance": {
                "score": compliance_score,
                "weight": 0.15,
                "weighted_points": round(compliance_score * 0.15, 2),
                "description": f"{active_contracts} active contracts, {valid_certs} valid certifications"
            },
            "purchase_history": {
                "score": purchase_history_score,
                "weight": 0.10,
                "weighted_points": round(purchase_history_score * 0.10, 2),
                "description": f"{len(completed_orders)} of {total_orders} orders completed ({order_completion_rate}%)"
            },
            "issue_resolution": {
                "score": resolution_score,
                "weight": 0.15,
                "weighted_points": round(resolution_score * 0.15, 2),
                "description": f"{resolved_within_sla} of {total_issues} issues resolved within SLA"
            }
        },
        "overall_reliability": overall_reliability,
        "risk_level": risk_level,
        "override_reason": override_reason,
        "recommendation": recommendation,
        "recommendation_badge": recommendation_badge,
        "trend": trend,
        "contracts_summary": {
            "total": len(contracts),
            "active": active_contracts,
            "expired": expired_contracts
        },
        "certifications_summary": {
            "total": len(certs),
            "valid": valid_certs,
            "expired": expired_certs
        }
    }
