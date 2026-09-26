"""Vendor reliability scoring, ranking, risk and predictions.

Read access follows the same vendor scoping as the rest of the platform: a
supplier login only ever sees its own score. Recalculation is restricted to
procurement and supply chain staff.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import (
    assert_vendor_access,
    get_current_user,
    require_procurement_or_supply_chain,
    vendor_scope
)
from ml import predictor
from models import (
    DelayPrediction,
    PurchaseOrder,
    RiskLevel,
    User,
    Vendor,
    VendorReliabilityScore
)
from services import reliability as engine
from services.analytics import Filters, risk_breakdown, vendor_ranking
from services.events import log_activity

router = APIRouter(prefix="/reliability", tags=["Vendor Reliability"])


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class FactorBreakdown(BaseModel):
    delivery: Optional[float] = None
    quality: Optional[float] = None
    communication: Optional[float] = None
    compliance: Optional[float] = None
    purchase_history: Optional[float] = None
    issue_resolution: Optional[float] = None


class ReliabilityResponse(BaseModel):
    vendor_id: int
    vendor_name: Optional[str] = None
    vendor_code: Optional[str] = None
    category: Optional[str] = None
    overall_score: float
    risk_level: str
    trend: Optional[str] = None
    rank_position: Optional[int] = None
    ranked_out_of: Optional[int] = None
    factors: FactorBreakdown
    weights: dict[str, float]
    predicted_delay_risk: Optional[float] = None
    recommendation: str
    orders_considered: int
    on_time_deliveries: int
    delayed_deliveries: int
    avg_delay_days: float
    total_spend: float
    provisional: bool
    delivery: dict
    quality: dict
    communication: dict
    compliance: dict


class RankingRow(BaseModel):
    vendor_id: int
    vendor_code: str
    vendor_name: str
    category: str
    status: str
    risk_level: str
    reliability_score: float
    rank_position: Optional[int] = None
    trend: Optional[str] = None
    delivery_score: float
    quality_score: float
    communication_score: float
    compliance_score: float
    orders_considered: int
    on_time_deliveries: int
    delayed_deliveries: int
    total_spend: float
    predicted_delay_risk: Optional[float] = None


class HistoryPoint(BaseModel):
    score_date: str
    overall_score: float
    delivery_score: float
    quality_score: float
    communication_score: float
    compliance_score: float
    purchase_history_score: float
    issue_resolution_score: float
    risk_level: Optional[str] = None
    trend: Optional[str] = None
    rank_position: Optional[int] = None


class PredictionResponse(BaseModel):
    purchase_order_id: Optional[int] = None
    po_number: Optional[str] = None
    vendor_id: int
    vendor_name: Optional[str] = None
    delay_probability: float
    predicted_late: bool
    risk_band: str
    model_version: str
    expected_delivery: Optional[date] = None
    explanation: str


class ModelInfo(BaseModel):
    ready: bool
    model_version: str
    metrics: Optional[dict] = None
    thresholds: dict[str, float]


class RecalculateResponse(BaseModel):
    vendors_scored: int
    vendors_ranked: int
    risk_distribution: dict[str, int]
    calculated_at: datetime


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def _decorate(db: Session, result: dict) -> ReliabilityResponse:
    vendor = db.query(Vendor).filter(Vendor.id == result["vendor_id"]).first()

    return ReliabilityResponse(
        **{
            **result,
            "factors": FactorBreakdown(**result["factors"]),
            "vendor_name": vendor.vendor_name if vendor else None,
            "vendor_code": vendor.vendor_code if vendor else None,
            "category": vendor.category if vendor else None,
        }
    )


def _explain(probability: float, order, vendor) -> str:
    """One sentence saying why the model gave this answer."""

    band = predictor.risk_band(probability)

    lane = (order.shipping_mode if order else None) or "the standard lane"
    name = vendor.vendor_name if vendor else "this vendor"

    if band == "Low":
        return (
            f"{name} has a strong record on {lane}; this delivery is expected "
            f"to meet its committed date."
        )

    if band == "Medium":
        return (
            f"{lane} shipments from {name} have historically slipped often "
            f"enough to be worth watching. Re-confirm the date with the "
            f"supplier."
        )

    return (
        f"{lane} is the weakest lane in the order book and {name}'s record on "
        f"it is poor. Expedite, extend the committed date, or place the "
        f"order with an alternative supplier."
    )


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------

@router.get("/model", response_model=ModelInfo)
def model_info(current_user: User = Depends(get_current_user)):
    """What the delivery-delay model is, and how well it scored."""

    return ModelInfo(
        ready=predictor.is_ready(),
        model_version=predictor.model_version(),
        metrics=predictor.load_metrics(),
        thresholds={
            "delay_risk_medium": settings.DELAY_RISK_MEDIUM,
            "delay_risk_high": settings.DELAY_RISK_HIGH,
            "risk_threshold_low": settings.RISK_THRESHOLD_LOW,
            "risk_threshold_medium": settings.RISK_THRESHOLD_MEDIUM,
            "risk_threshold_high": settings.RISK_THRESHOLD_HIGH,
        },
    )


@router.get("/ranking", response_model=list[RankingRow])
def ranking(
    category: Optional[str] = Query(default=None),
    risk_level: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supplier ranking, best reliability first."""

    scope = vendor_scope(current_user)

    filters = Filters(
        vendor_id=scope,
        category=category,
        risk_level=risk_level,
    )

    return [RankingRow(**row) for row in vendor_ranking(db, filters, limit)]


