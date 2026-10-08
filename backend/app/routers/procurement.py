from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, date, timedelta
import uuid
from app.database import get_db
from app.models.procurement import ProcurementRequest, PurchaseOrder, PurchaseOrderItem, Invoice, CompanyTreasury
from app.models.contract import Contract
from app.models.vendor import Vendor
from app.models.user import User
from app.models.performance import PerformanceRecord, ReliabilityScore
from app.models.notification import Notification
from app.models.enums import UserRole, RequestStatus, POStatus, InvoiceStatus, VendorStatus, NotificationType, ContractStatus
from app.routers.analytics import compute_vendor_intelligence
from app.schemas.procurement import (
    ProcurementRequestCreate, ProcurementRequestUpdate,
    ProcurementRequestStatusUpdate, ProcurementRequestResponse,
    PurchaseOrderCreate, PurchaseOrderStatusUpdate, PurchaseOrderResponse,
    InvoiceCreate, InvoiceStatusUpdate, InvoiceResponse,
    CompanyTreasuryResponse
)
from app.core.dependencies import get_current_user, require_roles
from app.core.audit import log_audit_event

router = APIRouter(prefix="/procurement", tags=["Procurement & Orders"])

def get_or_create_treasury(db: Session) -> CompanyTreasury:
    treasury = db.query(CompanyTreasury).first()
    if not treasury:
        treasury = CompanyTreasury(available_balance=25000000.0, total_budget=50000000.0, currency="INR")
        db.add(treasury)
        db.commit()
        db.refresh(treasury)
    return treasury

