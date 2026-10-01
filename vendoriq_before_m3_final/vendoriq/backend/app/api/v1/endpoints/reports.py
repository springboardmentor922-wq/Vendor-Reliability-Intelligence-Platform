from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.utils import log_activity
from app.db.session_dep import get_db
from app.models.user import User
from app.models.vendor import Vendor
from app.models.procurement import ProcurementRequest
from app.models.purchase_order import PurchaseOrder
from app.models.contract import Contract, Certification, CertificationStatus
from app.services import performance_service, reliability_service, report_service

router = APIRouter()

ReportFormat = Query("xlsx", pattern="^(json|xlsx|pdf)$")


def _respond(format: str, report_type: str, title: str, headers: list, rows: list):
    if format == "json":
        return {"title": title, "headers": headers, "rows": rows}
    if format == "xlsx":
        path = report_service.build_excel(report_type, title, headers, rows)
        return FileResponse(path, filename=path.split("/")[-1], media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    path = report_service.build_pdf(report_type, title, headers, rows)
    return FileResponse(path, filename=path.split("/")[-1], media_type="application/pdf")


@router.get("/vendor-performance")
def vendor_performance_report(
    format: str = ReportFormat, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    headers = ["Vendor", "Category", "On-Time Rate %", "Quality Rating", "Completion Rate %", "Reliability Score", "Risk Level"]
    rows = []
    for v in db.query(Vendor).all():
        m = performance_service.get_vendor_metrics(db, v.id)
        latest = reliability_service.get_latest_score(db, v.id)
        rows.append([
            v.company_name, v.category.value, m["on_time_rate"], m["quality_rating"], m["order_completion_rate"],
            latest.score if latest else "N/A", latest.risk_level.value if latest else "N/A",
        ])
    log_activity(db, current_user.id, "report_generated", "report", None, "Vendor Performance Report")
    return _respond(format, "vendor_performance", "Vendor Performance Report", headers, rows)


@router.get("/procurement")
def procurement_report(format: str = ReportFormat, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    headers = ["Request #", "Title", "Department", "Priority", "Budget", "Status", "Requested"]
    rows = [
        [r.request_number, r.title, r.department or "-", r.priority.value, r.estimated_budget, r.status.value, r.created_at.strftime("%Y-%m-%d")]
        for r in db.query(ProcurementRequest).order_by(ProcurementRequest.created_at.desc()).all()
    ]
    log_activity(db, current_user.id, "report_generated", "report", None, "Procurement Report")
    return _respond(format, "procurement", "Procurement Report", headers, rows)


@router.get("/purchase-orders")
def purchase_order_report(format: str = ReportFormat, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    headers = ["PO #", "Vendor", "Total Amount", "Status", "Order Date", "Expected Delivery", "Actual Delivery"]
    rows = []
    for po in db.query(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).all():
        vendor = db.query(Vendor).filter(Vendor.id == po.vendor_id).first()
        rows.append([
            po.po_number, vendor.company_name if vendor else "-", po.total_amount, po.status.value,
            po.order_date.strftime("%Y-%m-%d") if po.order_date else "-",
            po.expected_delivery_date.strftime("%Y-%m-%d") if po.expected_delivery_date else "-",
            po.actual_delivery_date.strftime("%Y-%m-%d") if po.actual_delivery_date else "-",
        ])
    log_activity(db, current_user.id, "report_generated", "report", None, "Purchase Order Report")
    return _respond(format, "purchase_orders", "Purchase Order Report", headers, rows)


@router.get("/compliance")
def compliance_report(format: str = ReportFormat, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    headers = ["Vendor", "Certification", "Issuing Body", "Expiry Date", "Status"]
    rows = []
    for cert in db.query(Certification).all():
        vendor = db.query(Vendor).filter(Vendor.id == cert.vendor_id).first()
        rows.append([
            vendor.company_name if vendor else "-", cert.name, cert.issuing_body or "-",
            cert.expiry_date.strftime("%Y-%m-%d") if cert.expiry_date else "-", cert.status.value,
        ])
    log_activity(db, current_user.id, "report_generated", "report", None, "Compliance Report")
    return _respond(format, "compliance", "Compliance Report", headers, rows)


@router.get("/contracts")
def contract_report(format: str = ReportFormat, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    headers = ["Contract #", "Vendor", "Title", "Value", "Start Date", "End Date", "Status"]
    rows = []
    for c in db.query(Contract).order_by(Contract.end_date.asc()).all():
        vendor = db.query(Vendor).filter(Vendor.id == c.vendor_id).first()
        rows.append([
            c.contract_number, vendor.company_name if vendor else "-", c.title, c.value,
            c.start_date.strftime("%Y-%m-%d"), c.end_date.strftime("%Y-%m-%d"), c.status.value,
        ])
    log_activity(db, current_user.id, "report_generated", "report", None, "Contract Report")
    return _respond(format, "contracts", "Contract Report", headers, rows)
