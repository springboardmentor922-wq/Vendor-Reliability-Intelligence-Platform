from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Vendor,
    VendorPerformance,
    PurchaseOrder,
    Communication,
    ComplianceDocument,
)
from auth import get_current_user, require_role


router = APIRouter(
    prefix="/performance",
    tags=["Vendor Performance"],
)


# ============================================================
# SCORE VALIDATION
# ============================================================

def convert_score(value, field_name):
    try:
        score = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be a number between 0 and 100",
        )

    if score < 0 or score > 100:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be between 0 and 100",
        )

    return score.quantize(Decimal("0.01"))


# ============================================================
# DECIMAL HELPER
# ============================================================

def decimal_or_none(value):
    if value is None:
        return None

    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


# ============================================================
# ROUND SCORE
# ============================================================

def round_score(value):
    if value is None:
        return None

    return Decimal(str(value)).quantize(
        Decimal("0.01")
    )


# ============================================================
# GET LATEST PERFORMANCE RECORD
# ============================================================

def get_latest_performance(vendor_id, db):
    return (
        db.query(VendorPerformance)
        .filter(
            VendorPerformance.vendor_id == vendor_id
        )
        .order_by(
            VendorPerformance.evaluation_date.desc(),
            VendorPerformance.id.desc(),
        )
        .first()
    )


# ============================================================
# GET PURCHASE ORDERS
# ============================================================

def get_vendor_orders(vendor_id, db):
    return (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.vendor_id == vendor_id
        )
        .order_by(
            PurchaseOrder.order_date.desc(),
            PurchaseOrder.id.desc(),
        )
        .all()
    )


# ============================================================
# DELIVERY METRICS
# ============================================================

def calculate_delivery_metrics(vendor_id, db):
    orders = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status == "delivered",
        )
        .all()
    )

    delivered_count = len(orders)

    if delivered_count == 0:
        return {
            "delivered_orders": 0,
            "on_time_deliveries": 0,
            "delayed_deliveries": 0,
            "delivery_score": None,
        }

    on_time = 0
    delayed = 0

    for order in orders:

        # Only orders having both dates can be evaluated.
        if (
            order.actual_delivery_date is None
            or order.expected_delivery_date is None
        ):
            continue

        if (
            order.actual_delivery_date
            <= order.expected_delivery_date
        ):
            on_time += 1
        else:
            delayed += 1

    valid_orders = on_time + delayed

    if valid_orders == 0:
        delivery_score = None
    else:
        delivery_score = (
            Decimal(str(on_time))
            / Decimal(str(valid_orders))
        ) * Decimal("100")

        delivery_score = round_score(
            delivery_score
        )

    return {
        "delivered_orders": delivered_count,
        "on_time_deliveries": on_time,
        "delayed_deliveries": delayed,
        "delivery_score": delivery_score,
    }


# ============================================================
# DELIVERY SCORE
# ============================================================

def calculate_delivery_score(vendor_id, db):
    metrics = calculate_delivery_metrics(
        vendor_id,
        db
    )

    return metrics["delivery_score"]


# ============================================================
# QUALITY SCORE
# ============================================================
#
# Current database does not contain a separate product-quality
# rating field/table.
#
# Therefore:
#
# At least one delivered PO -> 100%
# No delivered PO            -> No data
#
# Pending, accepted and
# shipped orders are not
# treated as quality failures.
#
# Cancelled orders are ignored.
# ============================================================

def calculate_quality_score(vendor_id, db):

    orders = get_vendor_orders(
        vendor_id,
        db
    )

    if not orders:
        return None

    valid_orders = [
        order
        for order in orders
        if str(order.status or "").lower()
        != "cancelled"
    ]

    if not valid_orders:
        return None

    delivered_orders = [
        order
        for order in valid_orders
        if str(order.status or "").lower()
        == "delivered"
    ]

    if not delivered_orders:
        return None

    # There is currently no separate quality rating
    # available in the database.
    #
    # Therefore a completed/delivered order represents
    # successful order completion.
    return Decimal("100.00")


# ============================================================
# COMMUNICATION SCORE
# ============================================================
#
# Rule:
#
# 0 communications -> No data
# 1 or more        -> 100%
#
# Communication is therefore based on whether the vendor
# has communication activity in the system.
# ============================================================

