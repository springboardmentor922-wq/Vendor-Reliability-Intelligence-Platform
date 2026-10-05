from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    contract_number: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(
        String(200), nullable=False
    )

    contract_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id"), nullable=False, index=True
    )

    start_date: Mapped[date] = mapped_column(
        Date, nullable=False
    )

    end_date: Mapped[date] = mapped_column(
        Date, nullable=False
    )

    renewal_date: Mapped[date | None] = mapped_column(
        Date, nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="Active"
    )

    compliance_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="Under Review"
    )

    contract_value: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=0
    )

    payment_terms: Mapped[str] = mapped_column(
        String(200), nullable=True, default=""
    )

    notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


class Certification(Base):
    __tablename__ = "certifications"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(
        String(200), nullable=False
    )

    certificate_number: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    issue_date: Mapped[date] = mapped_column(
        Date, nullable=False
    )

    expiry_date: Mapped[date] = mapped_column(
        Date, nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="Active"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


class VendorDocument(Base):
    __tablename__ = "vendor_documents"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("vendors.id"), nullable=False, index=True
    )

    document_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    document_name: Mapped[str] = mapped_column(
        String(200), nullable=False
    )

    document_number: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    issue_date: Mapped[date | None] = mapped_column(
        Date, nullable=True
    )

    expiry_date: Mapped[date | None] = mapped_column(
        Date, nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="Active"
    )

    notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )