from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user, require_roles_strict, require_roles
from app.models.user import User
from app.models.procurement import ProcurementRequest
from app.models.vendor_selection import VendorSelection
from app.models.financial_approval import FinancialApproval
from app.models.purchase_order import PurchaseOrder
from app.models.delivery import Delivery
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.vendor import Vendor
from app.models.vendor_metrics import VendorPerformance, VendorRisk
from app.models.audit_finding import AuditFinding, AuditReviewStatus
from app.models.communication import AuditLog

router = APIRouter(prefix="/auditor", tags=["Auditor Compliance & Traceability"])

class AuditFindingCreate(BaseModel):
    transaction_type: str # PurchaseRequisition, PurchaseOrder, Delivery, Invoice, Payment, VendorSelection
    transaction_id: int
    reference_number: Optional[str] = None
    finding_type: str # Discrepancy, SLA Breach, Budget Variance, Missing Approval, Compliance Warning
    severity: str = "Medium" # Low, Medium, High, Critical
    title: str
    description: str

class AuditReviewStatusUpdate(BaseModel):
    transaction_type: str
    transaction_id: int
    status: str # Compliant, Discrepancy Found, Under Audit, Cleared
    comments: Optional[str] = None

@router.get("/transactions")
def get_transaction_chain(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    auditor_user: User = Depends(require_roles(["Auditor", "Administrator"]))
):
    """
    Step 30: Auditor reviews complete transaction chains end-to-end.
    Traces: PR -> Vendor Selection -> Financial Approval -> PO -> Delivery -> Invoice -> Payment -> Vendor Metrics.
    """
    prs = db.query(ProcurementRequest).order_by(ProcurementRequest.id.desc()).all()

    chains = []
    for pr in prs:
        sel = pr.vendor_selections[-1] if pr.vendor_selections else None
        fin = pr.financial_approvals[-1] if pr.financial_approvals else None
        po = pr.purchase_orders[-1] if pr.purchase_orders else None
        delivery = po.deliveries[-1] if po and po.deliveries else None
        invoice = po.invoices[-1] if po and po.invoices else None
        payment = invoice.payments[-1] if invoice and invoice.payments else None

        # Check for audit status
        rev_status = db.query(AuditReviewStatus).filter(
            AuditReviewStatus.transaction_type == "ProcurementRequest",
            AuditReviewStatus.transaction_id == pr.id
        ).first()

        findings = db.query(AuditFinding).filter(
            AuditFinding.transaction_id == pr.id
        ).all()

        chain_record = {
            "requisition": {
                "id": pr.id,
                "request_number": pr.request_number,
                "department": pr.department,
                "title": pr.title,
                "quantity": pr.quantity,
                "estimated_budget": pr.estimated_budget,
                "status": pr.status,
                "requested_by": pr.requested_by.full_name if pr.requested_by else "N/A",
                "created_at": pr.created_at
            },
            "vendor_selection": {
                "id": sel.id if sel else None,
                "vendor_name": sel.vendor.name if sel and sel.vendor else None,
                "quotation_amount": sel.quotation_amount if sel else None,
                "justification": sel.justification if sel else None,
                "status": sel.status if sel else None,
                "selected_by": sel.selected_by.full_name if sel and sel.selected_by else None,
                "created_at": sel.created_at if sel else None
            } if sel else None,
            "financial_approval": {
                "id": fin.id if fin else None,
                "status": fin.status if fin else None,
                "budget_allocated": fin.budget_allocated if fin else None,
                "approved_by": fin.approved_by.full_name if fin and fin.approved_by else None,
                "approved_at": fin.approved_at if fin else None,
                "rejection_reason": fin.rejection_reason if fin else None
            } if fin else None,
            "purchase_order": {
                "id": po.id if po else None,
                "po_number": po.po_number if po else None,
                "total_amount": po.total_amount if po else None,
                "status": po.status if po else None,
                "issued_at": po.issued_at if po else None,
                "vendor_accepted_at": po.vendor_accepted_at if po else None,
                "carrier": po.carrier if po else None,
                "tracking_number": po.tracking_number if po else None
            } if po else None,
            "delivery": {
                "id": delivery.id if delivery else None,
                "expected_delivery_date": delivery.expected_delivery_date if delivery else None,
                "actual_delivery_date": delivery.actual_delivery_date if delivery else None,
                "ordered_quantity": delivery.ordered_quantity if delivery else None,
                "delivered_quantity": delivery.delivered_quantity if delivery else None,
                "delay_days": delivery.delay_days if delivery else 0,
                "status": delivery.delivery_status if delivery else None
            } if delivery else None,
            "invoice": {
                "id": invoice.id if invoice else None,
                "invoice_number": invoice.invoice_number if invoice else None,
                "amount": invoice.amount if invoice else None,
                "status": invoice.status if invoice else None,
                "three_way_match_status": invoice.three_way_match_status if invoice else None
            } if invoice else None,
            "payment": {
                "id": payment.id if payment else None,
                "transaction_reference": payment.transaction_reference if payment else None,
                "amount": payment.amount if payment else None,
                "payment_method": payment.payment_method if payment else None,
                "payment_date": payment.payment_date if payment else None,
                "status": payment.status if payment else None
            } if payment else None,
            "audit": {
                "review_status": rev_status.status if rev_status else "Unreviewed",
                "comments": rev_status.comments if rev_status else None,
                "findings_count": len(findings)
            }
        }

        if search:
            s = search.lower()
            match = (
                s in pr.request_number.lower() or
                s in pr.title.lower() or
                s in pr.department.lower() or
                (po and s in po.po_number.lower()) or
                (sel and sel.vendor and s in sel.vendor.name.lower())
            )
            if not match:
                continue

        chains.append(chain_record)

    return chains

@router.get("/discrepancies")
def check_discrepancies(
    db: Session = Depends(get_db),
    auditor_user: User = Depends(require_roles(["Auditor", "Administrator"]))
):
    """
    Automated Discrepancy Detection:
    - Quantity variance (ordered vs delivered)
    - Amount variance (PO total vs Invoice amount)
    - Delivery delays (> 3 days)
    - State inconsistencies
    """
    discrepancies = []

    # Check deliveries with variance or delay
    deliveries = db.query(Delivery).all()
    for d in deliveries:
        po = d.purchase_order
        if d.delivered_quantity < d.ordered_quantity:
            discrepancies.append({
                "type": "Quantity Shortfall",
                "severity": "Medium",
                "reference": po.po_number if po else f"Delivery-{d.id}",
                "description": f"PO {po.po_number if po else d.id}: Delivered quantity ({d.delivered_quantity}) is less than ordered quantity ({d.ordered_quantity}). Variance: {d.ordered_quantity - d.delivered_quantity} units.",
                "created_at": d.created_at
            })
        if d.delay_days >= 3:
            discrepancies.append({
                "type": "SLA Breach - Delay",
                "severity": "High" if d.delay_days >= 5 else "Medium",
                "reference": po.po_number if po else f"Delivery-{d.id}",
                "description": f"PO {po.po_number if po else d.id}: Delivery delayed by {d.delay_days} days beyond expected deadline.",
                "created_at": d.created_at
            })

    # Check invoice amounts vs PO totals
    invoices = db.query(Invoice).all()
    for inv in invoices:
        po = inv.purchase_order
        if po and abs(inv.amount - po.total_amount) > 1.0:
            discrepancies.append({
                "type": "Financial Discrepancy",
                "severity": "High",
                "reference": inv.invoice_number,
                "description": f"Invoice {inv.invoice_number} amount (${inv.amount:,.2f}) does not match PO {po.po_number} total (${po.total_amount:,.2f}).",
                "created_at": inv.created_at
            })

    # Check for state inconsistencies (e.g. PO or PR marked Completed/Delivered without delivery record)
    all_pos = db.query(PurchaseOrder).all()
    for po in all_pos:
        if po.status in ["Completed", "COMPLETED", "Delivered"] and not po.deliveries:
            discrepancies.append({
                "type": "State Inconsistency - Missing Delivery",
                "severity": "Critical",
                "reference": po.po_number,
                "description": f"PO {po.po_number} is marked as '{po.status}' but has no physical delivery receipt recorded in the system. Delivery is pending.",
                "created_at": po.updated_at or po.created_at
            })

    return discrepancies

