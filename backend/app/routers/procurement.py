from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.procurement import Procurement
from app.models.vendor import Vendor
from app.models.activity_log import ActivityLog
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/procurements",
    tags=["Procurement"]
)


# ---------------------------------------------------------
# CREATE PROCUREMENT REQUEST
# ---------------------------------------------------------
@router.post("/")
def create_procurement(
    item_name: str,
    department: str,
    quantity: int,
    estimated_cost: float,
    vendor_id: int = None,
    expected_delivery_date: datetime = None,
    actual_delivery_date: datetime = None,
    invoice_number: str = None,
    invoice_amount: float = None,
    invoice_status: str = "PENDING",
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER",
            "SUPPLY_CHAIN_MANAGER"
        )
    )
):
    if vendor_id is not None:
        vendor = db.query(Vendor).filter(
            Vendor.id == vendor_id
        ).first()

        if not vendor:
            raise HTTPException(
                status_code=404,
                detail="Vendor not found"
            )

        if vendor.status != "ACTIVE" or not vendor.is_active:
            raise HTTPException(
                status_code=400,
                detail="Only active approved vendors can be assigned."
            )

    procurement = Procurement(
        item_name=item_name,
        department=department,
        quantity=quantity,
        estimated_cost=estimated_cost,
        vendor_id=vendor_id,
        expected_delivery_date=expected_delivery_date,
        actual_delivery_date=actual_delivery_date,
        invoice_number=invoice_number,
        invoice_amount=invoice_amount,
        invoice_status=invoice_status,
        status="PENDING"
    )

    db.add(procurement)
    db.commit()
    db.refresh(procurement)

    return procurement


# ---------------------------------------------------------
# GET ALL PROCUREMENT REQUESTS
# ---------------------------------------------------------
@router.get("/")
def get_procurements(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER",
            "SUPPLY_CHAIN_MANAGER",
            "FINANCE_OFFICER",
            "AUDITOR"
        )
    )
):
    return db.query(Procurement).all()


# ---------------------------------------------------------
# GET SINGLE PROCUREMENT REQUEST
# ---------------------------------------------------------
@router.get("/{procurement_id}")
def get_procurement(
    procurement_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER",
            "SUPPLY_CHAIN_MANAGER",
            "FINANCE_OFFICER",
            "AUDITOR"
        )
    )
):
    procurement = db.query(Procurement).filter(
        Procurement.id == procurement_id
    ).first()

    if not procurement:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found"
        )

    return procurement


# ---------------------------------------------------------
# APPROVE PROCUREMENT
# ---------------------------------------------------------
@router.put("/{procurement_id}/approve")
def approve_procurement(
    procurement_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    procurement = db.query(Procurement).filter(
        Procurement.id == procurement_id
    ).first()

    if not procurement:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found"
        )

    if procurement.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail="Only pending procurement requests can be approved."
        )

    procurement.status = "APPROVED"

    db.commit()
    db.refresh(procurement)

    activity = ActivityLog(
        user=current_user.email,
        action="Procurement Approved",
        related_record=str(procurement.id)
    )

    db.add(activity)
    db.commit()

    return procurement


# ---------------------------------------------------------
# MARK AS ORDERED
# ---------------------------------------------------------
# ---------------------------------------------------------
@router.put("/{procurement_id}/order")
def order_procurement(
    procurement_id: int,
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    procurement = db.query(Procurement).filter(
        Procurement.id == procurement_id
    ).first()

    if not procurement:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found"
        )

    if procurement.status != "APPROVED":
        raise HTTPException(
            status_code=400,
            detail="Only approved procurement requests can be ordered."
        )

    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    if vendor.status != "ACTIVE" or not vendor.is_active:
        raise HTTPException(
            status_code=400,
            detail="Only active vendors can be assigned."
        )

    procurement.vendor_id = vendor_id
    procurement.status = "ORDERED"

    db.commit()
    db.refresh(procurement)

    return procurement

# ---------------------------------------------------------
# MARK AS DELIVERED
# ---------------------------------------------------------
@router.put("/{procurement_id}/deliver")
def deliver_procurement(
    procurement_id: int,
    actual_delivery_date: datetime = None,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER",
            "SUPPLY_CHAIN_MANAGER"
        )
    )
):
    procurement = db.query(Procurement).filter(
        Procurement.id == procurement_id
    ).first()

    if not procurement:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found"
        )

    if procurement.status != "ORDERED":
        raise HTTPException(
            status_code=400,
            detail="Only ordered procurement requests can be marked as delivered."
        )

    procurement.status = "DELIVERED"

    if actual_delivery_date:
        procurement.actual_delivery_date = actual_delivery_date
    else:
        procurement.actual_delivery_date = datetime.now()

    db.commit()
    db.refresh(procurement)

    return procurement
# ---------------------------------------------------------
# INVOICE
# ---------------------------------------------------------
@router.put("/{procurement_id}/invoice")
def update_invoice(
    procurement_id: int,
    invoice_number: str,
    invoice_amount: float,
    invoice_status: str = "PENDING",
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER",
            "SUPPLY_CHAIN_MANAGER"
        )
    )
):
    procurement = db.query(Procurement).filter(
        Procurement.id == procurement_id
    ).first()

    if not procurement:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found"
        )

    if procurement.status != "DELIVERED":
        raise HTTPException(
            status_code=400,
            detail="Invoice can be added only after delivery."
        )

    procurement.invoice_number = invoice_number
    procurement.invoice_amount = invoice_amount
    procurement.invoice_status = invoice_status

    db.commit()
    db.refresh(procurement)

    return procurement


# ---------------------------------------------------------
# COMPLETE PROCUREMENT
# ---------------------------------------------------------
@router.put("/{procurement_id}/complete")
def complete_procurement(
    procurement_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER",
            "SUPPLY_CHAIN_MANAGER"
        )
    )
):
    procurement = db.query(Procurement).filter(
        Procurement.id == procurement_id
    ).first()

    if not procurement:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found"
        )

    if procurement.status != "DELIVERED":
        raise HTTPException(
            status_code=400,
            detail="Only delivered procurement requests can be completed."
        )

    procurement.status = "COMPLETED"

    db.commit()
    db.refresh(procurement)

    return procurement


# ---------------------------------------------------------
# CANCEL PROCUREMENT
# ---------------------------------------------------------
@router.put("/{procurement_id}/cancel")
def cancel_procurement(
    procurement_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    procurement = db.query(Procurement).filter(
        Procurement.id == procurement_id
    ).first()

    if not procurement:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found"
        )

    if procurement.status in ["COMPLETED", "CANCELLED"]:
        raise HTTPException(
            status_code=400,
            detail="This procurement request cannot be cancelled."
        )

    procurement.status = "CANCELLED"

    db.commit()
    db.refresh(procurement)

    return procurement