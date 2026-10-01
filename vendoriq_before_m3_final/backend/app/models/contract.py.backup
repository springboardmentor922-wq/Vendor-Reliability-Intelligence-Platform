import enum
from sqlalchemy import String, Enum, Float, ForeignKey, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class ContractStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRING = "expiring"
    EXPIRED = "expired"
    RENEWED = "renewed"
    TERMINATED = "terminated"


class CertificationStatus(str, enum.Enum):
    VALID = "valid"
    EXPIRING = "expiring"
    EXPIRED = "expired"


class Contract(Base, TimestampMixin):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    contract_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    start_date: Mapped[DateTime] = mapped_column(DateTime, nullable=False)
    end_date: Mapped[DateTime] = mapped_column(DateTime, nullable=False)
    value: Mapped[float] = mapped_column(Float, default=0.0)

    status: Mapped[ContractStatus] = mapped_column(Enum(ContractStatus), default=ContractStatus.ACTIVE)
    file_path: Mapped[str] = mapped_column(String(500), nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    certifications: Mapped[list["Certification"]] = relationship(
        "Certification", back_populates="contract", cascade="all, delete-orphan"
    )


class Certification(Base, TimestampMixin):
    __tablename__ = "certifications"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"), nullable=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    issuing_body: Mapped[str] = mapped_column(String(200), nullable=True)
    issue_date: Mapped[DateTime] = mapped_column(DateTime, nullable=True)
    expiry_date: Mapped[DateTime] = mapped_column(DateTime, nullable=True)
    status: Mapped[CertificationStatus] = mapped_column(Enum(CertificationStatus), default=CertificationStatus.VALID)
    file_path: Mapped[str] = mapped_column(String(500), nullable=True)

    contract: Mapped["Contract"] = relationship("Contract", back_populates="certifications")
