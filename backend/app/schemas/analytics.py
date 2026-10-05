from decimal import Decimal
from pydantic import BaseModel


class MetricValue(BaseModel):
    value: Decimal | int | float
    label: str


class DeliveryStatusSummary(BaseModel):
    pending: int
    approved: int
    ordered: int
    delivered: int
    completed: int
    cancelled: int
    delayed: int


class ContractSummary(BaseModel):
    active: int
    expiring: int
    expired: int
    renewed: int


class OrderSummary(BaseModel):
    total: int
    completed: int
    pending: int
    delayed: int


class CommunicationSummary(BaseModel):
    messages: int
    open_queries: int
    resolved_queries: int
    response_activity: int


class VendorPerformanceDashboard(BaseModel):
    performance_score: Decimal | None
    delivery_rate: Decimal | None
    quality_rating: Decimal | None
    response_time_hours: Decimal | None
    reliability_score: Decimal | None
    reliability_factors: dict[str, Decimal | None]


class ProcurementDashboard(BaseModel):
    total_purchase_orders: int
    active_purchase_orders: int
    total_procurement_cost: Decimal
    average_order_value: Decimal
    vendor_count: int
    delivery_status: DeliveryStatusSummary


class AdminDashboard(BaseModel):
    total_users: int
    active_users: int
    total_vendors: int
    approved_vendors: int
    pending_vendors: int
    total_purchase_orders: int
    total_contracts: int
    compliant_contracts: int
    expiring_contracts: int
    total_communications: int


class DashboardAnalytics(BaseModel):
    role: str
    vendor_name: str | None

    vendor_performance: VendorPerformanceDashboard

    contracts: ContractSummary

    orders: OrderSummary

    communication: CommunicationSummary

    procurement: ProcurementDashboard

    admin: AdminDashboard