from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from database import get_db

from models import (
    User,
    Vendor,
    Contract,
    ComplianceDocument,
    Certification,
    VendorDocument,
)

from auth import get_current_user, require_role

from notification_service import (
    notify_user,
    notify_role,
    notify_roles,
)


router = APIRouter(
    prefix="/contract-compliance",
    tags=["Contract & Compliance"],
)


# ============================================================
# ROLE GROUPS
# ============================================================

ADMIN_ROLES = [
    "administrator",
]

MANAGEMENT_ROLES = [
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
]

DOCUMENT_MANAGEMENT_ROLES = [
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
]

ALL_INTERNAL_ROLES = [
    "administrator",
    "procurement_manager",
    "supply_chain_manager",
    "finance_officer",
    "auditor",
]


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_vendor_for_user(
    current_user: User,
    db: Session,
):
    """
    Returns the vendor linked to the logged-in vendor user.
    """
    if current_user.role != "vendor":
        return None

    vendor = (
        db.query(Vendor)
        .filter(Vendor.user_id == current_user.id)
        .first()
    )

    return vendor


def check_vendor_access(
    vendor_id: int,
    current_user: User,
    db: Session,
):
    """
    Internal users can access all vendors.
    Vendor users can access only their own vendor record.
    """

    if current_user.role != "vendor":
        return True

    vendor = get_vendor_for_user(
        current_user,
        db,
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor profile not found",
        )

    if vendor.id != vendor_id:
        raise HTTPException(
            status_code=403,
            detail="You can access only your own vendor information",
        )

    return True


def calculate_document_status(expiry_date):
    """
    Calculates compliance/certification status from expiry date.
    """

    if not expiry_date:
        return "pending"

    today = date.today()

    if expiry_date < today:
        return "expired"

    if expiry_date <= today + timedelta(days=30):
        return "expiring"

    return "valid"


def calculate_contract_status(
    end_date,
    current_status=None,
):
    """
    Calculates contract status for display.

    Database Contract.status supports:
    draft, active, expired, terminated

    'expiring' is calculated only for API display.
    """

    if current_status == "terminated":
        return "terminated"

    if current_status == "draft":
        return "draft"

    if not end_date:
        return current_status or "draft"

    today = date.today()

    if end_date < today:
        return "expired"

    if end_date <= today + timedelta(days=30):
        return "expiring"

    return "active"


# ============================================================
# OVERVIEW
# ============================================================

@router.get("/overview")
def get_contract_compliance_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Contract & Compliance dashboard summary.
    """

    contracts = db.query(Contract).all()
    compliance_documents = db.query(ComplianceDocument).all()
    certifications = db.query(Certification).all()
    vendor_documents = db.query(VendorDocument).all()

    # Vendor access filtering
    if current_user.role == "vendor":

        vendor = get_vendor_for_user(
            current_user,
            db,
        )

        if not vendor:
            return {
                "contracts": 0,
                "active_contracts": 0,
                "expiring_contracts": 0,
                "expired_contracts": 0,
                "compliance_documents": 0,
                "valid_documents": 0,
                "expiring_documents": 0,
                "expired_documents": 0,
                "certifications": 0,
                "valid_certifications": 0,
                "expiring_certifications": 0,
                "expired_certifications": 0,
                "vendor_documents": 0,
            }

        contracts = [
            item
            for item in contracts
            if item.vendor_id == vendor.id
        ]

        compliance_documents = [
            item
            for item in compliance_documents
            if item.vendor_id == vendor.id
        ]

        certifications = [
            item
            for item in certifications
            if item.vendor_id == vendor.id
        ]

        vendor_documents = [
            item
            for item in vendor_documents
            if item.vendor_id == vendor.id
        ]

    contract_statuses = [
        calculate_contract_status(
            item.end_date,
            item.status,
        )
        for item in contracts
    ]

    document_statuses = [
        calculate_document_status(item.expiry_date)
        for item in compliance_documents
    ]

    certification_statuses = [
        calculate_document_status(item.expiry_date)
        for item in certifications
    ]

    return {
        "contracts": len(contracts),
        "active_contracts": contract_statuses.count("active"),
        "expiring_contracts": contract_statuses.count("expiring"),
        "expired_contracts": contract_statuses.count("expired"),

        "compliance_documents": len(compliance_documents),
        "valid_documents": document_statuses.count("valid"),
        "expiring_documents": document_statuses.count("expiring"),
        "expired_documents": document_statuses.count("expired"),

        "certifications": len(certifications),
        "valid_certifications": certification_statuses.count("valid"),
        "expiring_certifications": certification_statuses.count("expiring"),
        "expired_certifications": certification_statuses.count("expired"),

        "vendor_documents": len(vendor_documents),
    }


# ============================================================
# CONTRACT REPOSITORY
# ============================================================

@router.get("/contracts")
def get_contracts(
    vendor_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get contracts.
    """

    query = db.query(Contract)

    if current_user.role == "vendor":

        vendor = get_vendor_for_user(
            current_user,
            db,
        )

        if not vendor:
            return []

        query = query.filter(
            Contract.vendor_id == vendor.id
        )

    elif vendor_id is not None:

        query = query.filter(
            Contract.vendor_id == vendor_id
        )

    if status:

        if status == "expiring":

            today = date.today()
            expiry_limit = today + timedelta(days=30)

            query = query.filter(
                Contract.end_date >= today,
                Contract.end_date <= expiry_limit,
            )

        else:

            query = query.filter(
                Contract.status == status
            )

    contracts = query.order_by(
        Contract.end_date.asc()
    ).all()

    result = []

    for contract in contracts:

        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == contract.vendor_id)
            .first()
        )

        result.append(
            {
                "id": contract.id,
                "contract_number": contract.contract_number,
                "vendor_id": contract.vendor_id,
                "vendor_name": (
                    vendor.company_name
                    if vendor
                    else "Unknown Vendor"
                ),
                "title": contract.title,
                "description": contract.description,
                "start_date": contract.start_date,
                "end_date": contract.end_date,
                "contract_value": float(
                    contract.contract_value or 0
                ),
                "status": calculate_contract_status(
                    contract.end_date,
                    contract.status,
                ),
                "database_status": contract.status,
                "created_at": contract.created_at,
            }
        )

    return result


