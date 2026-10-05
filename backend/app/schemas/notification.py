from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationCreate(BaseModel):
    user_id: int
    vendor_id: int | None = None
    notification_type: str
    title: str
    message: str
    channel: str = "IN_APP"
    source_type: str | None = None
    source_id: int | None = None


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    vendor_id: int | None
    notification_type: str
    title: str
    message: str
    channel: str
    delivery_status: str
    is_read: bool
    source_type: str | None
    source_id: int | None
    created_at: datetime
    read_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class NotificationSummary(BaseModel):
    total: int
    unread: int
    procurement_alerts: int
    delivery_delays: int
    vendor_approvals: int
    contract_expiry_alerts: int
    compliance_alerts: int