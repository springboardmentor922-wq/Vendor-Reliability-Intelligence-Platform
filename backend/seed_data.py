"""Idempotent demo data for VendorIQ.

Run after the Alembic database migrations have been applied.
Demo credentials use the same password for local demonstrations only.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from auth import hash_password
from database import SessionLocal

DEMO_PASSWORD = "VendorIQ@2026"

USERS = [
    ("Aarav Mehta", "admin@vendoriq.local", "administrator", None),
    ("Ananya Sharma", "procurement@vendoriq.local", "procurement_manager", None),
    ("Marcus Vance", "supplychain@vendoriq.local", "supply_chain_manager", None),
    ("Priya Nair", "finance@vendoriq.local", "finance_officer", None),
    ("David Chen", "audit@vendoriq.local", "auditor", None),
]

# Initial vendor records requested for the Contracts & Compliance workflow.
# These are normal database records, not a frontend hardcoded list; additional
# vendors can continue to be created through the existing Vendors UI.
INITIAL_VENDORS = [
    ("Tata Steel Limited", "Raw Materials Supplier"),
    ("Adani Wilmar Limited", "Raw Materials Supplier"),
    ("Siemens India", "Equipment Vendor"),
    ("TCS (Tata Consultancy Services)", "IT Vendor"),
    ("DHL Supply Chain", "Service Provider"),
    ("Blue Dart Express", "Logistics Partner"),
]

VENDOR_BLUEPRINT = [
    (
        "Asteron Industrial Systems",
        "Equipment Vendors",
        "operations@asteron.example",
        "+91 80 4000 1200",
        "Karnataka",
    ),
    (
        "BluePeak Components",
        "Raw Material Suppliers",
        "procurement@bluepeak.example",
        "+91 22 4400 2211",
        "Maharashtra",
    ),
    (
        "Northstar Logistics",
        "Logistics Partners",
        "control@northstarlogistics.example",
        "+91 33 4200 8900",
        "West Bengal",
    ),
    (
        "LumenGrid Technologies",
        "IT Vendors",
        "accounts@lumengrid.example",
        "+91 11 4900 2233",
        "Delhi",
    ),
    (
        "HarborPoint Facilities",
        "Maintenance Vendors",
        "service@harborpoint.example",
        "+91 40 4900 7771",
        "Telangana",
    ),
    (
        "CedarWorks Professional Services",
        "Service Providers",
        "hello@cedarworks.example",
        "+91 44 4300 5599",
        "Tamil Nadu",
    ),
]


def seed(db: Session):
    vendor_map = {}

    # Ensure the requested initial vendors exist without deleting or replacing
    # any existing vendors. Running the seed repeatedly is safe.
    for name, category in INITIAL_VENDORS:
        vendor = (
            db.query(models.Vendor).filter(models.Vendor.company_name == name).first()
        )
        if not vendor:
            vendor = models.Vendor(
                company_name=name,
                category=category,
                country="India",
                status="Approved",
                risk_level="Medium",
            )
            db.add(vendor)
            db.flush()
        elif vendor.category != category:
            vendor.category = category
        if not vendor.country:
            vendor.country = "India"
        vendor_map[name] = vendor

    for idx, (name, category, email, phone, country) in enumerate(VENDOR_BLUEPRINT):
        vendor = (
            db.query(models.Vendor).filter(models.Vendor.company_name == name).first()
        )
        if not vendor:
            vendor = models.Vendor(
                company_name=name,
                category=category,
                email=email,
                phone=phone,
                country=country,
                address=f"{country} Business District",
                status="Approved",
                risk_level="Low" if idx < 3 else "Medium",
            )
            db.add(vendor)
            db.flush()
        vendor_map[name] = vendor
        if not vendor.contacts:
            db.add(
                models.VendorContact(
                    vendor_id=vendor.id,
                    contact_name=[
                        "Rohan Kapoor",
                        "Maya Rao",
                        "Siddharth Iyer",
                        "Neha Menon",
                        "Arjun Patel",
                        "Ishita Bose",
                    ][idx],
                    email=email,
                    phone=phone,
                    designation="Account Manager",
                )
            )

    for name, email, role, _ in USERS:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(
                name=name,
                email=email,
                role=role,
                password_hash=hash_password(DEMO_PASSWORD),
            )
            db.add(user)
            db.flush()

    vendor_user = (
        db.query(models.User)
        .filter(models.User.email == "vendor@vendoriq.local")
        .first()
    )
    target_vendor = vendor_map["LumenGrid Technologies"]
    if not vendor_user:
        vendor_user = models.User(
            name="LumenGrid Representative",
            email="vendor@vendoriq.local",
            role="vendor",
            vendor_id=target_vendor.id,
            password_hash=hash_password(DEMO_PASSWORD),
        )
        db.add(vendor_user)
    elif vendor_user.vendor_id != target_vendor.id:
        vendor_user.vendor_id = target_vendor.id
    db.flush()

    # Operational performance records.
    perf_values = [
        ("Asteron Industrial Systems", 91, 88, 82, 90, 89, 86),
        ("BluePeak Components", 82, 93, 87, 84, 91, 88),
        ("Northstar Logistics", 76, 85, 79, 80, 78, 72),
        ("LumenGrid Technologies", 94, 90, 92, 96, 95, 93),
        ("HarborPoint Facilities", 68, 80, 75, 76, 78, 70),
        ("CedarWorks Professional Services", 86, 89, 84, 88, 86, 90),
    ]
    for name, delivery, quality, cost, comms, service, resolution in perf_values:
        vendor = vendor_map[name]
        perf = (
            db.query(models.VendorPerformance)
            .filter(models.VendorPerformance.vendor_id == vendor.id)
            .order_by(models.VendorPerformance.measured_at.desc())
            .first()
        )
        if not perf:
            score = round(
                delivery * 0.30
                + quality * 0.25
                + cost * 0.15
                + comms * 0.10
                + service * 0.10
                + resolution * 0.10,
                2,
            )
            risk = "Low" if score >= 80 else "Medium" if score >= 60 else "High"
            db.add(
                models.VendorPerformance(
                    vendor_id=vendor.id,
                    delivery_score=delivery,
                    quality_score=quality,
                    cost_score=cost,
                    communication_score=comms,
                    service_score=service,
                    issue_resolution_score=resolution,
                    reliability_score=score,
                    risk_level=risk,
                    notes="Seeded evaluation; editable from the Performance workspace.",
                )
            )
            vendor.risk_level = risk

    # Procurement requests.
    requester = (
        db.query(models.User)
        .filter(models.User.email == "procurement@vendoriq.local")
        .first()
    )
    if db.query(models.ProcurementRequest).count() == 0:
        db.add_all(
            [
                models.ProcurementRequest(
                    requested_by=requester.id,
                    description="Industrial pressure sensors — Q4 replenishment",
                    quantity=120,
                    department="Operations",
                    priority="High",
                    estimated_budget=285000,
                    justification="Safety stock threshold reached",
                    required_date=datetime.utcnow() + timedelta(days=18),
                    status="Approved",
                ),
                models.ProcurementRequest(
                    requested_by=requester.id,
                    description="Managed network switch refresh",
                    quantity=18,
                    department="Information Technology",
                    priority="Normal",
                    estimated_budget=192000,
                    justification="Campus edge hardware refresh",
                    required_date=datetime.utcnow() + timedelta(days=32),
                    status="Pending",
                ),
                models.ProcurementRequest(
                    requested_by=requester.id,
                    description="Quarterly warehouse maintenance services",
                    quantity=1,
                    department="Supply Chain",
                    priority="Normal",
                    estimated_budget=88000,
                    justification="Preventive maintenance cycle",
                    required_date=datetime.utcnow() + timedelta(days=10),
                    status="Completed",
                ),
            ]
        )
        db.flush()

    if db.query(models.PurchaseOrder).count() == 0:
        reqs = (
            db.query(models.ProcurementRequest)
            .order_by(models.ProcurementRequest.id)
            .all()
        )
        po_data = [
            ("PO-2026-0001", "Asteron Industrial Systems", "Approved", 240000, 20),
            ("PO-2026-0002", "Northstar Logistics", "Delivered", 126500, 8),
            ("PO-2026-0003", "LumenGrid Technologies", "Ordered", 186000, 22),
            ("PO-2026-0004", "BluePeak Components", "Completed", 214800, 35),
        ]
        for idx, (number, vname, status, total, days) in enumerate(po_data):
            vendor = vendor_map[vname]
            po = models.PurchaseOrder(
                po_number=number,
                vendor_id=vendor.id,
                created_by=requester.id,
                procurement_request_id=reqs[idx % len(reqs)].id,
                order_date=datetime.utcnow() - timedelta(days=days + 4),
                requested_delivery=datetime.utcnow() - timedelta(days=days),
                expected_delivery=datetime.utcnow() - timedelta(days=days - 2),
                actual_delivery=(
                    datetime.utcnow() - timedelta(days=days - 1)
                    if status in {"Delivered", "Completed"}
                    else None
                ),
                department="Operations" if idx != 2 else "Information Technology",
                payment_terms="Net 30",
                shipping_address="Vendor Receiving, Corporate Campus",
                billing_address="Finance HQ, Accounts Payable",
                remarks="Seeded demo purchase order",
                subtotal=round(total / 1.18, 2),
                tax_amount=round(total - (total / 1.18), 2),
                total_amount=total,
                status=status,
            )
            po.items = [
                models.PurchaseOrderItem(
                    product_name=[
                        "Pressure Sensor Array",
                        "Freight & Distribution",
                        "Managed Network Switches",
                        "Industrial Control Modules",
                    ][idx],
                    quantity=[120, 1, 18, 60][idx],
                    unit_price=round((total / 1.18) / [120, 1, 18, 60][idx], 2),
                    tax_percent=18,
                    total_price=round(total / 1.18, 2),
                )
            ]
            db.add(po)
        db.flush()

    if db.query(models.Contract).count() == 0:
        for idx, (vname, end_days, compliance) in enumerate(
            [
                ("Asteron Industrial Systems", 142, "Compliant"),
                ("LumenGrid Technologies", 24, "Compliant"),
                ("HarborPoint Facilities", 9, "Non-Compliant"),
                ("BluePeak Components", 210, "Pending"),
            ]
        ):
            vendor = vendor_map[vname]
            db.add(
                models.Contract(
                    vendor_id=vendor.id,
                    contract_name=f"{vname} Master Supply Agreement",
                    contract_reference=f"MSA-2026-{idx + 11:03d}",
                    start_date=datetime.utcnow() - timedelta(days=220),
                    end_date=datetime.utcnow() + timedelta(days=end_days),
                    status="Active",
                    compliance_status=compliance,
                    auto_renew=idx == 0,
                    notes="Seeded contract record",
                )
            )

    if db.query(models.Invoice).count() == 0:
        orders = db.query(models.PurchaseOrder).order_by(models.PurchaseOrder.id).all()
        for idx, po in enumerate(orders):
            db.add(
                models.Invoice(
                    invoice_number=f"INV-2026-{idx + 1:05d}",
                    purchase_order_id=po.id,
                    vendor_id=po.vendor_id,
                    amount=po.subtotal,
                    tax_amount=po.tax_amount,
                    status="Paid" if po.status == "Completed" else "Pending",
                    due_date=datetime.utcnow() + timedelta(days=12 - idx * 5),
                    paid_date=datetime.utcnow() - timedelta(days=2)
                    if po.status == "Completed"
                    else None,
                    notes="Seeded demo invoice",
                )
            )

    admin = db.query(models.User).filter(models.User.role == "administrator").first()
    if admin and db.query(models.Notification).count() == 0:
        db.add_all(
            [
                models.Notification(
                    user_id=admin.id,
                    title="Contract expiry watch",
                    message="HarborPoint Facilities has a contract expiring within 10 days.",
                    notification_type="contract_expiry",
                ),
                models.Notification(
                    user_id=admin.id,
                    title="PO approval backlog",
                    message="One procurement request is still pending approval.",
                    notification_type="procurement",
                ),
            ]
        )
    db.commit()


if __name__ == "__main__":
    with SessionLocal() as db:
        seed(db)
    print("VendorIQ demo data seeded.")
    print("Demo password:", DEMO_PASSWORD)
