from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, get_current_user, require_roles_strict, require_roles
from app.models.user import User
from app.models.procurement import ProcurementRequest
from app.models.vendor_selection import VendorSelection
from app.models.financial_approval import FinancialApproval
from app.models.purchase_order import PurchaseOrder
from app.models.delivery import Delivery
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.communication import AuditLog
from app.services.notification_service import send_notification_async
from app.services.reliability_engine import calculate_vendor_metrics_async
from app.services.blockchain_service import record_blockchain_audit_async

router = APIRouter(prefix="/finance", tags=["Finance Officer Operations"])

class FinancialApprovalRequest(BaseModel):
    budget_allocated: float
    comments: Optional[str] = "Budget verified and allocated against department operating account."

class FinancialRejectionRequest(BaseModel):
    rejection_reason: str

class PaymentProcessingRequest(BaseModel):
    invoice_id: int
    amount: float
    payment_method: str = "Electronic Funds Transfer"
    transaction_reference: str
    notes: Optional[str] = None

@router.get("/pending-approvals")
def get_pending_financial_approvals(
    db: Session = Depends(get_db),
    fin_user: User = Depends(require_roles_strict(["Finance Officer"]))
):
    """
    Step 12 & 13: Finance Officer views vendor selections awaiting budget verification.
    """
    selections = db.query(VendorSelection).options(
        joinedload(VendorSelection.requisition),
        joinedload(VendorSelection.vendor),
        joinedload(VendorSelection.selected_by)
    ).filter(
        VendorSelection.status == "Awaiting Financial Approval"
    ).order_by(VendorSelection.id.desc()).all()

    return [
        {
            "selection_id": s.id,
            "requisition_id": s.requisition_id,
            "request_number": s.requisition.request_number if s.requisition else "",
            "department": s.requisition.department if s.requisition else "",
            "title": s.requisition.title if s.requisition else "",
            "quantity": s.requisition.quantity if s.requisition else 0,
            "estimated_budget": s.requisition.estimated_budget if s.requisition else 0,
            "vendor_id": s.vendor_id,
            "vendor_name": s.vendor.name if s.vendor else "Unknown",
            "vendor_company": s.vendor.company if (s.vendor and s.vendor.company) else (s.vendor.name if s.vendor else "Unknown"),
            "vendor": {
                "id": s.vendor.id,
                "name": s.vendor.name,
                "company": s.vendor.company,
                "category": s.vendor.category
            } if s.vendor else None,
            "quotation_amount": s.quotation_amount,
            "justification": s.justification,
            "selected_by": s.selected_by.full_name if s.selected_by else "Procurement Manager",
            "created_at": s.created_at
        }
        for s in selections
    ]

