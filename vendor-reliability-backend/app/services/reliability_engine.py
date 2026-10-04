from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder
from app.models.delivery import Delivery
from app.models.vendor_metrics import VendorPerformance, VendorRisk
from app.models.communication import AuditLog

def calculate_vendor_metrics(db: Session, vendor_id: int) -> dict:
    """
    Computes comprehensive vendor reliability and risk metrics based on actual historical delivery data.
    Enforces Steps 31, 32, 33, 34 of the enterprise lifecycle.
    """
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        return {}

    # Query all completed deliveries for this vendor's POs
    deliveries = db.query(Delivery).join(PurchaseOrder).filter(
        PurchaseOrder.vendor_id == vendor_id
    ).all()

    total_deliveries = len(deliveries)
    completed_pos = db.query(PurchaseOrder).filter(
        PurchaseOrder.vendor_id == vendor_id,
        PurchaseOrder.status.in_(["Delivered", "Completed"])
    ).count()

    cancelled_pos = db.query(PurchaseOrder).filter(
        PurchaseOrder.vendor_id == vendor_id,
        PurchaseOrder.status == "Cancelled"
    ).count()

    total_pos = db.query(PurchaseOrder).filter(
        PurchaseOrder.vendor_id == vendor_id
    ).count()

    partial_count = 0
    delayed_count = 0
    on_time_count = 0
    total_delays = 0

    if total_deliveries == 0:
        # Default baseline if no deliveries recorded yet (new vendor without task history)
        on_time_rate = 0.0
        fulfillment_rate = 0.0
        avg_delay = 0.0
        delay_freq = 0.0
        quality_rating = 0.0
        reliability_score = 0.0
        delay_risk = 0.0
        fulfillment_risk = 0.0
        quality_risk = 0.0
        risk_score = 0.0
        risk_level = "Low"
        notes = "Newly registered vendor. No completed orders or deliveries yet (Reliability score: 0)."
        risk_reasons_list = ["No historical delivery activity yet"]
    else:
        on_time_count = sum(1 for d in deliveries if d.delay_days <= 0)
        delayed_count = sum(1 for d in deliveries if d.delay_days > 0)
        partial_count = sum(1 for d in deliveries if d.delivered_quantity < d.ordered_quantity)
        total_delays = sum(max(0, d.delay_days) for d in deliveries)

        on_time_rate = (on_time_count / total_deliveries) * 100.0
        delay_freq = (delayed_count / total_deliveries)

        total_ordered = sum(d.ordered_quantity for d in deliveries)
        total_delivered = sum(d.delivered_quantity for d in deliveries)
        fulfillment_rate = (total_delivered / total_ordered * 100.0) if total_ordered > 0 else 100.0
        fulfillment_rate = min(fulfillment_rate, 100.0)

        avg_delay = total_delays / total_deliveries

        quality_rating = vendor.quality_rating or 4.0
        quality_pct = (quality_rating / 5.0) * 100.0

        # Step 32: System calculates vendor reliability
        reliability_score = (0.45 * on_time_rate) + (0.35 * fulfillment_rate) + (0.20 * quality_pct)
        reliability_score = round(max(0.0, min(100.0, reliability_score)), 1)

        # Step 33: System analyzes vendor risk
        delay_risk = min(40.0, avg_delay * 8.0)
        fulfillment_risk = max(0.0, (100.0 - fulfillment_rate) * 0.5)
        quality_risk = max(0.0, (5.0 - quality_rating) * 6.0)

        risk_score = round(delay_risk + fulfillment_risk + quality_risk, 1)

        # Compute human-readable, specific Risk Reasons
        risk_reasons_list = []
        if delayed_count > 0:
            risk_reasons_list.append(f"Recent delivery delays ({delayed_count} delayed shipment{'s' if delayed_count > 1 else ''})")
        if avg_delay >= 1.5:
            risk_reasons_list.append(f"Increasing delay frequency (average {avg_delay:.1f} days SLA delay)")
        if partial_count > 0:
            risk_reasons_list.append(f"Multiple partial deliveries ({partial_count} partial shipment{'s' if partial_count > 1 else ''})")
        if fulfillment_rate < 95.0:
            risk_reasons_list.append(f"Order fulfillment shortfall ({fulfillment_rate:.1f}% units delivered)")
        if cancelled_pos > 0:
            risk_reasons_list.append(f"Order cancellations on record ({cancelled_pos} cancelled)")
        if quality_rating < 4.0:
            risk_reasons_list.append(f"Quality rating variance ({quality_rating:.1f}/5.0)")

        if on_time_rate >= 92.0 and delayed_count <= 3 and partial_count <= 1 and risk_score < 30.0:
            risk_level = "Low"
            notes = "Consistently high delivery reliability and minimal fulfillment variance."
            if not risk_reasons_list:
                risk_reasons_list = ["Consistent on-time delivery record", "Compliant fulfillment standard"]
        elif on_time_rate >= 80.0 and delayed_count <= 7 and partial_count <= 3 and risk_score < 55.0:
            risk_level = "Medium"
            notes = "Moderate reliability with occasional delivery delays or slight lead-time variance."
            if not risk_reasons_list:
                risk_reasons_list = ["Occasional delivery delays", "Moderate lead-time variance"]
        else:
            risk_level = "High"
            notes = "Critical risk: frequent delays, low fulfillment rate, or high delivery failure variance."
            if not risk_reasons_list:
                risk_reasons_list = ["Repeated delivery delays", "Increasing delay frequency", "Multiple partial deliveries"]

    import json
    risk_reasons_json = json.dumps(risk_reasons_list)

    # Update or create VendorPerformance record
    perf = db.query(VendorPerformance).filter(VendorPerformance.vendor_id == vendor_id).first()
    if not perf:
        perf = VendorPerformance(vendor_id=vendor_id)
        db.add(perf)

    perf.total_orders = total_pos
    perf.completed_orders = completed_pos
    perf.on_time_deliveries = on_time_count
    perf.delayed_deliveries = delayed_count
    perf.partial_deliveries = partial_count
    perf.cancelled_orders = cancelled_pos
    perf.delay_frequency = round(delay_freq, 2)
    perf.on_time_rate = round(on_time_rate, 1)
    perf.fulfillment_rate = round(fulfillment_rate, 1)
    perf.quality_rating = round(quality_rating, 2)
    perf.reliability_score = round(reliability_score, 1)
    perf.average_delay_days = round(avg_delay, 1)
    perf.updated_at = datetime.utcnow()

    # Update or create VendorRisk record
    risk_rec = db.query(VendorRisk).filter(VendorRisk.vendor_id == vendor_id).first()
    if not risk_rec:
        risk_rec = VendorRisk(vendor_id=vendor_id)
        db.add(risk_rec)

    risk_rec.risk_level = risk_level
    risk_rec.risk_score = risk_score
    risk_rec.delay_risk_factor = round(delay_risk, 1)
    risk_rec.fulfillment_risk_factor = round(fulfillment_risk, 1)
    risk_rec.quality_risk_factor = round(quality_risk, 1)
    risk_rec.risk_reasons = risk_reasons_json
    risk_rec.assessment_notes = notes
    risk_rec.evaluated_at = datetime.utcnow()

    # Sync Vendor attributes for seamless compatibility
    vendor.deliveryRate = round(on_time_rate, 1)
    vendor.risk_level = risk_level

    db.commit()

    return {
        "vendor_id": vendor_id,
        "vendor_name": vendor.name,
        "reliability_score": reliability_score,
        "on_time_rate": round(on_time_rate, 1),
        "fulfillment_rate": round(fulfillment_rate, 1),
        "quality_rating": round(quality_rating, 2),
        "average_delay_days": round(avg_delay, 1),
        "risk_level": risk_level,
        "risk_score": risk_score,
        "risk_reasons": risk_reasons_list,
        "notes": notes
    }

def calculate_vendor_metrics_async(vendor_id: int):
    """
    Non-blocking background recalculation of vendor reliability and risk metrics.
    Runs after delivery receipt or completion in FastAPI background tasks.
    """
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        calculate_vendor_metrics(db, vendor_id)
    except Exception as e:
        try:
            db.rollback()
        except:
            pass
    finally:
        db.close()

