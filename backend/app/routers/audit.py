from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.audit import AuditLogResponse
from app.core.dependencies import require_roles

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    entity: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMINISTRATOR, UserRole.AUDITOR]))
):
    query = db.query(AuditLog).options(joinedload(AuditLog.user))
    if entity:
        query = query.filter(AuditLog.entity.ilike(f"%{entity}%"))
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    return query.order_by(AuditLog.id.desc()).limit(limit).all()
