from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import inspect, select
from sqlalchemy.exc import SQLAlchemyError

from app.database import SessionLocal, Base

# Import all models so their tables are registered in Base.metadata.
from app.models.user import User
from app.models.vendor import Vendor
from app.models.procurement import ProcurementRequest
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.invoice import Invoice
from app.models.contract import Contract
from app.models.communication import Communication
from app.models.vendor_performance import VendorPerformance


TODAY = date.today()


# ============================================================
# HELPERS
# ============================================================

def table_columns(model) -> dict[str, Any]:
    """Return the real SQLAlchemy columns for a model."""
    return {
        column.name: column
        for column in inspect(model).columns
    }


def enum_value(column, preferred: str) -> str:
    """
    Return a valid value for SQLAlchemy Enum columns.
    If the column is not an Enum, return the preferred value.
    """
    column_type = column.type

    enum_values = getattr(column_type, "enums", None)

    if not enum_values:
        return preferred

    for value in enum_values:
        if str(value).lower() == preferred.lower():
            return value

    return enum_values[0]


def set_if_exists(
    data: dict[str, Any],
    columns: dict[str, Any],
    field: str,
    value: Any,
) -> None:
    if field in columns:
        data[field] = value


def add_common_required_values(
    model,
    data: dict[str, Any],
) -> dict[str, Any]:
    """
    Fill common NOT NULL fields when they are present.
    Existing defaults/autoincrement columns are left alone.
    """

    columns = table_columns(model)

    for name, column in columns.items():

        if name in data:
            continue

        if column.primary_key and column.autoincrement:
            continue

        if column.default is not None:
            continue

        if column.server_default is not None:
            continue

        if column.nullable:
            continue

        name_lower = name.lower()

        # Common text fields
        if any(
            key in name_lower
            for key in [
                "name",
                "title",
                "description",
                "remarks",
                "comment",
                "message",
                "subject",
                "department",
                "category",
                "recipient",
                "address",
                "payment_terms",
                "contract_type",
                "document_type",
                "file_name",
                "attachment",
            ]
        ):
            data[name] = "VendorIQ Demo"

        # Common status fields
        elif "status" in name_lower:
            data[name] = "Pending"

        # Common quantity fields
        elif "quantity" in name_lower:
            data[name] = 1

        # Common monetary fields
        elif any(
            key in name_lower
            for key in [
                "amount",
                "price",
                "cost",
                "subtotal",
                "tax",
                "total",
                "value",
            ]
        ):
            data[name] = Decimal("0.00")

        # Common date fields
        elif "date" in name_lower:
            data[name] = TODAY

        # Common datetime fields
        elif "time" in name_lower:
            data[name] = datetime.now()

        # Common boolean fields
        elif name_lower.startswith(
            ("is_", "has_", "active", "enabled")
        ):
            data[name] = True

    return data


def insert_model(db, model, data: dict[str, Any]):
    """
    Insert a record using only columns that actually exist.
    """
    columns = table_columns(model)

    filtered = {
        key: value
        for key, value in data.items()
        if key in columns
    }

    filtered = add_common_required_values(
        model,
        filtered,
    )

    record = model(**filtered)

    db.add(record)
    db.flush()

    return record


def find_by_field(
    db,
    model,
    field: str,
    value: Any,
):
    if field not in table_columns(model):
        return None

    return (
        db.query(model)
        .filter(
            getattr(model, field) == value
        )
        .first()
    )


# ============================================================
# USERS
# ============================================================

def get_admin_user(db):
    """
    Find the existing Administrator account.
    """
    admin = (
        db.query(User)
        .filter(
            User.email == "admin@vendoriq.com"
        )
        .first()
    )

    if admin:
        return admin

    admin = (
        db.query(User)
        .filter(
            User.role == "Administrator"
        )
        .first()
    )

    return admin


# ============================================================
# PROCUREMENT REQUESTS
# ============================================================

