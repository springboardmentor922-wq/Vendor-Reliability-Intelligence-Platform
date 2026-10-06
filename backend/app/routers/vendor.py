from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.vendor import Vendor
from app.dependencies.authorization import require_roles

router = APIRouter(
    prefix="/api/vendors",
    tags=["Vendors"]
)


@router.post("/")
def create_vendor(
    vendor_name: str,
    email: str,
    contact_person: str = None,
    phone: str = None,
    address: str = None,
    category: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles("ADMINISTRATOR", "PROCUREMENT_MANAGER")
    )
):
    existing_vendor = db.query(Vendor).filter(
        Vendor.email == email.lower()
    ).first()

    if existing_vendor:
        raise HTTPException(
            status_code=400,
            detail="Vendor with this email already exists"
        )

    vendor = Vendor(
        vendor_name=vendor_name,
        contact_person=contact_person,
        email=email.lower(),
        phone=phone,
        address=address,
        category=category
    )

    db.add(vendor)
    db.commit()
    db.refresh(vendor)

    return vendor


@router.get("/")
def get_vendors(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(
        "ADMINISTRATOR",
        "PROCUREMENT_MANAGER",
        "SUPPLY_CHAIN_MANAGER",
        "VENDOR",
        "FINANCE_OFFICER",
        "AUDITOR"
    ))
):
    return db.query(Vendor).all()


@router.get("/{vendor_id}")
def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(
        "ADMINISTRATOR",
        "PROCUREMENT_MANAGER",
        "SUPPLY_CHAIN_MANAGER",
        "VENDOR",
        "FINANCE_OFFICER",
        "AUDITOR"
    ))
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    return vendor


@router.put("/{vendor_id}")
def update_vendor(
    vendor_id: int,
    vendor_name: str,
    email: str,
    contact_person: str = None,
    phone: str = None,
    address: str = None,
    category: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles("ADMINISTRATOR", "PROCUREMENT_MANAGER")
    )
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    vendor.vendor_name = vendor_name
    vendor.email = email.lower()
    vendor.contact_person = contact_person
    vendor.phone = phone
    vendor.address = address
    vendor.category = category

    db.commit()
    db.refresh(vendor)

    return vendor


@router.delete("/{vendor_id}")
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles("ADMINISTRATOR")
    )
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    db.delete(vendor)
    db.commit()

    return {"message": "Vendor deleted successfully"}