@router.post("/approvals/{selection_id}/approve")
def approve_financial_request(
    selection_id: int,
    payload: FinancialApprovalRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    fin_user: User = Depends(require_roles_strict(["Finance Officer"]))
):
    """
    Step 14 & 15: Finance Officer approves financial request.
    PR advances to 'FINANCE_APPROVED' / 'READY_FOR_PO'.
    Step 15: Supply Chain Manager receives notification asynchronously.
    """
    selection = db.query(VendorSelection).options(
        joinedload(VendorSelection.requisition),
        joinedload(VendorSelection.vendor)
    ).filter(VendorSelection.id == selection_id).first()
    if not selection:
        raise HTTPException(status_code=404, detail="Vendor selection not found")

    pr = selection.requisition
    if not pr:
        raise HTTPException(status_code=404, detail="Linked Purchase Requisition not found")

    # Record financial approval
    approval = FinancialApproval(
        requisition_id=pr.id,
        vendor_selection_id=selection.id,
        approved_by_id=fin_user.id,
        budget_allocated=float(payload.budget_allocated),
        status="Approved",
        comments=payload.comments
    )
    db.add(approval)

    # Update selection state
    selection.status = "Approved"

    # Advance requisition to READY_FOR_PO so Supply Chain Manager receives it in Ready for PO Drafting
    pr.status = "READY_FOR_PO"
    pr.approval_date = datetime.utcnow()
    pr.approved_by_id = fin_user.id
    pr.updated_at = datetime.utcnow()

    # Flush to generate IDs
    db.flush()

    # Immutable audit log in the same atomic transaction
    audit = AuditLog(
        user_id=fin_user.id,
        user_name=fin_user.full_name,
        user_role=fin_user.role,
        action="FINANCE_APPROVED",
        entity_type="FinancialApproval",
        entity_id=approval.id,
        previous_status="VENDOR_SELECTED",
        new_status="READY_FOR_PO",
        details=f"Finance Officer {fin_user.full_name} approved budget of ${payload.budget_allocated:,.2f} for {pr.request_number}. Forwarded to Supply Chain Manager for PO drafting."
    )
    db.add(audit)
    db.commit()
    db.refresh(approval)

    try:
        from app.routers.dashboard import clear_dashboard_cache
        clear_dashboard_cache()
    except Exception:
        pass

    # Secondary notification to SCM runs asynchronously
    vendor_label = selection.vendor.name if selection.vendor else "Assigned Vendor"
    background_tasks.add_task(
        send_notification_async,
        title="Vendor Selection Financially Approved",
        message=f"Financially approved vendor selection for {pr.request_number} ({vendor_label}, Allocated Budget: ${payload.budget_allocated:,.2f}) is ready for PO drafting.",
        target_role="Supply Chain Manager",
        ref_id=pr.id,
        ref_type="ProcurementRequest",
        notif_type="order"
    )

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="FinancialApproval",
        entity_id=approval.id,
        action="FINANCE_APPROVED",
        actor_id=fin_user.id,
        metadata={"requisition_id": pr.id, "budget_allocated": payload.budget_allocated, "vendor": vendor_label}
    )

    return {
        "message": f"Financial approval granted for {pr.request_number}. Request forwarded to Supply Chain Manager for PO drafting.",
        "approval_id": approval.id,
        "requisition_id": pr.id,
        "request_number": pr.request_number,
        "allocated_budget": approval.budget_allocated,
        "vendor_id": selection.vendor_id,
        "vendor_name": vendor_label,
        "vendor_company": selection.vendor.company if (selection.vendor and selection.vendor.company) else vendor_label,
        "status": "READY_FOR_PO"
    }

@router.post("/approvals/{selection_id}/reject")
def reject_financial_request(
    selection_id: int,
    payload: FinancialRejectionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    fin_user: User = Depends(require_roles_strict(["Finance Officer"]))
):
    """
    Step 14 (Rejection): Finance Officer rejects financial request with reason.
    Returns request to previous stage (UNDER_REVIEW / REJECTED_FINANCE).
    """
    if not payload.rejection_reason or not payload.rejection_reason.strip():
        raise HTTPException(status_code=400, detail="A clear rejection reason is mandatory.")

    selection = db.query(VendorSelection).filter(VendorSelection.id == selection_id).first()
    if not selection:
        raise HTTPException(status_code=404, detail="Vendor selection not found")

    pr = selection.requisition

    approval = FinancialApproval(
        requisition_id=pr.id,
        vendor_selection_id=selection.id,
        approved_by_id=fin_user.id,
        budget_allocated=0.0,
        status="Rejected",
        rejection_reason=payload.rejection_reason
    )
    db.add(approval)

    selection.status = "Rejected"
    selection.rejection_reason = payload.rejection_reason
    
    pr.status = "REJECTED_FINANCE"
    pr.rejection_reason = payload.rejection_reason
    pr.updated_at = datetime.utcnow()

    db.flush()

    audit = AuditLog(
        user_id=fin_user.id,
        user_name=fin_user.full_name,
        user_role=fin_user.role,
        action="FINANCE_REJECTED",
        entity_type="FinancialApproval",
        entity_id=approval.id,
        previous_status="Awaiting Financial Approval",
        new_status="REJECTED_FINANCE",
        reason=payload.rejection_reason,
        details=f"Finance Officer {fin_user.full_name} rejected financial request for {pr.request_number}. Reason: {payload.rejection_reason}"
    )
    db.add(audit)
    db.commit()

    try:
        from app.routers.dashboard import clear_dashboard_cache
        clear_dashboard_cache()
    except Exception:
        pass

    # Background notifications
    background_tasks.add_task(
        send_notification_async,
        title="Financial Request Rejected",
        message=f"Financial approval for {pr.request_number} was rejected by Finance. Reason: {payload.rejection_reason}",
        target_role="Procurement Manager",
        ref_id=pr.id,
        ref_type="ProcurementRequest",
        notif_type="alert"
    )

    if pr.requested_by_id:
        background_tasks.add_task(
            send_notification_async,
            title="Requisition Returned by Finance",
            message=f"Financial approval for your requisition {pr.request_number} was rejected. Reason: {payload.rejection_reason}",
            user_id=pr.requested_by_id,
            ref_id=pr.id,
            ref_type="ProcurementRequest",
            notif_type="alert"
        )

    return {
        "message": f"Financial request for {pr.request_number} rejected and returned to procurement.",
        "requisition_id": pr.id,
        "status": pr.status,
        "rejection_reason": payload.rejection_reason
    }

