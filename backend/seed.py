"""Reset the database schema and load a demo dataset.

    python seed.py            # recreate schema from schema.sql and seed
    python seed.py --keep     # seed on top of the existing schema

Every demo account uses the password below.
"""

import os
import random
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text

from database import SessionLocal, engine
from models import (
    ActivityLog,
    ComplianceCheck,
    ComplianceStatus,
    Contract,
    ContractStatus,
    Invoice,
    InvoiceStatus,
    Message,
    MessageThread,
    Notification,
    NotificationType,
    ProcurementApproval,
    ProcurementRequest,
    ProcurementStatus,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatus,
    ThreadStatus,
    User,
    UserRole,
    Vendor,
    VendorApproval,
    VendorCertification,
    VendorContact,
    VendorPerformance,
    VendorStatus
)
from security import hash_password

DEMO_PASSWORD = "VendorIQ@2026"

SCHEMA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "database",
    "schema.sql"
)

random.seed(20260902)


# =========================================================
# SCHEMA
# =========================================================

def rebuild_schema() -> None:
    with open(SCHEMA_PATH, "r", encoding="utf-8") as handle:
        ddl = handle.read()

    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
        connection.execute(text(ddl))

    print(f"Schema rebuilt from {SCHEMA_PATH}")


# =========================================================
# SEED DATA
# =========================================================

USERS = [
    ("Amara Okonkwo", "admin@vendoriq.com", UserRole.ADMINISTRATOR,
     "IT & Systems", "Platform Administrator"),
    ("David Mwangi", "procurement@vendoriq.com", UserRole.PROCUREMENT_MANAGER,
     "Procurement", "Head of Procurement"),
    ("Sofia Ramirez", "supplychain@vendoriq.com", UserRole.SUPPLY_CHAIN_MANAGER,
     "Supply Chain", "Supply Chain Manager"),
    ("Ravi Krishnan", "finance@vendoriq.com", UserRole.FINANCE_OFFICER,
     "Finance", "Finance Officer"),
    ("Helen Brandt", "auditor@vendoriq.com", UserRole.AUDITOR,
     "Risk & Compliance", "Internal Auditor"),
]

VENDORS = [
    ("Northwind Steel Works", "Raw Material Suppliers", "Approved", "Low",
     "Jonas Lindqvist", "orders@northwindsteel.com", "+46 8 555 0142",
     "Gothenburg", "Sweden", 92.4),
    ("Meridian Precision Tools", "Equipment Vendors", "Approved", "Low",
     "Clara Beaumont", "sales@meridiantools.com", "+33 1 4555 0198",
     "Lyon", "France", 88.1),
    ("Arclight Systems", "IT Vendors", "Approved", "Medium",
     "Devon Park", "accounts@arclightsys.com", "+1 415 555 0177",
     "San Jose", "United States", 79.6),
    ("Kestrel Logistics Group", "Logistics Partners", "Approved", "Medium",
     "Ana Sousa", "dispatch@kestrellog.com", "+351 21 555 0163",
     "Lisbon", "Portugal", 74.3),
    ("Vantage Facility Services", "Service Providers", "Approved", "Low",
     "Mark Ellery", "hello@vantagefs.com", "+44 20 7555 0121",
     "Manchester", "United Kingdom", 85.9),
    ("Ironclad Maintenance Co.", "Maintenance Vendors", "Approved", "High",
     "Priya Nair", "service@ironcladmc.com", "+91 22 5550 0134",
     "Pune", "India", 61.2),
    ("Cobalt Polymer Supply", "Raw Material Suppliers", "Approved", "Medium",
     "Tomas Weber", "supply@cobaltpoly.de", "+49 89 5550 0155",
     "Munich", "Germany", 81.7),
    ("Halcyon Freight Partners", "Logistics Partners", "Pending", "Medium",
     "Grace Adeyemi", "ops@halcyonfreight.com", "+234 1 555 0188",
     "Lagos", "Nigeria", None),
    ("Quantum Cloud Networks", "IT Vendors", "Pending", "Medium",
     "Ito Nakamura", "biz@quantumcloud.jp", "+81 3 5550 0116",
     "Osaka", "Japan", None),
    ("Summit Industrial Rentals", "Equipment Vendors", "Suspended", "High",
     "Lucas Ferreira", "rentals@summitind.br", "+55 11 5550 0172",
     "Sao Paulo", "Brazil", 48.5),
    ("Bright Line Consulting", "Service Providers", "Rejected", "Critical",
     "Nadia Fahmy", "contact@brightlinec.com", "+20 2 5550 0109",
     "Cairo", "Egypt", None),
]

