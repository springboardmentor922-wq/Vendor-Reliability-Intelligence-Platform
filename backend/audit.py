"""Audit trail endpoints for governance and review."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
import models
from deps import get_current_user, get_db, require_role

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])


@router.get("")
def list_audit_logs(
    entity_type: str | None = None,
    action: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: models.User = Depends(
        require_role(["administrator", "auditor", "supply_chain_manager"])
    ),
    db: Session = Depends(get_db),
):
    query = db.query(models.AuditLog)
    if entity_type:
        query = query.filter(models.AuditLog.entity_type == entity_type)
    if action:
        query = query.filter(models.AuditLog.action == action)
    logs = (
        query.order_by(models.AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "user_name": l.user.name
            if l.user
            else ("System" if l.user_id is None else f"User #{l.user_id}"),
            "user_role": l.user.role if l.user else "system",
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


@router.get("/summary")
def audit_summary(
    current_user: models.User = Depends(
        require_role(["administrator", "auditor", "supply_chain_manager"])
    ),
    db: Session = Depends(get_db),
):
    logs = db.query(models.AuditLog).all()
    from collections import Counter

    return {
        "total_events": len(logs),
        "actions": [
            {"action": k, "count": v}
            for k, v in Counter(x.action for x in logs).most_common()
        ],
        "entities": [
            {"entity_type": k, "count": v}
            for k, v in Counter(x.entity_type for x in logs).most_common()
        ],
    }
