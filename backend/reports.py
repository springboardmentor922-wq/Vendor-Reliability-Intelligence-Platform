"""Live CSV, Excel and PDF reporting."""

from __future__ import annotations

import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

import models
from database import engine
from deps import get_current_user, get_db, normalize_role

router = APIRouter(prefix="/api/reports", tags=["reports"])
REPORT_TYPES = {
    "vendor-performance",
    "suppliers",
    "procurement",
    "purchase-orders",
    "compliance",
    "contracts",
    "invoices",
    "audit-logs",
}


def _supplier_rows(db, current_user=None):
    with engine.connect() as conn:
        rows = (
            conn.execute(
                text("""
            SELECT product_card_id AS "Supplier Code", product_name AS "Supplier", category_name AS "Category",
                   order_count AS "Order Count", ROUND(total_sales::numeric, 2) AS "Total Sales",
                   on_time_rate AS "On-Time Rate (%)", late_rate AS "Late Rate (%)", cancel_rate AS "Cancel Rate (%)",
                   complete_rate AS "Completion Rate (%)", avg_overdue_days AS "Avg Overdue Days",
                   reliability_score AS "Reliability Score", risk_level AS "Risk Level", last_updated AS "Last Updated"
            FROM dataset_suppliers ORDER BY reliability_score DESC NULLS LAST
        """)
            )
            .mappings()
            .all()
        )
    return [dict(r) for r in rows]


def _procurement_rows(db, current_user=None):
    query = db.query(models.ProcurementRequest)
    if current_user is not None and normalize_role(current_user.role) not in {
        "administrator",
        "procurement_manager",
        "supply_chain_manager",
        "auditor",
    }:
        query = query.filter(models.ProcurementRequest.requested_by == current_user.id)
    reqs = query.order_by(models.ProcurementRequest.id.desc()).all()
    rows = [
        {
            "Request ID": r.id,
            "Requested By": r.requested_by,
            "Description": r.description,
            "Quantity": r.quantity,
            "Department": r.department,
            "Priority": r.priority,
            "Estimated Budget": r.estimated_budget or 0,
            "Required Date": r.required_date.isoformat() if r.required_date else "",
            "Status": r.status,
            "Created At": r.created_at.isoformat() if r.created_at else "",
        }
        for r in reqs
    ]
    return rows


def _purchase_order_rows(db, current_user=None):
    query = db.query(models.PurchaseOrder)
    if current_user is not None and normalize_role(current_user.role) == "vendor":
        query = query.filter(models.PurchaseOrder.vendor_id == current_user.vendor_id)
    orders = query.order_by(models.PurchaseOrder.id.desc()).all()
    return [
        {
            "PO ID": o.id,
            "PO Number": o.po_number or f"PO #{o.id}",
            "Vendor": o.vendor.company_name if o.vendor else o.vendor_id,
            "Created By": o.created_by,
            "Order Date": o.order_date.isoformat() if o.order_date else "",
            "Expected Delivery": o.expected_delivery.isoformat()
            if o.expected_delivery
            else "",
            "Actual Delivery": o.actual_delivery.isoformat()
            if o.actual_delivery
            else "",
            "Status": o.status,
            "Subtotal": o.subtotal,
            "Tax": o.tax_amount,
            "Total Amount": o.total_amount,
        }
        for o in orders
    ]


def _compliance_rows(db, current_user=None):
    query = db.query(models.Contract)
    if current_user is not None and normalize_role(current_user.role) == "vendor":
        query = query.filter(models.Contract.vendor_id == current_user.vendor_id)
    contracts = query.order_by(models.Contract.end_date.asc()).all()
    rows = []
    for c in contracts:
        days_left = (c.end_date - datetime.utcnow()).days if c.end_date else None
        rows.append(
            {
                "Contract ID": c.id,
                "Vendor": c.vendor.company_name if c.vendor else c.vendor_id,
                "Contract": c.contract_name,
                "Reference": c.contract_reference or "",
                "Start Date": c.start_date.isoformat() if c.start_date else "",
                "End Date": c.end_date.isoformat() if c.end_date else "",
                "Days Left": days_left if days_left is not None else "",
                "Status": c.status,
                "Compliance Status": c.compliance_status,
            }
        )
    return rows


def _contract_rows(db, current_user=None):
    return _compliance_rows(db, current_user)


def _invoice_rows(db, current_user=None):
    query = db.query(models.Invoice)
    if current_user is not None and normalize_role(current_user.role) == "vendor":
        query = query.filter(models.Invoice.vendor_id == current_user.vendor_id)
    invoices = query.order_by(models.Invoice.id.desc()).all()
    return [
        {
            "Invoice #": i.invoice_number,
            "PO #": i.purchase_order.po_number
            if i.purchase_order and i.purchase_order.po_number
            else f"PO #{i.purchase_order_id}",
            "Vendor": i.vendor.company_name if i.vendor else i.vendor_id,
            "Amount": i.amount,
            "Tax": i.tax_amount or 0,
            "Total": round(i.amount + (i.tax_amount or 0), 2),
            "Status": i.status,
            "Due Date": i.due_date.isoformat() if i.due_date else "",
            "Paid Date": i.paid_date.isoformat() if i.paid_date else "",
        }
        for i in invoices
    ]


