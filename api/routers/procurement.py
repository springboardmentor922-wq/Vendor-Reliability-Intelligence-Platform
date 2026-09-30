"""
api/routers/procurement.py
--------------------------
FastAPI endpoints for Procurement Requests.
"""

from typing import Optional, List, Dict
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.procurement_service import (
    get_procurement_requests,
    get_procurement_stats,
    create_procurement_request,
    approve_procurement_request,
    reject_procurement_request,
    assign_vendor_to_pr,
)

router = APIRouter(prefix="/procurement", tags=["Procurement"])


class ProcurementCreateRequest(BaseModel):
    department: str
    items: List[dict] = Field(default_factory=list)
    estimated_cost: float
    priority: str = "Medium"
    justification: Optional[str] = None
    requested_by: str = "api_user"


class ActionRequest(BaseModel):
    user_id: str = "api_user"
    reason: Optional[str] = None
    vendor_id: Optional[str] = None


@router.get("")
def list_requests(
    status: Optional[str] = Query(None),
    requested_by: Optional[str] = Query(None),
):
    """List procurement requests."""
    return get_procurement_requests(status=status, requested_by=requested_by)


@router.get("/stats")
def procurement_stats():
    """Procurement summary statistics."""
    return get_procurement_stats()


@router.post("")
def create_request(payload: ProcurementCreateRequest):
    """Create a new procurement request."""
    success, msg, doc = create_procurement_request(
        requested_by=payload.requested_by,
        department=payload.department,
        items=payload.items,
        estimated_cost=payload.estimated_cost,
        priority=payload.priority,
        justification=payload.justification or "",
    )
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg, "procurement_request": doc}


@router.put("/{pr_id}/approve")
def approve_request(pr_id: str, payload: ActionRequest):
    """Approve a procurement request."""
    if payload.vendor_id:
        assign_vendor_to_pr(pr_id, payload.vendor_id, payload.user_id)
    success, msg = approve_procurement_request(pr_id, payload.user_id)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}


@router.put("/{pr_id}/reject")
def reject_request(pr_id: str, payload: ActionRequest):
    """Reject a procurement request."""
    success, msg = reject_procurement_request(pr_id, payload.user_id, payload.reason or "")
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}
