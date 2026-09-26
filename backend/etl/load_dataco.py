"""Load DataCo supply-chain history into the platform's own database.

    python -m etl.load_dataco                  # default: 6000 orders, 24 months
    python -m etl.load_dataco --orders 10000
    python -m etl.load_dataco --months 36
    python -m etl.load_dataco --clear          # remove loaded history and stop

Run this AFTER ``python seed.py``.  ``seed.py`` creates the users, the
demo vendors and the small hand-written Milestone 2 workflow; this script
adds the depth of trading history that the Milestone 3 performance,
reliability and analytics modules need in order to have something real to
measure.

--------------------------------------------------------------------------
What it writes
--------------------------------------------------------------------------
For each sampled dataset row it creates a matching chain of application
records - procurement request -> purchase order -> line item -> performance
evaluation -> invoice - so every number on a dashboard traces back through
the ordinary tables rather than through a separate analytics store.

  order date        the source order date, shifted forward so the history
                    ends today (see ``--months``)
  expected_delivery order date + the committed lead time for the category
  actual_delivery   expected_delivery + the source slip, scaled to freight
  on time           actual_delivery <= expected_delivery

Because the committed date absorbs the dataset's one-day tolerance, the
application's plain rule - delivered by the committed date - reproduces the
source data's own definition of a late shipment.

--------------------------------------------------------------------------
Derived versus sourced
--------------------------------------------------------------------------
Sourced directly from the dataset: order dates, lane (shipping mode, market,
region), commodity and product, quantity, unit price, order value, discount
rate, order status, and above all the delivery slip that every delivery
metric is computed from.

Derived, because the dataset has no column for them: the supplier identity
(assigned by lane affinity - see ``ml/dataset.py``), quality ratings (mapped
from the order's profit ratio and status), and the communication timings
(written as real message rows whose timestamps encode a responsiveness that
tracks the supplier's delivery record).  Everything derived is written as
ordinary rows that the scoring engine then reads back like any other data.

The loader is idempotent: every row it writes is tagged with ``source_ref``,
and a re-run clears the previous load first.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

import pandas as pd
from sqlalchemy import text

from database import SessionLocal
from ml.dataset import (
    SLIP_SCALE,
    TOLERANCE_DAYS,
    VENDOR_ROSTER,
    load_prepared
)
from models import (
    ComplianceCheck,
    Contract,
    ContractStatus,
    Invoice,
    InvoiceStatus,
    Message,
    MessageThread,
    ProcurementRequest,
    ProcurementStatus,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatus,
    ThreadStatus,
    User,
    UserRole,
    Vendor,
    VendorCertification,
    VendorContact,
    VendorPerformance,
    VendorStatus
)

#: Tag written onto every record this loader creates.
SOURCE_TAG = "DATACO"

#: Matches seed.py so every demo account shares one password.
DEMO_PASSWORD = "VendorIQ@2026"

DEFAULT_ORDERS = 6000
DEFAULT_MONTHS = 24

#: Committed lead time, in days, by procurement category. Bulk commodities
#: are ordered further ahead than services or IT hardware.
LEAD_TIME_DAYS = {
    "Raw Material Suppliers": 32,
    "Equipment Vendors": 28,
    "IT Vendors": 18,
    "Service Providers": 14,
    "Logistics Partners": 12,
    "Maintenance Vendors": 16,
}

#: DataCo order status -> the platform's purchase order status.
ORDER_STATUS_MAP = {
    "COMPLETE": PurchaseOrderStatus.COMPLETED,
    "CLOSED": PurchaseOrderStatus.COMPLETED,
    "PENDING": PurchaseOrderStatus.ORDERED,
    "PENDING_PAYMENT": PurchaseOrderStatus.DELIVERED,
    "PROCESSING": PurchaseOrderStatus.ORDERED,
    "ON_HOLD": PurchaseOrderStatus.APPROVED,
    "PAYMENT_REVIEW": PurchaseOrderStatus.DELIVERED,
    "CANCELED": PurchaseOrderStatus.CANCELLED,
    "SUSPECTED_FRAUD": PurchaseOrderStatus.CANCELLED,
}

#: Purchase order statuses that mean the goods arrived.
DELIVERED_STATUSES = (
    PurchaseOrderStatus.DELIVERED,
    PurchaseOrderStatus.COMPLETED,
)

#: The source is a retail order log, so its line quantities are consumer
#: sized. Procurement buys in commercial lots, so quantities are scaled by
#: category - raw materials move in bulk, services are bought a few at a
#: time. Only the magnitude changes; the delivery outcome attached to the
#: order is untouched.
QUANTITY_SCALE = {
    "Raw Material Suppliers": 40,
    "Equipment Vendors": 3,
    "IT Vendors": 10,
    "Service Providers": 2,
    "Logistics Partners": 8,
    "Maintenance Vendors": 2,
}

UNITS_BY_CATEGORY = {
    "Raw Material Suppliers": "Tonnes",
    "Equipment Vendors": "Units",
    "IT Vendors": "Licences",
    "Service Providers": "Engagements",
    "Logistics Partners": "Shipments",
    "Maintenance Vendors": "Service Calls",
}

DEPARTMENTS = [
    "Manufacturing", "Operations", "IT & Systems", "Facilities",
    "Logistics", "Maintenance", "Quality Assurance",
]


def _jitter(*parts) -> float:
    """Deterministic value in [0, 1) - used instead of random draws."""

    digest = hashlib.md5("|".join(str(p) for p in parts).encode()).hexdigest()

    return int(digest[:8], 16) / 0xFFFFFFFF


# --------------------------------------------------------------------------
# Derivations
# --------------------------------------------------------------------------

def quality_rating(profit_ratio: float, order_status: str, slip: float) -> float:
    """Map an order's commercial outcome onto a 1-5 quality rating.

    The dataset carries no inspection result, so quality is inferred from
    what it does record.  A line delivered at a heavy loss usually means
    rework, returns, discounts or a disputed shipment; a flagged or
    cancelled order is a quality event in its own right; and a badly late
    shipment tends to arrive in worse condition.  The mapping is monotone
    in all three, so a vendor cannot look good on quality while its
    commercial outcomes deteriorate.
    """

    # profit_ratio spans about -2.75 .. 0.5 in the source data.
    normalised = max(min(profit_ratio, 0.5), -1.5)
    rating = 3.0 + (normalised / 0.5) * 1.6

    if order_status in ("SUSPECTED_FRAUD", "CANCELED"):
        rating -= 1.4

    if slip >= 3:
        rating -= 0.5
    elif slip >= 2:
        rating -= 0.25

    return round(max(1.0, min(5.0, rating)), 2)


def service_rating(slip: float, quality: float) -> float:
    """Overall service score: punctuality and quality, evenly weighted."""

    punctuality = 5.0 if slip <= TOLERANCE_DAYS else max(1.0, 5.0 - (slip - TOLERANCE_DAYS) * 1.2)

    return round(max(1.0, min(5.0, 0.5 * punctuality + 0.5 * quality)), 2)


def response_hours(vendor_late_rate: float, seed_parts) -> float:
    """Hours a supplier takes to answer a query.

    Derived, not sourced: the dataset has no communication log.  A supplier
    that misses delivery dates is modelled as slower to respond, which is
    the assumption the communication factor rests on.  The value is written
    onto real message rows, so the scoring engine measures it from message
    timestamps rather than trusting this number directly.
    """

    base = 3.0 + vendor_late_rate * 26.0
    spread = _jitter(*seed_parts) * base * 0.8

    return round(max(0.5, base - base * 0.4 + spread), 2)


def resolution_hours(vendor_late_rate: float, seed_parts) -> float:
    """Hours to close out a raised issue."""

    base = 12.0 + vendor_late_rate * 90.0
    spread = _jitter("res", *seed_parts) * base * 0.7

    return round(max(2.0, base - base * 0.35 + spread), 2)


# --------------------------------------------------------------------------
# Clearing a previous load
# --------------------------------------------------------------------------

def clear_history(db) -> None:
    """Remove everything a previous run of this loader wrote."""

    statements = [
        # Children first so foreign keys stay satisfied.
        """DELETE FROM vendor_performance vp USING purchase_orders po
           WHERE vp.purchase_order_id = po.id AND po.source_ref LIKE :tag""",
        """DELETE FROM delay_predictions dp USING purchase_orders po
           WHERE dp.purchase_order_id = po.id AND po.source_ref LIKE :tag""",
        """DELETE FROM invoices i USING purchase_orders po
           WHERE i.purchase_order_id = po.id AND po.source_ref LIKE :tag""",
        """DELETE FROM purchase_order_items poi USING purchase_orders po
           WHERE poi.purchase_order_id = po.id AND po.source_ref LIKE :tag""",
        """DELETE FROM message_threads mt USING purchase_orders po
           WHERE mt.purchase_order_id = po.id AND po.source_ref LIKE :tag""",
        "DELETE FROM purchase_orders WHERE source_ref LIKE :tag",
        # Conversations this loader generated are marked in the subject.
        """DELETE FROM messages m USING message_threads mt
           WHERE m.thread_id = mt.id AND mt.subject LIKE '%[auto]%'""",
        "DELETE FROM message_threads WHERE subject LIKE '%[auto]%'",
        """DELETE FROM procurement_requests
           WHERE justification LIKE :marker""",
    ]

    for statement in statements:
        db.execute(
            text(statement),
            {"tag": f"{SOURCE_TAG}%", "marker": f"%[{SOURCE_TAG}]%"},
        )

    db.commit()
    print("Cleared previously loaded dataset history.")


# --------------------------------------------------------------------------
# Vendors
# --------------------------------------------------------------------------

def ensure_vendors(db, approver_id, creator_id) -> dict:
    """Create any roster supplier that is not in the database yet.

    Suppliers seeded by ``seed.py`` are matched by name and reused, so the
    loader adds depth to the existing demo rather than duplicating it.
    """

    existing = {v.vendor_name: v for v in db.query(Vendor).all()}

    next_sequence = 1
    for vendor in existing.values():
        if vendor.vendor_code.startswith("VND-"):
            try:
                next_sequence = max(
                    next_sequence, int(vendor.vendor_code.split("-")[1]) + 1
                )
            except (IndexError, ValueError):
                continue

    created = 0
    today = date.today()

    for index, profile in enumerate(VENDOR_ROSTER):
        if profile.name in existing:
            continue

        vendor = Vendor(
            vendor_code=f"VND-{next_sequence:04d}",
            vendor_name=profile.name,
            category=profile.category,
            contact_person=profile.contact,
            email=profile.email,
            phone=f"+{40 + index} {index:02d} 555 0{100 + index}",
            website=f"https://www.{profile.email.split('@')[1]}",
            address=f"{100 + index * 7} Industrial Park",
            city=profile.city,
            country=profile.country,
            tax_id=f"TAX{700000 + index * 137}",
            registration_number=f"REG{500000 + index * 211}",
            status=VendorStatus.APPROVED,
            risk_level="Medium",
            approved_by=approver_id,
            approved_at=datetime.now(timezone.utc) - timedelta(days=400),
            created_by=creator_id,
            onboarded_on=today - timedelta(days=760 + index * 3),
        )

        db.add(vendor)
        db.flush()

        db.add(
            VendorContact(
                vendor_id=vendor.id,
                name=profile.contact,
                designation="Account Manager",
                email=profile.email,
                phone=vendor.phone,
                is_primary=True,
            )
        )

        existing[profile.name] = vendor
        next_sequence += 1
        created += 1

    db.flush()

    # Every supplier gets a portal login. Besides being what the Vendor role
    # is for, it is what makes the communication measurement possible: a
    # response time is only meaningful if the reply came from the supplier.
    logins = ensure_vendor_logins(db, existing)

    db.commit()

    print(
        f"Vendors: {created} created, {len(VENDOR_ROSTER) - created} reused; "
        f"{logins} portal logins added"
    )

    return {name: vendor.id for name, vendor in existing.items()}


def ensure_vendor_logins(db, vendors_by_name) -> int:
    """Create a supplier-side login for any vendor that does not have one."""

    from security import hash_password

    covered = {
        vendor_id
        for (vendor_id,) in db.query(User.vendor_id)
        .filter(User.role == UserRole.VENDOR, User.vendor_id.isnot(None))
        .all()
    }

    taken = {email for (email,) in db.query(User.email).all()}
    created = 0

    for name, vendor in vendors_by_name.items():
        if vendor.id in covered:
            continue

        slug = "".join(ch for ch in name.lower().split()[0] if ch.isalnum())
        email = f"{slug}@vendor.vendoriq.com"

        suffix = 2
        while email in taken:
            email = f"{slug}{suffix}@vendor.vendoriq.com"
            suffix += 1

        taken.add(email)

        db.add(
            User(
                name=vendor.contact_person or name,
                email=email,
                password_hash=hash_password(DEMO_PASSWORD),
                role=UserRole.VENDOR,
                phone=vendor.phone,
                department="Vendor Portal",
                job_title="Account Manager",
                vendor_id=vendor.id,
                is_active=True,
            )
        )

        created += 1

    db.flush()

    return created


# --------------------------------------------------------------------------
# Main load
# --------------------------------------------------------------------------

def load(orders=DEFAULT_ORDERS, months=DEFAULT_MONTHS, dataset_path=None):
    db = SessionLocal()

    try:
        staff = {
            user.role: user
            for user in db.query(User)
            .filter(User.role.in_(UserRole.INTERNAL_STAFF))
            .all()
        }

        procurement = staff.get(UserRole.PROCUREMENT_MANAGER)
        supply_chain = staff.get(UserRole.SUPPLY_CHAIN_MANAGER)
        admin = staff.get(UserRole.ADMINISTRATOR)

        if not procurement or not admin:
            print(
                "No staff users found. Run 'python seed.py' before loading "
                "the dataset history."
            )
            return

        supply_chain = supply_chain or procurement

        clear_history(db)

        vendor_ids = ensure_vendors(db, procurement.id, procurement.id)

        # ---- read and shape the dataset -------------------------
        print("Reading dataset ...")
        data = load_prepared(dataset_path)

        # Keep the most recent slice of the order book, then sample down.
        data = data.sort_values("order_date")
        cutoff = data["order_date"].max() - pd.DateOffset(months=months)
        window = data[data["order_date"] >= cutoff]

        if len(window) > orders:
            # Even sampling across the window keeps every month populated.
            step = len(window) / orders
            picks = [int(i * step) for i in range(orders)]
            window = window.iloc[picks]

        window = window.sort_values("order_date").reset_index(drop=True)

        # Shift the history forward so it ends today.
        offset = pd.Timestamp(date.today()) - window["order_date"].max()
        window["shifted_date"] = window["order_date"] + offset

        print(
            f"  {len(window):,} orders spanning "
            f"{window['shifted_date'].min().date()} -> "
            f"{window['shifted_date'].max().date()}"
        )

        # Each supplier's overall late rate drives the derived communication
        # timings below.
        late_rates = window.groupby("vendor_name")["late"].mean().to_dict()

        # ---- purchase order numbering ---------------------------
        # Continue the existing per-year sequences rather than colliding.
        year_sequences: dict[int, int] = {}

        for (po_number,) in db.query(PurchaseOrder.po_number).all():
            parts = po_number.split("-")
            if len(parts) == 3 and parts[0] == "PO":
                try:
                    year_sequences[int(parts[1])] = max(
                        year_sequences.get(int(parts[1]), 0), int(parts[2])
                    )
                except ValueError:
                    continue

        request_sequences: dict[int, int] = {}

        for (number,) in db.query(ProcurementRequest.request_number).all():
            parts = number.split("-")
            if len(parts) == 3 and parts[0] == "PR":
                try:
                    request_sequences[int(parts[1])] = max(
                        request_sequences.get(int(parts[1]), 0), int(parts[2])
                    )
                except ValueError:
                    continue

        invoice_sequences: dict[int, int] = {}

        for (number,) in db.query(Invoice.invoice_number).all():
            parts = number.split("-")
            if len(parts) == 3 and parts[0] == "INV":
                try:
                    invoice_sequences[int(parts[1])] = max(
                        invoice_sequences.get(int(parts[1]), 0), int(parts[2])
                    )
                except ValueError:
                    continue

        today = date.today()

        request_rows = []
        order_rows = []
        staging = []

        print("Building records ...")

        for position, row in enumerate(window.itertuples(index=False)):
            vendor_id = vendor_ids.get(row.vendor_name)

            if vendor_id is None:
                continue

            category = row.procurement_category
            order_date = row.shifted_date.date()
            lead_time = LEAD_TIME_DAYS.get(category, 21)

            # Vary the committed lead time a little per order so the
            # dashboards do not show one flat lead time per category.
            lead_time += int(_jitter("lead", position) * 10) - 4
            lead_time = max(5, lead_time)

            expected = order_date + timedelta(days=lead_time)

            slip = float(row.slip)
            delay_days = int(round((slip - TOLERANCE_DAYS) * SLIP_SCALE))

            status = ORDER_STATUS_MAP.get(
                row.order_status, PurchaseOrderStatus.ORDERED
            )

            actual = None

            if status in DELIVERED_STATUSES:
                actual = expected + timedelta(days=delay_days)

                # An order cannot have been delivered in the future.
                if actual > today:
                    if expected <= today:
                        status = PurchaseOrderStatus.ORDERED
                        actual = None
                    else:
                        # Still in flight: leave it open.
                        status = PurchaseOrderStatus.APPROVED
                        actual = None

            elif status in (
                PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.APPROVED
            ):
                # Anything ordered long ago and never delivered would be a
                # data artefact, so close it out using its recorded slip.
                if expected < today - timedelta(days=45):
                    status = PurchaseOrderStatus.COMPLETED
                    actual = expected + timedelta(days=delay_days)

            scale = QUANTITY_SCALE.get(category, 1)
            quantity = Decimal(str(max(1, int(row.quantity)) * scale))
            unit_price = Decimal(str(round(float(row.unit_price), 2)))
            subtotal = (quantity * unit_price).quantize(Decimal("0.01"))
            tax = (subtotal * Decimal("0.08")).quantize(Decimal("0.01"))

            # Freight runs at a few percent of order value, not a flat fee -
            # a flat fee would swamp the small lines and make budget-versus-
            # actual meaningless.
            freight_rate = Decimal(
                str(round(0.02 + _jitter("ship", position) * 0.04, 4))
            )
            shipping = max(
                (subtotal * freight_rate).quantize(Decimal("0.01")),
                Decimal("25.00"),
            )
            total = subtotal + tax + shipping

            year = order_date.year

            request_sequences[year] = request_sequences.get(year, 0) + 1
            request_number = f"PR-{year}-{request_sequences[year]:04d}"

            year_sequences[year] = year_sequences.get(year, 0) + 1
            po_number = f"PO-{year}-{year_sequences[year]:04d}"

            # ---- procurement request ----------------------------
            if status == PurchaseOrderStatus.CANCELLED:
                request_status = ProcurementStatus.CANCELLED
            elif status == PurchaseOrderStatus.COMPLETED:
                request_status = ProcurementStatus.COMPLETED
            elif status == PurchaseOrderStatus.DELIVERED:
                request_status = ProcurementStatus.DELIVERED
            else:
                request_status = ProcurementStatus.ORDERED

            requested_at = order_date - timedelta(
                days=3 + int(_jitter("req", position) * 9)
            )

            request_rows.append({
                "request_number": request_number,
                "requested_by": (
                    supply_chain.id if position % 2 else procurement.id
                ),
                "item": str(row.product_name)[:150],
                "description": (
                    f"{row.commodity} required for scheduled operations."
                ),
                "category": category,
                "quantity": quantity,
                "unit": UNITS_BY_CATEGORY.get(category, "Units"),
                "estimated_cost": (
                    # What the requester asked for: the full landed cost,
                    # estimated before the order is placed and therefore
                    # slightly off the eventual figure.
                    (subtotal + tax + shipping)
                    * Decimal(str(round(0.94 + _jitter("est", position) * 0.14, 4)))
                ).quantize(Decimal("0.01")),
                "currency": "USD",
                "required_date": expected,
                "priority": (
                    "Urgent" if row.shipping_mode == "Same Day"
                    else "High" if row.shipping_mode == "First Class"
                    else "Medium"
                ),
                "department": DEPARTMENTS[position % len(DEPARTMENTS)],
                "justification": (
                    f"Replenishment against the operating plan. [{SOURCE_TAG}]"
                ),
                "status": request_status,
                "assigned_vendor_id": vendor_id,
                "approved_by": procurement.id,
                "approved_at": datetime.combine(requested_at, time(9, 30)),
                "created_at": datetime.combine(requested_at, time(8, 15)),
                "updated_at": datetime.combine(order_date, time(10, 0)),
            })

            staging.append({
                "po_number": po_number,
                "vendor_id": vendor_id,
                "vendor_name": row.vendor_name,
                "category": category,
                "order_date": order_date,
                "expected": expected,
                "actual": actual,
                "status": status,
                "quantity": quantity,
                "unit_price": unit_price,
                "subtotal": subtotal,
                "tax": tax,
                "shipping": shipping,
                "total": total,
                "product_name": str(row.product_name)[:200],
                "commodity": row.commodity,
                "shipping_mode": row.shipping_mode,
                "market": row.market,
                "order_region": row.order_region,
                "slip": slip,
                "profit_ratio": float(row.profit_ratio),
                "order_status": row.order_status,
                "position": position,
                "unit": UNITS_BY_CATEGORY.get(category, "Units"),
            })

        # ---- write procurement requests --------------------------
        print(f"Writing {len(request_rows):,} procurement requests ...")
        db.bulk_insert_mappings(ProcurementRequest, request_rows)
        db.flush()

        request_ids = dict(
            db.query(ProcurementRequest.request_number, ProcurementRequest.id)
            .filter(
                ProcurementRequest.justification.like(f"%[{SOURCE_TAG}]%")
            )
            .all()
        )

        # ---- write purchase orders -------------------------------
        for index, item in enumerate(staging):
            request_number = request_rows[index]["request_number"]

            order_rows.append({
                "po_number": item["po_number"],
                "vendor_id": item["vendor_id"],
                "procurement_request_id": request_ids.get(request_number),
                "created_by": procurement.id,
                "title": item["product_name"],
                "description": (
                    f"{item['commodity']} supplied on the "
                    f"{item['shipping_mode']} lane into {item['market']}."
                ),
                "order_date": item["order_date"],
                "expected_delivery": item["expected"],
                "actual_delivery": item["actual"],
                "currency": "USD",
                "subtotal": item["subtotal"],
                "tax_amount": item["tax"],
                "shipping_amount": item["shipping"],
                "total_amount": item["total"],
                "payment_terms": ["Net 30", "Net 45", "Net 60"][
                    item["position"] % 3
                ],
                "shipping_address": "Plant 2, 14 Harbour Road, Rotterdam",
                "status": item["status"],
                "approved_by": procurement.id,
                "approved_at": datetime.combine(item["order_date"], time(11, 0)),
                "shipping_mode": item["shipping_mode"],
                "market": item["market"],
                "order_region": item["order_region"],
                "source_ref": f"{SOURCE_TAG}-{item['position']}",
                "created_at": datetime.combine(item["order_date"], time(10, 30)),
                "updated_at": datetime.combine(
                    item["actual"] or item["order_date"], time(16, 0)
                ),
            })

        print(f"Writing {len(order_rows):,} purchase orders ...")
        db.bulk_insert_mappings(PurchaseOrder, order_rows)
        db.flush()

        order_ids = dict(
            db.query(PurchaseOrder.po_number, PurchaseOrder.id)
            .filter(PurchaseOrder.source_ref.like(f"{SOURCE_TAG}%"))
            .all()
        )

        # ---- line items, performance rows, invoices --------------
        item_rows = []
        performance_rows = []
        invoice_rows = []

        for item in staging:
            order_id = order_ids.get(item["po_number"])

            if order_id is None:
                continue

            item_rows.append({
                "purchase_order_id": order_id,
                "item_name": item["product_name"],
                "description": item["commodity"],
                "quantity": item["quantity"],
                "unit": item["unit"],
                "unit_price": item["unit_price"],
                "line_total": item["subtotal"],
            })

            if item["status"] not in DELIVERED_STATUSES or not item["actual"]:
                continue

            late_days = (item["actual"] - item["expected"]).days
            on_time = late_days <= 0

            quality = quality_rating(
                item["profit_ratio"], item["order_status"], item["slip"]
            )
            vendor_late_rate = late_rates.get(item["vendor_name"], 0.25)

            performance_rows.append({
                "vendor_id": item["vendor_id"],
                "purchase_order_id": order_id,
                "evaluation_date": item["actual"],
                "on_time_delivery": Decimal("100") if on_time else Decimal("0"),
                "delayed_delivery": Decimal("0") if on_time else Decimal("100"),
                "quality_rating": Decimal(str(quality)),
                "response_time": Decimal(str(
                    response_hours(vendor_late_rate, ("resp", item["position"]))
                )),
                "issue_resolution_time": Decimal(str(
                    resolution_hours(vendor_late_rate, (item["position"],))
                )),
                "order_completion_rate": (
                    Decimal("100")
                    if item["status"] == PurchaseOrderStatus.COMPLETED
                    else Decimal("85")
                ),
                "service_rating": Decimal(str(service_rating(item["slip"], quality))),
                "remarks": (
                    f"Delivered {late_days} day(s) after the committed date"
                    if late_days > 0
                    else f"Delivered {abs(late_days)} day(s) early"
                    if late_days < 0
                    else "Delivered on the committed date"
                ),
            })

            # Invoice every completed order.
            if item["status"] != PurchaseOrderStatus.COMPLETED:
                continue

            invoice_date = item["actual"]
            year = invoice_date.year
            invoice_sequences[year] = invoice_sequences.get(year, 0) + 1

            due = invoice_date + timedelta(days=30)
            paid = due <= today

            invoice_rows.append({
                "invoice_number": f"INV-{year}-{invoice_sequences[year]:04d}",
                "purchase_order_id": order_id,
                "vendor_id": item["vendor_id"],
                "invoice_date": invoice_date,
                "due_date": due,
                "amount": item["subtotal"],
                "tax_amount": item["tax"],
                "total_amount": item["total"],
                "currency": "USD",
                "status": (
                    InvoiceStatus.PAID if paid
                    else InvoiceStatus.OVERDUE if due < today
                    else InvoiceStatus.PENDING
                ),
                "payment_date": (
                    invoice_date + timedelta(days=28) if paid else None
                ),
            })

        print(f"Writing {len(item_rows):,} line items ...")
        db.bulk_insert_mappings(PurchaseOrderItem, item_rows)

        print(f"Writing {len(performance_rows):,} performance evaluations ...")
        db.bulk_insert_mappings(VendorPerformance, performance_rows)

        print(f"Writing {len(invoice_rows):,} invoices ...")
        db.bulk_insert_mappings(Invoice, invoice_rows)

        db.commit()

        # ---- communication history -------------------------------
        build_conversations(db, late_rates, vendor_ids, procurement, supply_chain)

        # ---- contracts, certifications, compliance ---------------
        build_contracts(db, late_rates, vendor_ids, procurement, supply_chain)

        db.commit()

        print("\nDataset history loaded.")
        print(f"  purchase orders : {len(order_rows):,}")
        print(f"  performance rows: {len(performance_rows):,}")
        print(f"  invoices        : {len(invoice_rows):,}")
        print(
            "\nNext: run 'python -m services.reliability' to score every "
            "vendor, or POST /reliability/recalculate from the API."
        )

    finally:
        db.close()


def build_conversations(db, late_rates, vendor_ids, procurement, supply_chain):
    """Write message threads whose timestamps encode supplier responsiveness.

    The communication factor of the reliability score is measured from these
    rows - the gap between an internal message and the supplier's reply - so
    the score reads real timestamps rather than a stored summary figure.
    """

    existing = {
        vendor_id
        for (vendor_id,) in db.query(MessageThread.vendor_id)
        .filter(MessageThread.subject.like("%[auto]%"))
        .all()
    }

    subjects = [
        ("Delivery confirmation required", ThreadStatus.RESOLVED, "Medium"),
        ("Lead time review for next quarter", ThreadStatus.OPEN, "Medium"),
        ("Quality deviation follow-up", ThreadStatus.AWAITING_VENDOR, "High"),
        ("Invoice query on recent shipment", ThreadStatus.RESOLVED, "Low"),
        ("Capacity planning discussion", ThreadStatus.OPEN, "Medium"),
    ]

    vendor_users = {
        user.vendor_id: user
        for user in db.query(User).filter(User.role == UserRole.VENDOR).all()
    }

    threads_written = 0
    messages_written = 0

    for name, vendor_id in vendor_ids.items():
        if vendor_id in existing:
            continue

        late_rate = late_rates.get(name)

        if late_rate is None:
            continue

        # A struggling supplier gets more open threads.
        count = 3 + int(late_rate * 6)

        for index in range(min(count, len(subjects))):
            subject, status, priority = subjects[index]

            opened = datetime.now(timezone.utc) - timedelta(
                days=8 + index * 17 + int(_jitter("thread", vendor_id, index) * 40)
            )

            gap = response_hours(late_rate, ("thread", vendor_id, index))

            thread = MessageThread(
                subject=f"{subject} [auto]",
                vendor_id=vendor_id,
                created_by=procurement.id,
                status=status,
                priority=priority,
                last_message_at=opened + timedelta(hours=gap),
                created_at=opened,
            )

            db.add(thread)
            db.flush()

            db.add(
                Message(
                    thread_id=thread.id,
                    sender_id=procurement.id,
                    body=(
                        "Could you confirm the current position on this and "
                        "come back to us with a date?"
                    ),
                    is_read=True,
                    created_at=opened,
                )
            )

            responder = vendor_users.get(vendor_id)

            # Only a supplier reply counts towards the response measurement,
            # so a thread with no supplier login stays unanswered rather than
            # being closed out by an internal user.
            if status != ThreadStatus.AWAITING_VENDOR and responder:
                db.add(
                    Message(
                        thread_id=thread.id,
                        sender_id=responder.id,
                        body=(
                            "Thanks for the note - confirming we are on it "
                            "and will revert with the detail shortly."
                        ),
                        is_read=(status == ThreadStatus.RESOLVED),
                        created_at=opened + timedelta(hours=gap),
                    )
                )
                messages_written += 1

            threads_written += 1
            messages_written += 1

    db.commit()
    print(f"Communication: {threads_written} threads, {messages_written} messages")


def build_contracts(db, late_rates, vendor_ids, procurement, supply_chain):
    """Give every loaded supplier a contract, certifications and check history."""

    today = date.today()

    existing = {
        vendor_id
        for (vendor_id,) in db.query(Contract.vendor_id).all()
    }

    sequences: dict[int, int] = {}

    for (number,) in db.query(Contract.contract_number).all():
        parts = number.split("-")
        if len(parts) == 3 and parts[0] == "CT":
            try:
                sequences[int(parts[1])] = max(
                    sequences.get(int(parts[1]), 0), int(parts[2])
                )
            except ValueError:
                continue

    contract_types = [
        "Supply Agreement", "Master Agreement", "Service Level Agreement",
        "Maintenance Agreement", "Service Agreement",
    ]

    certifications = [
        ("ISO 9001 Quality Management", "Bureau Veritas"),
        ("ISO 14001 Environmental", "SGS"),
        ("ISO 45001 Occupational Health", "TUV Rheinland"),
        ("ISO/IEC 27001 Information Security", "DNV"),
    ]

    written = 0

    for name, vendor_id in vendor_ids.items():
        if vendor_id in existing:
            continue

        late_rate = late_rates.get(name)

        if late_rate is None:
            continue

        seed = _jitter("contract", vendor_id)

        # Expiry dates are deliberately spread across the lifecycle bands
        # rather than drawn uniformly: a uniform draw left the renewal window
        # empty most runs, so the expiry alerts and the "expiring soon" panels
        # had nothing real to show. Cycling the bands guarantees the register
        # always contains expired, expiring and comfortably-active contracts.
        band = written % 5

        if band == 0:
            # Already expired.
            expiry_offset = int(-160 + seed * 140)
        elif band == 1:
            # Inside the 30-day renewal notice window.
            expiry_offset = int(3 + seed * 26)
        elif band == 2:
            # Approaching, but outside the notice window.
            expiry_offset = int(45 + seed * 120)
        else:
            # Comfortably active.
            expiry_offset = int(200 + seed * 500)

        start_offset = expiry_offset - 365 - int(seed * 400)

        expiry = today + timedelta(days=expiry_offset)

        if expiry_offset < 0:
            status = ContractStatus.EXPIRED
        elif expiry_offset <= 30:
            status = ContractStatus.EXPIRING
        else:
            status = ContractStatus.ACTIVE

        # A poor delivery record makes a failed compliance check more likely.
        if late_rate > 0.38:
            compliance = "Non-Compliant"
        elif late_rate > 0.28:
            compliance = "Under Review"
        else:
            compliance = "Compliant"

        year = today.year
        sequences[year] = sequences.get(year, 0) + 1

        contract = Contract(
            contract_number=f"CT-{year}-{sequences[year]:04d}",
            vendor_id=vendor_id,
            title=f"{contract_types[written % len(contract_types)]} - {name}",
            contract_type=contract_types[written % len(contract_types)],
            start_date=today + timedelta(days=start_offset),
            expiry_date=expiry,
            contract_value=Decimal(str(round(120000 + seed * 1500000, 2))),
            currency="USD",
            auto_renew=(written % 3 == 0),
            renewal_notice_days=30,
            status=status,
            compliance_status=compliance,
            owner_id=procurement.id,
            terms=(
                "Standard commercial terms apply. Delivery penalties of 2% "
                "per week accrue on late shipments."
            ),
        )

        db.add(contract)
        db.flush()

        # Two certifications each, one of them deliberately close to expiry
        # for the supplier with the weaker record.
        for offset, (cert_name, authority) in enumerate(
            certifications[written % 2: written % 2 + 2]
        ):
            issued = today - timedelta(days=500 + offset * 200)
            validity = 1095 if late_rate < 0.35 else 620

            cert_expiry = issued + timedelta(days=validity)
            days_left = (cert_expiry - today).days

            db.add(
                VendorCertification(
                    vendor_id=vendor_id,
                    certification_name=cert_name,
                    issuing_authority=authority,
                    certificate_number=f"CERT-{vendor_id:03d}{offset}",
                    issue_date=issued,
                    expiry_date=cert_expiry,
                    status=(
                        "Expired" if days_left < 0
                        else "Expiring" if days_left <= 60
                        else "Valid"
                    ),
                )
            )

        # Six historical compliance checks per supplier. Three was too few
        # for the compliance factor to say anything: a single failure moved
        # the rate by 33 points.
        for index in range(6):
            check_seed = _jitter("check", vendor_id, index)

            # Failures become more likely as the delivery record worsens,
            # which is what ties the compliance factor to real behaviour.
            failure_chance = max(0.0, (late_rate - 0.18) * 1.6)

            if check_seed < failure_chance * 0.55:
                result = "Non-Compliant"
            elif check_seed < failure_chance:
                result = "Partial"
            else:
                result = "Compliant"

            db.add(
                ComplianceCheck(
                    vendor_id=vendor_id,
                    contract_id=contract.id,
                    check_type=[
                        "Documentation", "Delivery Terms", "Quality",
                        "Certification", "Regulatory",
                    ][(written + index) % 5],
                    check_date=today - timedelta(days=45 + index * 95),
                    result=result,
                    remarks=f"Periodic compliance review #{index + 1}",
                    checked_by=supply_chain.id,
                )
            )

        written += 1

    db.commit()
    print(f"Contracts: {written} created with certifications and check history")


def main():
    parser = argparse.ArgumentParser(
        description="Load DataCo supply-chain history into VendorIQ."
    )
    parser.add_argument("--orders", type=int, default=DEFAULT_ORDERS)
    parser.add_argument("--months", type=int, default=DEFAULT_MONTHS)
    parser.add_argument("--dataset", default=None)
    parser.add_argument(
        "--clear", action="store_true",
        help="remove previously loaded history and exit",
    )

    args = parser.parse_args()

    if args.clear:
        db = SessionLocal()
        try:
            clear_history(db)
        finally:
            db.close()
        return

    load(orders=args.orders, months=args.months, dataset_path=args.dataset)


if __name__ == "__main__":
    main()
