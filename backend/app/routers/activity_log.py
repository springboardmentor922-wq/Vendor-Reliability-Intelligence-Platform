from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.activity_log import ActivityLog
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/activity-logs",
    tags=["Activity Logs"]
)


ALL_ROLES = [
    "ADMINISTRATOR",
    "PROCUREMENT_MANAGER",
    "SUPPLY_CHAIN_MANAGER",
    "VENDOR",
    "FINANCE_OFFICER",
    "AUDITOR"
]


@router.get("/")
def get_activity_logs(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*ALL_ROLES)
    )
):
    return (
        db.query(ActivityLog)
        .order_by(ActivityLog.created_at.desc())
        .all()
    )


@router.post("/")
def create_activity_log(
    user: str,
    action: str,
    related_record: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*ALL_ROLES)
    )
):
    activity = ActivityLog(
        user=user,
        action=action,
        related_record=related_record
    )

    db.add(activity)
    db.commit()
    db.refresh(activity)

    return activity