def _audit_rows(db):
    logs = (
        db.query(models.AuditLog).order_by(models.AuditLog.id.desc()).limit(1000).all()
    )
    return [
        {
            "Log ID": l.id,
            "Timestamp": l.created_at.isoformat() if l.created_at else "",
            "User": l.user.name
            if l.user
            else ("System" if not l.user_id else f"User #{l.user_id}"),
            "Action": l.action,
            "Entity": l.entity_type,
            "Entity ID": l.entity_id or "",
            "Details": l.details or "",
        }
        for l in logs
    ]


_BUILDERS = {
    "vendor-performance": _supplier_rows,
    "suppliers": _supplier_rows,
    "procurement": _procurement_rows,
    "purchase-orders": _purchase_order_rows,
    "compliance": _compliance_rows,
    "contracts": _contract_rows,
    "invoices": _invoice_rows,
    "audit-logs": _audit_rows,
}


def _to_excel(rows, sheet_name):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment

    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name[:31] or "Report"
    if rows:
        headers = list(rows[0].keys())
        ws.append(headers)
        for cell in ws[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="172033")
            cell.alignment = Alignment(vertical="center")
        for row in rows:
            ws.append([row.get(h) for h in headers])
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
        for i, header in enumerate(headers, 1):
            vals = [str(r.get(header) or "") for r in rows[:250]]
            width = min(max([len(header), *[len(v) for v in vals]] or [12]) + 2, 42)
            ws.column_dimensions[ws.cell(1, i).column_letter].width = width
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def _to_csv(rows):
    out = io.StringIO()
    if rows:
        writer = csv.DictWriter(out, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    return out.getvalue()


def _to_pdf(rows, report_name):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle,
    )

    out = io.BytesIO()
    doc = SimpleDocTemplate(
        out,
        pagesize=landscape(letter),
        leftMargin=30,
        rightMargin=30,
        topMargin=30,
        bottomMargin=30,
    )
    styles = getSampleStyleSheet()
    story = [
        Paragraph(
            f"VendorIQ — {report_name.replace('-', ' ').title()} Report",
            styles["Title"],
        ),
        Paragraph(
            f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
            styles["Normal"],
        ),
        Spacer(1, 12),
    ]
    if not rows:
        story.append(Paragraph("No records found.", styles["Normal"]))
    else:
        headers = list(rows[0].keys())[:9]
        data = [headers]
        for row in rows[:100]:
            data.append([str(row.get(h, ""))[:70] for h in headers])
        table = Table(data, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#172033")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 7),
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(table)
    doc.build(story)
    return out.getvalue()


def _generated_rows(report_type, db, current_user=None):
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=404, detail="Unknown report type")
    # Supplier intelligence is optional; return a graceful empty report if it isn't imported yet.
    if report_type in {"suppliers", "vendor-performance"}:
        try:
            return _BUILDERS[report_type](db, current_user)
        except Exception:
            return []
    return _BUILDERS[report_type](db, current_user)


def _guard(report_type, current_user):
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=404, detail="Unknown report type")
    role = normalize_role(current_user.role)
    allowed = {
        "administrator": REPORT_TYPES,
        "procurement_manager": {
            "vendor-performance",
            "procurement",
            "purchase-orders",
            "compliance",
            "contracts",
            "invoices",
        },
        "supply_chain_manager": {
            "vendor-performance",
            "procurement",
            "purchase-orders",
            "compliance",
            "contracts",
        },
        "finance_officer": {"purchase-orders", "invoices"},
        "auditor": REPORT_TYPES,
        "vendor": {"vendor-performance", "purchase-orders", "contracts", "invoices"},
    }
    if report_type not in allowed.get(role, set()):
        raise HTTPException(
            status_code=403, detail="You do not have permission to access this report"
        )


@router.get("/{report_type}/preview")
def preview_report(
    report_type: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _guard(report_type, current_user)
    rows = _generated_rows(report_type, db, current_user)
    return {
        "report_type": report_type,
        "total_rows": len(rows),
        "columns": list(rows[0].keys()) if rows else [],
        "rows": rows[:limit],
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/{report_type}/download")
def download_report(
    report_type: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _guard(report_type, current_user)
    data = _to_excel(_generated_rows(report_type, db, current_user), report_type)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={report_type}.xlsx"},
    )


@router.get("/{report_type}/csv")
def download_report_csv(
    report_type: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _guard(report_type, current_user)
    data = ("\ufeff" + _to_csv(_generated_rows(report_type, db, current_user))).encode(
        "utf-8"
    )
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={report_type}.csv"},
    )


@router.get("/{report_type}/pdf")
def download_report_pdf(
    report_type: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _guard(report_type, current_user)
    data = _to_pdf(_generated_rows(report_type, db, current_user), report_type)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={report_type}.pdf"},
    )
