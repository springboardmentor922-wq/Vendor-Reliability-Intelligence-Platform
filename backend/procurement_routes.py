from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import (
    ProcurementRequest,
    Vendor,
    PurchaseOrder,
    User
)
from schemas import (
    ProcurementRequestCreate,
    ProcurementRequestUpdate,
    ProcurementRequestResponse,
    ProcurementRequestConvert,
)
from auth import get_current_user, require_role

from notification_service import (
    notify_user,
    notify_role,
    notify_roles
)


router = APIRouter(
    prefix="/procurement-requests",
    tags=["Procurement Management"],
)


# ============================================================
# GENERATE PROCUREMENT REQUEST NUMBER
# ============================================================

def generate_request_number(db: Session):

    year = date.today().year
    prefix = f"PR-{year}-"

    last_request = (
        db.query(ProcurementRequest)
        .filter(
            ProcurementRequest.request_number.like(
                f"{prefix}%"
            )
        )
        .order_by(
            ProcurementRequest.id.desc()
        )
        .first()
    )

    if (
        last_request
        and last_request.request_number.startswith(prefix)
    ):
        try:
            next_number = (
                int(
                    last_request.request_number[
                        len(prefix):
                    ]
                )
                + 1
            )
        except ValueError:
            next_number = (
                db.query(ProcurementRequest).count() + 1
            )
    else:
        next_number = 1

    return f"{prefix}{next_number:04d}"


# ============================================================
# GENERATE PURCHASE ORDER NUMBER
# ============================================================

def generate_po_number(db: Session):

    year = date.today().year
    prefix = f"PO-{year}-"

    last_po = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.order_number.like(
                f"{prefix}%"
            )
        )
        .order_by(
            PurchaseOrder.id.desc()
        )
        .first()
    )

    if (
        last_po
        and last_po.order_number.startswith(prefix)
    ):
        try:
            next_number = (
                int(
                    last_po.order_number[
                        len(prefix):
                    ]
                )
                + 1
            )
        except ValueError:
            next_number = (
                db.query(PurchaseOrder).count() + 1
            )
    else:
        next_number = 1

    return f"{prefix}{next_number:03d}"


# ============================================================
# GET ALL PROCUREMENT REQUESTS
# ============================================================

@router.get(
    "",
    response_model=list[ProcurementRequestResponse],
)
def get_procurement_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    return (
        db.query(ProcurementRequest)
        .order_by(
            ProcurementRequest.id.desc()
        )
        .all()
    )


# ============================================================
# GET SINGLE PROCUREMENT REQUEST
# ============================================================

@router.get(
    "/{request_id}",
    response_model=ProcurementRequestResponse,
)
def get_procurement_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    request = (
        db.query(ProcurementRequest)
        .filter(
            ProcurementRequest.id == request_id
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found.",
        )

    return request


# ============================================================
# CREATE PROCUREMENT REQUEST
# ONLY PROCUREMENT MANAGER
# ============================================================

@router.post(
    "",
    response_model=ProcurementRequestResponse,
)
def create_procurement_request(
    data: ProcurementRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("procurement_manager")
    ),
):

    # --------------------------------------------------------
    # Validate quantity
    # --------------------------------------------------------

    if data.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than zero.",
        )

    # --------------------------------------------------------
    # Validate amount
    # --------------------------------------------------------

    if data.estimated_amount < 0:
        raise HTTPException(
            status_code=400,
            detail="Estimated amount cannot be negative.",
        )

    # --------------------------------------------------------
    # Validate expected delivery date
    # --------------------------------------------------------

    if data.expected_delivery_date is not None:

        if data.expected_delivery_date < date.today():
            raise HTTPException(
                status_code=400,
                detail=(
                    "Expected delivery date cannot "
                    "be in the past."
                ),
            )

    # --------------------------------------------------------
    # Validate vendor
    # --------------------------------------------------------

    if data.vendor_id is not None:

        vendor = (
            db.query(Vendor)
            .filter(
                Vendor.id == data.vendor_id
            )
            .first()
        )

        if not vendor:
            raise HTTPException(
                status_code=404,
                detail="Selected vendor not found.",
            )

    # --------------------------------------------------------
    # Create request
    # --------------------------------------------------------

    request = ProcurementRequest(
        request_number=generate_request_number(db),
        requested_by=current_user.id,
        vendor_id=data.vendor_id,
        description=data.description,
        quantity=data.quantity,
        estimated_amount=data.estimated_amount,
        expected_delivery_date=data.expected_delivery_date,
        status="pending",
    )

    db.add(request)

    # Flush so request.id/request_number are available
    db.flush()

    # --------------------------------------------------------
    # NOTIFICATION
    # New procurement request → Administrator
    # --------------------------------------------------------

    notify_role(
        db=db,
        role="administrator",
        title="New Procurement Request",
        message=(
            f"New procurement request "
            f"{request.request_number} has been created "
            f"and is waiting for approval."
        ),
        notification_type="procurement"
    )

    db.commit()
    db.refresh(request)

    return request


