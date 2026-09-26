"""Purchase orders: creation from requests, line items, tracking, invoices."""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from deps import (
    get_current_user,
    require_finance,
    require_procurement,
    require_procurement_or_supply_chain,
    vendor_scope
)
from models import (
    Invoice,
    InvoiceStatus,
    NotificationType,
    ProcurementRequest,
    ProcurementStatus,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatus,
    User,
    UserRole,
    Vendor,
    VendorStatus
)
from schemas.common import Message
from schemas.purchase_order import (
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
    PurchaseOrderCreate,
    PurchaseOrderDetail,
    PurchaseOrderItemCreate,
    PurchaseOrderItemResponse,
    PurchaseOrderResponse,
    PurchaseOrderStats,
    PurchaseOrderStatusUpdate,
    PurchaseOrderUpdate
)
from services.events import (
    log_activity,
    notify_roles,
    notify_user,
    notify_vendor_users
)
from services.numbering import next_invoice_number, next_po_number

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders"])


# Legal status transitions for a purchase order.
_TRANSITIONS: dict[str, list[str]] = {
    PurchaseOrderStatus.PENDING: [
        PurchaseOrderStatus.APPROVED,
        PurchaseOrderStatus.CANCELLED
    ],
    PurchaseOrderStatus.APPROVED: [
        PurchaseOrderStatus.ORDERED,
        PurchaseOrderStatus.CANCELLED
    ],
    PurchaseOrderStatus.ORDERED: [
        PurchaseOrderStatus.DELIVERED,
        PurchaseOrderStatus.CANCELLED
    ],
    PurchaseOrderStatus.DELIVERED: [PurchaseOrderStatus.COMPLETED],
    PurchaseOrderStatus.COMPLETED: [],
    PurchaseOrderStatus.CANCELLED: []
}


# =========================================================
# HELPERS
# =========================================================

def _get_po(db: Session, po_id: int) -> PurchaseOrder:
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()

    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found"
        )

    return po


def _recalculate_totals(po: PurchaseOrder) -> None:
    subtotal = sum(
        (Decimal(item.quantity) * Decimal(item.unit_price) for item in po.items),
        Decimal("0")
    )

    po.subtotal = subtotal
    po.total_amount = (
        subtotal
        + Decimal(po.tax_amount or 0)
        + Decimal(po.shipping_amount or 0)
    )


def _delay_info(po: PurchaseOrder) -> tuple[bool, int]:
    """``(is_delayed, days_late)`` for a purchase order.

    Delivered orders compare actual against expected; open orders compare
    today against expected.
    """

    if not po.expected_delivery:
        return False, 0

    if po.actual_delivery:
        delta = (po.actual_delivery - po.expected_delivery).days
        return delta > 0, max(delta, 0)

    if po.status in (PurchaseOrderStatus.COMPLETED, PurchaseOrderStatus.CANCELLED):
        return False, 0

    delta = (date.today() - po.expected_delivery).days
    return delta > 0, max(delta, 0)


def _to_response(po: PurchaseOrder) -> PurchaseOrderResponse:
    payload = PurchaseOrderResponse.model_validate(po)
    payload.vendor_name = po.vendor.vendor_name if po.vendor else None
    payload.request_number = po.request.request_number if po.request else None
    payload.created_by_name = po.creator.name if po.creator else None
    payload.is_delayed, payload.days_late = _delay_info(po)
    return payload


def _to_invoice_response(invoice: Invoice) -> InvoiceResponse:
    payload = InvoiceResponse.model_validate(invoice)
    payload.vendor_name = invoice.vendor.vendor_name if invoice.vendor else None
    payload.po_number = (
        invoice.purchase_order.po_number if invoice.purchase_order else None
    )
    return payload


def _assert_po_access(current_user: User, po: PurchaseOrder) -> None:
    scope = vendor_scope(current_user)

    if scope is not None and po.vendor_id != scope:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access orders issued to your organisation"
        )


def _replace_items(
    db: Session,
    po: PurchaseOrder,
    items: list[PurchaseOrderItemCreate]
) -> None:
    for existing in list(po.items):
        db.delete(existing)

    po.items.clear()
    db.flush()

    for item in items:
        line = PurchaseOrderItem(
            purchase_order_id=po.id,
            item_name=item.item_name,
            description=item.description,
            quantity=item.quantity,
            unit=item.unit,
            unit_price=item.unit_price,
            line_total=Decimal(item.quantity) * Decimal(item.unit_price)
        )
        db.add(line)
        po.items.append(line)