def calculate_communication_score(vendor_id, db):

    communication_count = (
        db.query(Communication)
        .filter(
            Communication.vendor_id == vendor_id
        )
        .count()
    )

    if communication_count == 0:
        return None

    return Decimal("100.00")


# ============================================================
# COMPLIANCE SCORE
# ============================================================
#
# Compliance is calculated only from ComplianceDocument.
#
# Formula:
#
# Verified + currently valid documents
# ------------------------------------ × 100
# Total compliance documents
#
# Rules:
#
# Verified + valid       -> counted as compliant
# Verified + expired     -> not counted
# Pending verification   -> not counted
# Rejected               -> not counted
#
# No compliance documents -> No data
#
# Contracts are intentionally NOT included here.
# ============================================================

def calculate_compliance_score(vendor_id, db):

    documents = (
        db.query(ComplianceDocument)
        .filter(
            ComplianceDocument.vendor_id == vendor_id
        )
        .all()
    )

    if not documents:
        return None

    valid_verified_count = 0

    for document in documents:

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
        / Decimal(str(len(documents)))
    ) * Decimal("100")

    return round_score(
        compliance_score
    )


# ============================================================
# CALCULATE ALL AUTOMATIC METRICS
# ============================================================

def calculate_automatic_metrics(vendor_id, db):

    delivery_metrics = calculate_delivery_metrics(
        vendor_id,
        db
    )

    delivery_score = delivery_metrics[
        "delivery_score"
    ]

    quality_score = calculate_quality_score(
        vendor_id,
        db
    )

    communication_score = calculate_communication_score(
        vendor_id,
        db
    )

    compliance_score = calculate_compliance_score(
        vendor_id,
        db
    )

    return {
        "delivery_metrics": delivery_metrics,
        "delivery_score": delivery_score,
        "quality_score": quality_score,
        "communication_score": communication_score,
        "compliance_score": compliance_score,
    }


# ============================================================
# WEIGHTED SCORE
# ============================================================
#
# Delivery       = 40%
# Quality        = 25%
# Communication  = 15%
# Compliance     = 20%
#
# Missing metrics are excluded from the calculation.
#
# Example:
#
# Delivery       = 100
# Quality        = 100
# Communication  = None
# Compliance     = 100
#
# Calculation:
#
# (100×40 + 100×25 + 100×20)
# ---------------------------
#       40 + 25 + 20
#
# = 100
# ============================================================

def calculate_weighted_score(
    delivery_score=None,
    quality_score=None,
    communication_score=None,
    compliance_score=None,
):

    weighted_total = Decimal("0.00")
    weight_total = Decimal("0.00")

    metrics = [
        (
            delivery_score,
            Decimal("40")
        ),
        (
            quality_score,
            Decimal("25")
        ),
        (
            communication_score,
            Decimal("15")
        ),
        (
            compliance_score,
            Decimal("20")
        ),
    ]

    for score, weight in metrics:

        if score is None:
            continue

        score_decimal = decimal_or_none(
            score
        )

        if score_decimal is None:
            continue

        weighted_total += (
            score_decimal * weight
        )

        weight_total += weight

    if weight_total == 0:
        return None

    result = (
        weighted_total
        / weight_total
    )

    return round_score(result)


# ============================================================
# RELIABILITY CALCULATION
# ============================================================

def calculate_reliability_from_metrics(
    delivery_score,
    quality_score,
    communication_score,
    compliance_score,
):

    return calculate_weighted_score(
        delivery_score=delivery_score,
        quality_score=quality_score,
        communication_score=communication_score,
        compliance_score=compliance_score,
    )


# ============================================================
# UPDATE STORED VENDOR RELIABILITY
# ============================================================

def update_vendor_reliability(vendor_id, db):

    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == vendor_id
        )
        .first()
    )

    if not vendor:
        return None

    metrics = calculate_automatic_metrics(
        vendor_id,
        db
    )

    reliability = calculate_reliability_from_metrics(
        metrics["delivery_score"],
        metrics["quality_score"],
        metrics["communication_score"],
        metrics["compliance_score"],
    )

    vendor.reliability_score = reliability

    return reliability


# ============================================================
# PERFORMANCE RESPONSE
# ============================================================

