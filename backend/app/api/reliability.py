
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder
from app.models.vendor_performance import VendorPerformance
from app.models.contract import Contract
from app.schemas.reliability import (
    ReliabilityFactor,
    ReliabilityTrend,
    VendorReliabilitySummary,
)


router = APIRouter(
    prefix="/api/vendor-reliability",
    tags=["Vendor Reliability"],
)


def decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def round_score(value: Decimal) -> Decimal:
    return value.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def clamp(value: Decimal) -> Decimal:
    return max(Decimal("0"), min(Decimal("100"), value))


def risk_level(score: Decimal) -> str:
    if score >= 75:
        return "Low Risk"
    if score >= 50:
        return "Medium Risk"
    return "High Risk"


def factor_status(score: Decimal | None) -> str:
    if score is None:
        return "No Data"
    if score >= 80:
        return "Strong"
    if score >= 60:
        return "Moderate"
    return "Needs Attention"


def delivery_history_score(
    vendor_id: int,
    db: Session,
) -> Decimal | None:
    evaluations = (
        db.query(VendorPerformance)
        .filter(
            VendorPerformance.vendor_id == vendor_id,
            VendorPerformance.actual_delivery_date.isnot(None),
            VendorPerformance.purchase_order_id.isnot(None),
        )
        .all()
    )

    if not evaluations:
        return None

    on_time = 0
    evaluated_count = 0

    for evaluation in evaluations:
        po = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.id == evaluation.purchase_order_id
            )
            .first()
        )

        if not po or not po.expected_delivery_date:
            continue

        evaluated_count += 1

        if evaluation.actual_delivery_date <= po.expected_delivery_date:
            on_time += 1

    if evaluated_count == 0:
        return None

    return clamp(
        Decimal(on_time)
        / Decimal(evaluated_count)
        * Decimal("100")
    )


def product_quality_score(
    vendor_id: int,
    db: Session,
) -> Decimal | None:
    evaluations = (
        db.query(VendorPerformance)
        .filter(
            VendorPerformance.vendor_id == vendor_id,
            VendorPerformance.quality_rating.isnot(None),
        )
        .all()
    )

    if not evaluations:
        return None

    average = sum(
        (decimal(item.quality_rating) for item in evaluations),
        Decimal("0"),
    ) / Decimal(len(evaluations))

    return clamp(
        average / Decimal("5") * Decimal("100")
    )


def communication_efficiency_score(
    vendor_id: int,
    db: Session,
) -> Decimal | None:
    evaluations = (
        db.query(VendorPerformance)
        .filter(
            VendorPerformance.vendor_id == vendor_id,
            VendorPerformance.response_time_hours.isnot(None),
        )
        .all()
    )

    if not evaluations:
        return None

    average_response = sum(
        (decimal(item.response_time_hours) for item in evaluations),
        Decimal("0"),
    ) / Decimal(len(evaluations))

    return clamp(
        Decimal("100") - average_response * Decimal("5")
    )


def contract_compliance_score(
    vendor_id: int,
    db: Session,
) -> Decimal | None:
    contracts = (
        db.query(Contract)
        .filter(Contract.vendor_id == vendor_id)
        .all()
    )

    if not contracts:
        return None

    compliant = 0

    for contract in contracts:
        compliance = str(
            contract.compliance_status or ""
        ).strip().upper()

        status = str(
            contract.status or ""
        ).strip().upper()

        if (
            compliance in {"COMPLIANT", "APPROVED", "ACTIVE"}
            and status not in {"EXPIRED", "TERMINATED", "CANCELLED"}
        ):
            compliant += 1

    return clamp(
        Decimal(compliant)
        / Decimal(len(contracts))
        * Decimal("100")
    )


def purchase_history_score(
    vendor_id: int,
    db: Session,
) -> Decimal | None:
    orders = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.vendor_id == vendor_id)
        .all()
    )

    if not orders:
        return None

    completed = sum(
        1
        for order in orders
        if str(order.status or "").strip().upper()
        in {"DELIVERED", "COMPLETED"}
    )

    return clamp(
        Decimal(completed)
        / Decimal(len(orders))
        * Decimal("100")
    )


