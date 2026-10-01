import uuid
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import Vendor, VendorPerformance, VendorReliability, Contract, PurchaseOrder, User
from app.schemas import (
    VendorPerformanceCreate,
    VendorPerformanceResponse,
    VendorPerformanceSummary,
    VendorRankingItem,
    ReliabilityFactorBreakdown,
    VendorReliabilityResponse,
    VendorReliabilityRankingItem,
    VendorReliabilitySnapshot,
)
from app.security import get_current_user, require_role
from app.routers.notifications import add_notification

router = APIRouter(prefix="/api/v1/vendors", tags=["Performance & Reliability"])

# --- Named Scoring Weights (Sum = 1.0) ---
WEIGHT_DELIVERY = 0.25
WEIGHT_QUALITY = 0.25
WEIGHT_COMMUNICATION = 0.15
WEIGHT_COMPLIANCE = 0.15
WEIGHT_PURCHASE_HISTORY = 0.10
WEIGHT_ISSUE_RESOLUTION = 0.10


def calculate_communication_score(hours: float) -> float:
    if hours <= 4.0:
        return 100.0
    elif hours <= 12.0:
        return 90.0
    elif hours <= 24.0:
        return 80.0
    elif hours <= 48.0:
        return 60.0
    else:
        return max(10.0, round(100.0 - (hours - 48.0) * 1.2, 2))


def calculate_issue_resolution_score(hours: float) -> float:
    if hours <= 12.0:
        return 100.0
    elif hours <= 24.0:
        return 90.0
    elif hours <= 48.0:
        return 75.0
    elif hours <= 72.0:
        return 60.0
    else:
        return max(10.0, round(100.0 - (hours - 72.0) * 0.8, 2))


