from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date

from app.database.connection import get_db
from app.models.contract import Contract
from app.models.activity_log import ActivityLog
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/contracts",
    tags=["Contracts"]
)


# ---------------------------------------------------------
# CREATE CONTRACT
# ---------------------------------------------------------
@router.post("/")
def create_contract(
    vendor_id: int,
    contract_number: str,
    contract_type: str,
    start_date: date,
    end_date: date,
    contract_value: float = None,
    renewal_date: date = None,
    terms: str = None,
    document: str = None,
    compliance_status: str = "COMPLIANT",
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    contract = Contract(
        vendor_id=vendor_id,
        contract_number=contract_number,
        contract_type=contract_type,
        start_date=start_date,
        end_date=end_date,
        contract_value=contract_value,
        renewal_date=renewal_date,
        terms=terms,
        document=document,
        compliance_status=compliance_status,
        status="ACTIVE"
    )

    db.add(contract)
    db.commit()
    db.refresh(contract)

    return contract


# ---------------------------------------------------------
# GET ALL CONTRACTS
# ---------------------------------------------------------
@router.get("/")
def get_contracts(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER",
            "SUPPLY_CHAIN_MANAGER",
            "FINANCE_OFFICER",
            "AUDITOR"
        )
    )
):
    contracts = db.query(Contract).all()

    today = date.today()

    result = []

    for contract in contracts:

        days_remaining = (contract.end_date - today).days

        if contract.status == "TERMINATED":
            expiry_status = "TERMINATED"

        elif days_remaining < 0:
            expiry_status = "EXPIRED"

            if contract.status == "ACTIVE":
                contract.status = "EXPIRED"

        elif days_remaining <= 30:
            expiry_status = "EXPIRING_SOON"

        else:
            expiry_status = "ACTIVE"

        # -------------------------------------------------
        # AUTOMATIC CONTRACT EXPIRY ACTIVITY LOG
        # -------------------------------------------------
        if expiry_status in ["EXPIRED", "EXPIRING_SOON"]:

            existing_log = db.query(ActivityLog).filter(
                ActivityLog.action == "Contract Expiry",
                ActivityLog.related_record == contract.contract_number
            ).first()

            if not existing_log:

                activity = ActivityLog(
                    user=current_user.email,
                    action="Contract Expiry",
                    related_record=contract.contract_number
                )

                db.add(activity)

        result.append({
            "id": contract.id,
            "vendor_id": contract.vendor_id,
            "contract_number": contract.contract_number,
            "contract_type": contract.contract_type,
            "start_date": contract.start_date,
            "end_date": contract.end_date,
            "contract_value": contract.contract_value,
            "renewal_date": contract.renewal_date,
            "terms": contract.terms,
            "document": contract.document,
            "compliance_status": contract.compliance_status,
            "status": contract.status,
            "days_remaining": days_remaining,
            "expiry_status": expiry_status
        })

    db.commit()

    return result


# ---------------------------------------------------------
# TERMINATE CONTRACT
# ---------------------------------------------------------
@router.put("/{contract_id}/terminate")
def terminate_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    contract = db.query(Contract).filter(
        Contract.id == contract_id
    ).first()

    if not contract:
        raise HTTPException(
            status_code=404,
            detail="Contract not found"
        )

    contract.status = "TERMINATED"

    db.commit()
    db.refresh(contract)

    return contract