from typing import List, Optional
from datetime import datetime, date
import random
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.purchase_order import PurchaseOrder
from app.models.vendor import Vendor
from app.models.contract import Contract
from app.models.invoice import Invoice
from app.schemas.purchase_order import (
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    PurchaseOrderStatusUpdate,
    PurchaseOrderDispatch,
    PurchaseOrderQA,
    PurchaseOrderInvoice,
    PurchaseOrderPayment
)
from app.api.v1.endpoints.notifications import create_system_notification
from app.api import deps
from app.models.user import User

router = APIRouter()

def recalculate_vendor_metrics(db: Session, vendor_id: int):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        return
    delivered_orders = db.query(PurchaseOrder).filter(
        PurchaseOrder.vendor_id == vendor_id,
        PurchaseOrder.status.in_(["Delivered", "Completed"])
    ).all()
    if not delivered_orders:
        return
    
    total = len(delivered_orders)
    on_time = sum(
        1 for o in delivered_orders 
        if o.actual_delivery_date and o.expected_delivery_date and o.actual_delivery_date <= o.expected_delivery_date
    )
    delivery_acc = round((on_time / total) * 100.0, 1) if total > 0 else 95.0
    
    ratings = [o.quality_rating for o in delivered_orders if o.quality_rating is not None]
    avg_quality = (sum(ratings) / len(ratings)) if ratings else 4.5
    quality_percent = (avg_quality / 5.0) * 100.0
    
    contract = db.query(Contract).filter(Contract.vendor_id == vendor_id).first()
    sla_score = 100.0 if (contract and contract.compliance_status == "Compliant") else 85.0
    
    # Formula matching PDF: 35% delivery accuracy + 30% quality + 15% response time + 20% contract SLA
    overall_score = round(
        (delivery_acc * 0.35) + 
        (quality_percent * 0.30) + 
        (90.0 * 0.15) + 
        (sla_score * 0.20), 
        1
    )
    vendor.delivery_accuracy = delivery_acc
    vendor.reliability_score = min(100.0, max(0.0, overall_score))
    db.commit()

@router.get("/orders", response_model=List[PurchaseOrderResponse])
def get_purchase_orders(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    vendor_id: Optional[int] = Query(None),
    limit: int = Query(150),
    current_user: User = Depends(deps.get_current_user)
):
    query = db.query(PurchaseOrder)
    
    # If the user is a vendor, strictly isolate to their own registered company
    if current_user.role == "Vendor":
        vendor = db.query(Vendor).filter(Vendor.email == current_user.email).first()
        if vendor:
            query = query.filter(PurchaseOrder.vendor_id == vendor.id)
        else:
            return []
    elif vendor_id:
        query = query.filter(PurchaseOrder.vendor_id == vendor_id)
        
    if status and status != "All":
        query = query.filter(PurchaseOrder.status == status)

    orders = query.order_by(PurchaseOrder.id.desc()).limit(limit).all()
    
    results = []
    for o in orders:
        vendor = db.query(Vendor).filter(Vendor.id == o.vendor_id).first()
        item = PurchaseOrderResponse.from_orm(o)
        item.vendor_name = vendor.company_name if vendor else "Unknown Supplier"
        results.append(item)
    return results

