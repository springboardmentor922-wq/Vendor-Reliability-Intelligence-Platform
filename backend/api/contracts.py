"""Contract repository, renewal tracking, compliance and certifications."""

from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import (
    assert_vendor_access,
    get_current_user,
    require_procurement,
    require_procurement_or_supply_chain,
    vendor_scope
)
from models import (
    ComplianceCheck,
    ComplianceStatus,
    Contract,
    ContractStatus,
    NotificationType,
    User,
    UserRole,
    Vendor,
    VendorCertification
)
from schemas.common import Message
from schemas.contract import (
    CHECK_TYPES,
    CONTRACT_TYPES,
    CertificationCreate,
    CertificationResponse,
    ComplianceCheckCreate,
    ComplianceCheckResponse,
    ContractCreate,
    ContractDetail,
    ContractRenewal,
    ContractResponse,
    ContractStatsResponse,
    ContractUpdate
)
from services.events import log_activity, notify_roles, notify_vendor_users
from services.numbering import next_contract_number

router = APIRouter(prefix="/contracts", tags=["Contracts & Compliance"])


# =========================================================
# HELPERS
# =========================================================

def _get_contract(db: Session, contract_id: int) -> Contract:
    contract = db.query(Contract).filter(Contract.id == contract_id).first()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )

    return contract


def _refresh_lifecycle(contract: Contract) -> None:
    """Move Active contracts into Expiring / Expired as their dates pass.

    Draft, Terminated and Renewed are manual states and are left alone.
    """

    if contract.status in (
        ContractStatus.DRAFT,
        ContractStatus.TERMINATED,
        ContractStatus.RENEWED
    ):
        return

    days_left = (contract.expiry_date - date.today()).days

    if days_left < 0:
        contract.status = ContractStatus.EXPIRED
    elif days_left <= (contract.renewal_notice_days or 30):
        contract.status = ContractStatus.EXPIRING
    else:
        contract.status = ContractStatus.ACTIVE


def _to_response(contract: Contract) -> ContractResponse:
    payload = ContractResponse.model_validate(contract)
    payload.vendor_name = contract.vendor.vendor_name if contract.vendor else None
    payload.owner_name = contract.owner.name if contract.owner else None
    payload.days_to_expiry = (contract.expiry_date - date.today()).days
    payload.is_expiring_soon = (
        0 <= payload.days_to_expiry <= settings.CONTRACT_EXPIRY_ALERT_DAYS
    )
    return payload


def _check_response(check: ComplianceCheck) -> ComplianceCheckResponse:
    payload = ComplianceCheckResponse.model_validate(check)
    payload.checked_by_name = check.checker.name if check.checker else None
    return payload


def _certification_status(cert: VendorCertification) -> str:
    if cert.status == "Revoked":
        return "Revoked"

    if not cert.expiry_date:
        return "Valid"

    days_left = (cert.expiry_date - date.today()).days

    if days_left < 0:
        return "Expired"
    if days_left <= 60:
        return "Expiring"

    return "Valid"


def _certification_response(cert: VendorCertification) -> CertificationResponse:
    payload = CertificationResponse.model_validate(cert)
    payload.status = _certification_status(cert)
    payload.days_to_expiry = (
        (cert.expiry_date - date.today()).days if cert.expiry_date else None
    )
    return payload


# =========================================================
# REFERENCE DATA
# =========================================================

@router.get("/meta/types", response_model=list[str])
def list_types(current_user: User = Depends(get_current_user)):
    return CONTRACT_TYPES


@router.get("/meta/statuses", response_model=list[str])
def list_statuses(current_user: User = Depends(get_current_user)):
    return ContractStatus.ALL


@router.get("/meta/check-types", response_model=list[str])
def list_check_types(current_user: User = Depends(get_current_user)):
    return CHECK_TYPES


# =========================================================
# STATS
# =========================================================

