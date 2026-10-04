from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, get_current_user, require_roles_strict, require_roles
from app.models.user import User
from app.models.vendor import Vendor
from app.models.procurement import ProcurementRequest
from app.models.vendor_selection import VendorSelection
from app.models.communication import AuditLog
from app.services.notification_service import send_notification_async
from app.services.blockchain_service import record_blockchain_audit_async
from app.services.eligibility_service import (
    get_eligible_vendors_for_requisition,
    get_vendor_details,
    validate_vendor_eligibility,
    normalize_category
)

router = APIRouter(prefix="/procurement", tags=["Procurement Manager Decisions"])

class VendorSelectionRequest(BaseModel):
    requisition_id: int
    vendor_id: int
    quotation_amount: float
    justification: str

class ProcurementCreatePayload(BaseModel):
    title: str
    description: Optional[str] = ""
    category: str
    department: Optional[str] = "Procurement"
    quantity: Optional[float] = 1.0
    unit_budget: Optional[float] = None # Budget assigned per unit
    estimated_budget: Optional[float] = 0.0
    priority: Optional[str] = "Medium"
    required_date: Optional[datetime] = None
    assigned_vendor_id: Optional[int] = None

class ProcurementStatusUpdate(BaseModel):
    status: str
    rejection_reason: Optional[str] = None

@router.get("/eligible-requisitions")
def get_eligible_requisitions(
    db: Session = Depends(get_db),
    proc_user: User = Depends(require_roles_strict(["Procurement Manager"]))
):
    """
    Procurement Manager views submitted PRs requiring vendor evaluation.
    """
    prs = db.query(ProcurementRequest).options(
        joinedload(ProcurementRequest.requested_by)
    ).filter(
        ProcurementRequest.status.in_(["SUBMITTED", "UNDER_REVIEW", "UNDER_EVALUATION", "REJECTED_FINANCE"])
    ).order_by(ProcurementRequest.id.desc()).all()

    return [
        {
            "id": p.id,
            "request_number": p.request_number,
            "department": p.department,
            "title": p.title,
            "description": p.description,
            "quantity": p.quantity,
            "priority": p.priority,
            "category": p.category,
            "estimated_budget": p.estimated_budget,
            "required_date": p.required_date,
            "status": p.status,
            "created_at": p.created_at,
            "requested_by": p.requested_by.full_name if p.requested_by else "Procurement Manager"
        }
        for p in prs
    ]

