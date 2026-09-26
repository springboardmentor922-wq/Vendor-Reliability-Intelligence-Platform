"""Vendor reliability scoring, risk classification and recommendations.

    python -m services.reliability          # rescore every vendor

--------------------------------------------------------------------------
The six factors
--------------------------------------------------------------------------
Each factor is normalised to 0-100 and carries the weight configured in
``settings.RELIABILITY_WEIGHTS``:

  Delivery History      0.30  on-time rate, penalised by how badly the late
                              orders ran over and by anything overdue now
  Product Quality       0.20  mean recorded quality rating, as a percentage
  Communication         0.15  measured response time and thread resolution
  Contract Compliance   0.15  check results, contract state, certificates
  Purchase History      0.10  depth of the trading relationship
  Issue Resolution      0.10  time to close issues, and how many get closed

The overall score is the weighted mean of whichever factors have evidence
behind them - a factor with no underlying data is dropped and the remaining
weights are renormalised, so a vendor is never punished for a module it has
no history in.

--------------------------------------------------------------------------
Risk level
--------------------------------------------------------------------------
The score maps onto a band through the configured thresholds, and is then
adjusted for two things the score alone cannot express: the model's
forward-looking delay probability, and how much evidence the score rests on.
A vendor with three orders is reported as provisional rather than being
ranked confidently against one with three hundred.
"""

from __future__ import annotations

import json
import math
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from config import settings
from ml import predictor
from models import (
    PerformanceTrend,
    PurchaseOrder,
    PurchaseOrderStatus,
    RiskLevel,
    Vendor,
    VendorReliabilityScore,
    VendorStatus
)
from services.performance import (
    ACTIVE,
    communication_by_vendor,
    compliance_by_vendor,
    performance_trend,
    quality_by_vendor,
    vendor_delivery_summary
)

#: Human-readable labels for the six factors, used in explanations.
FACTOR_LABELS = {
    "delivery": "Delivery History",
    "quality": "Product Quality",
    "communication": "Communication Efficiency",
    "compliance": "Contract Compliance",
    "purchase_history": "Purchase History",
    "issue_resolution": "Issue Resolution",
}


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


# --------------------------------------------------------------------------
# Individual factor scores
# --------------------------------------------------------------------------

def delivery_score(delivery: dict) -> Optional[float]:
    """On-time rate, less a penalty for how badly late orders ran over."""

    if not delivery.get("delivered_orders"):
        return None

    score = float(delivery["on_time_rate"])

    # Being late by a day is not the same as being late by a fortnight.
    score -= min(float(delivery.get("avg_delay_days") or 0) * 4.0, 20.0)

    # Anything sitting past its committed date right now is a live problem.
    total = delivery.get("total_orders") or 1
    overdue_share = (delivery.get("overdue_orders") or 0) / total
    score -= overdue_share * 15.0

    return round(_clamp(score), 2)


#: Quality is scored against the acceptance band rather than the raw 0-5
#: scale. Averaged over hundreds of orders, mean ratings converge into a
#: narrow range, so mapping 0-5 onto 0-100 would compress every supplier into
#: the same few points and the factor would carry no information. The band is
#: what a buyer actually cares about: QUALITY_FLOOR is the minimum acceptable
#: standard, QUALITY_TARGET is the level a supplier is expected to hold.
QUALITY_FLOOR = 2.0
QUALITY_TARGET = 4.5


def quality_score(quality: dict) -> Optional[float]:
    """Mean quality rating, rescaled onto the acceptance band."""

    if not quality or not quality.get("evaluations"):
        return None

    rating = float(quality.get("quality_rating") or 0)

    if rating <= 0:
        return None

    span = QUALITY_TARGET - QUALITY_FLOOR
    scaled = (rating - QUALITY_FLOOR) / span * 100.0

    return round(_clamp(scaled), 2)


def communication_score(communication: dict) -> Optional[float]:
    """Responsiveness: how fast the supplier replies, and how many threads close."""

    if not communication or not communication.get("total_threads"):
        return None

    hours = communication.get("avg_response_hours")

    if hours is None:
        responsiveness = 50.0
    else:
        # Full marks up to two hours, nothing left by about forty.
        responsiveness = _clamp(100.0 - (float(hours) - 2.0) * 2.5)

    resolution_rate = float(communication.get("resolution_rate") or 0)

    return round(_clamp(0.6 * responsiveness + 0.4 * resolution_rate), 2)


def compliance_score(compliance: dict) -> Optional[float]:
    """Check results, adjusted for contract state and certificate validity."""

    if not compliance:
        return None

    checks = compliance.get("total_checks") or 0
    contracts = compliance.get("total_contracts") or 0
    certificates = compliance.get("total_certifications") or 0

    if not (checks or contracts or certificates):
        return None

    if checks:
        # A handful of checks cannot support a 0% or 100% verdict, so the
        # observed rate is smoothed towards a neutral prior. The pull fades
        # as real check history accumulates.
        passed = (
            (compliance.get("compliant_checks") or 0)
            + 0.5 * (compliance.get("partial_checks") or 0)
        )
        prior_weight = 3.0
        prior_rate = 0.75

        score = 100.0 * (
            (passed + prior_weight * prior_rate) / (checks + prior_weight)
        )
    else:
        score = 70.0

    # Contract-level compliance state is independent evidence, so it is
    # blended in rather than only ever subtracting.
    if contracts:
        contract_rate = 100.0 * (
            (compliance.get("compliant_contracts") or 0) / contracts
        )
        score = 0.7 * score + 0.3 * contract_rate

    # A contract flagged non-compliant is a material finding.
    score -= min((compliance.get("non_compliant_contracts") or 0) * 15.0, 30.0)

    # Lapsed paperwork is a compliance failure in its own right.
    score -= min((compliance.get("expired_certifications") or 0) * 10.0, 20.0)
    score -= min((compliance.get("expiring_certifications") or 0) * 3.0, 9.0)

    return round(_clamp(score), 2)


#: Spend at or above this level counts as a fully established relationship.
SPEND_DEPTH_CEILING = 500_000.0


def purchase_history_score(delivery: dict) -> Optional[float]:
    """Depth and cleanliness of the trading relationship.

    Rewards a substantial, consistently completed order book and penalises
    cancellations. Order count is log-scaled so the first orders matter far
    more than the three hundredth, and commercial value is included as well
    as order count - twenty large awards is a deeper relationship than two
    hundred trivial ones.
    """

    total = delivery.get("total_orders") or 0

    if not total:
        return None

    # log10 scaling: 1 order ~ 0, 10 ~ 50, 100 ~ 100.
    order_depth = _clamp(math.log10(total + 1) / 2.0 * 100.0)

    spend = float(delivery.get("total_spend") or 0)
    spend_depth = _clamp(spend / SPEND_DEPTH_CEILING * 100.0)

    depth = 0.5 * order_depth + 0.5 * spend_depth

    completion = float(delivery.get("order_completion_rate") or 0)
    cancellation_rate = 100.0 * (delivery.get("cancelled_orders") or 0) / total

    score = 0.45 * depth + 0.55 * completion - cancellation_rate * 0.5

    return round(_clamp(score), 2)


def issue_resolution_score(quality: dict, communication: dict) -> Optional[float]:
    """How quickly raised issues get closed out."""

    hours = (quality or {}).get("avg_issue_resolution_hours")
    resolution_rate = (communication or {}).get("resolution_rate")

    if not hours and resolution_rate is None:
        return None

    if hours:
        # Full marks inside a working day, nothing left after about a week.
        speed = _clamp(100.0 - (float(hours) - 8.0) * 0.8)
    else:
        speed = 50.0

    if resolution_rate is None:
        return round(_clamp(speed), 2)

    return round(_clamp(0.6 * speed + 0.4 * float(resolution_rate)), 2)


# --------------------------------------------------------------------------
# Aggregation
# --------------------------------------------------------------------------