@router.get("/stats/summary", response_model=ContractStatsResponse)
def contract_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Contract)

    scope = vendor_scope(current_user)
    if scope is not None:
        query = query.filter(Contract.vendor_id == scope)

    contracts = query.all()

    for contract in contracts:
        _refresh_lifecycle(contract)

    db.commit()

    counts: dict[str, int] = {}
    for contract in contracts:
        counts[contract.status] = counts.get(contract.status, 0) + 1

    total_value = sum(
        (Decimal(c.contract_value or 0) for c in contracts
         if c.status not in (ContractStatus.TERMINATED, ContractStatus.EXPIRED)),
        Decimal("0")
    )

    expiring_soon = sum(
        1 for c in contracts
        if 0 <= (c.expiry_date - date.today()).days
        <= settings.CONTRACT_EXPIRY_ALERT_DAYS
        and c.status not in (ContractStatus.TERMINATED, ContractStatus.RENEWED)
    )

    return ContractStatsResponse(
        total=len(contracts),
        draft=counts.get(ContractStatus.DRAFT, 0),
        active=counts.get(ContractStatus.ACTIVE, 0),
        expiring=counts.get(ContractStatus.EXPIRING, 0),
        expired=counts.get(ContractStatus.EXPIRED, 0),
        terminated=counts.get(ContractStatus.TERMINATED, 0),
        renewed=counts.get(ContractStatus.RENEWED, 0),
        total_value=total_value,
        compliant=sum(
            1 for c in contracts
            if c.compliance_status == ComplianceStatus.COMPLIANT
        ),
        non_compliant=sum(
            1 for c in contracts
            if c.compliance_status == ComplianceStatus.NON_COMPLIANT
        ),
        expiring_within_30_days=expiring_soon
    )


# =========================================================
# LIST
# =========================================================

@router.get("", response_model=list[ContractResponse])
@router.get("/", response_model=list[ContractResponse], include_in_schema=False)
def list_contracts(
    search: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    vendor_id: Optional[int] = Query(default=None),
    compliance_status: Optional[str] = Query(default=None),
    expiring_within_days: Optional[int] = Query(default=None, ge=0, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Contract)

    scope = vendor_scope(current_user)
    if scope is not None:
        query = query.filter(Contract.vendor_id == scope)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Contract.contract_number.ilike(pattern),
                Contract.title.ilike(pattern),
                Contract.contract_type.ilike(pattern)
            )
        )

    if vendor_id:
        query = query.filter(Contract.vendor_id == vendor_id)

    if compliance_status:
        query = query.filter(Contract.compliance_status == compliance_status)

    contracts = query.order_by(Contract.expiry_date.asc()).all()

    for contract in contracts:
        _refresh_lifecycle(contract)

    db.commit()

    if status_filter:
        contracts = [c for c in contracts if c.status == status_filter]

    if expiring_within_days is not None:
        contracts = [
            c for c in contracts
            if 0 <= (c.expiry_date - date.today()).days <= expiring_within_days
        ]

    return [_to_response(c) for c in contracts]