REQUEST_TEMPLATES = [
    ("CNC tool holders BT40", "Equipment Vendors", 120, "Units", 18400,
     "Engineering", "High"),
    ("Cold-rolled steel coil, 2mm", "Raw Material Suppliers", 45, "Tonnes",
     96500, "Production", "Urgent"),
    ("Warehouse rack replacement bays", "Equipment Vendors", 30, "Units",
     22750, "Warehouse", "Medium"),
    ("Annual endpoint security licences", "IT Vendors", 450, "Licences",
     54000, "IT & Systems", "Medium"),
    ("Palletised freight, EU lane", "Logistics Partners", 220, "Shipments",
     38900, "Logistics", "High"),
    ("Industrial polymer pellets", "Raw Material Suppliers", 18, "Tonnes",
     41200, "Production", "Medium"),
    ("Quarterly HVAC servicing", "Maintenance Vendors", 4, "Visits", 9600,
     "Facilities", "Low"),
    ("Site cleaning contract renewal", "Service Providers", 12, "Months",
     28800, "Facilities", "Low"),
    ("Forklift battery replacements", "Equipment Vendors", 14, "Units", 16800,
     "Warehouse", "Medium"),
    ("Network switch refresh", "IT Vendors", 26, "Units", 31200,
     "IT & Systems", "High"),
]

CERTIFICATIONS = [
    ("ISO 9001:2015 Quality Management", "BSI Group"),
    ("ISO 14001:2015 Environmental Management", "TUV Rheinland"),
    ("ISO 45001 Occupational Health & Safety", "SGS"),
    ("ISO/IEC 27001 Information Security", "DNV"),
]


