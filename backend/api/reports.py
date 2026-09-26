"""Report generation and PDF / Excel export.

``GET /reports/{key}`` returns the dataset as JSON for the on-screen preview.
``GET /reports/{key}/export?format=pdf|excel`` streams the same dataset as a
file. Both run the same query, so the export always matches the preview.

Every generation is recorded in ``report_runs`` for the audit trail.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user, vendor_scope
from models import ReportRun, User
from services import reporting
from services.analytics import Filters
from services.events import log_activity

router = APIRouter(prefix="/reports", tags=["Reports"])

EXCEL_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)


class ReportDefinition(BaseModel):
    key: str
    title: str
    description: str


def _build_filters(
    current_user: User,
    start: Optional[date],
    end: Optional[date],
    vendor_id: Optional[int],
    category: Optional[str],
    risk_level: Optional[str],
    status_filter: Optional[str],
) -> Filters:
    scope = vendor_scope(current_user)

    return Filters(
        start=start,
        end=end,
        vendor_id=scope if scope is not None else vendor_id,
        category=category,
        risk_level=risk_level,
        status=status_filter,
    )


def _record(
    db: Session,
    user: User,
    key: str,
    export_format: str,
    filters: Filters,
    row_count: int,
) -> None:
    db.add(
        ReportRun(
            report_key=key,
            export_format=export_format,
            filters=json.dumps(filters.as_dict()),
            row_count=row_count,
            generated_by=user.id,
        )
    )

    log_activity(
        db,
        user.id,
        "Report",
        None,
        "Report Generated",
        f"{key} report generated as {export_format} ({row_count} rows)",
    )

    db.commit()


@router.get("", response_model=list[ReportDefinition])
@router.get("/", response_model=list[ReportDefinition], include_in_schema=False)
def list_reports(current_user: User = Depends(get_current_user)):
    """The report catalogue."""

    return [
        ReportDefinition(
            key=key, title=entry["title"], description=entry["description"]
        )
        for key, entry in reporting.REPORTS.items()
    ]


@router.get("/{key}")
def generate(
    key: str,
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    vendor_id: Optional[int] = Query(default=None),
    category: Optional[str] = Query(default=None),
    risk_level: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a report and return it as JSON for the preview table."""

    if key not in reporting.REPORTS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown report '{key}'",
        )

    filters = _build_filters(
        current_user, start, end, vendor_id, category, risk_level, status_filter
    )

    report = reporting.build(db, key, filters)

    _record(db, current_user, key, "json", filters, len(report.rows))

    payload = report.as_dict()

    # The preview table is capped; the export carries the whole dataset.
    payload["rows"] = payload["rows"][:limit]
    payload["truncated"] = len(report.rows) > limit

    return payload


@router.get("/{key}/export")
def export(
    key: str,
    export_format: str = Query(default="pdf", alias="format"),
    start: Optional[date] = Query(default=None),
    end: Optional[date] = Query(default=None),
    vendor_id: Optional[int] = Query(default=None),
    category: Optional[str] = Query(default=None),
    risk_level: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream the report as a PDF or an Excel workbook."""

    if key not in reporting.REPORTS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown report '{key}'",
        )

    normalised = export_format.lower()

    if normalised not in ("pdf", "excel", "xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="format must be 'pdf' or 'excel'",
        )

    filters = _build_filters(
        current_user, start, end, vendor_id, category, risk_level, status_filter
    )

    report = reporting.build(db, key, filters)

    if normalised == "pdf":
        content = reporting.to_pdf(report)
        media_type = "application/pdf"
        filename = reporting.filename_for(report, "pdf")
    else:
        content = reporting.to_excel(report)
        media_type = EXCEL_MEDIA_TYPE
        filename = reporting.filename_for(report, "xlsx")

    _record(db, current_user, key, normalised, filters, len(report.rows))

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            # The browser needs to see the header to read the filename back.
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
