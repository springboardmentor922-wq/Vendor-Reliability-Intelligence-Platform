from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
import sys

from sqlalchemy.orm import Session

# ------------------------------------------------------------
# BACKEND PATH
# ------------------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


# ------------------------------------------------------------
# APPLICATION IMPORTS
# ------------------------------------------------------------

from app.database import SessionLocal
from app.models.vendor import Vendor
from app.models.procurement import ProcurementRequest
from app.models.purchase_order import (
    PurchaseOrder,
    PurchaseOrderItem,
)


# ------------------------------------------------------------
# SAMPLE PROCUREMENT DATA
# ------------------------------------------------------------

REQUEST_DATA = [
    {
        "title": "Raw Material Procurement",
        "category": "Raw Material Suppliers",
        "quantity": 120,
        "estimated_cost": 185000,
        "priority": "High",
        "status": "Pending",
    },
    {
        "title": "Industrial Equipment Purchase",
        "category": "Equipment Vendors",
        "quantity": 8,
        "estimated_cost": 420000,
        "priority": "High",
        "status": "Approved",
    },
    {
        "title": "IT Infrastructure Upgrade",
        "category": "IT Vendors",
        "quantity": 15,
        "estimated_cost": 275000,
        "priority": "Normal",
        "status": "Ordered",
    },
    {
        "title": "Logistics Transportation Service",
        "category": "Logistics Partners",
        "quantity": 20,
        "estimated_cost": 150000,
        "priority": "Normal",
        "status": "Delivered",
    },
    {
        "title": "Facility Maintenance Service",
        "category": "Maintenance Vendors",
        "quantity": 12,
        "estimated_cost": 95000,
        "priority": "Low",
        "status": "Completed",
    },
    {
        "title": "Business Support Services",
        "category": "Service Providers",
        "quantity": 10,
        "estimated_cost": 125000,
        "priority": "Normal",
        "status": "Cancelled",
    },
]


# ------------------------------------------------------------
# FIND APPROVED VENDOR FOR CATEGORY
# ------------------------------------------------------------

def find_vendor(db: Session, category: str):

    vendor = (
        db.query(Vendor)
        .filter(
            Vendor.category == category,
            Vendor.status == "Approved",
        )
        .order_by(Vendor.id.asc())
        .first()
    )

    if vendor:
        return vendor

    # fallback: any vendor from same category
    return (
        db.query(Vendor)
        .filter(Vendor.category == category)
        .order_by(Vendor.id.asc())
        .first()
    )


# ------------------------------------------------------------
# CREATE / UPDATE PROCUREMENT REQUESTS
# ------------------------------------------------------------

def seed_requests(db: Session):

    existing_requests = (
        db.query(ProcurementRequest)
        .order_by(ProcurementRequest.id.asc())
        .all()
    )

    created = 0
    updated = 0

    for index, data in enumerate(REQUEST_DATA):

        vendor = find_vendor(
            db,
            data["category"],
        )

        if index < len(existing_requests):

            request = existing_requests[index]

            request.title = data["title"]
            request.category = data["category"]
            request.quantity = data["quantity"]
            request.estimated_cost = Decimal(
                str(data["estimated_cost"])
            )
            request.priority = data["priority"]
            request.status = data["status"]

            if hasattr(request, "vendor_id"):
                request.vendor_id = (
                    vendor.id
                    if vendor
                    else None
                )

            updated += 1

        else:

            request_kwargs = {
                "title": data["title"],
                "category": data["category"],
                "quantity": data["quantity"],
                "estimated_cost": Decimal(
                    str(data["estimated_cost"])
                ),
                "priority": data["priority"],
                "status": data["status"],
            }

            if hasattr(
                ProcurementRequest,
                "vendor_id",
            ):
                request_kwargs["vendor_id"] = (
                    vendor.id
                    if vendor
                    else None
                )

            request = ProcurementRequest(
                **request_kwargs
            )

            db.add(request)
            created += 1

    db.commit()

    print(
        f"Procurement requests updated: {updated}"
    )
    print(
        f"Procurement requests created: {created}"
    )


# ------------------------------------------------------------
# PURCHASE ORDER DATA
# ------------------------------------------------------------