# ============================================================
# UPDATE PROCUREMENT REQUEST
# ONLY PROCUREMENT MANAGER
# ============================================================

@router.put(
    "/{request_id}",
    response_model=ProcurementRequestResponse,
)
def update_procurement_request(
    request_id: int,
    data: ProcurementRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("procurement_manager")
    ),
):

    request = (
        db.query(ProcurementRequest)
        .filter(
            ProcurementRequest.id == request_id
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found.",
        )

    # --------------------------------------------------------
    # Only pending requests can be edited
    # --------------------------------------------------------

    if request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Only pending requests can be edited.",
        )

    # --------------------------------------------------------
    # User can edit only their own request
    # --------------------------------------------------------

    if request.requested_by is not None:

        if request.requested_by != current_user.id:
            raise HTTPException(
                status_code=403,
                detail=(
                    "You can only edit your own "
                    "procurement requests."
                ),
            )

    # --------------------------------------------------------
    # Update vendor
    # --------------------------------------------------------

    if data.vendor_id is not None:

        vendor = (
            db.query(Vendor)
            .filter(
                Vendor.id == data.vendor_id
            )
            .first()
        )

        if not vendor:
            raise HTTPException(
                status_code=404,
                detail="Selected vendor not found.",
            )

        request.vendor_id = data.vendor_id

    # --------------------------------------------------------
    # Update description
    # --------------------------------------------------------

    if data.description is not None:

        if not data.description.strip():
            raise HTTPException(
                status_code=400,
                detail="Description cannot be empty.",
            )

        request.description = data.description

    # --------------------------------------------------------
    # Update quantity
    # --------------------------------------------------------

    if data.quantity is not None:

        if data.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="Quantity must be greater than zero.",
            )

        request.quantity = data.quantity

    # --------------------------------------------------------
    # Update estimated amount
    # --------------------------------------------------------

    if data.estimated_amount is not None:

        if data.estimated_amount < 0:
            raise HTTPException(
                status_code=400,
                detail="Estimated amount cannot be negative.",
            )

        request.estimated_amount = data.estimated_amount

    # --------------------------------------------------------
    # Update expected delivery date
    # --------------------------------------------------------

    if data.expected_delivery_date is not None:

        if data.expected_delivery_date < date.today():
            raise HTTPException(
                status_code=400,
                detail=(
                    "Expected delivery date cannot "
                    "be in the past."
                ),
            )

        request.expected_delivery_date = (
            data.expected_delivery_date
        )

    db.commit()
    db.refresh(request)

    return request


# ============================================================
# APPROVE PROCUREMENT REQUEST
# ONLY ADMINISTRATOR
# ============================================================

@router.put(
    "/{request_id}/approve",
    response_model=ProcurementRequestResponse,
)
def approve_procurement_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("administrator")
    ),
):

    request = (
        db.query(ProcurementRequest)
        .filter(
            ProcurementRequest.id == request_id
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found.",
        )

    if request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only pending requests can be approved."
            ),
        )

    request.status = "approved"

    # --------------------------------------------------------
    # NOTIFY REQUEST CREATOR
    # --------------------------------------------------------

    if request.requested_by is not None:

        notify_user(
            db=db,
            user_id=request.requested_by,
            title="Procurement Request Approved",
            message=(
                f"Your procurement request "
                f"{request.request_number} "
                f"has been approved by the administrator."
            ),
            notification_type="procurement"
        )

    # --------------------------------------------------------
    # NOTIFY PROCUREMENT MANAGERS
    # --------------------------------------------------------

    notify_role(
        db=db,
        role="procurement_manager",
        title="Procurement Request Approved",
        message=(
            f"Procurement request "
            f"{request.request_number} "
            f"has been approved and can now be "
            f"converted into a Purchase Order."
        ),
        notification_type="procurement"
    )

    db.commit()
    db.refresh(request)

    return request


