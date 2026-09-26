from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class InvoiceStatus:
    PENDING = "Pending"
    APPROVED = "Approved"
    PAID = "Paid"
    OVERDUE = "Overdue"
    DISPUTED = "Disputed"

    ALL = [PENDING, APPROVED, PAID, OVERDUE, DISPUTED]


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(BigInteger, primary_key=True, index=True)

    invoice_number = Column(String(50), nullable=False, unique=True, index=True)

    purchase_order_id = Column(
        BigInteger,
        ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=True
    )

    vendor_id = Column(BigInteger, ForeignKey("vendors.id"), nullable=False)

    invoice_date = Column(Date, nullable=False, server_default=func.current_date())
    due_date = Column(Date, nullable=True)

    amount = Column(Numeric(15, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(15, 2), nullable=False, default=0)
    total_amount = Column(Numeric(15, 2), nullable=False, default=0)
    currency = Column(String(10), nullable=False, default="USD")

    status = Column(String(50), nullable=False, default=InvoiceStatus.PENDING)
    payment_date = Column(Date, nullable=True)
    document_path = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )

    purchase_order = relationship("PurchaseOrder", back_populates="invoices")
    vendor = relationship("Vendor")