# ============================================================
# CONTRACT ALERTS
# ============================================================

@router.get("/contracts/alerts")
def get_contract_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Contracts expiring within 30 days or already expired.
    """

    query = db.query(Contract)

    if current_user.role == "vendor":

        vendor = get_vendor_for_user(
            current_user,
            db,
        )

        if not vendor:
            return []

        query = query.filter(
            Contract.vendor_id == vendor.id
        )

    contracts = query.all()

    today = date.today()
    alert_limit = today + timedelta(days=30)

    result = []

    for contract in contracts:

        if not contract.end_date:
            continue

        if contract.end_date < today:

            alert_type = "expired"
            days_remaining = 0

        elif contract.end_date <= alert_limit:

            alert_type = "expiring"

            days_remaining = (
                contract.end_date - today
            ).days

        else:
            continue

        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == contract.vendor_id)
            .first()
        )

        result.append(
            {
                "id": contract.id,
                "contract_number": contract.contract_number,
                "title": contract.title,
                "vendor_id": contract.vendor_id,
                "vendor_name": (
                    vendor.company_name
                    if vendor
                    else "Unknown Vendor"
                ),
                "end_date": contract.end_date,
                "alert_type": alert_type,
                "days_remaining": days_remaining,
            }
        )

    return result


# ============================================================
# CREATE CONTRACT
# ============================================================

@router.post("/contracts")
def create_contract(
    contract_number: str = Body(...),
    vendor_id: int = Body(...),
    title: str = Body(...),
    start_date: date = Body(...),
    end_date: date = Body(...),
    contract_value: float = Body(0),
    description: str | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new contract.
    """

    if current_user.role not in MANAGEMENT_ROLES:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to create contracts",
        )

    if end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail="End date cannot be earlier than start date",
        )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail=f"Vendor with ID {vendor_id} not found",
        )

    existing_contract = (
        db.query(Contract)
        .filter(
            Contract.contract_number == contract_number
        )
        .first()
    )

    if existing_contract:
        raise HTTPException(
            status_code=400,
            detail="Contract number already exists",
        )

    contract = Contract(
        contract_number=contract_number,
        vendor_id=vendor_id,
        title=title,
        description=description,
        start_date=start_date,
        end_date=end_date,
        contract_value=contract_value,
        status="active",
    )

    db.add(contract)

    # Generate contract ID before notifications
    db.flush()

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    if vendor.user_id:

        notify_user(
            db,
            vendor.user_id,
            "New Contract Created",
            f"Contract {contract.contract_number} has been created for your company.",
            "contract",
        )

    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
        ],
        "New Contract Created",
        f"Contract {contract.contract_number} has been created for {vendor.company_name}.",
        "contract",
    )

    db.commit()
    db.refresh(contract)

    return {
        "message": "Contract created successfully",
        "contract": {
            "id": contract.id,
            "contract_number": contract.contract_number,
            "vendor_id": contract.vendor_id,
            "title": contract.title,
            "description": contract.description,
            "start_date": contract.start_date,
            "end_date": contract.end_date,
            "contract_value": float(
                contract.contract_value or 0
            ),
            "status": contract.status,
        },
    }


# ============================================================
# GET SINGLE CONTRACT
# ============================================================