# ============================================================
# REJECT PROCUREMENT REQUEST
# ONLY ADMINISTRATOR
# ============================================================

@router.put(
    "/{request_id}/reject",
    response_model=ProcurementRequestResponse,
)
def reject_procurement_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("administrator")
    ),
):

    request = (
        db.query(ProcurementRequest)
        .filter(
            ProcurementRequest.id == request_id
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found.",
        )

    if request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only pending requests can be rejected."
            ),
        )

    request.status = "rejected"

    # --------------------------------------------------------
    # NOTIFY REQUEST CREATOR
    # --------------------------------------------------------

    if request.requested_by is not None:

        notify_user(
            db=db,
            user_id=request.requested_by,
            title="Procurement Request Rejected",
            message=(
                f"Your procurement request "
                f"{request.request_number} "
                f"has been rejected by the administrator."
            ),
            notification_type="procurement"
        )

    db.commit()
    db.refresh(request)

    return request


# ============================================================
# CONVERT PROCUREMENT REQUEST → PURCHASE ORDER
# ONLY PROCUREMENT MANAGER
# ============================================================

@router.put(
    "/{request_id}/converted"
)
def convert_procurement_request(
    request_id: int,
    data: ProcurementRequestConvert,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("procurement_manager")
    ),
):

    # --------------------------------------------------------
    # Find procurement request
    # --------------------------------------------------------

    request = (
        db.query(ProcurementRequest)
        .filter(
            ProcurementRequest.id == request_id
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found.",
        )

    # --------------------------------------------------------
    # Only approved requests can become POs
    # --------------------------------------------------------

    if request.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only approved requests can be converted "
                "into a Purchase Order."
            ),
        )

    # --------------------------------------------------------
    # Vendor must be assigned
    # --------------------------------------------------------

    if request.vendor_id is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "A vendor must be assigned before "
                "converting the request into a Purchase Order."
            ),
        )

    # --------------------------------------------------------
    # Find vendor
    # --------------------------------------------------------

    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == request.vendor_id
        )
        .first()
    )

    if not vendor:
        raise HTTPException(
            status_code=404,
            detail="Selected vendor not found.",
        )

    # --------------------------------------------------------
    # Vendor must be approved
    # --------------------------------------------------------

    if vendor.approval_status != "approved":
        raise HTTPException(
            status_code=400,
            detail=(
                "The selected vendor is not approved. "
                "Approve the vendor before creating "
                "a Purchase Order."
            ),
        )

    # --------------------------------------------------------
    # Vendor must be active
    # --------------------------------------------------------

    if vendor.vendor_status != "active":
        raise HTTPException(
            status_code=400,
            detail="The selected vendor is not active.",
        )

    # --------------------------------------------------------
    # Validate expected delivery date
    # --------------------------------------------------------

    if data.expected_delivery_date < date.today():
        raise HTTPException(
            status_code=400,
            detail=(
                "Expected delivery date cannot "
                "be in the past."
            ),
        )

    # --------------------------------------------------------
    # Validate total amount
    # --------------------------------------------------------

    if data.total_amount < 0:
        raise HTTPException(
            status_code=400,
            detail="Total amount cannot be negative.",
        )

    # --------------------------------------------------------
    # Create Purchase Order
    # --------------------------------------------------------

    purchase_order = PurchaseOrder(
        vendor_id=request.vendor_id,
        supplier_id=None,
        order_number=generate_po_number(db),
        order_date=date.today(),
        expected_delivery_date=data.expected_delivery_date,
        actual_delivery_date=None,
        total_amount=data.total_amount,
        status="pending",
    )

    db.add(purchase_order)

    # Flush so PO ID/number is available
    db.flush()

    # --------------------------------------------------------
    # Mark PR as converted
    # --------------------------------------------------------

    request.status = "converted"

    # --------------------------------------------------------
    # NOTIFY VENDOR
    # --------------------------------------------------------

    if vendor.user_id is not None:

        notify_user(
            db=db,
            user_id=vendor.user_id,
            title="New Purchase Order",
            message=(
                f"Purchase Order "
                f"{purchase_order.order_number} "
                f"has been created for your company."
            ),
            notification_type="purchase_order"
        )

    # --------------------------------------------------------
    # NOTIFY SUPPLY CHAIN MANAGER
    # --------------------------------------------------------

    notify_role(
        db=db,
        role="supply_chain_manager",
        title="New Purchase Order",
        message=(
            f"Purchase Order "
            f"{purchase_order.order_number} "
            f"has been created and is pending approval."
        ),
        notification_type="purchase_order"
    )

    db.commit()

    db.refresh(request)
    db.refresh(purchase_order)

    # --------------------------------------------------------
    # Return created PO details
    # --------------------------------------------------------

    return {
        "message": (
            "Procurement request converted into "
            "a Purchase Order successfully."
        ),
        "request_id": request.id,
        "request_number": request.request_number,
        "purchase_order_id": purchase_order.id,
        "purchase_order_number": purchase_order.order_number,
        "purchase_order_status": purchase_order.status,
        "order_date": (
            purchase_order.order_date.isoformat()
            if purchase_order.order_date
            else None
        ),
        "expected_delivery_date": (
            purchase_order.expected_delivery_date.isoformat()
            if purchase_order.expected_delivery_date
            else None
        ),
        "total_amount": float(
            purchase_order.total_amount or 0
        ),
    }


