
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder
from app.models.vendor_performance import VendorPerformance
from app.schemas.vendor_performance import (
    VendorPerformanceCreate,
    VendorPerformanceHistory,
    VendorPerformanceResponse,
    VendorPerformanceSummary,
)

router = APIRouter(
    prefix="/api/vendor-performance",
    tags=["Vendor Performance"],
)

MANAGEMENT_ROLES = {
    "ADMINISTRATOR",
    "PROCUREMENT MANAGER",
    "SUPPLY CHAIN MANAGER",
}


def normalize_role(role: str | None) -> str:
    return (role or "").strip().upper().replace("_", " ")


def decimal_value(value):
    if value is None:
        return None
    return Decimal(str(value))


def rounded(value, places=2):
    if value is None:
        return None

    quantizer = Decimal("1." + ("0" * places))
    return Decimal(str(value)).quantize(
        quantizer,
        rounding=ROUND_HALF_UP,
    )


def calculate_performance_score(
    on_time_rate: Decimal | None,
    completion_rate: Decimal | None,
    quality_rating: Decimal | None,
    service_rating: Decimal | None,
    response_time_hours: Decimal | None,
    issue_resolution_time_hours: Decimal | None,
) -> Decimal:
    """
    Calculate a weighted average using only available measurements.
    Available factor weights are proportionally normalized to 100%.
    """
    weighted_components: list[tuple[Decimal, Decimal]] = []

    # Delivery performance - 30%
    if on_time_rate is not None:
        weighted_components.append(
            (on_time_rate, Decimal("0.30"))
        )

    # Order completion - 20%
    if completion_rate is not None:
        weighted_components.append(
            (completion_rate, Decimal("0.20"))
        )

    # Quality - 20%
    if quality_rating is not None:
        quality_score = (
            quality_rating / Decimal("5")
        ) * Decimal("100")
        weighted_components.append(
            (quality_score, Decimal("0.20"))
        )

    # Service - 15%
    if service_rating is not None:
        service_score = (
            service_rating / Decimal("5")
        ) * Decimal("100")
        weighted_components.append(
            (service_score, Decimal("0.15"))
        )

    # Response time - 7.5%
    if response_time_hours is not None:
        response_score = max(
            Decimal("0"),
            Decimal("100")
            - response_time_hours * Decimal("5"),
        )
        weighted_components.append(
            (response_score, Decimal("0.075"))
        )

    # Issue resolution - 7.5%
    if issue_resolution_time_hours is not None:
        resolution_score = max(
            Decimal("0"),
            Decimal("100")
            - issue_resolution_time_hours * Decimal("2"),
        )
        weighted_components.append(
            (resolution_score, Decimal("0.075"))
        )

    if not weighted_components:
        return Decimal("0.00")

    weighted_total = sum(
        (score * weight for score, weight in weighted_components),
        Decimal("0"),
    )
    available_weight = sum(
        (weight for _, weight in weighted_components),
        Decimal("0"),
    )

    if available_weight == 0:
        return Decimal("0.00")

    normalized_score = weighted_total / available_weight
    return rounded(
        max(
            Decimal("0"),
            min(Decimal("100"), normalized_score),
        )
    )


