from datetime import date, datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Date,
    Enum,
    Numeric,
    ForeignKey,
    Text,
)

from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from database import Base


# ============================================================
# USER
# ============================================================

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(100),
        nullable=False
    )

    email = Column(
        String(150),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    role = Column(
        Enum(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
            "vendor",
            "supplier",
            "finance_officer",
            "auditor"
        ),
        nullable=False
    )

    is_active = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    notifications = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan"
    )


# ============================================================
# VENDOR
# ============================================================

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    requested_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    company_name = Column(
        String(150),
        nullable=False
    )

    category = Column(
        Enum(
            "Raw Material Suppliers",
            "Equipment Vendors",
            "IT Vendors",
            "Service Providers",
            "Logistics Partners",
            "Maintenance Vendors"
        ),
        nullable=True
    )

    contact_person = Column(
        String(100),
        nullable=True
    )

    email = Column(
        String(150),
        nullable=True
    )

    phone = Column(
        String(30),
        nullable=True
    )

    address = Column(
        String(255),
        nullable=True
    )

    vendor_status = Column(
        Enum(
            "active",
            "inactive",
            "suspended"
        ),
        default="active"
    )

    approval_status = Column(
        Enum(
            "pending",
            "approved",
            "rejected",
            "cancelled"
        ),
        default="approved",
        nullable=False
    )

    reliability_score = Column(
        Numeric(5, 2),
        default=0.00
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    performance_records = relationship(
        "VendorPerformance",
        back_populates="vendor",
        cascade="all, delete-orphan"
    )


# ============================================================
# SUPPLIER
# ============================================================

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    company_name = Column(
        String(150),
        nullable=False
    )

    contact_person = Column(
        String(100),
        nullable=True
    )

    email = Column(
        String(150),
        nullable=True
    )

    phone = Column(
        String(30),
        nullable=True
    )

    address = Column(
        String(255),
        nullable=True
    )

    category = Column(
        String(100),
        nullable=True
    )

    supplier_status = Column(
        Enum(
            "active",
            "inactive",
            "suspended"
        ),
        default="active"
    )

    approval_status = Column(
        Enum(
            "pending",
            "approved",
            "rejected"
        ),
        default="approved",
        nullable=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )


# ============================================================
# PROCUREMENT REQUEST
# ============================================================

class ProcurementRequest(Base):
    __tablename__ = "procurement_requests"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    request_number = Column(
        String(50),
        unique=True,
        nullable=False
    )

    requested_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    vendor_id = Column(
        Integer,
        ForeignKey("vendors.id"),
        nullable=True
    )

    description = Column(
        String(500),
        nullable=False
    )

    quantity = Column(
        Integer,
        nullable=False,
        default=1
    )

    estimated_amount = Column(
        Numeric(12, 2),
        nullable=False,
        default=0.00
    )

    expected_delivery_date = Column(
        Date,
        nullable=True
    )

    status = Column(
        Enum(
            "pending",
            "approved",
            "rejected",
            "converted"
        ),
        nullable=False,
        default="pending"
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )


# ============================================================
# PURCHASE ORDER
# ============================================================

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    vendor_id = Column(
        Integer,
        ForeignKey("vendors.id"),
        nullable=False
    )

    supplier_id = Column(
        Integer,
        ForeignKey("suppliers.id"),
        nullable=True
    )

    order_number = Column(
        String(50),
        unique=True,
        nullable=False
    )

    order_date = Column(
        Date,
        nullable=False
    )

    expected_delivery_date = Column(
        Date,
        nullable=True
    )

    actual_delivery_date = Column(
        Date,
        nullable=True
    )

    total_amount = Column(
        Numeric(12, 2),
        default=0.00
    )

    status = Column(
        Enum(
            "pending",
            "accepted",
            "shipped",
            "delivered",
            "cancelled"
        ),
        default="pending"
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )


# ============================================================
# INVOICE
# ============================================================

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    invoice_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )

    purchase_order_id = Column(
        Integer,
        ForeignKey("purchase_orders.id"),
        nullable=False,
        unique=True,
        index=True
    )

    vendor_id = Column(
        Integer,
        ForeignKey("vendors.id"),
        nullable=False,
        index=True
    )

    invoice_date = Column(
        Date,
        nullable=False
    )

    due_date = Column(
        Date,
        nullable=True
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False,
        default=0
    )

    status = Column(
        Enum(
            "pending",
            "verified",
            "rejected",
            "paid"
        ),
        nullable=False,
        default="pending"
    )

    verified_at = Column(
        DateTime,
        nullable=True
    )

    paid_at = Column(
        DateTime,
        nullable=True
    )

    rejection_reason = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now()
    )

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    payment_number = Column(String(50), unique=True, nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)

    amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    payment_date = Column(Date, nullable=False)

    payment_method = Column(
        Enum(
            "Bank Transfer",
            "NEFT",
            "RTGS",
            "UPI",
            "Cheque",
            "Other"
        ),
        nullable=False,
        default="Bank Transfer"
    )

    transaction_reference = Column(String(100), nullable=True)

    status = Column(
        Enum(
            "pending",
            "processing",
            "completed",
            "failed",
            "cancelled"
        ),
        nullable=False,
        default="pending"
    )

    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

# ============================================================
# VENDOR PERFORMANCE
# ============================================================