# ============================================================
# DELETE PROCUREMENT REQUEST
# ONLY PROCUREMENT MANAGER
# ============================================================

@router.delete(
    "/{request_id}"
)
def delete_procurement_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("procurement_manager")
    ),
):

    request = (
        db.query(ProcurementRequest)
        .filter(
            ProcurementRequest.id == request_id
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Procurement request not found.",
        )

    if request.status not in [
        "pending",
        "rejected",
    ]:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only pending or rejected requests "
                "can be deleted."
            ),
        )

    db.delete(request)
    db.commit()

    return {
        "message": (
            "Procurement request deleted successfully."
        )
    }


# ============================================================
# PURCHASE ORDERS
# ============================================================


# ============================================================
# GET ALL PURCHASE ORDERS
# ============================================================

@router.get(
    "/purchase-orders/list"
)
def get_purchase_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    purchase_orders = (
        db.query(PurchaseOrder)
        .order_by(
            PurchaseOrder.id.desc()
        )
        .all()
    )

    result = []

    for po in purchase_orders:

        vendor = (
            db.query(Vendor)
            .filter(
                Vendor.id == po.vendor_id
            )
            .first()
        )

        result.append({
            "id": po.id,
            "vendor_id": po.vendor_id,
            "vendor_name": (
                vendor.company_name
                if vendor
                else "Unknown Vendor"
            ),
            "supplier_id": po.supplier_id,
            "order_number": po.order_number,
            "order_date": (
                po.order_date.isoformat()
                if po.order_date
                else None
            ),
            "expected_delivery_date": (
                po.expected_delivery_date.isoformat()
                if po.expected_delivery_date
                else None
            ),
            "actual_delivery_date": (
                po.actual_delivery_date.isoformat()
                if po.actual_delivery_date
                else None
            ),
            "total_amount": float(
                po.total_amount or 0
            ),
            "status": po.status,
            "created_at": (
                po.created_at.isoformat()
                if po.created_at
                else None
            ),
        })

    return result


# ============================================================
# GET SINGLE PURCHASE ORDER
# ============================================================

@router.get(
    "/purchase-orders/{po_id}"
)
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    po = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.id == po_id
        )
        .first()
    )

    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase Order not found.",
        )

    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == po.vendor_id
        )
        .first()
    )

    return {
        "id": po.id,
        "vendor_id": po.vendor_id,
        "vendor_name": (
            vendor.company_name
            if vendor
            else "Unknown Vendor"
        ),
        "supplier_id": po.supplier_id,
        "order_number": po.order_number,
        "order_date": (
            po.order_date.isoformat()
            if po.order_date
            else None
        ),
        "expected_delivery_date": (
            po.expected_delivery_date.isoformat()
            if po.expected_delivery_date
            else None
        ),
        "actual_delivery_date": (
            po.actual_delivery_date.isoformat()
            if po.actual_delivery_date
            else None
        ),
        "total_amount": float(
            po.total_amount or 0
        ),
        "status": po.status,
    }


