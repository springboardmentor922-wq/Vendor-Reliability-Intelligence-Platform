import os
import uuid
import shutil
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Contract, Vendor, User, Certification
from app.schemas import (
    ContractCreate, ContractUpdate, ContractResponse, ContractRenewRequest, MessageResponse,
    CertificationCreate, CertificationUpdate, CertificationResponse,
    ComplianceSummaryResponse, VendorComplianceSummary,
)
from app.security import get_current_user, require_role
from app.routers.notifications import add_notification

router = APIRouter(prefix="/api/v1/contracts", tags=["Contracts"])

CONTRACT_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "contracts")
os.makedirs(CONTRACT_UPLOAD_DIR, exist_ok=True)

def _compute_contract_meta(c: Contract) -> tuple[int, str]:
    """Computes days remaining and risk level (green, amber, red)."""
    now = datetime.utcnow()
    end_date = c.end_date
    if end_date and end_date.tzinfo is not None:
        end_date = end_date.astimezone(timezone.utc).replace(tzinfo=None)
    diff = (end_date - now).total_seconds() / 86400.0
    days_left = int(diff)

    if days_left <= 30:
        risk = "red"
    elif days_left <= 60:
        risk = "amber"
    else:
        risk = "green"

    return max(days_left, 0) if days_left >= 0 else days_left, risk

def _map_contract_response(c: Contract) -> ContractResponse:
    days_rem, risk = _compute_contract_meta(c)
    return ContractResponse(
        id=c.id,
        vendor_id=c.vendor_id,
        vendor_name=c.vendor.company_name if c.vendor else "Unknown",
        title=c.title,
        start_date=c.start_date,
        end_date=c.end_date,
        renewal_notice_period_days=int(c.renewal_notice_period_days or 30),
        terms=c.terms,
        compliance_flags=c.compliance_flags,
        document_path=c.document_path,
        status=c.status,
        created_at=c.created_at,
        days_remaining=days_rem,
        risk_level=risk,
        renewed_from_contract_id=c.renewed_from_contract_id
    )

@router.get("", response_model=List[ContractResponse])
async def list_contracts(
    vendor_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Contract).options(selectinload(Contract.vendor)).order_by(Contract.end_date.asc())
    if vendor_id:
        stmt = stmt.where(Contract.vendor_id == vendor_id)
    if status_filter:
        stmt = stmt.where(Contract.status.ilike(status_filter))

    result = await db.execute(stmt)
    contracts = result.scalars().all()
    return [_map_contract_response(c) for c in contracts]

@router.get("/expiring", response_model=List[ContractResponse])
async def list_expiring_contracts(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Contract).options(selectinload(Contract.vendor)).order_by(Contract.end_date.asc())
    result = await db.execute(stmt)
    contracts = result.scalars().all()

    expiring = []
    for c in contracts:
        days_left, _ = _compute_contract_meta(c)
        if days_left <= days:
            expiring.append(_map_contract_response(c))

    return expiring

@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
async def create_contract(
    payload: ContractCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager"))
):
    # Validate vendor exists
    v_res = await db.execute(select(Vendor).where(Vendor.id == payload.vendor_id))
    vendor = v_res.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    start_date = payload.start_date.astimezone(timezone.utc).replace(tzinfo=None) if payload.start_date.tzinfo else payload.start_date
    end_date = payload.end_date.astimezone(timezone.utc).replace(tzinfo=None) if payload.end_date.tzinfo else payload.end_date

    new_contract = Contract(
        vendor_id=payload.vendor_id,
        title=payload.title,
        start_date=start_date,
        end_date=end_date,
        renewal_notice_period_days=Decimal(str(payload.renewal_notice_period_days or 30)),
        terms=payload.terms,
        compliance_flags=payload.compliance_flags,
        status=payload.status or "ACTIVE"
    )
    db.add(new_contract)
    await db.flush()

    days_left, risk = _compute_contract_meta(new_contract)
    if days_left <= 30:
        notif_msg = f"URGENT: Contract '{new_contract.title}' with '{vendor.company_name}' is expiring in {days_left} days ({risk.upper()} risk)."
        await add_notification(db, notif_msg, notification_type="contract_expiry")
        # Best-effort email + SMS for expiry alert
        from app.email_service import send_contract_expiry_email
        from app.sms_service import send_contract_expiry_sms
        vendor_email = vendor.contacts[0].email if vendor.contacts else None
        vendor_phone = vendor.contacts[0].phone or "" if vendor.contacts else ""
        if vendor_email:
            send_contract_expiry_email(vendor_email, vendor.company_name, new_contract.title, days_left)
        send_contract_expiry_sms(vendor_phone, new_contract.title, days_left)
    else:
        await add_notification(
            db,
            f"New contract '{new_contract.title}' executed with '{vendor.company_name}'."
        )

    await db.commit()
    await db.refresh(new_contract)

    stmt = select(Contract).where(Contract.id == new_contract.id).options(selectinload(Contract.vendor))
    reloaded = (await db.execute(stmt)).scalar_one()
    return _map_contract_response(reloaded)

