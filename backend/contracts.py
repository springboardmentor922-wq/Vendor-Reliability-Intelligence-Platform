"""Contract Management module (completes Milestone-2 contract repo + MS3).

Includes CRUD, near-expiry detection (30/60/90-day windows) and compliance
tracking. Contract events also fire in-app notifications.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from deps import get_current_user, get_db, require_role
from notifications import create_notification

router = APIRouter(prefix="/contracts", tags=["contracts"])


class ContractCreate(BaseModel):
    vendor_id: int
    contract_name: str
    start_date: datetime | None = None
    end_date: datetime | None = None
    status: str | None = None
    compliance_status: str | None = None
    document_path: str | None = None


def _serialize(c: models.Contract) -> dict:
    return {
        "id": c.id,
        "vendor_id": c.vendor_id,
        "contract_name": c.contract_name,
        "start_date": c.start_date.isoformat() if c.start_date else None,
        "end_date": c.end_date.isoformat() if c.end_date else None,
        "status": c.status,
        "compliance_status": c.compliance_status,
        "document_path": c.document_path,
        "days_left": ((c.end_date - datetime.now()).days
                      if c.end_date else None),
    }


@router.get("")
def list_contracts(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contracts = db.query(models.Contract).order_by(models.Contract.id).all()
    return [_serialize(c) for c in contracts]


@router.post("")
def create_contract(
    payload: ContractCreate,
    current_user: models.User = Depends(
        require_role(["admin", "procurement", "manager"])),
    db: Session = Depends(get_db),
):
    vendor = db.query(models.Vendor).filter(
        models.Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    contract = models.Contract(
        vendor_id=payload.vendor_id,
        contract_name=payload.contract_name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status or "Active",
        compliance_status=payload.compliance_status or "Compliant",
        document_path=payload.document_path,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    create_notification(
        db, current_user.id,
        "Contract Created",
        f"Contract '{contract.contract_name}' was created for vendor "
        f"#{contract.vendor_id}.",
        "contract_expiry",
    )
    db.commit()
    return _serialize(contract)


@router.get("/expiring")
def expiring_contracts(
    days: int = 90,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now()
    window = now + timedelta(days=days)
    contracts = db.query(models.Contract).filter(
        models.Contract.end_date >= now,
        models.Contract.end_date <= window,
        models.Contract.status == "Active",
    ).order_by(models.Contract.end_date).all()
    return [_serialize(c) for c in contracts]


@router.get("/compliance")
def compliance_overview(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contracts = db.query(models.Contract).all()
    from collections import Counter
    counter = Counter(c.compliance_status for c in contracts)
    return {
        "summary": [{"status": k, "count": v}
                    for k, v in counter.items()],
        "non_compliant": [
            _serialize(c) for c in contracts
            if c.compliance_status not in ("Compliant",)
        ],
    }


@router.get("/{contract_id}")
def get_contract(
    contract_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contract = db.query(models.Contract).filter(
        models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return _serialize(contract)


@router.put("/{contract_id}")
def update_contract(
    contract_id: int,
    payload: ContractCreate,
    current_user: models.User = Depends(
        require_role(["admin", "procurement", "manager"])),
    db: Session = Depends(get_db),
):
    contract = db.query(models.Contract).filter(
        models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    if payload.vendor_id is not None:
        contract.vendor_id = payload.vendor_id
    if payload.contract_name is not None:
        contract.contract_name = payload.contract_name
    if payload.start_date is not None:
        contract.start_date = payload.start_date
    if payload.end_date is not None:
        contract.end_date = payload.end_date
    if payload.status is not None:
        contract.status = payload.status
    if payload.compliance_status is not None:
        contract.compliance_status = payload.compliance_status
    if payload.document_path is not None:
        contract.document_path = payload.document_path

    db.commit()
    db.refresh(contract)
    return _serialize(contract)


@router.delete("/{contract_id}")
def delete_contract(
    contract_id: int,
    current_user: models.User = Depends(
        require_role(["admin", "procurement", "manager"])),
    db: Session = Depends(get_db),
):
    contract = db.query(models.Contract).filter(
        models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    db.delete(contract)
    db.commit()
    return {"message": "Contract deleted", "contract_id": contract_id}