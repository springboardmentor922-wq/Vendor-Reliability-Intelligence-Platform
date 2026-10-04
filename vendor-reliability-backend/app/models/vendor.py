from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class VendorCategory(Base):
    __tablename__ = "vendor_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    company = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False)
    phone = Column(String(50), nullable=False)
    address = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    product = Column(String(150), nullable=False)
    category = Column(String(100), default="Raw Material Suppliers", nullable=False, index=True)
    status = Column(String(50), default="Pending", nullable=False, index=True) # Pending, Approved, Rejected, Under Review
    deliveryRate = Column(Float, default=0.0)  # Legacy compatibility attribute name
    quality_rating = Column(Float, default=4.0)
    response_time_hours = Column(Float, default=24.0)
    risk_level = Column(String(50), default="Low", index=True) # Low, Medium, High
    business_reg_number = Column(String(100), nullable=True) # Corporate registration ID / CIN
    gst_tax_id = Column(String(100), nullable=True) # GST / Tax identification
    bank_details = Column(String(255), nullable=True) # Bank, account, IFSC/SWIFT
    notes = Column(Text, nullable=True)
    
    # Review / Approval fields
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="vendor")
    reviewer = relationship("User", foreign_keys=[reviewed_by_id])
    contacts = relationship("VendorContact", back_populates="vendor", cascade="all, delete-orphan")
    documents = relationship("VendorDocument", back_populates="vendor", cascade="all, delete-orphan")
    products = relationship("VendorProduct", back_populates="vendor", cascade="all, delete-orphan")
    procurement_requests = relationship("ProcurementRequest", back_populates="vendor")
    purchase_orders = relationship("PurchaseOrder", back_populates="vendor")
    contracts = relationship("Contract", back_populates="vendor", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="vendor")

class VendorContact(Base):
    __tablename__ = "vendor_contacts"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    contact_name = Column(String(100), nullable=False)
    title = Column(String(100), nullable=True)
    email = Column(String(150), nullable=False)
    phone = Column(String(50), nullable=False)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="contacts")

class VendorDocument(Base):
    __tablename__ = "vendor_documents"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    document_type = Column(String(100), nullable=False) # e.g. Business Registration, GST Certificate, ISO-9001, Bank Proof
    document_name = Column(String(200), nullable=False)
    document_url = Column(String(255), nullable=True)
    status = Column(String(50), default="VERIFIED") # PENDING, VERIFIED, EXPIRED
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="documents")

class VendorProduct(Base):
    __tablename__ = "vendor_products"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    product_name = Column(String(150), nullable=False)
    category = Column(String(100), default="Raw Material Suppliers")
    unit_price = Column(Float, default=0.0)
    lead_time_days = Column(Integer, default=7)
    in_stock = Column(Boolean, default=True)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="products")