@router.post("/findings", status_code=status.HTTP_201_CREATED)
def create_audit_finding(
    payload: AuditFindingCreate,
    db: Session = Depends(get_db),
    # Strict RBAC: ONLY Auditor can create audit findings!
    auditor_user: User = Depends(require_roles_strict(["Auditor"]))
):
    """Auditor creates an official audit finding / discrepancy report."""
    finding = AuditFinding(
        transaction_type=payload.transaction_type,
        transaction_id=payload.transaction_id,
        reference_number=payload.reference_number,
        auditor_id=auditor_user.id,
        finding_type=payload.finding_type,
        severity=payload.severity,
        title=payload.title,
        description=payload.description,
        status="OPEN"
    )
    db.add(finding)
    db.commit()
    db.refresh(finding)

    # Immutable audit log
    audit = AuditLog(
        user_id=auditor_user.id,
        user_name=auditor_user.full_name,
        user_role=auditor_user.role,
        action="AUDIT_FINDING_LOGGED",
        entity_type="AuditFinding",
        entity_id=finding.id,
        previous_status="NONE",
        new_status="OPEN",
        details=f"Auditor {auditor_user.full_name} logged [{payload.severity}] finding '{payload.title}' on {payload.transaction_type} #{payload.transaction_id}."
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Audit finding recorded: {finding.title}",
        "finding_id": finding.id,
        "status": finding.status,
        "severity": finding.severity
    }

@router.get("/findings")
def get_audit_findings(
    db: Session = Depends(get_db),
    auditor_user: User = Depends(require_roles(["Auditor", "Administrator"]))
):
    """Lists recorded audit findings."""
    findings = db.query(AuditFinding).order_by(AuditFinding.id.desc()).all()
    return [
        {
            "id": f.id,
            "transaction_type": f.transaction_type,
            "transaction_id": f.transaction_id,
            "reference_number": f.reference_number,
            "finding_type": f.finding_type,
            "severity": f.severity,
            "title": f.title,
            "description": f.description,
            "status": f.status,
            "resolution_notes": f.resolution_notes,
            "auditor_name": f.auditor.full_name if f.auditor else "Senior Auditor",
            "created_at": f.created_at
        }
        for f in findings
    ]

@router.post("/review-status")
def set_review_status(
    payload: AuditReviewStatusUpdate,
    db: Session = Depends(get_db),
    auditor_user: User = Depends(require_roles_strict(["Auditor"]))
):
    """Auditor marks compliance review status on a transaction."""
    rev = db.query(AuditReviewStatus).filter(
        AuditReviewStatus.transaction_type == payload.transaction_type,
        AuditReviewStatus.transaction_id == payload.transaction_id
    ).first()

    if not rev:
        rev = AuditReviewStatus(
            transaction_type=payload.transaction_type,
            transaction_id=payload.transaction_id,
            auditor_id=auditor_user.id
        )
        db.add(rev)

    prev_stat = rev.status
    rev.status = payload.status
    rev.comments = payload.comments
    rev.reviewed_at = datetime.utcnow()
    rev.auditor_id = auditor_user.id
    db.commit()

    # Immutable audit log
    audit = AuditLog(
        user_id=auditor_user.id,
        user_name=auditor_user.full_name,
        user_role=auditor_user.role,
        action="AUDIT_REVIEW_STATUS_UPDATED",
        entity_type=payload.transaction_type,
        entity_id=payload.transaction_id,
        previous_status=prev_stat,
        new_status=payload.status,
        details=f"Auditor {auditor_user.full_name} set review status to '{payload.status}' on {payload.transaction_type} #{payload.transaction_id}."
    )
    db.add(audit)
    db.commit()

    return {"message": f"Audit review status updated to {payload.status}.", "status": payload.status}