async def compute_vendor_reliability_data(
    vendor: Vendor,
    db: AsyncSession
) -> VendorReliabilityResponse:
    # 1. Performance entries
    perf_stmt = select(VendorPerformance).where(VendorPerformance.vendor_id == vendor.id)
    perf_res = await db.execute(perf_stmt)
    entries = perf_res.scalars().all()

    if entries:
        total_on_time = sum(e.on_time_deliveries for e in entries)
        total_delayed = sum(e.delayed_deliveries for e in entries)
        total_deliv = total_on_time + total_delayed
        delivery_score = round((total_on_time / total_deliv * 100.0), 2) if total_deliv > 0 else 100.0

        avg_quality = sum(e.quality_rating for e in entries) / len(entries)
        quality_score = round((avg_quality / 5.0 * 100.0), 2)

        avg_resp = sum(e.response_time_hours for e in entries) / len(entries)
        communication_score = calculate_communication_score(avg_resp)

        avg_issue = sum(e.issue_resolution_time_hours for e in entries) / len(entries)
        issue_resolution_score = calculate_issue_resolution_score(avg_issue)
    else:
        delivery_score = 0.0
        quality_score = 0.0
        communication_score = 0.0
        issue_resolution_score = 0.0

    # 2. Contract Compliance (Read-only from Milestone 2 contracts)
    contracts_stmt = select(Contract).where(Contract.vendor_id == vendor.id)
    contracts_res = await db.execute(contracts_stmt)
    contracts = contracts_res.scalars().all()

    if contracts:
        violation_count = 0
        for c in contracts:
            if c.compliance_flags and any(w in c.compliance_flags.lower() for w in ["breach", "penalty", "violation", "non-compliant", "audit_failed"]):
                violation_count += 1
            if c.status == "TERMINATED":
                violation_count += 2

        if violation_count == 0:
            compliance_score = 100.0
        elif violation_count == 1:
            compliance_score = 70.0
        elif violation_count == 2:
            compliance_score = 45.0
        else:
            compliance_score = 20.0
    else:
        compliance_score = 0.0 if not entries else 85.0

    # 3. Purchase History (Read-only from Milestone 2 purchase_orders)
    pos_stmt = select(PurchaseOrder).where(PurchaseOrder.vendor_id == vendor.id)
    pos_res = await db.execute(pos_stmt)
    pos = pos_res.scalars().all()

    if pos:
        completed_count = sum(1 for po in pos if po.status == "COMPLETED" or po.delivery_status == "delivered")
        purchase_history_score = round((completed_count / len(pos)) * 100.0, 2)
        purchase_history_score = max(50.0, purchase_history_score)
    else:
        purchase_history_score = 0.0 if not entries else 90.0

    # Weighted Average Score & Risk Level
    if not entries:
        overall_score = 0.0
        risk_level = "Unrated"
        recommendation = "UNRATED: Vendor has no performance evaluations or order history logged yet. Complete initial procurement evaluations to generate reliability risk scoring."
    else:
        overall_score = round(
            delivery_score * WEIGHT_DELIVERY +
            quality_score * WEIGHT_QUALITY +
            communication_score * WEIGHT_COMMUNICATION +
            compliance_score * WEIGHT_COMPLIANCE +
            purchase_history_score * WEIGHT_PURCHASE_HISTORY +
            issue_resolution_score * WEIGHT_ISSUE_RESOLUTION,
            2
        )

        if overall_score >= 80.0:
            risk_level = "Low"
            recommendation = f"LOW RISK: Vendor demonstrates excellent reliability ({overall_score}/100). Qualified for long-term strategic contracts and preferred supplier status."
        elif overall_score >= 50.0:
            risk_level = "Medium"
            recommendation = f"MODERATE RISK: Vendor performance is acceptable but exhibits minor delivery or communication delays ({overall_score}/100). Implement routine milestone tracking and order confirmation check-ins."
        else:
            risk_level = "High"
            recommendation = f"HIGH RISK: Significant performance or compliance risks detected ({overall_score}/100). Recommend freezing new purchase requests, executing a comprehensive vendor audit, and requiring a formal Corrective Action Plan (CAP) before contract renewals."

    breakdown = ReliabilityFactorBreakdown(
        delivery_score=delivery_score,
        quality_score=quality_score,
        communication_score=communication_score,
        compliance_score=compliance_score,
        purchase_history_score=purchase_history_score,
        issue_resolution_score=issue_resolution_score,
    )

    return VendorReliabilityResponse(
        vendor_id=vendor.id,
        company_name=vendor.company_name,
        overall_reliability_score=overall_score,
        risk_level=risk_level,
        delivery_score=delivery_score,
        quality_score=quality_score,
        communication_score=communication_score,
        compliance_score=compliance_score,
        breakdown=breakdown,
        recommendation=recommendation,
        computed_at=datetime.utcnow()
    )


# --- Endpoints ---

# 1. Performance Ranking (MUST be declared before /{vendor_id} routes to prevent path collision)
@router.get("/ranking", response_model=List[VendorRankingItem])
async def get_vendor_rankings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Vendor).order_by(Vendor.company_name.asc())
    vendors = (await db.execute(stmt)).scalars().all()

    items: List[VendorRankingItem] = []
    for v in vendors:
        perf_stmt = select(VendorPerformance).where(VendorPerformance.vendor_id == v.id)
        entries = (await db.execute(perf_stmt)).scalars().all()

        if entries:
            total_on_time = sum(e.on_time_deliveries for e in entries)
            total_deliv = total_on_time + sum(e.delayed_deliveries for e in entries)
            on_time_rate = round((total_on_time / total_deliv * 100.0), 2) if total_deliv > 0 else 100.0
            avg_quality = round(sum(e.quality_rating for e in entries) / len(entries), 2)
            completion_rate = round(sum(e.order_completion_rate for e in entries) / len(entries), 2)
            # Composite performance score (0 - 100)
            perf_score = round(0.4 * on_time_rate + 0.3 * (avg_quality / 5.0 * 100.0) + 0.3 * completion_rate, 2)
        else:
            on_time_rate = 0.0
            avg_quality = 0.0
            completion_rate = 0.0
            perf_score = 0.0

        items.append(
            VendorRankingItem(
                vendor_id=v.id,
                company_name=v.company_name,
                registration_no=v.registration_no,
                category=v.category,
                status=v.status,
                performance_score=perf_score,
                average_quality_rating=avg_quality,
                on_time_delivery_rate=on_time_rate,
                order_completion_rate=completion_rate,
                total_evaluations=len(entries)
            )
        )

    # Sort: vendors with real evaluations first (descending score),
    # then unrated vendors at the bottom (alphabetical among themselves).
    items.sort(key=lambda x: (x.total_evaluations == 0, -x.performance_score, x.company_name))
    return items


