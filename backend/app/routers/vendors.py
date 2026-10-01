import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Vendor, VendorContact, User, ActivityLog
from app.schemas import (
    VendorCreate, VendorUpdate, VendorStatusUpdate, VendorResponse, MessageResponse
)
from app.security import get_current_user, require_role
from app.routers.notifications import add_notification

router = APIRouter(prefix="/api/v1/vendors", tags=["Vendors"])

ALLOWED_CATEGORIES = [
    "Raw Material Suppliers",
    "Equipment",
    "IT",
    "Logistics",
    "Services",
    "Maintenance"
]

ALLOWED_STATUSES = ["pending", "under_review", "approved", "rejected", "ACTIVE", "INACTIVE", "SUSPENDED"]

@router.get("", response_model=List[VendorResponse])
async def list_vendors(
    category: Optional[str] = Query(None, description="Filter by vendor category"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    search: Optional[str] = Query(None, description="Search company name or registration no"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Vendor).options(selectinload(Vendor.contacts)).order_by(Vendor.created_at.desc())
    if category:
        stmt = stmt.where(Vendor.category.ilike(f"%{category}%"))
    if status_filter:
        stmt = stmt.where(Vendor.status.ilike(status_filter))
    if search:
        search_term = f"%{search}%"
        stmt = stmt.where((Vendor.company_name.ilike(search_term)) | (Vendor.registration_no.ilike(search_term)))

    result = await db.execute(stmt)
    vendors = result.scalars().all()
    return vendors

@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    payload: VendorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager"))
):
    # Check registration_no unique
    stmt = select(Vendor).where(Vendor.registration_no == payload.registration_no)
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Vendor with this registration number already exists")

    new_vendor = Vendor(
        company_name=payload.company_name,
        registration_no=payload.registration_no,
        category=payload.category,
        status="pending",  # Always start as pending; status is set via the approval workflow
        review_notes=payload.review_notes
    )
    db.add(new_vendor)
    await db.flush()

    if payload.contacts:
        for c in payload.contacts:
            contact = VendorContact(
                vendor_id=new_vendor.id,
                name=c.name,
                email=c.email,
                phone=c.phone
            )
            db.add(contact)

    await add_notification(
        db,
        f"New vendor onboarded: '{new_vendor.company_name}' ({new_vendor.category}) with status '{new_vendor.status}'."
    )

    await db.commit()
    stmt_reload = select(Vendor).where(Vendor.id == new_vendor.id).options(selectinload(Vendor.contacts))
    return (await db.execute(stmt_reload)).scalar_one()

@router.get("/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Vendor).where(Vendor.id == vendor_id).options(selectinload(Vendor.contacts))
    result = await db.execute(stmt)
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

@router.put("/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: uuid.UUID,
    payload: VendorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager"))
):
    stmt = select(Vendor).where(Vendor.id == vendor_id).options(selectinload(Vendor.contacts))
    result = await db.execute(stmt)
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if payload.company_name is not None:
        vendor.company_name = payload.company_name
    if payload.category is not None:
        vendor.category = payload.category
    if payload.status is not None:
        vendor.status = payload.status
    if payload.review_notes is not None:
        vendor.review_notes = payload.review_notes

    await db.commit()
    stmt_reload = select(Vendor).where(Vendor.id == vendor.id).options(selectinload(Vendor.contacts))
    return (await db.execute(stmt_reload)).scalar_one()

@router.patch("/{vendor_id}/status", response_model=VendorResponse)
async def update_vendor_status(
    vendor_id: uuid.UUID,
    payload: VendorStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager"))
):
    stmt = select(Vendor).where(Vendor.id == vendor_id).options(selectinload(Vendor.contacts))
    result = await db.execute(stmt)
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    old_status = vendor.status
    new_status = payload.status.lower() if payload.status.lower() in ["pending", "under_review", "approved", "rejected"] else payload.status
    vendor.status = new_status

    if payload.review_notes:
        vendor.review_notes = payload.review_notes

    await add_notification(
        db,
        f"Vendor '{vendor.company_name}' transitioned from '{old_status}' to '{new_status}' by {current_user.full_name}."
    )

    await db.commit()
    stmt_reload = select(Vendor).where(Vendor.id == vendor.id).options(selectinload(Vendor.contacts))
    return (await db.execute(stmt_reload)).scalar_one()

@router.delete("/{vendor_id}", response_model=MessageResponse)
async def delete_vendor(
    vendor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager"))
):
    stmt = select(Vendor).where(Vendor.id == vendor_id)
    result = await db.execute(stmt)
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    company_name = vendor.company_name

    # Cascade delete any activity logs associated with this vendor
    await db.execute(delete(ActivityLog).where(ActivityLog.entity_id == vendor_id))

    # Cascade delete vendor (cascades to POs, contracts, performance, reliability, communications, contacts, etc.)
    await db.delete(vendor)
    await db.commit()
    return MessageResponse(message=f"Vendor '{company_name}' deleted successfully")
