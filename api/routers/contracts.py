"""
api/routers/contracts.py
------------------------
FastAPI endpoints for Contracts & Agreements.
"""

from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.contract_service import (
    get_all_contracts,
    get_contract_stats,
    get_total_contract_value,
    create_contract,
    update_contract_status,
    delete_contract,
)

router = APIRouter(prefix="/contracts", tags=["Contracts"])


class ContractCreateRequest(BaseModel):
    vendor_id: str
    title: str
    start_date: datetime
    end_date: datetime
    contract_value: float
    compliance_status: str = "Compliant"
    contract_type: str = "Service Agreement"
    description: Optional[str] = None
    created_by: str = "api_user"


class StatusChangeRequest(BaseModel):
    status: str
    user_id: str = "api_user"


@router.get("")
def list_contracts(
    status: Optional[str] = Query(None),
    vendor_id: Optional[str] = Query(None),
    compliance_status: Optional[str] = Query(None),
):
    """List contracts with optional filtering."""
    return get_all_contracts(
        status=status,
        vendor_id=vendor_id,
        compliance_status=compliance_status,
    )


@router.get("/stats")
def contract_stats():
    """Contract statistics and total valuation."""
    stats = get_contract_stats()
    val = get_total_contract_value()
    return {"stats": stats, "total_value": val}


@router.post("")
def create_new_contract(payload: ContractCreateRequest):
    """Create a new contract."""
    success, msg, doc = create_contract(
        vendor_id=payload.vendor_id,
        title=payload.title,
        start_date=payload.start_date,
        end_date=payload.end_date,
        contract_value=payload.contract_value,
        created_by=payload.created_by,
        compliance_status=payload.compliance_status,
        contract_type=payload.contract_type,
        description=payload.description or "",
    )
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg, "contract": doc}


@router.put("/{contract_id}/status")
def update_status(contract_id: str, payload: StatusChangeRequest):
    """Update contract status."""
    success, msg = update_contract_status(contract_id, payload.status, payload.user_id)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}


@router.delete("/{contract_id}")
def terminate_contract(contract_id: str, user_id: str = "api_user"):
    """Terminate contract."""
    success, msg = delete_contract(contract_id, user_id)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}
