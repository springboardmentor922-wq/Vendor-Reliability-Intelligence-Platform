"""Vendor application (multi-step registration form).

The public "Register as a vendor" wizard and the internal "New vendor
registration" screen both submit here. A single multipart request carries
the application as JSON plus any supporting documents, so the vendor record,
its contacts, certifications and documents are created in one transaction.

Every application lands in the ``Pending`` approval queue - the approval
workflow in ``api/vendors.py`` is unchanged.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import date
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field, ValidationError, field_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import bearer_scheme
from models import (
    NotificationType,
    User,
    UserRole,
    Vendor,
    VendorApproval,
    VendorCategory,
    VendorCertification,
    VendorContact,
    VendorDocument,
    VendorStatus
)
from security import ACCESS_TOKEN, create_access_token, create_refresh_token, decode_token, hash_password
from services.events import log_activity, notify_roles
from services.numbering import next_vendor_code

router = APIRouter(prefix="/vendor-applications", tags=["Vendor Applications"])

MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".xlsx", ".xls", ".csv", ".txt"}

COMPANY_TYPES = [
    "Private Limited",
    "Public Limited",
    "Limited Liability Partnership",
    "Partnership",
    "Sole Proprietorship",
    "Government / PSU",
    "Other",
]

DOCUMENT_TYPES = [
    "Certificate of Incorporation",
    "Tax Registration Certificate",
    "Company Profile",
    "Quality Certification",
    "Cancelled Cheque / Bank Letter",
    "Other",
]


# ---------------------------------------------------------------------------
# Payload
# ---------------------------------------------------------------------------

class ApplicationContact(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    designation: Optional[str] = Field(default=None, max_length=100)
    department: Optional[str] = Field(default=None, max_length=100)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=30)
    is_primary: bool = False


class ApplicationCertification(BaseModel):
    certification_name: str = Field(min_length=2, max_length=150)
    issuing_authority: Optional[str] = Field(default=None, max_length=150)
    certificate_number: Optional[str] = Field(default=None, max_length=80)
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None


class VendorApplication(BaseModel):
    # Step 1 - company
    vendor_name: str = Field(min_length=2, max_length=150)
    company_type: Optional[str] = Field(default=None, max_length=60)
    registration_number: Optional[str] = Field(default=None, max_length=60)
    tax_id: Optional[str] = Field(default=None, max_length=60)
    year_established: Optional[int] = Field(default=None, ge=1800, le=2100)
    employee_count: Optional[str] = Field(default=None, max_length=30)
    annual_turnover: Optional[str] = Field(default=None, max_length=60)
    website: Optional[str] = Field(default=None, max_length=255)

    # Step 2 - business
    category: str
    products_services: str = Field(min_length=3)

    # Step 3 - address & contacts
    email: EmailStr
    phone: str = Field(min_length=5, max_length=30)
    address: str = Field(min_length=3)
    city: str = Field(min_length=2, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    country: str = Field(min_length=2, max_length=100)
    contacts: list[ApplicationContact] = Field(min_length=1)

    # Step 4 - compliance
    certifications: list[ApplicationCertification] = []

    # Step 5 - portal account (public applications only)
    account_name: Optional[str] = Field(default=None, max_length=100)
    account_email: Optional[EmailStr] = None
    account_password: Optional[str] = Field(default=None, min_length=8, max_length=72)

    notes: Optional[str] = None
    declaration_accepted: bool

    @field_validator("category")
    @classmethod
    def valid_category(cls, value: str) -> str:
        if value not in VendorCategory.ALL:
            raise ValueError(f"category must be one of: {', '.join(VendorCategory.ALL)}")
        return value

    @field_validator("declaration_accepted")
    @classmethod
    def must_accept(cls, value: bool) -> bool:
        if not value:
            raise ValueError("The declaration must be accepted to submit the application")
        return value


class ApplicationResult(BaseModel):
    vendor_id: int
    vendor_code: str
    vendor_name: str
    status: str
    documents_received: int
    certifications_recorded: int
    account_created: bool
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    message: str


class ApplicationOptions(BaseModel):
    categories: list[str]
    company_types: list[str]
    document_types: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """The signed-in user if a valid token was sent, otherwise ``None``."""

    if credentials is None or not credentials.credentials:
        return None

    try:
        payload = decode_token(credentials.credentials)
    except jwt.PyJWTError:
        return None

    if payload.get("type") != ACCESS_TOKEN or not payload.get("sub"):
        return None

    user = db.query(User).filter(User.id == int(payload["sub"])).first()

    return user if user and user.is_active else None


def _duplicate_check(db: Session, application: VendorApplication) -> None:
    checks = [func.lower(Vendor.vendor_name) == application.vendor_name.strip().lower()]

    if application.registration_number:
        checks.append(Vendor.registration_number == application.registration_number.strip())

    if application.tax_id:
        checks.append(Vendor.tax_id == application.tax_id.strip())

    existing = db.query(Vendor).filter(or_(*checks)).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"A vendor with the same name, registration number or tax ID "
                f"already exists ({existing.vendor_code}, status {existing.status})."
            ),
        )


async def _store_document(upload: UploadFile) -> tuple[str, int]:
    extension = os.path.splitext(upload.filename or "")[1].lower()[:10]

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{upload.filename}' is not an accepted document type.",
        )

    contents = await upload.read()

    if len(contents) > MAX_DOCUMENT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"'{upload.filename}' is larger than 10 MB.",
        )

    stored_name = f"vendor-doc-{uuid.uuid4().hex}{extension}"

    with open(os.path.join(settings.UPLOAD_DIR, stored_name), "wb") as handle:
        handle.write(contents)

    return stored_name, len(contents)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/options", response_model=ApplicationOptions)
def options():
    """Drop-down values for the application form (public)."""

    return ApplicationOptions(
        categories=VendorCategory.ALL,
        company_types=COMPANY_TYPES,
        document_types=DOCUMENT_TYPES,
    )


@router.post("", response_model=ApplicationResult, status_code=status.HTTP_201_CREATED)
async def submit_application(
    payload: str = Form(..., description="The application as a JSON string"),
    files: list[UploadFile] = File(default=[]),
    document_types: list[str] = Form(default=[]),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(_optional_user),
):
    try:
        application = VendorApplication.model_validate(json.loads(payload))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="The application payload is not valid JSON")
    except ValidationError as exc:
        first = exc.errors()[0]
        field = ".".join(str(part) for part in first.get("loc", []))
        raise HTTPException(status_code=422, detail=f"{field}: {first.get('msg')}")

    internal = current_user is not None and current_user.role in UserRole.INTERNAL_STAFF

    if current_user is not None and not internal:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Signed-in vendor accounts cannot submit a new vendor application.",
        )

    _duplicate_check(db, application)

    wants_account = not internal and application.account_email and application.account_password

    if wants_account and db.query(User).filter(User.email == application.account_email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user account with that login email already exists.",
        )

    primary = next((c for c in application.contacts if c.is_primary), application.contacts[0])

    vendor = Vendor(
        vendor_code=next_vendor_code(db),
        vendor_name=application.vendor_name.strip(),
        category=application.category,
        contact_person=primary.name,
        email=str(application.email),
        phone=application.phone,
        website=application.website,
        address=application.address,
        city=application.city,
        state=application.state,
        postal_code=application.postal_code,
        country=application.country,
        tax_id=application.tax_id,
        registration_number=application.registration_number,
        company_type=application.company_type,
        year_established=application.year_established,
        employee_count=application.employee_count,
        annual_turnover=application.annual_turnover,
        products_services=application.products_services,
        application_source="Internal" if internal else "Vendor Portal",
        notes=application.notes,
        status=VendorStatus.PENDING,
        risk_level="Medium",
        created_by=current_user.id if internal else None,
    )

    db.add(vendor)
    db.flush()

    for contact in application.contacts:
        designation = contact.designation
        if contact.department:
            designation = f"{designation or 'Contact'} - {contact.department}"

        db.add(VendorContact(
            vendor_id=vendor.id,
            name=contact.name,
            designation=designation,
            email=contact.email,
            phone=contact.phone,
            is_primary=contact is primary,
        ))

    today = date.today()

    for cert in application.certifications:
        db.add(VendorCertification(
            vendor_id=vendor.id,
            certification_name=cert.certification_name,
            issuing_authority=cert.issuing_authority,
            certificate_number=cert.certificate_number,
            issue_date=cert.issue_date,
            expiry_date=cert.expiry_date,
            status="Expired" if cert.expiry_date and cert.expiry_date < today else "Valid",
        ))

    stored = 0

    for index, upload in enumerate(files or []):
        if not upload.filename:
            continue

        path, size = await _store_document(upload)
        doc_type = document_types[index] if index < len(document_types) else "Other"

        db.add(VendorDocument(
            vendor_id=vendor.id,
            document_type=doc_type or "Other",
            file_name=upload.filename,
            file_path=path,
            file_size=size,
            content_type=upload.content_type,
            status="Submitted",
        ))
        stored += 1

    db.add(VendorApproval(
        vendor_id=vendor.id,
        action="Submitted",
        previous_status=None,
        new_status=VendorStatus.PENDING,
        performed_by=current_user.id if internal else None,
        comments=(
            f"Application submitted via {vendor.application_source} with "
            f"{stored} document(s) and {len(application.certifications)} certification(s)"
        ),
    ))

    account = None

    if wants_account:
        account = User(
            name=application.account_name or primary.name,
            email=str(application.account_email),
            password_hash=hash_password(application.account_password),
            role=UserRole.VENDOR,
            phone=primary.phone,
            job_title=primary.designation,
            vendor_id=vendor.id,
            is_active=True,
        )
        db.add(account)
        db.flush()

    log_activity(
        db,
        current_user.id if internal else (account.id if account else None),
        "Vendor",
        vendor.id,
        "Application Submitted",
        f"Vendor application for '{vendor.vendor_name}' ({vendor.vendor_code}) "
        f"received via {vendor.application_source}",
    )

    notify_roles(
        db,
        [UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER],
        NotificationType.VENDOR_APPROVAL,
        "New vendor application",
        f"{vendor.vendor_name} ({vendor.vendor_code}, {vendor.category}) submitted "
        f"a registration application with {stored} document(s).",
        link=f"/vendors/{vendor.id}",
        priority="High",
        exclude_user_id=current_user.id if internal else None,
    )

    db.commit()
    db.refresh(vendor)

    result = ApplicationResult(
        vendor_id=vendor.id,
        vendor_code=vendor.vendor_code,
        vendor_name=vendor.vendor_name,
        status=vendor.status,
        documents_received=stored,
        certifications_recorded=len(application.certifications),
        account_created=account is not None,
        message=(
            f"Application {vendor.vendor_code} received. It is now in the approval "
            f"queue; you will be notified once it has been reviewed."
        ),
    )

    if account is not None:
        db.refresh(account)
        result.access_token = create_access_token(account.id, account.role, account.email)
        result.refresh_token = create_refresh_token(account.id)

    return result
