"""
api/routers/purchase_orders.py
------------------------------
FastAPI endpoints for Purchase Orders.
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.procurement_service import (
    get_purchase_orders,
    get_po_stats,
    create_purchase_order,
    approve_purchase_order,
    update_po_status,
)

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders"])


class POCreateRequest(BaseModel):
    vendor_id: str
    items: List[dict] = Field(default_factory=list)
    total_amount: float
    notes: Optional[str] = None
    created_by: str = "api_user"


class POActionRequest(BaseModel):
    user_id: str = "api_user"
    status: Optional[str] = None


@router.get("")
def list_purchase_orders(
    status: Optional[str] = Query(None),
    vendor_id: Optional[str] = Query(None),
):
    """List purchase orders."""
    return get_purchase_orders(status=status, vendor_id=vendor_id)


@router.get("/stats")
def po_stats():
    """Purchase order summary statistics."""
    return get_po_stats()


@router.post("")
def create_order(payload: POCreateRequest):
    """Create a new purchase order."""
    success, msg, doc = create_purchase_order(
        vendor_id=payload.vendor_id,
        items=payload.items,
        total_amount=payload.total_amount,
        created_by=payload.created_by,
        notes=payload.notes or "",
    )
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg, "purchase_order": doc}


@router.put("/{po_id}/approve")
def approve_order(po_id: str, payload: POActionRequest):
    """Approve and issue a purchase order."""
    success, msg = approve_purchase_order(po_id, payload.user_id)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}


@router.put("/{po_id}/status")
def change_po_status(po_id: str, payload: POActionRequest):
    """Update status of a purchase order."""
    if not payload.status:
        raise HTTPException(status_code=400, detail="New status required.")
    success, msg = update_po_status(po_id, payload.status, payload.user_id)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}
