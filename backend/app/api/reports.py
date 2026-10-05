from io import BytesIO
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder
from app.models.contract import Contract
from app.models.vendor_performance import VendorPerformance


router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"],
)


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------

def decimal_value(value):
    if value is None:
        return 0.0

    return float(value)


def delivery_status(
    expected_date,
    actual_date,
):
    if actual_date is None:
        if expected_date and expected_date < date.today():
            return "Delayed"

        return "Pending"

    if expected_date and actual_date <= expected_date:
        return "On Time"

    return "Delayed"


def calculate_vendor_performance(
    db: Session,
    vendor: Vendor,
):
    orders = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.vendor_id == vendor.id)
        .all()
    )

    evaluations = (
        db.query(VendorPerformance)
        .filter(VendorPerformance.vendor_id == vendor.id)
        .all()
    )

    total_orders = len(orders)

    on_time = 0
    delayed = 0

    for order in orders:

        status = delivery_status(
            order.expected_delivery_date,
            None,
        )

        if order.status in ["Delivered", "Completed"]:
            # Without a delivery date stored on the PO,
            # completed orders are treated as completed
            # rather than artificially classified as delayed.
            on_time += 1
        elif status == "Delayed":
            delayed += 1

    quality_values = [
        decimal_value(item.quality_rating)
        for item in evaluations
        if item.quality_rating is not None
    ]

    service_values = [
        decimal_value(item.service_rating)
        for item in evaluations
        if item.service_rating is not None
    ]

    response_values = [
        decimal_value(item.response_time_hours)
        for item in evaluations
        if item.response_time_hours is not None
    ]

    resolution_values = [
        decimal_value(item.issue_resolution_time_hours)
        for item in evaluations
        if item.issue_resolution_time_hours is not None
    ]

    quality = (
        sum(quality_values) / len(quality_values)
        if quality_values
        else None
    )

    service = (
        sum(service_values) / len(service_values)
        if service_values
        else None
    )

    response = (
        sum(response_values) / len(response_values)
        if response_values
        else None
    )

    resolution = (
        sum(resolution_values) / len(resolution_values)
        if resolution_values
        else None
    )

    completion_rate = (
        (
            sum(
                1
                for order in orders
                if order.status == "Completed"
            )
            / total_orders
        )
        * 100
        if total_orders
        else 0
    )

    delivery_rate = (
        (on_time / total_orders) * 100
        if total_orders
        else 0
    )

    quality_score = (
        (quality / 5) * 100
        if quality is not None
        else 0
    )

    service_score = (
        (service / 5) * 100
        if service is not None
        else 0
    )

    response_score = (
        max(0, 100 - response * 5)
        if response is not None
        else 0
    )

    resolution_score = (
        max(0, 100 - resolution * 3)
        if resolution is not None
        else 0
    )

    performance_score = (
        delivery_rate * 0.30
        + completion_rate * 0.20
        + quality_score * 0.20
        + service_score * 0.15
        + response_score * 0.075
        + resolution_score * 0.075
    )

    return {
        "vendor_id": vendor.id,
        "vendor_name": vendor.name,
        "category": vendor.category,
        "status": vendor.status,
        "total_orders": total_orders,
        "on_time_deliveries": on_time,
        "delayed_deliveries": delayed,
        "quality_rating": quality,
        "service_rating": service,
        "response_time_hours": response,
        "issue_resolution_time_hours": resolution,
        "order_completion_rate": round(
            completion_rate,
            2,
        ),
        "performance_score": round(
            performance_score,
            2,
        ),
    }


# ---------------------------------------------------------
# Vendor Performance
# ---------------------------------------------------------

@router.get("/vendor-performance")
def vendor_performance_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendors = (
        db.query(Vendor)
        .order_by(Vendor.name)
        .all()
    )

    return [
        calculate_vendor_performance(db, vendor)
        for vendor in vendors
    ]


# ---------------------------------------------------------
# Procurement Report
# ---------------------------------------------------------

