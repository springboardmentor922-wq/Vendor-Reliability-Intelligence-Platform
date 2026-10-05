
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.invoice import Invoice
from app.models.purchase_order import (
    PurchaseOrder,
    PurchaseOrderItem,
)
from app.models.procurement import ProcurementRequest
from app.models.vendor import Vendor
from app.schemas.purchase_order import (
    PURCHASE_ORDER_STATUSES,
    DeliveryUpdate,
    InvoiceCreate,
    InvoiceResponse,
    InvoiceStatusUpdate,
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    PurchaseOrderStatusUpdate,
)


router = APIRouter(
    prefix="/api/purchase-orders",
    tags=["Purchase Orders"],
)


MANAGEMENT_ROLES = (
    "Administrator",
    "Procurement Manager",
    "Supply Chain Manager",
)


@router.get(
    "/statuses",
    response_model=list[str]
)
def get_purchase_order_statuses(
    current_user=Depends(get_current_user),
):
    return PURCHASE_ORDER_STATUSES


@router.post(
    "",
    response_model=PurchaseOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_purchase_order(
    order: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    if order.order_date > order.expected_delivery_date:
        raise HTTPException(
            status_code=400,
            detail="Expected delivery date cannot be before order date",
        )

    existing_order = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.po_number == order.po_number
        )
        .first()
    )

    if existing_order:
        raise HTTPException(
            status_code=400,
            detail="Purchase order number already exists",
        )

    vendor = (
        db.query(Vendor)
        .filter(Vendor.id == order.vendor_id)
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found",
        )

    if vendor.status != "Approved":
        raise HTTPException(
            status_code=400,
            detail="Only approved vendors can be assigned to a purchase order",
        )

    if order.procurement_request_id is not None:
        procurement_request = (
            db.query(ProcurementRequest)
            .filter(
                ProcurementRequest.id
                == order.procurement_request_id
            )
            .first()
        )

        if not procurement_request:
            raise HTTPException(
                status_code=404,
                detail="Procurement request not found",
            )

    subtotal = 0
    tax_amount = 0
    calculated_items = []

    for item in order.items:
        item_subtotal = (
            float(item.quantity)
            * float(item.unit_price)
        )

        item_tax = (
            item_subtotal
            * float(item.tax_percent)
            / 100
        )

        item_total = item_subtotal + item_tax

        subtotal += item_subtotal
        tax_amount += item_tax

        calculated_items.append(
            (
                item,
                item_total,
            )
        )

    total_amount = subtotal + tax_amount

    new_order = PurchaseOrder(
        po_number=order.po_number,
        order_date=order.order_date,
        expected_delivery_date=order.expected_delivery_date,
        procurement_request_id=order.procurement_request_id,
        department=order.department,
        vendor_id=order.vendor_id,
        payment_terms=order.payment_terms,
        shipping_address=order.shipping_address,
        billing_address=order.billing_address,
        remarks=order.remarks,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        status="Pending",
        created_by=current_user.id,
    )

    db.add(new_order)
    db.flush()

    for item, item_total in calculated_items:
        db.add(
            PurchaseOrderItem(
                purchase_order_id=new_order.id,
                item_description=item.item_description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                tax_percent=item.tax_percent,
                total=item_total,
            )
        )

    db.commit()
    db.refresh(new_order)

    return _get_order_response(
        db,
        new_order.id,
    )


@router.get(
    "",
    response_model=list[PurchaseOrderResponse]
)
def get_purchase_orders(
    order_status: str | None = None,
    vendor_id: int | None = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(PurchaseOrder)

    if order_status:
        if order_status not in PURCHASE_ORDER_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid purchase order status",
            )

        query = query.filter(
            PurchaseOrder.status == order_status
        )

    if vendor_id is not None:
        query = query.filter(
            PurchaseOrder.vendor_id == vendor_id
        )

    orders = (
        query
        .order_by(PurchaseOrder.id.desc())
        .all()
    )

    return [
        _get_order_response(db, order.id)
        for order in orders
    ]