@router.get("/treasury", response_model=CompanyTreasuryResponse)
def get_company_treasury(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns live available company treasury balance and total budget.
    Used by Finance Officers to validate and authorize procurement payouts.
    """
    return get_or_create_treasury(db)

# --- Procurement Requests Endpoints ---

@router.get("/public-open-requests")
def get_public_open_requests(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Public open procurement requisitions viewable by all vendors.
    Vendors of the same category can view and acquire these requests.
    """
    query = db.query(ProcurementRequest).filter(
        ProcurementRequest.status.in_([RequestStatus.APPROVED, RequestStatus.PENDING, RequestStatus.SUBMITTED, RequestStatus.ASSIGNED])
    )
    if category and category != 'all':
        query = query.filter(ProcurementRequest.category == category)
    reqs = query.order_by(ProcurementRequest.id.desc()).all()
    result = []
    for r in reqs:
        result.append({
            "id": r.id,
            "title": r.title,
            "description": r.description or "Standard Requisition",
            "department": r.department or "Production",
            "requested_by_name": r.requested_by_name or (r.requested_by.full_name if r.requested_by else "Procurement"),
            "quantity": r.quantity or "1 Lot",
            "needed_by": str(r.needed_by) if r.needed_by else "Standard Schedule",
            "priority": r.priority or "Medium",
            "category": r.category or "raw_material",
            "budget_amount": r.budget_amount or 0.0,
            "location": r.location or "Main Facility",
            "specifications": r.specifications or "Standard specs",
            "status": r.status.value,
            "created_at": str(r.created_at)[:10]
        })
    return result

@router.post("/requests/{req_id}/acquire")
def acquire_procurement_request(
    req_id: int,
    vendor_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Assigns or acquires an open procurement request by a vendor of the same category.
    """
    req = db.query(ProcurementRequest).filter(ProcurementRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Procurement request not found")
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    v_cat = vendor.category.value if hasattr(vendor.category, "value") else str(vendor.category)
    req_cat = req.category or "raw_material"
    if req_cat and req_cat != v_cat and req_cat != "all":
        raise HTTPException(
            status_code=400,
            detail=f"Category mismatch: Requisition requires '{req_cat.replace('_', ' ')}', but {vendor.company_name} is categorized under '{v_cat.replace('_', ' ')}'."
        )
    
    req.accepted_vendor_id = vendor.id
    req.status = RequestStatus.VENDOR_ACCEPTED
    req.vendor_accepted_at = datetime.utcnow()
    db.commit()

    # Notify Finance Officers
    f_users = db.query(User).filter(User.role == UserRole.FINANCE_OFFICER).all()
    for fu in f_users:
        db.add(Notification(
            user_id=fu.id,
            type=NotificationType.PAYMENT_REQUEST,
            message=f"Payment Authorization Required: Vendor '{vendor.company_name}' accepted Requisition #{req.id} ('{req.title}'). Amount: ₹{req.budget_amount or 50000.0:,.2f}. Review balance and approve payment.",
            is_read=False
        ))
    db.commit()

    return {
        "message": f"Successfully acquired requisition #{req.id} by {vendor.company_name}. Awaiting Finance payment authorization.",
        "request_id": req.id,
        "status": req.status.value
    }

@router.get("/requests", response_model=List[ProcurementRequestResponse])
def get_procurement_requests(
    status_filter: Optional[RequestStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ProcurementRequest).options(
        joinedload(ProcurementRequest.requested_by),
        joinedload(ProcurementRequest.assigned_vendor),
        joinedload(ProcurementRequest.accepted_vendor)
    )

    # Role isolation for vendors: only see requests assigned to them, accepted by them, or open in their category
    if current_user.role == UserRole.VENDOR:
        if not current_user.vendor_id:
            return []
        vendor = db.query(Vendor).filter(Vendor.id == current_user.vendor_id).first()
        v_cat = vendor.category.value if vendor and hasattr(vendor.category, "value") else str(getattr(vendor, "category", ""))
        query = query.filter(
            (ProcurementRequest.assigned_vendor_id == current_user.vendor_id) |
            (ProcurementRequest.accepted_vendor_id == current_user.vendor_id) |
            ((ProcurementRequest.is_multi_vendor == True) & (ProcurementRequest.category == v_cat))
        )

    if status_filter:
        query = query.filter(ProcurementRequest.status == status_filter)
    return query.order_by(ProcurementRequest.id.desc()).all()

@router.post("/requests", response_model=ProcurementRequestResponse, status_code=status.HTTP_201_CREATED)
def create_procurement_request(
    req_in: ProcurementRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER
    ]))
):
    assigned_v = None
    if req_in.assigned_vendor_id:
        assigned_v = db.query(Vendor).filter(Vendor.id == req_in.assigned_vendor_id).first()
        if not assigned_v:
            raise HTTPException(status_code=404, detail="Assigned vendor not found")

    initial_status = RequestStatus.DRAFT if str(getattr(req_in, "status", "")).lower() == "draft" else (
        RequestStatus.ASSIGNED if req_in.assigned_vendor_id else RequestStatus.PENDING
    )

    req = ProcurementRequest(
        title=req_in.title,
        description=req_in.description,
        department=req_in.department or getattr(current_user, "department", "Production") or "Production",
        requested_by_name=req_in.requested_by_name or current_user.full_name,
        quantity=str(req_in.quantity) if req_in.quantity is not None else "1",
        needed_by=req_in.needed_by,
        priority=req_in.priority or "Medium",
        category=req_in.category,
        specifications=req_in.specifications,
        budget_amount=float(req_in.budget_amount or 0.0),
        location=req_in.location,
        justification=req_in.justification,
        assigned_vendor_id=req_in.assigned_vendor_id,
        is_multi_vendor=bool(req_in.is_multi_vendor or not req_in.assigned_vendor_id),
        requested_by_id=current_user.id,
        status=initial_status,
        finance_status="pending"
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # STEP 5: Single Vendor Notification
    if req.assigned_vendor_id and assigned_v:
        vendor_users = db.query(User).filter(User.vendor_id == assigned_v.id).all()
        for vu in vendor_users:
            db.add(Notification(
                user_id=vu.id,
                type=NotificationType.PROCUREMENT_ALERT,
                message=f"A new procurement request/contract has been assigned to your company: '{req.title}' (Budget: ₹{req.budget_amount:,.2f}, Qty: {req.quantity}, Due: {req.needed_by or 'Standard'}). Please open to review and accept.",
                is_read=False
            ))
        db.commit()

    # STEP 6: Multiple Vendor Request in matching category
    elif req.is_multi_vendor and req.category:
        matched_vendors = db.query(Vendor).filter(
            Vendor.category == req.category,
            Vendor.status.in_([VendorStatus.APPROVED, VendorStatus.ACTIVE])
        ).all()
        for mv in matched_vendors:
            v_users = db.query(User).filter(User.vendor_id == mv.id).all()
            for vu in v_users:
                db.add(Notification(
                    user_id=vu.id,
                    type=NotificationType.PROCUREMENT_ALERT,
                    message=f"New Procurement Request Available: '{req.title}' in your category '{req.category}' (Budget: ₹{req.budget_amount:,.2f}). Please review and submit your acceptance.",
                    is_read=False
                ))
        db.commit()

    log_audit_event(
        db, current_user.id, "CREATE_PROCUREMENT_REQUEST", "ProcurementRequest",
        f"Created procurement request '{req.title}' with budget ₹{req.budget_amount:,.2f}"
    )

    req_full = db.query(ProcurementRequest).options(
        joinedload(ProcurementRequest.requested_by),
        joinedload(ProcurementRequest.assigned_vendor),
        joinedload(ProcurementRequest.accepted_vendor)
    ).filter(ProcurementRequest.id == req.id).first()
    return req_full

@router.patch("/requests/{req_id}/status", response_model=ProcurementRequestResponse)
def update_procurement_request_status(
    req_id: int,
    status_in: ProcurementRequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER
    ]))
):
    req = db.query(ProcurementRequest).filter(ProcurementRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    req.status = status_in.status
    req.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(req)

    log_audit_event(
        db, current_user.id, "UPDATE_REQUEST_STATUS", "ProcurementRequest",
        f"Updated request #{req.id} status to {req.status.value}"
    )

    req_full = db.query(ProcurementRequest).options(
        joinedload(ProcurementRequest.requested_by),
        joinedload(ProcurementRequest.assigned_vendor),
        joinedload(ProcurementRequest.accepted_vendor)
    ).filter(ProcurementRequest.id == req.id).first()
    return req_full

@router.post("/requests/{req_id}/vendor-accept", response_model=ProcurementRequestResponse)
def vendor_accept_procurement_request(
    req_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    STEP 7 — Vendor Approval / Acceptance:
    Vendor accepts assigned or category-matched procurement request.
    Validates category/vendor matching and forwards request to Finance for budget verification.
    """
    if current_user.role != UserRole.VENDOR or not current_user.vendor_id:
        raise HTTPException(status_code=403, detail="Only authorized vendor users can accept procurement requests.")

    vendor = db.query(Vendor).filter(Vendor.id == current_user.vendor_id).first()
    if not vendor or vendor.status not in [VendorStatus.APPROVED, VendorStatus.ACTIVE]:
        raise HTTPException(status_code=403, detail="Vendor must be approved and active to participate in procurement.")

    req = db.query(ProcurementRequest).filter(ProcurementRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Procurement request not found")

    if req.status not in [RequestStatus.ASSIGNED, RequestStatus.PENDING, RequestStatus.SUBMITTED]:
        raise HTTPException(status_code=400, detail=f"Request cannot be accepted in current status: {req.status.value}")

    # If single vendor assignment, must match
    if req.assigned_vendor_id and req.assigned_vendor_id != vendor.id:
        raise HTTPException(status_code=403, detail="This request is specifically assigned to another supplier.")

    # If multi-vendor, category must match
    v_cat = vendor.category.value if hasattr(vendor.category, "value") else str(vendor.category)
    if req.category and req.category != v_cat and req.category != "all":
        raise HTTPException(status_code=400, detail=f"Category mismatch: Requisition requires '{req.category}', but vendor is in '{v_cat}'.")

    req.accepted_vendor_id = vendor.id
    req.status = RequestStatus.VENDOR_ACCEPTED
    req.vendor_accepted_at = datetime.utcnow()
    req.finance_status = "pending"
    req.updated_at = datetime.utcnow()
    db.commit()

    # STEP 7 -> STEP 8: Notify all Finance Officers to review and approve payment
    finance_users = db.query(User).filter(User.role == UserRole.FINANCE_OFFICER).all()
    for fu in finance_users:
        db.add(Notification(
            user_id=fu.id,
            type=NotificationType.PAYMENT_REQUEST,
            message=f"Payment Authorization Required: Vendor '{vendor.company_name}' accepted Requisition #{req.id} ('{req.title}'). Requested Amount: ₹{req.budget_amount:,.2f}. Review company treasury balance and approve payment.",
            is_read=False
        ))

    # Notify Procurement Manager
    if req.requested_by_id:
        db.add(Notification(
            user_id=req.requested_by_id,
            type=NotificationType.PROCUREMENT_ALERT,
            message=f"Vendor Acceptance: '{vendor.company_name}' accepted Requisition #{req.id} ('{req.title}'). Forwarded to Finance for budget verification.",
            is_read=False
        ))
    db.commit()

    log_audit_event(
        db, current_user.id, "VENDOR_ACCEPT_REQUEST", "ProcurementRequest",
        f"Vendor '{vendor.company_name}' accepted procurement requisition #{req.id}"
    )

    req_full = db.query(ProcurementRequest).options(
        joinedload(ProcurementRequest.requested_by),
        joinedload(ProcurementRequest.assigned_vendor),
        joinedload(ProcurementRequest.accepted_vendor)
    ).filter(ProcurementRequest.id == req.id).first()
    return req_full

@router.post("/requests/{req_id}/finance-approve")
def finance_approve_procurement_request(
    req_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.FINANCE_OFFICER, UserRole.ADMINISTRATOR]))
):
    """
    STEP 8 & 9 — Finance Manager Workflow & Payment Processing:
    Validates company available balance. Deducts budget.
    Activates Contract, generates Purchase Order, and notifies Vendor and Supply Chain Controller.
    """
    req = db.query(ProcurementRequest).filter(ProcurementRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Procurement request not found")

    if req.status != RequestStatus.VENDOR_ACCEPTED:
        raise HTTPException(status_code=400, detail="Requisition must be accepted by a vendor before Finance approval.")

    if not req.accepted_vendor_id:
        raise HTTPException(status_code=400, detail="No accepted vendor associated with requisition.")

    vendor = db.query(Vendor).filter(Vendor.id == req.accepted_vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    amount = float(req.budget_amount or 0.0)
    treasury = get_or_create_treasury(db)

    # Balance check: Requested Amount > Available Balance is strictly forbidden
    if amount > treasury.available_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Requested Amount ₹{amount:,.2f} exceeds Company Available Balance ₹{treasury.available_balance:,.2f}. Cannot approve payment."
        )

    # Deduct balance
    treasury.available_balance -= amount
    treasury.updated_at = datetime.utcnow()

    # Update requisition status
    req.status = RequestStatus.FINANCE_APPROVED
    req.finance_status = "approved"
    req.finance_approved_by_id = current_user.id
    req.updated_at = datetime.utcnow()

    # Generate sequential unique PO
    unique_suffix = str(uuid.uuid4().hex[:6]).upper()
    po_number = f"PO-{datetime.utcnow().year}-{unique_suffix}"
    exp_date = req.needed_by or (datetime.utcnow().date() + timedelta(days=14))

    po = PurchaseOrder(
        po_number=po_number,
        procurement_request_id=req.id,
        vendor_id=vendor.id,
        status=POStatus.PENDING,
        total_amount=amount,
        expected_delivery_date=exp_date,
        payment_terms="Net 30",
        created_by_id=req.requested_by_id,
        approved_by_id=current_user.id
    )
    db.add(po)
    db.commit()
    db.refresh(po)

    # Add PO Line Item
    po_item = PurchaseOrderItem(
        purchase_order_id=po.id,
        item_name=req.title,
        quantity=float(req.quantity) if req.quantity and str(req.quantity).replace('.', '').isdigit() else 1.0,
        unit_price=amount
    )
    db.add(po_item)

    # Generate Active Contract
    contract_number = f"CNT-{datetime.utcnow().year}-{unique_suffix}"
    contract = Contract(
        contract_number=contract_number,
        vendor_id=vendor.id,
        title=f"Procurement Agreement - {req.title}",
        start_date=date.today(),
        end_date=exp_date,
        status=ContractStatus.ACTIVE
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)

    # STEP 9: Notify Vendor
    vendor_users = db.query(User).filter(User.vendor_id == vendor.id).all()
    for vu in vendor_users:
        db.add(Notification(
            user_id=vu.id,
            type=NotificationType.PAYMENT_APPROVED,
            message=f"Payment Approved & Contract Awarded! Payment of ₹{amount:,.2f} for '{req.title}' has been approved and processed. Contract {contract_number} (PO {po_number}) is ACTIVE. You are responsible for fulfilling the delivery by {exp_date}.",
            is_read=False
        ))

    # Notify Procurement Manager
    if req.requested_by_id:
        db.add(Notification(
            user_id=req.requested_by_id,
            type=NotificationType.PROCUREMENT_ALERT,
            message=f"Finance approved payment of ₹{amount:,.2f} for Requisition #{req.id}. Purchase Order {po_number} and Contract {contract_number} are active.",
            is_read=False
        ))

    # Notify Supply Chain Controller
    sc_users = db.query(User).filter(User.role == UserRole.SUPPLY_CHAIN_MANAGER).all()
    for sc in sc_users:
        db.add(Notification(
            user_id=sc.id,
            type=NotificationType.PROCUREMENT_ALERT,
            message=f"New Active Contract/Order: {po_number} (Contract {contract_number}) for {vendor.company_name} requires delivery tracking. Delivery due: {exp_date}.",
            is_read=False
        ))

    db.commit()

    log_audit_event(
        db, current_user.id, "FINANCE_APPROVE_PAYMENT", "ProcurementRequest",
        f"Finance approved ₹{amount:,.2f} for Requisition #{req.id}. Treasury balance now ₹{treasury.available_balance:,.2f}"
    )

    return {
        "message": f"Payment of ₹{amount:,.2f} approved and processed. Contract {contract_number} and Order {po_number} are active.",
        "po_id": po.id,
        "po_number": po_number,
        "contract_id": contract.id,
        "contract_number": contract_number,
        "purchase_order": {
            "id": po.id,
            "po_number": po_number,
            "status": po.status.value
        },
        "contract": {
            "id": contract.id,
            "contract_number": contract_number,
            "status": contract.status.value
        },
        "available_balance": treasury.available_balance,
        "status": req.status.value
    }

@router.post("/requests/{req_id}/finance-reject")
def finance_reject_procurement_request(
    req_id: int,
    payload: dict = {},
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.FINANCE_OFFICER, UserRole.ADMINISTRATOR]))
):
    req = db.query(ProcurementRequest).filter(ProcurementRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Procurement request not found")

    reason = payload.get("reason") or "Budget unavailable or verification declined."
    req.status = RequestStatus.REJECTED
    req.finance_status = "rejected"
    req.finance_notes = reason
    req.updated_at = datetime.utcnow()
    db.commit()

    # Notify Vendor and Procurement
    if req.accepted_vendor_id:
        v_users = db.query(User).filter(User.vendor_id == req.accepted_vendor_id).all()
        for vu in v_users:
            db.add(Notification(
                user_id=vu.id,
                type=NotificationType.PROCUREMENT_ALERT,
                message=f"Payment Declined: Requisition #{req.id} ('{req.title}') was rejected by Finance. Reason: {reason}",
                is_read=False
            ))
    if req.requested_by_id:
        db.add(Notification(
            user_id=req.requested_by_id,
            type=NotificationType.PROCUREMENT_ALERT,
            message=f"Finance rejected payment for Requisition #{req.id}. Reason: {reason}",
            is_read=False
        ))
    db.commit()
    return {"message": "Requisition payment rejected by Finance.", "status": req.status.value}

# --- Purchase Orders Endpoints ---

@router.get("/orders", response_model=List[PurchaseOrderResponse])
def get_purchase_orders(
    status_filter: Optional[POStatus] = Query(None, alias="status"),
    vendor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.vendor),
        joinedload(PurchaseOrder.created_by),
        joinedload(PurchaseOrder.approved_by),
        joinedload(PurchaseOrder.items)
    )

    # Enforce role isolation for vendors
    if current_user.role == UserRole.VENDOR:
        if not current_user.vendor_id:
            return []
        query = query.filter(PurchaseOrder.vendor_id == current_user.vendor_id)
    elif vendor_id:
        query = query.filter(PurchaseOrder.vendor_id == vendor_id)

    if status_filter:
        query = query.filter(PurchaseOrder.status == status_filter)

    return query.order_by(PurchaseOrder.id.desc()).all()

