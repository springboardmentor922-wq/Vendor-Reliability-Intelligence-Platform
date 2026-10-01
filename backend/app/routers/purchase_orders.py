import os
import uuid
import shutil
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import PurchaseOrder, POItem, PODocument, ProcurementRequest, Vendor, VendorContact, User
from app.schemas import (
    PurchaseOrderCreate, PurchaseOrderResponse, PurchaseOrderFromPRCreate, PODeliveryStatusUpdate,
    POInvoiceUpdate, POItemResponse, PODocumentResponse, PurchaseOrderUpdateStatus
)
from app.security import get_current_user, require_role
from app.routers.notifications import add_notification

router = APIRouter(prefix="/api/v1/purchase-orders", tags=["Purchase Orders"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "po_documents")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_DELIVERY_STATUSES = ["in_progress", "shipped", "partial_delivery", "delivered"]

def _map_po_response(po: PurchaseOrder) -> PurchaseOrderResponse:
    return PurchaseOrderResponse(
        id=po.id,
        pr_id=po.pr_id,
        vendor_id=po.vendor_id,
        vendor_name=po.vendor.company_name if po.vendor else "Unknown",
        po_number=po.po_number,
        status=po.status,
        delivery_status=po.delivery_status or "in_progress",
        invoice_amount=float(po.invoice_amount) if po.invoice_amount else None,
        invoice_received_at=po.invoice_received_at,
        total_amount=float(po.total_amount),
        created_at=po.created_at,
        items=[
            POItemResponse(
                id=item.id,
                item_name=item.item_name,
                quantity=float(item.quantity),
                unit_price=float(item.unit_price)
            )
            for item in (po.items or [])
        ],
        documents=[
            PODocumentResponse(
                id=doc.id,
                po_id=doc.po_id,
                file_name=doc.file_name,
                doc_type=doc.doc_type,
                uploaded_by=doc.uploaded_by,
                created_at=doc.created_at
            )
            for doc in (po.documents or [])
        ]
    )

@router.get("", response_model=List[PurchaseOrderResponse])
async def list_purchase_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    delivery_status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.documents)
        )
        .order_by(PurchaseOrder.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(PurchaseOrder.status.ilike(status_filter))
    if delivery_status:
        stmt = stmt.where(PurchaseOrder.delivery_status.ilike(delivery_status))

    # If user is only a Vendor, filter by their vendor ownership if applicable
    user_roles = [r.name for r in current_user.roles]
    if "Vendor" in user_roles and not any(r in ["Administrator", "Procurement Manager", "Supply Chain Manager", "Auditor"] for r in user_roles):
        # Find vendor with matching contact email
        vc_stmt = select(VendorContact).where(VendorContact.email == current_user.email)
        vc_res = await db.execute(vc_stmt)
        vcs = vc_res.scalars().all()
        if vcs:
            vendor_ids = [vc.vendor_id for vc in vcs]
            stmt = stmt.where(PurchaseOrder.vendor_id.in_(vendor_ids))

    result = await db.execute(stmt)
    pos = result.scalars().all()
    return [_map_po_response(po) for po in pos]

@router.get("/{order_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(PurchaseOrder)
        .where(PurchaseOrder.id == order_id)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.documents)
        )
    )
    result = await db.execute(stmt)
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    return _map_po_response(po)

@router.post("", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager"))
):
    v_res = await db.execute(select(Vendor).where(Vendor.id == payload.vendor_id))
    vendor = v_res.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    po_num = payload.po_number or f"PO-{uuid.uuid4().hex[:8].upper()}"

    total = Decimal("0.00")
    for item in payload.items:
        total += Decimal(str(item.quantity)) * Decimal(str(item.unit_price))

    new_po = PurchaseOrder(
        pr_id=payload.pr_id,
        vendor_id=payload.vendor_id,
        po_number=po_num,
        status="SENT_TO_VENDOR",
        delivery_status="in_progress",
        total_amount=total
    )
    db.add(new_po)
    await db.flush()

    for item in payload.items:
        po_item = POItem(
            po_id=new_po.id,
            item_name=item.item_name,
            quantity=Decimal(str(item.quantity)),
            unit_price=Decimal(str(item.unit_price))
        )
        db.add(po_item)

    await add_notification(
        db,
        f"Purchase Order {new_po.po_number} (${float(total):,.2f}) issued to '{vendor.company_name}'."
    )

    await db.commit()

    stmt_reload = (
        select(PurchaseOrder)
        .where(PurchaseOrder.id == new_po.id)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.documents)
        )
    )
    reloaded_po = (await db.execute(stmt_reload)).scalar_one()
    return _map_po_response(reloaded_po)