def create_procurement_requests(
    db,
    vendors,
    admin_user,
):
    print()
    print("1. PROCUREMENT REQUESTS")
    print("-" * 50)

    columns = table_columns(
        ProcurementRequest
    )

    results = []

    definitions = [
        (
            "Raw Material Procurement",
            vendors[0],
            "Raw Material Suppliers",
            50,
            Decimal("125000.00"),
            "High",
            "Pending",
        ),
        (
            "IT Infrastructure Purchase",
            vendors[1],
            "IT Vendors",
            20,
            Decimal("87500.00"),
            "Normal",
            "Approved",
        ),
        (
            "Equipment Procurement",
            vendors[2],
            "Equipment Vendors",
            10,
            Decimal("156000.00"),
            "High",
            "Approved",
        ),
        (
            "Logistics Service Request",
            vendors[3],
            "Logistics Partners",
            15,
            Decimal("98000.00"),
            "Normal",
            "Completed",
        ),
        (
            "Maintenance Service Request",
            vendors[4],
            "Maintenance Vendors",
            12,
            Decimal("210000.00"),
            "Normal",
            "Completed",
        ),
        (
            "Business Support Services",
            vendors[5],
            "Service Providers",
            8,
            Decimal("67500.00"),
            "Low",
            "Pending",
        ),
    ]

    for index, (
        title,
        vendor,
        category,
        quantity,
        cost,
        priority,
        status,
    ) in enumerate(definitions, start=1):

        unique_title = (
            f"{title} - DEMO {index}"
        )

        existing = find_by_field(
            db,
            ProcurementRequest,
            "title",
            unique_title,
        )

        if existing:
            results.append(existing)
            print(
                f"Already exists: {unique_title}"
            )
            continue

        data = {
            "title": unique_title,
            "vendor_id": vendor.id,
            "category": category,
            "quantity": quantity,
            "estimated_cost": cost,
            "priority": priority,
            "status": status,
            "created_by": (
                admin_user.id
                if admin_user
                and "created_by" in columns
                else None
            ),
        }

        request = insert_model(
            db,
            ProcurementRequest,
            data,
        )

        results.append(request)

        print(
            f"Created: {unique_title} | "
            f"{status} | ₹{cost}"
        )

    db.commit()

    print(
        f"Procurement requests ready: "
        f"{len(results)}"
    )

    return results


# ============================================================
# PURCHASE ORDERS
# ============================================================

