from sqlalchemy import Column, Integer, String, Date
from app.database.base import Base


class Certification(Base):
    __tablename__ = "certifications"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, nullable=False)
    certification_name = Column(String, nullable=False)
    certificate_number = Column(String, unique=True, nullable=False)
    issue_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False)
    status = Column(String, default="VALID", nullable=False)
    document = Column(String, nullable=True)