def combine(factors: dict) -> float:
    """Weighted mean over the factors that actually have evidence."""

    weights = settings.RELIABILITY_WEIGHTS
    total_weight = 0.0
    accumulated = 0.0

    for key, value in factors.items():
        if value is None:
            continue

        weight = weights.get(key, 0.0)
        accumulated += value * weight
        total_weight += weight

    if total_weight <= 0:
        return 0.0

    return round(accumulated / total_weight, 2)


def classify_risk(
    score: float,
    predicted_delay_risk: Optional[float] = None,
    orders: int = 0,
) -> str:
    """Map an overall score onto a procurement risk level.

    The score decides the band; a high model-predicted delay probability can
    push a vendor one band worse, because the score looks backwards and the
    prediction looks forwards.
    """

    if score >= settings.RISK_THRESHOLD_LOW:
        level = RiskLevel.LOW
    elif score >= settings.RISK_THRESHOLD_MEDIUM:
        level = RiskLevel.MEDIUM
    elif score >= settings.RISK_THRESHOLD_HIGH:
        level = RiskLevel.HIGH
    else:
        level = RiskLevel.CRITICAL

    if predicted_delay_risk is not None:
        order = RiskLevel.ALL

        if predicted_delay_risk >= settings.DELAY_RISK_HIGH:
            index = min(order.index(level) + 1, len(order) - 1)
            level = order[index]

    # Too little evidence to call a vendor low risk with confidence.
    if orders < settings.RELIABILITY_MIN_ORDERS and level == RiskLevel.LOW:
        level = RiskLevel.MEDIUM

    return level


def detect_trend(db: Session, vendor_id: int) -> str:
    """Compare the last quarter's on-time rate with the quarter before it."""

    months = performance_trend(db, vendor_id, months=6)

    usable = [m for m in months if m["delivered"] > 0]

    if len(usable) < 4:
        return PerformanceTrend.STABLE

    recent = usable[-3:]
    previous = usable[-6:-3] or usable[:-3]

    if not previous:
        return PerformanceTrend.STABLE

    recent_rate = sum(m["on_time_rate"] for m in recent) / len(recent)
    previous_rate = sum(m["on_time_rate"] for m in previous) / len(previous)

    difference = recent_rate - previous_rate

    if difference >= 3.0:
        return PerformanceTrend.IMPROVING

    if difference <= -3.0:
        return PerformanceTrend.DECLINING

    return PerformanceTrend.STABLE


def predicted_delay_risk(db: Session, vendor_id: int, delivery: dict) -> Optional[float]:
    """Model-estimated probability that this vendor's next delivery is late.

    Scored over the vendor's open purchase orders where there are any, since
    those are the live exposure. With nothing open, a representative order is
    built from the lane the vendor most commonly ships on, so the figure
    still reflects how this vendor actually trades.
    """

    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()

    if not vendor:
        return None

    delivered = delivery.get("delivered_orders") or 0
    prior_late_rate = (
        float(delivery.get("delay_rate") or 0) / 100.0 if delivered else 0.25
    )

    open_orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status.in_(ACTIVE),
        )
        .limit(200)
        .all()
    )

    rows = []

    if open_orders:
        for order in open_orders:
            rows.append(
                predictor.build_feature_row(
                    shipping_mode=order.shipping_mode,
                    market=order.market,
                    order_region=order.order_region,
                    procurement_category=vendor.category,
                    quantity=float(
                        sum((i.quantity or 0) for i in order.items) or 1
                    ),
                    order_value=float(order.total_amount or 0),
                    unit_price=float(
                        order.items[0].unit_price if order.items else 0
                    ),
                    order_month=order.order_date.month if order.order_date else 1,
                    order_quarter=(
                        (order.order_date.month - 1) // 3 + 1
                        if order.order_date
                        else 1
                    ),
                    order_weekday=(
                        order.order_date.weekday() if order.order_date else 0
                    ),
                    vendor_prior_late_rate=prior_late_rate,
                    vendor_prior_orders=delivered,
                )
            )
    else:
        # No live exposure: score the vendor's typical order instead.
        common = (
            db.query(
                PurchaseOrder.shipping_mode,
                PurchaseOrder.market,
                PurchaseOrder.order_region,
                func.count(PurchaseOrder.id).label("n"),
            )
            .filter(PurchaseOrder.vendor_id == vendor_id)
            .group_by(
                PurchaseOrder.shipping_mode,
                PurchaseOrder.market,
                PurchaseOrder.order_region,
            )
            .order_by(func.count(PurchaseOrder.id).desc())
            .first()
        )

        if not common:
            return None

        today = date.today()

        rows.append(
            predictor.build_feature_row(
                shipping_mode=common.shipping_mode,
                market=common.market,
                order_region=common.order_region,
                procurement_category=vendor.category,
                quantity=1.0,
                order_value=float(delivery.get("avg_order_value") or 0),
                unit_price=float(delivery.get("avg_order_value") or 0),
                order_month=today.month,
                order_quarter=(today.month - 1) // 3 + 1,
                order_weekday=today.weekday(),
                vendor_prior_late_rate=prior_late_rate,
                vendor_prior_orders=delivered,
            )
        )

    if not rows:
        return None

    results = predictor.predict_many(rows)

    if not results:
        return None

    average = sum(r["delay_probability"] for r in results) / len(results)

    return round(average, 4)