@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Contract).where(Contract.id == contract_id).options(selectinload(Contract.vendor))
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return _map_contract_response(contract)

@router.put("/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: uuid.UUID,
    payload: ContractUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager"))
):
    stmt = select(Contract).where(Contract.id == contract_id).options(selectinload(Contract.vendor))
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    if payload.title is not None:
        contract.title = payload.title
    if payload.start_date is not None:
        contract.start_date = payload.start_date.astimezone(timezone.utc).replace(tzinfo=None) if payload.start_date.tzinfo else payload.start_date
    if payload.end_date is not None:
        contract.end_date = payload.end_date.astimezone(timezone.utc).replace(tzinfo=None) if payload.end_date.tzinfo else payload.end_date
    if payload.renewal_notice_period_days is not None:
        contract.renewal_notice_period_days = Decimal(str(payload.renewal_notice_period_days))
    if payload.terms is not None:
        contract.terms = payload.terms
    if payload.compliance_flags is not None:
        contract.compliance_flags = payload.compliance_flags
    if payload.status is not None:
        contract.status = payload.status

    await db.commit()
    stmt_reload = select(Contract).where(Contract.id == contract.id).options(selectinload(Contract.vendor))
    reloaded = (await db.execute(stmt_reload)).scalar_one()
    return _map_contract_response(reloaded)

@router.post("/{contract_id}/document", response_model=ContractResponse)
async def upload_contract_document(
    contract_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager"))
):
    stmt = select(Contract).where(Contract.id == contract_id).options(selectinload(Contract.vendor))
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    file_id = uuid.uuid4().hex[:8]
    safe_filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(CONTRACT_UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    contract.document_path = file_path
    await add_notification(
        db,
        f"Contract document '{file.filename}' uploaded for '{contract.title}'."
    )

    await db.commit()
    stmt_reload = select(Contract).where(Contract.id == contract.id).options(selectinload(Contract.vendor))
    reloaded = (await db.execute(stmt_reload)).scalar_one()
    return _map_contract_response(reloaded)

@router.delete("/{contract_id}", response_model=MessageResponse)
async def delete_contract(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator"))
):
    stmt = select(Contract).where(Contract.id == contract_id)
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    await db.delete(contract)
    await db.commit()
    return MessageResponse(message=f"Contract '{contract.title}' deleted successfully")


@router.post("/{contract_id}/renew", response_model=ContractResponse, status_code=201)
async def renew_contract(
    contract_id: uuid.UUID,
    payload: ContractRenewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager")),
):
    """
    Renew an existing contract:
    - Marks the old contract status as 'RENEWED'
    - Creates a NEW contract record (same vendor/title/terms) with the supplied dates
    - Links the new contract back via renewed_from_contract_id for traceability
    """
    stmt = select(Contract).where(Contract.id == contract_id).options(selectinload(Contract.vendor))
    result = await db.execute(stmt)
    old_contract = result.scalar_one_or_none()
    if not old_contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Normalise dates to naive UTC
    def _naive(dt: datetime) -> datetime:
        return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt

    new_start = _naive(payload.new_start_date)
    new_end = _naive(payload.new_end_date)
    if new_end <= new_start:
        raise HTTPException(status_code=422, detail="new_end_date must be after new_start_date")

    # Mark old contract as RENEWED (not deleted)
    old_contract.status = "RENEWED"

    new_notice = payload.renewal_notice_period_days or int(old_contract.renewal_notice_period_days or 30)
    new_terms = payload.terms if payload.terms is not None else old_contract.terms

    new_contract = Contract(
        vendor_id=old_contract.vendor_id,
        title=old_contract.title,  # keeps same title; can be changed via PUT afterwards
        start_date=new_start,
        end_date=new_end,
        renewal_notice_period_days=Decimal(str(new_notice)),
        terms=new_terms,
        compliance_flags=old_contract.compliance_flags,
        status="ACTIVE",
        renewed_from_contract_id=old_contract.id,
    )
    db.add(new_contract)
    await db.flush()

    vendor = old_contract.vendor
    days_left, risk = _compute_contract_meta(new_contract)
    await add_notification(
        db,
        f"Contract '{old_contract.title}' with '{vendor.company_name if vendor else 'Unknown'}' renewed. "
        f"New term: {new_start.date()} → {new_end.date()} ({days_left} days). Old contract marked RENEWED.",
        notification_type="contract_expiry",
    )

    # Best-effort email + SMS for renewal confirmation
    from app.email_service import send_contract_expiry_email
    from app.sms_service import send_contract_expiry_sms
    if vendor and vendor.contacts:
        vendor_email = vendor.contacts[0].email
        vendor_phone = vendor.contacts[0].phone or ""
        send_contract_expiry_email(vendor_email, vendor.company_name, f"RENEWED: {new_contract.title}", days_left)
        send_contract_expiry_sms(vendor_phone, f"RENEWED: {new_contract.title}", days_left)

    await db.commit()
    stmt_reload = select(Contract).where(Contract.id == new_contract.id).options(selectinload(Contract.vendor))
    reloaded = (await db.execute(stmt_reload)).scalar_one()
    return _map_contract_response(reloaded)


# ---------------------------------------------------------------------------
# Certification Upload Directory (reuses same upload pattern as PO/contract docs)
# ---------------------------------------------------------------------------
CERT_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "certifications")
os.makedirs(CERT_UPLOAD_DIR, exist_ok=True)


