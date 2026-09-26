"""Report datasets and their PDF / Excel renderings.

Each report is built by querying the live database under the caller's
filters, so pressing Generate produces the current answer rather than
returning a prepared file.  The same dataset feeds all three outputs - the
JSON preview on screen, the Excel workbook and the PDF - so what is exported
is exactly what was previewed.

Five reports are provided, matching the Reports & Export module:

  vendor-performance   delivery, quality and reliability per supplier
  procurement          procurement requests and their approval outcome
  purchase-orders      the purchase order book with delivery outcomes
  compliance           compliance checks and certification validity
  contracts            the contract register with renewal exposure
"""

from __future__ import annotations

import io
from datetime import date, datetime
from typing import Callable, Optional

from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from config import settings
from models import (
    ComplianceCheck,
    Contract,
    ContractStatus,
    Invoice,
    ProcurementRequest,
    PurchaseOrder,
    PurchaseOrderStatus,
    User,
    Vendor,
    VendorCertification,
    VendorPerformance,
    VendorReliabilityScore
)
from services.analytics import Filters
from services.performance import DELIVERED, _on_time_condition


class Report:
    """A generated report: its columns, its rows and how it was produced."""

    def __init__(
        self,
        key: str,
        title: str,
        columns: list[dict],
        rows: list[dict],
        filters: Optional[dict] = None,
        summary: Optional[dict] = None,
    ):
        self.key = key
        self.title = title
        self.columns = columns
        self.rows = rows
        self.filters = filters or {}
        self.summary = summary or {}
        self.generated_at = datetime.now()

    def as_dict(self) -> dict:
        return {
            "key": self.key,
            "title": self.title,
            "columns": self.columns,
            "rows": self.rows,
            "row_count": len(self.rows),
            "filters": self.filters,
            "summary": self.summary,
            "generated_at": self.generated_at.isoformat(),
        }


def _column(key: str, label: str, kind: str = "text") -> dict:
    """Column descriptor. ``kind`` drives alignment and number formatting."""

    return {"key": key, "label": label, "type": kind}


def _to_float(value, default=0.0) -> float:
    if value is None:
        return default

    try:
        return float(value)
    except (TypeError, ValueError):
        return default


# --------------------------------------------------------------------------
# Report builders
# --------------------------------------------------------------------------