def create_purchase_orders(
    db,
    vendors,
    requests,
    admin_user,
):
    print()
    print("2. PURCHASE ORDERS")
    print("-" * 50)

    columns = table_columns(
        PurchaseOrder
    )

    definitions = [
        (
            "PO-DEMO-001",
            vendors[0],
            requests[0] if requests else None,
            "Pending",
            125000,
            -5,
        ),
        (
            "PO-DEMO-002",
            vendors[1],
            requests[1] if len(requests) > 1 else None,
            "Approved",
            87500,
            5,
        ),
        (
            "PO-DEMO-003",
            vendors[2],
            requests[2] if len(requests) > 2 else None,
            "Ordered",
            156000,
            10,
        ),
        (
            "PO-DEMO-004",
            vendors[3],
            requests[3] if len(requests) > 3 else None,
            "Delivered",
            98000,
            -10,
        ),
        (
            "PO-DEMO-005",
            vendors[4],
            requests[4] if len(requests) > 4 else None,
            "Completed",
            210000,
            -20,
        ),
        (
            "PO-DEMO-006",
            vendors[5],
            requests[5] if len(requests) > 5 else None,
            "Pending",
            67500,
            15,
        ),
    ]

    results = []

    for (
        po_number,
        vendor,
        request,
        status,
        amount,
        expected_offset,
    ) in definitions:

        existing = find_by_field(
            db,
            PurchaseOrder,
            "po_number",
            po_number,
        )

        if existing:
            results.append(existing)
            print(
                f"Already exists: {po_number}"
            )
            continue

        order_date = TODAY - timedelta(
            days=30
        )

        expected_delivery = TODAY + timedelta(
            days=expected_offset
        )

        data = {
            "po_number": po_number,
            "order_date": order_date,
            "expected_delivery_date": expected_delivery,
            "vendor_id": vendor.id,
            "procurement_request_id": (
                request.id
                if request
                and "procurement_request_id"
                in columns
                else None
            ),
            "department": "Procurement",
            "payment_terms": "Net 30",
            "shipping_address": (
                "VendorIQ Main Warehouse"
            ),
            "billing_address": (
                "VendorIQ Finance Department"
            ),
            "remarks": (
                "VendorIQ demonstration "
                "purchase order"
            ),
            "subtotal": Decimal(str(amount)),
            "tax_amount": Decimal("0.00"),
            "total_amount": Decimal(str(amount)),
            "status": status,
            "created_by": (
                admin_user.id
                if admin_user
                and "created_by" in columns
                else None
            ),
        }

        if (
            admin_user
            and "approved_by" in columns
            and status in {
                "Approved",
                "Ordered",
                "Delivered",
                "Completed",
            }
        ):
            data["approved_by"] = admin_user.id

        if (
            "approved_at" in columns
            and status in {
                "Approved",
                "Ordered",
                "Delivered",
                "Completed",
            }
        ):
            data["approved_at"] = datetime.now()

        order = insert_model(
            db,
            PurchaseOrder,
            data,
        )

        results.append(order)

        print(
            f"Created: {po_number} | "
            f"{status} | ₹{amount:,.2f}"
        )

    db.commit()

    # --------------------------------------------------------
    # Purchase order items
    # --------------------------------------------------------

    print()
    print("Creating purchase-order items...")

    item_columns = table_columns(
        PurchaseOrderItem
    )

    for index, order in enumerate(results, start=1):

        existing_item = (
            db.query(PurchaseOrderItem)
            .filter(
                PurchaseOrderItem.purchase_order_id
                == order.id
            )
            .first()
        )

        if existing_item:
            continue

        unit_price = Decimal(
            str(
                order.total_amount
                or Decimal("0")
            )
        )

        data = {
            "purchase_order_id": order.id,
            "item_name": (
                f"VendorIQ Procurement Item {index}"
            ),
            "description": (
                "Procurement item for "
                "vendor workflow demonstration"
            ),
            "quantity": 1,
            "unit_price": unit_price,
            "tax_percent": Decimal("0.00"),
        }

        # Alternative common column names.
        if "product_name" in item_columns:
            data["product_name"] = data.pop(
                "item_name"
            )

        if "name" in item_columns:
            data["name"] = (
                f"VendorIQ Procurement Item {index}"
            )

        if "total_price" in item_columns:
            data["total_price"] = unit_price

        try:
            insert_model(
                db,
                PurchaseOrderItem,
                data,
            )
            print(
                f"Item added to {order.po_number}"
            )
        except Exception as error:
            db.rollback()
            print(
                f"Item skipped for "
                f"{order.po_number}: {error}"
            )

    db.commit()

    print(
        f"Purchase orders ready: "
        f"{len(results)}"
    )

    return results


# ============================================================
# VENDOR PERFORMANCE
# ============================================================

def create_performance(
    db,
    vendors,
    purchase_orders,
):
    print()
    print("3. VENDOR PERFORMANCE")
    print("-" * 50)

    results = []

    performance_values = [
        (4.6, 4.5, 4.0, 5.0, -1),
        (4.2, 4.0, 6.0, 8.0, 2),
        (4.8, 4.7, 3.0, 4.0, -2),
        (4.4, 4.3, 5.0, 7.0, 0),
        (4.9, 4.8, 2.5, 3.0, -3),
        (4.1, 4.0, 7.0, 10.0, 3),
    ]

    columns = table_columns(
        VendorPerformance
    )

    for index, order in enumerate(
        purchase_orders
    ):

        existing = (
            db.query(VendorPerformance)
            .filter(
                VendorPerformance.vendor_id
                == order.vendor_id,
                VendorPerformance.purchase_order_id
                == order.id,
            )
            .first()
        )

        if existing:
            results.append(existing)
            continue

        (
            quality,
            service,
            response,
            resolution,
            delivery_offset,
        ) = performance_values[
            index % len(performance_values)
        ]

        actual_delivery = (
            order.expected_delivery_date
            + timedelta(
                days=delivery_offset
            )
        )

        delivery_status = (
            "On Time"
            if actual_delivery
            <= order.expected_delivery_date
            else "Delayed"
        )

        data = {
            "vendor_id": order.vendor_id,
            "purchase_order_id": order.id,
            "actual_delivery_date": actual_delivery,
            "delivery_status": delivery_status,
            "quality_rating": Decimal(
                str(quality)
            ),
            "service_rating": Decimal(
                str(service)
            ),
            "response_time_hours": Decimal(
                str(response)
            ),
            "issue_resolution_time_hours": Decimal(
                str(resolution)
            ),
            "evaluation_date": TODAY,
            "comments": (
                "VendorIQ demonstration "
                "performance evaluation"
            ),
        }

        evaluation = insert_model(
            db,
            VendorPerformance,
            data,
        )

        results.append(evaluation)

        print(
            f"{order.po_number} | "
            f"Quality {quality}/5 | "
            f"Service {service}/5 | "
            f"{delivery_status}"
        )

    db.commit()

    print(
        f"Performance evaluations ready: "
        f"{len(results)}"
    )

    return results