# ============================================================
# APPROVE PURCHASE ORDER
# ONLY ADMINISTRATOR
# ============================================================

@router.put(
    "/purchase-orders/{po_id}/approve"
)
def approve_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("administrator")
    ),
):

    po = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.id == po_id
        )
        .first()
    )

    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase Order not found.",
        )

    if po.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only pending Purchase Orders "
                "can be approved."
            ),
        )

    po.status = "approved"

    # --------------------------------------------------------
    # NOTIFY VENDOR
    # --------------------------------------------------------

    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == po.vendor_id
        )
        .first()
    )

    if vendor and vendor.user_id is not None:

        notify_user(
            db=db,
            user_id=vendor.user_id,
            title="Purchase Order Approved",
            message=(
                f"Purchase Order "
                f"{po.order_number} "
                f"has been approved and is ready for "
                f"your acceptance."
            ),
            notification_type="purchase_order"
        )

    # --------------------------------------------------------
    # NOTIFY SUPPLY CHAIN
    # --------------------------------------------------------

    notify_role(
        db=db,
        role="supply_chain_manager",
        title="Purchase Order Approved",
        message=(
            f"Purchase Order "
            f"{po.order_number} "
            f"has been approved."
        ),
        notification_type="purchase_order"
    )

    db.commit()
    db.refresh(po)

    return {
        "message": (
            "Purchase Order approved successfully."
        ),
        "purchase_order_id": po.id,
        "purchase_order_number": po.order_number,
        "status": po.status,
    }


# ============================================================
# REJECT PURCHASE ORDER
# ONLY ADMINISTRATOR
# ============================================================

@router.put(
    "/purchase-orders/{po_id}/reject"
)
def reject_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("administrator")
    ),
):

    po = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.id == po_id
        )
        .first()
    )

    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase Order not found.",
        )

    if po.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only pending Purchase Orders "
                "can be rejected."
            ),
        )

    po.status = "cancelled"

    # --------------------------------------------------------
    # NOTIFY VENDOR
    # --------------------------------------------------------

    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == po.vendor_id
        )
        .first()
    )

    if vendor and vendor.user_id is not None:

        notify_user(
            db=db,
            user_id=vendor.user_id,
            title="Purchase Order Rejected",
            message=(
                f"Purchase Order "
                f"{po.order_number} "
                f"has been rejected."
            ),
            notification_type="purchase_order"
        )

    db.commit()
    db.refresh(po)

    return {
        "message": (
            "Purchase Order rejected successfully."
        ),
        "purchase_order_id": po.id,
        "purchase_order_number": po.order_number,
        "status": po.status,
    }


# ============================================================
# UPDATE PURCHASE ORDER STATUS
# ONLY SUPPLY CHAIN MANAGER
#
# APPROVED → SHIPPED → DELIVERED
# ============================================================