@router.post("/orders", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    po_in: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER
    ]))
):
    vendor = db.query(Vendor).filter(Vendor.id == po_in.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    if not po_in.items or len(po_in.items) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PO must contain at least one line item")

    # Generate sequential or unique PO number
    unique_suffix = str(uuid.uuid4().hex[:6]).upper()
    po_number = f"PO-{datetime.utcnow().year}-{unique_suffix}"

    # Auto-calculate total amount
    total_amount = sum(item.quantity * item.unit_price for item in po_in.items)

    po = PurchaseOrder(
        po_number=po_number,
        procurement_request_id=po_in.procurement_request_id,
        vendor_id=po_in.vendor_id,
        status=POStatus.PENDING,
        total_amount=total_amount,
        expected_delivery_date=po_in.expected_delivery_date,
        payment_terms=getattr(po_in, "payment_terms", "Net 15") or "Net 15",
        created_by_id=current_user.id
    )
    db.add(po)
    db.commit()
    db.refresh(po)

    for item_data in po_in.items:
        item = PurchaseOrderItem(
            purchase_order_id=po.id,
            item_name=item_data.item_name,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price
        )
        db.add(item)
    db.commit()

    # Link back to request if specified
    if po_in.procurement_request_id:
        req = db.query(ProcurementRequest).filter(ProcurementRequest.id == po_in.procurement_request_id).first()
        if req:
            req.status = RequestStatus.IN_PROGRESS
            db.commit()

    # Fetch with full relations
    po_full = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.vendor),
        joinedload(PurchaseOrder.created_by),
        joinedload(PurchaseOrder.items)
    ).filter(PurchaseOrder.id == po.id).first()

    log_audit_event(
        db, current_user.id, "CREATE_PURCHASE_ORDER", "PurchaseOrder",
        f"Created PO {po.po_number} with total amount ₹{total_amount:,.2f}"
    )
    return po_full