@router.get("/invoices")
def get_invoices_for_verification(
    db: Session = Depends(get_db),
    fin_user: User = Depends(require_roles(["Finance Officer", "Auditor"]))
):
    """Step 26: Finance Officer views invoices and delivery data ready for 3-way match."""
    invoices = db.query(Invoice).options(
        joinedload(Invoice.vendor),
        joinedload(Invoice.purchase_order).joinedload(PurchaseOrder.deliveries),
        joinedload(Invoice.payments)
    ).order_by(Invoice.id.desc()).all()

    result = []
    for inv in invoices:
        po = inv.purchase_order
        delivery = po.deliveries[-1] if (po and po.deliveries) else None
        v_name = inv.vendor.name if inv.vendor else "Unknown"
        v_comp = inv.vendor.company if (inv.vendor and inv.vendor.company) else v_name
        result.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "purchase_order_id": inv.purchase_order_id,
            "po_number": po.po_number if po else "N/A",
            "po_total": po.total_amount if po else 0,
            "vendor_id": inv.vendor_id,
            "vendor_name": v_name,
            "vendor_company": v_comp,
            "vendor": {
                "id": inv.vendor.id,
                "name": v_name,
                "company": v_comp,
                "category": inv.vendor.category
            } if inv.vendor else None,
            "amount": inv.amount,
            "status": inv.status,
            "three_way_match_status": inv.three_way_match_status,
            "blockchain_status": getattr(inv, "blockchain_status", "CONFIRMED"),
            "issue_date": inv.issue_date,
            "due_date": inv.due_date,
            "delivery": {
                "delivered_quantity": delivery.delivered_quantity if delivery else None,
                "ordered_quantity": delivery.ordered_quantity if delivery else None,
                "delay_days": delivery.delay_days if delivery else 0,
                "delivery_status": delivery.delivery_status if delivery else None
            } if delivery else None,
            "has_payment": len(inv.payments) > 0 if inv.payments else False
        })
    return result