def performance_response(
    record,
    vendor=None,
    delivery_metrics=None,
    quality_score=None,
    communication_score=None,
    compliance_score=None,
    calculated_reliability=None,
):

    if delivery_metrics is None:
        delivery_metrics = {
            "delivered_orders": 0,
            "on_time_deliveries": 0,
            "delayed_deliveries": 0,
            "delivery_score": None,
        }

    reliability_value = calculated_reliability

    if (
        reliability_value is None
        and vendor is not None
    ):
        reliability_value = (
            vendor.reliability_score
        )

    # ========================================================
    # CURRENT VALUES
    # ========================================================

    final_quality = decimal_or_none(
        quality_score
    )

    final_communication = decimal_or_none(
        communication_score
    )

    final_compliance = decimal_or_none(
        compliance_score
    )

    overall_score = calculate_weighted_score(
        delivery_score=delivery_metrics[
            "delivery_score"
        ],
        quality_score=final_quality,
        communication_score=final_communication,
        compliance_score=final_compliance,
    )

    return {
        "id": (
            record.id
            if record is not None
            else None
        ),

        "vendor_id": (
            record.vendor_id
            if record is not None
            else (
                vendor.id
                if vendor is not None
                else None
            )
        ),

        "vendor_name": (
            vendor.company_name
            if vendor is not None
            else None
        ),

        "evaluation_date": (
            record.evaluation_date.isoformat()
            if (
                record is not None
                and record.evaluation_date
            )
            else date.today().isoformat()
        ),

        "delivery_score": (
            float(
                delivery_metrics[
                    "delivery_score"
                ]
            )
            if delivery_metrics[
                "delivery_score"
            ] is not None
            else None
        ),

        "on_time_deliveries": (
            delivery_metrics[
                "on_time_deliveries"
            ]
        ),

        "delayed_deliveries": (
            delivery_metrics[
                "delayed_deliveries"
            ]
        ),

        "delivered_orders": (
            delivery_metrics[
                "delivered_orders"
            ]
        ),

        "quality_score": (
            float(final_quality)
            if final_quality is not None
            else None
        ),

        "communication_score": (
            float(final_communication)
            if final_communication is not None
            else None
        ),

        "compliance_score": (
            float(final_compliance)
            if final_compliance is not None
            else None
        ),

        "overall_score": (
            float(overall_score)
            if overall_score is not None
            else None
        ),

        "reliability_score": (
            float(reliability_value)
            if reliability_value is not None
            else None
        ),

        "notes": (
            record.notes
            if (
                record is not None
                and record.notes
            )
            else (
                "Performance calculated from current "
                "purchase order, communication, "
                "and compliance data."
            )
        ),

        "created_at": (
            record.created_at.isoformat()
            if (
                record is not None
                and record.created_at
            )
            else None
        ),
    }


# ============================================================
# BUILD CURRENT PERFORMANCE FOR ONE VENDOR
# ============================================================

def build_current_vendor_performance(
    vendor_id,
    db,
):

    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == vendor_id
        )
        .first()
    )

    if not vendor:
        return None

    latest_record = get_latest_performance(
        vendor_id,
        db
    )

    # ========================================================
    # CURRENT AUTOMATIC METRICS
    # ========================================================

    metrics = calculate_automatic_metrics(
        vendor_id,
        db
    )

    delivery_metrics = metrics[
        "delivery_metrics"
    ]

    delivery_score = metrics[
        "delivery_score"
    ]

    quality_score = metrics[
        "quality_score"
    ]

    communication_score = metrics[
        "communication_score"
    ]

    compliance_score = metrics[
        "compliance_score"
    ]

    # ========================================================
    # CURRENT OVERALL
    # ========================================================

    overall_score = calculate_weighted_score(
        delivery_score=delivery_score,
        quality_score=quality_score,
        communication_score=communication_score,
        compliance_score=compliance_score,
    )

    # ========================================================
    # UPDATE EXISTING PERFORMANCE RECORD
    # ========================================================

    if latest_record is not None:

        latest_record.delivery_score = (
            delivery_score
        )

        latest_record.quality_score = (
            quality_score
        )

        latest_record.communication_score = (
            communication_score
        )

        latest_record.compliance_score = (
            compliance_score
        )

        latest_record.overall_score = (
            overall_score
        )

    # ========================================================
    # UPDATE VENDOR RELIABILITY
    # ========================================================

    vendor.reliability_score = (
        overall_score
    )

    # ========================================================
    # RESPONSE
    # ========================================================

    return performance_response(
        latest_record,
        vendor,
        delivery_metrics,
        quality_score,
        communication_score,
        compliance_score,
        overall_score,
    )


