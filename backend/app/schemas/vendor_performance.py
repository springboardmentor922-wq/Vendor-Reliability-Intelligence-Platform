from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class VendorPerformanceCreate(BaseModel):
    vendor_id: int
    purchase_order_id: int | None = None

    actual_delivery_date: date | None = None

    quality_rating: Decimal | None = Field(
        default=None,
        ge=0,
        le=5,
    )

    service_rating: Decimal | None = Field(
        default=None,
        ge=0,
        le=5,
    )

    response_time_hours: Decimal | None = Field(
        default=None,
        ge=0,
    )

    issue_resolution_time_hours: Decimal | None = Field(
        default=None,
        ge=0,
    )

    issue_count: int = Field(
        default=0,
        ge=0,
    )

    notes: str | None = None

    evaluation_date: date = Field(
        default_factory=date.today,
    )


class VendorPerformanceResponse(VendorPerformanceCreate):
    id: int
    created_by: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VendorPerformanceSummary(BaseModel):
    vendor_id: int
    vendor_name: str
    category: str
    vendor_status: str

    total_orders: int
    on_time_deliveries: int
    delayed_deliveries: int

    quality_rating: Decimal | None
    service_rating: Decimal | None

    response_time_hours: Decimal | None
    issue_resolution_time_hours: Decimal | None

    order_completion_rate: Decimal

    performance_score: Decimal
    ranking: int

    performance_status: str


class VendorPerformanceHistory(BaseModel):
    id: int
    vendor_id: int
    vendor_name: str

    purchase_order_id: int | None
    purchase_order_number: str | None

    expected_delivery_date: date | None
    actual_delivery_date: date | None

    delivery_status: str

    quality_rating: Decimal | None
    service_rating: Decimal | None

    response_time_hours: Decimal | None
    issue_resolution_time_hours: Decimal | None

    issue_count: int
    notes: str | None

    evaluation_date: date