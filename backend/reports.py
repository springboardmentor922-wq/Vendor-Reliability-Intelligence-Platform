"""Milestone-3: Reports & Export module.

Raw data for every report is read LIVE from the database at request time.
Excel (.xlsx) is generated with openpyxl, CSV with the stdlib csv module
(UTF-8 BOM so Excel opens it cleanly). No pre-generated/cached files.

Report types:
  vendor-performance, suppliers, procurement, purchase-orders,
  compliance, contracts
"""
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

import models
from database import engine
from deps import get_current_user, get_db

router = APIRouter(prefix="/api/reports", tags=["reports"])

REPORT_TYPES = {
    "vendor-performance",
    "suppliers",
    "procurement",
    "purchase-orders",
    "compliance",
    "contracts",
}


# --------------------------------------------------------------------------
# Live data builders (each returns a list of dict rows)
# --------------------------------------------------------------------------

def _supplier_rows(db: Session) -> list[dict]:
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT product_card_id AS 'Supplier Code',
                   product_name AS 'Supplier',
                   category_name AS 'Category',
                   order_count AS 'Order Count',
                   ROUND(total_sales, 2) AS 'Total Sales',
                   on_time_rate AS 'On-Time Rate (%)',
                   late_rate AS 'Late Rate (%)',
                   cancel_rate AS 'Cancel Rate (%)',
                   complete_rate AS 'Completion Rate (%)',
                   avg_overdue_days AS 'Avg Overdue Days',
                   reliability_score AS 'Reliability Score',
                   risk_level AS 'Risk Level',
                   last_updated AS 'Last Updated'
            FROM dataset_suppliers
            ORDER BY reliability_score DESC""")).fetchall()
    return [dict(r._mapping) for r in rows]


def _procurement_rows(db: Session) -> list[dict]:
    requests = db.query(models.ProcurementRequest).all()
    rows = [{
        "Request ID": r.id,
        "Requested By": r.requested_by,
        "Description": r.description,
        "Quantity": r.quantity,
        "Required Date": r.required_date.isoformat() if r.required_date else "",
        "Status": r.status,
        "Created At": r.created_at.isoformat() if r.created_at else "",
    } for r in requests]

    with engine.connect() as conn:
        spend = conn.execute(text("""
            SELECT category_name AS 'Category',
                   ROUND(SUM(sales), 2) AS 'Total Spend',
                   COUNT(*) AS 'Orders'
            FROM dataset_orders GROUP BY category_name
            ORDER BY 'Total Spend' DESC""")).fetchall()
    rows.extend(dict(r._mapping) for r in spend)
    return rows


def _purchase_order_rows(db: Session) -> list[dict]:
    orders = db.query(models.PurchaseOrder).all()
    rows = []
    for o in orders:
        vendor = db.query(models.Vendor).filter(
            models.Vendor.id == o.vendor_id).first()
        rows.append({
            "PO ID": o.id,
            "PO Number": o.po_number or f"PO #{o.id}",
            "Vendor": vendor.company_name if vendor else o.vendor_id,
            "Created By": o.created_by,
            "Order Date": o.order_date.isoformat() if o.order_date else "",
            "Expected Delivery": (o.expected_delivery.isoformat()
                                  if o.expected_delivery else ""),
            "Status": o.status,
            "Total Amount": o.total_amount,
        })
    return rows


def _compliance_rows(db: Session) -> list[dict]:
    contracts = db.query(models.Contract).all()
    rows = []
    for c in contracts:
        vendor = db.query(models.Vendor).filter(
            models.Vendor.id == c.vendor_id).first()
        rows.append({
            "Contract ID": c.id,
            "Vendor": vendor.company_name if vendor else c.vendor_id,
            "Contract": c.contract_name,
            "Start Date": c.start_date.isoformat() if c.start_date else "",
            "End Date": c.end_date.isoformat() if c.end_date else "",
            "Status": c.status,
            "Compliance Status": c.compliance_status,
        })

    from collections import Counter
    counter = Counter(r["Compliance Status"] for r in rows)
    summary = [{"Compliance Status": k, "Count": v} for k, v in counter.items()]
    return rows + summary


def _contract_rows(db: Session) -> list[dict]:
    contracts = db.query(models.Contract).all()
    rows = []
    for c in contracts:
        vendor = db.query(models.Vendor).filter(
            models.Vendor.id == c.vendor_id).first()
        days_left = None
        if c.end_date:
            days_left = (c.end_date - datetime.utcnow()).days
        rows.append({
            "Contract ID": c.id,
            "Vendor": vendor.company_name if vendor else c.vendor_id,
            "Contract Name": c.contract_name,
            "Start Date": c.start_date.date().isoformat() if c.start_date else "",
            "End Date": c.end_date.date().isoformat() if c.end_date else "",
            "Days Left": days_left if days_left is not None else "",
            "Status": c.status,
            "Compliance Status": c.compliance_status,
        })
    return rows


def _invoice_rows(db: Session) -> list[dict]:
    invoices = db.query(models.Invoice).all()
    rows = []
    for inv in invoices:
        po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == inv.purchase_order_id).first()
        vendor = db.query(models.Vendor).filter(models.Vendor.id == inv.vendor_id).first()
        rows.append({
            "Invoice #": inv.invoice_number,
            "PO #": po.po_number if po and po.po_number else f"PO #{inv.purchase_order_id}",
            "Vendor": vendor.company_name if vendor else f"Vendor #{inv.vendor_id}",
            "Amount ($)": inv.amount,
            "Tax ($)": inv.tax_amount or 0.0,
            "Total ($)": round(inv.amount + (inv.tax_amount or 0.0), 2),
            "Status": inv.status,
            "Due Date": inv.due_date.date().isoformat() if inv.due_date else "",
            "Paid Date": inv.paid_date.date().isoformat() if inv.paid_date else "",
        })
    return rows


def _audit_rows(db: Session) -> list[dict]:
    logs = db.query(models.AuditLog).order_by(models.AuditLog.id.desc()).limit(200).all()
    rows = []
    for l in logs:
        user = db.query(models.User).filter(models.User.id == l.user_id).first() if l.user_id else None
        rows.append({
            "Log ID": l.id,
            "Timestamp": l.created_at.strftime("%Y-%m-%d %H:%M") if l.created_at else "",
            "User": user.name if user else ("System" if not l.user_id else f"User #{l.user_id}"),
            "Action": l.action,
            "Entity": l.entity_type,
            "Entity ID": l.entity_id or "",
            "Details": (l.details[:60] + "...") if l.details and len(l.details) > 60 else (l.details or ""),
        })
    return rows


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

REPORT_TYPES.update({"invoices", "audit-logs"})


# --------------------------------------------------------------------------
# Excel, CSV and PDF generators
# --------------------------------------------------------------------------

def _to_excel(rows: list[dict], sheet_name: str) -> bytes:
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name[:31] or "Sheet"
    if rows:
        headers = list(rows[0].keys())
        ws.append(headers)
        for cell in ws[1]:
            cell.font = cell.font.copy(bold=True)
        for r in rows:
            ws.append([r.get(h) for h in headers])
        for col, _ in enumerate(headers, start=1):
            max_len = max((len(str(r.get(headers[col - 1]))) if r.get(
                headers[col - 1]) is not None else 0) for r in rows) or 0
            ws.column_dimensions[ws.cell(row=1, column=col).column_letter].width = \
                min(max_len + 2, 50)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _to_csv(rows: list[dict]) -> str:
    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    return buf.getvalue()


def _to_pdf(rows: list[dict], report_name: str) -> bytes:
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(letter),
        leftMargin=30,
        rightMargin=30,
        topMargin=30,
        bottomMargin=30,
    )
    styles = getSampleStyleSheet()
    story = []

    # Title
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#0f172a'),
    )
    subtitle_style = ParagraphStyle(
        'SubtitleStyle',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#64748b'),
    )

    story.append(Paragraph(f"<b>Vendor Reliability Platform — {report_name.replace('-', ' ').title()} Report</b>", title_style))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC | Confidential Enterprise Data", subtitle_style))
    story.append(Spacer(1, 14))

    if not rows:
        story.append(Paragraph("No records found.", styles['Normal']))
    else:
        headers = list(rows[0].keys())
        # Truncate to first 8 columns to fit landscape nicely
        display_headers = headers[:8]

        cell_style = ParagraphStyle('CellStyle', parent=styles['Normal'], fontSize=7.5, leading=9)
        hdr_style = ParagraphStyle('HdrStyle', parent=styles['Normal'], fontSize=8, leading=10, textColor=colors.white, fontName='Helvetica-Bold')

        table_data = [[Paragraph(h, hdr_style) for h in display_headers]]
        for r in rows[:100]:  # up to 100 rows in PDF export
            row_cells = []
            for h in display_headers:
                val = str(r.get(h, "")) if r.get(h) is not None else ""
                row_cells.append(Paragraph(val, cell_style))
            table_data.append(row_cells)

        t = Table(table_data, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('TOPPADDING', (0, 0), (-1, 0), 6),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 1), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
        ]))
        story.append(t)

    doc.build(story)
    return buf.getvalue()


def _generated_rows(report_type: str, db: Session) -> list[dict]:
    if report_type not in _BUILDERS:
        raise HTTPException(status_code=404, detail="Unknown report type")
    return _BUILDERS[report_type](db)


@router.get("/{report_type}/download")
def download_report(
    report_type: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download report as .xlsx (Excel)."""
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=404, detail="Unknown report type")
    rows = _generated_rows(report_type, db)
    data = _to_excel(rows, report_type)
    filename = f"{report_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{report_type}/csv")
def download_report_csv(
    report_type: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download report as CSV."""
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=404, detail="Unknown report type")
    rows = _generated_rows(report_type, db)
    data = _to_csv(rows)
    filename = f"{report_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(("﻿" + data).encode("utf-8")),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{report_type}/pdf")
def download_report_pdf(
    report_type: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download report as formatted PDF."""
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=404, detail="Unknown report type")
    rows = _generated_rows(report_type, db)
    data = _to_pdf(rows, report_type)
    filename = f"{report_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{report_type}/preview")
def preview_report(
    report_type: str,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Preview a report's rows (head of the live dataset)."""
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=404, detail="Unknown report type")
    rows = _generated_rows(report_type, db)
    return {
        "report_type": report_type,
        "total_rows": len(rows),
        "columns": list(rows[0].keys()) if rows else [],
        "rows": rows[:limit],
        "generated_at": datetime.now().isoformat(),
    }