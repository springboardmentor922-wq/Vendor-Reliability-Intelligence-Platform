"""Vendor performance monitoring.

Per-order evaluations plus the aggregated metrics the Vendor Performance
module reports: on-time and delayed deliveries, quality rating, response
time, issue resolution time and order completion rate - all computed live
from the operational tables rather than stored as summary fields.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from database import get_db
from deps import (
    assert_vendor_access,
    get_current_user,
    require_procurement_or_supply_chain,
    vendor_scope
)
from models import PurchaseOrder, User, Vendor, VendorPerformance
from services import performance as metrics
from services.events import log_activity

router = APIRouter(prefix="/vendor-performance", tags=["Vendor Performance"])


class PerformanceCreate(BaseModel):
    vendor_id: int
    purchase_order_id: Optional[int] = None
    evaluation_date: Optional[date] = None
    on_time_delivery: Optional[Decimal] = Field(default=None, ge=0, le=100)
    delayed_delivery: Optional[Decimal] = Field(default=None, ge=0, le=100)
    quality_rating: Optional[Decimal] = Field(default=None, ge=0, le=5)
    response_time: Optional[Decimal] = Field(default=None, ge=0)
    issue_resolution_time: Optional[Decimal] = Field(default=None, ge=0)
    order_completion_rate: Optional[Decimal] = Field(default=None, ge=0, le=100)
    service_rating: Optional[Decimal] = Field(default=None, ge=0, le=5)
    remarks: Optional[str] = None


class PerformanceResponse(BaseModel):
    id: int
    vendor_id: int
    vendor_name: Optional[str] = None
    purchase_order_id: Optional[int] = None
    po_number: Optional[str] = None
    evaluation_date: date
    on_time_delivery: Optional[Decimal] = None
    delayed_delivery: Optional[Decimal] = None
    quality_rating: Optional[Decimal] = None
    response_time: Optional[Decimal] = None
    issue_resolution_time: Optional[Decimal] = None
    order_completion_rate: Optional[Decimal] = None
    service_rating: Optional[Decimal] = None
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


def _to_response(record: VendorPerformance) -> PerformanceResponse:
    payload = PerformanceResponse.model_validate(record)
    payload.vendor_name = record.vendor.vendor_name if record.vendor else None
    payload.po_number = (
        record.purchase_order.po_number if record.purchase_order else None
    )
    return payload


@router.get("", response_model=list[PerformanceResponse])
@router.get("/", response_model=list[PerformanceResponse], include_in_schema=False)
def list_performance(
    vendor_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(VendorPerformance)

    scope = vendor_scope(current_user)
    if scope is not None:
        query = query.filter(VendorPerformance.vendor_id == scope)
    elif vendor_id:
        query = query.filter(VendorPerformance.vendor_id == vendor_id)

    return [
        _to_response(r)
        for r in query.order_by(VendorPerformance.id.desc()).all()
    ]


@router.get("/vendor/{vendor_id}", response_model=list[PerformanceResponse])
def vendor_history(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assert_vendor_access(current_user, vendor_id)

    records = (
        db.query(VendorPerformance)
        .filter(VendorPerformance.vendor_id == vendor_id)
        .order_by(VendorPerformance.evaluation_date.desc())
        .all()
    )

    return [_to_response(r) for r in records]


@router.post(
    "",
    response_model=PerformanceResponse,
    status_code=status.HTTP_201_CREATED
)
@router.post(
    "/",
    response_model=PerformanceResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False
)
def record_performance(
    payload: PerformanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )

    if payload.purchase_order_id:
        po = (
            db.query(PurchaseOrder)
            .filter(PurchaseOrder.id == payload.purchase_order_id)
            .first()
        )

        if not po:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase order not found"
            )

        if po.vendor_id != vendor.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="That purchase order belongs to a different vendor"
            )

    data = payload.model_dump(exclude={"evaluation_date"})

    record = VendorPerformance(
        **data,
        evaluation_date=payload.evaluation_date or date.today()
    )

    db.add(record)

    log_activity(
        db, current_user.id, "Vendor", vendor.id, "Performance Recorded",
        f"Performance evaluation captured for {vendor.vendor_name}"
    )

    db.commit()
    db.refresh(record)

    return _to_response(record)


# ==========================================================================
# Milestone 3: aggregated performance metrics
# ==========================================================================

class MetricsResponse(BaseModel):
    """The six metrics the Vendor Performance module is required to report."""

    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None

    total_orders: int
    delivered_orders: int
    on_time_deliveries: int
    delayed_deliveries: int
    cancelled_orders: int
    completed_orders: int
    active_orders: int
    pending_deliveries: int
    overdue_orders: int

    on_time_rate: float
    delay_rate: float
    delivery_rate: float
    order_completion_rate: float
    avg_delay_days: float
    max_delay_days: float

    total_spend: float
    avg_order_value: float

    evaluations: int
    quality_rating: float
    service_rating: float
    avg_response_time_hours: float
    avg_issue_resolution_hours: float
    avg_order_completion_rate: float

    communication: dict
    compliance: dict


class TrendPoint(BaseModel):
    period: str
    orders: int
    delivered: int
    on_time: int
    delayed: int
    on_time_rate: float
    avg_delay_days: float
    spend: float
    quality_rating: float
    avg_response_hours: float


class SummaryRow(BaseModel):
    vendor_id: int
    vendor_name: str
    vendor_code: str
    category: str
    status: str
    orders: int
    delivered: int
    on_time_deliveries: int
    delayed_deliveries: int
    on_time_rate: float
    avg_delay_days: float
    total_spend: float


def _scoped_vendor(current_user: User, vendor_id: Optional[int]) -> Optional[int]:
    scope = vendor_scope(current_user)

    return scope if scope is not None else vendor_id


@router.get("/metrics", response_model=MetricsResponse)
def performance_metrics(
    vendor_id: Optional[int] = Query(default=None),
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Aggregated performance metrics for one vendor, or the whole book."""

    target = _scoped_vendor(current_user, vendor_id)

    if target is not None:
        assert_vendor_access(current_user, target)

    delivery = metrics.delivery_metrics(db, target, start, end)
    quality = metrics.quality_metrics(db, target, start, end)
    communication = metrics.communication_metrics(db, target, start, end)
    compliance = metrics.compliance_metrics(db, target)

    vendor = (
        db.query(Vendor).filter(Vendor.id == target).first()
        if target
        else None
    )

    return MetricsResponse(
        vendor_id=target,
        vendor_name=vendor.vendor_name if vendor else None,
        communication=communication,
        compliance=compliance,
        **delivery,
        **quality
    )


@router.get("/trend", response_model=list[TrendPoint])
def performance_trend(
    vendor_id: Optional[int] = Query(default=None),
    months: int = Query(default=12, ge=1, le=36),
    category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Month-by-month delivery performance, oldest first."""

    target = _scoped_vendor(current_user, vendor_id)

    if target is not None:
        assert_vendor_access(current_user, target)

    return [
        TrendPoint(**row)
        for row in metrics.performance_trend(db, target, months, category)
    ]


@router.get("/summary", response_model=list[SummaryRow])
def performance_summary(
    category: Optional[str] = Query(default=None),
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """One delivery summary row per vendor - the ranking table's source."""

    scope = vendor_scope(current_user)

    rows = metrics.vendor_delivery_summary(db, start, end, category)

    if scope is not None:
        rows = [r for r in rows if r["vendor_id"] == scope]

    rows.sort(key=lambda r: r["on_time_rate"], reverse=True)

    return [SummaryRow(**row) for row in rows]
