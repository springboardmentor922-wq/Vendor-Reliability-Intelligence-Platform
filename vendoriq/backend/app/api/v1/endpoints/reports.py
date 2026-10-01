from uuid import UUID
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import (
    get_current_user,
    require_operations_read,
    require_all_authenticated,
)
from app.db.session_dep import get_db
from app.models.user import User, UserRole
from app.models.vendor import Vendor
from app.services import report_service


router = APIRouter()


ReportFormat = Query(
    "xlsx",
    pattern="^(json|xlsx|pdf)$",
)


def _get_owned_vendor(
    vendor_id: UUID,
    current_user: User,
    db: Session,
) -> Vendor:
    """
    Verify that a vendor user is accessing their own vendor profile.
    Non-vendor roles are allowed to access the requested vendor.
    """

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == vendor_id)
        .first()
    )

    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    if current_user.role == UserRole.VENDOR:
        if vendor.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only access your own vendor reports",
            )

    return vendor


def _return_report(
    report: Any,
    report_format: str,
    filename: str,
) -> Any:
    """
    Return the generated report in the requested format.
    """

    if report_format == "json":
        return report

    if report_format == "xlsx":
        return Response(
            content=report,
            media_type=(
                "application/vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{filename}.xlsx"'
                )
            },
        )

    if report_format == "pdf":
        return Response(
            content=report,
            media_type="application/pdf",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{filename}.pdf"'
                )
            },
        )

    raise HTTPException(
        status_code=400,
        detail="Unsupported report format",
    )


# ============================================================
# VENDOR PERFORMANCE REPORT
# ============================================================

@router.get("/vendor-performance")
def vendor_performance_report(
    vendor_id: UUID | None = None,
    format: str = ReportFormat,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_all_authenticated),
):
    """
    Generate vendor performance report.

    Access:
    - Administrator
    - Procurement Manager
    - Supply Chain Manager
    - Vendor (own vendor only)
    - Finance Officer
    - Auditor
    """

    if current_user.role == UserRole.VENDOR:
        if vendor_id is None:
            vendor = (
                db.query(Vendor)
                .filter(Vendor.user_id == current_user.id)
                .first()
            )

            if vendor is None:
                raise HTTPException(
                    status_code=403,
                    detail="No vendor profile is associated with this account",
                )

            vendor_id = vendor.id

        _get_owned_vendor(
            vendor_id=vendor_id,
            current_user=current_user,
            db=db,
        )

    elif vendor_id is not None:
        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == vendor_id)
            .first()
        )

        if vendor is None:
            raise HTTPException(
                status_code=404,
                detail="Vendor not found",
            )

    report = report_service.generate_vendor_performance_report(
        db=db,
        vendor_id=vendor_id,
        format=format,
    )

    return _return_report(
        report=report,
        report_format=format,
        filename="vendor_performance_report",
    )


# ============================================================
# PROCUREMENT REPORT
# ============================================================

@router.get("/procurement")
def procurement_report(
    format: str = ReportFormat,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operations_read),
):
    """
    Generate procurement report.

    Access:
    - Administrator
    - Procurement Manager
    - Supply Chain Manager
    - Auditor
    """

    report = report_service.generate_procurement_report(
        db=db,
        format=format,
    )

    return _return_report(
        report=report,
        report_format=format,
        filename="procurement_report",
    )


# ============================================================
# PURCHASE ORDER REPORT
# ============================================================

@router.get("/purchase-orders")
def purchase_order_report(
    vendor_id: UUID | None = None,
    format: str = ReportFormat,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_all_authenticated),
):
    """
    Generate purchase order report.

    Vendor users can only generate reports for their own POs.
    """

    if current_user.role == UserRole.VENDOR:
        vendor = (
            db.query(Vendor)
            .filter(Vendor.user_id == current_user.id)
            .first()
        )

        if vendor is None:
            raise HTTPException(
                status_code=403,
                detail="No vendor profile is associated with this account",
            )

        if vendor_id is not None and vendor_id != vendor.id:
            raise HTTPException(
                status_code=403,
                detail="You can only access your own purchase order reports",
            )

        vendor_id = vendor.id

    elif vendor_id is not None:
        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == vendor_id)
            .first()
        )

        if vendor is None:
            raise HTTPException(
                status_code=404,
                detail="Vendor not found",
            )

    report = report_service.generate_purchase_order_report(
        db=db,
        vendor_id=vendor_id,
        format=format,
    )

    return _return_report(
        report=report,
        report_format=format,
        filename="purchase_orders_report",
    )


# ============================================================
# COMPLIANCE REPORT
# ============================================================

@router.get("/compliance")
def compliance_report(
    vendor_id: UUID | None = None,
    format: str = ReportFormat,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_all_authenticated),
):
    """
    Generate vendor compliance report.

    Vendor users can only access their own compliance report.
    """

    if current_user.role == UserRole.VENDOR:
        if vendor_id is None:
            vendor = (
                db.query(Vendor)
                .filter(Vendor.user_id == current_user.id)
                .first()
            )

            if vendor is None:
                raise HTTPException(
                    status_code=403,
                    detail="No vendor profile is associated with this account",
                )

            vendor_id = vendor.id

        _get_owned_vendor(
            vendor_id=vendor_id,
            current_user=current_user,
            db=db,
        )

    elif vendor_id is not None:
        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == vendor_id)
            .first()
        )

        if vendor is None:
            raise HTTPException(
                status_code=404,
                detail="Vendor not found",
            )

    report = report_service.generate_compliance_report(
        db=db,
        vendor_id=vendor_id,
        format=format,
    )

    return _return_report(
        report=report,
        report_format=format,
        filename="compliance_report",
    )


# ============================================================
# CONTRACT REPORT
# ============================================================

@router.get("/contracts")
def contract_report(
    vendor_id: UUID | None = None,
    format: str = ReportFormat,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_all_authenticated),
):
    """
    Generate contract report.

    Vendor users can only access their own contract report.
    """

    if current_user.role == UserRole.VENDOR:
        if vendor_id is None:
            vendor = (
                db.query(Vendor)
                .filter(Vendor.user_id == current_user.id)
                .first()
            )

            if vendor is None:
                raise HTTPException(
                    status_code=403,
                    detail="No vendor profile is associated with this account",
                )

            vendor_id = vendor.id

        _get_owned_vendor(
            vendor_id=vendor_id,
            current_user=current_user,
            db=db,
        )

    elif vendor_id is not None:
        vendor = (
            db.query(Vendor)
            .filter(Vendor.id == vendor_id)
            .first()
        )

        if vendor is None:
            raise HTTPException(
                status_code=404,
                detail="Vendor not found",
            )

    report = report_service.generate_contract_report(
        db=db,
        vendor_id=vendor_id,
        format=format,
    )

    return _return_report(
        report=report,
        report_format=format,
        filename="contracts_report",
    )