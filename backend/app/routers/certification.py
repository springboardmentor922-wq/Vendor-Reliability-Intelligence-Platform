from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date

from app.database.connection import get_db
from app.models.certification import Certification
from app.models.activity_log import ActivityLog
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/certifications",
    tags=["Certifications"]
)


# ---------------------------------------------------------
# CREATE CERTIFICATION
# ---------------------------------------------------------
@router.post("/")
def create_certification(
    vendor_id: int,
    certification_name: str,
    certificate_number: str,
    issue_date: date,
    expiry_date: date,
    document: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    existing = db.query(Certification).filter(
        Certification.certificate_number == certificate_number
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Certificate number already exists"
        )

    certification = Certification(
        vendor_id=vendor_id,
        certification_name=certification_name,
        certificate_number=certificate_number,
        issue_date=issue_date,
        expiry_date=expiry_date,
        document=document,
        status="VALID"
    )

    db.add(certification)
    db.commit()
    db.refresh(certification)

    return certification


# ---------------------------------------------------------
# GET ALL CERTIFICATIONS
# ---------------------------------------------------------
@router.get("/")
def get_certifications(
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
    certifications = db.query(Certification).all()

    today = date.today()
    result = []

    for certification in certifications:

        days_remaining = (
            certification.expiry_date - today
        ).days

        if days_remaining < 0:
            expiry_status = "EXPIRED"
        elif days_remaining <= 30:
            expiry_status = "EXPIRING_SOON"
        else:
            expiry_status = "VALID"

        # -------------------------------------------------
        # AUTOMATIC COMPLIANCE ISSUE ACTIVITY LOG
        # -------------------------------------------------
        compliance_issue = (
            expiry_status == "EXPIRED"
            or certification.status != "VALID"
        )

        if compliance_issue:

            existing_log = db.query(ActivityLog).filter(
                ActivityLog.action == "Compliance Issue",
                ActivityLog.related_record == certification.certificate_number
            ).first()

            if not existing_log:

                activity = ActivityLog(
                    user=current_user.email,
                    action="Compliance Issue",
                    related_record=certification.certificate_number
                )

                db.add(activity)
                db.commit()

        result.append({
            "id": certification.id,
            "vendor_id": certification.vendor_id,
            "certification_name": certification.certification_name,
            "certificate_number": certification.certificate_number,
            "issue_date": certification.issue_date,
            "expiry_date": certification.expiry_date,
            "status": certification.status,
            "document": certification.document,
            "days_remaining": days_remaining,
            "expiry_status": expiry_status
        })

    return result


# ---------------------------------------------------------
# UPDATE CERTIFICATION STATUS
# ---------------------------------------------------------
@router.put("/{certification_id}/update-status")
def update_certification_status(
    certification_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    certification = db.query(Certification).filter(
        Certification.id == certification_id
    ).first()

    if not certification:
        raise HTTPException(
            status_code=404,
            detail="Certification not found"
        )

    certification.status = status

    db.commit()
    db.refresh(certification)

    return certification