def build_recommendation(
    factors: dict,
    overall: float,
    risk: str,
    trend: str,
    delivery: dict,
    delay_risk: Optional[float],
) -> str:
    """Plain-language procurement guidance derived from the scores.

    Names the specific weak factors rather than issuing a generic warning,
    so the buyer knows what to raise with the supplier.
    """

    scored = {k: v for k, v in factors.items() if v is not None}
    weakest = sorted(scored.items(), key=lambda kv: kv[1])[:2]
    weak_labels = [FACTOR_LABELS[k] for k, v in weakest if v < 70]

    parts = []

    if risk == RiskLevel.LOW:
        parts.append(
            "Approved for continued and expanded sourcing. Performance is "
            "within tolerance across the scored factors."
        )
    elif risk == RiskLevel.MEDIUM:
        parts.append(
            "Continue sourcing with routine monitoring. Keep a qualified "
            "alternate available for time-critical lines."
        )
    elif risk == RiskLevel.HIGH:
        parts.append(
            "Restrict to non-critical lines until performance recovers. "
            "Place a corrective action plan with agreed review dates."
        )
    else:
        parts.append(
            "Do not award new critical business. Escalate to a formal "
            "performance review and begin qualifying a replacement."
        )

    if weak_labels:
        parts.append(f"Weakest factors: {', '.join(weak_labels)}.")

    on_time = delivery.get("on_time_rate")
    delayed = delivery.get("delayed_deliveries") or 0

    if on_time is not None and delivery.get("delivered_orders"):
        parts.append(
            f"{on_time:.1f}% of {delivery['delivered_orders']} deliveries met "
            f"the committed date ({delayed} late, averaging "
            f"{delivery.get('avg_delay_days', 0):.1f} days over)."
        )

    if delivery.get("overdue_orders"):
        parts.append(
            f"{delivery['overdue_orders']} open order(s) are already past "
            f"the committed date and need chasing."
        )

    if trend == PerformanceTrend.DECLINING:
        parts.append(
            "The last quarter is worse than the one before it - review before "
            "the next award."
        )
    elif trend == PerformanceTrend.IMPROVING:
        parts.append("Recent quarters show a genuine improvement.")

    if delay_risk is not None and delay_risk >= settings.DELAY_RISK_MEDIUM:
        parts.append(
            f"The delay model puts the next delivery at a "
            f"{delay_risk * 100:.0f}% chance of missing its date; consider a "
            f"longer committed lead time or a faster lane."
        )

    return " ".join(parts)


# --------------------------------------------------------------------------
# Public entry points
# --------------------------------------------------------------------------

