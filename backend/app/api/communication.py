from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.communication import Communication
from app.schemas.communication import (
    CommunicationCreate,
    CommunicationResponse,
    CommunicationStatusUpdate
)

router = APIRouter(
    prefix="/api/communications",
    tags=["Communication"]
)


@router.get(
    "",
    response_model=list[CommunicationResponse]
)
def get_communications(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return (
        db.query(Communication)
        .order_by(Communication.created_at.desc())
        .all()
    )


@router.post(
    "",
    response_model=CommunicationResponse,
    status_code=status.HTTP_201_CREATED
)
def create_communication(
    communication: CommunicationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    new_communication = Communication(
        vendor_id=communication.vendor_id,
        user_id=current_user.id,
        communication_type=communication.communication_type,
        subject=communication.subject,
        message=communication.message,
        recipient=communication.recipient,
        attachment_name=communication.attachment_name,
        status=communication.status
    )

    db.add(new_communication)
    db.commit()
    db.refresh(new_communication)

    return new_communication


@router.patch(
    "/{communication_id}/status",
    response_model=CommunicationResponse
)
def update_communication_status(
    communication_id: int,
    payload: CommunicationStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    communication = (
        db.query(Communication)
        .filter(
            Communication.id == communication_id
        )
        .first()
    )

    if not communication:
        raise HTTPException(
            status_code=404,
            detail="Communication record not found."
        )

    communication.status = payload.status

    db.commit()
    db.refresh(communication)

    return communication


@router.delete(
    "/{communication_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_communication(
    communication_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    communication = (
        db.query(Communication)
        .filter(
            Communication.id == communication_id
        )
        .first()
    )

    if not communication:
        raise HTTPException(
            status_code=404,
            detail="Communication record not found."
        )

    db.delete(communication)
    db.commit()

    return None