def issue_resolution_score(
    vendor_id: int,
    db: Session,
) -> Decimal | None:
    evaluations = (
        db.query(VendorPerformance)
        .filter(
            VendorPerformance.vendor_id == vendor_id,
            VendorPerformance.issue_resolution_time_hours.isnot(None),
        )
        .all()
    )

    if not evaluations:
        return None

    average_resolution = sum(
        (
            decimal(item.issue_resolution_time_hours)
            for item in evaluations
        ),
        Decimal("0"),
    ) / Decimal(len(evaluations))

    return clamp(
        Decimal("100") - average_resolution * Decimal("2")
    )


def build_recommendations(
    vendor_name: str,
    factors: list[ReliabilityFactor],
    risk: str,
) -> list[str]:
    recommendations: list[str] = []

    for factor in factors:
        if factor.score is None:
            recommendations.append(
                f"Collect {factor.name.lower()} data for {vendor_name}."
            )
        elif factor.score < 50:
            recommendations.append(
                f"Review {factor.name.lower()} for {vendor_name}."
            )

    if risk == "High Risk":
        recommendations.append(
            "Consider additional procurement review before assigning new orders."
        )
    elif risk == "Medium Risk":
        recommendations.append(
            "Monitor vendor performance closely and review risk factors regularly."
        )
    else:
        recommendations.append(
            "Vendor reliability is currently stable; continue routine monitoring."
        )

    return recommendations


def calculate_vendor_reliability(
    vendor: Vendor,
    db: Session,
) -> VendorReliabilitySummary:
    factor_values = [
        (
            "Delivery History",
            delivery_history_score(vendor.id, db),
            "Based on evaluated delivery performance.",
        ),
        (
            "Product Quality",
            product_quality_score(vendor.id, db),
            "Based on recorded product quality ratings.",
        ),
        (
            "Communication Efficiency",
            communication_efficiency_score(vendor.id, db),
            "Based on vendor response time.",
        ),
        (
            "Contract Compliance",
            contract_compliance_score(vendor.id, db),
            "Based on contract compliance records.",
        ),
        (
            "Purchase History",
            purchase_history_score(vendor.id, db),
            "Based on purchase order completion history.",
        ),
        (
            "Issue Resolution",
            issue_resolution_score(vendor.id, db),
            "Based on recorded issue resolution time.",
        ),
    ]

    factors: list[ReliabilityFactor] = []
    available_scores: list[Decimal] = []

    for name, score, description in factor_values:
        if score is not None:
            score = round_score(score)
            available_scores.append(score)

        factors.append(
            ReliabilityFactor(
                name=name,
                score=score,
                description=description,
                status=factor_status(score),
            )
        )

    total_factor_count = len(factors)
    available_factor_count = len(available_scores)

    data_completeness = round_score(
        Decimal(available_factor_count)
        / Decimal(total_factor_count)
        * Decimal("100")
    )

    if available_scores:
        reliability_score = (
            sum(available_scores, Decimal("0"))
            / Decimal(available_factor_count)
        )
    else:
        reliability_score = Decimal("0")

    reliability_score = round_score(clamp(reliability_score))
    risk = risk_level(reliability_score)

    evaluations = (
        db.query(VendorPerformance)
        .filter(VendorPerformance.vendor_id == vendor.id)
        .order_by(VendorPerformance.evaluation_date.asc())
        .all()
    )

    trend: list[ReliabilityTrend] = []

    for evaluation in evaluations:
        quality = (
            decimal(evaluation.quality_rating)
            / Decimal("5")
            * Decimal("100")
            if evaluation.quality_rating is not None
            else None
        )

        service = (
            decimal(evaluation.service_rating)
            / Decimal("5")
            * Decimal("100")
            if evaluation.service_rating is not None
            else None
        )

        response = (
            Decimal("100")
            - decimal(evaluation.response_time_hours) * Decimal("5")
            if evaluation.response_time_hours is not None
            else None
        )

        resolution = (
            Decimal("100")
            - decimal(evaluation.issue_resolution_time_hours) * Decimal("2")
            if evaluation.issue_resolution_time_hours is not None
            else None
        )

        values = [
            value
            for value in [quality, service, response, resolution]
            if value is not None
        ]

        performance_score = (
            clamp(
                sum(values, Decimal("0"))
                / Decimal(len(values))
            )
            if values
            else Decimal("0")
        )

        trend.append(
            ReliabilityTrend(
                evaluation_date=evaluation.evaluation_date,
                performance_score=round_score(performance_score),
                reliability_score=reliability_score,
            )
        )

    recommendations = build_recommendations(
        vendor.name,
        factors,
        risk,
    )

    return VendorReliabilitySummary(
        vendor_id=vendor.id,
        vendor_name=vendor.name,
        category=vendor.category,
        vendor_status=vendor.status,
        reliability_score=reliability_score,
        supplier_ranking=0,
        procurement_risk_level=risk,
        data_completeness=data_completeness,
        available_factor_count=available_factor_count,
        total_factor_count=total_factor_count,
        factors=factors,
        trend=trend,
        recommendations=recommendations,
    )