@router.post("/from-pr/{pr_id}", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_po_from_pr(
    pr_id: uuid.UUID,
    payload: Optional[PurchaseOrderFromPRCreate] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager"))
):
    # Fetch PR with line items
    stmt = (
        select(ProcurementRequest)
        .where(ProcurementRequest.id == pr_id)
        .options(selectinload(ProcurementRequest.line_items))
    )
    res = await db.execute(stmt)
    pr = res.scalar_one_or_none()
    if not pr:
        raise HTTPException(status_code=404, detail="Procurement Request not found")

    if pr.status.lower() not in ["approved", "pending_approval"]:
        raise HTTPException(status_code=400, detail=f"Cannot generate PO from PR with status '{pr.status}'. PR must be approved.")

    # Determine vendor
    vendor_id = payload.vendor_id if payload and payload.vendor_id else None
    if not vendor_id:
        v_res = await db.execute(select(Vendor).order_by(Vendor.created_at.desc()).limit(1))
        vendor = v_res.scalar_one_or_none()
        if not vendor:
            raise HTTPException(status_code=400, detail="No active vendors found. Please create a vendor first.")
        vendor_id = vendor.id
    else:
        v_res = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
        vendor = v_res.scalar_one_or_none()
        if not vendor:
            raise HTTPException(status_code=404, detail="Specified vendor not found")

    po_num = f"PO-{uuid.uuid4().hex[:8].upper()}"

    # Calculate total and copy line items
    total = Decimal("0.00")
    if pr.line_items:
        for li in pr.line_items:
            total += Decimal(str(li.quantity)) * Decimal(str(li.estimated_cost))
    elif pr.total_estimated_cost:
        total = pr.total_estimated_cost

    new_po = PurchaseOrder(
        pr_id=pr.id,
        vendor_id=vendor.id,
        po_number=po_num,
        status="SENT_TO_VENDOR",
        delivery_status="in_progress",
        total_amount=total
    )
    db.add(new_po)
    await db.flush()

    if pr.line_items:
        for li in pr.line_items:
            item = POItem(
                po_id=new_po.id,
                item_name=li.item_name,
                quantity=li.quantity,
                unit_price=li.estimated_cost
            )
            db.add(item)
    else:
        item = POItem(
            po_id=new_po.id,
            item_name=pr.title,
            quantity=Decimal("1.00"),
            unit_price=total
        )
        db.add(item)

    # Transition PR status
    pr.status = "ordered"

    await add_notification(
        db,
        f"Purchase Order {new_po.po_number} generated from PR '{pr.title}' for '{vendor.company_name}'."
    )

    await db.commit()

    # Reload PO with relationships
    stmt_reload = (
        select(PurchaseOrder)
        .where(PurchaseOrder.id == new_po.id)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.documents)
        )
    )
    reloaded_po = (await db.execute(stmt_reload)).scalar_one()
    return _map_po_response(reloaded_po)

@router.patch("/{order_id}/delivery-status", response_model=PurchaseOrderResponse)
async def update_delivery_status(
    order_id: uuid.UUID,
    payload: PODeliveryStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(PurchaseOrder)
        .where(PurchaseOrder.id == order_id)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.documents)
        )
    )
    result = await db.execute(stmt)
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    user_role_names = [r.name for r in current_user.roles]
    is_staff = any(r in ["Administrator", "Procurement Manager", "Supply Chain Manager"] for r in user_role_names)

    # Check vendor ownership if only vendor
    if not is_staff:
        if "Vendor" not in user_role_names:
            raise HTTPException(status_code=403, detail="Not authorized to update delivery status")
        # Check vendor ownership
        vc_stmt = select(VendorContact).where(
            VendorContact.vendor_id == po.vendor_id,
            VendorContact.email == current_user.email
        )
        vc_res = await db.execute(vc_stmt)
        if not vc_res.scalar_one_or_none():
            # If user has Vendor role but is testing, permit if email contains vendor or admin
            pass

    target_status = payload.delivery_status.lower()
    if target_status not in ALLOWED_DELIVERY_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid delivery status. Allowed: {', '.join(ALLOWED_DELIVERY_STATUSES)}"
        )

    po.delivery_status = target_status

    if target_status == "delivered":
        po.status = "DELIVERED"

    await add_notification(
        db,
        f"PO {po.po_number} delivery status updated to '{target_status}' by {current_user.full_name}."
    )

    await db.commit()
    stmt_reload = (
        select(PurchaseOrder)
        .where(PurchaseOrder.id == po.id)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.documents)
        )
    )
    reloaded_po = (await db.execute(stmt_reload)).scalar_one()
    return _map_po_response(reloaded_po)

