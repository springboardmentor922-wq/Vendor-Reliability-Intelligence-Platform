from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from models import (
    Vendor,
    VendorPerformance,
    PurchaseOrder,
    Communication,
    ComplianceDocument,
)


PERFORMANCE_WEIGHTS = {
    "delivery": Decimal("40"),
    "quality": Decimal("25"),
    "communication": Decimal("15"),
    "compliance": Decimal("20"),
}


def calculate_vendor_performance(
    db: Session,
    vendor_id: int,
):
    """
    Recalculate vendor performance from actual database activity.

    Delivery:
        On-time delivered POs / evaluable delivered POs * 100

    Quality:
        100 when the vendor has at least one delivered PO.
        No data when there are no delivered POs.

    Communication:
        100 when at least one communication exists.
        No data when there are no communications.

    Compliance:
        Verified + valid compliance documents /
        total compliance documents * 100.

    Overall:
        Weighted average using only metrics that have data.

    Reliability:
        Same value as calculated overall performance.
    """

    # ========================================================
    # GET VENDOR
    # ========================================================

    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == vendor_id
        )
        .first()
    )

    if not vendor:
        return None

    # ========================================================
    # DELIVERY
    # ========================================================

    delivered_pos = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status == "delivered",
            PurchaseOrder.expected_delivery_date.isnot(None),
            PurchaseOrder.actual_delivery_date.isnot(None),
        )
        .all()
    )

    delivery_score = None

    if delivered_pos:

        on_time_count = 0

        for po in delivered_pos:

            if (
                po.actual_delivery_date
                <= po.expected_delivery_date
            ):
                on_time_count += 1

        delivery_score = (
            Decimal(str(on_time_count))
            / Decimal(str(len(delivered_pos)))
        ) * Decimal("100")

        delivery_score = delivery_score.quantize(
            Decimal("0.01")
        )

    # ========================================================
    # QUALITY
    # ========================================================

    delivered_po_count = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status == "delivered",
        )
        .count()
    )

    if delivered_po_count > 0:
        quality_score = Decimal("100.00")
    else:
        quality_score = None

    # ========================================================
    # COMMUNICATION
    # ========================================================

    communication_count = (
        db.query(Communication)
        .filter(
            Communication.vendor_id == vendor_id
        )
        .count()
    )

    if communication_count > 0:
        communication_score = Decimal("100.00")
    else:
        communication_score = None

    # ========================================================
    # COMPLIANCE
    # ========================================================

    compliance_documents = (
        db.query(ComplianceDocument)
        .filter(
            ComplianceDocument.vendor_id == vendor_id
        )
        .all()
    )

    compliance_score = None

    if compliance_documents:

        valid_verified_count = 0

        for document in compliance_documents:

            verification_status = str(
                document.verification_status or ""
            ).lower().strip()

            # Document must be verified.
            if verification_status != "verified":
                continue

            # If expiry date exists, it must not be expired.
            if document.expiry_date is not None:

                if document.expiry_date < date.today():
                    continue

            valid_verified_count += 1

        compliance_score = (
            Decimal(str(valid_verified_count))
            / Decimal(str(len(compliance_documents)))
        ) * Decimal("100")

        compliance_score = compliance_score.quantize(
            Decimal("0.01")
        )

    # ========================================================
    # OVERALL PERFORMANCE
    # ========================================================

    metrics = []

    if delivery_score is not None:
        metrics.append(
            (
                delivery_score,
                PERFORMANCE_WEIGHTS["delivery"],
            )
        )

    if quality_score is not None:
        metrics.append(
            (
                quality_score,
                PERFORMANCE_WEIGHTS["quality"],
            )
        )

    if communication_score is not None:
        metrics.append(
            (
                communication_score,
                PERFORMANCE_WEIGHTS["communication"],
            )
        )

    if compliance_score is not None:
        metrics.append(
            (
                compliance_score,
                PERFORMANCE_WEIGHTS["compliance"],
            )
        )

    overall_score = None

    if metrics:

        total_weight = sum(
            weight
            for _, weight in metrics
        )

        weighted_total = sum(
            score * weight
            for score, weight in metrics
        )

        if total_weight > 0:

            overall_score = (
                weighted_total
                / total_weight
            )

            overall_score = overall_score.quantize(
                Decimal("0.01")
            )

    # ========================================================
    # SAVE VENDOR PERFORMANCE
    # ========================================================

    performance = (
        db.query(VendorPerformance)
        .filter(
            VendorPerformance.vendor_id == vendor_id
        )
        .order_by(
            VendorPerformance.id.desc()
        )
        .first()
    )

    if not performance:

        performance = VendorPerformance(
            vendor_id=vendor_id,
            evaluation_date=date.today(),
        )

        db.add(performance)

    performance.evaluation_date = date.today()

    performance.delivery_score = (
        delivery_score
    )

    performance.quality_score = (
        quality_score
    )

    performance.communication_score = (
        communication_score
    )

    performance.compliance_score = (
        compliance_score
    )

    performance.overall_score = (
        overall_score
    )

    # ========================================================
    # UPDATE VENDOR RELIABILITY
    # ========================================================

    vendor.reliability_score = (
        overall_score
    )

    db.flush()

    return {
        "vendor_id": vendor_id,
        "delivery_score": delivery_score,
        "quality_score": quality_score,
        "communication_score": communication_score,
        "compliance_score": compliance_score,
        "overall_score": overall_score,
        "reliability_score": overall_score,
    }


def recalculate_all_vendor_performance(
    db: Session,
):
    """
    Recalculate performance for every vendor.
    """

    vendors = (
        db.query(Vendor)
        .all()
    )

    results = []

    for vendor in vendors:

        result = calculate_vendor_performance(
            db,
            vendor.id,
        )

        if result:
            results.append(result)

    db.commit()

    return results