def score_vendor(
    db: Session,
    vendor_id: int,
    delivery: Optional[dict] = None,
    quality: Optional[dict] = None,
    communication: Optional[dict] = None,
    compliance: Optional[dict] = None,
    include_prediction: bool = True,
) -> dict:
    """Compute the full reliability picture for one vendor.

    The caller may pass precomputed metric dictionaries; when rescoring
    every vendor that avoids re-running the same aggregates per vendor.
    """

    from services.performance import (
        communication_metrics,
        compliance_metrics,
        delivery_metrics,
        quality_metrics
    )

    if delivery is None:
        delivery = delivery_metrics(db, vendor_id)

    if quality is None:
        quality = quality_metrics(db, vendor_id)

    if communication is None:
        communication = communication_metrics(db, vendor_id)

    if compliance is None:
        compliance = compliance_metrics(db, vendor_id)

    factors = {
        "delivery": delivery_score(delivery),
        "quality": quality_score(quality),
        "communication": communication_score(communication),
        "compliance": compliance_score(compliance),
        "purchase_history": purchase_history_score(delivery),
        "issue_resolution": issue_resolution_score(quality, communication),
    }

    overall = combine(factors)

    delay_risk = (
        predicted_delay_risk(db, vendor_id, delivery)
        if include_prediction
        else None
    )

    orders = delivery.get("total_orders") or 0
    risk = classify_risk(overall, delay_risk, orders)
    trend = detect_trend(db, vendor_id)

    recommendation = build_recommendation(
        factors, overall, risk, trend, delivery, delay_risk
    )

    return {
        "vendor_id": vendor_id,
        "overall_score": overall,
        "risk_level": risk,
        "trend": trend,
        "factors": factors,
        "weights": settings.RELIABILITY_WEIGHTS,
        "predicted_delay_risk": delay_risk,
        "recommendation": recommendation,
        "orders_considered": orders,
        "on_time_deliveries": delivery.get("on_time_deliveries", 0),
        "delayed_deliveries": delivery.get("delayed_deliveries", 0),
        "avg_delay_days": delivery.get("avg_delay_days", 0.0),
        "total_spend": delivery.get("total_spend", 0.0),
        "provisional": orders < settings.RELIABILITY_MIN_ORDERS,
        "delivery": delivery,
        "quality": quality,
        "communication": communication,
        "compliance": compliance,
    }


def recalculate_all(db: Session, persist: bool = True) -> list[dict]:
    """Rescore every vendor, rank them and store today's snapshot.

    The bulk metric queries run once for the whole book rather than once per
    vendor, so this stays a handful of queries regardless of vendor count.
    """

    delivery_rows = {
        row["vendor_id"]: row for row in vendor_delivery_summary(db)
    }
    quality_rows = quality_by_vendor(db)
    compliance_rows = compliance_by_vendor(db)
    communication_rows = communication_by_vendor(db)

    from services.performance import compliance_metrics, delivery_metrics

    vendors = db.query(Vendor).all()
    results = []

    for vendor in vendors:
        # The summary row lacks the live counters (overdue, active), so the
        # per-vendor delivery query still runs - it is a single indexed scan.
        delivery = delivery_metrics(db, vendor.id)

        results.append(
            score_vendor(
                db,
                vendor.id,
                delivery=delivery,
                quality=quality_rows.get(vendor.id, {}),
                communication=communication_rows.get(vendor.id, {}),
                compliance=compliance_metrics(db, vendor.id),
            )
        )

    # Rank on the overall score. Only vendors that are actually tradeable
    # and have enough history take a ranking position.
    rankable = [
        r for r in results
        if not r["provisional"]
        and _vendor_status(vendors, r["vendor_id"]) == VendorStatus.APPROVED
    ]

    rankable.sort(key=lambda r: r["overall_score"], reverse=True)

    positions = {r["vendor_id"]: i + 1 for i, r in enumerate(rankable)}

    for result in results:
        result["rank_position"] = positions.get(result["vendor_id"])
        result["ranked_out_of"] = len(rankable)

    if persist:
        _persist(db, results)

    return results


def _vendor_status(vendors, vendor_id):
    for vendor in vendors:
        if vendor.id == vendor_id:
            return vendor.status

    return None