@router.get("/contracts/{contract_id}")
def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get one contract.
    """

    contract = (
        db.query(Contract)
        .filter(Contract.id == contract_id)
        .first()
    )

    if not contract:
        raise HTTPException(
            status_code=404,
            detail="Contract not found",
        )

    check_vendor_access(
        contract.vendor_id,
        current_user,
        db,
    )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == contract.vendor_id)
        .first()
    )

    return {
        "id": contract.id,
        "contract_number": contract.contract_number,
        "vendor_id": contract.vendor_id,
        "vendor_name": (
            vendor.company_name
            if vendor
            else "Unknown Vendor"
        ),
        "title": contract.title,
        "description": contract.description,
        "start_date": contract.start_date,
        "end_date": contract.end_date,
        "contract_value": float(
            contract.contract_value or 0
        ),
        "status": calculate_contract_status(
            contract.end_date,
            contract.status,
        ),
        "database_status": contract.status,
        "created_at": contract.created_at,
    }


# ============================================================
# RENEW CONTRACT
# ============================================================

@router.put("/contracts/{contract_id}/renew")
def renew_contract(
    contract_id: int,
    new_end_date: date = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
        )
    ),
):
    """
    Renew a contract.
    """

    contract = (
        db.query(Contract)
        .filter(Contract.id == contract_id)
        .first()
    )

    if not contract:
        raise HTTPException(
            status_code=404,
            detail="Contract not found",
        )

    if not contract.end_date:
        raise HTTPException(
            status_code=400,
            detail="Current contract has no end date",
        )

    if new_end_date <= contract.end_date:
        raise HTTPException(
            status_code=400,
            detail="New end date must be later than current end date",
        )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == contract.vendor_id)
        .first()
    )

    contract.end_date = new_end_date
    contract.status = "active"

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    if vendor and vendor.user_id:

        notify_user(
            db,
            vendor.user_id,
            "Contract Renewed",
            f"Contract {contract.contract_number} has been renewed until {new_end_date}.",
            "contract",
        )

    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
        ],
        "Contract Renewed",
        f"Contract {contract.contract_number} has been renewed until {new_end_date}.",
        "contract",
    )

    db.commit()
    db.refresh(contract)

    return {
        "message": "Contract renewed successfully",
        "contract_id": contract.id,
        "contract_number": contract.contract_number,
        "new_end_date": contract.end_date,
        "status": calculate_contract_status(
            contract.end_date,
            contract.status,
        ),
    }


# ============================================================
# UPDATE CONTRACT
# ============================================================

@router.put("/contracts/{contract_id}")
def update_contract(
    contract_id: int,
    title: str | None = Body(None),
    description: str | None = Body(None),
    start_date: date | None = Body(None),
    end_date: date | None = Body(None),
    contract_value: float | None = Body(None),
    status: str | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
        )
    ),
):
    """
    Update contract information.
    """

    contract = (
        db.query(Contract)
        .filter(Contract.id == contract_id)
        .first()
    )

    if not contract:
        raise HTTPException(
            status_code=404,
            detail="Contract not found",
        )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == contract.vendor_id)
        .first()
    )

    if title is not None:
        contract.title = title

    if description is not None:
        contract.description = description

    if start_date is not None:
        contract.start_date = start_date

    if end_date is not None:
        contract.end_date = end_date

    if contract.start_date and contract.end_date:

        if contract.end_date < contract.start_date:
            raise HTTPException(
                status_code=400,
                detail="End date cannot be before start date",
            )

    if contract_value is not None:
        contract.contract_value = contract_value

    if status is not None:

        allowed_statuses = [
            "draft",
            "active",
            "expired",
            "terminated",
        ]

        if status not in allowed_statuses:
            raise HTTPException(
                status_code=400,
                detail="Invalid contract status",
            )

        contract.status = status

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    if vendor and vendor.user_id:

        notify_user(
            db,
            vendor.user_id,
            "Contract Updated",
            f"Contract {contract.contract_number} has been updated.",
            "contract",
        )

    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
        ],
        "Contract Updated",
        f"Contract {contract.contract_number} has been updated.",
        "contract",
    )

    db.commit()
    db.refresh(contract)

    return {
        "message": "Contract updated successfully",
        "contract_id": contract.id,
        "contract_number": contract.contract_number,
        "status": calculate_contract_status(
            contract.end_date,
            contract.status,
        ),
    }


# ============================================================
# DELETE CONTRACT
# ============================================================

@router.delete("/contracts/{contract_id}")
def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("administrator")
    ),
):
    """
    Delete contract.
    """

    contract = (
        db.query(Contract)
        .filter(Contract.id == contract_id)
        .first()
    )

    if not contract:
        raise HTTPException(
            status_code=404,
            detail="Contract not found",
        )

    db.delete(contract)
    db.commit()

    return {
        "message": "Contract deleted successfully"
    }


# ============================================================
# COMPLIANCE DOCUMENTS
# ============================================================

@router.get("/compliance")
def get_compliance_documents(
    vendor_id: int | None = None,
    status: str | None = None,
    verification_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get vendor compliance documents.
    """

    query = db.query(ComplianceDocument)

    if current_user.role == "vendor":

        vendor = get_vendor_for_user(
            current_user,
            db,
        )

        if not vendor:
            return []

        query = query.filter(
            ComplianceDocument.vendor_id == vendor.id
        )

    elif vendor_id is not None:

        query = query.filter(
            ComplianceDocument.vendor_id == vendor_id
        )

    if verification_status:

        query = query.filter(
            ComplianceDocument.verification_status
            == verification_status
        )

    documents = query.order_by(
        ComplianceDocument.expiry_date.asc()
    ).all()

    result = []

    for document in documents:

        calculated_status = calculate_document_status(
            document.expiry_date
        )

        if status and calculated_status != status:
            continue

        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == document.vendor_id)
            .first()
        )

        result.append(
            {
                "id": document.id,
                "vendor_id": document.vendor_id,
                "vendor_name": (
                    vendor.company_name
                    if vendor
                    else "Unknown Vendor"
                ),
                "document_name": document.document_name,
                "document_type": document.document_type,
                "document_number": document.document_number,
                "issue_date": document.issue_date,
                "expiry_date": document.expiry_date,
                "status": calculated_status,
                "verification_status": document.verification_status,
                "file_name": document.file_name,
                "file_path": document.file_path,
                "remarks": document.remarks,
                "uploaded_by": document.uploaded_by,
                "created_at": document.created_at,
                "updated_at": document.updated_at,
            }
        )

    return result


