import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Table,
    Text,
    Integer,
    Float,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

class Role(Base):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False, index=True)

    users = relationship("User", secondary=user_roles, back_populates="roles", lazy="selectin")

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="PENDING", index=True) # PENDING, APPROVED, REJECTED
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    roles = relationship("Role", secondary=user_roles, back_populates="users", lazy="selectin")
    procurement_requests = relationship("ProcurementRequest", back_populates="requester", lazy="selectin")
    sent_communications = relationship("Communication", back_populates="sender", lazy="selectin")

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name = Column(String(255), nullable=False, index=True)
    registration_no = Column(String(100), unique=True, nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="ACTIVE") # ACTIVE, INACTIVE, SUSPENDED, pending, under_review, approved, rejected
    review_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    contacts = relationship("VendorContact", back_populates="vendor", cascade="all, delete-orphan", lazy="selectin", passive_deletes=True)
    purchase_orders = relationship("PurchaseOrder", back_populates="vendor", cascade="all, delete-orphan", lazy="selectin", passive_deletes=True)
    contracts = relationship("Contract", back_populates="vendor", cascade="all, delete-orphan", lazy="selectin", passive_deletes=True)
    performance_entries = relationship("VendorPerformance", back_populates="vendor", cascade="all, delete-orphan", lazy="selectin", passive_deletes=True)
    reliability_snapshots = relationship("VendorReliability", back_populates="vendor", cascade="all, delete-orphan", lazy="selectin", passive_deletes=True)
    communications = relationship("Communication", back_populates="vendor", cascade="all, delete-orphan", lazy="selectin", passive_deletes=True)
    certifications = relationship("Certification", back_populates="vendor", cascade="all, delete-orphan", lazy="selectin", passive_deletes=True)

class VendorContact(Base):
    __tablename__ = "vendor_contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)

    vendor = relationship("Vendor", back_populates="contacts")

class PRLineItem(Base):
    __tablename__ = "pr_line_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pr_id = Column(UUID(as_uuid=True), ForeignKey("procurement_requests.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String(255), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, default=1.0)
    estimated_cost = Column(Numeric(12, 2), nullable=False, default=0.0)

    procurement_request = relationship("ProcurementRequest", back_populates="line_items")

class ProcurementRequest(Base):
    __tablename__ = "procurement_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="PENDING_APPROVAL", index=True) # PENDING_APPROVAL, APPROVED, REJECTED, CONVERTED_TO_PO, pending, approved, ordered, delivered, completed, cancelled
    total_estimated_cost = Column(Numeric(12, 2), nullable=False, default=0.00)
    budget_amount = Column(Numeric(12, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    requester = relationship("User", back_populates="procurement_requests")
    purchase_orders = relationship("PurchaseOrder", back_populates="procurement_request", lazy="selectin")
    line_items = relationship("PRLineItem", back_populates="procurement_request", cascade="all, delete-orphan", lazy="selectin")

class PODocument(Base):
    __tablename__ = "po_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id = Column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    doc_type = Column(String(50), nullable=False, default="invoice") # invoice, receipt, proof_of_delivery
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="documents")

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pr_id = Column(UUID(as_uuid=True), ForeignKey("procurement_requests.id", ondelete="SET NULL"), nullable=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    po_number = Column(String(100), unique=True, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="SENT_TO_VENDOR", index=True) # SENT_TO_VENDOR, IN_FULFILLMENT, DELIVERED, COMPLETED
    delivery_status = Column(String(50), nullable=False, default="in_progress") # in_progress, shipped, partial_delivery, delivered
    invoice_amount = Column(Numeric(12, 2), nullable=True)
    invoice_received_at = Column(DateTime, nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    procurement_request = relationship("ProcurementRequest", back_populates="purchase_orders", lazy="selectin")
    vendor = relationship("Vendor", back_populates="purchase_orders", lazy="selectin")
    items = relationship("POItem", back_populates="purchase_order", cascade="all, delete-orphan", lazy="selectin", passive_deletes=True)
    documents = relationship("PODocument", back_populates="purchase_order", cascade="all, delete-orphan", lazy="selectin", passive_deletes=True)

class POItem(Base):
    __tablename__ = "po_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_id = Column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String(255), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, default=1.0)
    unit_price = Column(Numeric(12, 2), nullable=False, default=0.0)

    purchase_order = relationship("PurchaseOrder", back_populates="items")

class Contract(Base):
    __tablename__ = "contracts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    renewal_notice_period_days = Column(Numeric(5, 0), nullable=False, default=30)
    terms = Column(Text, nullable=True)
    compliance_flags = Column(Text, nullable=True)
    document_path = Column(String(500), nullable=True)
    status = Column(String(50), nullable=False, default="ACTIVE") # ACTIVE, EXPIRED, TERMINATED, RENEWED
    # Self-referential FK: links a renewed contract back to the original
    renewed_from_contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    vendor = relationship("Vendor", back_populates="contracts", lazy="selectin")
    renewed_from = relationship("Contract", remote_side="Contract.id", foreign_keys="[Contract.renewed_from_contract_id]", lazy="select")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    message = Column(String(500), nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    # type values: procurement_alert, delivery_delay, vendor_approval, contract_expiry, compliance, general
    type = Column(String(50), nullable=False, default="general")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class VendorPerformance(Base):
    __tablename__ = "vendor_performance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    on_time_deliveries = Column(Integer, nullable=False, default=0)
    delayed_deliveries = Column(Integer, nullable=False, default=0)
    quality_rating = Column(Float, nullable=False, default=5.0)
    service_rating = Column(Float, nullable=True, default=5.0)
    response_time_hours = Column(Float, nullable=False, default=24.0)
    issue_resolution_time_hours = Column(Float, nullable=False, default=48.0)
    order_completion_rate = Column(Float, nullable=False, default=100.0)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    vendor = relationship("Vendor", back_populates="performance_entries")


class VendorReliability(Base):
    __tablename__ = "vendor_reliability"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    delivery_score = Column(Float, nullable=False, default=100.0)
    quality_score = Column(Float, nullable=False, default=100.0)
    communication_score = Column(Float, nullable=False, default=100.0)
    compliance_score = Column(Float, nullable=False, default=100.0)
    overall_reliability_score = Column(Float, nullable=False, default=100.0)
    risk_level = Column(String(50), nullable=False, default="Low") # Low, Medium, High
    computed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    vendor = relationship("Vendor", back_populates="reliability_snapshots")


class Communication(Base):
    __tablename__ = "communications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    procurement_request_id = Column(UUID(as_uuid=True), ForeignKey("procurement_requests.id", ondelete="SET NULL"), nullable=True, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sender_role = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    attachment_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    vendor = relationship("Vendor", back_populates="communications")
    sender = relationship("User", back_populates="sent_communications")
    procurement_request = relationship("ProcurementRequest", lazy="selectin")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    details = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", lazy="selectin")


class Certification(Base):
    __tablename__ = "certifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    certification_name = Column(String(255), nullable=False)
    issued_date = Column(DateTime, nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    # status values: Valid, Expired, Pending Renewal
    status = Column(String(50), nullable=False, default="Valid", index=True)
    document_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    vendor = relationship("Vendor", back_populates="certifications")
