from pydantic import BaseModel, Field


class DatasetDeliveryStatus(BaseModel):
    late_delivery: int = 0
    advance_shipping: int = 0
    shipping_on_time: int = 0
    shipping_canceled: int = 0


class DatasetShippingMode(BaseModel):
    shipping_mode: str
    records: int
    percentage: float


class DatasetMarket(BaseModel):
    market: str
    records: int
    percentage: float


class DatasetMonthlyTrend(BaseModel):
    month: str
    total_records: int
    late_deliveries: int
    on_time_deliveries: int
    late_delivery_rate: float


class DatasetAnalyticsResponse(BaseModel):
    dataset_name: str
    total_records: int
    unique_orders: int

    late_delivery_count: int
    late_delivery_rate: float
    on_time_delivery_rate: float

    average_actual_shipping_days: float
    average_scheduled_shipping_days: float
    average_shipping_delay_days: float

    total_sales: float
    total_profit: float
    average_order_item_value: float

    delivery_status: DatasetDeliveryStatus

    shipping_modes: list[DatasetShippingMode] = Field(default_factory=list)
    markets: list[DatasetMarket] = Field(default_factory=list)
    monthly_trend: list[DatasetMonthlyTrend] = Field(default_factory=list)