# ============================================================
# CREATE COMPLIANCE DOCUMENT
# ============================================================

@router.post("/compliance")
def create_compliance_document(
    vendor_id: int = Body(...),
    document_name: str = Body(...),
    document_type: str = Body(...),
    document_number: str = Body(...),
    issue_date: date = Body(...),
    expiry_date: date = Body(...),
    file_name: str | None = Body(None),
    file_path: str | None = Body(None),
    remarks: str | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
            "vendor",
        )
    ),
):
    """
    Create compliance document.
    """

    check_vendor_access(
        vendor_id,
        current_user,
        db,
    )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    if expiry_date < issue_date:
        raise HTTPException(
            status_code=400,
            detail="Expiry date cannot be before issue date",
        )

    allowed_types = [
        "GST Certificate",
        "PAN Card",
        "Tax Certificate",
        "Quality Certificate",
        "Safety Certificate",
        "Environmental Certificate",
        "ISO Certificate",
        "Business License",
        "Other",
    ]

    if document_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid document type",
        )

    document = ComplianceDocument(
        vendor_id=vendor_id,
        document_name=document_name,
        document_type=document_type,
        document_number=document_number,
        issue_date=issue_date,
        expiry_date=expiry_date,
        status=calculate_document_status(expiry_date),
        verification_status="pending",
        file_name=file_name,
        file_path=file_path,
        remarks=remarks,
        uploaded_by=current_user.id,
    )

    db.add(document)

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    db.flush()

    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
        ],
        "New Compliance Document",
        f"Compliance document '{document.document_name}' has been submitted for {vendor.company_name}.",
        "compliance",
    )

    # Vendor should receive confirmation only when
    # an internal user created the document.
    if (
        vendor.user_id
        and vendor.user_id != current_user.id
    ):

        notify_user(
            db,
            vendor.user_id,
            "Compliance Document Added",
            f"Compliance document '{document.document_name}' has been added to your vendor profile.",
            "compliance",
        )

    db.commit()
    db.refresh(document)

    return {
        "message": "Compliance document created successfully",
        "document_id": document.id,
        "status": calculate_document_status(
            document.expiry_date
        ),
        "verification_status": document.verification_status,
    }


# ============================================================
# VERIFY COMPLIANCE DOCUMENT
# ============================================================

@router.put("/compliance/{document_id}/verify")
def verify_compliance_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
        )
    ),
):
    """
    Verify compliance document.
    """

    document = (
        db.query(ComplianceDocument)
        .filter(
            ComplianceDocument.id == document_id
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Compliance document not found",
        )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == document.vendor_id)
        .first()
    )

    document.verification_status = "verified"

    document.status = calculate_document_status(
        document.expiry_date
    )

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    if vendor and vendor.user_id:

        notify_user(
            db,
            vendor.user_id,
            "Compliance Document Verified",
            f"Your compliance document '{document.document_name}' has been verified.",
            "compliance",
        )

    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
        ],
        "Compliance Document Verified",
        f"Compliance document '{document.document_name}' for {vendor.company_name if vendor else 'vendor'} has been verified.",
        "compliance",
    )

    db.commit()
    db.refresh(document)

    return {
        "message": "Compliance document verified successfully",
        "document_id": document.id,
        "verification_status": document.verification_status,
        "status": document.status,
    }


# ============================================================
# REJECT COMPLIANCE DOCUMENT
# ============================================================

