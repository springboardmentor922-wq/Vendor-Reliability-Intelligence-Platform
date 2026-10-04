from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, date, timedelta
import uuid
from app.database import get_db
from app.models.procurement import ProcurementRequest, PurchaseOrder, PurchaseOrderItem, Invoice
from app.models.vendor import Vendor
from app.models.user import User
from app.models.performance import PerformanceRecord, ReliabilityScore
from app.models.notification import Notification
from app.models.enums import UserRole, RequestStatus, POStatus, InvoiceStatus, VendorStatus, NotificationType
from app.routers.analytics import compute_vendor_intelligence
from app.schemas.procurement import (
    ProcurementRequestCreate, ProcurementRequestUpdate,
    ProcurementRequestStatusUpdate, ProcurementRequestResponse,
    PurchaseOrderCreate, PurchaseOrderStatusUpdate, PurchaseOrderResponse,
    InvoiceCreate, InvoiceStatusUpdate, InvoiceResponse
)
from app.core.dependencies import get_current_user, require_roles
from app.core.audit import log_audit_event

router = APIRouter(prefix="/procurement", tags=["Procurement & Orders"])

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
        ProcurementRequest.status.in_([RequestStatus.APPROVED, RequestStatus.PENDING, RequestStatus.SUBMITTED])
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
    
    unique_suffix = str(uuid.uuid4().hex[:6]).upper()
    po_number = f"PO-{datetime.utcnow().year}-{unique_suffix}"
    po = PurchaseOrder(
        po_number=po_number,
        procurement_request_id=req.id,
        vendor_id=vendor.id,
        status=POStatus.PENDING,
        total_amount=50000.0,
        expected_delivery_date=datetime.utcnow().date() + timedelta(days=14),
        payment_terms=vendor.payment_terms or "Net 15",
        created_by_id=req.requested_by_id
    )
    db.add(po)
    db.commit()
    db.refresh(po)
    
    item = PurchaseOrderItem(
        purchase_order_id=po.id,
        item_name=req.title,
        quantity=1.0,
        unit_price=50000.0
    )
    db.add(item)
    req.status = RequestStatus.APPROVED
    db.commit()
    return {
        "message": f"Successfully assigned requisition #{req.id}. Direct Purchase Order {po_number} created for {vendor.company_name}.",
        "po_number": po_number
    }

@router.get("/requests", response_model=List[ProcurementRequestResponse])
def get_procurement_requests(
    status_filter: Optional[RequestStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ProcurementRequest).options(joinedload(ProcurementRequest.requested_by))
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
    req = ProcurementRequest(
        title=req_in.title,
        description=req_in.description,
        department=req_in.department or getattr(current_user, "department", "Production") or "Production",
        requested_by_name=req_in.requested_by_name or current_user.full_name,
        quantity=req_in.quantity,
        needed_by=req_in.needed_by,
        priority=req_in.priority or "Medium",
        category=req_in.category,
        justification=req_in.justification,
        requested_by_id=current_user.id,
        status=RequestStatus.DRAFT if str(getattr(req_in, "status", "")).lower() == "draft" else RequestStatus.PENDING
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    log_audit_event(
        db, current_user.id, "CREATE_PROCUREMENT_REQUEST", "ProcurementRequest",
        f"Created procurement request '{req.title}'"
    )
    return req

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
    return req

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
        # Vendors can only transition ordered -> delivered (indicating delivery dispatch)
        if po.vendor_id != current_user.vendor_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        if status_in.status not in [POStatus.DELIVERED]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vendors can only mark orders as delivered")
    elif current_user.role not in [UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER, UserRole.SUPPLY_CHAIN_MANAGER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role not authorized to update PO status")

    po.status = status_in.status
    if status_in.status == POStatus.APPROVED:
        po.approved_by_id = current_user.id
    if status_in.status in [POStatus.DELIVERED, POStatus.COMPLETED]:
        po.actual_delivery_date = status_in.actual_delivery_date or date.today()
        is_on_time = po.actual_delivery_date <= po.expected_delivery_date
        
        # 1. Automatic Performance Record creation
        existing_perf = db.query(PerformanceRecord).filter(PerformanceRecord.purchase_order_id == po.id).first()
        if not existing_perf:
            perf = PerformanceRecord(
                vendor_id=po.vendor_id,
                purchase_order_id=po.id,
                on_time=is_on_time,
                quality_rating=4.8 if is_on_time else 4.0,
                response_time_hours=2.0,
                issue_resolution_hours=8.0 if is_on_time else 24.0,
                recorded_at=datetime.utcnow()
            )
            db.add(perf)
            db.commit()

        # 2. Recalculate & Persist Reliability Score
        if po.vendor:
            intel = compute_vendor_intelligence(po.vendor, db)
            rel = ReliabilityScore(
                vendor_id=po.vendor_id,
                score=intel.get("reliability_score", 0.0),
                risk_level=intel.get("risk_level", "Low"),
                calculated_at=datetime.utcnow()
            )
            db.add(rel)
            db.commit()

        # 3. Notification to Procurement
        notif_msg = f"PO {po.po_number} delivered by {po.vendor.company_name if po.vendor else 'Supplier'} (On-Time: {'Yes' if is_on_time else 'Delayed'}). Performance record generated."
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
