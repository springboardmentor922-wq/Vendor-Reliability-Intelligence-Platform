from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.purchase_order import PurchaseOrder
from app.models.vendor import Vendor
from app.models.activity_log import ActivityLog
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/purchase-orders",
    tags=["Purchase Orders"]
)


# ---------------------------------------------------------
# CREATE PURCHASE ORDER
# ---------------------------------------------------------
@router.post("/")
def create_purchase_order(
    po_number: str,
    vendor_name: str,
    item_name: str,
    quantity: int,
    total_amount: float,
    expected_delivery_date: datetime = None,
    actual_delivery_date: datetime = None,
    invoice_number: str = None,
    invoice_amount: float = None,
    invoice_status: str = "PENDING",
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    existing_po = db.query(PurchaseOrder).filter(
        PurchaseOrder.po_number == po_number
    ).first()

    if existing_po:
        raise HTTPException(
            status_code=400,
            detail="Purchase Order already exists"
        )

    vendor = db.query(Vendor).filter(
        Vendor.vendor_name == vendor_name
    ).first()

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found"
        )

    if vendor.status != "ACTIVE" or not vendor.is_active:
        raise HTTPException(
            status_code=400,
            detail="Only active approved vendors can be used for Purchase Orders."
        )

    purchase_order = PurchaseOrder(
        po_number=po_number,
        vendor_name=vendor_name,
        item_name=item_name,
        quantity=quantity,
        total_amount=total_amount,
        expected_delivery_date=expected_delivery_date,
        actual_delivery_date=actual_delivery_date,
        invoice_number=invoice_number,
        invoice_amount=invoice_amount,
        invoice_status=invoice_status,
        status="PENDING"
    )

    db.add(purchase_order)
    db.commit()
    db.refresh(purchase_order)

    activity = ActivityLog(
        user=current_user.email,
        action="Purchase Order Created",
        related_record=po_number
    )

    db.add(activity)
    db.commit()

    return purchase_order


# ---------------------------------------------------------
# GET ALL PURCHASE ORDERS
# ---------------------------------------------------------
@router.get("/")
def get_purchase_orders(
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
    return db.query(PurchaseOrder).all()


# ---------------------------------------------------------
# UPDATE DELIVERY
# ---------------------------------------------------------
@router.put("/{po_id}/deliver")
def update_delivery(
    po_id: int,
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
    purchase_order = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id
    ).first()

    if not purchase_order:
        raise HTTPException(
            status_code=404,
            detail="Purchase Order not found"
        )

    purchase_order.status = "DELIVERED"

    if actual_delivery_date:
        purchase_order.actual_delivery_date = actual_delivery_date
    else:
        purchase_order.actual_delivery_date = datetime.now()

    db.commit()
    db.refresh(purchase_order)

    activity = ActivityLog(
        user=current_user.email,
        action="Delivery Updated",
        related_record=purchase_order.po_number
    )

    db.add(activity)
    db.commit()

    return purchase_order