@router.put("/compliance/{document_id}/reject")
def reject_compliance_document(
    document_id: int,
    remarks: str | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
        )
    ),
):
    """
    Reject compliance document.
    """

    document = (
        db.query(ComplianceDocument)
        .filter(
            ComplianceDocument.id == document_id
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Compliance document not found",
        )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == document.vendor_id)
        .first()
    )

    document.verification_status = "rejected"

    if remarks is not None:
        document.remarks = remarks

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    if vendor and vendor.user_id:

        notify_user(
            db,
            vendor.user_id,
            "Compliance Document Rejected",
            f"Your compliance document '{document.document_name}' has been rejected. Reason: {remarks or 'No reason provided'}",
            "compliance",
        )

    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
        ],
        "Compliance Document Rejected",
        f"Compliance document '{document.document_name}' has been rejected.",
        "compliance",
    )

    db.commit()
    db.refresh(document)

    return {
        "message": "Compliance document rejected",
        "document_id": document.id,
        "verification_status": document.verification_status,
    }


# ============================================================
# UPDATE COMPLIANCE DOCUMENT
# ============================================================

@router.put("/compliance/{document_id}")
def update_compliance_document(
    document_id: int,
    document_name: str | None = Body(None),
    document_number: str | None = Body(None),
    issue_date: date | None = Body(None),
    expiry_date: date | None = Body(None),
    file_name: str | None = Body(None),
    file_path: str | None = Body(None),
    remarks: str | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
            "vendor",
        )
    ),
):
    """
    Update compliance document.
    """

    document = (
        db.query(ComplianceDocument)
        .filter(
            ComplianceDocument.id == document_id
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Compliance document not found",
        )

    check_vendor_access(
        document.vendor_id,
        current_user,
        db,
    )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == document.vendor_id)
        .first()
    )

    if document_name is not None:
        document.document_name = document_name

    if document_number is not None:
        document.document_number = document_number

    if issue_date is not None:
        document.issue_date = issue_date

    if expiry_date is not None:
        document.expiry_date = expiry_date

    if (
        document.issue_date
        and document.expiry_date
        and document.expiry_date < document.issue_date
    ):
        raise HTTPException(
            status_code=400,
            detail="Expiry date cannot be before issue date",
        )

    if file_name is not None:
        document.file_name = file_name

    if file_path is not None:
        document.file_path = file_path

    if remarks is not None:
        document.remarks = remarks

    document.status = calculate_document_status(
        document.expiry_date
    )

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    if vendor and vendor.user_id:
        if vendor.user_id != current_user.id:

            notify_user(
                db,
                vendor.user_id,
                "Compliance Document Updated",
                f"Your compliance document '{document.document_name}' has been updated.",
                "compliance",
            )

    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
        ],
        "Compliance Document Updated",
        f"Compliance document '{document.document_name}' has been updated.",
        "compliance",
    )

    db.commit()
    db.refresh(document)

    return {
        "message": "Compliance document updated successfully",
        "document_id": document.id,
        "status": document.status,
        "verification_status": document.verification_status,
    }


# ============================================================
# DELETE COMPLIANCE DOCUMENT
# ============================================================