def _persist(db: Session, results: list[dict]) -> None:
    """Write one snapshot per vendor for today and update the vendor row."""

    today = date.today()

    existing = {
        row.vendor_id: row
        for row in db.query(VendorReliabilityScore)
        .filter(VendorReliabilityScore.score_date == today)
        .all()
    }

    for result in results:
        factors = result["factors"]

        values = {
            "delivery_score": Decimal(str(factors["delivery"] or 0)),
            "quality_score": Decimal(str(factors["quality"] or 0)),
            "communication_score": Decimal(str(factors["communication"] or 0)),
            "compliance_score": Decimal(str(factors["compliance"] or 0)),
            "purchase_history_score": Decimal(
                str(factors["purchase_history"] or 0)
            ),
            "issue_resolution_score": Decimal(
                str(factors["issue_resolution"] or 0)
            ),
            "overall_score": Decimal(str(result["overall_score"])),
            "risk_level": result["risk_level"],
            "rank_position": result.get("rank_position"),
            "orders_considered": result["orders_considered"],
            "on_time_deliveries": result["on_time_deliveries"],
            "delayed_deliveries": result["delayed_deliveries"],
            "avg_delay_days": Decimal(str(result["avg_delay_days"] or 0)),
            "total_spend": Decimal(str(result["total_spend"] or 0)),
            "predicted_delay_risk": (
                Decimal(str(result["predicted_delay_risk"]))
                if result["predicted_delay_risk"] is not None
                else None
            ),
            "trend": result["trend"],
            "recommendation": result["recommendation"],
        }

        snapshot = existing.get(result["vendor_id"])

        if snapshot:
            for key, value in values.items():
                setattr(snapshot, key, value)
        else:
            db.add(
                VendorReliabilityScore(
                    vendor_id=result["vendor_id"],
                    score_date=today,
                    **values,
                )
            )

        # Keep the headline score and risk level on the vendor row so the
        # existing vendor list and detail screens stay accurate.
        vendor = db.query(Vendor).filter(
            Vendor.id == result["vendor_id"]
        ).first()

        if vendor:
            vendor.reliability_score = Decimal(str(result["overall_score"]))
            vendor.risk_level = result["risk_level"]

    db.commit()


def backfill_history(db: Session, months: int = 12, step_days: int = 30) -> int:
    """Reconstruct past reliability snapshots so the trend chart has history.

    Each historical snapshot is computed using only the orders and
    evaluations that existed on or before that date, so the curve shows what
    the score would genuinely have read at the time rather than projecting
    today's answer backwards. The forward-looking delay prediction is skipped
    for historical points - it would be scored against orders that had not
    been raised yet.
    """

    from services.performance import (
        communication_metrics,
        compliance_metrics,
        delivery_metrics,
        quality_metrics
    )

    vendors = db.query(Vendor).all()
    today = date.today()

    cutoffs = [
        today - timedelta(days=step_days * offset)
        for offset in range(months, 0, -1)
    ]

    written = 0

    for cutoff in cutoffs:
        existing = {
            row.vendor_id
            for row in db.query(VendorReliabilityScore.vendor_id)
            .filter(VendorReliabilityScore.score_date == cutoff)
            .all()
        }

        snapshots = []

        for vendor in vendors:
            if vendor.id in existing:
                continue

            delivery = delivery_metrics(db, vendor.id, end=cutoff)

            if not delivery.get("total_orders"):
                continue

            quality = quality_metrics(db, vendor.id, end=cutoff)
            communication = communication_metrics(db, vendor.id, end=cutoff)
            compliance = compliance_metrics(db, vendor.id)

            factors = {
                "delivery": delivery_score(delivery),
                "quality": quality_score(quality),
                "communication": communication_score(communication),
                "compliance": compliance_score(compliance),
                "purchase_history": purchase_history_score(delivery),
                "issue_resolution": issue_resolution_score(
                    quality, communication
                ),
            }

            overall = combine(factors)
            orders = delivery.get("total_orders") or 0

            snapshots.append({
                "vendor_id": vendor.id,
                "score_date": cutoff,
                "delivery_score": Decimal(str(factors["delivery"] or 0)),
                "quality_score": Decimal(str(factors["quality"] or 0)),
                "communication_score": Decimal(
                    str(factors["communication"] or 0)
                ),
                "compliance_score": Decimal(str(factors["compliance"] or 0)),
                "purchase_history_score": Decimal(
                    str(factors["purchase_history"] or 0)
                ),
                "issue_resolution_score": Decimal(
                    str(factors["issue_resolution"] or 0)
                ),
                "overall_score": Decimal(str(overall)),
                "risk_level": classify_risk(overall, None, orders),
                "orders_considered": orders,
                "on_time_deliveries": delivery.get("on_time_deliveries", 0),
                "delayed_deliveries": delivery.get("delayed_deliveries", 0),
                "avg_delay_days": Decimal(
                    str(delivery.get("avg_delay_days") or 0)
                ),
                "total_spend": Decimal(str(delivery.get("total_spend") or 0)),
                "trend": PerformanceTrend.STABLE,
            })

        if snapshots:
            db.bulk_insert_mappings(VendorReliabilityScore, snapshots)
            db.commit()
            written += len(snapshots)

    return written