@router.get("/procurement")
def procurement_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = (
        db.query(func.count(PurchaseOrder.id))
        .scalar()
        or 0
    )

    def status_count(status):
        return (
            db.query(func.count(PurchaseOrder.id))
            .filter(PurchaseOrder.status == status)
            .scalar()
            or 0
        )

    total_cost = (
        db.query(
            func.coalesce(
                func.sum(PurchaseOrder.total_amount),
                0,
            )
        )
        .scalar()
        or 0
    )

    average = (
        db.query(
            func.coalesce(
                func.avg(PurchaseOrder.total_amount),
                0,
            )
        )
        .scalar()
        or 0
    )

    return {
        "total_purchase_orders": total,
        "pending_orders": status_count("Pending"),
        "approved_orders": status_count("Approved"),
        "ordered_orders": status_count("Ordered"),
        "delivered_orders": status_count("Delivered"),
        "completed_orders": status_count("Completed"),
        "cancelled_orders": status_count("Cancelled"),
        "total_procurement_cost": total_cost,
        "average_order_value": average,
    }


# ---------------------------------------------------------
# Purchase Order Report
# ---------------------------------------------------------

@router.get("/purchase-orders")
def purchase_order_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(
            PurchaseOrder,
            Vendor.name,
        )
        .join(
            Vendor,
            PurchaseOrder.vendor_id == Vendor.id,
        )
        .order_by(PurchaseOrder.order_date.desc())
        .all()
    )

    result = []

    for order, vendor_name in rows:

        result.append(
            {
                "id": order.id,
                "po_number": order.po_number,
                "order_date": str(order.order_date),
                "expected_delivery_date": str(
                    order.expected_delivery_date
                ),
                "vendor_name": vendor_name,
                "department": order.department,
                "payment_terms": order.payment_terms,
                "status": order.status,
                "subtotal": order.subtotal,
                "tax_amount": order.tax_amount,
                "total_amount": order.total_amount,
            }
        )

    return result


# ---------------------------------------------------------
# Compliance Report
# ---------------------------------------------------------

@router.get("/compliance")
def compliance_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(
            Contract,
            Vendor.name,
        )
        .join(
            Vendor,
            Contract.vendor_id == Vendor.id,
        )
        .order_by(Contract.end_date)
        .all()
    )

    result = []

    for contract, vendor_name in rows:

        result.append(
            {
                "contract_id": contract.id,
                "contract_number": contract.contract_number,
                "contract_title": contract.title,
                "vendor_name": vendor_name,
                "start_date": str(contract.start_date),
                "end_date": str(contract.end_date),
                "contract_status": contract.status,
                "compliance_status": contract.compliance_status,
                "contract_value": contract.contract_value,
            }
        )

    return result


# ---------------------------------------------------------
# Contract Report
# ---------------------------------------------------------

@router.get("/contracts")
def contract_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(
            Contract,
            Vendor.name,
        )
        .join(
            Vendor,
            Contract.vendor_id == Vendor.id,
        )
        .order_by(Contract.end_date)
        .all()
    )

    result = []

    for contract, vendor_name in rows:

        result.append(
            {
                "id": contract.id,
                "contract_number": contract.contract_number,
                "title": contract.title,
                "contract_type": contract.contract_type,
                "vendor_name": vendor_name,
                "start_date": str(contract.start_date),
                "end_date": str(contract.end_date),
                "renewal_date": (
                    str(contract.renewal_date)
                    if contract.renewal_date
                    else None
                ),
                "status": contract.status,
                "compliance_status": contract.compliance_status,
                "contract_value": contract.contract_value,
                "payment_terms": contract.payment_terms,
            }
        )

    return result


# ---------------------------------------------------------
# Excel generation
# ---------------------------------------------------------

def create_excel(
    title,
    headers,
    rows,
):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Report"

    sheet.append([title])
    sheet.append([])

    sheet.append(headers)

    for row in rows:
        sheet.append(row)

    sheet["A1"].font = Font(
        bold=True,
        size=16,
    )

    for cell in sheet[3]:
        cell.font = Font(
            bold=True,
        )
        cell.fill = PatternFill(
            "solid",
            fgColor="D9E1F2",
        )

    for column in sheet.columns:

        max_length = 0

        for cell in column:

            value = (
                str(cell.value)
                if cell.value is not None
                else ""
            )

            max_length = max(
                max_length,
                len(value),
            )

        width = min(
            max_length + 2,
            40,
        )

        sheet.column_dimensions[
            get_column_letter(
                column[0].column
            )
        ].width = width

    output = BytesIO()
    workbook.save(output)
    output.seek(0)

    return output


# ---------------------------------------------------------
# PDF generation
# ---------------------------------------------------------