@router.get(
    "",
    response_model=list[VendorReliabilitySummary],
)
def get_vendor_reliability(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    vendors = (
        db.query(Vendor)
        .order_by(Vendor.name.asc())
        .all()
    )

    results = [
        calculate_vendor_reliability(vendor, db)
        for vendor in vendors
    ]

    results.sort(
        key=lambda item: item.reliability_score,
        reverse=True,
    )

    for index, item in enumerate(results, start=1):
        item.supplier_ranking = index

    return results


@router.get("/risk-analysis")
def get_risk_analysis(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    vendors = (
        db.query(Vendor)
        .order_by(Vendor.name.asc())
        .all()
    )

    summaries = [
        calculate_vendor_reliability(vendor, db)
        for vendor in vendors
    ]

    distribution = {
        "Low Risk": 0,
        "Medium Risk": 0,
        "High Risk": 0,
    }

    vendor_rows = []

    for summary in summaries:
        risk = summary.procurement_risk_level
        distribution[risk] += 1

        order_count = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.vendor_id == summary.vendor_id
            )
            .count()
        )

        vendor_rows.append({
            "vendor_id": summary.vendor_id,
            "vendor_name": summary.vendor_name,
            "category": summary.category,
            "vendor_status": summary.vendor_status,
            "reliability_score": float(summary.reliability_score),
            "procurement_risk_level": risk,
            "data_completeness": float(summary.data_completeness),
            "available_factor_count": summary.available_factor_count,
            "total_factor_count": summary.total_factor_count,
            "purchase_order_count": order_count,
            "factors": [
                {
                    "name": factor.name,
                    "score": (
                        float(factor.score)
                        if factor.score is not None
                        else None
                    ),
                    "status": factor.status,
                    "description": factor.description,
                }
                for factor in summary.factors
            ],
            "risk_explanation": (
                f"{risk} is assigned because the calculated reliability "
                f"score is {summary.reliability_score} out of 100. "
                "The factor scores provide the recorded evidence."
            ),
            "recommendations": summary.recommendations,
        })

    return {
        "total_vendors": len(vendor_rows),
        "total_purchase_orders": db.query(PurchaseOrder).count(),
        "risk_distribution": distribution,
        "risk_thresholds": {
            "Low Risk": "Reliability score >= 75",
            "Medium Risk": "Reliability score >= 50 and < 75",
            "High Risk": "Reliability score < 50",
        },
        "vendors": vendor_rows,
    }


@router.get(
    "/{vendor_id}",
    response_model=VendorReliabilitySummary,
)
def get_vendor_reliability_by_id(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found.",
        )

    results = get_vendor_reliability(
        db=db,
        current_user=current_user,
    )

    for item in results:
        if item.vendor_id == vendor_id:
            return item

    raise HTTPException(
        status_code=404,
        detail="Reliability data not found.",
    )