@router.post("/invoices/{invoice_id}/verify-3way-match")
def verify_three_way_match(
    invoice_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    fin_user: User = Depends(require_roles_strict(["Finance Officer"]))
):
    """
    Step 27: Finance Officer verifies invoice against PO and physical delivery confirmation.
    Performs automated 3-Way Match Check (PO vs Delivery vs Invoice).
    """
    inv = db.query(Invoice).options(
        joinedload(Invoice.purchase_order).joinedload(PurchaseOrder.deliveries),
        joinedload(Invoice.vendor)
    ).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    po = inv.purchase_order
    if not po:
        raise HTTPException(status_code=400, detail="Invoice is not linked to an approved Purchase Order.")

    delivery = po.deliveries[-1] if po.deliveries else None
    if not delivery:
        raise HTTPException(status_code=400, detail="Cannot verify invoice: physical delivery has not been recorded by Supply Chain.")

    discrepancies = []
    if abs(inv.amount - po.total_amount) > 1.0:
        discrepancies.append(f"Amount mismatch: Invoice amount (${inv.amount:,.2f}) differs from PO total (${po.total_amount:,.2f}).")
    if delivery.delivered_quantity < delivery.ordered_quantity:
        discrepancies.append(f"Quantity variance: Delivered {delivery.delivered_quantity} of {delivery.ordered_quantity} ordered.")

    if discrepancies:
        inv.three_way_match_status = "DISCREPANCY"
        inv.status = "DISPUTED"
        inv.verified_by_id = fin_user.id
        inv.verified_at = datetime.utcnow()
        inv.notes = "; ".join(discrepancies)
        
        audit = AuditLog(
            user_id=fin_user.id,
            user_name=fin_user.full_name,
            user_role=fin_user.role,
            action="INVOICE_3WAY_MATCH_DISCREPANCY",
            entity_type="Invoice",
            entity_id=inv.id,
            previous_status="INVOICE_RECEIVED",
            new_status="DISPUTED",
            details=f"Discrepancy detected during 3-way match for invoice {inv.invoice_number}: {'; '.join(discrepancies)}"
        )
        db.add(audit)
        db.commit()

        return {
            "status": "DISCREPANCY",
            "message": "3-Way Match detected discrepancies!",
            "discrepancies": discrepancies,
            "invoice_status": inv.status
        }
    else:
        inv.three_way_match_status = "MATCHED"
        inv.status = "VERIFIED"
        inv.verified_by_id = fin_user.id
        inv.verified_at = datetime.utcnow()
        inv.notes = "3-Way Match verified: PO, physical delivery, and invoice values match completely."

        audit = AuditLog(
            user_id=fin_user.id,
            user_name=fin_user.full_name,
            user_role=fin_user.role,
            action="INVOICE_3WAY_MATCH_VERIFIED",
            entity_type="Invoice",
            entity_id=inv.id,
            previous_status="INVOICE_RECEIVED",
            new_status="VERIFIED",
            details=f"Finance Officer {fin_user.full_name} verified 3-way match for invoice {inv.invoice_number} against PO {po.po_number} and delivery."
        )
        db.add(audit)
        db.commit()

        background_tasks.add_task(
            record_blockchain_audit_async,
            entity_type="Invoice",
            entity_id=inv.id,
            action="INVOICE_3WAY_MATCH_VERIFIED",
            actor_id=fin_user.id,
            metadata={"invoice_number": inv.invoice_number, "match_status": "MATCHED"}
        )

        return {
            "status": "MATCHED",
            "message": "3-Way Match successful: PO amount, delivery quantity, and invoice match completely. Ready for payment processing.",
            "invoice_status": inv.status
        }