@router.get("/requirements/{pr_id}/eligible-vendors")
def get_eligible_vendors(
    pr_id: int,
    db: Session = Depends(get_db),
    proc_user: User = Depends(require_roles_strict(["Procurement Manager"]))
):
    """
    Step 3 of requirement:
    After category is selected for a Procurement Request, the system filters vendors.
    ONLY SHOW:
    - Vendors belonging to the selected category
    - Vendors that are Admin-verified
    - Vendors with Active status
    - Vendors that provide the required product/service
    """
    pr = db.query(ProcurementRequest).filter(ProcurementRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase Requisition not found")

    eligible_vendors = get_eligible_vendors_for_requisition(db, pr_id)
    return {
        "requisition_id": pr.id,
        "request_number": pr.request_number,
        "item": pr.title,
        "quantity": pr.quantity,
        "required_date": pr.required_date,
        "priority": pr.priority,
        "estimated_budget": pr.estimated_budget,
        "category": pr.category,
        "total_eligible_vendors": len(eligible_vendors),
        "vendors": eligible_vendors
    }

@router.get("/vendors/{vendor_id}/details")
def get_vendor_full_details(
    vendor_id: int,
    db: Session = Depends(get_db),
    proc_user: User = Depends(require_roles_strict(["Procurement Manager", "Administrator", "Auditor"]))
):
    """
    Step 4: Procurement Manager views vendor profile, reliability metrics,
    risk analysis, and historical delivery performance before final selection.
    """
    details = get_vendor_details(db, vendor_id)
    if not details:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return details

@router.post("/select-vendor")
def select_vendor_for_requisition(
    payload: VendorSelectionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    # Strict RBAC: Vendor Selection is made ONLY by Procurement Manager!
    proc_user: User = Depends(require_roles_strict(["Procurement Manager"]))
):
    """
    Step 6-10: Procurement Manager selects vendor for Purchase Requirement.
    1. Validates strict eligibility (category match, verified, active).
    2. Records selection with quotation & justification.
    3. Advances PR status to VENDOR_SELECTED.
    4. Executes in single atomic commit; secondary notifications & blockchain run asynchronously.
    """
    pr = db.query(ProcurementRequest).filter(ProcurementRequest.id == payload.requisition_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase Requisition not found")

    if pr.status not in ["SUBMITTED", "UNDER_REVIEW", "UNDER_EVALUATION", "REJECTED_FINANCE"]:
        raise HTTPException(
            status_code=400,
            detail=f"Requisition cannot have vendor selected in current state '{pr.status}'."
        )

    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    # STRICT BACKEND VALIDATION: Category and eligibility check
    is_eligible, err_msg = validate_vendor_eligibility(db, pr.id, vendor.id)
    if not is_eligible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=err_msg
        )

    # Save VendorSelection record
    selection = VendorSelection(
        requisition_id=pr.id,
        vendor_id=vendor.id,
        selected_by_id=proc_user.id,
        quotation_amount=float(payload.quotation_amount),
        justification=payload.justification.strip(),
        status="Awaiting Financial Approval"
    )
    db.add(selection)

    # Advance PR state to VENDOR_SELECTED
    pr.assigned_vendor_id = vendor.id
    pr.status = "VENDOR_SELECTED"
    pr.updated_at = datetime.utcnow()
    db.flush()

    # Immutable audit log in the same atomic transaction
    v_comp = vendor.company or vendor.name
    audit = AuditLog(
        user_id=proc_user.id,
        user_name=proc_user.full_name,
        user_role=proc_user.role,
        action="VENDOR_SELECTED",
        entity_type="VendorSelection",
        entity_id=selection.id,
        previous_status="SUBMITTED",
        new_status="VENDOR_SELECTED",
        details=f"Procurement Manager {proc_user.full_name} selected {vendor.name} ({vendor.category}) for {pr.request_number} with quotation ${payload.quotation_amount:,.2f}. Justification: {payload.justification}"
    )
    db.add(audit)
    db.commit()
    db.refresh(selection)

    # Secondary notification and blockchain run asynchronously
    background_tasks.add_task(
        send_notification_async,
        title="Vendor Selection Awaiting Financial Approval",
        message=f"Vendor selection for {pr.request_number} ({vendor.name}, Quote: ${payload.quotation_amount:,.2f}) requires financial approval.",
        target_role="Finance Officer",
        ref_id=pr.id,
        ref_type="VendorSelection",
        notif_type="approval"
    )

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="VendorSelection",
        entity_id=selection.id,
        action="VENDOR_SELECTED",
        actor_id=proc_user.id,
        metadata={"requisition_id": pr.id, "vendor": vendor.name, "quotation": payload.quotation_amount}
    )

    return {
        "message": f"Vendor {vendor.name} selected for {pr.request_number}. Request forwarded to Finance Officer for financial approval.",
        "selection_id": selection.id,
        "requisition_id": pr.id,
        "request_number": pr.request_number,
        "item": pr.title,
        "quantity": pr.quantity,
        "vendor_id": vendor.id,
        "vendor_name": vendor.name,
        "vendor_company": v_comp,
        "selected_vendor": vendor.name,
        "selected_category": normalize_category(vendor.category),
        "vendor": {
            "id": vendor.id,
            "name": vendor.name,
            "company": v_comp,
            "category": vendor.category
        },
        "reliability_score": round(vendor.deliveryRate if vendor.deliveryRate is not None else 0.0),
        "risk_level": vendor.risk_level or "Low",
        "quotation_amount": selection.quotation_amount,
        "status": "VENDOR_SELECTED",
        "selected_by": proc_user.full_name,
        "selected_at": selection.created_at
    }

@router.get("/approved-selections")
@router.get("/selections")
def get_approved_selections(
    db: Session = Depends(get_db),
    proc_user: User = Depends(require_roles(["Procurement Manager", "Finance Officer", "Auditor"]))
):
    """Lists vendor selections and their progression."""
    selections = db.query(VendorSelection).options(
        joinedload(VendorSelection.requisition),
        joinedload(VendorSelection.vendor),
        joinedload(VendorSelection.selected_by)
    ).order_by(VendorSelection.id.desc()).all()

    return [
        {
            "id": s.id,
            "requisition_id": s.requisition_id,
            "request_number": s.requisition.request_number if s.requisition else "",
            "department": s.requisition.department if s.requisition else "",
            "title": s.requisition.title if s.requisition else "",
            "category": s.requisition.category if s.requisition else "",
            "vendor_id": s.vendor_id,
            "vendor_name": s.vendor.name if s.vendor else "",
            "vendor_company": s.vendor.company if (s.vendor and s.vendor.company) else (s.vendor.name if s.vendor else ""),
            "vendor": {
                "id": s.vendor.id,
                "name": s.vendor.name,
                "company": s.vendor.company,
                "category": s.vendor.category
            } if s.vendor else None,
            "vendor_reliability": s.vendor.deliveryRate if s.vendor else 0,
            "vendor_risk": s.vendor.risk_level if s.vendor else "Low",
            "quotation_amount": s.quotation_amount,
            "justification": s.justification,
            "status": s.status,
            "selected_by": s.selected_by.full_name if s.selected_by else "Procurement Manager",
            "created_at": s.created_at
        }
        for s in selections
    ]

