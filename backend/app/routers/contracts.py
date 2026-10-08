from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, date, timedelta
import uuid
from app.database import get_db
from app.models.contract import Contract, Certification
from app.models.procurement import PurchaseOrder, Invoice
from app.models.vendor import Vendor
from app.models.user import User
from app.models.enums import UserRole, ContractStatus
from app.schemas.contract import (
    ContractCreate, ContractResponse,
    CertificationCreate, CertificationResponse
)
from app.core.dependencies import get_current_user, require_roles
from app.core.audit import log_audit_event

router = APIRouter(prefix="/contracts", tags=["Contract & Compliance"])

def refresh_contract_expiries(contracts: List[Contract], db: Session):
    today = date.today()
    threshold = today + timedelta(days=30)
    for c in contracts:
        if c.status == ContractStatus.ACTIVE:
            if c.end_date < today:
                c.status = ContractStatus.EXPIRED
            elif c.end_date <= threshold:
                c.status = ContractStatus.EXPIRING_SOON
    db.commit()

@router.get("", response_model=List[ContractResponse])
def get_contracts(
    status_filter: Optional[ContractStatus] = Query(None, alias="status"),
    vendor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Contract).options(
        joinedload(Contract.vendor),
        joinedload(Contract.certifications)
    )

    if current_user.role == UserRole.VENDOR:
        if not current_user.vendor_id:
            return []
        query = query.filter(Contract.vendor_id == current_user.vendor_id)
    elif vendor_id:
        query = query.filter(Contract.vendor_id == vendor_id)

    contracts = query.order_by(Contract.id.desc()).all()
    refresh_contract_expiries(contracts, db)

    # Attach total purchase amount and contract invoices for each contract
    for c in contracts:
        c_suffix = c.contract_number.split("-")[-1] if "-" in c.contract_number else ""
        all_vendor_pos = db.query(PurchaseOrder).filter(PurchaseOrder.vendor_id == c.vendor_id).all()
        matching_pos = [po for po in all_vendor_pos if c_suffix and c_suffix in (po.po_number or "")]
        if not matching_pos and (len(all_vendor_pos) == 1 or len(contracts) == 1):
            matching_pos = all_vendor_pos

        c_total_purchase = sum(float(p.total_amount or 0.0) for p in matching_pos) if matching_pos else 0.0
        po_ids = [p.id for p in matching_pos]
        matching_invoices = db.query(Invoice).filter(Invoice.purchase_order_id.in_(po_ids)).all() if po_ids else []

        c.total_purchase_amount = c_total_purchase
        c.invoices = [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "amount": float(inv.amount or 0.0),
                "status": inv.status.value if hasattr(inv.status, "value") else str(inv.status),
                "created_at": inv.created_at,
                "due_date": inv.due_date,
                "purchase_order_id": inv.purchase_order_id
            }
            for inv in matching_invoices
        ]

    if status_filter:
        contracts = [c for c in contracts if c.status == status_filter]

    return contracts

@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
def create_contract(
    contract_in: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER, UserRole.SUPPLY_CHAIN_MANAGER
    ]))
):
    vendor = db.query(Vendor).filter(Vendor.id == contract_in.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    unique_suffix = str(uuid.uuid4().hex[:6]).upper()
    contract_number = f"CTR-{datetime.utcnow().year}-{unique_suffix}"

    today = date.today()
    init_status = ContractStatus.ACTIVE
    if contract_in.end_date < today:
        init_status = ContractStatus.EXPIRED
    elif contract_in.end_date <= today + timedelta(days=30):
        init_status = ContractStatus.EXPIRING_SOON

    contract = Contract(
        contract_number=contract_number,
        vendor_id=contract_in.vendor_id,
        title=contract_in.title,
        start_date=contract_in.start_date,
        end_date=contract_in.end_date,
        status=init_status,
        file_path=contract_in.file_path
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)

    log_audit_event(
        db, current_user.id, "CREATE_CONTRACT", "Contract",
        f"Registered contract {contract.contract_number} for vendor {vendor.company_name}"
    )
    return contract

@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract_by_id(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    contract = db.query(Contract).options(
        joinedload(Contract.vendor),
        joinedload(Contract.certifications)
    ).filter(Contract.id == contract_id).first()

    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    if current_user.role == UserRole.VENDOR and contract.vendor_id != current_user.vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return contract

@router.get("/compliance/certifications", response_model=List[CertificationResponse])
def get_certifications(
    vendor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Certification).options(joinedload(Certification.vendor))

    if current_user.role == UserRole.VENDOR:
        if not current_user.vendor_id:
            return []
        query = query.filter(Certification.vendor_id == current_user.vendor_id)
    elif vendor_id:
        query = query.filter(Certification.vendor_id == vendor_id)

    return query.order_by(Certification.id.desc()).all()

@router.post("/certifications", response_model=CertificationResponse, status_code=status.HTTP_201_CREATED)
def create_certification(
    cert_in: CertificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.VENDOR and cert_in.vendor_id != current_user.vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    cert = Certification(
        contract_id=cert_in.contract_id,
        vendor_id=cert_in.vendor_id,
        name=cert_in.name,
        issued_date=cert_in.issued_date,
        expiry_date=cert_in.expiry_date,
        document_path=cert_in.document_path
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)

    log_audit_event(
        db, current_user.id, "ADD_CERTIFICATION", "Certification",
        f"Added certification '{cert.name}' for vendor ID {cert.vendor_id}"
    )
    return cert