def create_pdf(
    title,
    headers,
    rows,
):
    output = BytesIO()

    document = SimpleDocTemplate(
        output,
        pagesize=landscape(A4),
        rightMargin=25,
        leftMargin=25,
        topMargin=25,
        bottomMargin=25,
    )

    styles = getSampleStyleSheet()

    story = [
        Paragraph(
            title,
            styles["Title"],
        ),
        Spacer(1, 15),
    ]

    table_data = [
        headers
    ] + rows

    table = Table(
        table_data,
        repeatRows=1,
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.lightgrey,
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, 0),
                    colors.black,
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 0),
                    "Helvetica-Bold",
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.grey,
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
            ]
        )
    )

    story.append(table)

    document.build(story)

    output.seek(0)

    return output


# ---------------------------------------------------------
# Excel exports
# ---------------------------------------------------------

@router.get("/vendor-performance/excel")
def export_vendor_performance_excel(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = vendor_performance_report(
        db,
        current_user,
    )

    headers = [
        "Vendor",
        "Category",
        "Status",
        "Total Orders",
        "On-Time Deliveries",
        "Delayed Deliveries",
        "Quality Rating",
        "Service Rating",
        "Response Time Hours",
        "Issue Resolution Hours",
        "Completion Rate %",
        "Performance Score",
    ]

    rows = [
        [
            item["vendor_name"],
            item["category"],
            item["status"],
            item["total_orders"],
            item["on_time_deliveries"],
            item["delayed_deliveries"],
            item["quality_rating"],
            item["service_rating"],
            item["response_time_hours"],
            item["issue_resolution_time_hours"],
            item["order_completion_rate"],
            item["performance_score"],
        ]
        for item in data
    ]

    output = create_excel(
        "Vendor Performance Report",
        headers,
        rows,
    )

    return StreamingResponse(
        output,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition":
                "attachment; filename="
                "vendor_performance_report.xlsx"
        },
    )


@router.get("/procurement/excel")
def export_procurement_excel(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = procurement_report(
        db,
        current_user,
    )

    headers = [
        "Metric",
        "Value",
    ]

    rows = [
        ["Total Purchase Orders", data["total_purchase_orders"]],
        ["Pending", data["pending_orders"]],
        ["Approved", data["approved_orders"]],
        ["Ordered", data["ordered_orders"]],
        ["Delivered", data["delivered_orders"]],
        ["Completed", data["completed_orders"]],
        ["Cancelled", data["cancelled_orders"]],
        ["Total Procurement Cost", data["total_procurement_cost"]],
        ["Average Order Value", data["average_order_value"]],
    ]

    output = create_excel(
        "Procurement Report",
        headers,
        rows,
    )

    return StreamingResponse(
        output,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition":
                "attachment; filename=procurement_report.xlsx"
        },
    )


@router.get("/purchase-orders/excel")
def export_purchase_orders_excel(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = purchase_order_report(
        db,
        current_user,
    )

    headers = [
        "PO Number",
        "Order Date",
        "Expected Delivery",
        "Vendor",
        "Department",
        "Payment Terms",
        "Status",
        "Subtotal",
        "Tax",
        "Total",
    ]

    rows = [
        [
            item["po_number"],
            item["order_date"],
            item["expected_delivery_date"],
            item["vendor_name"],
            item["department"],
            item["payment_terms"],
            item["status"],
            item["subtotal"],
            item["tax_amount"],
            item["total_amount"],
        ]
        for item in data
    ]

    output = create_excel(
        "Purchase Order Report",
        headers,
        rows,
    )

    return StreamingResponse(
        output,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition":
                "attachment; filename=purchase_orders_report.xlsx"
        },
    )


@router.get("/compliance/excel")
def export_compliance_excel(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = compliance_report(
        db,
        current_user,
    )

    headers = [
        "Contract Number",
        "Contract",
        "Vendor",
        "Start Date",
        "End Date",
        "Contract Status",
        "Compliance Status",
        "Contract Value",
    ]

    rows = [
        [
            item["contract_number"],
            item["contract_title"],
            item["vendor_name"],
            item["start_date"],
            item["end_date"],
            item["contract_status"],
            item["compliance_status"],
            item["contract_value"],
        ]
        for item in data
    ]

    output = create_excel(
        "Compliance Report",
        headers,
        rows,
    )

    return StreamingResponse(
        output,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition":
                "attachment; filename=compliance_report.xlsx"
        },
    )