@router.get("/risk")
def risk_summary(
    category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Risk distribution plus the vendors that need attention."""

    scope = vendor_scope(current_user)

    return risk_breakdown(db, Filters(vendor_id=scope, category=category))


@router.get("/vendor/{vendor_id}", response_model=ReliabilityResponse)
def vendor_reliability(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The full six-factor breakdown for one vendor, computed live."""

    assert_vendor_access(current_user, vendor_id)

    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found"
        )

    result = engine.score_vendor(db, vendor_id)

    snapshot = (
        db.query(VendorReliabilityScore)
        .filter(VendorReliabilityScore.vendor_id == vendor_id)
        .order_by(VendorReliabilityScore.score_date.desc())
        .first()
    )

    result["rank_position"] = snapshot.rank_position if snapshot else None
    result["ranked_out_of"] = (
        db.query(VendorReliabilityScore)
        .filter(
            VendorReliabilityScore.score_date == snapshot.score_date,
            VendorReliabilityScore.rank_position.isnot(None),
        )
        .count()
        if snapshot
        else None
    )

    return _decorate(db, result)


@router.get("/vendor/{vendor_id}/history", response_model=list[HistoryPoint])
def vendor_history(
    vendor_id: int,
    limit: int = Query(default=60, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stored reliability snapshots for a vendor, oldest first."""

    assert_vendor_access(current_user, vendor_id)

    return [HistoryPoint(**row) for row in engine.score_history(db, vendor_id, limit)]


@router.get("/vendor/{vendor_id}/recommendation")
def vendor_recommendation(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Procurement guidance for a vendor, with the factors behind it."""

    assert_vendor_access(current_user, vendor_id)

    result = engine.score_vendor(db, vendor_id)

    weakest = sorted(
        [(k, v) for k, v in result["factors"].items() if v is not None],
        key=lambda kv: kv[1],
    )

    return {
        "vendor_id": vendor_id,
        "risk_level": result["risk_level"],
        "overall_score": result["overall_score"],
        "trend": result["trend"],
        "recommendation": result["recommendation"],
        "predicted_delay_risk": result["predicted_delay_risk"],
        "weakest_factors": [
            {
                "factor": key,
                "label": engine.FACTOR_LABELS[key],
                "score": value,
            }
            for key, value in weakest[:3]
        ],
        "strongest_factors": [
            {
                "factor": key,
                "label": engine.FACTOR_LABELS[key],
                "score": value,
            }
            for key, value in reversed(weakest[-3:])
        ],
    }


@router.get("/predictions", response_model=list[PredictionResponse])
def open_order_predictions(
    vendor_id: Optional[int] = Query(default=None),
    risk_band: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delay predictions for every open purchase order."""

    from models import PurchaseOrderStatus

    scope = vendor_scope(current_user)
    target = scope if scope is not None else vendor_id

    query = db.query(PurchaseOrder).filter(
        PurchaseOrder.status.in_([
            PurchaseOrderStatus.PENDING,
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.ORDERED,
        ])
    )

    if target:
        query = query.filter(PurchaseOrder.vendor_id == target)

    orders = query.order_by(PurchaseOrder.expected_delivery.asc()).limit(limit).all()

    if not orders:
        return []

    rows = []

    for order in orders:
        vendor = order.vendor

        rows.append(
            predictor.build_feature_row(
                shipping_mode=order.shipping_mode,
                market=order.market,
                order_region=order.order_region,
                procurement_category=vendor.category if vendor else None,
                quantity=float(sum((i.quantity or 0) for i in order.items) or 1),
                order_value=float(order.total_amount or 0),
                unit_price=float(order.items[0].unit_price if order.items else 0),
                order_month=order.order_date.month if order.order_date else 1,
                order_quarter=(
                    (order.order_date.month - 1) // 3 + 1
                    if order.order_date
                    else 1
                ),
                order_weekday=(
                    order.order_date.weekday() if order.order_date else 0
                ),
                vendor_prior_late_rate=(
                    float(1 - (vendor.reliability_score or 70) / 100)
                    if vendor
                    else 0.25
                ),
                vendor_prior_orders=50,
            )
        )

    predictions = predictor.predict_many(rows)
    results = []

    for order, prediction in zip(orders, predictions):
        if risk_band and prediction["risk_band"] != risk_band:
            continue

        vendor = order.vendor

        results.append(
            PredictionResponse(
                purchase_order_id=order.id,
                po_number=order.po_number,
                vendor_id=order.vendor_id,
                vendor_name=vendor.vendor_name if vendor else None,
                expected_delivery=order.expected_delivery,
                explanation=_explain(
                    prediction["delay_probability"], order, vendor
                ),
                **prediction,
            )
        )

    return results


@router.get(
    "/predictions/purchase-order/{order_id}", response_model=PredictionResponse
)
def predict_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Score one purchase order, and store the result for the audit trail."""

    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )

    assert_vendor_access(current_user, order.vendor_id)

    vendor = order.vendor

    result = predictor.predict_one(
        shipping_mode=order.shipping_mode,
        market=order.market,
        order_region=order.order_region,
        procurement_category=vendor.category if vendor else None,
        quantity=float(sum((i.quantity or 0) for i in order.items) or 1),
        order_value=float(order.total_amount or 0),
        unit_price=float(order.items[0].unit_price if order.items else 0),
        order_month=order.order_date.month if order.order_date else 1,
        order_quarter=(
            (order.order_date.month - 1) // 3 + 1 if order.order_date else 1
        ),
        order_weekday=order.order_date.weekday() if order.order_date else 0,
        vendor_prior_late_rate=(
            float(1 - (vendor.reliability_score or 70) / 100) if vendor else 0.25
        ),
        vendor_prior_orders=50,
    )

    features = result.pop("features", {})

    db.add(
        DelayPrediction(
            purchase_order_id=order.id,
            vendor_id=order.vendor_id,
            delay_probability=Decimal(str(result["delay_probability"])),
            predicted_late=result["predicted_late"],
            risk_band=result["risk_band"],
            model_version=result["model_version"],
            features=json.dumps(features),
        )
    )

    db.commit()

    return PredictionResponse(
        purchase_order_id=order.id,
        po_number=order.po_number,
        vendor_id=order.vendor_id,
        vendor_name=vendor.vendor_name if vendor else None,
        expected_delivery=order.expected_delivery,
        explanation=_explain(result["delay_probability"], order, vendor),
        **result,
    )


@router.post("/recalculate", response_model=RecalculateResponse)
def recalculate(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain),
):
    """Rescore every vendor and store today's snapshot."""

    results = engine.recalculate_all(db)

    distribution: dict[str, int] = {}

    for result in results:
        distribution[result["risk_level"]] = (
            distribution.get(result["risk_level"], 0) + 1
        )

    log_activity(
        db,
        current_user.id,
        "Vendor",
        None,
        "Reliability Recalculated",
        f"Reliability scores recalculated for {len(results)} vendor(s)",
    )

    db.commit()

    return RecalculateResponse(
        vendors_scored=len(results),
        vendors_ranked=sum(1 for r in results if r.get("rank_position")),
        risk_distribution=distribution,
        calculated_at=datetime.now(),
    )
