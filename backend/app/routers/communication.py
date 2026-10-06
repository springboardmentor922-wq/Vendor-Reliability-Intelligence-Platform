from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.communication import Communication
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/communications",
    tags=["Communications"]
)


ALL_ROLES = [
    "ADMINISTRATOR",
    "PROCUREMENT_MANAGER",
    "SUPPLY_CHAIN_MANAGER",
    "VENDOR",
    "FINANCE_OFFICER",
    "AUDITOR"
]


@router.post("/")
def create_communication(
    sender: str,
    receiver: str,
    subject: str,
    message: str,
    communication_type: str = "MESSAGE",
    related_record: str = None,
    attachment: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*ALL_ROLES)
    )
):
    communication = Communication(
        sender=sender,
        receiver=receiver,
        subject=subject,
        message=message,
        communication_type=communication_type,
        related_record=related_record,
        attachment=attachment,
        status="UNREAD"
    )

    db.add(communication)
    db.commit()
    db.refresh(communication)

    return communication


@router.get("/")
def get_communications(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*ALL_ROLES)
    )
):
    return (
        db.query(Communication)
        .order_by(Communication.created_at.desc())
        .all()
    )


@router.get("/{communication_id}")
def get_communication(
    communication_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*ALL_ROLES)
    )
):
    communication = (
        db.query(Communication)
        .filter(Communication.id == communication_id)
        .first()
    )

    if not communication:
        raise HTTPException(
            status_code=404,
            detail="Communication not found"
        )

    return communication


@router.put("/{communication_id}/read")
def mark_as_read(
    communication_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*ALL_ROLES)
    )
):
    communication = (
        db.query(Communication)
        .filter(Communication.id == communication_id)
        .first()
    )

    if not communication:
        raise HTTPException(
            status_code=404,
            detail="Communication not found"
        )

    communication.status = "READ"

    db.commit()
    db.refresh(communication)

    return communication