@router.get("/expiring", response_model=list[ContractResponse])
def expiring_contracts(
    days: int = Query(default=settings.CONTRACT_EXPIRY_ALERT_DAYS, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Contracts entering their renewal notice window."""

    query = db.query(Contract).filter(
        Contract.status.notin_([
            ContractStatus.TERMINATED,
            ContractStatus.RENEWED
        ])
    )

    scope = vendor_scope(current_user)
    if scope is not None:
        query = query.filter(Contract.vendor_id == scope)

    contracts = query.order_by(Contract.expiry_date.asc()).all()

    for contract in contracts:
        _refresh_lifecycle(contract)

    db.commit()

    return [
        _to_response(c) for c in contracts
        if 0 <= (c.expiry_date - date.today()).days <= days
    ]


# =========================================================
# DETAIL
# =========================================================

@router.get("/{contract_id}", response_model=ContractDetail)
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    contract = _get_contract(db, contract_id)
    assert_vendor_access(current_user, contract.vendor_id)

    _refresh_lifecycle(contract)
    db.commit()

    base = _to_response(contract)

    payload = ContractDetail(**base.model_dump())
    payload.compliance_checks = [
        _check_response(c) for c in contract.compliance_checks
    ]

    return payload


# =========================================================
# CREATE
# =========================================================

@router.post(
    "",
    response_model=ContractDetail,
    status_code=status.HTTP_201_CREATED
)
@router.post(
    "/",
    response_model=ContractDetail,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False
)
def create_contract(
    payload: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )

    if payload.status not in ContractStatus.ALL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"status must be one of: {', '.join(ContractStatus.ALL)}"
        )

    contract_number = payload.contract_number or next_contract_number(db)

    exists = (
        db.query(Contract)
        .filter(Contract.contract_number == contract_number)
        .first()
    )

    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Contract number '{contract_number}' is already in use"
        )

    data = payload.model_dump(exclude={"contract_number"})

    contract = Contract(
        **data,
        contract_number=contract_number,
        owner_id=current_user.id
    )

    db.add(contract)
    db.flush()

    _refresh_lifecycle(contract)

    log_activity(
        db, current_user.id, "Contract", contract.id, "Created",
        f"Contract {contract.contract_number} created for {vendor.vendor_name}"
    )

    db.commit()
    db.refresh(contract)

    return get_contract(contract.id, db, current_user)


# =========================================================
# UPDATE
# =========================================================

@router.put("/{contract_id}", response_model=ContractDetail)
def update_contract(
    contract_id: int,
    payload: ContractUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    contract = _get_contract(db, contract_id)

    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(contract, field, value)

    if contract.expiry_date <= contract.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="expiry_date must be after start_date"
        )

    # An explicit status wins; otherwise recompute from the dates.
    if "status" not in data:
        _refresh_lifecycle(contract)

    log_activity(
        db, current_user.id, "Contract", contract.id, "Updated",
        f"Contract {contract.contract_number} updated"
    )

    db.commit()
    db.refresh(contract)

    return get_contract(contract.id, db, current_user)


# =========================================================
# RENEWAL
# =========================================================

@router.post(
    "/{contract_id}/renew",
    response_model=ContractDetail,
    status_code=status.HTTP_201_CREATED
)
def renew_contract(
    contract_id: int,
    payload: ContractRenewal,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement)
):
    """Close out a contract and open its successor, linked by renewed_from."""

    original = _get_contract(db, contract_id)

    if original.status == ContractStatus.RENEWED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This contract has already been renewed"
        )

    if payload.expiry_date <= payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="expiry_date must be after start_date"
        )

    successor = Contract(
        contract_number=next_contract_number(db),
        vendor_id=original.vendor_id,
        title=original.title,
        contract_type=original.contract_type,
        start_date=payload.start_date,
        expiry_date=payload.expiry_date,
        contract_value=(
            payload.contract_value
            if payload.contract_value is not None
            else original.contract_value
        ),
        currency=original.currency,
        auto_renew=original.auto_renew,
        renewal_notice_days=original.renewal_notice_days,
        renewed_from_id=original.id,
        status=ContractStatus.ACTIVE,
        compliance_status=ComplianceStatus.PENDING,
        owner_id=current_user.id,
        terms=original.terms,
        notes=payload.notes
    )

    original.status = ContractStatus.RENEWED

    db.add(successor)
    db.flush()

    _refresh_lifecycle(successor)

    log_activity(
        db, current_user.id, "Contract", successor.id, "Renewed",
        f"Contract {original.contract_number} renewed as "
        f"{successor.contract_number}"
    )

    notify_vendor_users(
        db, original.vendor_id, NotificationType.CONTRACT_EXPIRY,
        "Contract renewed",
        f"{original.contract_number} has been renewed as "
        f"{successor.contract_number}, valid to {successor.expiry_date}.",
        link=f"/contracts/{successor.id}"
    )

    db.commit()
    db.refresh(successor)

    return get_contract(successor.id, db, current_user)


@router.post("/{contract_id}/terminate", response_model=ContractResponse)
def terminate_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement)
):
    contract = _get_contract(db, contract_id)

    contract.status = ContractStatus.TERMINATED

    log_activity(
        db, current_user.id, "Contract", contract.id, "Terminated",
        f"Contract {contract.contract_number} terminated"
    )

    db.commit()
    db.refresh(contract)

    return _to_response(contract)


# =========================================================
# EXPIRY ALERTS
# =========================================================

@router.post("/run-expiry-scan", response_model=Message)
def run_expiry_scan(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement)
):
    """Refresh contract lifecycle states and raise expiry notifications.

    Milestone 4 schedules this as a Celery beat job; for now it is triggered
    from the contracts screen.
    """

    contracts = (
        db.query(Contract)
        .filter(
            Contract.status.notin_([
                ContractStatus.TERMINATED,
                ContractStatus.RENEWED
            ])
        )
        .all()
    )

    alerted = 0

    for contract in contracts:
        _refresh_lifecycle(contract)

        days_left = (contract.expiry_date - date.today()).days

        if not (0 <= days_left <= settings.CONTRACT_EXPIRY_ALERT_DAYS):
            continue

        vendor_name = contract.vendor.vendor_name if contract.vendor else "vendor"

        notify_roles(
            db,
            [UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER],
            NotificationType.CONTRACT_EXPIRY,
            "Contract expiring soon",
            f"{contract.contract_number} with {vendor_name} expires in "
            f"{days_left} day(s) on {contract.expiry_date}.",
            link=f"/contracts/{contract.id}",
            priority="High" if days_left <= 7 else "Medium"
        )

        notify_vendor_users(
            db, contract.vendor_id, NotificationType.CONTRACT_EXPIRY,
            "Contract expiring soon",
            f"{contract.contract_number} expires on {contract.expiry_date}.",
            link=f"/contracts/{contract.id}"
        )

        alerted += 1

    db.commit()

    return Message(
        message=(
            f"Expiry scan complete. {len(contracts)} contract(s) refreshed, "
            f"{alerted} expiry alert(s) raised."
        )
    )


# =========================================================
# COMPLIANCE CHECKS
# =========================================================

@router.get(
    "/{contract_id}/compliance",
    response_model=list[ComplianceCheckResponse]
)
def list_compliance_checks(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    contract = _get_contract(db, contract_id)
    assert_vendor_access(current_user, contract.vendor_id)

    return [_check_response(c) for c in contract.compliance_checks]


@router.post(
    "/{contract_id}/compliance",
    response_model=ComplianceCheckResponse,
    status_code=status.HTTP_201_CREATED
)
def record_compliance_check(
    contract_id: int,
    payload: ComplianceCheckCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    contract = _get_contract(db, contract_id)

    check = ComplianceCheck(
        vendor_id=contract.vendor_id,
        contract_id=contract.id,
        check_type=payload.check_type,
        check_date=payload.check_date or date.today(),
        result=payload.result,
        remarks=payload.remarks,
        checked_by=current_user.id
    )

    db.add(check)

    # Roll the check result up onto the contract.
    if payload.result == "Non-Compliant":
        contract.compliance_status = ComplianceStatus.NON_COMPLIANT

        notify_roles(
            db,
            [UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER,
             UserRole.AUDITOR],
            NotificationType.COMPLIANCE,
            "Compliance breach recorded",
            f"{contract.contract_number} failed a {payload.check_type} check.",
            link=f"/contracts/{contract.id}",
            priority="High"
        )
    elif payload.result == "Partial":
        contract.compliance_status = ComplianceStatus.UNDER_REVIEW
    else:
        contract.compliance_status = ComplianceStatus.COMPLIANT

    log_activity(
        db, current_user.id, "Contract", contract.id, "Compliance Check",
        f"{payload.check_type} check on {contract.contract_number}: "
        f"{payload.result}"
    )

    db.commit()
    db.refresh(check)

    return _check_response(check)


# =========================================================
# VENDOR CERTIFICATIONS
# =========================================================

@router.get(
    "/certifications/vendor/{vendor_id}",
    response_model=list[CertificationResponse]
)
def list_certifications(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assert_vendor_access(current_user, vendor_id)

    certs = (
        db.query(VendorCertification)
        .filter(VendorCertification.vendor_id == vendor_id)
        .order_by(VendorCertification.expiry_date.asc())
        .all()
    )

    for cert in certs:
        cert.status = _certification_status(cert)

    db.commit()

    return [_certification_response(c) for c in certs]


@router.post(
    "/certifications/vendor/{vendor_id}",
    response_model=CertificationResponse,
    status_code=status.HTTP_201_CREATED
)
def add_certification(
    vendor_id: int,
    payload: CertificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )

    cert = VendorCertification(vendor_id=vendor_id, **payload.model_dump())
    cert.status = _certification_status(cert)

    db.add(cert)

    log_activity(
        db, current_user.id, "Vendor", vendor_id, "Certification Added",
        f"'{payload.certification_name}' recorded for {vendor.vendor_name}"
    )

    db.commit()
    db.refresh(cert)

    return _certification_response(cert)


@router.delete("/certifications/{certification_id}", response_model=Message)
def delete_certification(
    certification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    cert = (
        db.query(VendorCertification)
        .filter(VendorCertification.id == certification_id)
        .first()
    )

    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certification not found"
        )

    db.delete(cert)
    db.commit()

    return Message(message="Certification removed successfully")


# =========================================================
# DELETE
# =========================================================

@router.delete("/{contract_id}", response_model=Message)
def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement)
):
    contract = _get_contract(db, contract_id)

    if contract.status in (ContractStatus.ACTIVE, ContractStatus.EXPIRING):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "An active contract cannot be deleted. Terminate it instead so "
                "the record is retained."
            )
        )

    number = contract.contract_number

    log_activity(
        db, current_user.id, "Contract", contract_id, "Deleted",
        f"Contract {number} deleted"
    )

    db.delete(contract)
    db.commit()

    return Message(message=f"Contract {number} deleted successfully")