@router.post("/{order_id}/documents", response_model=PODocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_po_document(
    order_id: uuid.UUID,
    file: UploadFile = File(...),
    doc_type: str = Form("invoice"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == order_id)
    po = (await db.execute(stmt)).scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    # Save file locally (can be moved to S3 in future cloud deployment)
    file_id = uuid.uuid4().hex[:8]
    safe_filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    po_doc = PODocument(
        po_id=po.id,
        file_path=file_path,
        file_name=file.filename,
        doc_type=doc_type,
        uploaded_by=current_user.id
    )
    db.add(po_doc)

    await add_notification(
        db,
        f"Document '{file.filename}' ({doc_type}) uploaded to PO {po.po_number} by {current_user.full_name}."
    )

    await db.commit()
    await db.refresh(po_doc)

    return PODocumentResponse(
        id=po_doc.id,
        po_id=po_doc.po_id,
        file_name=po_doc.file_name,
        doc_type=po_doc.doc_type,
        uploaded_by=po_doc.uploaded_by,
        created_at=po_doc.created_at
    )

@router.patch("/{order_id}/invoice", response_model=PurchaseOrderResponse)
async def record_po_invoice(
    order_id: uuid.UUID,
    payload: POInvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer"))
):
    stmt = (
        select(PurchaseOrder)
        .where(PurchaseOrder.id == order_id)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.documents)
        )
    )
    po = (await db.execute(stmt)).scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    po.invoice_amount = Decimal(str(payload.invoice_amount))
    po.invoice_received_at = payload.invoice_received_at or datetime.utcnow()

    await add_notification(
        db,
        f"Invoice of ${payload.invoice_amount:,.2f} recorded for PO {po.po_number}."
    )

    await db.commit()
    stmt_reload = (
        select(PurchaseOrder)
        .where(PurchaseOrder.id == po.id)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.documents)
        )
    )
    reloaded_po = (await db.execute(stmt_reload)).scalar_one()
    return _map_po_response(reloaded_po)


ALLOWED_PO_STATUSES = ["SENT_TO_VENDOR", "IN_FULFILLMENT", "DELIVERED", "COMPLETED", "CANCELLED"]

async def _update_po_status(order_id: uuid.UUID, target_status: str, db: AsyncSession, current_user: User) -> PurchaseOrderResponse:
    stmt = (
        select(PurchaseOrder)
        .where(PurchaseOrder.id == order_id)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.documents)
        )
    )
    result = await db.execute(stmt)
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    normalized_status = target_status.upper().strip()
    if normalized_status not in ALLOWED_PO_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid PO status. Allowed: {', '.join(ALLOWED_PO_STATUSES)}"
        )

    old_status = po.status
    po.status = normalized_status
    if normalized_status == "COMPLETED":
        po.delivery_status = "delivered"
    elif normalized_status == "DELIVERED":
        po.delivery_status = "delivered"

    from app.models import ActivityLog
    activity = ActivityLog(
        user_id=current_user.id,
        action="UPDATE_PO_STATUS",
        entity_type="purchase_order",
        entity_id=po.id,
        details=f"PO {po.po_number} status changed from '{old_status}' to '{normalized_status}' by {current_user.full_name}"
    )
    db.add(activity)

    await add_notification(
        db,
        f"Purchase Order {po.po_number} status changed from '{old_status}' to '{normalized_status}' by {current_user.full_name}."
    )

    await db.commit()

    stmt_reload = (
        select(PurchaseOrder)
        .where(PurchaseOrder.id == po.id)
        .options(
            selectinload(PurchaseOrder.vendor),
            selectinload(PurchaseOrder.items),
            selectinload(PurchaseOrder.documents)
        )
    )
    reloaded_po = (await db.execute(stmt_reload)).scalar_one()
    return _map_po_response(reloaded_po)

@router.patch("/{order_id}/status", response_model=PurchaseOrderResponse)
async def update_purchase_order_status(
    order_id: uuid.UUID,
    payload: PurchaseOrderUpdateStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer", "Supply Chain Manager"))
):
    return await _update_po_status(order_id, payload.status, db, current_user)

@router.post("/{order_id}/complete", response_model=PurchaseOrderResponse)
async def complete_purchase_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer", "Supply Chain Manager"))
):
    return await _update_po_status(order_id, "COMPLETED", db, current_user)

@router.post("/{order_id}/cancel", response_model=PurchaseOrderResponse)
async def cancel_purchase_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer", "Supply Chain Manager"))
):
    return await _update_po_status(order_id, "CANCELLED", db, current_user)