# 2. Reliability Ranking
@router.get("/reliability-ranking", response_model=List[VendorReliabilityRankingItem])
async def get_vendor_reliability_rankings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Vendor).order_by(Vendor.company_name.asc())
    vendors = (await db.execute(stmt)).scalars().all()

    items: List[VendorReliabilityRankingItem] = []
    for v in vendors:
        rel_data = await compute_vendor_reliability_data(v, db)
        items.append(
            VendorReliabilityRankingItem(
                vendor_id=v.id,
                company_name=v.company_name,
                registration_no=v.registration_no,
                category=v.category,
                status=v.status,
                overall_reliability_score=rel_data.overall_reliability_score,
                risk_level=rel_data.risk_level,
                delivery_score=rel_data.delivery_score,
                quality_score=rel_data.quality_score,
                compliance_score=rel_data.compliance_score,
                recommendation=rel_data.recommendation
            )
        )

    # Sort: rated vendors first (descending score), Unrated vendors at the bottom.
    items.sort(key=lambda x: (x.risk_level == "Unrated", -x.overall_reliability_score, x.company_name))
    return items


# 3. Post Performance Entry
@router.post("/{vendor_id}/performance", response_model=VendorPerformanceResponse, status_code=status.HTTP_201_CREATED)
async def record_vendor_performance(
    vendor_id: uuid.UUID,
    payload: VendorPerformanceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager"))
):
    v_stmt = select(Vendor).where(Vendor.id == vendor_id)
    vendor = (await db.execute(v_stmt)).scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    new_perf = VendorPerformance(
        vendor_id=vendor.id,
        on_time_deliveries=payload.on_time_deliveries,
        delayed_deliveries=payload.delayed_deliveries,
        quality_rating=payload.quality_rating,
        service_rating=payload.service_rating if payload.service_rating is not None else 5.0,
        response_time_hours=payload.response_time_hours,
        issue_resolution_time_hours=payload.issue_resolution_time_hours,
        order_completion_rate=payload.order_completion_rate
    )
    db.add(new_perf)
    await db.flush()

    # Recompute reliability and persist snapshot
    rel_data = await compute_vendor_reliability_data(vendor, db)
    snapshot = VendorReliability(
        vendor_id=vendor.id,
        delivery_score=rel_data.delivery_score,
        quality_score=rel_data.quality_score,
        communication_score=rel_data.communication_score,
        compliance_score=rel_data.compliance_score,
        overall_reliability_score=rel_data.overall_reliability_score,
        risk_level=rel_data.risk_level,
        computed_at=datetime.utcnow()
    )
    db.add(snapshot)

    await add_notification(
        db,
        f"Performance evaluation logged for '{vendor.company_name}': Quality {payload.quality_rating}/5.0, Completion {payload.order_completion_rate}%."
    )

    await db.commit()
    await db.refresh(new_perf)
    return new_perf