@router.delete("/compliance/{document_id}")
def delete_compliance_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("administrator")
    ),
):
    """
    Delete compliance document.
    """

    document = (
        db.query(ComplianceDocument)
        .filter(
            ComplianceDocument.id == document_id
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Compliance document not found",
        )

    db.delete(document)
    db.commit()

    return {
        "message": "Compliance document deleted successfully"
    }


# ============================================================
# CERTIFICATIONS
# ============================================================

@router.get("/certifications")
def get_certifications(
    vendor_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get vendor certifications.
    """

    query = db.query(Certification)

    if current_user.role == "vendor":

        vendor = get_vendor_for_user(
            current_user,
            db,
        )

        if not vendor:
            return []

        query = query.filter(
            Certification.vendor_id == vendor.id
        )

    elif vendor_id is not None:

        query = query.filter(
            Certification.vendor_id == vendor_id
        )

    certifications = query.order_by(
        Certification.expiry_date.asc()
    ).all()

    result = []

    for certification in certifications:

        calculated_status = calculate_document_status(
            certification.expiry_date
        )

        if status and calculated_status != status:
            continue

        vendor = (
            db.query(Vendor)
            .filter(
                Vendor.id == certification.vendor_id
            )
            .first()
        )

        result.append(
            {
                "id": certification.id,
                "vendor_id": certification.vendor_id,
                "vendor_name": (
                    vendor.company_name
                    if vendor
                    else "Unknown Vendor"
                ),
                "certification_name": certification.certification_name,
                "certification_type": certification.certification_type,
                "certificate_number": certification.certificate_number,
                "issuing_authority": certification.issuing_authority,
                "issue_date": certification.issue_date,
                "expiry_date": certification.expiry_date,
                "status": calculated_status,
                "file_name": certification.file_name,
                "file_path": certification.file_path,
                "remarks": certification.remarks,
                "created_by": certification.created_by,
                "created_at": certification.created_at,
                "updated_at": certification.updated_at,
            }
        )

    return result


# ============================================================
# CREATE CERTIFICATION
# ============================================================

@router.post("/certifications")
def create_certification(
    vendor_id: int = Body(...),
    certification_name: str = Body(...),
    certification_type: str = Body(...),
    certificate_number: str = Body(...),
    issuing_authority: str = Body(...),
    issue_date: date = Body(...),
    expiry_date: date = Body(...),
    file_name: str | None = Body(None),
    file_path: str | None = Body(None),
    remarks: str | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
            "vendor",
        )
    ),
):
    """
    Create certification.
    """

    check_vendor_access(
        vendor_id,
        current_user,
        db,
    )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    if expiry_date < issue_date:
        raise HTTPException(
            status_code=400,
            detail="Expiry date cannot be before issue date",
        )

    certification = Certification(
        vendor_id=vendor_id,
        certification_name=certification_name,
        certification_type=certification_type,
        certificate_number=certificate_number,
        issuing_authority=issuing_authority,
        issue_date=issue_date,
        expiry_date=expiry_date,
        status=calculate_document_status(expiry_date),
        file_name=file_name,
        file_path=file_path,
        remarks=remarks,
        created_by=current_user.id,
    )

    db.add(certification)

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    db.flush()

    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
        ],
        "New Certification Added",
        f"Certification '{certification.certification_name}' has been added for {vendor.company_name}.",
        "compliance",
    )

    if (
        vendor.user_id
        and vendor.user_id != current_user.id
    ):

        notify_user(
            db,
            vendor.user_id,
            "Certification Added",
            f"Certification '{certification.certification_name}' has been added to your vendor profile.",
            "compliance",
        )

    db.commit()
    db.refresh(certification)

    return {
        "message": "Certification created successfully",
        "certification_id": certification.id,
        "status": calculate_document_status(
            certification.expiry_date
        ),
    }


# ============================================================
# UPDATE CERTIFICATION
# ============================================================

@router.put("/certifications/{certification_id}")
def update_certification(
    certification_id: int,
    certification_name: str | None = Body(None),
    certification_type: str | None = Body(None),
    certificate_number: str | None = Body(None),
    issuing_authority: str | None = Body(None),
    issue_date: date | None = Body(None),
    expiry_date: date | None = Body(None),
    file_name: str | None = Body(None),
    file_path: str | None = Body(None),
    remarks: str | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
            "vendor",
        )
    ),
):
    """
    Update certification.
    """

    certification = (
        db.query(Certification)
        .filter(
            Certification.id == certification_id
        )
        .first()
    )

    if not certification:
        raise HTTPException(
            status_code=404,
            detail="Certification not found",
        )

    check_vendor_access(
        certification.vendor_id,
        current_user,
        db,
    )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == certification.vendor_id)
        .first()
    )

    if certification_name is not None:
        certification.certification_name = certification_name

    if certification_type is not None:
        certification.certification_type = certification_type

    if certificate_number is not None:
        certification.certificate_number = certificate_number

    if issuing_authority is not None:
        certification.issuing_authority = issuing_authority

    if issue_date is not None:
        certification.issue_date = issue_date

    if expiry_date is not None:
        certification.expiry_date = expiry_date

    if (
        certification.issue_date
        and certification.expiry_date
        and certification.expiry_date
        < certification.issue_date
    ):
        raise HTTPException(
            status_code=400,
            detail="Expiry date cannot be before issue date",
        )

    if file_name is not None:
        certification.file_name = file_name

    if file_path is not None:
        certification.file_path = file_path

    if remarks is not None:
        certification.remarks = remarks

    certification.status = calculate_document_status(
        certification.expiry_date
    )

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    if vendor and vendor.user_id:
        if vendor.user_id != current_user.id:

            notify_user(
                db,
                vendor.user_id,
                "Certification Updated",
                f"Your certification '{certification.certification_name}' has been updated.",
                "compliance",
            )

    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
        ],
        "Certification Updated",
        f"Certification '{certification.certification_name}' has been updated.",
        "compliance",
    )

    db.commit()
    db.refresh(certification)

    return {
        "message": "Certification updated successfully",
        "certification_id": certification.id,
        "status": certification.status,
    }


# ============================================================
# DELETE CERTIFICATION
# ============================================================

@router.delete("/certifications/{certification_id}")
def delete_certification(
    certification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("administrator")
    ),
):
    """
    Delete certification.
    """

    certification = (
        db.query(Certification)
        .filter(
            Certification.id == certification_id
        )
        .first()
    )

    if not certification:
        raise HTTPException(
            status_code=404,
            detail="Certification not found",
        )

    db.delete(certification)
    db.commit()

    return {
        "message": "Certification deleted successfully"
    }


# ============================================================
# VENDOR DOCUMENTS
# ============================================================

@router.get("/vendor-documents")
def get_vendor_documents(
    vendor_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get general vendor documents.
    """

    query = db.query(VendorDocument)

    if current_user.role == "vendor":

        vendor = get_vendor_for_user(
            current_user,
            db,
        )

        if not vendor:
            return []

        query = query.filter(
            VendorDocument.vendor_id == vendor.id
        )

    elif vendor_id is not None:

        query = query.filter(
            VendorDocument.vendor_id == vendor_id
        )

    if status:

        query = query.filter(
            VendorDocument.status == status
        )

    documents = query.order_by(
        VendorDocument.created_at.desc()
    ).all()

    result = []

    for document in documents:

        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == document.vendor_id)
            .first()
        )

        result.append(
            {
                "id": document.id,
                "vendor_id": document.vendor_id,
                "vendor_name": (
                    vendor.company_name
                    if vendor
                    else "Unknown Vendor"
                ),
                "document_name": document.document_name,
                "document_type": document.document_type,
                "description": document.description,
                "file_name": document.file_name,
                "file_path": document.file_path,
                "status": document.status,
                "uploaded_by": document.uploaded_by,
                "created_at": document.created_at,
            }
        )

    return result