# ============================================================
# CREATE PERFORMANCE EVALUATION
# ============================================================

@router.post("/evaluate/{vendor_id}")
def create_performance_evaluation(
    vendor_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
        )
    ),
):

    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == vendor_id
        )
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    # ========================================================
    # AUTOMATIC METRICS
    # ========================================================

    automatic_metrics = calculate_automatic_metrics(
        vendor_id,
        db
    )

    delivery_score = automatic_metrics[
        "delivery_score"
    ]

    automatic_quality = automatic_metrics[
        "quality_score"
    ]

    automatic_communication = automatic_metrics[
        "communication_score"
    ]

    automatic_compliance = automatic_metrics[
        "compliance_score"
    ]

    # ========================================================
    # MANUAL OVERRIDE
    # ========================================================

    quality_score = automatic_quality

    if data.get("quality_score") is not None:
        quality_score = convert_score(
            data.get("quality_score"),
            "quality_score",
        )

    communication_score = (
        automatic_communication
    )

    if data.get("communication_score") is not None:
        communication_score = convert_score(
            data.get("communication_score"),
            "communication_score",
        )

    compliance_score = (
        automatic_compliance
    )

    if data.get("compliance_score") is not None:
        compliance_score = convert_score(
            data.get("compliance_score"),
            "compliance_score",
        )

    # ========================================================
    # REQUIRE DATA
    # ========================================================

    if (
        delivery_score is None
        and quality_score is None
        and communication_score is None
        and compliance_score is None
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "No performance data is available "
                "for this vendor"
            ),
        )

    # ========================================================
    # OVERALL
    # ========================================================

    overall_score = calculate_weighted_score(
        delivery_score=delivery_score,
        quality_score=quality_score,
        communication_score=communication_score,
        compliance_score=compliance_score,
    )

    # ========================================================
    # NOTES
    # ========================================================

    notes = data.get("notes")

    if not notes:
        notes = (
            "Performance evaluation calculated from "
            "purchase orders, communications, "
            "and compliance documents."
        )

    # ========================================================
    # CREATE RECORD
    # ========================================================

    evaluation = VendorPerformance(
        vendor_id=vendor_id,
        evaluation_date=date.today(),
        delivery_score=delivery_score,
        quality_score=quality_score,
        communication_score=communication_score,
        compliance_score=compliance_score,
        overall_score=overall_score,
        notes=notes,
    )

    db.add(evaluation)
    db.flush()

    # ========================================================
    # UPDATE VENDOR RELIABILITY
    # ========================================================

    vendor.reliability_score = (
        overall_score
    )

    db.commit()

    db.refresh(evaluation)
    db.refresh(vendor)

    delivery_metrics = calculate_delivery_metrics(
        vendor_id,
        db
    )

    return {
        "message": (
            "Performance evaluation created successfully"
        ),

        "performance": performance_response(
            evaluation,
            vendor,
            delivery_metrics,
            quality_score,
            communication_score,
            compliance_score,
            overall_score,
        ),

        "reliability_score": (
            float(overall_score)
            if overall_score is not None
            else None
        ),
    }


# ============================================================
# GET CURRENT PERFORMANCE
# ============================================================

