from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class VendorSelection(Base):
    __tablename__ = "vendor_selections"

    id = Column(Integer, primary_key=True, index=True)
    requisition_id = Column(Integer, ForeignKey("procurement_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True)
    selected_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    quotation_amount = Column(Float, nullable=False)
    justification = Column(Text, nullable=True)
    status = Column(String(50), default="Awaiting Financial Approval", nullable=False, index=True) # Awaiting Financial Approval, Approved, Rejected
    rejection_reason = Column(Text, nullable=True)
    
    # Non-blocking Blockchain Audit Integrity Fields
    blockchain_status = Column(String(50), default="PENDING", index=True)
    blockchain_tx_hash = Column(String(100), nullable=True)
    blockchain_confirmed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    requisition = relationship("ProcurementRequest", foreign_keys=[requisition_id])
    vendor = relationship("Vendor", foreign_keys=[vendor_id])
    selected_by = relationship("User", foreign_keys=[selected_by_id])
    financial_approval = relationship("FinancialApproval", back_populates="vendor_selection", uselist=False)
