from sqlalchemy import Column, Integer, String, Date, Text, Float
from app.database.base import Base


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, nullable=False)
    contract_number = Column(String, unique=True, nullable=False)
    contract_type = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    contract_value = Column(Float, nullable=True)
    renewal_date = Column(Date, nullable=True)
    terms = Column(Text, nullable=True)
    document = Column(String, nullable=True)
    compliance_status = Column(String, default="COMPLIANT", nullable=False)
    status = Column(String, default="ACTIVE", nullable=False)