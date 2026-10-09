"""SQLAlchemy domain models for VendorIQ."""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (Index("ix_users_role", "role"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(
        String(150), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="vendor")
    vendor_id: Mapped[int | None] = mapped_column(
        ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True, index=True
    )
    password_reset_token_hash: Mapped[str | None] = mapped_column(
        String(128), nullable=True
    )
    password_reset_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    vendor: Mapped["Vendor | None"] = relationship(
        "Vendor", back_populates="users", foreign_keys=[vendor_id]
    )


class Vendor(Base):
    __tablename__ = "vendors"
    __table_args__ = (
        Index("ix_vendors_status", "status"),
        Index("ix_vendors_category", "category"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(150))
    phone: Mapped[str | None] = mapped_column(String(30))
    website: Mapped[str | None] = mapped_column(String(255))
    tax_id: Mapped[str | None] = mapped_column(String(80))
    country: Mapped[str | None] = mapped_column(String(80), default="India")
    address: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="Pending", nullable=False)
    risk_level: Mapped[str] = mapped_column(
        String(20), default="Medium", nullable=False
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    contacts: Mapped[list["VendorContact"]] = relationship(
        "VendorContact", back_populates="vendor", cascade="all, delete-orphan"
    )
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(
        "PurchaseOrder", back_populates="vendor", cascade="all, delete-orphan"
    )
    performance: Mapped[list["VendorPerformance"]] = relationship(
        "VendorPerformance", back_populates="vendor", cascade="all, delete-orphan"
    )
    contracts: Mapped[list["Contract"]] = relationship(
        "Contract", back_populates="vendor", cascade="all, delete-orphan"
    )
    communications: Mapped[list["Communication"]] = relationship(
        "Communication", back_populates="vendor", cascade="all, delete-orphan"
    )
    invoices: Mapped[list["Invoice"]] = relationship(
        "Invoice", back_populates="vendor", cascade="all, delete-orphan"
    )
    documents: Mapped[list["VendorDocument"]] = relationship(
        "VendorDocument", back_populates="vendor", cascade="all, delete-orphan"
    )
    users: Mapped[list["User"]] = relationship(
        "User", back_populates="vendor", foreign_keys=[User.vendor_id]
    )


class VendorContact(Base):
    __tablename__ = "vendor_contacts"
    __table_args__ = (Index("ix_vendor_contacts_vendor", "vendor_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False
    )
    contact_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(150))
    phone: Mapped[str | None] = mapped_column(String(30))
    designation: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    vendor: Mapped[Vendor] = relationship("Vendor", back_populates="contacts")


class ProcurementRequest(Base):
    __tablename__ = "procurement_requests"
    __table_args__ = (
        Index("ix_pr_status", "status"),
        Index("ix_pr_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requested_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    department: Mapped[str] = mapped_column(
        String(100), default="Information Technology"
    )
    priority: Mapped[str] = mapped_column(String(30), default="Normal")
    estimated_budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    justification: Mapped[str | None] = mapped_column(Text)
    required_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(50), default="Pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    user: Mapped[User] = relationship("User")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        Index("ix_po_vendor", "vendor_id"),
        Index("ix_po_status", "status"),
        Index("ix_po_expected_delivery", "expected_delivery"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    po_number: Mapped[str | None] = mapped_column(
        String(50), unique=True, nullable=True
    )
    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False
    )
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    procurement_request_id: Mapped[int | None] = mapped_column(
        ForeignKey("procurement_requests.id", ondelete="SET NULL"), nullable=True
    )
    order_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    requested_delivery: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expected_delivery: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_delivery: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    department: Mapped[str] = mapped_column(
        String(100), default="Information Technology"
    )
    payment_terms: Mapped[str] = mapped_column(String(80), default="Net 30")
    shipping_address: Mapped[str | None] = mapped_column(Text)
    billing_address: Mapped[str | None] = mapped_column(Text)
    remarks: Mapped[str | None] = mapped_column(Text)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="Pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    vendor: Mapped[Vendor] = relationship("Vendor", back_populates="purchase_orders")
    user: Mapped[User] = relationship("User", foreign_keys=[created_by])
    items: Mapped[list["PurchaseOrderItem"]] = relationship(
        "PurchaseOrderItem",
        back_populates="purchase_order",
        cascade="all, delete-orphan",
    )
    invoices: Mapped[list["Invoice"]] = relationship(
        "Invoice", back_populates="purchase_order", cascade="all, delete-orphan"
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    __table_args__ = (Index("ix_po_items_po", "purchase_order_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    purchase_order_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    product_name: Mapped[str] = mapped_column(String(150), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tax_percent: Mapped[float] = mapped_column(Float, default=18.0)
    total_price: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    purchase_order: Mapped[PurchaseOrder] = relationship(
        "PurchaseOrder", back_populates="items"
    )


class PurchaseOrderApproval(Base):
    __tablename__ = "purchase_order_approvals"
    __table_args__ = (Index("ix_po_approvals_po", "purchase_order_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    purchase_order_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    approver_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    decision: Mapped[str] = mapped_column(String(30), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    purchase_order: Mapped[PurchaseOrder] = relationship("PurchaseOrder")
    approver: Mapped[User] = relationship("User")


class VendorPerformance(Base):
    __tablename__ = "vendor_performance"
    __table_args__ = (Index("ix_vendor_performance_vendor", "vendor_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False
    )
    delivery_score: Mapped[float] = mapped_column(Float, default=0.0)
    quality_score: Mapped[float] = mapped_column(Float, default=0.0)
    cost_score: Mapped[float] = mapped_column(Float, default=0.0)
    communication_score: Mapped[float] = mapped_column(Float, default=0.0)
    service_score: Mapped[float] = mapped_column(Float, default=0.0)
    issue_resolution_score: Mapped[float] = mapped_column(Float, default=0.0)
    reliability_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(50), default="Medium")
    notes: Mapped[str | None] = mapped_column(Text)
    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    vendor: Mapped[Vendor] = relationship("Vendor", back_populates="performance")


class Contract(Base):
    __tablename__ = "contracts"
    __table_args__ = (
        Index("ix_contracts_vendor", "vendor_id"),
        Index("ix_contracts_end_date", "end_date"),
        Index("ix_contracts_compliance", "compliance_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False
    )
    contract_name: Mapped[str] = mapped_column(String(150), nullable=False)
    contract_reference: Mapped[str | None] = mapped_column(String(80))
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(50), default="Active")
    compliance_status: Mapped[str] = mapped_column(String(50), default="Pending")
    auto_renew: Mapped[bool] = mapped_column(Boolean, default=False)
    document_path: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    vendor: Mapped[Vendor] = relationship("Vendor", back_populates="contracts")


class VendorDocument(Base):
    __tablename__ = "vendor_documents"
    __table_args__ = (
        Index("ix_vendor_documents_vendor", "vendor_id"),
        Index("ix_vendor_documents_type", "document_type"),
        Index("ix_vendor_documents_entity", "entity_type", "entity_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False
    )
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(
        String(50), default="vendor", nullable=False
    )
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    vendor: Mapped[Vendor] = relationship("Vendor", back_populates="documents")
    user: Mapped[User] = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_read", "user_id", "is_read"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str | None] = mapped_column(String(50))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    user: Mapped[User] = relationship("User")


class Communication(Base):
    __tablename__ = "communications"
    __table_args__ = (
        Index("ix_communications_vendor_created", "vendor_id", "created_at"),
        Index("ix_communications_sender", "sender_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sender_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    subject: Mapped[str] = mapped_column(String(200), default="General Inquiry")
    thread_id: Mapped[str | None] = mapped_column(String(80), index=True)
    attachment_path: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    user: Mapped[User] = relationship("User")
    vendor: Mapped[Vendor] = relationship("Vendor", back_populates="communications")


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        Index("ix_invoices_vendor", "vendor_id"),
        Index("ix_invoices_status", "status"),
        Index("ix_invoices_due_date", "due_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    purchase_order_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="Pending")
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    document_path: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    purchase_order: Mapped[PurchaseOrder] = relationship(
        "PurchaseOrder", back_populates="invoices"
    )
    vendor: Mapped[Vendor] = relationship("Vendor", back_populates="invoices")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_created", "created_at"),
        Index("ix_audit_entity", "entity_type", "entity_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    user: Mapped[User | None] = relationship("User")
