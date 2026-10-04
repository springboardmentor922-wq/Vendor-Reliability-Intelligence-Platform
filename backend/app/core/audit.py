from sqlalchemy.orm import Session
from typing import Optional
import json
from app.models.audit import AuditLog

def log_audit_event(
    db: Session,
    user_id: Optional[int],
    action: str,
    entity: str,
    details: Optional[dict | str] = None
):
    details_str = json.dumps(details) if isinstance(details, dict) else details
    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        details=details_str
    )
    db.add(log_entry)
    db.commit()