class VendorPerformance(Base):
    __tablename__ = "vendor_performance"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    vendor_id = Column(
        Integer,
        ForeignKey("vendors.id"),
        nullable=False,
        index=True
    )

    evaluation_date = Column(
        Date,
        nullable=False,
        default=date.today
    )

    delivery_score = Column(
        Numeric(5, 2),
        nullable=True
    )

    quality_score = Column(
        Numeric(5, 2),
        nullable=True
    )

    communication_score = Column(
        Numeric(5, 2),
        nullable=True
    )

    compliance_score = Column(
        Numeric(5, 2),
        nullable=True
    )

    overall_score = Column(
        Numeric(5, 2),
        nullable=True
    )

    notes = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    vendor = relationship(
        "Vendor",
        back_populates="performance_records"
    )


# ============================================================
# CONTRACT
# ============================================================

class Contract(Base):
    __tablename__ = "contracts"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    contract_number = Column(
        String(50),
        unique=True,
        nullable=False
    )

    vendor_id = Column(
        Integer,
        ForeignKey("vendors.id"),
        nullable=False
    )

    title = Column(
        String(200),
        nullable=False
    )

    description = Column(
        String(500),
        nullable=True
    )

    start_date = Column(
        Date,
        nullable=False
    )

    end_date = Column(
        Date,
        nullable=False
    )

    contract_value = Column(
        Numeric(12, 2),
        nullable=False,
        default=0.00
    )

    status = Column(
        Enum(
            "draft",
            "active",
            "expired",
            "terminated"
        ),
        default="draft"
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )


# ============================================================
# COMPLIANCE DOCUMENT
# ============================================================

class ComplianceDocument(Base):
    __tablename__ = "compliance_documents"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    vendor_id = Column(
        Integer,
        ForeignKey("vendors.id"),
        nullable=False,
        index=True
    )

    document_name = Column(
        String(200),
        nullable=False
    )

    document_type = Column(
        Enum(
            "GST Certificate",
            "PAN Card",
            "Tax Certificate",
            "Quality Certificate",
            "Safety Certificate",
            "Environmental Certificate",
            "ISO Certificate",
            "Business License",
            "Other"
        ),
        nullable=False
    )

    document_number = Column(
        String(100),
        nullable=True
    )

    issue_date = Column(
        Date,
        nullable=True
    )

    expiry_date = Column(
        Date,
        nullable=True
    )

    status = Column(
        Enum(
            "valid",
            "expiring",
            "expired",
            "pending"
        ),
        default="pending",
        nullable=False
    )

    verification_status = Column(
        Enum(
            "pending",
            "verified",
            "rejected"
        ),
        default="pending",
        nullable=False
    )

    file_name = Column(
        String(255),
        nullable=True
    )

    file_path = Column(
        String(500),
        nullable=True
    )

    remarks = Column(
        Text,
        nullable=True
    )

    uploaded_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now()
    )


# ============================================================
# CERTIFICATION
# ============================================================

class Certification(Base):
    __tablename__ = "certifications"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    vendor_id = Column(
        Integer,
        ForeignKey("vendors.id"),
        nullable=False,
        index=True
    )

    certification_name = Column(
        String(200),
        nullable=False
    )

    certification_type = Column(
        String(100),
        nullable=True
    )

    certificate_number = Column(
        String(100),
        nullable=True
    )

    issuing_authority = Column(
        String(200),
        nullable=True
    )

    issue_date = Column(
        Date,
        nullable=True
    )

    expiry_date = Column(
        Date,
        nullable=True
    )

    status = Column(
        Enum(
            "valid",
            "expiring",
            "expired",
            "pending"
        ),
        default="pending",
        nullable=False
    )

    file_name = Column(
        String(255),
        nullable=True
    )

    file_path = Column(
        String(500),
        nullable=True
    )

    remarks = Column(
        Text,
        nullable=True
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now()
    )


# ============================================================
# VENDOR DOCUMENT
# ============================================================

class VendorDocument(Base):
    __tablename__ = "vendor_documents"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    vendor_id = Column(
        Integer,
        ForeignKey("vendors.id"),
        nullable=False,
        index=True
    )

    document_name = Column(
        String(200),
        nullable=False
    )

    document_type = Column(
        String(100),
        nullable=False
    )

    description = Column(
        Text,
        nullable=True
    )

    file_name = Column(
        String(255),
        nullable=True
    )

    file_path = Column(
        String(500),
        nullable=True
    )

    status = Column(
        Enum(
            "active",
            "inactive",
            "expired"
        ),
        default="active",
        nullable=False
    )

    uploaded_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )


# ============================================================
# COMMUNICATION
# ============================================================

class Communication(Base):
    __tablename__ = "communications"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    sender_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    receiver_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    vendor_id = Column(
        Integer,
        ForeignKey("vendors.id"),
        nullable=True
    )

    subject = Column(
        String(200),
        nullable=False
    )

    message = Column(
        Text,
        nullable=False
    )

    attachment = Column(
        String(255),
        nullable=True
    )

    status = Column(
        Enum(
            "sent",
            "read"
        ),
        nullable=False,
        default="sent"
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )


# ============================================================
# NOTIFICATION
# ============================================================

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    title = Column(
        String(255),
        nullable=False
    )

    message = Column(
        Text,
        nullable=False
    )

    notification_type = Column(
        String(50),
        nullable=False,
        default="info"
    )

    is_read = Column(
        Boolean,
        nullable=False,
        default=False
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )

    user = relationship(
        "User",
        back_populates="notifications"
    )