# ============================================================
# CONTRACTS
# ============================================================

def create_contracts(
    db,
    vendors,
):
    print()
    print("4. CONTRACTS")
    print("-" * 50)

    columns = table_columns(
        Contract
    )

    definitions = [
        (
            "CON-DEMO-001",
            vendors[0],
            180,
            "Active",
            "Compliant",
        ),
        (
            "CON-DEMO-002",
            vendors[1],
            15,
            "Active",
            "Compliant",
        ),
        (
            "CON-DEMO-003",
            vendors[2],
            -20,
            "Expired",
            "Non-Compliant",
        ),
        (
            "CON-DEMO-004",
            vendors[3],
            250,
            "Active",
            "Compliant",
        ),
        (
            "CON-DEMO-005",
            vendors[4],
            365,
            "Active",
            "Compliant",
        ),
    ]

    results = []

    for (
        contract_number,
        vendor,
        end_offset,
        status,
        compliance,
    ) in definitions:

        existing = find_by_field(
            db,
            Contract,
            "contract_number",
            contract_number,
        )

        if existing:
            results.append(existing)
            print(
                f"Already exists: "
                f"{contract_number}"
            )
            continue

        start_date = TODAY - timedelta(
            days=180
        )

        end_date = TODAY + timedelta(
            days=end_offset
        )

        data = {
            "contract_number": contract_number,
            "vendor_id": vendor.id,
            "start_date": start_date,
            "end_date": end_date,
            "status": status,
            "compliance_status": compliance,
            "contract_name": (
                f"Vendor Agreement - "
                f"{vendor.name}"
            ),
            "description": (
                "VendorIQ demonstration "
                "supplier contract"
            ),
        }

        contract = insert_model(
            db,
            Contract,
            data,
        )

        results.append(contract)

        print(
            f"Created: {contract_number} | "
            f"{status} | {compliance}"
        )

    db.commit()

    print(
        f"Contracts ready: "
        f"{len(results)}"
    )

    return results


# ============================================================
# COMMUNICATION
# ============================================================

def create_communications(
    db,
    vendors,
):
    print()
    print("5. COMMUNICATION")
    print("-" * 50)

    columns = table_columns(
        Communication
    )

    definitions = [
        (
            vendors[0],
            "Delivery schedule confirmation",
            "OPEN",
            "Vendor Messaging",
        ),
        (
            vendors[1],
            "Purchase order acknowledgement",
            "PENDING",
            "Vendor Messaging",
        ),
        (
            vendors[2],
            "Quality inspection clarification",
            "RESOLVED",
            "Procurement Discussion",
        ),
        (
            vendors[3],
            "Delivery confirmation",
            "CLOSED",
            "Vendor Messaging",
        ),
        (
            vendors[4],
            "Contract renewal discussion",
            "OPEN",
            "Procurement Discussion",
        ),
        (
            vendors[5],
            "Invoice clarification",
            "PENDING",
            "Procurement Discussion",
        ),
    ]

    results = []

    for (
        vendor,
        subject,
        status,
        communication_type,
    ) in definitions:

        existing = (
            db.query(Communication)
            .filter(
                Communication.vendor_id
                == vendor.id,
                Communication.subject
                == subject,
            )
            .first()
        )

        if existing:
            results.append(existing)
            print(
                f"Already exists: {subject}"
            )
            continue

        data = {
            "vendor_id": vendor.id,
            "subject": subject,
            "message": (
                "VendorIQ demonstration "
                "communication record."
            ),
            "status": status,
            "communication_type": (
                communication_type
            ),
            "recipient": vendor.email,
        }

        communication = insert_model(
            db,
            Communication,
            data,
        )

        results.append(communication)

        print(
            f"Created: {subject} | {status}"
        )

    db.commit()

    print(
        f"Communications ready: "
        f"{len(results)}"
    )

    return results