@router.get("/contracts/excel")
def export_contracts_excel(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = contract_report(
        db,
        current_user,
    )

    headers = [
        "Contract Number",
        "Title",
        "Type",
        "Vendor",
        "Start Date",
        "End Date",
        "Renewal Date",
        "Status",
        "Compliance",
        "Contract Value",
        "Payment Terms",
    ]

    rows = [
        [
            item["contract_number"],
            item["title"],
            item["contract_type"],
            item["vendor_name"],
            item["start_date"],
            item["end_date"],
            item["renewal_date"],
            item["status"],
            item["compliance_status"],
            item["contract_value"],
            item["payment_terms"],
        ]
        for item in data
    ]

    output = create_excel(
        "Contract Report",
        headers,
        rows,
    )

    return StreamingResponse(
        output,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition":
                "attachment; filename=contract_report.xlsx"
        },
    )


# ---------------------------------------------------------
# PDF exports
# ---------------------------------------------------------

@router.get("/vendor-performance/pdf")
def export_vendor_performance_pdf(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = vendor_performance_report(
        db,
        current_user,
    )

    headers = [
        "Vendor",
        "Category",
        "Orders",
        "On Time",
        "Delayed",
        "Quality",
        "Service",
        "Completion %",
        "Score",
    ]

    rows = [
        [
            item["vendor_name"],
            item["category"],
            item["total_orders"],
            item["on_time_deliveries"],
            item["delayed_deliveries"],
            item["quality_rating"],
            item["service_rating"],
            item["order_completion_rate"],
            item["performance_score"],
        ]
        for item in data
    ]

    output = create_pdf(
        "Vendor Performance Report",
        headers,
        rows,
    )

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                "attachment; filename="
                "vendor_performance_report.pdf"
        },
    )


@router.get("/procurement/pdf")
def export_procurement_pdf(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = procurement_report(
        db,
        current_user,
    )

    headers = [
        "Metric",
        "Value",
    ]

    rows = [
        ["Total Purchase Orders", data["total_purchase_orders"]],
        ["Pending", data["pending_orders"]],
        ["Approved", data["approved_orders"]],
        ["Ordered", data["ordered_orders"]],
        ["Delivered", data["delivered_orders"]],
        ["Completed", data["completed_orders"]],
        ["Cancelled", data["cancelled_orders"]],
        ["Total Procurement Cost", data["total_procurement_cost"]],
        ["Average Order Value", data["average_order_value"]],
    ]

    output = create_pdf(
        "Procurement Report",
        headers,
        rows,
    )

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                "attachment; filename=procurement_report.pdf"
        },
    )


@router.get("/purchase-orders/pdf")
def export_purchase_orders_pdf(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = purchase_order_report(
        db,
        current_user,
    )

    headers = [
        "PO Number",
        "Order Date",
        "Expected",
        "Vendor",
        "Department",
        "Status",
        "Total",
    ]

    rows = [
        [
            item["po_number"],
            item["order_date"],
            item["expected_delivery_date"],
            item["vendor_name"],
            item["department"],
            item["status"],
            item["total_amount"],
        ]
        for item in data
    ]

    output = create_pdf(
        "Purchase Order Report",
        headers,
        rows,
    )

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                "attachment; filename=purchase_orders_report.pdf"
        },
    )


@router.get("/compliance/pdf")
def export_compliance_pdf(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = compliance_report(
        db,
        current_user,
    )

    headers = [
        "Contract",
        "Vendor",
        "Start",
        "End",
        "Status",
        "Compliance",
        "Value",
    ]

    rows = [
        [
            item["contract_number"],
            item["vendor_name"],
            item["start_date"],
            item["end_date"],
            item["contract_status"],
            item["compliance_status"],
            item["contract_value"],
        ]
        for item in data
    ]

    output = create_pdf(
        "Compliance Report",
        headers,
        rows,
    )

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                "attachment; filename=compliance_report.pdf"
        },
    )


@router.get("/contracts/pdf")
def export_contracts_pdf(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = contract_report(
        db,
        current_user,
    )

    headers = [
        "Contract",
        "Title",
        "Type",
        "Vendor",
        "Start",
        "End",
        "Status",
        "Compliance",
        "Value",
    ]

    rows = [
        [
            item["contract_number"],
            item["title"],
            item["contract_type"],
            item["vendor_name"],
            item["start_date"],
            item["end_date"],
            item["status"],
            item["compliance_status"],
            item["contract_value"],
        ]
        for item in data
    ]

    output = create_pdf(
        "Contract Report",
        headers,
        rows,
    )

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                "attachment; filename=contract_report.pdf"
        },
    )