"""Vendor Reliability module (core). Combines six weighted factors into a
single 0-100 score, derives a risk level, computes a trend against the
vendor's own score history, and produces a plain-language recommendation.

Weights and thresholds follow the intern guide's worked example. They are
defined once, here, so the whole calculation stays explainable and
auditable end to end for the final presentation.
"""
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.vendor import Vendor, VendorStatus
from app.models.contract import Contract, Certification, ContractStatus, CertificationStatus
from app.models.reliability import ReliabilityScore, RiskLevel, TrendDirection
from app.services import performance_service

# ---- Weights (must sum to 1.0) ----
WEIGHTS = {
    "delivery": 0.25,
    "quality": 0.25,
    "communication": 0.10,
    "compliance": 0.15,
    "purchase_history": 0.10,
    "issue_resolution": 0.15,
}

# Neutral defaults used only when there isn't yet enough history for a
# factor, so a brand-new vendor isn't unfairly scored as 0.
NEUTRAL_DELIVERY = 50.0
NEUTRAL_QUALITY = 60.0
NEUTRAL_COMMUNICATION = 70.0
NEUTRAL_COMPLIANCE = 60.0
NEUTRAL_PURCHASE_HISTORY = 50.0
NEUTRAL_ISSUE_RESOLUTION = 70.0

MIN_ORDERS_FOR_FULL_PURCHASE_HISTORY = 3


def _delivery_score(db: Session, vendor_id: int) -> float:
    on_time, delayed = performance_service.compute_delivery_metrics(db, vendor_id)
    total = on_time + delayed
    if total == 0:
        return NEUTRAL_DELIVERY
    return round((on_time / total) * 100, 2)


def _quality_score(db: Session, vendor_id: int) -> float:
    rating = performance_service.compute_quality_rating(db, vendor_id)
    if rating == 0.0:
        return NEUTRAL_QUALITY
    return round((rating / 5.0) * 100, 2)


def _communication_score(db: Session, vendor_id: int) -> float:
    """Bands: fast reply (<=4h) = 100, moderate (<=24h) = 70, slow (>24h) = 40."""
    hours = performance_service.compute_response_time_hours(db, vendor_id)
    if hours is None:
        return NEUTRAL_COMMUNICATION
    if hours <= 4:
        return 100.0
    if hours <= 24:
        return 70.0
    return 40.0


def _compliance_score(db: Session, vendor_id: int) -> float:
    """Share of valid certifications + current contract status."""
    certs = db.query(Certification).filter(Certification.vendor_id == vendor_id).all()
    contracts = db.query(Contract).filter(Contract.vendor_id == vendor_id).all()

    if not certs and not contracts:
        return NEUTRAL_COMPLIANCE

    scores = []
    if certs:
        valid = sum(1 for c in certs if c.status == CertificationStatus.VALID)
        scores.append((valid / len(certs)) * 100)

    if contracts:
        # Use the most recently created contract as the vendor's current one
        latest = max(contracts, key=lambda c: c.created_at)
        contract_band = {
            ContractStatus.ACTIVE: 100.0,
            ContractStatus.RENEWED: 100.0,
            ContractStatus.EXPIRING: 70.0,
            ContractStatus.EXPIRED: 0.0,
            ContractStatus.TERMINATED: 0.0,
        }
        scores.append(contract_band.get(latest.status, NEUTRAL_COMPLIANCE))

    return round(sum(scores) / len(scores), 2)


def _purchase_history_score(db: Session, vendor_id: int) -> float:
    """Order completion rate, dampened when there are very few past orders
    so a single lucky (or unlucky) order doesn't swing the score wildly."""
    rate, total_orders = performance_service.compute_order_completion_rate(db, vendor_id)
    if total_orders == 0:
        return NEUTRAL_PURCHASE_HISTORY
    if total_orders < MIN_ORDERS_FOR_FULL_PURCHASE_HISTORY:
        dampening = total_orders / MIN_ORDERS_FOR_FULL_PURCHASE_HISTORY
        rate = max(rate * dampening, 30.0)
    return round(rate, 2)


def _issue_resolution_score(db: Session, vendor_id: int) -> float:
    """Share of issues resolved within an agreed 72-hour window."""
    from app.models.performance import Issue, IssueStatus

    resolved = (
        db.query(Issue)
        .filter(Issue.vendor_id == vendor_id, Issue.status == IssueStatus.RESOLVED, Issue.resolved_at.isnot(None))
        .all()
    )
    total_issues = db.query(func.count(Issue.id)).filter(Issue.vendor_id == vendor_id).scalar() or 0
    if total_issues == 0:
        return NEUTRAL_ISSUE_RESOLUTION

    agreed_hours = 72.0
    on_time = sum(
        1 for i in resolved if (i.resolved_at - i.raised_at).total_seconds() / 3600.0 <= agreed_hours
    )
    return round((on_time / total_issues) * 100, 2)


