from decimal import Decimal
from pydantic import BaseModel


class VendorPerformanceReport(BaseModel):
    vendor_id: int
    vendor_name: str
    category: str
    status: str
    total_orders: int
    on_time_deliveries: int
    delayed_deliveries: int
    quality_rating: Decimal | None
    service_rating: Decimal | None
    response_time_hours: Decimal | None
    issue_resolution_time_hours: Decimal | None
    order_completion_rate: Decimal
    performance_score: Decimal


class ProcurementReport(BaseModel):
    total_purchase_orders: int
    pending_orders: int
    approved_orders: int
    ordered_orders: int
    delivered_orders: int
    completed_orders: int
    cancelled_orders: int
    total_procurement_cost: Decimal
    average_order_value: Decimal


class PurchaseOrderReport(BaseModel):
    id: int
    po_number: str
    order_date: str
    expected_delivery_date: str
    vendor_name: str
    department: str
    payment_terms: str
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal


class ComplianceReport(BaseModel):
    contract_id: int
    contract_number: str
    contract_title: str
    vendor_name: str
    start_date: str
    end_date: str
    contract_status: str
    compliance_status: str
    contract_value: Decimal


class ContractReport(BaseModel):
    id: int
    contract_number: str
    title: str
    contract_type: str
    vendor_name: str
    start_date: str
    end_date: str
    renewal_date: str | None
    status: str
    compliance_status: str
    contract_value: Decimal
    payment_terms: str