def seed() -> None:
    db = SessionLocal()

    try:
        if db.query(User).count() > 0:
            print("Database already contains users - skipping seed.")
            return

        today = date.today()

        # ---------- users ------------------------------------
        users: dict[str, User] = {}

        for name, email, role, department, title in USERS:
            user = User(
                name=name,
                email=email,
                password_hash=hash_password(DEMO_PASSWORD),
                role=role,
                phone=f"+1 555 01{random.randint(10, 99)}",
                department=department,
                job_title=title,
                is_active=True
            )
            db.add(user)
            users[role] = user

        db.flush()

        admin = users[UserRole.ADMINISTRATOR]
        procurement = users[UserRole.PROCUREMENT_MANAGER]
        supply_chain = users[UserRole.SUPPLY_CHAIN_MANAGER]
        finance = users[UserRole.FINANCE_OFFICER]

        # ---------- vendors ----------------------------------
        vendors: list[Vendor] = []

        for index, row in enumerate(VENDORS, start=1):
            (
                vendor_name, category, vendor_status, risk, contact_person,
                email, phone, city, country, score
            ) = row

            vendor = Vendor(
                vendor_code=f"VND-{index:04d}",
                vendor_name=vendor_name,
                category=category,
                contact_person=contact_person,
                email=email,
                phone=phone,
                website=f"https://www.{email.split('@')[1]}",
                address=f"{random.randint(1, 400)} Industrial Estate",
                city=city,
                country=country,
                tax_id=f"TAX{random.randint(100000, 999999)}",
                registration_number=f"REG{random.randint(100000, 999999)}",
                status=vendor_status,
                risk_level=risk,
                reliability_score=Decimal(str(score)) if score else None,
                created_by=procurement.id,
                onboarded_on=(
                    today - timedelta(days=random.randint(120, 900))
                    if vendor_status == VendorStatus.APPROVED else None
                )
            )

            if vendor_status == VendorStatus.APPROVED:
                vendor.approved_by = procurement.id
                vendor.approved_at = datetime.now(timezone.utc) - timedelta(
                    days=random.randint(30, 600)
                )
            elif vendor_status == VendorStatus.REJECTED:
                vendor.rejection_reason = (
                    "Failed financial due diligence: unresolved insolvency filing"
                )

            db.add(vendor)
            vendors.append(vendor)

        db.flush()

        # approval trail + contacts + certifications
        for vendor in vendors:
            db.add(
                VendorApproval(
                    vendor_id=vendor.id,
                    action="Submitted",
                    previous_status=None,
                    new_status=VendorStatus.PENDING,
                    performed_by=procurement.id,
                    comments="Vendor registration submitted for approval"
                )
            )

            if vendor.status == VendorStatus.APPROVED:
                db.add(
                    VendorApproval(
                        vendor_id=vendor.id,
                        action="Approved",
                        previous_status=VendorStatus.PENDING,
                        new_status=VendorStatus.APPROVED,
                        performed_by=procurement.id,
                        comments="Documentation verified, vendor onboarded"
                    )
                )
            elif vendor.status == VendorStatus.SUSPENDED:
                db.add(
                    VendorApproval(
                        vendor_id=vendor.id,
                        action="Suspended",
                        previous_status=VendorStatus.APPROVED,
                        new_status=VendorStatus.SUSPENDED,
                        performed_by=procurement.id,
                        comments="Repeated delivery failures across three orders"
                    )
                )
            elif vendor.status == VendorStatus.REJECTED:
                db.add(
                    VendorApproval(
                        vendor_id=vendor.id,
                        action="Rejected",
                        previous_status=VendorStatus.PENDING,
                        new_status=VendorStatus.REJECTED,
                        performed_by=procurement.id,
                        comments=vendor.rejection_reason
                    )
                )

            db.add(
                VendorContact(
                    vendor_id=vendor.id,
                    name=vendor.contact_person,
                    designation="Account Manager",
                    email=vendor.email,
                    phone=vendor.phone,
                    is_primary=True
                )
            )

            if vendor.status == VendorStatus.APPROVED:
                for cert_name, authority in random.sample(CERTIFICATIONS, 2):
                    issued = today - timedelta(days=random.randint(200, 900))
                    db.add(
                        VendorCertification(
                            vendor_id=vendor.id,
                            certification_name=cert_name,
                            issuing_authority=authority,
                            certificate_number=f"CERT-{random.randint(10000, 99999)}",
                            issue_date=issued,
                            expiry_date=issued + timedelta(days=1095),
                            status="Valid"
                        )
                    )

        db.flush()

        approved_vendors = [
            v for v in vendors if v.status == VendorStatus.APPROVED
        ]

        # ---------- vendor logins ----------------------------
        for vendor in approved_vendors[:3]:
            slug = vendor.vendor_name.lower().split()[0]
            db.add(
                User(
                    name=vendor.contact_person,
                    email=f"{slug}@vendor.vendoriq.com",
                    password_hash=hash_password(DEMO_PASSWORD),
                    role=UserRole.VENDOR,
                    phone=vendor.phone,
                    department="Vendor Portal",
                    job_title="Account Manager",
                    vendor_id=vendor.id,
                    is_active=True
                )
            )

        db.flush()

        # ---------- procurement requests ---------------------
        requests: list[ProcurementRequest] = []

        statuses = [
            ProcurementStatus.PENDING, ProcurementStatus.PENDING,
            ProcurementStatus.APPROVED, ProcurementStatus.APPROVED,
            ProcurementStatus.ORDERED, ProcurementStatus.ORDERED,
            ProcurementStatus.DELIVERED, ProcurementStatus.COMPLETED,
            ProcurementStatus.REJECTED, ProcurementStatus.CANCELLED
        ]

        for index, (template, request_status) in enumerate(
            zip(REQUEST_TEMPLATES, statuses), start=1
        ):
            item, category, qty, unit, cost, department, priority = template

            vendor_match = next(
                (v for v in approved_vendors if v.category == category),
                approved_vendors[0]
            )

            created = today - timedelta(days=random.randint(10, 150))

            request = ProcurementRequest(
                request_number=f"PR-{today.year}-{index:04d}",
                requested_by=random.choice([supply_chain.id, procurement.id]),
                item=item,
                description=f"{item} required for scheduled {department.lower()} work.",
                category=category,
                quantity=Decimal(qty),
                unit=unit,
                estimated_cost=Decimal(cost),
                currency="USD",
                required_date=created + timedelta(days=random.randint(20, 70)),
                priority=priority,
                department=department,
                justification=(
                    "Replenishment against the approved annual operating plan."
                ),
                status=request_status,
                assigned_vendor_id=(
                    vendor_match.id
                    if request_status not in (
                        ProcurementStatus.PENDING, ProcurementStatus.REJECTED
                    ) else None
                )
            )

            if request_status not in (
                ProcurementStatus.PENDING, ProcurementStatus.REJECTED,
                ProcurementStatus.CANCELLED
            ):
                request.approved_by = procurement.id
                request.approved_at = datetime.now(timezone.utc) - timedelta(
                    days=random.randint(5, 60)
                )

            if request_status == ProcurementStatus.REJECTED:
                request.rejection_reason = (
                    "Budget not available in the current quarter; resubmit in Q3."
                )

            db.add(request)
            requests.append(request)

        db.flush()

        for request in requests:
            db.add(
                ProcurementApproval(
                    request_id=request.id,
                    action="Submitted",
                    previous_status=None,
                    new_status=ProcurementStatus.PENDING,
                    performed_by=request.requested_by,
                    comments="Procurement request submitted for approval"
                )
            )

            if request.approved_at:
                db.add(
                    ProcurementApproval(
                        request_id=request.id,
                        action="Approved",
                        previous_status=ProcurementStatus.PENDING,
                        new_status=ProcurementStatus.APPROVED,
                        performed_by=procurement.id,
                        comments="Approved against the departmental budget"
                    )
                )

            if request.status == ProcurementStatus.REJECTED:
                db.add(
                    ProcurementApproval(
                        request_id=request.id,
                        action="Rejected",
                        previous_status=ProcurementStatus.PENDING,
                        new_status=ProcurementStatus.REJECTED,
                        performed_by=procurement.id,
                        comments=request.rejection_reason
                    )
                )

        db.flush()

        # ---------- purchase orders --------------------------
        orderable = [
            r for r in requests
            if r.status in (
                ProcurementStatus.ORDERED,
                ProcurementStatus.DELIVERED,
                ProcurementStatus.COMPLETED
            )
        ]

        po_statuses = [
            PurchaseOrderStatus.ORDERED,
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.DELIVERED,
            PurchaseOrderStatus.COMPLETED
        ]

        orders: list[PurchaseOrder] = []

        for index, request in enumerate(orderable, start=1):
            po_status = po_statuses[(index - 1) % len(po_statuses)]

            order_date = today - timedelta(days=random.randint(20, 120))
            expected = order_date + timedelta(days=random.randint(14, 45))

            unit_price = (
                Decimal(request.estimated_cost) / Decimal(request.quantity)
            ).quantize(Decimal("0.01"))

            order = PurchaseOrder(
                po_number=f"PO-{today.year}-{index:04d}",
                vendor_id=request.assigned_vendor_id,
                procurement_request_id=request.id,
                created_by=procurement.id,
                title=request.item,
                description=f"Purchase order raised against {request.request_number}.",
                order_date=order_date,
                expected_delivery=expected,
                currency="USD",
                payment_terms=random.choice(["Net 30", "Net 45", "Net 60"]),
                shipping_address="Plant 2, 14 Harbour Road, Rotterdam",
                status=po_status
            )

            if po_status in (
                PurchaseOrderStatus.DELIVERED, PurchaseOrderStatus.COMPLETED
            ):
                # Mix punctual and late deliveries so the M3 metrics have signal.
                delivered_on = expected + timedelta(
                    days=random.choice([-3, -1, 0, 2, 6])
                )

                # An order cannot already have been delivered in the future.
                # Left unclamped this opened a bucket beyond the current month
                # on every trend chart.
                if delivered_on > today:
                    order.actual_delivery = None
                    po_status = PurchaseOrderStatus.ORDERED
                    order.status = po_status
                else:
                    order.actual_delivery = delivered_on

            if po_status != PurchaseOrderStatus.PENDING:
                order.approved_by = procurement.id
                order.approved_at = datetime.now(timezone.utc) - timedelta(
                    days=random.randint(5, 90)
                )

            db.add(order)
            db.flush()

            item = PurchaseOrderItem(
                purchase_order_id=order.id,
                item_name=request.item,
                description=request.description,
                quantity=request.quantity,
                unit=request.unit,
                unit_price=unit_price,
                line_total=(Decimal(request.quantity) * unit_price)
            )
            db.add(item)

            subtotal = Decimal(request.quantity) * unit_price
            tax = (subtotal * Decimal("0.08")).quantize(Decimal("0.01"))
            shipping = Decimal(random.choice([250, 480, 620, 900]))

            order.subtotal = subtotal
            order.tax_amount = tax
            order.shipping_amount = shipping
            order.total_amount = subtotal + tax + shipping

            orders.append(order)

        db.flush()

        # ---------- invoices ----------------------------------
        for index, order in enumerate(orders, start=1):
            if order.status not in (
                PurchaseOrderStatus.DELIVERED, PurchaseOrderStatus.COMPLETED
            ):
                continue

            invoice_date = order.actual_delivery or order.expected_delivery

            db.add(
                Invoice(
                    invoice_number=f"INV-{today.year}-{index:04d}",
                    purchase_order_id=order.id,
                    vendor_id=order.vendor_id,
                    invoice_date=invoice_date,
                    due_date=invoice_date + timedelta(days=30),
                    amount=order.subtotal,
                    tax_amount=order.tax_amount,
                    total_amount=order.total_amount,
                    currency="USD",
                    status=(
                        InvoiceStatus.PAID
                        if order.status == PurchaseOrderStatus.COMPLETED
                        else InvoiceStatus.PENDING
                    ),
                    payment_date=(
                        invoice_date + timedelta(days=28)
                        if order.status == PurchaseOrderStatus.COMPLETED
                        else None
                    )
                )
            )

        db.flush()

        # ---------- contracts ---------------------------------
        contract_specs = [
            ("Supply Agreement", -700, 400, 480000, ComplianceStatus.COMPLIANT),
            ("Master Agreement", -500, 220, 1250000, ComplianceStatus.COMPLIANT),
            ("Service Level Agreement", -400, 18, 96000, ComplianceStatus.UNDER_REVIEW),
            ("Maintenance Agreement", -600, 12, 145000, ComplianceStatus.NON_COMPLIANT),
            ("Service Agreement", -300, 620, 210000, ComplianceStatus.COMPLIANT),
            ("Supply Agreement", -900, -40, 320000, ComplianceStatus.COMPLIANT),
            ("Non-Disclosure Agreement", -200, 900, None, ComplianceStatus.PENDING),
        ]

        contracts: list[Contract] = []

        for index, spec in enumerate(contract_specs, start=1):
            ctype, start_offset, expiry_offset, value, compliance = spec
            vendor = approved_vendors[(index - 1) % len(approved_vendors)]

            expiry = today + timedelta(days=expiry_offset)
            days_left = expiry_offset

            if days_left < 0:
                contract_status = ContractStatus.EXPIRED
            elif days_left <= 30:
                contract_status = ContractStatus.EXPIRING
            else:
                contract_status = ContractStatus.ACTIVE

            contract = Contract(
                contract_number=f"CT-{today.year}-{index:04d}",
                vendor_id=vendor.id,
                title=f"{ctype} - {vendor.vendor_name}",
                contract_type=ctype,
                start_date=today + timedelta(days=start_offset),
                expiry_date=expiry,
                contract_value=Decimal(value) if value else None,
                currency="USD",
                auto_renew=(index % 3 == 0),
                renewal_notice_days=30,
                status=contract_status,
                compliance_status=compliance,
                owner_id=procurement.id,
                terms=(
                    "Standard commercial terms apply. Delivery penalties of 2% "
                    "per week accrue on late shipments."
                )
            )

            db.add(contract)
            contracts.append(contract)

        db.flush()

        for contract in contracts:
            db.add(
                ComplianceCheck(
                    vendor_id=contract.vendor_id,
                    contract_id=contract.id,
                    check_type=random.choice([
                        "Documentation", "Certification", "Delivery Terms",
                        "Quality", "Regulatory"
                    ]),
                    check_date=today - timedelta(days=random.randint(10, 120)),
                    result=(
                        "Non-Compliant"
                        if contract.compliance_status
                        == ComplianceStatus.NON_COMPLIANT
                        else "Partial"
                        if contract.compliance_status
                        == ComplianceStatus.UNDER_REVIEW
                        else "Compliant"
                    ),
                    remarks="Periodic compliance review",
                    checked_by=supply_chain.id
                )
            )

        db.flush()

        # ---------- conversations -----------------------------
        thread_specs = [
            ("Delivery schedule for PO batch 3", ThreadStatus.OPEN, "High"),
            ("Revised quotation - polymer pellets", ThreadStatus.AWAITING_VENDOR,
             "Medium"),
            ("Quality deviation on last shipment", ThreadStatus.AWAITING_INTERNAL,
             "Urgent"),
            ("Contract renewal discussion", ThreadStatus.RESOLVED, "Medium"),
        ]

        conversation_bodies = [
            (
                "Could you confirm the dispatch date for the outstanding lines? "
                "Our plant window closes at the end of next week.",
                "Dispatch is booked for Tuesday. I will share the tracking "
                "reference as soon as the carrier confirms collection."
            ),
            (
                "Please send a revised quotation reflecting the updated volumes "
                "in the attached schedule.",
                "Revised pricing attached. The unit rate drops by 4% at the "
                "higher volume tier."
            ),
            (
                "Batch 4471 failed incoming inspection on surface finish. "
                "Please raise a corrective action report.",
                "Acknowledged. Our quality team is investigating and we will "
                "revert with the CAR within 48 hours."
            ),
            (
                "The current agreement expires shortly - can we start renewal "
                "discussions this month?",
                "Yes, happy to. I will circulate our proposed terms before "
                "Friday."
            ),
        ]

        for index, (subject, thread_status, priority) in enumerate(thread_specs):
            vendor = approved_vendors[index % len(approved_vendors)]
            outbound, inbound = conversation_bodies[index]

            vendor_user = (
                db.query(User)
                .filter(User.vendor_id == vendor.id)
                .first()
            )

            last_at = datetime.now(timezone.utc) - timedelta(
                days=random.randint(1, 20)
            )

            thread = MessageThread(
                subject=subject,
                vendor_id=vendor.id,
                purchase_order_id=(
                    orders[index].id if index < len(orders) else None
                ),
                created_by=procurement.id,
                status=thread_status,
                priority=priority,
                last_message_at=last_at
            )

            db.add(thread)
            db.flush()

            db.add(
                Message(
                    thread_id=thread.id,
                    sender_id=procurement.id,
                    body=outbound,
                    is_read=True
                )
            )

            db.add(
                Message(
                    thread_id=thread.id,
                    sender_id=vendor_user.id if vendor_user else supply_chain.id,
                    body=inbound,
                    is_read=(thread_status != ThreadStatus.AWAITING_INTERNAL)
                )
            )

        db.flush()

        # ---------- performance records -----------------------
        for order in orders:
            if order.status not in (
                PurchaseOrderStatus.DELIVERED, PurchaseOrderStatus.COMPLETED
            ):
                continue

            late_days = max(
                (order.actual_delivery - order.expected_delivery).days, 0
            )
            on_time = Decimal("100") if late_days == 0 else Decimal("0")

            db.add(
                VendorPerformance(
                    vendor_id=order.vendor_id,
                    purchase_order_id=order.id,
                    evaluation_date=order.actual_delivery,
                    on_time_delivery=on_time,
                    delayed_delivery=Decimal("100") - on_time,
                    quality_rating=Decimal(str(round(random.uniform(3.2, 5.0), 2))),
                    response_time=Decimal(str(round(random.uniform(1.5, 26.0), 2))),
                    issue_resolution_time=Decimal(
                        str(round(random.uniform(4.0, 72.0), 2))
                    ),
                    order_completion_rate=Decimal(
                        str(round(random.uniform(88.0, 100.0), 2))
                    ),
                    service_rating=Decimal(str(round(random.uniform(3.0, 5.0), 2))),
                    remarks=(
                        f"Delivered {late_days} day(s) late"
                        if late_days else "Delivered on schedule"
                    )
                )
            )

        db.flush()

        # ---------- notifications ------------------------------
        pending_vendors = [
            v for v in vendors if v.status == VendorStatus.PENDING
        ]

        for vendor in pending_vendors:
            for recipient in (admin, procurement):
                db.add(
                    Notification(
                        user_id=recipient.id,
                        notification_type=NotificationType.VENDOR_APPROVAL,
                        title="New vendor awaiting approval",
                        message=(
                            f"{vendor.vendor_name} ({vendor.vendor_code}) has "
                            f"been registered and is waiting for approval."
                        ),
                        link=f"/vendors/{vendor.id}",
                        priority="High"
                    )
                )

        for contract in contracts:
            days_left = (contract.expiry_date - today).days

            if 0 <= days_left <= 30:
                for recipient in (admin, procurement):
                    db.add(
                        Notification(
                            user_id=recipient.id,
                            notification_type=NotificationType.CONTRACT_EXPIRY,
                            title="Contract expiring soon",
                            message=(
                                f"{contract.contract_number} expires in "
                                f"{days_left} day(s) on {contract.expiry_date}."
                            ),
                            link=f"/contracts/{contract.id}",
                            priority="High" if days_left <= 7 else "Medium"
                        )
                    )

        db.add(
            Notification(
                user_id=finance.id,
                notification_type=NotificationType.PROCUREMENT,
                title="Invoices awaiting approval",
                message="There are outstanding vendor invoices pending review.",
                link="/invoices",
                priority="Medium"
            )
        )

        # ---------- activity log -------------------------------
        seeded_events = [
            (procurement.id, "Vendor", "Registered", "Vendor onboarding batch loaded"),
            (procurement.id, "ProcurementRequest", "Created", "Quarterly requests raised"),
            (procurement.id, "PurchaseOrder", "Created", "Purchase orders issued to suppliers"),
            (supply_chain.id, "Contract", "Compliance Check", "Periodic compliance reviews completed"),
            (admin.id, "User", "Created", "Demo accounts provisioned")
        ]

        for user_id, entity, action, description in seeded_events:
            db.add(
                ActivityLog(
                    user_id=user_id,
                    entity_type=entity,
                    entity_id=None,
                    action=action,
                    description=description
                )
            )

        db.commit()

        print("\nDemo data loaded.")
        print(f"  users        : {db.query(User).count()}")
        print(f"  vendors      : {db.query(Vendor).count()}")
        print(f"  requests     : {db.query(ProcurementRequest).count()}")
        print(f"  orders       : {db.query(PurchaseOrder).count()}")
        print(f"  invoices     : {db.query(Invoice).count()}")
        print(f"  contracts    : {db.query(Contract).count()}")
        print(f"  threads      : {db.query(MessageThread).count()}")
        print(f"  notifications: {db.query(Notification).count()}")
        print(f"\nAll demo accounts use the password: {DEMO_PASSWORD}")

        for name, email, role, _, _ in USERS:
            print(f"  {role:<22} {email}")

        for user in db.query(User).filter(User.role == UserRole.VENDOR).all():
            print(f"  {'Vendor':<22} {user.email}")

    finally:
        db.close()


if __name__ == "__main__":
    if "--keep" not in sys.argv:
        rebuild_schema()

    seed()
