"""Milestone-1, 2, 3: Audit Trails & Compliance logging module.

Provides activity tracking and historical reconstructibility for Auditors and Administrators.
"""
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
    current_user: models.User = Depends(
        require_role(["admin", "auditor", "manager"])
    ),
    db: Session = Depends(get_db),
):
    """Retrieve system audit logs for compliance tracking."""
    query = db.query(models.AuditLog)

    if entity_type:
        query = query.filter(models.AuditLog.entity_type == entity_type)
    if action:
        query = query.filter(models.AuditLog.action == action)

    logs = query.order_by(models.AuditLog.created_at.desc()).limit(limit).all()

    result = []
    for log in logs:
        user = db.query(models.User).filter(models.User.id == log.user_id).first() if log.user_id else None
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_name": user.name if user else ("System" if not log.user_id else f"User #{log.user_id}"),
            "user_role": user.role if user else "system",
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return result


@router.get("/summary")
def audit_summary(
    current_user: models.User = Depends(
        require_role(["admin", "auditor", "manager"])
    ),
    db: Session = Depends(get_db),
):
    """Aggregated overview of logged activities."""
    logs = db.query(models.AuditLog).all()
    from collections import Counter
    actions = Counter(l.action for l in logs)
    entities = Counter(l.entity_type for l in logs)

    return {
        "total_events": len(logs),
        "total_logs": len(logs),
        "actions": [{"action": k, "count": v} for k, v in actions.items()],
        "entities": [{"entity_type": k, "count": v} for k, v in entities.items()],
    }