# =========================================================
# REFERENCE DATA & STATS
# =========================================================

@router.get("/meta/statuses", response_model=list[str])
def list_statuses(current_user: User = Depends(get_current_user)):
    return PurchaseOrderStatus.ALL


@router.get("/stats/summary", response_model=PurchaseOrderStats)
def po_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(PurchaseOrder)

    scope = vendor_scope(current_user)
    if scope is not None:
        query = query.filter(PurchaseOrder.vendor_id == scope)

    orders = query.all()

    counts: dict[str, int] = {}
    for order in orders:
        counts[order.status] = counts.get(order.status, 0) + 1

    total_value = sum(
        (Decimal(o.total_amount or 0) for o in orders
         if o.status != PurchaseOrderStatus.CANCELLED),
        Decimal("0")
    )

    open_value = sum(
        (Decimal(o.total_amount or 0) for o in orders
         if o.status in (
             PurchaseOrderStatus.PENDING,
             PurchaseOrderStatus.APPROVED,
             PurchaseOrderStatus.ORDERED
         )),
        Decimal("0")
    )

    delayed = sum(1 for o in orders if _delay_info(o)[0])

    closed = [
        o for o in orders
        if o.status in (
            PurchaseOrderStatus.DELIVERED, PurchaseOrderStatus.COMPLETED
        )
        and o.expected_delivery and o.actual_delivery
    ]

    on_time = sum(1 for o in closed if o.actual_delivery <= o.expected_delivery)

    return PurchaseOrderStats(
        total=len(orders),
        pending=counts.get(PurchaseOrderStatus.PENDING, 0),
        approved=counts.get(PurchaseOrderStatus.APPROVED, 0),
        ordered=counts.get(PurchaseOrderStatus.ORDERED, 0),
        delivered=counts.get(PurchaseOrderStatus.DELIVERED, 0),
        completed=counts.get(PurchaseOrderStatus.COMPLETED, 0),
        cancelled=counts.get(PurchaseOrderStatus.CANCELLED, 0),
        total_value=total_value,
        open_value=open_value,
        delayed=delayed,
        on_time_rate=round(on_time / len(closed) * 100, 2) if closed else 0.0
    )


# =========================================================
# LIST
# =========================================================

@router.get("", response_model=list[PurchaseOrderResponse])
@router.get(
    "/",
    response_model=list[PurchaseOrderResponse],
    include_in_schema=False
)
def list_purchase_orders(
    search: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    vendor_id: Optional[int] = Query(default=None),
    delayed_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(PurchaseOrder)

    scope = vendor_scope(current_user)
    if scope is not None:
        query = query.filter(PurchaseOrder.vendor_id == scope)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                PurchaseOrder.po_number.ilike(pattern),
                PurchaseOrder.title.ilike(pattern),
                PurchaseOrder.description.ilike(pattern)
            )
        )

    if status_filter:
        query = query.filter(PurchaseOrder.status == status_filter)

    if vendor_id:
        query = query.filter(PurchaseOrder.vendor_id == vendor_id)

    orders = query.order_by(PurchaseOrder.id.desc()).all()

    responses = [_to_response(po) for po in orders]

    if delayed_only:
        responses = [r for r in responses if r.is_delayed]

    return responses


# =========================================================
# DETAIL
# =========================================================

@router.get("/{po_id}", response_model=PurchaseOrderDetail)
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    po = _get_po(db, po_id)
    _assert_po_access(current_user, po)

    payload = PurchaseOrderDetail.model_validate(po)
    payload.vendor_name = po.vendor.vendor_name if po.vendor else None
    payload.request_number = po.request.request_number if po.request else None
    payload.created_by_name = po.creator.name if po.creator else None
    payload.is_delayed, payload.days_late = _delay_info(po)
    payload.items = [
        PurchaseOrderItemResponse.model_validate(i) for i in po.items
    ]
    payload.invoices = [_to_invoice_response(i) for i in po.invoices]

    return payload


# =========================================================
# CREATE
# =========================================================

