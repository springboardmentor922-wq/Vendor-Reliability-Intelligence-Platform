from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.contract import Contract, Certification, VendorDocument
from app.models.vendor import Vendor
from app.schemas.contract import (
    CONTRACT_STATUSES,
    COMPLIANCE_STATUSES,
    CERTIFICATION_STATUSES,
    DOCUMENT_STATUSES,
    ContractCreate,
    ContractUpdate,
    ContractStatusUpdate,
    ContractComplianceUpdate,
    ContractResponse,
    CertificationCreate,
    CertificationStatusUpdate,
    CertificationResponse,
    VendorDocumentCreate,
    VendorDocumentResponse,
)


router = APIRouter(
    prefix="/api/contracts",
    tags=["Contract & Compliance"]
)


MANAGEMENT_ROLES = [
    "ADMINISTRATOR",
    "PROCUREMENT_MANAGER",
    "SUPPLY_CHAIN_MANAGER",
]


# ---------------- CONTRACTS ----------------


@router.get("/statuses")
def get_contract_statuses(
    current_user=Depends(get_current_user),
):
    return {
        "statuses": CONTRACT_STATUSES,
        "compliance_statuses": COMPLIANCE_STATUSES,
    }


@router.post(
    "",
    response_model=ContractResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_contract(
    contract: ContractCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    if contract.end_date < contract.start_date:
        raise HTTPException(
            status_code=400,
            detail="End date cannot be before start date.",
        )

    vendor = db.get(Vendor, contract.vendor_id)

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found.",
        )

    existing = (
        db.query(Contract)
        .filter(
            Contract.contract_number
            == contract.contract_number
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Contract number already exists.",
        )

    new_contract = Contract(
        contract_number=contract.contract_number,
        title=contract.title,
        contract_type=contract.contract_type,
        vendor_id=contract.vendor_id,
        start_date=contract.start_date,
        end_date=contract.end_date,
        renewal_date=contract.renewal_date,
        contract_value=contract.contract_value,
        payment_terms=contract.payment_terms,
        notes=contract.notes,
        status="Active",
        compliance_status="Under Review",
        created_by=current_user.id,
    )

    db.add(new_contract)
    db.commit()
    db.refresh(new_contract)

    return new_contract


@router.get(
    "",
    response_model=list[ContractResponse],
)
def list_contracts(
    contract_status: str | None = Query(
        default=None
    ),
    compliance_status: str | None = Query(
        default=None
    ),
    vendor_id: int | None = Query(
        default=None
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Contract)

    if contract_status:
        query = query.filter(
            Contract.status == contract_status
        )

    if compliance_status:
        query = query.filter(
            Contract.compliance_status
            == compliance_status
        )

    if vendor_id is not None:
        query = query.filter(
            Contract.vendor_id == vendor_id
        )

    return (
        query
        .order_by(Contract.end_date.asc())
        .all()
    )


@router.get(
    "/expiring",
    response_model=list[ContractResponse],
)
def get_expiring_contracts(
    days: int = Query(
        default=30,
        ge=1,
        le=365,
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    today = date.today()
    limit_date = today + timedelta(days=days)

    return (
        db.query(Contract)
        .filter(
            Contract.end_date >= today,
            Contract.end_date <= limit_date,
            Contract.status != "Terminated",
        )
        .order_by(Contract.end_date.asc())
        .all()
    )


@router.get(
    "/{contract_id}",
    response_model=ContractResponse,
)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    contract = db.get(Contract, contract_id)

    if not contract:
        raise HTTPException(
            status_code=404,
            detail="Contract not found.",
        )

    return contract


@router.put(
    "/{contract_id}",
    response_model=ContractResponse,
)
def update_contract(
    contract_id: int,
    data: ContractUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    contract = db.get(Contract, contract_id)

    if not contract:
        raise HTTPException(
            status_code=404,
            detail="Contract not found.",
        )

    updates = data.model_dump(
        exclude_unset=True
    )

    for key, value in updates.items():
        setattr(contract, key, value)

    if contract.end_date < contract.start_date:
        raise HTTPException(
            status_code=400,
            detail="End date cannot be before start date.",
        )

    db.commit()
    db.refresh(contract)

    return contract


@router.patch(
    "/{contract_id}/status",
    response_model=ContractResponse,
)
def update_contract_status(
    contract_id: int,
    data: ContractStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    if data.status not in CONTRACT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid contract status.",
        )

    contract = db.get(Contract, contract_id)

    if not contract:
        raise HTTPException(
            status_code=404,
            detail="Contract not found.",
        )

    contract.status = data.status

    db.commit()
    db.refresh(contract)

    return contract


@router.patch(
    "/{contract_id}/compliance",
    response_model=ContractResponse,
)
def update_contract_compliance(
    contract_id: int,
    data: ContractComplianceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    if data.compliance_status not in COMPLIANCE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid compliance status.",
        )

    contract = db.get(Contract, contract_id)

    if not contract:
        raise HTTPException(
            status_code=404,
            detail="Contract not found.",
        )

    contract.compliance_status = (
        data.compliance_status
    )

    db.commit()
    db.refresh(contract)

    return contract


@router.delete(
    "/{contract_id}",
)
def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles("ADMINISTRATOR")
    ),
):
    contract = db.get(Contract, contract_id)

    if not contract:
        raise HTTPException(
            status_code=404,
            detail="Contract not found.",
        )

    db.delete(contract)
    db.commit()

    return {
        "message": "Contract deleted successfully."
    }


# ---------------- CERTIFICATIONS ----------------


@router.post(
    "/certifications",
    response_model=CertificationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_certification(
    certification: CertificationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    vendor = db.get(
        Vendor,
        certification.vendor_id
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found.",
        )

    if certification.expiry_date < certification.issue_date:
        raise HTTPException(
            status_code=400,
            detail="Expiry date cannot be before issue date.",
        )

    new_certification = Certification(
        vendor_id=certification.vendor_id,
        name=certification.name,
        certificate_number=(
            certification.certificate_number
        ),
        issue_date=certification.issue_date,
        expiry_date=certification.expiry_date,
        status="Active",
    )

    db.add(new_certification)
    db.commit()
    db.refresh(new_certification)

    return new_certification


@router.get(
    "/certifications/list",
    response_model=list[CertificationResponse],
)
def list_certifications(
    vendor_id: int | None = Query(
        default=None
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Certification)

    if vendor_id is not None:
        query = query.filter(
            Certification.vendor_id
            == vendor_id
        )

    return (
        query
        .order_by(
            Certification.expiry_date.asc()
        )
        .all()
    )


@router.patch(
    "/certifications/{certification_id}/status",
    response_model=CertificationResponse,
)
def update_certification_status(
    certification_id: int,
    data: CertificationStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    if data.status not in CERTIFICATION_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid certification status.",
        )

    certification = db.get(
        Certification,
        certification_id,
    )

    if not certification:
        raise HTTPException(
            status_code=404,
            detail="Certification not found.",
        )

    certification.status = data.status

    db.commit()
    db.refresh(certification)

    return certification


# ---------------- VENDOR DOCUMENTS ----------------


@router.post(
    "/documents",
    response_model=VendorDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_vendor_document(
    document: VendorDocumentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    vendor = db.get(
        Vendor,
        document.vendor_id
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found.",
        )

    if (
        document.issue_date
        and document.expiry_date
        and document.expiry_date
        < document.issue_date
    ):
        raise HTTPException(
            status_code=400,
            detail="Expiry date cannot be before issue date.",
        )

    if document.status not in DOCUMENT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid document status.",
        )

    new_document = VendorDocument(
        vendor_id=document.vendor_id,
        document_type=document.document_type,
        document_name=document.document_name,
        document_number=document.document_number,
        issue_date=document.issue_date,
        expiry_date=document.expiry_date,
        status=document.status,
        notes=document.notes,
    )

    db.add(new_document)
    db.commit()
    db.refresh(new_document)

    return new_document


@router.get(
    "/documents/list",
    response_model=list[VendorDocumentResponse],
)
def list_vendor_documents(
    vendor_id: int | None = Query(
        default=None
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(VendorDocument)

    if vendor_id is not None:
        query = query.filter(
            VendorDocument.vendor_id
            == vendor_id
        )

    return (
        query
        .order_by(
            VendorDocument.created_at.desc()
        )
        .all()
    )