@router.get("/orders/{order_id}", response_model=PurchaseOrderResponse)
def get_purchase_order_by_id(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    po = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.vendor),
        joinedload(PurchaseOrder.created_by),
        joinedload(PurchaseOrder.approved_by),
        joinedload(PurchaseOrder.items)
    ).filter(PurchaseOrder.id == order_id).first()

    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase Order not found")

    if current_user.role == UserRole.VENDOR and po.vendor_id != current_user.vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return po

@router.patch("/orders/{order_id}/status", response_model=PurchaseOrderResponse)
def update_purchase_order_status(
    order_id: int,
    status_in: PurchaseOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    po = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.vendor),
        joinedload(PurchaseOrder.created_by),
        joinedload(PurchaseOrder.approved_by),
        joinedload(PurchaseOrder.items)
    ).filter(PurchaseOrder.id == order_id).first()

    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase Order not found")

    # Role check for status updates
    if current_user.role == UserRole.VENDOR:
        # Vendors can transition pending/ordered -> in_transit (indicating shipment dispatch)
        if po.vendor_id != current_user.vendor_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        if status_in.status not in [POStatus.IN_TRANSIT, POStatus.DELIVERED]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vendors can only mark orders as in transit or delivered")
    elif current_user.role not in [UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER, UserRole.SUPPLY_CHAIN_MANAGER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role not authorized to update PO delivery status")

    po.status = status_in.status
    if status_in.status == POStatus.APPROVED:
        po.approved_by_id = current_user.id
    elif status_in.status == POStatus.IN_TRANSIT:
        # STEP 10: In transit notification
        if po.vendor_id:
            v_users = db.query(User).filter(User.vendor_id == po.vendor_id).all()
            for vu in v_users:
                db.add(Notification(
                    user_id=vu.id,
                    type=NotificationType.PROCUREMENT_ALERT,
                    message=f"Shipment Dispatched: Purchase Order {po.po_number} is now IN TRANSIT.",
                    is_read=False
                ))
        if po.created_by_id:
            db.add(Notification(
                user_id=po.created_by_id,
                type=NotificationType.PROCUREMENT_ALERT,
                message=f"Order {po.po_number} is now IN TRANSIT for {po.vendor.company_name if po.vendor else 'Supplier'}.",
                is_read=False
            ))
        db.commit()
    elif status_in.status in [POStatus.DELIVERED, POStatus.COMPLETED]:
        # STEP 11: Delivery completion
        po.actual_delivery_date = status_in.actual_delivery_date or date.today()
        is_on_time = po.actual_delivery_date <= po.expected_delivery_date

        # Update linked requisition if any
        if po.procurement_request_id:
            linked_req = db.query(ProcurementRequest).filter(ProcurementRequest.id == po.procurement_request_id).first()
            if linked_req:
                linked_req.status = RequestStatus.COMPLETED
                db.commit()
        
        # STEP 12: Automatic Invoice Generation upon delivery completion
        existing_invoice = db.query(Invoice).filter(Invoice.purchase_order_id == po.id).first()
        inv_number = None
        if not existing_invoice:
            unique_suffix = str(uuid.uuid4().hex[:6]).upper()
            inv_number = f"INV-{datetime.utcnow().year}-{unique_suffix}"
            inv = Invoice(
                invoice_number=inv_number,
                purchase_order_id=po.id,
                amount=po.total_amount,
                status=InvoiceStatus.PAID,
                due_date=po.expected_delivery_date,
                paid_date=date.today()
            )
            db.add(inv)
            db.commit()
        else:
            inv_number = existing_invoice.invoice_number

        # STEP 13: Automatic Performance Record & Reliability Index Recalculation
        existing_perf = db.query(PerformanceRecord).filter(PerformanceRecord.purchase_order_id == po.id).first()
        if not existing_perf:
            perf = PerformanceRecord(
                vendor_id=po.vendor_id,
                purchase_order_id=po.id,
                on_time=is_on_time,
                quality_rating=5.0 if is_on_time else 4.0,
                response_time_hours=2.0,
                issue_resolution_hours=8.0 if is_on_time else 24.0,
                recorded_at=datetime.utcnow()
            )
            db.add(perf)
            db.commit()

        # Recalculate & Persist Reliability Score
        if po.vendor:
            intel = compute_vendor_intelligence(po.vendor, db)
            new_score = intel.get("reliability_score", 0.0)
            rel = ReliabilityScore(
                vendor_id=po.vendor_id,
                score=new_score,
                risk_level=intel.get("risk_level", "Low"),
                calculated_at=datetime.utcnow()
            )
            db.add(rel)
            db.commit()

            # Notify Vendor with updated reliability index
            v_users = db.query(User).filter(User.vendor_id == po.vendor_id).all()
            for vu in v_users:
                db.add(Notification(
                    user_id=vu.id,
                    type=NotificationType.PROCUREMENT_ALERT,
                    message=f"Order {po.po_number} confirmed DELIVERED. Commercial Tax Invoice {inv_number} generated. Your Vendor Reliability Index has been updated to {new_score}% (Rating: {intel.get('average_quality_rating', 0.0)}/5.0).",
                    is_read=False
                ))

        # Notification to Procurement Manager
        notif_msg = f"PO {po.po_number} delivered by {po.vendor.company_name if po.vendor else 'Supplier'} (On-Time: {'Yes' if is_on_time else 'Delayed'}). Invoice {inv_number} & performance record finalized."
        if po.created_by_id:
            db.add(Notification(
                user_id=po.created_by_id,
                type=NotificationType.DELIVERY_DELAY if not is_on_time else NotificationType.PROCUREMENT_ALERT,
                message=notif_msg,
                is_read=False
            ))
        db.commit()

    po.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(po)

    log_audit_event(
        db, current_user.id, "PO_STATUS_CHANGE", "PurchaseOrder",
        f"Updated PO {po.po_number} status to {po.status.value}"
    )
    return po

# --- Invoices Endpoints ---

@router.get("/invoices", response_model=List[InvoiceResponse])
def get_invoices(
    status_filter: Optional[InvoiceStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Invoice).options(
        joinedload(Invoice.purchase_order).joinedload(PurchaseOrder.vendor),
        joinedload(Invoice.purchase_order).joinedload(PurchaseOrder.items)
    )

    if current_user.role == UserRole.VENDOR:
        if not current_user.vendor_id:
            return []
        query = query.join(PurchaseOrder).filter(PurchaseOrder.vendor_id == current_user.vendor_id)

    if status_filter:
        query = query.filter(Invoice.status == status_filter)

    return query.order_by(Invoice.id.desc()).all()

@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice_by_id(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inv = db.query(Invoice).options(
        joinedload(Invoice.purchase_order).joinedload(PurchaseOrder.vendor),
        joinedload(Invoice.purchase_order).joinedload(PurchaseOrder.items)
    ).filter(Invoice.id == invoice_id).first()

    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if current_user.role == UserRole.VENDOR and inv.purchase_order.vendor_id != current_user.vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return inv

@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    invoice_in: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER,
        UserRole.FINANCE_OFFICER, UserRole.VENDOR
    ]))
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == invoice_in.purchase_order_id).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase Order not found")

    if current_user.role == UserRole.VENDOR and po.vendor_id != current_user.vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    unique_suffix = str(uuid.uuid4().hex[:6]).upper()
    invoice_number = f"INV-{datetime.utcnow().year}-{unique_suffix}"

    invoice = Invoice(
        invoice_number=invoice_number,
        purchase_order_id=invoice_in.purchase_order_id,
        amount=invoice_in.amount,
        status=InvoiceStatus.PENDING,
        due_date=invoice_in.due_date
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    log_audit_event(
        db, current_user.id, "CREATE_INVOICE", "Invoice",
        f"Generated invoice {invoice.invoice_number} for PO {po.po_number} (₹{invoice.amount:,.2f})"
    )
    return invoice

@router.patch("/invoices/{invoice_id}/status", response_model=InvoiceResponse)
def update_invoice_status(
    invoice_id: int,
    status_in: InvoiceStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([
        UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.PROCUREMENT_MANAGER
    ]))
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    invoice.status = status_in.status
    if status_in.status == InvoiceStatus.PAID:
        invoice.paid_date = status_in.paid_date or date.today()

    db.commit()
    db.refresh(invoice)

    log_audit_event(
        db, current_user.id, "INVOICE_STATUS_CHANGE", "Invoice",
        f"Updated invoice {invoice.invoice_number} status to {invoice.status.value}"
    )
    return invoice