def build_summary(
    vendor: Vendor,
    db: Session,
) -> VendorPerformanceSummary:
    orders = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.vendor_id == vendor.id)
        .all()
    )

    evaluations = (
        db.query(VendorPerformance)
        .filter(VendorPerformance.vendor_id == vendor.id)
        .all()
    )

    total_orders = len(orders)

    # Keep the latest evaluation for each linked purchase order.
    evaluations_by_po: dict[int, VendorPerformance] = {}

    for evaluation in sorted(
        evaluations,
        key=lambda item: (
            item.evaluation_date,
            item.created_at,
            item.id,
        ),
    ):
        if evaluation.purchase_order_id is not None:
            evaluations_by_po[evaluation.purchase_order_id] = evaluation

    on_time_deliveries = 0
    delayed_deliveries = 0

    for order in orders:
        evaluation = evaluations_by_po.get(order.id)

        # Prefer the delivery date recorded in the purchase order.
        # Use the evaluation date only if the PO has no actual date.
        actual_date = order.actual_delivery_date

        if actual_date is None and evaluation is not None:
            actual_date = evaluation.actual_delivery_date

        if actual_date is None or order.expected_delivery_date is None:
            continue

        if actual_date <= order.expected_delivery_date:
            on_time_deliveries += 1
        else:
            delayed_deliveries += 1

    completed_statuses = {
        "DELIVERED",
        "COMPLETED",
    }

    completed_orders = sum(
        1
        for order in orders
        if (order.status or "").strip().upper()
        in completed_statuses
    )

    # A zero completion rate is displayed when there are no orders,
    # but it is excluded from the score because there is no order data.
    completion_rate = (
        Decimal(completed_orders)
        / Decimal(total_orders)
        * Decimal("100")
        if total_orders > 0
        else Decimal("0")
    )

    delivery_evaluated = (
        on_time_deliveries + delayed_deliveries
    )

    # Missing delivery dates are not treated as failed deliveries.
    on_time_rate = (
        Decimal(on_time_deliveries)
        / Decimal(delivery_evaluated)
        * Decimal("100")
        if delivery_evaluated > 0
        else None
    )

    quality_values = [
        decimal_value(e.quality_rating)
        for e in evaluations
        if e.quality_rating is not None
    ]

    service_values = [
        decimal_value(e.service_rating)
        for e in evaluations
        if e.service_rating is not None
    ]

    response_values = [
        decimal_value(e.response_time_hours)
        for e in evaluations
        if e.response_time_hours is not None
    ]

    resolution_values = [
        decimal_value(e.issue_resolution_time_hours)
        for e in evaluations
        if e.issue_resolution_time_hours is not None
    ]

    quality_rating = (
        sum(quality_values, Decimal("0"))
        / Decimal(len(quality_values))
        if quality_values
        else None
    )

    service_rating = (
        sum(service_values, Decimal("0"))
        / Decimal(len(service_values))
        if service_values
        else None
    )

    response_time_hours = (
        sum(response_values, Decimal("0"))
        / Decimal(len(response_values))
        if response_values
        else None
    )

    issue_resolution_time_hours = (
        sum(resolution_values, Decimal("0"))
        / Decimal(len(resolution_values))
        if resolution_values
        else None
    )

    has_performance_data = (
        on_time_rate is not None
        or total_orders > 0
        or quality_rating is not None
        or service_rating is not None
        or response_time_hours is not None
        or issue_resolution_time_hours is not None
    )

    # Pass None for completion rate when there are no orders,
    # so the missing factor does not reduce the weighted average.
    score_completion_rate = (
        completion_rate if total_orders > 0 else None
    )

    performance_score = calculate_performance_score(
        on_time_rate=on_time_rate,
        completion_rate=score_completion_rate,
        quality_rating=quality_rating,
        service_rating=service_rating,
        response_time_hours=response_time_hours,
        issue_resolution_time_hours=issue_resolution_time_hours,
    )

    if not has_performance_data:
        performance_status = "Not Rated"
    elif performance_score >= 80:
        performance_status = "Excellent"
    elif performance_score >= 65:
        performance_status = "Good"
    elif performance_score >= 50:
        performance_status = "Needs Attention"
    else:
        performance_status = "Poor"

    return VendorPerformanceSummary(
        vendor_id=vendor.id,
        vendor_name=vendor.name,
        category=vendor.category,
        vendor_status=vendor.status,
        total_orders=total_orders,
        on_time_deliveries=on_time_deliveries,
        delayed_deliveries=delayed_deliveries,
        quality_rating=rounded(quality_rating),
        service_rating=rounded(service_rating),
        response_time_hours=rounded(response_time_hours),
        issue_resolution_time_hours=rounded(
            issue_resolution_time_hours
        ),
        order_completion_rate=rounded(completion_rate),
        performance_score=performance_score,
        ranking=0,
        performance_status=performance_status,
    )