@router.post("/orders", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    po_in: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Role permission check: Only Procurement Managers and Administrators can initiate requisitions
    if current_user.role not in ["Procurement Manager", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: {current_user.role} role cannot create purchase requisitions. Only Procurement Managers and Administrators can initiate orders."
        )

    vendor = db.query(Vendor).filter(Vendor.id == po_in.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Selected vendor not found")

    order_num = po_in.order_number or f"PO-{datetime.now().year}-{random.randint(1000, 9999)}"
    while db.query(PurchaseOrder).filter(PurchaseOrder.order_number == order_num).first():
        order_num = f"PO-{datetime.now().year}-{random.randint(1000, 9999)}"

    po = PurchaseOrder(
        vendor_id=po_in.vendor_id,
        order_number=order_num,
        title=po_in.title,
        status="Pending",
        total_amount=po_in.total_amount,
        expected_delivery_date=po_in.expected_delivery_date,
        department=po_in.department or "Supply Chain & Logistics",
        shipping_mode=po_in.shipping_mode or "Standard Class",
        destination_country=po_in.destination_country or "United States",
        destination_city=po_in.destination_city or "Chicago",
        items_count=po_in.items_count or 1,
        unit_price=po_in.unit_price or po_in.total_amount,
        product_category=po_in.product_category or "Industrial & Logistics",
        priority=po_in.priority or "Standard",
        notes=po_in.notes or "",
        quality_rating=None,
        issue_flag=False,
        issue_resolved=True,
        response_time_hours=2.0
    )
    db.add(po)
    db.commit()
    db.refresh(po)

    # Trigger notification
    create_system_notification(
        db,
        target_role="Procurement Manager",
        title=f"Requisition Created: {po.order_number}",
        message=f"Purchase order for '{po.title}' (${po.total_amount:,.2f}) requires managerial review and approval.",
        notif_type="Order"
    )

    res = PurchaseOrderResponse.from_orm(po)
    res.vendor_name = vendor.company_name
    return res

# ----------------------------------------------------
# 1. APPROVE REQUISITION (Procurement Manager / Admin)
# ----------------------------------------------------
@router.patch("/orders/{order_id}/approve", response_model=PurchaseOrderResponse)
def approve_purchase_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if current_user.role not in ["Procurement Manager", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Procurement Managers and Administrators can approve purchase orders."
        )
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    
    po.status = "Approved"
    db.commit()
    db.refresh(po)

    vendor = db.query(Vendor).filter(Vendor.id == po.vendor_id).first()
    # Notify Vendor
    create_system_notification(
        db,
        target_role="Vendor",
        title=f"PO Approved: {po.order_number}",
        message=f"Purchase order {po.order_number} for '{po.title}' is authorized. Please dispatch goods with tracking details.",
        notif_type="Order"
    )

    res = PurchaseOrderResponse.from_orm(po)
    res.vendor_name = vendor.company_name if vendor else "Unknown Supplier"
    return res

# ----------------------------------------------------
# 2. DISPATCH & SHIPMENT (Vendor / Admin)
# ----------------------------------------------------
@router.patch("/orders/{order_id}/dispatch", response_model=PurchaseOrderResponse)
def dispatch_purchase_order(
    order_id: int,
    dispatch_in: PurchaseOrderDispatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if current_user.role not in ["Vendor", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only assigned Vendors (or Administrators) can dispatch shipments."
        )
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    
    vendor = db.query(Vendor).filter(Vendor.id == po.vendor_id).first()
    if current_user.role == "Vendor" and vendor and vendor.email != current_user.email:
        raise HTTPException(status_code=403, detail="You can only dispatch orders assigned to your registered company.")

    po.status = "Ordered"
    po.carrier_name = dispatch_in.carrier_name
    po.tracking_number = dispatch_in.tracking_number
    po.dispatch_date = date.today()
    db.commit()
    db.refresh(po)

    # Notify Supply Chain Manager
    create_system_notification(
        db,
        target_role="Supply Chain Manager",
        title=f"Shipment Dispatched: {po.order_number}",
        message=f"Supplier {vendor.company_name if vendor else ''} dispatched {po.order_number} via {dispatch_in.carrier_name} ({dispatch_in.tracking_number}). In transit to dock.",
        notif_type="Delivery"
    )

    res = PurchaseOrderResponse.from_orm(po)
    res.vendor_name = vendor.company_name if vendor else "Unknown Supplier"
    return res

# ----------------------------------------------------
# 3. RECEIPT & QA INSPECTION (Supply Chain Manager / Admin)
# ----------------------------------------------------
@router.patch("/orders/{order_id}/receive", response_model=PurchaseOrderResponse)
def receive_purchase_order_qa(
    order_id: int,
    qa_in: PurchaseOrderQA,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if current_user.role not in ["Supply Chain Manager", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Supply Chain Managers and Administrators can verify goods receipt and conduct QA inspection."
        )
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    po.status = "Delivered"
    po.actual_delivery_date = date.today()
    po.quality_rating = max(1.0, min(5.0, round(qa_in.quality_rating, 1)))
    po.qa_notes = qa_in.qa_notes or "Passed receiving quality inspection."
    db.commit()
    db.refresh(po)

    # Recalculate vendor's autonomous reliability score
    recalculate_vendor_metrics(db, po.vendor_id)

    vendor = db.query(Vendor).filter(Vendor.id == po.vendor_id).first()
    # Notify Vendor to bill
    create_system_notification(
        db,
        target_role="Vendor",
        title=f"Delivery Accepted: {po.order_number}",
        message=f"Shipment received at facility dock with Quality Rating {po.quality_rating}/5.0. Please submit formal invoice.",
        notif_type="Delivery"
    )
    # Notify Finance Officer
    create_system_notification(
        db,
        target_role="Finance Officer",
        title=f"Ready for 3-Way Match: {po.order_number}",
        message=f"Order {po.order_number} delivered and QA cleared. Ready for invoice reconciliation and payment authorization.",
        notif_type="Order"
    )

    res = PurchaseOrderResponse.from_orm(po)
    res.vendor_name = vendor.company_name if vendor else "Unknown Supplier"
    return res

# ----------------------------------------------------
# 4. SUBMIT INVOICE (Vendor / Admin)
# ----------------------------------------------------
@router.patch("/orders/{order_id}/invoice", response_model=PurchaseOrderResponse)
def submit_order_invoice(
    order_id: int,
    inv_in: PurchaseOrderInvoice,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if current_user.role not in ["Vendor", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Vendors can submit billing invoices for completed orders."
        )
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    po.invoice_number = inv_in.invoice_number
    po.invoice_amount = inv_in.invoice_amount
    po.invoice_status = "Submitted"

    # Also record in invoices table
    existing_inv = db.query(Invoice).filter(Invoice.invoice_number == inv_in.invoice_number).first()
    if not existing_inv:
        invoice_record = Invoice(
            purchase_order_id=po.id,
            vendor_id=po.vendor_id,
            invoice_number=inv_in.invoice_number,
            amount=inv_in.invoice_amount,
            invoice_date=date.today(),
            status="Submitted",
            notes=f"Invoice for PO {po.order_number}"
        )
        db.add(invoice_record)

    db.commit()
    db.refresh(po)

    vendor = db.query(Vendor).filter(Vendor.id == po.vendor_id).first()
    create_system_notification(
        db,
        target_role="Finance Officer",
        title=f"Invoice Submitted: {inv_in.invoice_number}",
        message=f"Supplier {vendor.company_name if vendor else ''} submitted invoice for ${inv_in.invoice_amount:,.2f} on {po.order_number}.",
        notif_type="Order"
    )

    res = PurchaseOrderResponse.from_orm(po)
    res.vendor_name = vendor.company_name if vendor else "Unknown Supplier"
    return res

# ----------------------------------------------------
# 5. 3-WAY MATCH & PAYMENT AUTHORIZATION (Finance Officer / Admin)
# ----------------------------------------------------
@router.patch("/orders/{order_id}/pay", response_model=PurchaseOrderResponse)
def authorize_payment(
    order_id: int,
    pay_in: PurchaseOrderPayment,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if current_user.role not in ["Finance Officer", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Finance Officers and Administrators can authorize payment clearance."
        )
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    po.status = "Completed"
    po.invoice_status = "Paid"
    po.payment_date = date.today()
    po.payment_notes = pay_in.payment_notes or "3-Way Match verified against goods receipt. Funds cleared via corporate ledger."

    # Update invoice record
    if po.invoice_number:
        inv = db.query(Invoice).filter(Invoice.invoice_number == po.invoice_number).first()
        if inv:
            inv.status = "Paid"

    db.commit()
    db.refresh(po)

    vendor = db.query(Vendor).filter(Vendor.id == po.vendor_id).first()
    create_system_notification(
        db,
        target_role="Vendor",
        title=f"Payment Cleared: {po.order_number}",
        message=f"Payment of ${po.total_amount:,.2f} for {po.order_number} has been authorized and disbursed to your account.",
        notif_type="Order"
    )
    create_system_notification(
        db,
        target_role="Auditor",
        title=f"Procurement Lifecycle Completed: {po.order_number}",
        message=f"PO {po.order_number} (${po.total_amount:,.2f}) fully settled and archived for compliance reporting.",
        notif_type="Compliance"
    )

    res = PurchaseOrderResponse.from_orm(po)
    res.vendor_name = vendor.company_name if vendor else "Unknown Supplier"
    return res

# ----------------------------------------------------
# 6. CANCEL ORDER (Procurement Manager / Admin)
# ----------------------------------------------------
@router.patch("/orders/{order_id}/cancel", response_model=PurchaseOrderResponse)
def cancel_purchase_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    if current_user.role not in ["Procurement Manager", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Procurement Managers and Administrators can cancel purchase requisitions."
        )
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    po.status = "Cancelled"
    db.commit()
    db.refresh(po)

    vendor = db.query(Vendor).filter(Vendor.id == po.vendor_id).first()
    res = PurchaseOrderResponse.from_orm(po)
    res.vendor_name = vendor.company_name if vendor else "Unknown Supplier"
    return res

# ----------------------------------------------------
# Backward Compatible Generic Status Update
# ----------------------------------------------------
@router.patch("/orders/{order_id}/status", response_model=PurchaseOrderResponse)
def update_order_status(
    order_id: int,
    status_in: PurchaseOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    
    valid_statuses = ["Pending", "Approved", "Ordered", "Delivered", "Completed", "Cancelled"]
    if status_in.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    po.status = status_in.status
    if status_in.status == "Delivered" and not po.actual_delivery_date:
        po.actual_delivery_date = date.today()
        if not po.quality_rating:
            po.quality_rating = round(random.uniform(4.2, 5.0), 1)
        recalculate_vendor_metrics(db, po.vendor_id)

    db.commit()
    db.refresh(po)

    vendor = db.query(Vendor).filter(Vendor.id == po.vendor_id).first()
    res = PurchaseOrderResponse.from_orm(po)
    res.vendor_name = vendor.company_name if vendor else "Unknown Supplier"
    return res
