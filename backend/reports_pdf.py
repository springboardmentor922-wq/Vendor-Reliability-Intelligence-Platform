"""
VendorIQ PDF Report Generator
Generates enterprise PDF reports using ReportLab.
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from backend.database import get_db
from backend.calculations import compute_vendor_performance_and_reliability

def generate_vendor_performance_pdf(vendor_id: int) -> bytes:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vendors WHERE id = ?", (vendor_id,))
    v = cursor.fetchone()
    if not v:
        conn.close()
        raise ValueError("Vendor not found")

    metrics = compute_vendor_performance_and_reliability(vendor_id, conn)

    # Fetch recent POs
    cursor.execute("""
        SELECT po_number, order_date, expected_delivery_date, actual_delivery_date, total_amount, status
        FROM purchase_orders
        WHERE vendor_id = ?
        ORDER BY order_date DESC LIMIT 10
    """, (vendor_id,))
    pos = cursor.fetchall()
    conn.close()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a')
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b')
    )
    heading2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#1e293b')
    )
    normal_style = styles['Normal']
    normal_style.fontSize = 9
    normal_style.leading = 12

    story = []

    # Header
    story.append(Paragraph("VendorIQ Enterprise Intelligence", subtitle_style))
    story.append(Paragraph(f"Vendor Performance & Reliability Audit: {v['company_name']}", title_style))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC | Vendor Code: {v['vendor_code']} | Category: {v['category']}", subtitle_style))
    story.append(Spacer(1, 15))

    # Executive Summary Table
    summary_data = [
        [Paragraph("<b>Status</b>", normal_style), Paragraph(f"<b>{v['status']}</b>", normal_style),
         Paragraph("<b>Overall Reliability Score</b>", normal_style), Paragraph(f"<b>{metrics['overall_reliability']} / 100</b>", normal_style)],
        [Paragraph("<b>Risk Level</b>", normal_style), Paragraph(f"<b>{metrics['risk_level']} Risk</b>", normal_style),
         Paragraph("<b>Procurement Recommendation</b>", normal_style), Paragraph(f"<b>{metrics['recommendation']}</b>", normal_style)],
        [Paragraph("<b>On-Time Delivery Rate</b>", normal_style), Paragraph(f"{metrics['delivery_rate']}%", normal_style),
         Paragraph("<b>Product Quality Rating</b>", normal_style), Paragraph(f"{metrics['avg_quality_rating']} / 5.0", normal_style)],
        [Paragraph("<b>Order Completion Rate</b>", normal_style), Paragraph(f"{metrics['order_completion_rate']}%", normal_style),
         Paragraph("<b>Avg Response Time</b>", normal_style), Paragraph(f"{metrics['avg_response_hours']} hrs", normal_style)],
    ]
    t_summary = Table(summary_data, colWidths=[130, 140, 140, 130])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 15))

    # 6-Factor Reliability Breakdown
    story.append(Paragraph("6-Factor Reliability Scoring Breakdown", heading2_style))
    story.append(Spacer(1, 6))

    factors_table_data = [
        ["Factor", "Weight", "Calculated Score", "Points Earned", "Diagnostic Evidence"]
    ]
    for key, f in metrics['factors'].items():
        fname = key.replace('_', ' ').title()
        factors_table_data.append([
            Paragraph(f"<b>{fname}</b>", normal_style),
            f"{int(f['weight']*100)}%",
            f"{f['score']} / 100",
            f"{f['weighted_points']}",
            Paragraph(f['description'], normal_style)
        ])

    t_factors = Table(factors_table_data, colWidths=[120, 50, 90, 80, 200])
    t_factors.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0,1), (-1,-1), 5),
        ('BOTTOMPADDING', (0,1), (-1,-1), 5),
    ]))
    story.append(t_factors)
    story.append(Spacer(1, 15))

    # Recent Purchase Orders
    story.append(Paragraph("Recent Purchase Order Execution History", heading2_style))
    story.append(Spacer(1, 6))

    po_table_data = [["PO Number", "Order Date", "Expected Delivery", "Actual Delivery", "Amount", "Status"]]
    for p in pos:
        po_table_data.append([
            p["po_number"],
            str(p["order_date"]),
            str(p["expected_delivery_date"]),
            str(p["actual_delivery_date"]) if p["actual_delivery_date"] else "Pending",
            f"${p['total_amount']:,.2f}",
            p["status"]
        ])

    t_pos = Table(po_table_data, colWidths=[80, 80, 95, 95, 90, 100])
    t_pos.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0,1), (-1,-1), 4),
        ('BOTTOMPADDING', (0,1), (-1,-1), 4),
    ]))
    story.append(t_pos)

    doc.build(story)
    return buffer.getvalue()

def generate_procurement_summary_pdf() -> bytes:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT po.po_number, v.company_name, v.category, po.order_date,
               po.expected_delivery_date, po.actual_delivery_date, po.total_amount, po.status
        FROM purchase_orders po
        JOIN vendors v ON po.vendor_id = v.id
        ORDER BY po.order_date DESC
    """)
    pos = cursor.fetchall()

    cursor.execute("SELECT COUNT(*), SUM(total_amount) FROM purchase_orders")
    total_count, total_spend = cursor.fetchone()
    conn.close()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=colors.HexColor('#0f172a')
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#64748b')
    )
    normal_style = styles['Normal']
    normal_style.fontSize = 8
    normal_style.leading = 10

    story = []
    story.append(Paragraph("VendorIQ Enterprise Intelligence", subtitle_style))
    story.append(Paragraph("Executive Procurement & Order Tracking Report", title_style))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC | Total Orders: {total_count} | Total Procurement Value: ${total_spend or 0:,.2f}", subtitle_style))
    story.append(Spacer(1, 15))

    po_data = [["PO #", "Vendor", "Category", "Order Date", "Expected", "Actual", "Amount", "Status"]]
    for p in pos:
        po_data.append([
            p["po_number"],
            p["company_name"][:20],
            p["category"][:15],
            str(p["order_date"]),
            str(p["expected_delivery_date"]),
            str(p["actual_delivery_date"]) if p["actual_delivery_date"] else "—",
            f"${p['total_amount']:,.0f}",
            p["status"]
        ])

    t_po = Table(po_data, colWidths=[70, 110, 85, 60, 60, 60, 50, 45])
    t_po.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_po)

    doc.build(story)
    return buffer.getvalue()
