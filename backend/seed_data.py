"""Seed sample app data so MS3 dashboards/reports have content.

Creates (only if the respective tables are empty):
  - a handful of vendors
  - vendor performance records
  - contracts (some Active and expiring soon, some non-compliant)
  - a few purchase orders + procurement requests
  - a couple of vendor contacts

Run:  .\\venv\\Scripts\\python.exe seed_data.py
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

import models
from database import SessionLocal
from auth import hash_password

USERS = [
    {"name": "System Administrator", "email": "admin@example.com", "password": "admin123", "role": "admin", "vendor_id": None},
    {"name": "Ananya Sharma", "email": "procurement@example.com", "password": "admin123", "role": "procurement_manager", "vendor_id": None},
    {"name": "Marcus Vance", "email": "scm@example.com", "password": "admin123", "role": "supply_chain_manager", "vendor_id": None},
    {"name": "TechNova Rep", "email": "vendor@example.com", "password": "admin123", "role": "vendor", "vendor_id": 1},
    {"name": "Sarah Jenkins", "email": "finance@example.com", "password": "admin123", "role": "finance_officer", "vendor_id": None},
    {"name": "David Chen", "email": "auditor@example.com", "password": "admin123", "role": "auditor", "vendor_id": None},
    {"name": "Test User", "email": "test@example.com", "password": "test123", "role": "user", "vendor_id": None},
]

VENDORS = [
    {
        "company_name": "GreenTech Components Ltd",
        "category": "Raw Material Suppliers",
        "email": "sales@greentech.example",
        "phone": "+1-555-0101",
        "address": "12 Industrial Park, Austin TX",
    },
    {
        "company_name": "Nova Logistics Partners",
        "category": "Logistics Partners",
        "email": "ops@novalog.example",
        "phone": "+1-555-0102",
        "address": "88 Harbor Blvd, Long Beach CA",
    },
    {
        "company_name": "Precision IT Solutions",
        "category": "IT Vendors",
        "email": "hello@precisionit.example",
        "phone": "+1-555-0103",
        "address": "5 Tech Plaza, San Jose CA",
    },
    {
        "company_name": "CoreEquipment Manufacturing",
        "category": "Equipment Vendors",
        "email": "orders@coreeq.example",
        "phone": "+1-555-0104",
        "address": "300 Maker St, Detroit MI",
    },
    {
        "company_name": "ProServe Facilities LLC",
        "category": "Service Providers",
        "email": "info@proserve.example",
        "phone": "+1-555-0105",
        "address": "77 Service Lane, Chicago IL",
    },
]


def seed(db: Session) -> dict:
    created = {
        "users": 0, "vendors": 0, "performance": 0, "contracts": 0,
        "purchase_orders": 0, "requests": 0, "contacts": 0,
        "invoices": 0, "communications": 0, "audit_logs": 0
    }

    # 1. Seed Users (all 6 roles)
    for u in USERS:
        existing = db.query(models.User).filter(models.User.email == u["email"]).first()
        if not existing:
            new_u = models.User(
                name=u["name"],
                email=u["email"],
                password_hash=hash_password(u["password"]),
                role=u["role"],
                vendor_id=u["vendor_id"],
            )
            db.add(new_u)
            created["users"] += 1
    db.flush()

    # 2. Seed Vendors
    for i, v in enumerate(VENDORS):
        existing = db.query(models.Vendor).filter(
            models.Vendor.company_name == v["company_name"]).first()
        if existing:
            continue
        vendor = models.Vendor(
            company_name=v["company_name"],
            category=v["category"],
            email=v["email"],
            phone=v["phone"],
            address=v["address"],
            status="Approved",
        )
        db.add(vendor)
        db.flush()
        created["vendors"] += 1

        # Performance record with varied reliability profiles
        scores = [
            (86, 90, 80),
            (64, 72, 75),
            (92, 88, 85),
            (55, 60, 70),
            (78, 82, 76),
        ][i % 5]
        delivery, quality, cost = scores
        reliability = delivery * 0.4 + quality * 0.4 + cost * 0.2
        risk = "Low" if reliability >= 80 else (
            "Medium" if reliability >= 60 else "High")
        db.add(models.VendorPerformance(
            vendor_id=vendor.id,
            delivery_score=delivery,
            quality_score=quality,
            cost_score=cost,
            reliability_score=round(reliability, 2),
            risk_level=risk,
        ))
        created["performance"] += 1

        # Contact
        db.add(models.VendorContact(
            vendor_id=vendor.id,
            contact_name=f"{v['company_name'].split()[0]} Rep",
            email=v["email"],
            phone=v["phone"],
            designation="Account Manager",
        ))
        created["contacts"] += 1
    db.flush()

    # Link vendor user to first vendor
    vendor_user = db.query(models.User).filter(models.User.email == "vendor@example.com").first()
    first_vendor = db.query(models.Vendor).first()
    if vendor_user and first_vendor and not vendor_user.vendor_id:
        vendor_user.vendor_id = first_vendor.id
        db.flush()

    # 3. Contracts
    vendors = db.query(models.Vendor).all()
    now = datetime.now()
    for i, v in enumerate(vendors):
        if db.query(models.Contract).filter(models.Contract.vendor_id == v.id).count() == 0:
            if i == 0:
                end = now + timedelta(days=25)          # expiring < 30d
                compliance = "Compliant"
            elif i == 1:
                end = now + timedelta(days=70)          # expiring < 90d
                compliance = "Non-Compliant"
            elif i in (2, 4):
                end = now + timedelta(days=200)
                compliance = "Compliant"
            else:
                end = now + timedelta(days=160)         # High-risk vendor
                compliance = "Compliant"
            db.add(models.Contract(
                vendor_id=v.id,
                contract_name=f"Master Supply Agreement - {v.company_name}",
                start_date=now - timedelta(days=365),
                end_date=end,
                status="Active",
                compliance_status=compliance,
            ))
            created["contracts"] += 1
    db.flush()

    # 4. Procurement Requests
    if db.query(models.ProcurementRequest).count() == 0:
        for label, qty, dept in [
            ("Laptops for IT Team (Dell Latitude 5440)", 10, "Information Technology"),
            ("Steel bolts batch & fasteners", 5000, "Operations"),
            ("Server rack cooling units", 12, "Infrastructure"),
            ("Packaging cartons & eco-wraps", 20000, "Supply Chain"),
        ]:
            db.add(models.ProcurementRequest(
                requested_by=1,
                description=label,
                quantity=qty,
                department=dept,
                required_date=now + timedelta(days=20),
                status="Approved",
            ))
            created["requests"] += 1
        db.flush()

    # 5. Purchase Orders with Line Items
    if db.query(models.PurchaseOrder).count() == 0 and vendors:
        po_samples = [
            ("PO-2026-0001", vendors[0].id, "Information Technology", 804760.0, 682000.0, 122760.0, "Approved", [
                ("Laptop - Dell Latitude 5440", 10, 65000.0, 18.0, 767000.0),
                ("Wireless Mouse", 10, 1200.0, 18.0, 14160.0),
                ("Laptop Bag", 10, 2000.0, 18.0, 23600.0),
            ]),
            ("PO-2026-0002", vendors[1].id if len(vendors) > 1 else vendors[0].id, "Logistics", 15400.0, 13050.8, 2349.2, "Ordered", [
                ("Express Freight Pallet Shipment", 2, 6525.4, 18.0, 15400.0),
            ]),
            ("PO-2026-0003", vendors[2].id if len(vendors) > 2 else vendors[0].id, "Infrastructure", 45000.0, 38135.6, 6864.4, "Completed", [
                ("Cloud Security Appliance Node", 3, 12711.87, 18.0, 45000.0),
            ]),
        ]

        for po_num, vid, dept, tot, sub, tax, status, items in po_samples:
            po = models.PurchaseOrder(
                po_number=po_num,
                vendor_id=vid,
                created_by=1,
                expected_delivery=now + timedelta(days=12),
                department=dept,
                payment_terms="Net 30",
                shipping_address="Tech Park Campus, Tower B, Level 4",
                billing_address="Finance Dept, Corp HQ, Suite 100",
                remarks="Priority delivery required for new quarter deployment.",
                subtotal=sub,
                tax_amount=tax,
                total_amount=tot,
                status=status,
            )
            db.add(po)
            db.flush()
            created["purchase_orders"] += 1

            for iname, iqty, iprice, itax, itot in items:
                db.add(models.PurchaseOrderItem(
                    purchase_order_id=po.id,
                    product_name=iname,
                    quantity=iqty,
                    unit_price=iprice,
                    tax_percent=itax,
                    total_price=itot,
                ))

            # Create associated invoice for the PO
            inv_status = "Paid" if status == "Completed" else ("Pending" if status == "Approved" else "Pending")
            db.add(models.Invoice(
                invoice_number=f"INV-2026-{po.id:04d}",
                purchase_order_id=po.id,
                vendor_id=vid,
                amount=sub,
                tax_amount=tax,
                status=inv_status,
                due_date=now + timedelta(days=30),
                paid_date=now - timedelta(days=2) if inv_status == "Paid" else None,
                notes=f"Invoice auto-generated for {po_num}",
            ))
            created["invoices"] += 1
        db.flush()

    # 6. Communications & Messages
    if db.query(models.Communication).count() == 0 and vendors:
        admin_u = db.query(models.User).filter(models.User.email == "admin@example.com").first()
        proc_u = db.query(models.User).filter(models.User.email == "procurement@example.com").first()
        sender_id = proc_u.id if proc_u else (admin_u.id if admin_u else 1)

        db.add(models.Communication(
            sender_id=sender_id,
            vendor_id=vendors[0].id,
            subject="Delivery Schedule for PO-2026-0001",
            message="Please confirm the expected delivery timeline for Dell Latitude laptops batch.",
        ))
        db.add(models.Communication(
            sender_id=sender_id,
            vendor_id=vendors[0].id,
            subject="Re: Delivery Schedule for PO-2026-0001",
            message="Confirmed! All 10 units are packaged and will ship via Nova Logistics on Monday.",
        ))
        if len(vendors) > 1:
            db.add(models.Communication(
                sender_id=sender_id,
                vendor_id=vendors[1].id,
                subject="SLA Compliance Inquiry",
                message="Reviewing recent transit times for Long Beach logistics hub.",
            ))
        created["communications"] += 3
        db.flush()

    # 7. Audit Logs
    if db.query(models.AuditLog).count() == 0:
        admin_u = db.query(models.User).filter(models.User.email == "admin@example.com").first()
        uid = admin_u.id if admin_u else 1

        db.add(models.AuditLog(
            user_id=uid,
            action="SYSTEM_INIT",
            entity_type="System",
            entity_id=1,
            details="Initialized Vendor Reliability Platform with Milestone 1-3 modules.",
        ))
        db.add(models.AuditLog(
            user_id=uid,
            action="APPROVE_VENDOR",
            entity_type="Vendor",
            entity_id=1,
            details="Approved vendor registration for GreenTech Components Ltd.",
        ))
        db.add(models.AuditLog(
            user_id=uid,
            action="CREATE_PO",
            entity_type="PurchaseOrder",
            entity_id=1,
            details="Generated PO-2026-0001 for $804,760.00 with 3 line items.",
        ))
        created["audit_logs"] += 3
        db.flush()

    db.commit()
    return created


if __name__ == "__main__":
    with SessionLocal() as session:
        result = seed(session)
    print("Seeded successfully:", result)