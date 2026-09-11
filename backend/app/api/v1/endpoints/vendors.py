from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.session import get_db
from app.models.vendor import Vendor
from app.schemas.vendor import VendorCreate, VendorResponse, VendorUpdate
from app.api import deps
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[VendorResponse])
def get_vendors(
    db: Session = Depends(get_db),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user)
):
    query = db.query(Vendor)
    
    # Restrict external vendors to their own company profile only
    if current_user.role == "Vendor":
        query = query.filter(Vendor.email == current_user.email)
        
    if category and category != "All":
        query = query.filter(Vendor.category == category)
    if status and status != "All":
        query = query.filter(Vendor.status == status)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            or_(
                Vendor.company_name.ilike(search_fmt),
                Vendor.contact_name.ilike(search_fmt),
                Vendor.email.ilike(search_fmt)
            )
        )
    return query.offset(skip).limit(limit).all()

@router.post("/", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor(
    vendor_in: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Strictly enforce: Suppliers/Vendors, Finance, Auditor, Supply Chain cannot onboard vendors
    if current_user.role not in ["Procurement Manager", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: {current_user.role} role is not authorized to onboard new vendors. Only Procurement Managers and Administrators can register suppliers."
        )

    # Check if vendor already exists
    existing = db.query(Vendor).filter(
        or_(Vendor.company_name == vendor_in.company_name, Vendor.email == vendor_in.email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A vendor with this company name or email already exists."
        )
    
    vendor = Vendor(
        company_name=vendor_in.company_name,
        contact_name=vendor_in.contact_name,
        email=vendor_in.email,
        phone=vendor_in.phone,
        address=vendor_in.address,
        category=vendor_in.category,
        tax_id=vendor_in.tax_id,
        country=vendor_in.country or "United States",
        city=vendor_in.city,
        payment_terms=vendor_in.payment_terms or "Net 30",
        bank_account=vendor_in.bank_account,
        certifications=vendor_in.certifications,
        website=vendor_in.website,
        risk_tier=vendor_in.risk_tier or "Low Risk",
        status="Approved",
        reliability_score=90.0,
        delivery_accuracy=95.0,
        response_time=3.0
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor

@router.get("/{vendor_id}", response_model=VendorResponse)
def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # If external vendor, forbid viewing competitor vendors
    if current_user.role == "Vendor" and vendor.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: External vendors cannot access competitor supplier details."
        )
        
    return vendor

@router.patch("/{vendor_id}/status", response_model=VendorResponse)
def update_vendor_status(
    vendor_id: int,
    status_update: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if current_user.role not in ["Procurement Manager", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: {current_user.role} role is not authorized to update vendor approval status."
        )

    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    new_status = status_update.get("status")
    if new_status:
        vendor.status = new_status
        db.commit()
        db.refresh(vendor)
    return vendor
