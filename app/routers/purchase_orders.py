from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder
from app.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderOut

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders"])

MANAGE_ROLES = (UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER, UserRole.SUPPLY_CHAIN_MANAGER)


@router.post("/", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    existing = db.query(PurchaseOrder).filter(PurchaseOrder.order_number == payload.order_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Order number already exists")

    total_amount = payload.quantity * payload.unit_price

    po = PurchaseOrder(
        order_number=payload.order_number,
        vendor_id=payload.vendor_id,
        created_by_id=current_user.id,
        item_description=payload.item_description,
        quantity=payload.quantity,
        unit_price=payload.unit_price,
        total_amount=total_amount,
        expected_delivery_date=payload.expected_delivery_date,
    )
    db.add(po)
    db.commit()
    db.refresh(po)
    return po


@router.get("/", response_model=List[PurchaseOrderOut])
def list_purchase_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(PurchaseOrder).all()


@router.get("/{po_id}", response_model=PurchaseOrderOut)
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


@router.put("/{po_id}", response_model=PurchaseOrderOut)
def update_purchase_order(
    po_id: int,
    payload: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGE_ROLES)),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(po, field, value)

    db.commit()
    db.refresh(po)
    return po


@router.delete("/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    db.delete(po)
    db.commit()
    return None