from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class AuditFinding(Base):
    __tablename__ = "audit_findings"

    id = Column(Integer, primary_key=True, index=True)
    transaction_type = Column(String(50), nullable=False) # PurchaseRequisition, PurchaseOrder, Delivery, Invoice, Payment, VendorSelection
    transaction_id = Column(Integer, nullable=False)
    reference_number = Column(String(100), nullable=True) # PR-2026-0001, PO-2026-0001, etc.
    auditor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    finding_type = Column(String(100), nullable=False) # Discrepancy, SLA Breach, Budget Variance, Missing Approval, Compliance Warning
    severity = Column(String(50), default="Medium", nullable=False) # Low, Medium, High, Critical
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(50), default="OPEN", nullable=False) # OPEN, UNDER_REVIEW, RESOLVED
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    auditor = relationship("User", foreign_keys=[auditor_id])

class AuditReviewStatus(Base):
    __tablename__ = "audit_review_statuses"

    id = Column(Integer, primary_key=True, index=True)
    transaction_type = Column(String(50), nullable=False)
    transaction_id = Column(Integer, nullable=False)
    auditor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), default="Compliant", nullable=False) # Compliant, Discrepancy Found, Under Audit, Cleared
    comments = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    auditor = relationship("User", foreign_keys=[auditor_id])
