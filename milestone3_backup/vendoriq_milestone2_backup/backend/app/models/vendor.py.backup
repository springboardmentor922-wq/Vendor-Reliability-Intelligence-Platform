import enum
from sqlalchemy import String, Enum, Float, ForeignKey, Text, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class VendorCategory(str, enum.Enum):
    RAW_MATERIAL = "raw_material_suppliers"
    EQUIPMENT = "equipment_vendors"
    IT = "it_vendors"
    SERVICE = "service_providers"
    LOGISTICS = "logistics_partners"
    MAINTENANCE = "maintenance_vendors"


class VendorStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"
    ACTIVE = "active"
    INACTIVE = "inactive"


class Vendor(Base, TimestampMixin):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True, unique=True)

    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[VendorCategory] = mapped_column(Enum(VendorCategory), nullable=False)
    registration_number: Mapped[str] = mapped_column(String(100), nullable=True)
    tax_id: Mapped[str] = mapped_column(String(100), nullable=True)

    contact_person: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=True)
    state: Mapped[str] = mapped_column(String(100), nullable=True)
    country: Mapped[str] = mapped_column(String(100), nullable=True)

    status: Mapped[VendorStatus] = mapped_column(Enum(VendorStatus), default=VendorStatus.PENDING, nullable=False)
    approved_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    approval_notes: Mapped[str] = mapped_column(Text, nullable=True)

    rating: Mapped[float] = mapped_column(Float, default=0.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    contacts: Mapped[list["VendorContact"]] = relationship(
        "VendorContact", back_populates="vendor", cascade="all, delete-orphan"
    )


class VendorContact(Base, TimestampMixin):
    __tablename__ = "vendor_contacts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    designation: Mapped[str] = mapped_column(String(100), nullable=True)
    email: Mapped[str] = mapped_column(String(150), nullable=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="contacts")
