"""Contract and compliance management."""

from __future__ import annotations

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
from deps import (
    ensure_vendor_scope,
    get_current_user,
    get_db,
    log_activity,
    normalize_role,
    require_role,
)
from notifications import create_notification

router = APIRouter(prefix="/contracts", tags=["contracts"])


class ContractCreate(BaseModel):
    vendor_id: int
    contract_name: str = Field(min_length=2, max_length=150)
    contract_reference: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    status: str = "Active"
    compliance_status: str = "Pending"
    auto_renew: bool = False
    document_path: str | None = None
    notes: str | None = None


def _serialize(c: models.Contract) -> dict:
    now = datetime.utcnow()
    days_left = (c.end_date.replace(tzinfo=None) - now).days if c.end_date else None
    return {
        "id": c.id,
        "vendor_id": c.vendor_id,
        "vendor_name": c.vendor.company_name if c.vendor else None,
        "contract_name": c.contract_name,
        "contract_reference": c.contract_reference,
        "start_date": c.start_date.isoformat() if c.start_date else None,
        "end_date": c.end_date.isoformat() if c.end_date else None,
        "status": c.status,
        "compliance_status": c.compliance_status,
        "auto_renew": c.auto_renew,
        "document_path": c.document_path,
        "notes": c.notes,
        "days_left": days_left,
    }


@router.get("")
def list_contracts(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    query = db.query(models.Contract).order_by(
        models.Contract.end_date.asc().nullslast(), models.Contract.id.desc()
    )
    if normalize_role(current_user.role) == "vendor":
        query = query.filter(models.Contract.vendor_id == current_user.vendor_id)
    return [_serialize(c) for c in query.all()]


@router.post("")
def create_contract(
    payload: ContractCreate,
    current_user: models.User = Depends(
        require_role(["administrator", "procurement_manager", "supply_chain_manager"])
    ),
    db: Session = Depends(get_db),
):
    if (
        not db.query(models.Vendor)
        .filter(models.Vendor.id == payload.vendor_id)
        .first()
    ):
        raise HTTPException(status_code=404, detail="Vendor not found")
    contract = models.Contract(
        vendor_id=payload.vendor_id,
        contract_name=payload.contract_name.strip(),
        contract_reference=payload.contract_reference,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
        compliance_status=payload.compliance_status,
        auto_renew=payload.auto_renew,
        document_path=payload.document_path,
        notes=payload.notes,
    )
    db.add(contract)
    db.flush()
    log_activity(
        db,
        current_user.id,
        "CREATE_CONTRACT",
        "Contract",
        contract.id,
        f"Created contract {contract.contract_name}",
    )
    create_notification(
        db,
        current_user.id,
        "Contract created",
        f"{contract.contract_name} was added to the repository.",
        "contract",
    )
    db.commit()
    db.refresh(contract)
    return _serialize(contract)


@router.get("/expiring")
def expiring_contracts(
    days: int = 90,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    window = now + timedelta(days=days)
    query = db.query(models.Contract).filter(
        models.Contract.status == "Active",
        models.Contract.end_date >= now,
        models.Contract.end_date <= window,
    )
    if normalize_role(current_user.role) == "vendor":
        query = query.filter(models.Contract.vendor_id == current_user.vendor_id)
    return [_serialize(c) for c in query.order_by(models.Contract.end_date.asc()).all()]


@router.get("/compliance")
def compliance_overview(
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    query = db.query(models.Contract)
    if normalize_role(current_user.role) == "vendor":
        query = query.filter(models.Contract.vendor_id == current_user.vendor_id)
    contracts = query.all()
    from collections import Counter

    counts = Counter(c.compliance_status for c in contracts)
    return {
        "summary": [
            {"status": status, "count": count}
            for status, count in sorted(counts.items())
        ],
        "non_compliant": [
            _serialize(c) for c in contracts if c.compliance_status != "Compliant"
        ],
    }


@router.get("/{contract_id}")
def get_contract(
    contract_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contract = (
        db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    ensure_vendor_scope(current_user, contract.vendor_id)
    return _serialize(contract)


@router.put("/{contract_id}")
def update_contract(
    contract_id: int,
    payload: ContractCreate,
    current_user: models.User = Depends(
        require_role(["administrator", "procurement_manager", "supply_chain_manager"])
    ),
    db: Session = Depends(get_db),
):
    contract = (
        db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    for field in [
        "vendor_id",
        "contract_name",
        "contract_reference",
        "start_date",
        "end_date",
        "status",
        "compliance_status",
        "auto_renew",
        "document_path",
        "notes",
    ]:
        value = getattr(payload, field)
        if value is not None:
            setattr(
                contract, field, value.strip() if field == "contract_name" else value
            )
    log_activity(
        db,
        current_user.id,
        "UPDATE_CONTRACT",
        "Contract",
        contract.id,
        f"Updated contract {contract.contract_name}",
    )
    db.commit()
    db.refresh(contract)
    return _serialize(contract)


@router.delete("/{contract_id}")
def delete_contract(
    contract_id: int,
    current_user: models.User = Depends(
        require_role(["administrator", "procurement_manager"])
    ),
    db: Session = Depends(get_db),
):
    contract = (
        db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    log_activity(
        db,
        current_user.id,
        "DELETE_CONTRACT",
        "Contract",
        contract.id,
        f"Deleted {contract.contract_name}",
    )
    db.delete(contract)
    db.commit()
    return {"message": "Contract deleted", "contract_id": contract_id}
