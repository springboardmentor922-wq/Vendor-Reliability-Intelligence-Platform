from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.vendor_approval import VendorApproval
from app.models.activity_log import ActivityLog
from app.dependencies.authorization import require_roles


router = APIRouter(
    prefix="/api/vendor-approvals",
    tags=["Vendor Approval"]
)


@router.post("/")
def create_approval(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    approval = VendorApproval(
        vendor_id=vendor_id,
        status="PENDING"
    )

    db.add(approval)
    db.commit()
    db.refresh(approval)

    return approval


@router.get("/")
def get_approvals(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER",
            "SUPPLY_CHAIN_MANAGER",
            "AUDITOR"
        )
    )
):
    return db.query(VendorApproval).all()


@router.put("/{approval_id}/approve")
def approve_vendor(
    approval_id: int,
    approved_by: str,
    remarks: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    approval = db.query(VendorApproval).filter(
        VendorApproval.id == approval_id
    ).first()

    if not approval:
        raise HTTPException(
            status_code=404,
            detail="Approval record not found"
        )

    approval.status = "APPROVED"
    approval.approved_by = approved_by
    approval.remarks = remarks

    db.commit()
    db.refresh(approval)

    activity = ActivityLog(
        user=current_user.email,
        action="Vendor Approved",
        related_record=str(approval.vendor_id)
    )

    db.add(activity)
    db.commit()

    return approval


@router.put("/{approval_id}/reject")
def reject_vendor(
    approval_id: int,
    approved_by: str,
    remarks: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "ADMINISTRATOR",
            "PROCUREMENT_MANAGER"
        )
    )
):
    approval = db.query(VendorApproval).filter(
        VendorApproval.id == approval_id
    ).first()

    if not approval:
        raise HTTPException(
            status_code=404,
            detail="Approval record not found"
        )

    approval.status = "REJECTED"
    approval.approved_by = approved_by
    approval.remarks = remarks

    db.commit()
    db.refresh(approval)

    activity = ActivityLog(
        user=current_user.email,
        action="Vendor Rejected",
        related_record=str(approval.vendor_id)
    )

    db.add(activity)
    db.commit()

    return approval