# 4. Get Performance History
@router.get("/{vendor_id}/performance", response_model=List[VendorPerformanceResponse])
async def list_vendor_performance(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    v_stmt = select(Vendor).where(Vendor.id == vendor_id)
    vendor = (await db.execute(v_stmt)).scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    stmt = select(VendorPerformance).where(
        VendorPerformance.vendor_id == vendor_id
    ).order_by(VendorPerformance.recorded_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


# 5. Get Performance Summary
@router.get("/{vendor_id}/performance/summary", response_model=VendorPerformanceSummary)
async def get_vendor_performance_summary(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    v_stmt = select(Vendor).where(Vendor.id == vendor_id)
    vendor = (await db.execute(v_stmt)).scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    stmt = select(VendorPerformance).where(VendorPerformance.vendor_id == vendor_id)
    entries = (await db.execute(stmt)).scalars().all()

    if not entries:
        return VendorPerformanceSummary(
            vendor_id=vendor_id,
            total_entries=0,
            total_deliveries=0,
            on_time_deliveries=0,
            delayed_deliveries=0,
            on_time_delivery_rate=0.0,
            average_quality_rating=0.0,
            average_service_rating=0.0,
            average_response_time_hours=0.0,
            average_issue_resolution_time_hours=0.0,
            order_completion_rate=0.0
        )

    total_on_time = sum(e.on_time_deliveries for e in entries)
    total_delayed = sum(e.delayed_deliveries for e in entries)
    total_deliv = total_on_time + total_delayed
    on_time_rate = round((total_on_time / total_deliv * 100.0), 2) if total_deliv > 0 else 100.0
    avg_quality = round(sum(e.quality_rating for e in entries) / len(entries), 2)
    avg_service = round(sum((e.service_rating if e.service_rating is not None else e.quality_rating) for e in entries) / len(entries), 2)
    avg_resp = round(sum(e.response_time_hours for e in entries) / len(entries), 2)
    avg_issue = round(sum(e.issue_resolution_time_hours for e in entries) / len(entries), 2)
    avg_completion = round(sum(e.order_completion_rate for e in entries) / len(entries), 2)

    return VendorPerformanceSummary(
        vendor_id=vendor_id,
        total_entries=len(entries),
        total_deliveries=total_deliv,
        on_time_deliveries=total_on_time,
        delayed_deliveries=total_delayed,
        on_time_delivery_rate=on_time_rate,
        average_quality_rating=avg_quality,
        average_service_rating=avg_service,
        average_response_time_hours=avg_resp,
        average_issue_resolution_time_hours=avg_issue,
        order_completion_rate=avg_completion
    )


# 6. Get Reliability Score Breakdown + Risk Level
@router.get("/{vendor_id}/reliability", response_model=VendorReliabilityResponse)
async def get_vendor_reliability(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    v_stmt = select(Vendor).where(Vendor.id == vendor_id)
    vendor = (await db.execute(v_stmt)).scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    return await compute_vendor_reliability_data(vendor, db)


# 7. Get Reliability Trend
@router.get("/{vendor_id}/reliability/trend", response_model=List[VendorReliabilitySnapshot])
async def get_vendor_reliability_trend(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    v_stmt = select(Vendor).where(Vendor.id == vendor_id)
    vendor = (await db.execute(v_stmt)).scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    stmt = select(VendorReliability).where(
        VendorReliability.vendor_id == vendor_id
    ).order_by(VendorReliability.computed_at.asc())
    snapshots = (await db.execute(stmt)).scalars().all()

    if not snapshots:
        # Generate and return current point
        current_data = await compute_vendor_reliability_data(vendor, db)
        single_snapshot = VendorReliabilitySnapshot(
            id=uuid.uuid4(),
            vendor_id=vendor.id,
            delivery_score=current_data.delivery_score,
            quality_score=current_data.quality_score,
            communication_score=current_data.communication_score,
            compliance_score=current_data.compliance_score,
            overall_reliability_score=current_data.overall_reliability_score,
            risk_level=current_data.risk_level,
            computed_at=current_data.computed_at
        )
        return [single_snapshot]

    return snapshots