@router.post(
    "",
    response_model=PurchaseOrderDetail,
    status_code=status.HTTP_201_CREATED
)
@router.post(
    "/",
    response_model=PurchaseOrderDetail,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False
)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    vendor = db.query(Vendor).filter(Vendor.id == payload.vendor_id).first()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )

    if vendor.status != VendorStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Purchase orders can only be raised against approved vendors. "
                f"'{vendor.vendor_name}' is currently {vendor.status}."
            )
        )

    request: Optional[ProcurementRequest] = None

    if payload.procurement_request_id:
        request = (
            db.query(ProcurementRequest)
            .filter(ProcurementRequest.id == payload.procurement_request_id)
            .first()
        )

        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Procurement request not found"
            )

        if request.status not in (
            ProcurementStatus.APPROVED, ProcurementStatus.ORDERED
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Request {request.request_number} is '{request.status}'. "
                    f"Only approved requests can be converted into a purchase "
                    f"order."
                )
            )

    po_number = payload.po_number or next_po_number(db)

    if db.query(PurchaseOrder).filter(PurchaseOrder.po_number == po_number).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"PO number '{po_number}' is already in use"
        )

    po = PurchaseOrder(
        po_number=po_number,
        vendor_id=vendor.id,
        procurement_request_id=payload.procurement_request_id,
        created_by=current_user.id,
        title=payload.title or (request.item if request else None),
        description=payload.description,
        order_date=payload.order_date or date.today(),
        expected_delivery=payload.expected_delivery,
        currency=payload.currency,
        tax_amount=payload.tax_amount,
        shipping_amount=payload.shipping_amount,
        payment_terms=payload.payment_terms,
        shipping_address=payload.shipping_address,
        notes=payload.notes,
        status=PurchaseOrderStatus.PENDING
    )

    db.add(po)
    db.flush()

    _replace_items(db, po, payload.items)
    _recalculate_totals(po)

    if request:
        request.status = ProcurementStatus.ORDERED
        if not request.assigned_vendor_id:
            request.assigned_vendor_id = vendor.id

    log_activity(
        db, current_user.id, "PurchaseOrder", po.id, "Created",
        f"Purchase order {po.po_number} raised for {vendor.vendor_name} "
        f"({po.currency} {po.total_amount})"
    )

    notify_roles(
        db,
        [UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER,
         UserRole.FINANCE_OFFICER],
        NotificationType.PROCUREMENT,
        "New purchase order raised",
        f"{po.po_number} for {vendor.vendor_name} "
        f"({po.currency} {po.total_amount}) is awaiting approval.",
        link=f"/purchase-orders/{po.id}",
        exclude_user_id=current_user.id
    )

    db.commit()
    db.refresh(po)

    return get_purchase_order(po.id, db, current_user)


# =========================================================
# UPDATE
# =========================================================

@router.put("/{po_id}", response_model=PurchaseOrderDetail)
def update_purchase_order(
    po_id: int,
    payload: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    po = _get_po(db, po_id)

    if po.status in (PurchaseOrderStatus.COMPLETED, PurchaseOrderStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A {po.status} purchase order can no longer be edited"
        )

    data = payload.model_dump(exclude_unset=True, exclude={"items"})

    for field, value in data.items():
        setattr(po, field, value)

    if payload.items is not None:
        if not payload.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A purchase order must have at least one line item"
            )
        _replace_items(db, po, payload.items)

    _recalculate_totals(po)

    log_activity(
        db, current_user.id, "PurchaseOrder", po.id, "Updated",
        f"Purchase order {po.po_number} updated"
    )

    db.commit()
    db.refresh(po)

    return get_purchase_order(po.id, db, current_user)


# =========================================================
# STATUS TRANSITIONS / ORDER TRACKING
# =========================================================