# ============================================================
# CREATE VENDOR DOCUMENT
# ============================================================

@router.post("/vendor-documents")
def create_vendor_document(
    vendor_id: int = Body(...),
    document_name: str = Body(...),
    document_type: str = Body(...),
    description: str | None = Body(None),
    file_name: str | None = Body(None),
    file_path: str | None = Body(None),
    status: str = Body("active"),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
            "vendor",
        )
    ),
):
    """
    Create vendor document.
    """

    check_vendor_access(
        vendor_id,
        current_user,
        db,
    )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    allowed_statuses = [
        "active",
        "inactive",
        "expired",
    ]

    if status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Invalid vendor document status",
        )

    document = VendorDocument(
        vendor_id=vendor_id,
        document_name=document_name,
        document_type=document_type,
        description=description,
        file_name=file_name,
        file_path=file_path,
        status=status,
        uploaded_by=current_user.id,
    )

    db.add(document)

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    db.flush()

    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
        ],
        "New Vendor Document",
        f"Vendor document '{document.document_name}' has been added for {vendor.company_name}.",
        "compliance",
    )

    if (
        vendor.user_id
        and vendor.user_id != current_user.id
    ):

        notify_user(
            db,
            vendor.user_id,
            "Vendor Document Added",
            f"Document '{document.document_name}' has been added to your vendor profile.",
            "compliance",
        )

    db.commit()
    db.refresh(document)

    return {
        "message": "Vendor document created successfully",
        "document_id": document.id,
    }


# ============================================================
# UPDATE VENDOR DOCUMENT
# ============================================================

@router.put("/vendor-documents/{document_id}")
def update_vendor_document(
    document_id: int,
    document_name: str | None = Body(None),
    document_type: str | None = Body(None),
    description: str | None = Body(None),
    file_name: str | None = Body(None),
    file_path: str | None = Body(None),
    status: str | None = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(
            "administrator",
            "procurement_manager",
            "supply_chain_manager",
            "vendor",
        )
    ),
):
    """
    Update vendor document.
    """

    document = (
        db.query(VendorDocument)
        .filter(
            VendorDocument.id == document_id
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Vendor document not found",
        )

    check_vendor_access(
        document.vendor_id,
        current_user,
        db,
    )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == document.vendor_id)
        .first()
    )

    if document_name is not None:
        document.document_name = document_name

    if document_type is not None:
        document.document_type = document_type

    if description is not None:
        document.description = description

    if file_name is not None:
        document.file_name = file_name

    if file_path is not None:
        document.file_path = file_path

    if status is not None:

        allowed_statuses = [
            "active",
            "inactive",
            "expired",
        ]

        if status not in allowed_statuses:
            raise HTTPException(
                status_code=400,
                detail="Invalid vendor document status",
            )

        document.status = status

    # --------------------------------------------------------
    # NOTIFICATIONS
    # --------------------------------------------------------

    if vendor and vendor.user_id:
        if vendor.user_id != current_user.id:

            notify_user(
                db,
                vendor.user_id,
                "Vendor Document Updated",
                f"Your vendor document '{document.document_name}' has been updated.",
                "compliance",
            )

    notify_roles(
        db,
        [
            "administrator",
            "procurement_manager",
        ],
        "Vendor Document Updated",
        f"Vendor document '{document.document_name}' has been updated.",
        "compliance",
    )

    db.commit()
    db.refresh(document)

    return {
        "message": "Vendor document updated successfully",
        "document_id": document.id,
        "status": document.status,
    }


# ============================================================
# DELETE VENDOR DOCUMENT
# ============================================================

