"""
Reports & Export Router + Procurement Analytics — Milestone 3 Group C
Provides in-memory PDF and Excel generation across 5 domains and deep procurement analytics.
Read-only queries — does NOT alter existing schemas or endpoints.
"""
import io
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.database import get_db
from app.models import (
    Vendor, ProcurementRequest, PurchaseOrder, Contract, User
)
from app.security import get_current_user

# ReportLab imports for in-memory PDF generation
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

# OpenPyXL imports for in-memory Excel generation
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

router = APIRouter(prefix="/api/v1/reports", tags=["Reports & Export"])
analytics_router = APIRouter(prefix="/api/v1/analytics", tags=["Procurement Analytics"])


# ---------------------------------------------------------------------------
# In-Memory PDF & Excel Builders
# ---------------------------------------------------------------------------

def build_pdf_document(title: str, headers: List[str], rows: List[List[str]]) -> bytes:
    """Generate a clean, styled landscape PDF document in-memory."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=4
    )
    meta_style = ParagraphStyle(
        'ReportMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=14
    )
    cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#1e293b')
    )
    header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    elements = []
    # Title & Metadata
    elements.append(Paragraph(title, title_style))
    gen_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    elements.append(Paragraph(f"ProcureFlow Platform Report • Generated at {gen_time} • Confidential", meta_style))

    # Table data
    table_data = [[Paragraph(h, header_style) for h in headers]]
    for r in rows:
        table_data.append([Paragraph(str(c) if c is not None else "-", cell_style) for c in r])

    # Table styling
    t = Table(table_data, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f8fafc'), colors.white]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
    ]))

    elements.append(t)
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


def build_excel_workbook(title: str, headers: List[str], rows: List[List[str]]) -> bytes:
    """Generate a professionally styled Excel workbook in-memory."""
    wb = Workbook()
    ws = wb.active
    ws.title = title[:31]

    # Title Block
    ws.merge_cells('A1:G1')
    ws['A1'] = title
    ws['A1'].font = Font(name='Calibri', size=16, bold=True, color='1E293B')
    ws['A1'].alignment = Alignment(vertical='center')

    ws['A2'] = f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} | ProcureFlow Intelligence"
    ws['A2'].font = Font(name='Calibri', size=9, italic=True, color='64748B')
    ws.row_dimensions[1].height = 25
    ws.row_dimensions[2].height = 16

    # Headers at Row 4
    header_font = Font(name='Calibri', size=10, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='1E293B', end_color='1E293B', fill_type='solid')
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=4, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[4].height = 22

    # Data Rows
    data_font = Font(name='Calibri', size=9.5)
    alt_fill = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')

    for r_idx, row_vals in enumerate(rows, 5):
        is_alt = (r_idx % 2 == 0)
        for c_idx, val in enumerate(row_vals, 1):
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            cell.font = data_font
            cell.border = thin_border
            if is_alt:
                cell.fill = alt_fill
            cell.alignment = Alignment(vertical='center')
        ws.row_dimensions[r_idx].height = 18

    # Auto-fit column widths
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = max(len(str(cell.value or '')) for cell in col)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def create_report_response(
    report_name: str,
    headers: List[str],
    rows: List[List[str]],
    file_format: str
) -> Response:
    """Helper to assemble response with correct Content-Disposition and MIME type."""
    fmt = file_format.lower().strip()
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    clean_name = report_name.lower().replace(" ", "_")

    if fmt == "pdf":
        pdf_bytes = build_pdf_document(report_name, headers, rows)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{clean_name}_{timestamp}.pdf"'
            }
        )
    elif fmt in ("excel", "xlsx"):
        excel_bytes = build_excel_workbook(report_name, headers, rows)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{clean_name}_{timestamp}.xlsx"'
            }
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid format specified. Must be 'pdf' or 'excel'."
        )


# Allowed roles for report generation and export
ALLOWED_REPORT_ROLES = {"Administrator", "Procurement Manager", "Finance Officer"}


async def require_reports_access(current_user: User = Depends(get_current_user)) -> User:
    """
    Role check dependency for report exports.
    Allowed roles: Administrator, Procurement Manager, Finance Officer.
    Performs case-insensitive, whitespace-stripped comparison.
    Blocks any other roles (e.g. Vendor, Auditor, Supply Chain Manager) with 403 Forbidden.
    """
    user_roles = [r.name.strip() for r in current_user.roles]
    # Administrator check (matches "Administrator", "admin", "administrator", "Admin")
    if any(r.lower() in ("administrator", "admin") for r in user_roles):
        return current_user

    allowed_lower = {role.lower() for role in ALLOWED_REPORT_ROLES}
    if not any(r.lower() in allowed_lower for r in user_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Operation not permitted. Required roles: {sorted(list(ALLOWED_REPORT_ROLES))}"
        )
    return current_user


# ---------------------------------------------------------------------------
# 5 Report Endpoints
# ---------------------------------------------------------------------------

@router.get("/vendor-performance")
async def export_vendor_performance_report(
    format: str = Query("pdf", description="Export format: pdf or excel"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reports_access),
):
    """Generates Vendor Performance & Reliability Audit Report."""
    stmt = (
        select(Vendor)
        .options(
            selectinload(Vendor.performance_entries),
            selectinload(Vendor.reliability_snapshots)
        )
    )
    result = await db.execute(stmt)
    vendors = result.scalars().all()

    headers = [
        "Company Name", "Registration No", "Category", "Status",
        "Reliability Score", "Risk Tier", "Avg Quality", "On-Time Delivery %", "Total Evaluations"
    ]

    rows = []
    for v in vendors:
        entries = v.performance_entries or []
        snaps = v.reliability_snapshots or []

        latest_snap = max(snaps, key=lambda s: s.computed_at) if snaps else None
        rel_score = f"{latest_snap.overall_reliability_score:.1f}" if latest_snap else "100.0"
        risk_tier = latest_snap.risk_level if latest_snap else "Low"

        if entries:
            total_on_time = sum(e.on_time_deliveries for e in entries)
            total_delayed = sum(e.delayed_deliveries for e in entries)
            total_deliv = total_on_time + total_delayed
            ot_rate = f"{(total_on_time / total_deliv * 100.0):.1f}%" if total_deliv > 0 else "100.0%"
            avg_qual = f"{(sum(e.quality_rating for e in entries) / len(entries)):.2f}"
            tot_evals = str(len(entries))
        else:
            ot_rate = "100.0%"
            avg_qual = "5.00"
            tot_evals = "0"

        rows.append([
            v.company_name, v.registration_no, v.category, v.status,
            rel_score, risk_tier, avg_qual, ot_rate, tot_evals
        ])

    return create_report_response("Vendor Performance and Reliability Report", headers, rows, format)


@router.get("/procurement")
async def export_procurement_report(
    format: str = Query("pdf", description="Export format: pdf or excel"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reports_access),
):
    """Generates Procurement Pipeline Requisitions Report."""
    stmt = (
        select(ProcurementRequest)
        .options(
            selectinload(ProcurementRequest.requester),
            selectinload(ProcurementRequest.line_items)
        )
        .order_by(ProcurementRequest.created_at.desc())
    )
    result = await db.execute(stmt)
    prs = result.scalars().all()

    headers = [
        "Requisition Title", "Requester", "Status", "Items Count",
        "Total Est. Cost ($)", "Created Date", "Description"
    ]

    rows = []
    for pr in prs:
        requester_name = pr.requester.full_name if pr.requester else "System"
        items_count = str(len(pr.line_items or []))
        cost = f"${float(pr.total_estimated_cost or 0):,.2f}"
        created = pr.created_at.strftime("%Y-%m-%d") if pr.created_at else "-"
        desc = (pr.description or "")[:45]

        rows.append([pr.title, requester_name, pr.status, items_count, cost, created, desc])

    return create_report_response("Procurement Requisitions Pipeline Report", headers, rows, format)


@router.get("/purchase-orders")
async def export_purchase_orders_report(
    format: str = Query("pdf", description="Export format: pdf or excel"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reports_access),
):
    """Generates Purchase Orders & Commitments Register Report."""
    stmt = (
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.items)
        )
        .order_by(PurchaseOrder.created_at.desc())
    )
    result = await db.execute(stmt)
    pos = result.scalars().all()

    headers = [
        "PO Number", "Vendor Name", "Total Amount ($)", "Status",
        "Delivery Status", "Items Count", "Issued Date"
    ]

    rows = []
    for po in pos:
        vendor_name = po.vendor.company_name if po.vendor else "Unassigned"
        amount = f"${float(po.total_amount or 0):,.2f}"
        items_count = str(len(po.items or []))
        issued = po.created_at.strftime("%Y-%m-%d") if po.created_at else "-"

        rows.append([po.po_number, vendor_name, amount, po.status, po.delivery_status, items_count, issued])

    return create_report_response("Purchase Orders Spend Register Report", headers, rows, format)


@router.get("/compliance")
async def export_compliance_report(
    format: str = Query("pdf", description="Export format: pdf or excel"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reports_access),
):
    """Generates Vendor Compliance & Risk Audit Report."""
    stmt = (
        select(Vendor)
        .options(
            selectinload(Vendor.contracts),
            selectinload(Vendor.reliability_snapshots)
        )
    )
    result = await db.execute(stmt)
    vendors = result.scalars().all()

    headers = [
        "Vendor Name", "Registration No", "Category", "Risk Tier",
        "Reliability Score", "Active Contracts", "Compliance Flags"
    ]

    now = datetime.utcnow()
    rows = []
    for v in vendors:
        snaps = v.reliability_snapshots or []
        latest = max(snaps, key=lambda s: s.computed_at) if snaps else None
        risk_tier = latest.risk_level if latest else "Low"
        score = f"{latest.overall_reliability_score:.1f}" if latest else "100.0"

        contracts = v.contracts or []
        active_c = sum(1 for c in contracts if c.status.upper() == "ACTIVE" and (c.end_date is None or c.end_date > now))

        flags = [c.compliance_flags for c in contracts if c.compliance_flags and c.compliance_flags.lower() not in ("none", "none.", "n/a", "verified")]
        flags_str = "; ".join(flags) if flags else "Clean / Compliant"

        rows.append([v.company_name, v.registration_no, v.category, risk_tier, score, str(active_c), flags_str])

    return create_report_response("Vendor Risk and Compliance Directory Report", headers, rows, format)


@router.get("/contracts")
async def export_contracts_report(
    format: str = Query("pdf", description="Export format: pdf or excel"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reports_access),
):
    """Generates Master Contracts & SLA Governance Report."""
    stmt = (
        select(Contract)
        .options(selectinload(Contract.vendor))
        .order_by(Contract.start_date.desc())
    )
    result = await db.execute(stmt)
    contracts = result.scalars().all()

    headers = [
        "Contract Title", "Vendor Name", "Start Date", "End Date",
        "Notice (Days)", "Status", "Compliance Flags"
    ]

    rows = []
    for c in contracts:
        v_name = c.vendor.company_name if c.vendor else "Unknown"
        s_date = c.start_date.strftime("%Y-%m-%d") if c.start_date else "-"
        e_date = c.end_date.strftime("%Y-%m-%d") if c.end_date else "-"
        notice = str(int(c.renewal_notice_period_days or 30))
        flags = c.compliance_flags or "None"

        rows.append([c.title, v_name, s_date, e_date, notice, c.status, flags])

    return create_report_response("Contracts and SLA Governance Report", headers, rows, format)


# ---------------------------------------------------------------------------
# PART 2 — Procurement Analytics Endpoint
# ---------------------------------------------------------------------------

class MonthlySpendItem(BaseModel):
    month: str
    spend: float
    order_count: int

class TopVendorSpendItem(BaseModel):
    vendor_id: str
    company_name: str
    total_spend: float
    order_count: int

class CategorySpendItem(BaseModel):
    category: str
    total_spend: float
    vendor_count: int

class ProcurementAnalyticsResponse(BaseModel):
    monthly_spend_trend: List[MonthlySpendItem]
    top_vendors_by_spend: List[TopVendorSpendItem]
    category_spend: List[CategorySpendItem]
    average_approval_time_hours: Optional[float] = None
    request_to_po_conversion_rate: float
    total_spend: float
    total_orders: int
    total_requests: int


@analytics_router.get("/procurement", response_model=ProcurementAnalyticsResponse)
async def get_procurement_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Deeper procurement analytics:
    - Monthly spend trends over the last 6 months
    - Top vendors ranked by committed PO spend
    - Category-wise spend breakdown
    - Average approval turnaround (documented null fallback where granular history not stored)
    - Request-to-PO conversion rate
    """
    # 1. Fetch all POs with vendors
    po_stmt = select(PurchaseOrder).options(selectinload(PurchaseOrder.vendor))
    po_res = await db.execute(po_stmt)
    all_pos = po_res.scalars().all()

    # 2. Fetch all PRs with line items & POs
    pr_stmt = select(ProcurementRequest).options(selectinload(ProcurementRequest.purchase_orders))
    pr_res = await db.execute(pr_stmt)
    all_prs = pr_res.scalars().all()

    # Monthly Spend Trend (last 6 calendar months)
    now = datetime.utcnow()
    months_map: dict[str, dict] = {}
    for i in range(5, -1, -1):
        # Calculate year and month
        y = now.year
        m = now.month - i
        while m <= 0:
            m += 12
            y -= 1
        m_key = f"{y:04d}-{m:02d}"
        months_map[m_key] = {"spend": 0.0, "order_count": 0}

    total_po_spend = 0.0
    vendor_spend_map: dict[str, dict] = {}
    category_spend_map: dict[str, dict] = {}

    for po in all_pos:
        amt = float(po.total_amount or 0)
        total_po_spend += amt

        # Monthly grouping
        if po.created_at:
            po_m = po.created_at.strftime("%Y-%m")
            if po_m in months_map:
                months_map[po_m]["spend"] += amt
                months_map[po_m]["order_count"] += 1

        # Vendor grouping
        if po.vendor:
            vid = str(po.vendor.id)
            if vid not in vendor_spend_map:
                vendor_spend_map[vid] = {
                    "vendor_id": vid,
                    "company_name": po.vendor.company_name,
                    "total_spend": 0.0,
                    "order_count": 0
                }
            vendor_spend_map[vid]["total_spend"] += amt
            vendor_spend_map[vid]["order_count"] += 1

            # Category grouping
            cat = po.vendor.category or "Uncategorized"
            if cat not in category_spend_map:
                category_spend_map[cat] = {"category": cat, "total_spend": 0.0, "vendor_ids": set()}
            category_spend_map[cat]["total_spend"] += amt
            category_spend_map[cat]["vendor_ids"].add(vid)

    monthly_spend_trend = [
        MonthlySpendItem(month=m, spend=round(v["spend"], 2), order_count=v["order_count"])
        for m, v in sorted(months_map.items())
    ]

    top_vendors = sorted(
        [
            TopVendorSpendItem(
                vendor_id=v["vendor_id"],
                company_name=v["company_name"],
                total_spend=round(v["total_spend"], 2),
                order_count=v["order_count"]
            )
            for v in vendor_spend_map.values()
        ],
        key=lambda x: x.total_spend,
        reverse=True
    )[:5]

    category_spend = [
        CategorySpendItem(
            category=cat,
            total_spend=round(data["total_spend"], 2),
            vendor_count=len(data["vendor_ids"])
        )
        for cat, data in sorted(category_spend_map.items(), key=lambda item: item[1]["total_spend"], reverse=True)
    ]

    # Conversion rate: PRs converted to POs
    total_prs = len(all_prs)
    converted_prs = sum(1 for pr in all_prs if pr.purchase_orders and len(pr.purchase_orders) > 0 or pr.status.lower() in ("converted_to_po", "ordered", "delivered", "completed"))
    conversion_rate = round((converted_prs / total_prs * 100.0), 2) if total_prs > 0 else 0.0

    # Average approval time: The procurement_requests table contains created_at but does not track
    # an approved_at timestamp column in its schema. Hence returning None as per specification.
    avg_approval_time = None

    return ProcurementAnalyticsResponse(
        monthly_spend_trend=monthly_spend_trend,
        top_vendors_by_spend=top_vendors,
        category_spend=category_spend,
        average_approval_time_hours=avg_approval_time,
        request_to_po_conversion_rate=conversion_rate,
        total_spend=round(total_po_spend, 2),
        total_orders=len(all_pos),
        total_requests=total_prs
    )