# ============================================================
# INVOICES
# ============================================================

def create_invoices(
    db,
    purchase_orders,
):
    print()
    print("6. INVOICES")
    print("-" * 50)

    columns = table_columns(
        Invoice
    )

    results = []

    for index, order in enumerate(
        purchase_orders
    ):

        existing = (
            db.query(Invoice)
            .filter(
                Invoice.purchase_order_id
                == order.id
            )
            .first()
        )

        if existing:
            results.append(existing)
            continue

        status = (
            "Paid"
            if str(order.status).upper()
            in {"DELIVERED", "COMPLETED"}
            else "Pending"
        )

        data = {
            "purchase_order_id": order.id,
            "invoice_number": (
                f"INV-DEMO-{index + 1:03d}"
            ),
            "invoice_date": TODAY,
            "amount": (
                order.total_amount
                or Decimal("0.00")
            ),
            "total_amount": (
                order.total_amount
                or Decimal("0.00")
            ),
            "status": status,
            "remarks": (
                "VendorIQ demonstration invoice"
            ),
        }

        try:
            invoice = insert_model(
                db,
                Invoice,
                data,
            )

            results.append(invoice)

            print(
                f"Created invoice for "
                f"{order.po_number} | "
                f"{status}"
            )

            db.commit()

        except SQLAlchemyError as error:
            db.rollback()

            print(
                f"Invoice skipped for "
                f"{order.po_number}: {error}"
            )

    return results


# ============================================================
# FINAL COUNTS
# ============================================================

def print_final_counts(db):

    print()
    print("=" * 65)
    print("VENDORIQ DATABASE SUMMARY")
    print("=" * 65)

    models = [
        ("Vendors", Vendor),
        ("Procurement Requests", ProcurementRequest),
        ("Purchase Orders", PurchaseOrder),
        ("Purchase Order Items", PurchaseOrderItem),
        ("Invoices", Invoice),
        ("Contracts", Contract),
        ("Communications", Communication),
        ("Performance Evaluations", VendorPerformance),
    ]

    for label, model in models:

        try:
            count = db.query(model).count()
            print(
                f"{label:<28}: {count}"
            )
        except Exception as error:
            print(
                f"{label:<28}: ERROR ({error})"
            )

    print("=" * 65)


# ============================================================
# MAIN
# ============================================================

def main():

    print()
    print("=" * 65)
    print("VENDORIQ WORKFLOW DATA SEED")
    print("=" * 65)
    print()

    db = SessionLocal()

    try:

        vendors = (
            db.query(Vendor)
            .filter(
                Vendor.status == "Approved"
            )
            .order_by(Vendor.id.asc())
            .all()
        )

        if not vendors:

            print(
                "ERROR: No approved vendors found."
            )

            print(
                "Your Vendors page should contain "
                "approved vendors before running this."
            )

            return

        # Use at least 6 vendors.
        vendors = vendors[:6]

        print(
            f"Approved vendors available: "
            f"{len(vendors)}"
        )

        admin_user = get_admin_user(db)

        if admin_user:
            print(
                f"Admin user found: "
                f"{admin_user.email}"
            )
        else:
            print(
                "Admin user not found. "
                "Continuing without created_by."
            )

        # ----------------------------------------------------
        # Create connected workflow data
        # ----------------------------------------------------

        requests = create_procurement_requests(
            db,
            vendors,
            admin_user,
        )

        purchase_orders = create_purchase_orders(
            db,
            vendors,
            requests,
            admin_user,
        )

        create_performance(
            db,
            vendors,
            purchase_orders,
        )

        create_contracts(
            db,
            vendors,
        )

        create_communications(
            db,
            vendors,
        )

        create_invoices(
            db,
            purchase_orders,
        )

        # ----------------------------------------------------
        # Final database summary
        # ----------------------------------------------------

        print_final_counts(db)

        print()
        print("=" * 65)
        print("SEED COMPLETED SUCCESSFULLY")
        print("=" * 65)
        print()
        print(
            "Now refresh VendorIQ in the browser."
        )
        print()

    except Exception as error:

        db.rollback()

        print()
        print("=" * 65)
        print("SEED FAILED")
        print("=" * 65)
        print()
        print(
            f"{type(error).__name__}: {error}"
        )
        print()

        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()