@router.post("/{po_id}/status", response_model=PurchaseOrderResponse)
def change_status(
    po_id: int,
    payload: PurchaseOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement_or_supply_chain)
):
    po = _get_po(db, po_id)

    if payload.status not in PurchaseOrderStatus.ALL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown status '{payload.status}'"
        )

    allowed = _TRANSITIONS.get(po.status, [])

    if payload.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot move a purchase order from '{po.status}' to "
                f"'{payload.status}'. Allowed next: "
                f"{', '.join(allowed) if allowed else 'none'}."
            )
        )

    previous = po.status
    po.status = payload.status

    if payload.status == PurchaseOrderStatus.APPROVED:
        po.approved_by = current_user.id
        po.approved_at = datetime.now(timezone.utc)

    if payload.status == PurchaseOrderStatus.DELIVERED:
        po.actual_delivery = payload.actual_delivery or date.today()

        if po.request:
            po.request.status = ProcurementStatus.DELIVERED

        is_delayed, days_late = _delay_info(po)

        if is_delayed:
            notify_roles(
                db,
                [UserRole.ADMINISTRATOR, UserRole.PROCUREMENT_MANAGER,
                 UserRole.SUPPLY_CHAIN_MANAGER],
                NotificationType.DELIVERY,
                "Delivery delay recorded",
                f"{po.po_number} from "
                f"{po.vendor.vendor_name if po.vendor else 'vendor'} arrived "
                f"{days_late} day(s) after the expected date.",
                link=f"/purchase-orders/{po.id}",
                priority="High"
            )

    if payload.status == PurchaseOrderStatus.COMPLETED and po.request:
        po.request.status = ProcurementStatus.COMPLETED

    log_activity(
        db, current_user.id, "PurchaseOrder", po.id, f"Status: {payload.status}",
        f"{po.po_number} moved from {previous} to {payload.status}"
        + (f" - {payload.comments}" if payload.comments else "")
    )

    notify_vendor_users(
        db, po.vendor_id, NotificationType.PROCUREMENT,
        f"Purchase order {payload.status.lower()}",
        f"{po.po_number} is now {payload.status}.",
        link=f"/purchase-orders/{po.id}"
    )

    if po.created_by and po.created_by != current_user.id:
        notify_user(
            db, po.created_by, NotificationType.PROCUREMENT,
            f"Purchase order {payload.status.lower()}",
            f"{po.po_number} moved from {previous} to {payload.status}.",
            link=f"/purchase-orders/{po.id}"
        )

    db.commit()
    db.refresh(po)

    return _to_response(po)


# =========================================================
# INVOICES
# =========================================================

@router.get("/{po_id}/invoices", response_model=list[InvoiceResponse])
def list_po_invoices(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    po = _get_po(db, po_id)
    _assert_po_access(current_user, po)

    return [_to_invoice_response(i) for i in po.invoices]


@router.post(
    "/{po_id}/invoices",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED
)
def create_po_invoice(
    po_id: int,
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance)
):
    po = _get_po(db, po_id)

    invoice_number = payload.invoice_number or next_invoice_number(db)

    if db.query(Invoice).filter(Invoice.invoice_number == invoice_number).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice number '{invoice_number}' is already in use"
        )

    invoice = Invoice(
        invoice_number=invoice_number,
        purchase_order_id=po.id,
        vendor_id=po.vendor_id,
        invoice_date=payload.invoice_date or date.today(),
        due_date=payload.due_date,
        amount=payload.amount,
        tax_amount=payload.tax_amount,
        total_amount=Decimal(payload.amount) + Decimal(payload.tax_amount),
        currency=payload.currency or po.currency,
        status=InvoiceStatus.PENDING,
        document_path=payload.document_path,
        notes=payload.notes
    )

    db.add(invoice)

    log_activity(
        db, current_user.id, "Invoice", None, "Created",
        f"Invoice {invoice_number} recorded against {po.po_number}"
    )

    db.commit()
    db.refresh(invoice)

    return _to_invoice_response(invoice)


# =========================================================
# DELETE / CANCEL
# =========================================================

@router.delete("/{po_id}", response_model=Message)
def delete_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_procurement)
):
    """Only a Pending order can be deleted outright; anything further along
    is cancelled so the audit trail is preserved."""

    po = _get_po(db, po_id)
    number = po.po_number

    if po.status != PurchaseOrderStatus.PENDING:
        if po.status == PurchaseOrderStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This purchase order is already cancelled"
            )

        previous = po.status
        po.status = PurchaseOrderStatus.CANCELLED

        log_activity(
            db, current_user.id, "PurchaseOrder", po.id, "Cancelled",
            f"{number} cancelled from status {previous}"
        )

        db.commit()

        return Message(
            message=(
                f"Purchase order {number} was already in progress and has been "
                f"cancelled instead of deleted"
            )
        )

    log_activity(
        db, current_user.id, "PurchaseOrder", po_id, "Deleted",
        f"Purchase order {number} deleted"
    )

    db.delete(po)
    db.commit()

    return Message(message=f"Purchase order {number} deleted successfully")
