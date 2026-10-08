from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.scoring import calculate_reliability_score
from app.core.audit import log_action
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.schemas.vendor import VendorCreate, VendorUpdate, VendorOut

router = APIRouter(prefix="/vendors", tags=["Vendors"])

MANAGE_ROLES = (UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER, UserRole.SUPPLY_CHAIN_MANAGER)


def enrich_vendor(db: Session, vendor: Vendor) -> Vendor:
    score_data = calculate_reliability_score(db, vendor.id)
    vendor.risk_level = score_data["risk_level"]
    vendor.recommendation = score_data["recommendation"]

    if vendor.previous_reliability_score is not None:
        diff = vendor.reliability_score - vendor.previous_reliability_score
        vendor.trend = "improving" if diff > 0.5 else "declining" if diff < -0.5 else "stable"
    else:
        vendor.trend = None

    return vendor


@router.post("/", response_model=VendorOut, status_code=status.HTTP_201_CREATED)
def create_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    existing = db.query(Vendor).filter(Vendor.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vendor with this email already exists")

    vendor = Vendor(**payload.model_dump())
    db.add(vendor)
    db.commit()
    db.refresh(vendor)

    log_action(db, current_user.id, f"Registered vendor '{vendor.company_name}'", "vendor", vendor.id)

    return enrich_vendor(db, vendor)


@router.get("/", response_model=List[VendorOut])
def list_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendors = db.query(Vendor).all()
    return [enrich_vendor(db, v) for v in vendors]


@router.get("/{vendor_id}", response_model=VendorOut)
def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return enrich_vendor(db, vendor)


@router.put("/{vendor_id}", response_model=VendorOut)
def update_vendor(
    vendor_id: int,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    update_data = payload.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] != vendor.status:
        old_status = vendor.status.value if hasattr(vendor.status, "value") else vendor.status
        new_status = update_data["status"]
        log_action(
            db, current_user.id,
            f"Changed vendor '{vendor.company_name}' status: {old_status} -> {new_status}",
            "vendor", vendor.id,
            details=f"from={old_status}, to={new_status}",
        )

    for field, value in update_data.items():
        setattr(vendor, field, value)

    db.commit()
    db.refresh(vendor)
    return enrich_vendor(db, vendor)


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    db.delete(vendor)
    db.commit()
    return None