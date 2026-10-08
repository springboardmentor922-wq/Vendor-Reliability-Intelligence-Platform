from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.certification import ComplianceStatus


class CertificationCreate(BaseModel):
    vendor_id: int
    name: str
    document_url: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiry_date: datetime
    compliance_status: ComplianceStatus = ComplianceStatus.PENDING_REVIEW


class CertificationUpdate(BaseModel):
    compliance_status: Optional[ComplianceStatus] = None


class CertificationOut(BaseModel):
    id: int
    vendor_id: int
    name: str
    document_url: Optional[str]
    issue_date: Optional[datetime]
    expiry_date: datetime
    compliance_status: ComplianceStatus
    created_at: datetime

    class Config:
        from_attributes = True