def _risk_level_from_score(score: float) -> RiskLevel:
    if score >= 80:
        return RiskLevel.LOW
    if score >= 60:
        return RiskLevel.MEDIUM
    return RiskLevel.HIGH


def _apply_override_rules(db: Session, vendor: Vendor, risk_level: RiskLevel) -> RiskLevel:
    """Facts that must raise risk regardless of the numeric score."""
    if vendor.status == VendorStatus.SUSPENDED:
        return RiskLevel.HIGH

    expired_cert = (
        db.query(Certification)
        .filter(Certification.vendor_id == vendor.id, Certification.status == CertificationStatus.EXPIRED)
        .first()
    )
    expired_contract = (
        db.query(Contract)
        .filter(Contract.vendor_id == vendor.id, Contract.status == ContractStatus.EXPIRED)
        .first()
    )
    if (expired_cert or expired_contract) and risk_level == RiskLevel.LOW:
        return RiskLevel.MEDIUM

    return risk_level


def _compute_trend(db: Session, vendor_id: int, new_score: float) -> TrendDirection:
    previous = (
        db.query(ReliabilityScore)
        .filter(ReliabilityScore.vendor_id == vendor_id)
        .order_by(ReliabilityScore.calculated_at.desc())
        .first()
    )
    if not previous:
        return TrendDirection.INSUFFICIENT_DATA

    diff = new_score - previous.score
    if diff > 3:
        return TrendDirection.IMPROVING
    if diff < -3:
        return TrendDirection.DECLINING
    return TrendDirection.STABLE


def _recommendation(risk_level: RiskLevel, trend: TrendDirection) -> str:
    if risk_level == RiskLevel.LOW:
        if trend == TrendDirection.DECLINING:
            return "Preferred vendor — monitor: recent trend is declining."
        return "Preferred vendor. Safe to assign."
    if risk_level == RiskLevel.MEDIUM:
        return "Acceptable with monitoring. Review recent issues before assigning critical orders."
    return "Avoid for critical orders. Needs review before assignment."


def calculate_reliability(db: Session, vendor_id: int, calculated_by_id: Optional[int] = None) -> ReliabilityScore:
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise ValueError("Vendor not found")

    delivery = _delivery_score(db, vendor_id)
    quality = _quality_score(db, vendor_id)
    communication = _communication_score(db, vendor_id)
    compliance = _compliance_score(db, vendor_id)
    purchase_history = _purchase_history_score(db, vendor_id)
    issue_resolution = _issue_resolution_score(db, vendor_id)

    total_score = round(
        delivery * WEIGHTS["delivery"]
        + quality * WEIGHTS["quality"]
        + communication * WEIGHTS["communication"]
        + compliance * WEIGHTS["compliance"]
        + purchase_history * WEIGHTS["purchase_history"]
        + issue_resolution * WEIGHTS["issue_resolution"],
        2,
    )

    risk_level = _risk_level_from_score(total_score)
    risk_level = _apply_override_rules(db, vendor, risk_level)
    trend = _compute_trend(db, vendor_id, total_score)
    recommendation = _recommendation(risk_level, trend)

    record = ReliabilityScore(
        vendor_id=vendor_id,
        score=total_score,
        risk_level=risk_level,
        trend=trend,
        recommendation=recommendation,
        delivery_score=delivery,
        quality_score=quality,
        communication_score=communication,
        compliance_score=compliance,
        purchase_history_score=purchase_history,
        issue_resolution_score=issue_resolution,
        calculated_by_id=calculated_by_id,
        calculated_at=datetime.utcnow(),
    )
    db.add(record)

    # Keep the vendor's headline rating (used elsewhere in the UI) in sync,
    # expressed on the existing 0-5 scale.
    vendor.rating = round(total_score / 20.0, 2)

    db.commit()
    db.refresh(record)
    return record


def get_latest_score(db: Session, vendor_id: int) -> Optional[ReliabilityScore]:
    return (
        db.query(ReliabilityScore)
        .filter(ReliabilityScore.vendor_id == vendor_id)
        .order_by(ReliabilityScore.calculated_at.desc())
        .first()
    )