@router.post("/payments")
def process_payment(
    payload: PaymentProcessingRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    fin_user: User = Depends(require_roles_strict(["Finance Officer"]))
):
    """
    Step 28 & 29: Finance Officer processes payment.
    Transaction completes in single atomic commit.
    Step 30: Auditor notified in background.
    Step 31-34: System updates vendor reliability score & risk analysis in background!
    """
    inv = db.query(Invoice).options(
        joinedload(Invoice.purchase_order).joinedload(PurchaseOrder.vendor),
        joinedload(Invoice.purchase_order).joinedload(PurchaseOrder.procurement_request)
    ).filter(Invoice.id == payload.invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    po = inv.purchase_order
    if not po:
        raise HTTPException(status_code=400, detail="Invoice has no associated Purchase Order")

    vendor_id = po.vendor_id
    vendor_name = po.vendor.name if po.vendor else "Assigned Vendor"
    vendor_company = po.vendor.company if (po.vendor and po.vendor.company) else vendor_name

    payment = Payment(
        invoice_id=inv.id,
        purchase_order_id=po.id,
        processed_by_id=fin_user.id,
        amount=float(payload.amount),
        payment_method=payload.payment_method,
        transaction_reference=payload.transaction_reference.strip(),
        payment_date=datetime.utcnow(),
        status="PAID",
        notes=payload.notes
    )
    db.add(payment)

    inv.status = "PAID"
    inv.paid_date = datetime.utcnow()
    inv.payment_method = payload.payment_method

    po.status = "Completed"
    po.updated_at = datetime.utcnow()

    if po.procurement_request:
        po.procurement_request.status = "Completed"
        po.procurement_request.updated_at = datetime.utcnow()

    db.flush()

    audit = AuditLog(
        user_id=fin_user.id,
        user_name=fin_user.full_name,
        user_role=fin_user.role,
        action="PAYMENT_PROCESSED_COMPLETED",
        entity_type="Payment",
        entity_id=payment.id,
        previous_status="VERIFIED",
        new_status="PAID",
        details=f"Finance Officer {fin_user.full_name} processed payment of ${payment.amount:,.2f} via {payment.payment_method} (Ref: {payment.transaction_reference}) for PO {po.po_number} (Vendor: {vendor_name}). Transaction completed."
    )
    db.add(audit)
    db.commit()
    db.refresh(payment)

    try:
        from app.routers.dashboard import clear_dashboard_cache
        clear_dashboard_cache()
    except Exception:
        pass

    # Secondary tasks run asynchronously:
    # 1. Recalculate vendor reliability & risk metrics in background
    background_tasks.add_task(calculate_vendor_metrics_async, vendor_id)

    # 2. Notify Auditor in background
    background_tasks.add_task(
        send_notification_async,
        title="Transaction Completed - Audit Ready",
        message=f"Transaction {po.po_number} (Invoice {inv.invoice_number}, Amount: ${payment.amount:,.2f}) has been paid and is ready for audit review.",
        target_role="Auditor",
        ref_id=po.id,
        ref_type="PurchaseOrder",
        notif_type="approval"
    )

    # 3. Notify Vendor in background
    if po.vendor and po.vendor.user_id:
        background_tasks.add_task(
            send_notification_async,
            title="Payment Remittance Processed",
            message=f"Payment of ${payment.amount:,.2f} for {po.po_number} (Ref: {payment.transaction_reference}) has been disbursed.",
            user_id=po.vendor.user_id,
            ref_id=payment.id,
            ref_type="Payment",
            notif_type="system"
        )

    # 4. Immutable blockchain audit record
    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="Payment",
        entity_id=payment.id,
        action="PAYMENT_PROCESSED_COMPLETED",
        actor_id=fin_user.id,
        metadata={"amount": payment.amount, "po_number": po.po_number, "vendor": vendor_name, "tx_ref": payment.transaction_reference}
    )

    return {
        "message": f"Payment of ${payment.amount:,.2f} successfully recorded. Transaction is now COMPLETED.",
        "payment_id": payment.id,
        "transaction_reference": payment.transaction_reference,
        "payment_date": payment.payment_date,
        "po_status": po.status,
        "vendor_id": vendor_id,
        "vendor_name": vendor_name,
        "vendor_company": vendor_company
    }

@router.get("/payments/history")
def get_payment_history(
    db: Session = Depends(get_db),
    fin_user: User = Depends(require_roles(["Finance Officer", "Auditor"]))
):
    """Views payment transaction history with vendor details."""
    payments = db.query(Payment).options(
        joinedload(Payment.invoice),
        joinedload(Payment.purchase_order).joinedload(PurchaseOrder.vendor),
        joinedload(Payment.processed_by)
    ).order_by(Payment.id.desc()).all()

    return [
        {
            "id": p.id,
            "transaction_reference": p.transaction_reference,
            "invoice_number": p.invoice.invoice_number if p.invoice else "",
            "po_number": p.purchase_order.po_number if p.purchase_order else "",
            "vendor_id": p.purchase_order.vendor_id if (p.purchase_order and p.purchase_order.vendor) else None,
            "vendor_name": p.purchase_order.vendor.name if (p.purchase_order and p.purchase_order.vendor) else "",
            "vendor_company": p.purchase_order.vendor.company if (p.purchase_order and p.purchase_order.vendor and p.purchase_order.vendor.company) else (p.purchase_order.vendor.name if (p.purchase_order and p.purchase_order.vendor) else ""),
            "vendor": {
                "id": p.purchase_order.vendor.id,
                "name": p.purchase_order.vendor.name,
                "company": p.purchase_order.vendor.company,
                "category": p.purchase_order.vendor.category
            } if (p.purchase_order and p.purchase_order.vendor) else None,
            "amount": p.amount,
            "payment_method": p.payment_method,
            "payment_date": p.payment_date,
            "status": p.status,
            "processed_by": p.processed_by.full_name if p.processed_by else "Finance Officer",
            "notes": p.notes
        }
        for p in payments
    ]
