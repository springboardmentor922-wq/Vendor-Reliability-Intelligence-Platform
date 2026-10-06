from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database.base import Base


class VendorApproval(Base):
    __tablename__ = "vendor_approvals"

    id = Column(Integer, primary_key=True, index=True)

    vendor_id = Column(Integer, nullable=False)

    status = Column(String, default="PENDING", nullable=False)

    approved_by = Column(String, nullable=True)

    remarks = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )