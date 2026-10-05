from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.entities import Vendor, VendorCategoryEnum, VendorStatusEnum

router = APIRouter(prefix="/api/vendors", tags=["Vendor Service"])

class VendorCreate(BaseModel):
    vendor_code: str
    name: str
    category: VendorCategoryEnum
    contact_email: str
    phone: Optional[str] = None

class VendorResponse(BaseModel):
    id: int
    vendor_code: str
    name: str
    category: str
    contact_email: str
    status: str
    reliability_score: float = 90.0
    risk_level: str = "Medium"

    class Config:
        from_attributes = True

@router.post("/", response_model=VendorResponse)
def create_vendor(vendor: VendorCreate, db: Session = Depends(get_db)):
    db_vendor = Vendor(
        **vendor.model_dump(),
        status=VendorStatusEnum.APPROVED,
        reliability_score=92.5
    )
    db.add(db_vendor)
    db.commit()
    db.refresh(db_vendor)
    return db_vendor

@router.get("/", response_model=List[VendorResponse])
def get_vendors(
    category: Optional[VendorCategoryEnum] = None,
    status: Optional[VendorStatusEnum] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Vendor)
    if category:
        query = query.filter(Vendor.category == category)
    if status:
        query = query.filter(Vendor.status == status)
    return query.all()

@router.put("/{vendor_id}/approve", response_model=VendorResponse)
def approve_vendor(vendor_id: int, db: Session = Depends(get_db)):
    """Matches Swagger route: PUT /api/vendors/{vendor_id}/approve"""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor.status = VendorStatusEnum.APPROVED
    db.commit()
    db.refresh(vendor)
    return vendor

@router.put("/{vendor_id}/status")
def update_vendor_status(vendor_id: int, new_status: VendorStatusEnum, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor.status = new_status
    db.commit()
    return {"message": f"Vendor status updated to {new_status}"}