@router.delete("/vendor-documents/{document_id}")
def delete_vendor_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("administrator")
    ),
):
    """
    Delete vendor document.
    """

    document = (
        db.query(VendorDocument)
        .filter(
            VendorDocument.id == document_id
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Vendor document not found",
        )

    db.delete(document)
    db.commit()

    return {
        "message": "Vendor document deleted successfully"
    }


# ============================================================
# ALL CONTRACT & COMPLIANCE ALERTS
# ============================================================

@router.get("/alerts")
def get_all_contract_compliance_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Combined alerts for contracts,
    compliance documents and certifications.
    """

    contract_alerts = []
    document_alerts = []
    certification_alerts = []

    today = date.today()
    alert_limit = today + timedelta(days=30)

    # --------------------------------------------------------
    # CONTRACTS
    # --------------------------------------------------------

    contract_query = db.query(Contract)

    if current_user.role == "vendor":

        vendor = get_vendor_for_user(
            current_user,
            db,
        )

        if not vendor:
            return {
                "contracts": [],
                "compliance_documents": [],
                "certifications": [],
                "total_alerts": 0,
            }

        contract_query = contract_query.filter(
            Contract.vendor_id == vendor.id
        )

    contracts = contract_query.all()

    for contract in contracts:

        if not contract.end_date:
            continue

        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == contract.vendor_id)
            .first()
        )

        if contract.end_date < today:

            contract_alerts.append(
                {
                    "type": "contract",
                    "alert_type": "expired",
                    "id": contract.id,
                    "name": contract.title,
                    "contract_number": contract.contract_number,
                    "vendor_id": contract.vendor_id,
                    "vendor_name": (
                        vendor.company_name
                        if vendor
                        else "Unknown Vendor"
                    ),
                    "expiry_date": contract.end_date,
                    "days_remaining": 0,
                }
            )

        elif contract.end_date <= alert_limit:

            days_remaining = (
                contract.end_date - today
            ).days

            contract_alerts.append(
                {
                    "type": "contract",
                    "alert_type": "expiring",
                    "id": contract.id,
                    "name": contract.title,
                    "contract_number": contract.contract_number,
                    "vendor_id": contract.vendor_id,
                    "vendor_name": (
                        vendor.company_name
                        if vendor
                        else "Unknown Vendor"
                    ),
                    "expiry_date": contract.end_date,
                    "days_remaining": days_remaining,
                }
            )

    # --------------------------------------------------------
    # COMPLIANCE DOCUMENTS
    # --------------------------------------------------------

    document_query = db.query(ComplianceDocument)

    if current_user.role == "vendor":

        vendor = get_vendor_for_user(
            current_user,
            db,
        )

        if vendor:

            document_query = document_query.filter(
                ComplianceDocument.vendor_id == vendor.id
            )

    documents = document_query.all()

    for document in documents:

        if not document.expiry_date:
            continue

        if document.expiry_date <= alert_limit:

            vendor = (
                db.query(Vendor)
                .filter(
                    Vendor.id == document.vendor_id
                )
                .first()
            )

            if document.expiry_date < today:

                alert_type = "expired"
                days_remaining = 0

            else:

                alert_type = "expiring"

                days_remaining = (
                    document.expiry_date - today
                ).days

            document_alerts.append(
                {
                    "type": "compliance",
                    "alert_type": alert_type,
                    "id": document.id,
                    "name": document.document_name,
                    "document_type": document.document_type,
                    "vendor_id": document.vendor_id,
                    "vendor_name": (
                        vendor.company_name
                        if vendor
                        else "Unknown Vendor"
                    ),
                    "expiry_date": document.expiry_date,
                    "days_remaining": days_remaining,
                    "verification_status": document.verification_status,
                }
            )

    # --------------------------------------------------------
    # CERTIFICATIONS
    # --------------------------------------------------------

    certification_query = db.query(Certification)

    if current_user.role == "vendor":

        vendor = get_vendor_for_user(
            current_user,
            db,
        )

        if vendor:

            certification_query = certification_query.filter(
                Certification.vendor_id == vendor.id
            )

    certifications = certification_query.all()

    for certification in certifications:

        if not certification.expiry_date:
            continue

        if certification.expiry_date <= alert_limit:

            vendor = (
                db.query(Vendor)
                .filter(
                    Vendor.id == certification.vendor_id
                )
                .first()
            )

            if certification.expiry_date < today:

                alert_type = "expired"
                days_remaining = 0

            else:

                alert_type = "expiring"

                days_remaining = (
                    certification.expiry_date - today
                ).days

            certification_alerts.append(
                {
                    "type": "certification",
                    "alert_type": alert_type,
                    "id": certification.id,
                    "name": certification.certification_name,
                    "certificate_number": certification.certificate_number,
                    "vendor_id": certification.vendor_id,
                    "vendor_name": (
                        vendor.company_name
                        if vendor
                        else "Unknown Vendor"
                    ),
                    "expiry_date": certification.expiry_date,
                    "days_remaining": days_remaining,
                }
            )

    total_alerts = (
        len(contract_alerts)
        + len(document_alerts)
        + len(certification_alerts)
    )

    return {
        "contracts": contract_alerts,
        "compliance_documents": document_alerts,
        "certifications": certification_alerts,
        "total_alerts": total_alerts,
    }