PO_DATA = [
    {
        "po_number": "PO-2026-001",
        "request_index": 1,
        "category": "Equipment Vendors",
        "status": "Approved",
        "amount": 420000,
        "days_from_today": 15,
    },
    {
        "po_number": "PO-2026-002",
        "request_index": 2,
        "category": "IT Vendors",
        "status": "Ordered",
        "amount": 275000,
        "days_from_today": 7,
    },
    {
        "po_number": "PO-2026-003",
        "request_index": 3,
        "category": "Logistics Partners",
        "status": "Delivered",
        "amount": 150000,
        "days_from_today": -5,
    },
    {
        "po_number": "PO-2026-004",
        "request_index": 4,
        "category": "Maintenance Vendors",
        "status": "Completed",
        "amount": 95000,
        "days_from_today": -10,
    },
    {
        "po_number": "PO-2026-005",
        "request_index": 0,
        "category": "Raw Material Suppliers",
        "status": "Pending",
        "amount": 185000,
        "days_from_today": -3,
    },
    {
        "po_number": "PO-2026-006",
        "request_index": 1,
        "category": "Equipment Vendors",
        "status": "Ordered",
        "amount": 210000,
        "days_from_today": 12,
    },
    {
        "po_number": "PO-2026-007",
        "request_index": 2,
        "category": "IT Vendors",
        "status": "Cancelled",
        "amount": 80000,
        "days_from_today": -2,
    },
]


# ------------------------------------------------------------
# CREATE PURCHASE ORDERS
# ------------------------------------------------------------

def seed_purchase_orders(db: Session):

    requests = (
        db.query(ProcurementRequest)
        .order_by(ProcurementRequest.id.asc())
        .all()
    )

    if not requests:
        print(
            "No procurement requests found."
        )
        return

    created = 0

    for data in PO_DATA:

        existing = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.po_number
                == data["po_number"]
            )
            .first()
        )

        if existing:
            continue

        request_index = data["request_index"]

        if request_index >= len(requests):
            continue

        request = requests[request_index]

        vendor_id = getattr(
            request,
            "vendor_id",
            None,
        )

        if vendor_id is None:
            vendor = find_vendor(
                db,
                data["category"],
            )

            if vendor:
                vendor_id = vendor.id

        if vendor_id is None:
            print(
                f"Skipping {data['po_number']}: "
                f"no vendor found."
            )
            continue

        order_date = date.today()

        expected_delivery_date = (
            date.today()
            + timedelta(
                days=data["days_from_today"]
            )
        )

        # Keep order date valid
        if expected_delivery_date < order_date:
            expected_delivery_date = (
                order_date
                + timedelta(days=1)
            )

        amount = Decimal(
            str(data["amount"])
        )

        order = PurchaseOrder(
            po_number=data["po_number"],
            order_date=order_date,
            expected_delivery_date=(
                expected_delivery_date
            ),
            procurement_request_id=request.id,
            department="Procurement",
            vendor_id=vendor_id,
            payment_terms="Net 30",
            shipping_address="Hyderabad, Telangana",
            billing_address="Hyderabad, Telangana",
            remarks=(
                "Sample procurement workflow "
                "data for VendorIQ development."
            ),
            subtotal=amount,
            tax_amount=Decimal("0"),
            total_amount=amount,
            status=data["status"],
            created_by=None,
        )

        db.add(order)
        db.flush()

        item = PurchaseOrderItem(
            purchase_order_id=order.id,
            item_description=request.title,
            quantity=request.quantity,
            unit_price=(
                amount
                / Decimal(
                    str(request.quantity)
                )
            ),
            tax_percent=Decimal("0"),
            total=amount,
        )

        db.add(item)

        created += 1

    db.commit()

    print(
        f"Purchase orders created: {created}"
    )


# ------------------------------------------------------------
# MAIN
# ------------------------------------------------------------

def main():

    print("=" * 60)
    print("VendorIQ Procurement Data Setup")
    print("=" * 60)

    db = SessionLocal()

    try:

        print("\n1. Updating procurement requests...")
        seed_requests(db)

        print("\n2. Creating purchase orders...")
        seed_purchase_orders(db)

        request_count = (
            db.query(
                ProcurementRequest
            ).count()
        )

        po_count = (
            db.query(
                PurchaseOrder
            ).count()
        )

        vendor_count = (
            db.query(
                Vendor
            ).count()
        )

        print("\n" + "=" * 60)
        print("PROCUREMENT DATA READY")
        print("=" * 60)

        print(
            f"Vendors             : {vendor_count}"
        )
        print(
            f"Procurement Requests: {request_count}"
        )
        print(
            f"Purchase Orders     : {po_count}"
        )

        print("=" * 60)

    except Exception as error:

        db.rollback()

        print("\nERROR:")
        print(error)

        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()