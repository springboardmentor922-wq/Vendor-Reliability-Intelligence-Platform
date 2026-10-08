from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.audit import log_action
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.models.certification import Certification
from app.schemas.certification import CertificationCreate, CertificationUpdate, CertificationOut

router = APIRouter(prefix="/certifications", tags=["Certifications"])

MANAGE_ROLES = (UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER, UserRole.AUDITOR)


@router.post("/", response_model=CertificationOut, status_code=status.HTTP_201_CREATED)
def create_certification(
    payload: CertificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    cert = Certification(**payload.model_dump())
    db.add(cert)
    db.commit()
    db.refresh(cert)

    log_action(db, current_user.id, f"Added certification '{cert.name}' for {vendor.company_name}", "certification", cert.id)

    return cert


@router.get("/", response_model=List[CertificationOut])
def list_certifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Certification).all()


@router.get("/vendor/{vendor_id}", response_model=List[CertificationOut])
def get_vendor_certifications(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Certification).filter(Certification.vendor_id == vendor_id).all()


@router.put("/{cert_id}", response_model=CertificationOut)
def update_certification(
    cert_id: int,
    payload: CertificationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    cert = db.query(Certification).filter(Certification.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certification not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cert, field, value)

    db.commit()
    db.refresh(cert)
    return cert