@router.get(
    "",
    response_model=list[VendorPerformanceSummary],
)
def get_vendor_performance(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    vendors = (
        db.query(Vendor)
        .order_by(Vendor.name.asc())
        .all()
    )

    summaries = [
        build_summary(vendor, db)
        for vendor in vendors
    ]

    # Rated vendors rank ahead of Not Rated vendors.
    summaries.sort(
        key=lambda item: (
            item.performance_status != "Not Rated",
            item.performance_score,
        ),
        reverse=True,
    )

    rank = 0
    for summary in summaries:
        if summary.performance_status == "Not Rated":
            summary.ranking = 0
        else:
            rank += 1
            summary.ranking = rank

    return summaries


@router.get(
    "/{vendor_id}/history",
    response_model=list[VendorPerformanceHistory],
)
def get_vendor_performance_history(
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
            detail="Vendor not found",
        )

    evaluations = (
        db.query(VendorPerformance)
        .filter(VendorPerformance.vendor_id == vendor_id)
        .order_by(
            VendorPerformance.evaluation_date.desc(),
            VendorPerformance.created_at.desc(),
        )
        .all()
    )

    result = []

    for evaluation in evaluations:
        purchase_order = None

        if evaluation.purchase_order_id:
            purchase_order = (
                db.query(PurchaseOrder)
                .filter(
                    PurchaseOrder.id
                    == evaluation.purchase_order_id
                )
                .first()
            )

        delivery_status = "Not Evaluated"
        expected_date = None

        if purchase_order:
            expected_date = purchase_order.expected_delivery_date

            actual_date = (
                purchase_order.actual_delivery_date
                or evaluation.actual_delivery_date
            )

            if actual_date:
                if actual_date <= purchase_order.expected_delivery_date:
                    delivery_status = "On Time"
                else:
                    delivery_status = "Delayed"

        result.append(
            VendorPerformanceHistory(
                id=evaluation.id,
                vendor_id=vendor.id,
                vendor_name=vendor.name,
                purchase_order_id=evaluation.purchase_order_id,
                purchase_order_number=(
                    purchase_order.po_number
                    if purchase_order
                    else None
                ),
                expected_delivery_date=expected_date,
                actual_delivery_date=(
                    purchase_order.actual_delivery_date
                    or evaluation.actual_delivery_date
                    if purchase_order
                    else evaluation.actual_delivery_date
                ),
                delivery_status=delivery_status,
                quality_rating=evaluation.quality_rating,
                service_rating=evaluation.service_rating,
                response_time_hours=evaluation.response_time_hours,
                issue_resolution_time_hours=(
                    evaluation.issue_resolution_time_hours
                ),
                issue_count=evaluation.issue_count,
                notes=evaluation.notes,
                evaluation_date=evaluation.evaluation_date,
            )
        )

    return result


@router.post(
    "",
    response_model=VendorPerformanceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_vendor_performance(
    performance: VendorPerformanceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = normalize_role(getattr(current_user, "role", None))

    if role not in MANAGEMENT_ROLES:
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have permission to create "
                "vendor performance evaluations"
            ),
        )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == performance.vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    if performance.purchase_order_id:
        purchase_order = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.id
                == performance.purchase_order_id
            )
            .first()
        )

        if not purchase_order:
            raise HTTPException(
                status_code=404,
                detail="Purchase order not found",
            )

        if purchase_order.vendor_id != performance.vendor_id:
            raise HTTPException(
                status_code=400,
                detail="Purchase order does not belong to this vendor",
            )

    new_performance = VendorPerformance(
        vendor_id=performance.vendor_id,
        purchase_order_id=performance.purchase_order_id,
        actual_delivery_date=performance.actual_delivery_date,
        quality_rating=performance.quality_rating,
        service_rating=performance.service_rating,
        response_time_hours=performance.response_time_hours,
        issue_resolution_time_hours=(
            performance.issue_resolution_time_hours
        ),
        issue_count=performance.issue_count,
        notes=performance.notes,
        evaluation_date=performance.evaluation_date,
        created_by=current_user.id,
    )

    db.add(new_performance)
    db.commit()
    db.refresh(new_performance)

    return new_performance


@router.delete(
    "/evaluations/{evaluation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_vendor_performance(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = normalize_role(getattr(current_user, "role", None))

    if role not in MANAGEMENT_ROLES:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to delete evaluations",
        )

    evaluation = (
        db.query(VendorPerformance)
        .filter(VendorPerformance.id == evaluation_id)
        .first()
    )

    if not evaluation:
        raise HTTPException(
            status_code=404,
            detail="Performance evaluation not found",
        )

    db.delete(evaluation)
    db.commit()

    return None