@router.get("")
def get_performance(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    allowed_roles = [
        "administrator",
        "procurement_manager",
        "supply_chain_manager",
        "finance_officer",
        "auditor",
    ]

    # ========================================================
    # VENDOR USER
    # ========================================================

    if current_user.role == "vendor":

        vendor = (
            db.query(Vendor)
            .filter(
                Vendor.user_id == current_user.id
            )
            .first()
        )

        if not vendor:
            raise HTTPException(
                status_code=404,
                detail="Vendor profile not found",
            )

        result = build_current_vendor_performance(
            vendor.id,
            db
        )

        if result is None:
            raise HTTPException(
                status_code=404,
                detail="Vendor performance not found",
            )

        db.commit()

        return [result]

    # ========================================================
    # INTERNAL USERS
    # ========================================================

    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    vendors = (
        db.query(Vendor)
        .order_by(
            Vendor.id.asc()
        )
        .all()
    )

    response = []

    for vendor in vendors:

        result = build_current_vendor_performance(
            vendor.id,
            db
        )

        if result is not None:
            response.append(result)

    db.commit()

    return response


# ============================================================
# GET PERFORMANCE FOR ONE VENDOR
# ============================================================

@router.get("/{vendor_id}")
def get_vendor_performance(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    allowed_roles = [
        "administrator",
        "procurement_manager",
        "supply_chain_manager",
        "finance_officer",
        "auditor",
    ]

    # ========================================================
    # VENDOR USER
    # ========================================================

    if current_user.role == "vendor":

        vendor = (
            db.query(Vendor)
            .filter(
                Vendor.id == vendor_id,
                Vendor.user_id == current_user.id,
            )
            .first()
        )

        if not vendor:
            raise HTTPException(
                status_code=403,
                detail=(
                    "You can only view your own performance"
                ),
            )

    # ========================================================
    # INTERNAL USER
    # ========================================================

    elif current_user.role not in allowed_roles:

        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    # ========================================================
    # CHECK VENDOR
    # ========================================================

    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == vendor_id
        )
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    # ========================================================
    # BUILD CURRENT PERFORMANCE
    # ========================================================

    result = build_current_vendor_performance(
        vendor_id,
        db
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor performance not found",
        )

    db.commit()

    return [result]


# ============================================================
# MANUAL RELIABILITY RECALCULATION
# ============================================================

@router.post("/reliability/{vendor_id}")
def calculate_reliability_score(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
        )
    ),
):

    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == vendor_id
        )
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    # ========================================================
    # CURRENT AUTOMATIC METRICS
    # ========================================================

    metrics = calculate_automatic_metrics(
        vendor_id,
        db
    )

    delivery_score = metrics[
        "delivery_score"
    ]

    quality_score = metrics[
        "quality_score"
    ]

    communication_score = metrics[
        "communication_score"
    ]

    compliance_score = metrics[
        "compliance_score"
    ]

    # ========================================================
    # RELIABILITY
    # ========================================================

    reliability_score = (
        calculate_reliability_from_metrics(
            delivery_score,
            quality_score,
            communication_score,
            compliance_score,
        )
    )

    # ========================================================
    # NO DATA
    # ========================================================

    if reliability_score is None:

        vendor.reliability_score = None

        db.commit()
        db.refresh(vendor)

        return {
            "message": (
                "No performance data available"
            ),

            "vendor_id": vendor_id,

            "vendor_name": (
                vendor.company_name
            ),

            "delivery_score": None,
            "quality_score": None,
            "communication_score": None,
            "compliance_score": None,
            "reliability_score": None,
        }

    # ========================================================
    # UPDATE VENDOR
    # ========================================================

    vendor.reliability_score = (
        reliability_score
    )

    # ========================================================
    # UPDATE LATEST PERFORMANCE RECORD
    # ========================================================

    latest_record = get_latest_performance(
        vendor_id,
        db
    )

    if latest_record is not None:

        latest_record.delivery_score = (
            delivery_score
        )

        latest_record.quality_score = (
            quality_score
        )

        latest_record.communication_score = (
            communication_score
        )

        latest_record.compliance_score = (
            compliance_score
        )

        latest_record.overall_score = (
            calculate_weighted_score(
                delivery_score=delivery_score,
                quality_score=quality_score,
                communication_score=communication_score,
                compliance_score=compliance_score,
            )
        )

    # ========================================================
    # SAVE
    # ========================================================

    db.commit()
    db.refresh(vendor)

    performance_records = (
        db.query(VendorPerformance)
        .filter(
            VendorPerformance.vendor_id == vendor_id
        )
        .count()
    )

    # ========================================================
    # RESPONSE
    # ========================================================

    return {
        "message": (
            "Vendor reliability score calculated successfully"
        ),

        "vendor_id": vendor.id,

        "vendor_name": (
            vendor.company_name
        ),

        "delivery_score": (
            float(delivery_score)
            if delivery_score is not None
            else None
        ),

        "quality_score": (
            float(quality_score)
            if quality_score is not None
            else None
        ),

        "communication_score": (
            float(communication_score)
            if communication_score is not None
            else None
        ),

        "compliance_score": (
            float(compliance_score)
            if compliance_score is not None
            else None
        ),

        "reliability_score": (
            float(reliability_score)
            if reliability_score is not None
            else None
        ),

        "performance_records_used": (
            performance_records
        ),
    }