@router.get(
    "/{order_id}",
    response_model=PurchaseOrderResponse
)
def get_purchase_order(
    order_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_order_response(
        db,
        order_id,
    )


@router.patch(
    "/{order_id}/status",
    response_model=PurchaseOrderResponse
)
def update_purchase_order_status(
    order_id: int,
    status_data: PurchaseOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    if status_data.status not in PURCHASE_ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid purchase order status",
        )

    order = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == order_id)
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    if status_data.status == "Approved":
        order.approved_by = current_user.id
        order.approved_at = datetime.utcnow()

    order.status = status_data.status

    db.commit()
    db.refresh(order)

    return _get_order_response(
        db,
        order.id,
    )


@router.patch(
    "/{order_id}/delivery",
    response_model=PurchaseOrderResponse
)
def update_purchase_order_delivery(
    order_id: int,
    delivery_data: DeliveryUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(*MANAGEMENT_ROLES)
    ),
):
    order = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == order_id)
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    if order.status not in ("Ordered", "Delivered"):
        raise HTTPException(
            status_code=400,
            detail="Delivery can only be recorded for an Ordered purchase order",
        )

    if delivery_data.actual_delivery_date < order.order_date:
        raise HTTPException(
            status_code=400,
            detail="Actual delivery date cannot be before the order date",
        )

    order.actual_delivery_date = delivery_data.actual_delivery_date
    order.delivery_notes = delivery_data.delivery_notes
    order.status = "Delivered"

    db.commit()
    db.refresh(order)

    return _get_order_response(
        db,
        order.id,
    )


@router.delete(
    "/{order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_purchase_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles("Administrator")
    ),
):
    order = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == order_id)
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    db.delete(order)
    db.commit()

    return None


@router.post(
    "/invoices",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice(
    invoice_data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "Administrator",
            "Procurement Manager",
            "Finance Officer",
        )
    ),
):
    order = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.id
            == invoice_data.purchase_order_id
        )
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    existing_invoice = (
        db.query(Invoice)
        .filter(
            Invoice.invoice_number
            == invoice_data.invoice_number
        )
        .first()
    )

    if existing_invoice:
        raise HTTPException(
            status_code=400,
            detail="Invoice number already exists",
        )

    invoice = Invoice(
        purchase_order_id=invoice_data.purchase_order_id,
        invoice_number=invoice_data.invoice_number,
        invoice_date=invoice_data.invoice_date,
        amount=invoice_data.amount,
        status="Pending",
    )

    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    return invoice


@router.get(
    "/invoices/list",
    response_model=list[InvoiceResponse]
)
def get_invoices(
    purchase_order_id: int | None = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Invoice)

    if purchase_order_id is not None:
        query = query.filter(
            Invoice.purchase_order_id
            == purchase_order_id
        )

    return (
        query
        .order_by(Invoice.id.desc())
        .all()
    )


@router.patch(
    "/invoices/{invoice_id}/status",
    response_model=InvoiceResponse
)
def update_invoice_status(
    invoice_id: int,
    status_data: InvoiceStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "Administrator",
            "Finance Officer",
        )
    ),
):
    allowed_statuses = [
        "Pending",
        "Paid",
        "Rejected",
    ]

    if status_data.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Invalid invoice status",
        )

    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    invoice.status = status_data.status

    db.commit()
    db.refresh(invoice)

    return invoice


def _get_order_response(
    db: Session,
    order_id: int,
):
    order = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == order_id)
        .first()
    )

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found",
        )

    items = (
        db.query(PurchaseOrderItem)
        .filter(
            PurchaseOrderItem.purchase_order_id
            == order.id
        )
        .order_by(PurchaseOrderItem.id.asc())
        .all()
    )

    return {
        "id": order.id,
        "po_number": order.po_number,
        "order_date": order.order_date,
        "expected_delivery_date": order.expected_delivery_date,
        "actual_delivery_date": order.actual_delivery_date,
        "delivery_notes": order.delivery_notes,
        "procurement_request_id": order.procurement_request_id,
        "department": order.department,
        "vendor_id": order.vendor_id,
        "payment_terms": order.payment_terms,
        "shipping_address": order.shipping_address,
        "billing_address": order.billing_address,
        "remarks": order.remarks,
        "subtotal": order.subtotal,
        "tax_amount": order.tax_amount,
        "total_amount": order.total_amount,
        "status": order.status,
        "approved_by": order.approved_by,
        "approved_at": order.approved_at,
        "created_by": order.created_by,
        "created_at": order.created_at,
        "items": items,
    }