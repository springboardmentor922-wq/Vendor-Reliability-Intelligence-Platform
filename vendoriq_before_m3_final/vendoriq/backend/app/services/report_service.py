"""Reports & Export module: builds Vendor Performance, Procurement, Purchase
Order, Compliance and Contract reports from live database queries, and
exports them as PDF or Excel files on disk under uploads/reports/."""
import os
from datetime import datetime
import uuid
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from app.core.config import settings

REPORTS_DIR = os.path.abspath(os.path.join(settings.UPLOAD_DIR, "reports"))
os.makedirs(REPORTS_DIR, exist_ok=True)


def _filename(report_type: str, ext: str) -> str:
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    return os.path.join(REPORTS_DIR, f"{report_type}_{ts}_{uuid.uuid4().hex[:8]}.{ext}")


def build_excel(report_type: str, title: str, headers: list[str], rows: list[list[Any]]) -> str:
    wb = Workbook()
    ws = wb.active
    ws.title = title[:31]

    ws.append([title])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"])
    ws.append([])

    header_row_idx = 4
    ws.append(headers)
    for cell in ws[header_row_idx]:
        cell.font = Font(bold=True)

    for row in rows:
        ws.append(row)

    for col in ws.columns:
        max_len = max((len(str(c.value)) for c in col if c.value is not None), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 45)

    path = _filename(report_type, "xlsx")
    wb.save(path)
    return path


def build_pdf(report_type: str, title: str, headers: list[str], rows: list[list[Any]]) -> str:
    path = _filename(report_type, "pdf")
    doc = SimpleDocTemplate(path, pagesize=landscape(A4))
    styles = getSampleStyleSheet()
    elements = [
        Paragraph(title, styles["Title"]),
        Paragraph(f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]),
        Spacer(1, 12),
    ]

    data = [headers] + [[str(v) for v in row] for row in rows]
    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f6f9")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    elements.append(table)
    doc.build(elements)
    return path
