from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class ProcurementRequest(Base):
    __tablename__ = "procurement_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String(50), unique=True, index=True, nullable=False) # e.g. PR-2026-0001
    department = Column(String(100), default="IT", nullable=False)
    title = Column(String(200), nullable=False) # Required Material/Product name
    description = Column(Text, nullable=True) # Reason/Description
    quantity = Column(Float, default=1.0, nullable=False)
    required_date = Column(DateTime, nullable=True)
    category = Column(String(100), default="Raw Material Suppliers", nullable=False, index=True)
    priority = Column(String(50), default="Medium") # Low, Medium, High, Urgent
    unit_budget = Column(Float, default=0.0, nullable=True) # Budget assigned per unit
    estimated_budget = Column(Float, default=0.0) # Total estimated budget
    status = Column(String(50), default="SUBMITTED", nullable=False, index=True)
    
    requested_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True, index=True)
    
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approval_date = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    delivery_deadline = Column(DateTime, nullable=True)
    
    # Non-blocking Blockchain Audit Integrity Fields
    blockchain_status = Column(String(50), default="PENDING", index=True)
    blockchain_tx_hash = Column(String(100), nullable=True)
    blockchain_confirmed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    vendor = relationship("Vendor", back_populates="procurement_requests")
    purchase_orders = relationship("PurchaseOrder", back_populates="procurement_request")
    items = relationship("PurchaseRequisitionItem", back_populates="requisition", cascade="all, delete-orphan")
    vendor_selections = relationship("VendorSelection", back_populates="requisition", cascade="all, delete-orphan")
    financial_approvals = relationship("FinancialApproval", back_populates="requisition", cascade="all, delete-orphan")

class PurchaseRequisitionItem(Base):
    __tablename__ = "purchase_requisition_items"

    id = Column(Integer, primary_key=True, index=True)
    requisition_id = Column(Integer, ForeignKey("procurement_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    item_name = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)
    quantity = Column(Float, default=1.0, nullable=False)
    estimated_unit_price = Column(Float, default=0.0, nullable=False)
    estimated_total_price = Column(Float, default=0.0, nullable=False)
    sku = Column(String(50), nullable=True)
    specifications = Column(Text, nullable=True)

    requisition = relationship("ProcurementRequest", back_populates="items")

# Alias for normalized naming
PurchaseRequisition = ProcurementRequest