def vendor_performance_report(db: Session, filters: Filters) -> Report:
    """Delivery, quality and reliability, one row per supplier."""

    from services.reliability import latest_scores

    scores = latest_scores(db)

    delivered = and_(
        PurchaseOrder.status.in_(DELIVERED),
        PurchaseOrder.actual_delivery.isnot(None),
    )

    query = (
        db.query(
            Vendor.id.label("vendor_id"),
            Vendor.vendor_code,
            Vendor.vendor_name,
            Vendor.category,
            Vendor.status,
            Vendor.risk_level,
            Vendor.reliability_score,
            func.count(PurchaseOrder.id).label("orders"),
            func.sum(case((delivered, 1), else_=0)).label("delivered"),
            func.sum(
                case((and_(delivered, _on_time_condition()), 1), else_=0)
            ).label("on_time"),
            func.sum(
                case((and_(delivered, ~_on_time_condition()), 1), else_=0)
            ).label("delayed"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            PurchaseOrder.status != PurchaseOrderStatus.CANCELLED,
                            PurchaseOrder.total_amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("spend"),
        )
        .select_from(Vendor)
        .outerjoin(PurchaseOrder, PurchaseOrder.vendor_id == Vendor.id)
        .group_by(
            Vendor.id, Vendor.vendor_code, Vendor.vendor_name, Vendor.category,
            Vendor.status, Vendor.risk_level, Vendor.reliability_score,
        )
    )

    query = filters.apply_vendors(query)

    if filters.start:
        query = query.filter(
            (PurchaseOrder.id.is_(None))
            | (PurchaseOrder.order_date >= filters.start)
        )

    if filters.end:
        query = query.filter(
            (PurchaseOrder.id.is_(None))
            | (PurchaseOrder.order_date <= filters.end)
        )

    quality = {
        row.vendor_id: row
        for row in db.query(
            VendorPerformance.vendor_id.label("vendor_id"),
            func.avg(VendorPerformance.quality_rating).label("quality"),
            func.avg(VendorPerformance.response_time).label("response"),
        )
        .group_by(VendorPerformance.vendor_id)
        .all()
    }

    rows = []

    for row in query.all():
        delivered_count = int(row.delivered or 0)
        on_time = int(row.on_time or 0)
        snapshot = scores.get(row.vendor_id)
        quality_row = quality.get(row.vendor_id)

        rows.append({
            "vendor_code": row.vendor_code,
            "vendor_name": row.vendor_name,
            "category": row.category,
            "status": row.status,
            "orders": int(row.orders or 0),
            "delivered": delivered_count,
            "on_time": on_time,
            "delayed": int(row.delayed or 0),
            "on_time_rate": round(100.0 * on_time / delivered_count, 2)
            if delivered_count
            else 0.0,
            "quality_rating": round(_to_float(quality_row.quality), 2)
            if quality_row
            else 0.0,
            "response_hours": round(_to_float(quality_row.response), 2)
            if quality_row
            else 0.0,
            "reliability_score": _to_float(row.reliability_score),
            "risk_level": row.risk_level,
            "rank": snapshot.rank_position if snapshot else None,
            "trend": snapshot.trend if snapshot else None,
            "total_spend": round(_to_float(row.spend), 2),
        })

    rows.sort(key=lambda r: r["reliability_score"], reverse=True)

    scored = [r for r in rows if r["delivered"]]

    summary = {
        "Vendors": len(rows),
        "Average on-time rate": (
            f"{sum(r['on_time_rate'] for r in scored) / len(scored):.2f}%"
            if scored
            else "n/a"
        ),
        "Average reliability": (
            f"{sum(r['reliability_score'] for r in rows) / len(rows):.2f}"
            if rows
            else "n/a"
        ),
        "High or critical risk": sum(
            1 for r in rows if r["risk_level"] in ("High", "Critical")
        ),
        "Total spend": f"{sum(r['total_spend'] for r in rows):,.2f}",
    }

    return Report(
        "vendor-performance",
        "Vendor Performance Report",
        [
            _column("vendor_code", "Code"),
            _column("vendor_name", "Vendor"),
            _column("category", "Category"),
            _column("orders", "Orders", "number"),
            _column("delivered", "Delivered", "number"),
            _column("on_time", "On Time", "number"),
            _column("delayed", "Delayed", "number"),
            _column("on_time_rate", "On-Time %", "percent"),
            _column("quality_rating", "Quality", "decimal"),
            _column("response_hours", "Response (h)", "decimal"),
            _column("reliability_score", "Reliability", "decimal"),
            _column("risk_level", "Risk"),
            _column("trend", "Trend"),
            _column("total_spend", "Spend", "money"),
        ],
        rows,
        filters.as_dict(),
        summary,
    )


def procurement_report(db: Session, filters: Filters) -> Report:
    """Procurement requests with their approval outcome and assigned vendor."""

    query = (
        db.query(ProcurementRequest, Vendor, User)
        .outerjoin(Vendor, Vendor.id == ProcurementRequest.assigned_vendor_id)
        .outerjoin(User, User.id == ProcurementRequest.requested_by)
    )

    query = filters.apply_requests(query)

    if filters.status:
        query = query.filter(ProcurementRequest.status == filters.status)

    if filters.category:
        query = query.filter(ProcurementRequest.category == filters.category)

    records = query.order_by(ProcurementRequest.id.desc()).limit(5000).all()

    rows = [
        {
            "request_number": request.request_number,
            "item": request.item,
            "category": request.category,
            "department": request.department,
            "quantity": _to_float(request.quantity),
            "unit": request.unit,
            "estimated_cost": _to_float(request.estimated_cost),
            "priority": request.priority,
            "status": request.status,
            "vendor_name": vendor.vendor_name if vendor else "Unassigned",
            "requested_by": user.name if user else None,
            "required_date": request.required_date.isoformat()
            if request.required_date
            else None,
            "created_at": request.created_at.date().isoformat()
            if request.created_at
            else None,
        }
        for request, vendor, user in records
    ]

    by_status: dict[str, int] = {}
    for row in rows:
        by_status[row["status"]] = by_status.get(row["status"], 0) + 1

    summary = {
        "Requests": len(rows),
        "Total estimated value": f"{sum(r['estimated_cost'] for r in rows):,.2f}",
        **{f"Status: {k}": v for k, v in sorted(by_status.items())},
    }

    return Report(
        "procurement",
        "Procurement Report",
        [
            _column("request_number", "Request"),
            _column("item", "Item"),
            _column("category", "Category"),
            _column("department", "Department"),
            _column("quantity", "Qty", "number"),
            _column("unit", "Unit"),
            _column("estimated_cost", "Estimated", "money"),
            _column("priority", "Priority"),
            _column("status", "Status"),
            _column("vendor_name", "Vendor"),
            _column("required_date", "Required"),
            _column("created_at", "Raised"),
        ],
        rows,
        filters.as_dict(),
        summary,
    )


def purchase_order_report(db: Session, filters: Filters) -> Report:
    """The purchase order book with its delivery outcome per order."""

    query = (
        db.query(PurchaseOrder, Vendor)
        .join(Vendor, Vendor.id == PurchaseOrder.vendor_id)
    )

    query = filters.apply_orders(query)

    records = query.order_by(PurchaseOrder.order_date.desc()).limit(5000).all()

    today = date.today()
    rows = []

    for order, vendor in records:
        delay = None
        outcome = "Not delivered"

        if order.actual_delivery and order.expected_delivery:
            delay = (order.actual_delivery - order.expected_delivery).days
            outcome = "On time" if delay <= 0 else f"Late by {delay}d"
        elif (
            order.expected_delivery
            and order.expected_delivery < today
            and order.status not in (
                PurchaseOrderStatus.COMPLETED, PurchaseOrderStatus.CANCELLED
            )
        ):
            outcome = f"Overdue by {(today - order.expected_delivery).days}d"

        rows.append({
            "po_number": order.po_number,
            "vendor_name": vendor.vendor_name,
            "category": vendor.category,
            "title": order.title,
            "order_date": order.order_date.isoformat()
            if order.order_date
            else None,
            "expected_delivery": order.expected_delivery.isoformat()
            if order.expected_delivery
            else None,
            "actual_delivery": order.actual_delivery.isoformat()
            if order.actual_delivery
            else None,
            "delay_days": delay,
            "outcome": outcome,
            "status": order.status,
            "shipping_mode": order.shipping_mode,
            "total_amount": _to_float(order.total_amount),
        })

    delivered = [r for r in rows if r["delay_days"] is not None]
    on_time = [r for r in delivered if r["delay_days"] <= 0]

    summary = {
        "Purchase orders": len(rows),
        "Delivered": len(delivered),
        "On time": len(on_time),
        "Late": len(delivered) - len(on_time),
        "On-time rate": (
            f"{100.0 * len(on_time) / len(delivered):.2f}%" if delivered else "n/a"
        ),
        "Total value": f"{sum(r['total_amount'] for r in rows):,.2f}",
    }

    return Report(
        "purchase-orders",
        "Purchase Order Report",
        [
            _column("po_number", "PO"),
            _column("vendor_name", "Vendor"),
            _column("title", "Item"),
            _column("order_date", "Ordered"),
            _column("expected_delivery", "Committed"),
            _column("actual_delivery", "Delivered"),
            _column("delay_days", "Delay (d)", "number"),
            _column("outcome", "Outcome"),
            _column("status", "Status"),
            _column("shipping_mode", "Lane"),
            _column("total_amount", "Value", "money"),
        ],
        rows,
        filters.as_dict(),
        summary,
    )


def compliance_report(db: Session, filters: Filters) -> Report:
    """Compliance checks joined to the vendor and contract they belong to."""

    query = (
        db.query(ComplianceCheck, Vendor, Contract, User)
        .join(Vendor, Vendor.id == ComplianceCheck.vendor_id)
        .outerjoin(Contract, Contract.id == ComplianceCheck.contract_id)
        .outerjoin(User, User.id == ComplianceCheck.checked_by)
    )

    if filters.vendor_id:
        query = query.filter(ComplianceCheck.vendor_id == filters.vendor_id)

    if filters.category:
        query = query.filter(Vendor.category == filters.category)

    if filters.risk_level:
        query = query.filter(Vendor.risk_level == filters.risk_level)

    if filters.start:
        query = query.filter(ComplianceCheck.check_date >= filters.start)

    if filters.end:
        query = query.filter(ComplianceCheck.check_date <= filters.end)

    records = query.order_by(ComplianceCheck.check_date.desc()).limit(5000).all()

    rows = [
        {
            "vendor_code": vendor.vendor_code,
            "vendor_name": vendor.vendor_name,
            "category": vendor.category,
            "check_type": check.check_type,
            "check_date": check.check_date.isoformat()
            if check.check_date
            else None,
            "result": check.result,
            "contract_number": contract.contract_number if contract else None,
            "checked_by": user.name if user else None,
            "remarks": check.remarks,
        }
        for check, vendor, contract, user in records
    ]

    # Certification validity is part of the compliance picture.
    today = date.today()

    cert_query = db.query(VendorCertification, Vendor).join(
        Vendor, Vendor.id == VendorCertification.vendor_id
    )

    if filters.vendor_id:
        cert_query = cert_query.filter(
            VendorCertification.vendor_id == filters.vendor_id
        )

    certificates = cert_query.all()

    expired = sum(1 for c, _ in certificates if c.expiry_date < today)
    expiring = sum(
        1
        for c, _ in certificates
        if today <= c.expiry_date
        <= today.replace() + __import__("datetime").timedelta(
            days=settings.CERTIFICATION_ALERT_DAYS
        )
    )

    passed = sum(1 for r in rows if r["result"] == "Compliant")
    partial = sum(1 for r in rows if r["result"] == "Partial")

    summary = {
        "Checks": len(rows),
        "Compliant": passed,
        "Partial": partial,
        "Non-compliant": sum(1 for r in rows if r["result"] == "Non-Compliant"),
        "Compliance rate": (
            f"{100.0 * (passed + 0.5 * partial) / len(rows):.2f}%"
            if rows
            else "n/a"
        ),
        "Certifications": len(certificates),
        "Expired certifications": expired,
        "Expiring certifications": expiring,
    }

    return Report(
        "compliance",
        "Compliance Report",
        [
            _column("vendor_code", "Code"),
            _column("vendor_name", "Vendor"),
            _column("category", "Category"),
            _column("check_type", "Check"),
            _column("check_date", "Date"),
            _column("result", "Result"),
            _column("contract_number", "Contract"),
            _column("checked_by", "Checked by"),
            _column("remarks", "Remarks"),
        ],
        rows,
        filters.as_dict(),
        summary,
    )


def contract_report(db: Session, filters: Filters) -> Report:
    """The contract register with days to expiry and renewal exposure."""

    query = db.query(Contract, Vendor).join(
        Vendor, Vendor.id == Contract.vendor_id
    )

    if filters.vendor_id:
        query = query.filter(Contract.vendor_id == filters.vendor_id)

    if filters.category:
        query = query.filter(Vendor.category == filters.category)

    if filters.risk_level:
        query = query.filter(Vendor.risk_level == filters.risk_level)

    if filters.status:
        query = query.filter(Contract.status == filters.status)

    if filters.start:
        query = query.filter(Contract.expiry_date >= filters.start)

    if filters.end:
        query = query.filter(Contract.expiry_date <= filters.end)

    records = query.order_by(Contract.expiry_date.asc()).limit(5000).all()

    today = date.today()

    rows = [
        {
            "contract_number": contract.contract_number,
            "vendor_name": vendor.vendor_name,
            "category": vendor.category,
            "title": contract.title,
            "contract_type": contract.contract_type,
            "start_date": contract.start_date.isoformat()
            if contract.start_date
            else None,
            "expiry_date": contract.expiry_date.isoformat()
            if contract.expiry_date
            else None,
            "days_to_expiry": (contract.expiry_date - today).days
            if contract.expiry_date
            else None,
            "contract_value": _to_float(contract.contract_value),
            "status": contract.status,
            "compliance_status": contract.compliance_status,
            "auto_renew": "Yes" if contract.auto_renew else "No",
        }
        for contract, vendor in records
    ]

    expiring = [
        r for r in rows
        if r["days_to_expiry"] is not None
        and 0 <= r["days_to_expiry"] <= settings.CONTRACT_EXPIRY_ALERT_DAYS
    ]

    summary = {
        "Contracts": len(rows),
        "Active": sum(1 for r in rows if r["status"] == ContractStatus.ACTIVE),
        "Expiring within window": len(expiring),
        "Expired": sum(1 for r in rows if r["status"] == ContractStatus.EXPIRED),
        "Total contract value": f"{sum(r['contract_value'] for r in rows):,.2f}",
        "Value expiring soon": f"{sum(r['contract_value'] for r in expiring):,.2f}",
    }

    return Report(
        "contracts",
        "Contract Report",
        [
            _column("contract_number", "Contract"),
            _column("vendor_name", "Vendor"),
            _column("contract_type", "Type"),
            _column("start_date", "Start"),
            _column("expiry_date", "Expiry"),
            _column("days_to_expiry", "Days left", "number"),
            _column("contract_value", "Value", "money"),
            _column("status", "Status"),
            _column("compliance_status", "Compliance"),
            _column("auto_renew", "Auto-renew"),
        ],
        rows,
        filters.as_dict(),
        summary,
    )


#: The report catalogue the API exposes.
REPORTS: dict[str, dict] = {
    "vendor-performance": {
        "title": "Vendor Performance Report",
        "description": (
            "Delivery, quality and reliability for every supplier, with rank "
            "and risk level."
        ),
        "builder": vendor_performance_report,
    },
    "procurement": {
        "title": "Procurement Report",
        "description": (
            "Procurement requests, their approval outcome and the assigned "
            "vendor."
        ),
        "builder": procurement_report,
    },
    "purchase-orders": {
        "title": "Purchase Order Report",
        "description": (
            "The purchase order book with committed versus actual delivery "
            "dates."
        ),
        "builder": purchase_order_report,
    },
    "compliance": {
        "title": "Compliance Report",
        "description": (
            "Compliance check results and certification validity per vendor."
        ),
        "builder": compliance_report,
    },
    "contracts": {
        "title": "Contract Report",
        "description": (
            "The contract register with expiry dates and renewal exposure."
        ),
        "builder": contract_report,
    },
}


def build(db: Session, key: str, filters: Filters) -> Report:
    """Build one report by key."""

    entry = REPORTS.get(key)

    if not entry:
        raise KeyError(key)

    return entry["builder"](db, filters)


# --------------------------------------------------------------------------
# Excel export
# --------------------------------------------------------------------------

def to_excel(report: Report) -> bytes:
    """Render the report as an .xlsx workbook."""

    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = report.title[:31]

    heading = Font(bold=True, size=14)
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1F3864")
    label_font = Font(bold=True)
    thin = Side(style="thin", color="D0D0D0")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    row_index = 1

    sheet.cell(row=row_index, column=1, value=report.title).font = heading
    row_index += 1

    sheet.cell(
        row=row_index,
        column=1,
        value=f"Generated {report.generated_at:%Y-%m-%d %H:%M}",
    )
    row_index += 1

    active_filters = {
        k: v for k, v in report.filters.items() if v not in (None, "")
    }

    if active_filters:
        sheet.cell(
            row=row_index,
            column=1,
            value="Filters: "
            + ", ".join(f"{k}={v}" for k, v in active_filters.items()),
        )
        row_index += 1

    row_index += 1

    # ---- summary block -------------------------------------------
    if report.summary:
        sheet.cell(row=row_index, column=1, value="Summary").font = label_font
        row_index += 1

        for label, value in report.summary.items():
            sheet.cell(row=row_index, column=1, value=label).font = label_font
            sheet.cell(row=row_index, column=2, value=value)
            row_index += 1

        row_index += 1

    # ---- header --------------------------------------------------
    header_row = row_index

    for column_index, column in enumerate(report.columns, start=1):
        cell = sheet.cell(
            row=header_row, column=column_index, value=column["label"]
        )
        cell.font = header_font
        cell.fill = header_fill
        cell.border = border
        cell.alignment = Alignment(horizontal="center")

    # ---- body ----------------------------------------------------
    for offset, row in enumerate(report.rows, start=1):
        for column_index, column in enumerate(report.columns, start=1):
            value = row.get(column["key"])

            cell = sheet.cell(
                row=header_row + offset, column=column_index, value=value
            )
            cell.border = border

            if column["type"] == "money":
                cell.number_format = "#,##0.00"
            elif column["type"] == "percent":
                cell.number_format = "0.00"
            elif column["type"] == "decimal":
                cell.number_format = "0.00"

    # ---- sizing --------------------------------------------------
    for column_index, column in enumerate(report.columns, start=1):
        width = max(
            len(str(column["label"])),
            *(
                len(str(row.get(column["key"], "") or ""))
                for row in report.rows[:200]
            ),
        ) if report.rows else len(str(column["label"]))

        sheet.column_dimensions[get_column_letter(column_index)].width = min(
            max(width + 2, 10), 42
        )

    sheet.freeze_panes = sheet.cell(row=header_row + 1, column=1)

    if report.rows:
        sheet.auto_filter.ref = (
            f"A{header_row}:"
            f"{get_column_letter(len(report.columns))}"
            f"{header_row + len(report.rows)}"
        )

    stream = io.BytesIO()
    workbook.save(stream)

    return stream.getvalue()


# --------------------------------------------------------------------------
# PDF export
# --------------------------------------------------------------------------

#: Beyond this the PDF stops being a document and starts being a data dump,
#: so it is truncated with a note pointing at the Excel export.
PDF_ROW_LIMIT = 400


def to_pdf(report: Report) -> bytes:
    """Render the report as a landscape A4 PDF."""

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle
    )

    stream = io.BytesIO()

    document = SimpleDocTemplate(
        stream,
        pagesize=landscape(A4),
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=report.title,
        author="VendorIQ",
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=16,
        spaceAfter=2,
        textColor=colors.HexColor("#1F3864"),
    )

    meta_style = ParagraphStyle(
        "Meta", parent=styles["Normal"], fontSize=8,
        textColor=colors.HexColor("#666666"),
    )

    cell_style = ParagraphStyle(
        "Cell", parent=styles["Normal"], fontSize=6.5, leading=8,
    )

    header_style = ParagraphStyle(
        "CellHeader", parent=cell_style, fontSize=6.5, leading=8,
        textColor=colors.white,
    )

    story = [Paragraph(report.title, title_style)]

    active_filters = {
        k: v for k, v in report.filters.items() if v not in (None, "")
    }

    meta = f"Generated {report.generated_at:%Y-%m-%d %H:%M} &middot; {len(report.rows)} row(s)"

    if active_filters:
        meta += " &middot; Filters: " + ", ".join(
            f"{k}={v}" for k, v in active_filters.items()
        )

    story.append(Paragraph(meta, meta_style))
    story.append(Spacer(1, 6 * mm))

    # ---- summary -------------------------------------------------
    if report.summary:
        summary_data = [
            [Paragraph(f"<b>{k}</b>", cell_style), Paragraph(str(v), cell_style)]
            for k, v in report.summary.items()
        ]

        summary_table = Table(summary_data, colWidths=[60 * mm, 60 * mm])
        summary_table.setStyle(
            TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDDDDD")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F4F6FA")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ])
        )

        story.append(summary_table)
        story.append(Spacer(1, 6 * mm))

    if not report.rows:
        story.append(
            Paragraph("No records matched the selected filters.", styles["Normal"])
        )
        document.build(story)
        return stream.getvalue()

    # ---- data table ----------------------------------------------
    truncated = report.rows[:PDF_ROW_LIMIT]

    header = [
        Paragraph(f"<b>{c['label']}</b>", header_style) for c in report.columns
    ]

    body = []

    for row in truncated:
        line = []

        for column in report.columns:
            value = row.get(column["key"])

            if value is None:
                text = ""
            elif column["type"] == "money":
                text = f"{_to_float(value):,.2f}"
            elif column["type"] in ("percent", "decimal"):
                text = f"{_to_float(value):.2f}"
            else:
                text = str(value)

            line.append(Paragraph(text[:120], cell_style))

        body.append(line)

    available = document.width
    weights = []

    for column in report.columns:
        if column["type"] in ("number", "percent", "decimal"):
            weights.append(0.7)
        elif column["type"] == "money":
            weights.append(1.0)
        elif column["key"] in ("remarks", "title", "item", "recommendation"):
            weights.append(2.2)
        else:
            weights.append(1.2)

    total_weight = sum(weights)
    widths = [available * w / total_weight for w in weights]

    table = Table([header] + body, colWidths=widths, repeatRows=1)

    table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F3864")),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#DDDDDD")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            (
                "ROWBACKGROUNDS",
                (0, 1),
                (-1, -1),
                [colors.white, colors.HexColor("#F7F9FC")],
            ),
        ])
    )

    story.append(table)

    if len(report.rows) > PDF_ROW_LIMIT:
        story.append(Spacer(1, 4 * mm))
        story.append(
            Paragraph(
                f"Showing the first {PDF_ROW_LIMIT} of {len(report.rows)} rows. "
                f"Export to Excel for the complete dataset.",
                meta_style,
            )
        )

    document.build(story)

    return stream.getvalue()


def filename_for(report: Report, extension: str) -> str:
    stamp = report.generated_at.strftime("%Y%m%d-%H%M")

    return f"{report.key}-{stamp}.{extension}"
