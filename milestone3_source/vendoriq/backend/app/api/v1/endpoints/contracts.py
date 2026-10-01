from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_procurement_team
from app.core.utils import generate_code, log_activity, notify_user
from app.db.session_dep import get_db
from app.models.user import User, UserRole
from app.models.contract import Contract, Certification, ContractStatus
from app.models.vendor import Vendor
from app.schemas.contract import (
    ContractCreate,
    ContractUpdate,
    ContractOut,
    CertificationCreate,
    CertificationOut,
)

router = APIRouter()


def _refresh_contract_status(contract: Contract) -> None:
    """Auto-derive Active / Expiring (<=30 days) / Expired from the end date."""
    if contract.status == ContractStatus.TERMINATED:
        return
    today = datetime.utcnow()
    if contract.end_date < today:
        contract.status = ContractStatus.EXPIRED
    elif contract.end_date <= today + timedelta(days=30):
        contract.status = ContractStatus.EXPIRING
    else:
        contract.status = ContractStatus.ACTIVE


@router.post("", response_model=ContractOut, status_code=201)
def create_contract(
    payload: ContractCreate, db: Session = Depends(get_db), current_user: User = Depends(require_procurement_team)
):
    """Contract Repository: create a new vendor contract."""
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    contract = Contract(
        contract_number=generate_code("CON"),
        created_by_id=current_user.id,
        **payload.model_dump(),
    )
    _refresh_contract_status(contract)
    db.add(contract)
    db.commit()
    db.refresh(contract)
    log_activity(db, current_user.id, "contract_created", "contract", contract.id, contract.contract_number)
    return contract


@router.get("", response_model=List[ContractOut])
def list_contracts(
    vendor_id: Optional[int] = None,
    status_filter: Optional[ContractStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Contract Repository listing, with Contract Renewal Tracking / Compliance
    Monitoring via the status filter (active / expiring / expired / renewed)."""
    query = db.query(Contract)
    contracts = query.all()
    for c in contracts:
        _refresh_contract_status(c)
    db.commit()

    query = db.query(Contract)
    if vendor_id:
        query = query.filter(Contract.vendor_id == vendor_id)
    if status_filter:
        query = query.filter(Contract.status == status_filter)
    return query.order_by(Contract.end_date.asc()).all()


@router.get("/{contract_id}", response_model=ContractOut)
def get_contract(contract_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.put("/{contract_id}", response_model=ContractOut)
def update_contract(
    contract_id: int, payload: ContractUpdate, db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_team),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(contract, field, value)
    if "status" not in data:
        _refresh_contract_status(contract)
    db.commit()
    db.refresh(contract)
    return contract


@router.put("/{contract_id}/renew", response_model=ContractOut)
def renew_contract(
    contract_id: int, new_end_date: datetime, db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_team),
):
    """Contract Renewal Tracking."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    contract.end_date = new_end_date
    contract.status = ContractStatus.RENEWED
    db.commit()
    db.refresh(contract)
    log_activity(db, current_user.id, "contract_renewed", "contract", contract.id, contract.contract_number)
    return contract


@router.get("/expiring/soon", response_model=List[ContractOut])
def contracts_expiring_soon(days: int = 30, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Contract Expiry Notifications feed: contracts expiring within N days."""
    cutoff = datetime.utcnow() + timedelta(days=days)
    return (
        db.query(Contract)
        .filter(Contract.end_date <= cutoff, Contract.status != ContractStatus.TERMINATED)
        .order_by(Contract.end_date.asc())
        .all()
    )


# ---- Certification / Vendor Documentation ----

@router.post("/certifications", response_model=CertificationOut, status_code=201)
def create_certification(
    payload: CertificationCreate, db: Session = Depends(get_db), current_user: User = Depends(require_procurement_team)
):
    """Certification Management / Vendor Documentation."""
    cert = Certification(**payload.model_dump())
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return cert


@router.get("/certifications/by-vendor/{vendor_id}", response_model=List[CertificationOut])
def list_vendor_certifications(vendor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Certification).filter(Certification.vendor_id == vendor_id).all()
