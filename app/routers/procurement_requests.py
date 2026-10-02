from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.procurement_request import ProcurementRequest
from app.schemas.procurement_request import ProcurementRequestCreate, ProcurementRequestUpdate, ProcurementRequestOut

router = APIRouter(prefix="/procurement-requests", tags=["Procurement Requests"])

MANAGE_ROLES = (UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER, UserRole.SUPPLY_CHAIN_MANAGER)


@router.post("/", response_model=ProcurementRequestOut, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: ProcurementRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    existing = db.query(ProcurementRequest).filter(
        ProcurementRequest.request_number == payload.request_number
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Request number already exists")

    req = ProcurementRequest(**payload.model_dump(), requested_by_id=current_user.id)
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("/", response_model=List[ProcurementRequestOut])
def list_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(ProcurementRequest).all()


@router.get("/{request_id}", response_model=ProcurementRequestOut)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = db.query(ProcurementRequest).filter(ProcurementRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Procurement request not found")
    return req


@router.put("/{request_id}", response_model=ProcurementRequestOut)
def update_request(
    request_id: int,
    payload: ProcurementRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    req = db.query(ProcurementRequest).filter(ProcurementRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Procurement request not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(req, field, value)

    db.commit()
    db.refresh(req)
    return req