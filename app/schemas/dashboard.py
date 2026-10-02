from typing import Optional
from pydantic import BaseModel


class ProcurementDashboard(BaseModel):
    total_requests: int
    pending_requests: int
    approved_requests: int
    completed_requests: int
    total_procurement_value: float
    completion_rate: float

    active_purchase_orders: int
    pending_orders: int
    overdue_orders: int
    active_po_value: float

    total_deliveries: int
    on_time_deliveries: int
    delayed_deliveries: int
    pending_deliveries: int
    delivery_rate: float


class VendorDashboard(BaseModel):
    vendor_id: int
    company_name: str
    reliability_score: float
    delivery_rate: Optional[float]
    avg_quality_rating: Optional[float]
    avg_response_time_hours: Optional[float]

    active_contracts: int
    expiring_contracts: int
    expired_contracts: int

    total_orders: int
    completed_orders: int
    pending_orders: int
    cancelled_orders: int
    total_order_value: float


class AdminDashboard(BaseModel):
    total_users: int
    active_users: int
    users_by_role: dict

    total_vendors: int
    active_vendors: int
    vendors_by_category: dict
    high_risk_vendors: int

    total_purchase_orders: int
    total_procurement_value: float
    pending_approvals: int

    total_contracts: int
    compliant_vendors: int
    expired_certifications: int