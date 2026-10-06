from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models.contracts import Contract, Certification

router = APIRouter(prefix="/contracts", tags=["Contracts & SLA"])

@router.get("/", response_model=List[dict])
def list_contracts(db: Session = Depends(get_db)):
    contracts = db.query(Contract).all()
    return [
        {
            "id": c.id,
            "contract_number": c.contract_number,
            "vendor_id": c.vendor_id,
            "title": c.title,
            "contract_value": c.contract_value,
            "start_date": c.start_date.strftime("%Y-%m-%d"),
            "end_date": c.end_date.strftime("%Y-%m-%d"),
            "days_remaining": (c.end_date - datetime.utcnow()).days,
            "is_active": c.is_active
        }
        for c in contracts
    ]

@router.get("/expiring-soon")
def get_expiring_contracts(days: int = 30, db: Session = Depends(get_db)):
    threshold_date = datetime.utcnow() + timedelta(days=days)
    expiring = db.query(Contract).filter(
        Contract.end_date <= threshold_date,
        Contract.is_active == True
    ).all()
    return expiring