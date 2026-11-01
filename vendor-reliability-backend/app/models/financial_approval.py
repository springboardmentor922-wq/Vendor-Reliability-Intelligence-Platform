from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class FinancialApproval(Base):
    __tablename__ = "financial_approvals"

    id = Column(Integer, primary_key=True, index=True)
    requisition_id = Column(Integer, ForeignKey("procurement_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_selection_id = Column(Integer, ForeignKey("vendor_selections.id", ondelete="CASCADE"), nullable=False, index=True)
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    budget_allocated = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), default="Approved", nullable=False, index=True) # Approved, Rejected
    rejection_reason = Column(Text, nullable=True)
    comments = Column(Text, nullable=True)
    
    # Non-blocking Blockchain Audit Integrity Fields
    blockchain_status = Column(String(50), default="PENDING", index=True)
    blockchain_tx_hash = Column(String(100), nullable=True)
    blockchain_confirmed_at = Column(DateTime, nullable=True)
    
    approved_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    requisition = relationship("ProcurementRequest", foreign_keys=[requisition_id])
    vendor_selection = relationship("VendorSelection", back_populates="financial_approval")
    approved_by = relationship("User", foreign_keys=[approved_by_id])
