from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.models.entities import PurchaseOrder, POStatusEnum, Vendor

# Router supporting both /api/purchase-orders and /api/procurement
router = APIRouter(tags=["Purchase Order Service"])

class POCreate(BaseModel):
    po_number: str
    vendor_id: int
    total_amount: float
    scheduled_days: int = 3

class InvoiceStatusUpdate(BaseModel):
    invoice_status: str

class POResponse(BaseModel):
    id: int
    po_number: str
    vendor_id: int
    total_amount: float
    status: str
    delivery_status: str
    order_date: datetime

    class Config:
        from_attributes = True

# --- Purchase Order Endpoints ---

@router.post("/api/purchase-orders", response_model=POResponse)
@router.post("/api/procurement", response_model=POResponse)
def create_purchase_order(po_in: POCreate, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == po_in.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor reference invalid")
    
    now = datetime.now(timezone.utc)
    scheduled = now + timedelta(days=po_in.scheduled_days)
    
    po = PurchaseOrder(
        po_number=po_in.po_number,
        vendor_id=po_in.vendor_id,
        total_amount=po_in.total_amount,
        status=POStatusEnum.ORDERED,
        delivery_status="In-Transit",
        order_date=now,
        scheduled_delivery_date=scheduled
    )
    db.add(po)
    db.commit()
    db.refresh(po)
    return po

@router.get("/api/purchase-orders", response_model=List[POResponse])
@router.get("/api/procurement", response_model=List[POResponse])
def list_purchase_orders(db: Session = Depends(get_db)):
    return db.query(PurchaseOrder).all()

@router.put("/api/purchase-orders/{po_id}/invoice")
def update_invoice_status(po_id: int, payload: InvoiceStatusUpdate, db: Session = Depends(get_db)):
    """Matches Swagger route: PUT /api/purchase-orders/{po_id}/invoice"""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    
    # Store invoice status on order record
    if hasattr(po, "invoice_status"):
        po.invoice_status = payload.invoice_status
    db.commit()
    return {"message": f"Invoice status for PO #{po_id} updated to {payload.invoice_status}"}