def _map_certification_response(cert: Certification, vendor_name: Optional[str] = None) -> CertificationResponse:
    """Maps a Certification ORM object to its response schema."""
    now = datetime.utcnow()
    expiring_soon = False
    if cert.expiry_date:
        exp = cert.expiry_date
        if exp.tzinfo is not None:
            exp = exp.astimezone(timezone.utc).replace(tzinfo=None)
        days_left = (exp - now).days
        expiring_soon = 0 <= days_left <= 30

    return CertificationResponse(
        id=cert.id,
        vendor_id=cert.vendor_id,
        vendor_name=vendor_name or (cert.vendor.company_name if cert.vendor else None),
        certification_name=cert.certification_name,
        issued_date=cert.issued_date,
        expiry_date=cert.expiry_date,
        status=cert.status,
        document_path=cert.document_path,
        created_at=cert.created_at,
        is_expiring_soon=expiring_soon,
    )


# ---------------------------------------------------------------------------
# Certification Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/vendors/{vendor_id}/certifications",
    response_model=CertificationResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Certifications"],
)
async def create_certification(
    vendor_id: uuid.UUID,
    payload: CertificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager")),
):
    """Create a new certification record for a vendor."""
    v_res = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = v_res.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    cert = Certification(
        vendor_id=vendor_id,
        certification_name=payload.certification_name,
        issued_date=payload.issued_date,
        expiry_date=payload.expiry_date,
        status=payload.status or "Valid",
    )
    db.add(cert)
    await db.flush()
    await add_notification(
        db,
        f"New certification '{cert.certification_name}' added for vendor '{vendor.company_name}'.",
    )
    await db.commit()
    await db.refresh(cert)
    return _map_certification_response(cert, vendor_name=vendor.company_name)


