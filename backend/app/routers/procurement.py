import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import ProcurementRequest, PRLineItem, PurchaseOrder, POItem, Vendor, User
from app.schemas import (
    ProcurementRequestCreate, ProcurementRequestResponse, ProcurementRequestStatusUpdate,
    PRLineItemResponse,
    PurchaseOrderCreate, PurchaseOrderResponse,
    POItemResponse, PODocumentResponse, PurchaseOrderUpdateStatus
)
from app.security import get_current_user, require_role
from app.routers.notifications import add_notification

router = APIRouter(prefix="/api/v1/procurement", tags=["Procurement"])
pr_router = APIRouter(prefix="/api/v1/procurement-requests", tags=["Procurement Requests"])

THRESHOLD_AMOUNT = Decimal("10000.00")

async def _list_procurement_requests(status_filter: Optional[str], db: AsyncSession):
    stmt = (
        select(ProcurementRequest)
        .options(
            selectinload(ProcurementRequest.requester),
            selectinload(ProcurementRequest.line_items)
        )
        .order_by(ProcurementRequest.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(ProcurementRequest.status.ilike(f"%{status_filter}%"))

    result = await db.execute(stmt)
    prs = result.scalars().all()
    return [
        ProcurementRequestResponse(
            id=pr.id,
            requester_id=pr.requester_id,
            requester_name=pr.requester.full_name if pr.requester else "Unknown",
            title=pr.title,
            description=pr.description,
            budget_amount=float(pr.budget_amount) if pr.budget_amount is not None else None,
            status=pr.status,
            total_estimated_cost=float(pr.total_estimated_cost or 0.0),
            created_at=pr.created_at,
            line_items=[
                PRLineItemResponse(
                    id=li.id,
                    item_name=li.item_name,
                    quantity=float(li.quantity),
                    estimated_cost=float(li.estimated_cost)
                )
                for li in (pr.line_items or [])
            ]
        )
        for pr in prs
    ]

async def _create_procurement_request(payload: ProcurementRequestCreate, db: AsyncSession, current_user: User):
    total = Decimal("0.00")
    if payload.line_items:
        for li in payload.line_items:
            total += Decimal(str(li.quantity)) * Decimal(str(li.estimated_cost))

    budget_val = Decimal(str(payload.budget_amount)) if payload.budget_amount is not None else None
    new_pr = ProcurementRequest(
        requester_id=current_user.id,
        title=payload.title,
        description=payload.description,
        status="pending",
        total_estimated_cost=total,
        budget_amount=budget_val
    )
    db.add(new_pr)
    await db.flush()

    if payload.line_items:
        for li in payload.line_items:
            item = PRLineItem(
                pr_id=new_pr.id,
                item_name=li.item_name,
                quantity=Decimal(str(li.quantity)),
                estimated_cost=Decimal(str(li.estimated_cost))
            )
            db.add(item)

    await add_notification(
        db,
        f"New PR '{new_pr.title}' (${float(total):,.2f}) submitted by {current_user.full_name}."
    )

    await db.commit()
    await db.refresh(new_pr)

    # Reload line items
    stmt = (
        select(ProcurementRequest)
        .where(ProcurementRequest.id == new_pr.id)
        .options(selectinload(ProcurementRequest.line_items))
    )
    reloaded = (await db.execute(stmt)).scalar_one()

    return ProcurementRequestResponse(
        id=reloaded.id,
        requester_id=reloaded.requester_id,
        requester_name=current_user.full_name,
        title=reloaded.title,
        description=reloaded.description,
        budget_amount=float(reloaded.budget_amount) if reloaded.budget_amount is not None else None,
        status=reloaded.status,
        total_estimated_cost=float(reloaded.total_estimated_cost or 0.0),
        created_at=reloaded.created_at,
        line_items=[
            PRLineItemResponse(
                id=li.id,
                item_name=li.item_name,
                quantity=float(li.quantity),
                estimated_cost=float(li.estimated_cost)
            )
            for li in (reloaded.line_items or [])
        ]
    )

async def _update_pr_status(pr_id: uuid.UUID, payload: ProcurementRequestStatusUpdate, db: AsyncSession, current_user: User):
    stmt = (
        select(ProcurementRequest)
        .where(ProcurementRequest.id == pr_id)
        .options(
            selectinload(ProcurementRequest.requester),
            selectinload(ProcurementRequest.line_items)
        )
    )
    result = await db.execute(stmt)
    pr = result.scalar_one_or_none()
    if not pr:
        raise HTTPException(status_code=404, detail="Procurement Request not found")

    user_role_names = [r.name for r in current_user.roles]
    target_status = payload.status.lower()

    # Threshold Check: PRs above $10,000 require Finance Officer or Administrator
    if target_status == "approved":
        if pr.total_estimated_cost and pr.total_estimated_cost > THRESHOLD_AMOUNT:
            if "Finance Officer" not in user_role_names and "Administrator" not in user_role_names:
                raise HTTPException(
                    status_code=403,
                    detail="Procurement requests exceeding $10,000 require Finance Officer or Administrator approval."
                )

    old_status = pr.status
    pr.status = target_status

    await add_notification(
        db,
        f"Procurement Request '{pr.title}' status changed from '{old_status}' to '{target_status}' by {current_user.full_name}.",
        user_id=pr.requester_id
    )

    await db.commit()
    await db.refresh(pr)

    return ProcurementRequestResponse(
        id=pr.id,
        requester_id=pr.requester_id,
        requester_name=pr.requester.full_name if pr.requester else "Unknown",
        title=pr.title,
        description=pr.description,
        budget_amount=float(pr.budget_amount) if pr.budget_amount is not None else None,
        status=pr.status,
        total_estimated_cost=float(pr.total_estimated_cost or 0.0),
        created_at=pr.created_at,
        line_items=[
            PRLineItemResponse(
                id=li.id,
                item_name=li.item_name,
                quantity=float(li.quantity),
                estimated_cost=float(li.estimated_cost)
            )
            for li in (pr.line_items or [])
        ]
    )

# --- Routes for /api/v1/procurement/requests ---
@router.get("/requests", response_model=List[ProcurementRequestResponse])
async def list_procurement_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await _list_procurement_requests(status_filter, db)

@router.post("/requests", response_model=ProcurementRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_procurement_request(
    payload: ProcurementRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Supply Chain Manager"))
):
    return await _create_procurement_request(payload, db, current_user)

@router.patch("/requests/{pr_id}/status", response_model=ProcurementRequestResponse)
async def update_pr_status(
    pr_id: uuid.UUID,
    payload: ProcurementRequestStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer"))
):
    return await _update_pr_status(pr_id, payload, db, current_user)

@router.post("/requests/{pr_id}/complete", response_model=ProcurementRequestResponse)
async def complete_procurement_request(
    pr_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer"))
):
    return await _update_pr_status(pr_id, ProcurementRequestStatusUpdate(status="completed"), db, current_user)

@router.post("/requests/{pr_id}/cancel", response_model=ProcurementRequestResponse)
async def cancel_procurement_request(
    pr_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer"))
):
    return await _update_pr_status(pr_id, ProcurementRequestStatusUpdate(status="cancelled"), db, current_user)

# --- Mirror routes for /api/v1/procurement-requests ---
@pr_router.get("", response_model=List[ProcurementRequestResponse])
async def list_prs(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await _list_procurement_requests(status_filter, db)

@pr_router.post("", response_model=ProcurementRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_pr(
    payload: ProcurementRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Supply Chain Manager"))
):
    return await _create_procurement_request(payload, db, current_user)

@pr_router.patch("/{pr_id}/status", response_model=ProcurementRequestResponse)
async def update_pr_stat(
    pr_id: uuid.UUID,
    payload: ProcurementRequestStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer"))
):
    return await _update_pr_status(pr_id, payload, db, current_user)

@pr_router.post("/{pr_id}/complete", response_model=ProcurementRequestResponse)
async def complete_pr(
    pr_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer"))
):
    return await _update_pr_status(pr_id, ProcurementRequestStatusUpdate(status="completed"), db, current_user)

@pr_router.post("/{pr_id}/cancel", response_model=ProcurementRequestResponse)
async def cancel_pr(
    pr_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer"))
):
    return await _update_pr_status(pr_id, ProcurementRequestStatusUpdate(status="cancelled"), db, current_user)


# --- Backwards Compatible Milestone 1 Purchase Orders Endpoints on /api/v1/procurement ---
@router.get("/orders", response_model=List[PurchaseOrderResponse])
@router.get("/purchase-orders", response_model=List[PurchaseOrderResponse])
async def list_purchase_orders(
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
    result = await db.execute(stmt)
    pos = result.scalars().all()

    return [
        PurchaseOrderResponse(
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
                for item in po.items
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
        for po in pos
    ]

@router.post("/orders", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
@router.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
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
    await db.refresh(new_po)

    return PurchaseOrderResponse(
        id=new_po.id,
        pr_id=new_po.pr_id,
        vendor_id=new_po.vendor_id,
        vendor_name=vendor.company_name,
        po_number=new_po.po_number,
        status=new_po.status,
        delivery_status=new_po.delivery_status or "in_progress",
        invoice_amount=None,
        invoice_received_at=None,
        total_amount=float(new_po.total_amount),
        created_at=new_po.created_at,
        items=[
            POItemResponse(
                id=item.id,
                item_name=item.item_name,
                quantity=float(item.quantity),
                unit_price=float(item.unit_price)
            )
            for item in new_po.items
        ],
        documents=[]
    )

@router.patch("/orders/{order_id}/status", response_model=PurchaseOrderResponse)
@router.patch("/purchase-orders/{order_id}/status", response_model=PurchaseOrderResponse)
async def update_procurement_po_status(
    order_id: uuid.UUID,
    payload: PurchaseOrderUpdateStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer", "Supply Chain Manager"))
):
    from app.routers.purchase_orders import _update_po_status
    return await _update_po_status(order_id, payload.status, db, current_user)

@router.post("/orders/{order_id}/complete", response_model=PurchaseOrderResponse)
@router.post("/purchase-orders/{order_id}/complete", response_model=PurchaseOrderResponse)
async def complete_procurement_po(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer", "Supply Chain Manager"))
):
    from app.routers.purchase_orders import _update_po_status
    return await _update_po_status(order_id, "COMPLETED", db, current_user)

@router.post("/orders/{order_id}/cancel", response_model=PurchaseOrderResponse)
@router.post("/purchase-orders/{order_id}/cancel", response_model=PurchaseOrderResponse)
async def cancel_procurement_po(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("Administrator", "Procurement Manager", "Finance Officer", "Supply Chain Manager"))
):
    from app.routers.purchase_orders import _update_po_status
    return await _update_po_status(order_id, "CANCELLED", db, current_user)