def score_history(
    db: Session, vendor_id: int, limit: int = 90
) -> list[dict]:
    """Stored reliability snapshots for a vendor, oldest first."""

    rows = (
        db.query(VendorReliabilityScore)
        .filter(VendorReliabilityScore.vendor_id == vendor_id)
        .order_by(VendorReliabilityScore.score_date.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "score_date": row.score_date.isoformat(),
            "overall_score": float(row.overall_score or 0),
            "delivery_score": float(row.delivery_score or 0),
            "quality_score": float(row.quality_score or 0),
            "communication_score": float(row.communication_score or 0),
            "compliance_score": float(row.compliance_score or 0),
            "purchase_history_score": float(row.purchase_history_score or 0),
            "issue_resolution_score": float(row.issue_resolution_score or 0),
            "risk_level": row.risk_level,
            "trend": row.trend,
            "rank_position": row.rank_position,
        }
        for row in reversed(rows)
    ]


def latest_scores(db: Session) -> dict[int, VendorReliabilityScore]:
    """Most recent stored snapshot per vendor."""

    newest = (
        db.query(
            VendorReliabilityScore.vendor_id.label("vendor_id"),
            func.max(VendorReliabilityScore.score_date).label("score_date"),
        )
        .group_by(VendorReliabilityScore.vendor_id)
        .subquery()
    )

    rows = (
        db.query(VendorReliabilityScore)
        .join(
            newest,
            (VendorReliabilityScore.vendor_id == newest.c.vendor_id)
            & (VendorReliabilityScore.score_date == newest.c.score_date),
        )
        .all()
    )

    return {row.vendor_id: row for row in rows}


def main():
    import argparse

    from database import SessionLocal

    parser = argparse.ArgumentParser(
        description="Recalculate vendor reliability scores."
    )
    parser.add_argument(
        "--backfill",
        type=int,
        default=0,
        metavar="MONTHS",
        help="also reconstruct this many months of historical snapshots",
    )

    args = parser.parse_args()

    db = SessionLocal()

    try:
        if args.backfill:
            print(f"Backfilling {args.backfill} months of history ...")
            written = backfill_history(db, months=args.backfill)
            print(f"  {written} historical snapshots written")

        print("Scoring every vendor ...")
        results = recalculate_all(db)

        ranked = sorted(
            [r for r in results if r.get("rank_position")],
            key=lambda r: r["rank_position"],
        )

        print(f"\n{len(results)} vendors scored, {len(ranked)} ranked.\n")
        print(f"{'#':>3}  {'Vendor':<30}{'Score':>7} {'Risk':<10}"
              f"{'Trend':<11}{'Delay risk':>11}")
        print("-" * 76)

        for result in ranked:
            vendor = db.query(Vendor).filter(
                Vendor.id == result["vendor_id"]
            ).first()

            delay = result["predicted_delay_risk"]

            print(
                f"{result['rank_position']:>3}  "
                f"{vendor.vendor_name[:29]:<30}"
                f"{result['overall_score']:>7.2f} "
                f"{result['risk_level']:<10}"
                f"{result['trend']:<11}"
                f"{(f'{delay * 100:.1f}%' if delay is not None else '-'):>11}"
            )

    finally:
        db.close()


if __name__ == "__main__":
    main()
