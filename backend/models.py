from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="users", foreign_keys=[vendor_id])


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(150), nullable=False)
    category = Column(String(100))
    email = Column(String(150))
    phone = Column(String(20))
    address = Column(Text)
    status = Column(String(50), default="Pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    contacts = relationship("VendorContact", back_populates="vendor", cascade="all, delete-orphan")
    purchase_orders = relationship("PurchaseOrder", back_populates="vendor", cascade="all, delete-orphan")
    performance = relationship("VendorPerformance", back_populates="vendor", cascade="all, delete-orphan")
    contracts = relationship("Contract", back_populates="vendor", cascade="all, delete-orphan")
    communications = relationship("Communication", back_populates="vendor", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="vendor", cascade="all, delete-orphan")
    users = relationship("User", back_populates="vendor", foreign_keys=[User.vendor_id])


class VendorContact(Base):
    __tablename__ = "vendor_contacts"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    contact_name = Column(String(100), nullable=False)
    email = Column(String(150))
    phone = Column(String(20))
    designation = Column(String(100))

    vendor = relationship("Vendor", back_populates="contacts")


class ProcurementRequest(Base):
    __tablename__ = "procurement_requests"

    id = Column(Integer, primary_key=True, index=True)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    description = Column(Text, nullable=False)
    quantity = Column(Integer, nullable=False)
    department = Column(String(100), default="Information Technology")
    required_date = Column(DateTime)
    status = Column(String(50), default="Pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(50), unique=True, nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    procurement_request_id = Column(Integer, ForeignKey("procurement_requests.id"), nullable=True)
    order_date = Column(DateTime, default=datetime.utcnow)
    expected_delivery = Column(DateTime)
    department = Column(String(100), default="Information Technology")
    payment_terms = Column(String(50), default="Net 30")
    shipping_address = Column(Text, nullable=True)
    billing_address = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)
    subtotal = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    status = Column(String(50), default="Pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="purchase_orders")
    user = relationship("User")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="purchase_order", cascade="all, delete-orphan")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(
        Integer,
        ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False
    )
    product_name = Column(String(150), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=False, default=0.0)
    tax_percent = Column(Float, default=18.0)
    total_price = Column(Float, nullable=False, default=0.0)

    purchase_order = relationship(
        "PurchaseOrder",
        back_populates="items"
    )


class VendorPerformance(Base):
    __tablename__ = "vendor_performance"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    delivery_score = Column(Float, default=0.0)
    quality_score = Column(Float, default=0.0)
    cost_score = Column(Float, default=0.0)
    reliability_score = Column(Float, default=0.0)
    risk_level = Column(String(50), default="Medium")

    vendor = relationship(
        "Vendor",
        back_populates="performance"
    )


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    contract_name = Column(String(150), nullable=False)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    status = Column(String(50), default="Active")
    compliance_status = Column(String(50), default="Pending")
    document_path = Column(String(255))

    vendor = relationship(
        "Vendor",
        back_populates="contracts"
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50))
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class Communication(Base):
    __tablename__ = "communications"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    subject = Column(String(200), default="General Inquiry")
    attachment_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    vendor = relationship("Vendor", back_populates="communications")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    tax_amount = Column(Float, default=0.0)
    status = Column(String(50), default="Pending")
    due_date = Column(DateTime, nullable=True)
    paid_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    purchase_order = relationship("PurchaseOrder", back_populates="invoices")
    vendor = relationship("Vendor", back_populates="invoices")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

