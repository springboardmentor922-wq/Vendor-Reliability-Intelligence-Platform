from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user, require_roles, get_vendor_for_user
from app.models.user import User
from app.models.vendor import Vendor
from app.models.contract import Contract
from app.models.communication import AuditLog
from app.schemas.contract import ContractCreate, ContractUpdate, ContractResponse

router = APIRouter(prefix="/contracts", tags=["Contracts"])

@router.get("", response_model=List[ContractResponse])
def get_contracts(
    status: Optional[str] = None,
    compliance_status: Optional[str] = None,
    vendor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Contract)
    if current_user.role == "Vendor":
        vendor = get_vendor_for_user(db, current_user)
        target_vendor_id = vendor.id if vendor else -1
        query = query.filter(Contract.vendor_id == target_vendor_id)
    elif vendor_id:
        query = query.filter(Contract.vendor_id == vendor_id)

    if status and status.lower() != "all":
        query = query.filter(Contract.status == status)
    if compliance_status and compliance_status.lower() != "all":
        query = query.filter(Contract.compliance_status == compliance_status)
    return query.order_by(Contract.id.desc()).all()

@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
def create_contract(
    data: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Administrator", "Procurement Manager", "Supply Chain Manager"]))
):
    vendor = db.query(Vendor).filter(Vendor.id == data.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    count = db.query(Contract).count() + 1
    contract_number = f"CNT-{datetime.utcnow().year}-{count:04d}"

    new_contract = Contract(
        contract_number=contract_number,
        title=data.title.strip(),
        vendor_id=data.vendor_id,
        start_date=data.start_date,
        expiry_date=data.expiry_date,
        renewal_terms=data.renewal_terms,
        status="Active",
        compliance_status=data.compliance_status or "Compliant",
        document_name=data.document_name,
        document_url=data.document_url,
        contract_value=float(data.contract_value),
        created_by_id=current_user.id
    )
    db.add(new_contract)
    db.commit()
    db.refresh(new_contract)

    audit = AuditLog(
        user_id=current_user.id,
        action="CONTRACT_CREATED",
        entity_type="Contract",
        entity_id=new_contract.id,
        details=f"Created contract {contract_number} for vendor {vendor.name}"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_contract)
    return new_contract

@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if current_user.role == "Vendor":
        vendor = get_vendor_for_user(db, current_user)
        if not vendor or contract.vendor_id != vendor.id:
            raise HTTPException(status_code=403, detail="Access denied: You can only view your own contracts.")
    return contract

@router.put("/{contract_id}", response_model=ContractResponse)
def update_contract(
    contract_id: int,
    data: ContractUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Administrator", "Procurement Manager", "Auditor"]))
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    for field, value in data.dict(exclude_unset=True).items():
        setattr(contract, field, value)

    contract.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(contract)
    return contract