# STRICT SECURITY ENFORCEMENT:
# Procurement Manager MUST NOT create or issue POs
@router.post("/purchase-orders")
def reject_po_creation_by_procurement():
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Security Violation: Procurement Manager MUST NOT create Purchase Orders. Only Supply Chain Manager can create Purchase Orders."
    )

@router.get("")
def get_procurement_requests(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns procurement requests with complete synchronized order tracking."""
    if current_user.role == "Vendor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Vendors cannot view internal organization requisitions."
        )
    from app.routers.requisitions import format_pr_response
    query = db.query(ProcurementRequest).options(
        joinedload(ProcurementRequest.requested_by),
        joinedload(ProcurementRequest.vendor_selections),
        joinedload(ProcurementRequest.financial_approvals),
        joinedload(ProcurementRequest.purchase_orders),
        joinedload(ProcurementRequest.vendor),
        joinedload(ProcurementRequest.items)
    )
    if status and status.lower() != "all":
        sf = status.strip()
        if sf == "Pending":
            query = query.filter(ProcurementRequest.status.in_(["Pending", "SUBMITTED", "UNDER_REVIEW", "UNDER_EVALUATION", "VENDOR_SELECTED", "FINANCE_PENDING"]))
        elif sf == "Approved":
            query = query.filter(ProcurementRequest.status.in_(["Approved", "READY_FOR_PO", "FINANCE_APPROVED"]))
        elif sf == "Ordered":
            query = query.filter(ProcurementRequest.status.in_(["Ordered", "PO_CREATED", "Issued", "Accepted"]))
        elif sf == "In Transit":
            query = query.filter(ProcurementRequest.status == "In Transit")
        elif sf == "Delivered":
            query = query.filter(ProcurementRequest.status.in_(["Delivered", "Delayed", "Partially Delivered"]))
        elif sf == "Completed":
            query = query.filter(ProcurementRequest.status.in_(["Completed", "COMPLETED"]))
        elif sf == "Cancelled":
            query = query.filter(ProcurementRequest.status.in_(["Cancelled", "REJECTED", "REJECTED_FINANCE"]))
        else:
            query = query.filter(ProcurementRequest.status == sf)

    if priority and priority.lower() != "all":
        query = query.filter(ProcurementRequest.priority == priority)

    if category and category.lower() != "all":
        query = query.filter(ProcurementRequest.category == normalize_category(category))

    records = query.order_by(ProcurementRequest.id.desc()).all()
    return [format_pr_response(r, db) for r in records]

@router.post("", status_code=status.HTTP_201_CREATED)
def create_procurement_request_endpoint(
    data: ProcurementCreatePayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.routers.requisitions import format_pr_response
    canonical_cat = normalize_category(data.category) if data.category else "IT & Electronics"
    count = db.query(ProcurementRequest).count() + 1
    pr_number = f"PR-{datetime.utcnow().year}-{count:04d}"

    qty = float(data.quantity or 1.0)
    unit_b = float(data.unit_budget) if (data.unit_budget is not None and float(data.unit_budget) > 0) else None
    total_est = float(data.estimated_budget or 0.0)

    if unit_b is not None and total_est == 0.0:
        total_est = qty * unit_b
    elif total_est > 0.0 and unit_b is None:
        unit_b = round(total_est / qty, 2)

    new_pr = ProcurementRequest(
        request_number=pr_number,
        department=(data.department or "Procurement").strip(),
        title=data.title.strip(),
        description=(data.description or "").strip(),
        quantity=qty,
        required_date=data.required_date,
        priority=data.priority or "Medium",
        category=canonical_cat,
        unit_budget=float(unit_b or 0.0),
        estimated_budget=float(total_est),
        status="SUBMITTED",
        requested_by_id=current_user.id
    )

    vendor = None
    if data.assigned_vendor_id:
        vendor = db.query(Vendor).filter(Vendor.id == data.assigned_vendor_id).first()
        if vendor:
            new_pr.assigned_vendor_id = vendor.id
            new_pr.status = "VENDOR_SELECTED"

    db.add(new_pr)
    db.flush()

    if data.assigned_vendor_id and vendor:
        sel = VendorSelection(
            requisition_id=new_pr.id,
            vendor_id=vendor.id,
            selected_by_id=current_user.id,
            quotation_amount=float(data.estimated_budget or 0.0),
            justification=f"Directly selected on PR creation: {vendor.name}",
            status="Awaiting Financial Approval"
        )
        db.add(sel)

    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action="PR_CREATED",
        entity_type="PurchaseRequisition",
        entity_id=new_pr.id,
        previous_status="NONE",
        new_status=new_pr.status,
        details=f"User {current_user.full_name} created PR {pr_number}: {new_pr.title}"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_pr)

    background_tasks.add_task(
        send_notification_async,
        title="Procurement Request Created",
        message=f"Procurement Request {pr_number} ({new_pr.title}) created.",
        target_role="Procurement Manager",
        ref_id=new_pr.id,
        ref_type="ProcurementRequest",
        notif_type="approval"
    )

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="ProcurementRequest",
        entity_id=new_pr.id,
        action="PR_CREATED",
        actor_id=current_user.id,
        metadata={"request_number": pr_number, "title": new_pr.title}
    )

    return format_pr_response(new_pr, db)

@router.get("/{pr_id}")
def get_single_procurement_request(
    pr_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "Vendor":
        raise HTTPException(status_code=403, detail="Vendors cannot access internal PR details.")
    pr = db.query(ProcurementRequest).options(
        joinedload(ProcurementRequest.requested_by),
        joinedload(ProcurementRequest.vendor_selections),
        joinedload(ProcurementRequest.financial_approvals),
        joinedload(ProcurementRequest.purchase_orders),
        joinedload(ProcurementRequest.vendor),
        joinedload(ProcurementRequest.items)
    ).filter(ProcurementRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Procurement request not found")
    from app.routers.requisitions import format_pr_response
    return format_pr_response(pr, db)

@router.put("/{pr_id}/status")
def update_procurement_request_status(
    pr_id: int,
    payload: ProcurementStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.routers.requisitions import format_pr_response
    pr = db.query(ProcurementRequest).filter(ProcurementRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Procurement request not found")

    prev_status = pr.status
    target_status = payload.status.strip()

    valid_statuses = ["Pending", "SUBMITTED", "VENDOR_SELECTED", "Approved", "FINANCE_APPROVED", "READY_FOR_PO", "Ordered", "PO_CREATED", "In Transit", "Delivered", "Completed", "COMPLETED", "Cancelled", "REJECTED"]
    if target_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid target status: {target_status}")

    if target_status in ["Completed", "COMPLETED"]:
        po_check = pr.purchase_orders[-1] if pr.purchase_orders else None
        if po_check and not po_check.deliveries:
            raise HTTPException(
                status_code=400,
                detail="Cannot mark Procurement Request as 'Completed' when physical delivery is pending."
            )

    pr.status = target_status
    if payload.rejection_reason:
        pr.rejection_reason = payload.rejection_reason

    po = pr.purchase_orders[-1] if pr.purchase_orders else None
    if po:
        if target_status in ["In Transit", "Delivered", "Completed", "Cancelled"]:
            po.status = target_status
        elif target_status in ["Ordered", "PO_CREATED"]:
            po.status = "Issued"

    pr.updated_at = datetime.utcnow()

    audit = AuditLog(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action="PR_STATUS_UPDATED",
        entity_type="ProcurementRequest",
        entity_id=pr.id,
        previous_status=prev_status,
        new_status=target_status,
        details=f"{current_user.full_name} updated PR {pr.request_number} status from {prev_status} to {target_status}"
    )
    db.add(audit)
    db.commit()
    db.refresh(pr)

    background_tasks.add_task(
        record_blockchain_audit_async,
        entity_type="ProcurementRequest",
        entity_id=pr.id,
        action="PR_STATUS_UPDATED",
        actor_id=current_user.id,
        metadata={"request_number": pr.request_number, "status": target_status}
    )

    return format_pr_response(pr, db)

@router.put("/{pr_id}")
def update_procurement_request(
    pr_id: int,
    data: ProcurementCreatePayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.routers.requisitions import format_pr_response
    pr = db.query(ProcurementRequest).filter(ProcurementRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Procurement request not found")

    if data.title:
        pr.title = data.title.strip()
    if data.description is not None:
        pr.description = data.description.strip()
    if data.category:
        pr.category = normalize_category(data.category)
    if data.quantity:
        pr.quantity = float(data.quantity)
    if data.estimated_budget:
        pr.estimated_budget = float(data.estimated_budget)
    if data.priority:
        pr.priority = data.priority
    if data.department:
        pr.department = data.department.strip()

    pr.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(pr)

    return format_pr_response(pr, db)
