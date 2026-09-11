from typing import List, Optional
from datetime import datetime, date
import random
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.contract import Contract
from app.models.vendor import Vendor
from app.schemas.contract import ContractCreate, ContractResponse
from app.api import deps
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[ContractResponse])
def get_contracts(
    db: Session = Depends(get_db),
    compliance_status: Optional[str] = Query(None),
    current_user: User = Depends(deps.get_current_user)
):
    query = db.query(Contract)
    
    # Restrict external vendors to their own contracts only
    if current_user.role == "Vendor":
        vendor = db.query(Vendor).filter(Vendor.email == current_user.email).first()
        if vendor:
            query = query.filter(Contract.vendor_id == vendor.id)
        else:
            return []
            
    if compliance_status and compliance_status != "All":
        query = query.filter(Contract.compliance_status == compliance_status)
        
    contracts = query.order_by(Contract.end_date.asc()).all()
    results = []
    for c in contracts:
        vendor = db.query(Vendor).filter(Vendor.id == c.vendor_id).first()
        item = ContractResponse.from_orm(c)
        item.vendor_name = vendor.company_name if vendor else "Unknown Supplier"
        results.append(item)
    return results

@router.post("/", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
def create_contract(
    c_in: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if current_user.role not in ["Procurement Manager", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: {current_user.role} role cannot register or create contracts."
        )

    vendor = db.query(Vendor).filter(Vendor.id == c_in.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Selected vendor not found")

    cnt_num = c_in.contract_number or f"CNT-{datetime.now().year}-{random.randint(100, 999)}"
    
    contract = Contract(
        vendor_id=c_in.vendor_id,
        contract_number=cnt_num,
        title=c_in.title,
        start_date=c_in.start_date,
        end_date=c_in.end_date,
        value=c_in.value,
        compliance_status=c_in.compliance_status or "Compliant",
        document_url=None
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)

    res = ContractResponse.from_orm(contract)
    res.vendor_name = vendor.company_name
    return res