@router.get(
    "/vendors/{vendor_id}/certifications",
    response_model=List[CertificationResponse],
    tags=["Certifications"],
)
async def list_certifications(
    vendor_id: uuid.UUID,
    cert_status: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all certifications for a vendor, optionally filtered by status."""
    v_res = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = v_res.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    stmt = select(Certification).where(Certification.vendor_id == vendor_id).order_by(Certification.created_at.desc())
    if cert_status:
        stmt = stmt.where(Certification.status == cert_status)

    result = await db.execute(stmt)
    certs = result.scalars().all()
    return [_map_certification_response(c, vendor_name=vendor.company_name) for c in certs]


@router.patch(
    "/certifications/{cert_id}",
    response_model=CertificationResponse,
    tags=["Certifications"],
)
async def update_certification(
    cert_id: uuid.UUID,
    payload: CertificationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager")),
):
    """Update / renew an existing certification."""
    stmt = select(Certification).where(Certification.id == cert_id)
    result = await db.execute(stmt)
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certification not found")

    if payload.certification_name is not None:
        cert.certification_name = payload.certification_name
    if payload.issued_date is not None:
        cert.issued_date = payload.issued_date
    if payload.expiry_date is not None:
        cert.expiry_date = payload.expiry_date
    if payload.status is not None:
        cert.status = payload.status
    if payload.document_path is not None:
        cert.document_path = payload.document_path

    await db.commit()
    await db.refresh(cert)
    return _map_certification_response(cert)


@router.post(
    "/certifications/{cert_id}/document",
    response_model=CertificationResponse,
    tags=["Certifications"],
)
async def upload_certification_document(
    cert_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager")),
):
    """Upload a document (PDF/image) for a certification, reusing the same local-storage pattern."""
    stmt = select(Certification).where(Certification.id == cert_id)
    result = await db.execute(stmt)
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certification not found")

    file_id = uuid.uuid4().hex[:8]
    safe_filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(CERT_UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    cert.document_path = file_path
    await add_notification(
        db,
        f"Document '{file.filename}' uploaded for certification '{cert.certification_name}'.",
    )
    await db.commit()
    await db.refresh(cert)
    return _map_certification_response(cert)


@router.delete(
    "/certifications/{cert_id}",
    response_model=MessageResponse,
    tags=["Certifications"],
)
async def delete_certification(
    cert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator")),
):
    """Delete a certification record (Administrator only)."""
    stmt = select(Certification).where(Certification.id == cert_id)
    result = await db.execute(stmt)
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certification not found")

    name = cert.certification_name
    await db.delete(cert)
    await db.commit()
    return MessageResponse(message=f"Certification '{name}' deleted successfully")


# ---------------------------------------------------------------------------
# Compliance Monitoring Endpoint
# ---------------------------------------------------------------------------

@router.get(
    "/compliance-summary",
    response_model=ComplianceSummaryResponse,
    tags=["Compliance"],
)
async def get_compliance_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a structured compliance summary per vendor:
    - Certification counts (total, valid, expired, pending renewal, expiring soon)
    - Latest contract compliance_flags
    - Computed overall_compliance_status: Compliant | At Risk | Non-Compliant
    """
    now = datetime.utcnow()
    expiry_threshold = now + timedelta(days=30)

    # Fetch all active vendors
    vendors_result = await db.execute(select(Vendor).order_by(Vendor.company_name))
    vendors = vendors_result.scalars().all()

    # Fetch all certifications grouped by vendor_id
    certs_result = await db.execute(select(Certification))
    all_certs = certs_result.scalars().all()
    certs_by_vendor: dict[uuid.UUID, list[Certification]] = {}
    for c in all_certs:
        certs_by_vendor.setdefault(c.vendor_id, []).append(c)

    # Fetch all contracts to get latest compliance flags per vendor
    contracts_result = await db.execute(select(Contract).order_by(Contract.created_at.desc()))
    all_contracts = contracts_result.scalars().all()
    latest_contract_by_vendor: dict[uuid.UUID, Contract] = {}
    for con in all_contracts:
        if con.vendor_id not in latest_contract_by_vendor:
            latest_contract_by_vendor[con.vendor_id] = con

    vendor_summaries: List[VendorComplianceSummary] = []
    compliant_count = 0
    at_risk_count = 0
    non_compliant_count = 0

    for vendor in vendors:
        vendor_certs = certs_by_vendor.get(vendor.id, [])
        total = len(vendor_certs)
        valid = sum(1 for c in vendor_certs if c.status == "Valid")
        expired = sum(1 for c in vendor_certs if c.status == "Expired")
        pending = sum(1 for c in vendor_certs if c.status == "Pending Renewal")
        expiring_soon = 0
        for c in vendor_certs:
            if c.expiry_date:
                exp = c.expiry_date
                if exp.tzinfo is not None:
                    exp = exp.astimezone(timezone.utc).replace(tzinfo=None)
                if now <= exp <= expiry_threshold:
                    expiring_soon += 1

        latest_contract = latest_contract_by_vendor.get(vendor.id)
        compliance_flags = latest_contract.compliance_flags if latest_contract else None
        contract_status = latest_contract.status if latest_contract else None

        # Determine overall compliance status
        has_bad_flag = bool(
            compliance_flags
            and any(
                w in compliance_flags.lower()
                for w in ["breach", "penalty", "violation", "non-compliant", "audit_failed"]
            )
        )
        if expired > 0 or has_bad_flag:
            overall = "Non-Compliant"
            non_compliant_count += 1
        elif expiring_soon > 0 or pending > 0:
            overall = "At Risk"
            at_risk_count += 1
        else:
            overall = "Compliant"
            compliant_count += 1

        vendor_summaries.append(
            VendorComplianceSummary(
                vendor_id=vendor.id,
                vendor_name=vendor.company_name,
                category=vendor.category,
                vendor_status=vendor.status,
                total_certifications=total,
                valid_certifications=valid,
                expired_certifications=expired,
                pending_renewal_certifications=pending,
                expiring_soon_certifications=expiring_soon,
                compliance_flags=compliance_flags,
                contract_status=contract_status,
                overall_compliance_status=overall,
            )
        )

    return ComplianceSummaryResponse(
        total_vendors=len(vendors),
        compliant=compliant_count,
        at_risk=at_risk_count,
        non_compliant=non_compliant_count,
        vendors=vendor_summaries,
    )
