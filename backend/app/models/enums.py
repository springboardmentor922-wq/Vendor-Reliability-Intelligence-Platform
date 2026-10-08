import enum

class UserRole(str, enum.Enum):
    ADMINISTRATOR = "Administrator"
    PROCUREMENT_MANAGER = "Procurement Manager"
    SUPPLY_CHAIN_MANAGER = "Supply Chain Manager"
    VENDOR = "Vendor"
    FINANCE_OFFICER = "Finance Officer"
    AUDITOR = "Auditor"

class VendorCategory(str, enum.Enum):
    RAW_MATERIAL = "raw_material"
    EQUIPMENT = "equipment"
    IT = "it"
    SERVICE_PROVIDER = "service_provider"
    LOGISTICS = "logistics"
    MAINTENANCE = "maintenance"

class VendorStatus(str, enum.Enum):
    PENDING = "pending"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    ACTIVE = "active"
    INACTIVE = "inactive"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

class RequestStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PENDING = "pending"
    ASSIGNED = "assigned"
    VENDOR_ACCEPTED = "vendor_accepted"
    FINANCE_APPROVED = "finance_approved"
    APPROVED = "approved"
    REJECTED = "rejected"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class POStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    ORDERED = "ordered"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class InvoiceStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"

class ContractStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRING_SOON = "expiring_soon"
    EXPIRED = "expired"
    TERMINATED = "terminated"

class NotificationType(str, enum.Enum):
    PROCUREMENT_ALERT = "procurement_alert"
    DELIVERY_DELAY = "delivery_delay"
    VENDOR_APPROVAL = "vendor_approval"
    CONTRACT_EXPIRY = "contract_expiry"
    COMPLIANCE_ALERT = "compliance_alert"
    PAYMENT_REQUEST = "payment_request"
    PAYMENT_APPROVED = "payment_approved"
    GENERAL = "general"