@router.put(
    "/purchase-orders/{po_id}/status/{new_status}"
)
def update_purchase_order_status(
    po_id: int,
    new_status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("supply_chain_manager")
    ),
):

    allowed_statuses = [
        "shipped",
        "delivered",
        "cancelled",
    ]

    # --------------------------------------------------------
    # Validate status
    # --------------------------------------------------------

    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid status. Allowed values: "
                "shipped, delivered, cancelled."
            ),
        )

    # --------------------------------------------------------
    # Find PO
    # --------------------------------------------------------

    po = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.id == po_id
        )
        .first()
    )

    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase Order not found.",
        )

    # --------------------------------------------------------
    # APPROVED → SHIPPED
    # --------------------------------------------------------

    if new_status == "shipped":

        if po.status != "approved":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only approved Purchase Orders "
                    "can be marked as shipped."
                ),
            )

    # --------------------------------------------------------
    # SHIPPED → DELIVERED
    # --------------------------------------------------------

    if new_status == "delivered":

        if po.status != "shipped":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only shipped Purchase Orders "
                    "can be marked as delivered."
                ),
            )

        # Automatically record today's delivery date
        po.actual_delivery_date = date.today()

    # --------------------------------------------------------
    # CANCEL PURCHASE ORDER
    # --------------------------------------------------------

    if new_status == "cancelled":

        if po.status not in [
            "pending",
            "approved",
            "shipped",
        ]:
            raise HTTPException(
                status_code=400,
                detail=(
                    "This Purchase Order "
                    "cannot be cancelled."
                ),
            )

    # --------------------------------------------------------
    # Update status
    # --------------------------------------------------------

    po.status = new_status

    # --------------------------------------------------------
    # Find vendor
    # --------------------------------------------------------

    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.id == po.vendor_id
        )
        .first()
    )

    # --------------------------------------------------------
    # SHIPPED NOTIFICATIONS
    # --------------------------------------------------------

    if new_status == "shipped":

        if vendor and vendor.user_id is not None:

            notify_user(
                db=db,
                user_id=vendor.user_id,
                title="Purchase Order Shipped",
                message=(
                    f"Purchase Order "
                    f"{po.order_number} "
                    f"has been marked as shipped."
                ),
                notification_type="delivery"
            )

        notify_roles(
            db=db,
            roles=[
                "administrator",
                "procurement_manager"
            ],
            title="Purchase Order Shipped",
            message=(
                f"Purchase Order "
                f"{po.order_number} "
                f"has been shipped."
            ),
            notification_type="delivery"
        )

    # --------------------------------------------------------
    # DELIVERED NOTIFICATIONS
    # --------------------------------------------------------

    if new_status == "delivered":

        if vendor and vendor.user_id is not None:

            notify_user(
                db=db,
                user_id=vendor.user_id,
                title="Purchase Order Delivered",
                message=(
                    f"Purchase Order "
                    f"{po.order_number} "
                    f"has been marked as delivered."
                ),
                notification_type="delivery"
            )

        notify_roles(
            db=db,
            roles=[
                "administrator",
                "procurement_manager"
            ],
            title="Purchase Order Delivered",
            message=(
                f"Purchase Order "
                f"{po.order_number} "
                f"has been successfully delivered."
            ),
            notification_type="delivery"
        )

        # ----------------------------------------------------
        # DELIVERY DELAY CHECK
        # ----------------------------------------------------

        if (
            po.expected_delivery_date
            and po.actual_delivery_date
            and po.actual_delivery_date
            > po.expected_delivery_date
        ):

            delay_days = (
                po.actual_delivery_date
                - po.expected_delivery_date
            ).days

            notify_roles(
                db=db,
                roles=[
                    "administrator",
                    "procurement_manager",
                    "supply_chain_manager"
                ],
                title="Delivery Delay Detected",
                message=(
                    f"Purchase Order "
                    f"{po.order_number} "
                    f"was delivered {delay_days} "
                    f"day(s) after the expected delivery date."
                ),
                notification_type="delivery_delay"
            )

    # --------------------------------------------------------
    # CANCELLED NOTIFICATION
    # --------------------------------------------------------

    if new_status == "cancelled":

        if vendor and vendor.user_id is not None:

            notify_user(
                db=db,
                user_id=vendor.user_id,
                title="Purchase Order Cancelled",
                message=(
                    f"Purchase Order "
                    f"{po.order_number} "
                    f"has been cancelled."
                ),
                notification_type="purchase_order"
            )

        notify_roles(
            db=db,
            roles=[
                "administrator",
                "procurement_manager"
            ],
            title="Purchase Order Cancelled",
            message=(
                f"Purchase Order "
                f"{po.order_number} "
                f"has been cancelled."
            ),
            notification_type="purchase_order"
        )

    # --------------------------------------------------------
    # SAVE
    # --------------------------------------------------------

    db.commit()
    db.refresh(po)

    return {
        "message": (
            f"Purchase Order status changed to "
            f"{new_status} successfully."
        ),
        "purchase_order_id": po.id,
        "purchase_order_number": po.order_number,
        "status": po.status,
        "actual_delivery_date": (
            po.actual_delivery_date.isoformat()
            if po.actual_delivery_date
            else None
        ),
    }