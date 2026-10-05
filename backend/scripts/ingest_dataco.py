import os
import sys
import csv
from datetime import date, timedelta, datetime
import random

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal, engine, Base
from app.models.user import User
from app.models.vendor import Vendor
from app.models.purchase_order import PurchaseOrder
from app.models.contract import Contract
from app.models.invoice import Invoice
from app.models.notification import Notification
from app.core import security

DATASET_PATH = os.path.join(backend_dir, "..", "data", "DataCoSupplyChainDataset.csv")

SEED_USERS = [
    {
        "email": "procurement@vendoriq.com",
        "password": "procure123",
        "full_name": "David Miller",
        "role": "Procurement Manager"
    },
    {
        "email": "vendor@vendoriq.com",
        "password": "vendor123",
        "full_name": "Apex Logistics Partner",
        "role": "Vendor"
    },
    {
        "email": "apex@vendoriq.com",
        "password": "vendor123",
        "full_name": "Marcus Sterling (Apex Logistics)",
        "role": "Vendor"
    },
    {
        "email": "coretech@vendoriq.com",
        "password": "vendor123",
        "full_name": "Alex Rivera (CoreTech Systems)",
        "role": "Vendor"
    },
    {
        "email": "global@vendoriq.com",
        "password": "vendor123",
        "full_name": "David K. Vance (Global Materials)",
        "role": "Vendor"
    },
    {
        "email": "precision@vendoriq.com",
        "password": "vendor123",
        "full_name": "Helena Brandt (Precision Equipment)",
        "role": "Vendor"
    },
    {
        "email": "vanguard@vendoriq.com",
        "password": "vendor123",
        "full_name": "Rajesh Nair (Vanguard Solutions)",
        "role": "Vendor"
    },
    {
        "email": "alliance@vendoriq.com",
        "password": "vendor123",
        "full_name": "Carl Jenkins (Alliance Facility)",
        "role": "Vendor"
    },
    {
        "email": "supplychain@vendoriq.com",
        "password": "supply123",
        "full_name": "Elena Rostova",
        "role": "Supply Chain Manager"
    },
    {
        "email": "finance@vendoriq.com",
        "password": "finance123",
        "full_name": "Robert Chen",
        "role": "Finance Officer"
    },
    {
        "email": "auditor@vendoriq.com",
        "password": "auditor123",
        "full_name": "Marcus Vance",
        "role": "Auditor"
    },
    {
        "email": "admin@vendoriq.com",
        "password": "admin123",
        "full_name": "Sarah Jenkins",
        "role": "Administrator"
    }
]

VENDORS_SEED = [
    {
        "company_name": "Apex Logistics & Supply Co.",
        "contact_name": "Marcus Sterling",
        "email": "apex@vendoriq.com",
        "phone": "+1 (555) 234-5678",
        "address": "100 Logistics Blvd, Chicago, IL",
        "category": "Logistics Partners",
        "status": "Approved",
        "tax_id": "US-EIN-44910284",
        "country": "United States",
        "city": "Chicago",
        "payment_terms": "Net 30",
        "bank_account": "CHASE-US-99104821",
        "certifications": "ISO 9001, C-TPAT Tier 2, SmartWay Transport Partner",
        "website": "https://apexlogistics-supply.com",
        "risk_tier": "Medium Risk",
        "reliability_score": 75.0,
        "delivery_accuracy": 60.0,
        "response_time": 2.2
    },
    {
        "company_name": "CoreTech Electronic Systems",
        "contact_name": "Alex Rivera",
        "email": "coretech@vendoriq.com",
        "phone": "+1 (555) 876-5432",
        "address": "450 Tech Way, San Jose, CA",
        "category": "IT Vendors",
        "status": "Approved",
        "tax_id": "US-EIN-78219043",
        "country": "United States",
        "city": "San Jose",
        "payment_terms": "Net 45",
        "bank_account": "SVB-US-44109284",
        "certifications": "ISO 27001, SOC 2 Type II, RoHS Compliant",
        "website": "https://coretech.io",
        "risk_tier": "Medium Risk",
        "reliability_score": 72.0,
        "delivery_accuracy": 52.0,
        "response_time": 2.4
    },
    {
        "company_name": "Global Industrial Raw Materials Corp",
        "contact_name": "David K. Vance",
        "email": "global@vendoriq.com",
        "phone": "+1 (555) 345-9988",
        "address": "880 Foundry Rd, Pittsburgh, PA",
        "category": "Raw Material Suppliers",
        "status": "Approved",
        "tax_id": "US-EIN-22910492",
        "country": "United States",
        "city": "Pittsburgh",
        "payment_terms": "Net 60",
        "bank_account": "PNC-US-33810294",
        "certifications": "ISO 9001, ISO 14001 Environmental, ASTM Certified",
        "website": "https://globalindustrial-materials.com",
        "risk_tier": "Medium Risk",
        "reliability_score": 76.0,
        "delivery_accuracy": 55.0,
        "response_time": 2.4
    },
    {
        "company_name": "Precision Heavy Equipment Ltd",
        "contact_name": "Helena Brandt",
        "email": "precision@vendoriq.com",
        "phone": "+1 (555) 432-1098",
        "address": "12 Industriestrasse, Stuttgart, DE",
        "category": "Equipment Vendors",
        "status": "Approved",
        "tax_id": "DE-VAT-119402941",
        "country": "Germany",
        "city": "Stuttgart",
        "payment_terms": "Net 45",
        "bank_account": "DEUT-DE-8821039402",
        "certifications": "CE Conformity, DIN EN ISO 9001, TÜV Rheinland",
        "website": "https://precisionequip.de",
        "risk_tier": "High Risk",
        "reliability_score": 67.0,
        "delivery_accuracy": 48.0,
        "response_time": 2.3
    },
    {
        "company_name": "Vanguard Enterprise Solutions",
        "contact_name": "Rajesh Nair",
        "email": "vanguard@vendoriq.com",
        "phone": "+1 (555) 678-4321",
        "address": "77 Cyber Park, Bangalore, IN",
        "category": "Service Providers",
        "status": "Approved",
        "tax_id": "IN-GST-29AABCU9603R1ZM",
        "country": "India",
        "city": "Bangalore",
        "payment_terms": "Net 30",
        "bank_account": "HDFC-IN-9941029481",
        "certifications": "CMMI Level 5, ISO 20000-1, ISO 27001",
        "website": "https://vanguard-enterprise.in",
        "risk_tier": "Medium Risk",
        "reliability_score": 75.0,
        "delivery_accuracy": 50.0,
        "response_time": 2.4
    },
    {
        "company_name": "Alliance Facility & Maintenance",
        "contact_name": "Carl Jenkins",
        "email": "alliance@vendoriq.com",
        "phone": "+1 (555) 901-2345",
        "address": "500 Main St, Dallas, TX",
        "category": "Maintenance Vendors",
        "status": "Approved",
        "tax_id": "US-EIN-99210491",
        "country": "United States",
        "city": "Dallas",
        "payment_terms": "Due Upon Receipt",
        "bank_account": "BOA-US-1029481029",
        "certifications": "OSHA Safety Certified, EPA Lead-Safe",
        "website": "https://alliancefacility.com",
        "risk_tier": "Medium Risk",
        "reliability_score": 76.0,
        "delivery_accuracy": 58.0,
        "response_time": 2.2
    }
]

def ingest_dataco_database():
    print("Step 0: Dropping and Recreating Database Tables with New Schema...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    print("Step 1: Seeding Users for All 6 RBAC Roles...")
    for u_data in SEED_USERS:
        existing = db.query(User).filter(User.email == u_data["email"]).first()
        if not existing:
            user = User(
                email=u_data["email"],
                hashed_password=security.get_password_hash(u_data["password"]),
                full_name=u_data["full_name"],
                role=u_data["role"],
                is_active=True
            )
            db.add(user)
    db.commit()

    print("Step 2: Seeding Authenticated Vendors Across Categories...")
    vendor_map = {}
    for v_data in VENDORS_SEED:
        v = db.query(Vendor).filter(Vendor.company_name == v_data["company_name"]).first()
        if not v:
            v = Vendor(**v_data)
            db.add(v)
            db.commit()
            db.refresh(v)
        else:
            for k, val in v_data.items():
                setattr(v, k, val)
            db.commit()
            db.refresh(v)
        vendor_map[v.category] = v.id
        vendor_map[v.company_name] = v.id

    apex_id = vendor_map.get("Apex Logistics & Supply Co.")
    coretech_id = vendor_map.get("CoreTech Electronic Systems")
    global_id = vendor_map.get("Global Industrial Raw Materials Corp")
    equip_id = vendor_map.get("Precision Heavy Equipment Ltd")
    vanguard_id = vendor_map.get("Vanguard Enterprise Solutions")
    maintenance_id = vendor_map.get("Alliance Facility & Maintenance")

    print("Step 3: Seeding SLA Contracts...")
    contracts_seed = [
        {
            "vendor_id": apex_id,
            "contract_number": "CNT-2026-001",
            "title": "Global Freight Forwarding & Logistics SLA",
            "start_date": date.today() - timedelta(days=120),
            "end_date": date.today() + timedelta(days=245),
            "value": 350000.0,
            "compliance_status": "Compliant"
        },
        {
            "vendor_id": coretech_id,
            "contract_number": "CNT-2026-002",
            "title": "Enterprise Cloud Hardware & Microelectronics SLA",
            "start_date": date.today() - timedelta(days=60),
            "end_date": date.today() + timedelta(days=305),
            "value": 180000.0,
            "compliance_status": "Compliant"
        },
        {
            "vendor_id": global_id,
            "contract_number": "CNT-2026-003",
            "title": "Raw Materials Strategic Supply Framework Agreement",
            "start_date": date.today() - timedelta(days=200),
            "end_date": date.today() + timedelta(days=165),
            "value": 520000.0,
            "compliance_status": "Compliant"
        },
        {
            "vendor_id": equip_id,
            "contract_number": "CNT-2026-004",
            "title": "Machinery Leasing & Maintenance SLA",
            "start_date": date.today() - timedelta(days=330),
            "end_date": date.today() - timedelta(days=15),
            "value": 95000.0,
            "compliance_status": "Expired"
        },
        {
            "vendor_id": vanguard_id,
            "contract_number": "CNT-2026-005",
            "title": "Enterprise Cloud Integration & Managed IT Services SLA",
            "start_date": date.today() - timedelta(days=90),
            "end_date": date.today() + timedelta(days=275),
            "value": 290000.0,
            "compliance_status": "Compliant"
        },
        {
            "vendor_id": maintenance_id,
            "contract_number": "CNT-2026-006",
            "title": "Comprehensive Facility Operations & Preventative Maintenance SLA",
            "start_date": date.today() - timedelta(days=150),
            "end_date": date.today() + timedelta(days=215),
            "value": 140000.0,
            "compliance_status": "Compliant"
        }
    ]
    for c_data in contracts_seed:
        c = db.query(Contract).filter(Contract.contract_number == c_data["contract_number"]).first()
        if not c:
            c = Contract(**c_data)
            db.add(c)
    db.commit()

    print("Step 4: Reading and Sampling DataCo Supply Chain Records...")
    # Read rows from DataCoSupplyChainDataset.csv if available
    dataco_orders = []
    if os.path.exists(DATASET_PATH):
        try:
            with open(DATASET_PATH, mode="r", encoding="latin-1") as f:
                reader = csv.DictReader(f)
                count = 0
                for row in reader:
                    dataco_orders.append(row)
                    count += 1
                    if count >= 100:
                        break
            print(f"Loaded {len(dataco_orders)} actual supply chain records from DataCo dataset.")
        except Exception as e:
            print(f"Notice reading DataCo CSV: {e}")

    print("Step 5: Seeding Multi-Stage Purchase Orders Across Workflow...")
    # Clear existing sample orders to ensure fresh, accurate state
    db.query(Invoice).delete()
    db.query(PurchaseOrder).delete()
    db.commit()

    # Create realistic orders across all 6 stages of the procurement lifecycle
    sample_orders = [
        # Stage 1: Pending (Requisition created by Procurement Manager)
        {
            "vendor_id": apex_id,
            "order_number": "PO-2026-101",
            "title": "Interstate Freight Transport - Q3 Priority Line",
            "total_amount": 24500.00,
            "status": "Pending",
            "department": "Supply Chain & Logistics",
            "shipping_mode": "First Class",
            "destination_country": "United States",
            "destination_city": "Chicago",
            "items_count": 50,
            "unit_price": 490.00,
            "product_category": "Logistics & Freight",
            "priority": "High",
            "notes": "Temperature-controlled priority corridor. Dock gate 4 handling.",
            "expected_delivery_date": date.today() + timedelta(days=12),
            "actual_delivery_date": None,
            "quality_rating": None,
            "response_time_hours": 2.1
        },
        # Stage 2: Approved (Approved by Procurement / Admin, awaiting Vendor Dispatch)
        {
            "vendor_id": apex_id,
            "order_number": "PO-2026-102",
            "title": "Express Fleet Logistics - Southern Corridor",
            "total_amount": 18200.00,
            "status": "Approved",
            "department": "Supply Chain & Logistics",
            "shipping_mode": "Second Class",
            "destination_country": "United States",
            "destination_city": "Atlanta",
            "items_count": 40,
            "unit_price": 455.00,
            "product_category": "Logistics & Freight",
            "priority": "Standard",
            "notes": "Regional distribution hubs delivery.",
            "expected_delivery_date": date.today() + timedelta(days=8),
            "actual_delivery_date": None,
            "quality_rating": None,
            "response_time_hours": 1.9
        },
        # Stage 3: Ordered (Dispatched by Vendor with carrier & tracking #, in transit to dock)
        {
            "vendor_id": coretech_id,
            "order_number": "PO-2026-103",
            "title": "Server Chassis Components & Processing Units",
            "total_amount": 34800.00,
            "status": "Ordered",
            "department": "Technology",
            "shipping_mode": "Standard Class",
            "destination_country": "United States",
            "destination_city": "San Jose",
            "items_count": 120,
            "unit_price": 290.00,
            "product_category": "Technology Hardware",
            "priority": "Urgent",
            "notes": "ESD sensitive microelectronics. Anti-static packaging required.",
            "expected_delivery_date": date.today() + timedelta(days=3),
            "actual_delivery_date": None,
            "carrier_name": "FedEx Freight Express",
            "tracking_number": "TRK-FDX-994821",
            "dispatch_date": date.today() - timedelta(days=2),
            "quality_rating": None,
            "response_time_hours": 2.5
        },
        # Stage 4: Delivered (Received at dock, QA score logged by Supply Chain Manager, Invoice submitted by Vendor)
        {
            "vendor_id": apex_id,
            "order_number": "PO-2026-104",
            "title": "Bulk Distribution Freight - Central Hub",
            "total_amount": 42000.00,
            "status": "Delivered",
            "department": "Supply Chain & Logistics",
            "shipping_mode": "First Class",
            "destination_country": "United States",
            "destination_city": "Dallas",
            "items_count": 80,
            "unit_price": 525.00,
            "product_category": "Logistics & Freight",
            "priority": "High",
            "notes": "Direct depot delivery. Palletized manifest match verified.",
            "expected_delivery_date": date.today() - timedelta(days=1),
            "actual_delivery_date": date.today() - timedelta(days=1),
            "carrier_name": "Apex Direct Logistics",
            "tracking_number": "APX-EXP-772109",
            "dispatch_date": date.today() - timedelta(days=5),
            "quality_rating": 4.9,
            "qa_notes": "All crates inspected with zero transit discrepancies. 100% manifest match.",
            "invoice_number": "INV-2026-0881",
            "invoice_amount": 42000.00,
            "invoice_status": "Submitted",
            "response_time_hours": 1.7
        },
        # Stage 5: Completed (3-Way Match cleared and payment authorized by Finance Officer)
        {
            "vendor_id": global_id,
            "order_number": "PO-2026-105",
            "title": "Precision Grade Steel Billets - Batch 14",
            "total_amount": 68000.00,
            "status": "Completed",
            "department": "Raw Materials & Foundry",
            "shipping_mode": "Standard Class",
            "destination_country": "United States",
            "destination_city": "Pittsburgh",
            "items_count": 200,
            "unit_price": 340.00,
            "product_category": "Raw Materials",
            "priority": "Standard",
            "notes": "High tensile strength structural steel.",
            "expected_delivery_date": date.today() - timedelta(days=15),
            "actual_delivery_date": date.today() - timedelta(days=16),
            "carrier_name": "Norfolk Southern Rail",
            "tracking_number": "NSR-CAR-441029",
            "dispatch_date": date.today() - timedelta(days=22),
            "quality_rating": 4.8,
            "qa_notes": "Metallurgical test passed. Yield strength compliant with ISO 9001.",
            "invoice_number": "INV-2026-0712",
            "invoice_amount": 68000.00,
            "invoice_status": "Paid",
            "payment_date": date.today() - timedelta(days=10),
            "payment_notes": "3-way match verified against dock inspection. Paid via corporate wire.",
            "response_time_hours": 2.2
        },
        # Stage 6 / Historical completed order from DataCo
        {
            "vendor_id": apex_id,
            "order_number": "PO-2026-106",
            "title": "Q1 Priority Logistics Operations",
            "total_amount": 51200.00,
            "status": "Completed",
            "department": "Supply Chain & Logistics",
            "shipping_mode": "Same Day",
            "destination_country": "United States",
            "destination_city": "Chicago",
            "items_count": 100,
            "unit_price": 512.00,
            "product_category": "Logistics & Freight",
            "priority": "Urgent",
            "notes": "Strategic seasonal freight allocation.",
            "expected_delivery_date": date.today() - timedelta(days=30),
            "actual_delivery_date": date.today() - timedelta(days=31),
            "carrier_name": "Apex Fleet Direct",
            "tracking_number": "APX-TRK-10029",
            "dispatch_date": date.today() - timedelta(days=36),
            "quality_rating": 5.0,
            "qa_notes": "Flawless delivery. On-time and undamaged.",
            "invoice_number": "INV-2026-0610",
            "invoice_amount": 51200.00,
            "invoice_status": "Paid",
            "payment_date": date.today() - timedelta(days=25),
            "payment_notes": "Direct bank clearance completed.",
            "response_time_hours": 1.6
        }
    ]

    for ord_data in sample_orders:
        po = PurchaseOrder(**ord_data)
        db.add(po)
        db.commit()
        db.refresh(po)

        # If invoice submitted or paid, create Invoice record
        if po.invoice_number:
            inv = Invoice(
                purchase_order_id=po.id,
                vendor_id=po.vendor_id,
                invoice_number=po.invoice_number,
                amount=po.invoice_amount or po.total_amount,
                invoice_date=po.actual_delivery_date or date.today(),
                status=po.invoice_status,
                notes=f"Reconciled invoice for {po.order_number}"
            )
            db.add(inv)
            db.commit()

    print("Step 5b: Bulk Ingesting 350+ Authentic DataCo Supply Chain Transactions...")
    if os.path.exists(DATASET_PATH):
        try:
            with open(DATASET_PATH, mode="r", encoding="latin-1") as f:
                reader = csv.DictReader(f)
                dataco_count = 0
                for row in reader:
                    dataco_count += 1
                    if dataco_count > 350:
                        break
                    
                    prod_name = (row.get("Product Name") or "Industrial Supply").strip()
                    dept_name = (row.get("Department Name") or "Supply Chain").strip()
                    ship_mode = (row.get("Shipping Mode") or "Standard Class").strip()
                    dest_country = (row.get("Order Country") or "United States").strip()
                    dest_city = (row.get("Order City") or "Chicago").strip()
                    
                    try:
                        qty = max(1, int(float(row.get("Order Item Quantity") or 1)))
                    except Exception:
                        qty = 1
                    
                    try:
                        unit_p = float(row.get("Order Item Product Price") or 75.0)
                    except Exception:
                        unit_p = 75.0
                        
                    try:
                        total_val = float(row.get("Order Item Total") or (qty * unit_p))
                    except Exception:
                        total_val = qty * unit_p

                    deliv_status = (row.get("Delivery Status") or "Shipping on time").strip()
                    
                    try:
                        is_late = int(row.get("Late_delivery_risk") or 0)
                    except Exception:
                        is_late = 0

                    # Map systematically across all 6 canonical vendors so each has authentic orders & delivery records
                    vendor_catalog = [
                        (apex_id, "Logistics Partners", "Logistics & Freight"),
                        (coretech_id, "IT Vendors", "Technology & Systems"),
                        (global_id, "Raw Material Suppliers", "Raw Materials"),
                        (equip_id, "Equipment Vendors", "Industrial Equipment"),
                        (vanguard_id, "Service Providers", "Enterprise Services"),
                        (maintenance_id, "Maintenance Vendors", "Facility Maintenance")
                    ]
                    assigned_vendor, v_cat, v_dept = vendor_catalog[dataco_count % len(vendor_catalog)]

                    # Extract real shipment timelines and delay flag directly from DataCo CSV
                    try:
                        sched_days = int(float(row.get("Days for shipment (scheduled)") or 3))
                    except Exception:
                        sched_days = 3
                    try:
                        real_days = int(float(row.get("Days for shipping (real)") or 4))
                    except Exception:
                        real_days = 4

                    item_id = (row.get('Order Item Id') or str(dataco_count)).strip()
                    po_num = f"PO-DCO-{row.get('Order Id')}-{item_id}"
                    order_base_date = date.today() - timedelta(days=15 + (dataco_count // 6) * 2)
                    expected_date = order_base_date + timedelta(days=sched_days)
                    actual_date = order_base_date + timedelta(days=real_days)
                    
                    if is_late or (real_days > sched_days) or deliv_status == "Late delivery":
                        q_rating = 3.5
                        has_issue = True
                        qa_msg = f"Transit delay flagged. Actual shipping took {real_days} days (exceeded {sched_days} scheduled days). Dock QA passed conditionally."
                        order_status = "Delivered" if dataco_count % 3 == 0 else "Completed"
                    else:
                        q_rating = 4.8
                        has_issue = False
                        qa_msg = f"Delivered on time ({real_days} days shipping <= {sched_days} scheduled days). All dock receiving checks cleared."
                        order_status = "Completed"

                    # Turnaround response time directly mapped from DataCo Shipping Mode
                    if ship_mode == "Same Day":
                        resp_hours = 1.2
                    elif ship_mode == "First Class":
                        resp_hours = 1.8
                    elif ship_mode == "Second Class":
                        resp_hours = 2.4
                    else:
                        resp_hours = 3.1

                    carrier_name = "FedEx Freight Express" if ship_mode in ["First Class", "Same Day"] else "Apex Fleet Direct"
                    inv_status = "Paid" if order_status == "Completed" else "Submitted"

                    dataco_po = PurchaseOrder(
                        vendor_id=assigned_vendor,
                        order_number=po_num,
                        title=f"{prod_name} - {dept_name}",
                        total_amount=round(total_val, 2),
                        status=order_status,
                        department=v_dept,
                        shipping_mode=ship_mode,
                        destination_country=dest_country,
                        destination_city=dest_city,
                        items_count=qty,
                        unit_price=round(unit_p, 2),
                        product_category=v_cat,
                        priority="High" if total_val > 300 else "Standard",
                        notes=f"DataCo transaction #{row.get('Order Id')}. Mode: {ship_mode}. Scheduled: {sched_days}d, Real: {real_days}d. Status: {deliv_status}.",
                        expected_delivery_date=expected_date,
                        actual_delivery_date=actual_date,
                        quality_rating=q_rating,
                        issue_flag=has_issue,
                        issue_resolved=True,
                        carrier_name=carrier_name,
                        tracking_number=f"TRK-DCO-{100000 + dataco_count}",
                        dispatch_date=order_base_date + timedelta(days=1),
                        qa_notes=qa_msg,
                        invoice_number=f"INV-DCO-{10000 + dataco_count}",
                        invoice_amount=round(total_val, 2),
                        invoice_status=inv_status,
                        payment_date=actual_date + timedelta(days=3) if order_status == "Completed" else None,
                        payment_notes="Corporate settlement completed." if order_status == "Completed" else None,
                        response_time_hours=resp_hours
                    )
                    db.add(dataco_po)
                db.commit()
                print(f"Successfully bulk ingested {dataco_count} real DataCo supply chain transactions!")
        except Exception as e:
            print(f"Error during DataCo bulk ingestion: {e}")

    print("Step 6: Seeding Role Notifications...")
    db.query(Notification).delete()
    db.commit()

    sample_notifs = [
        {
            "target_role": "Procurement Manager",
            "title": "Requisition Awaiting Approval",
            "message": "Requisition PO-2026-101 ($24,500.00) awaits Procurement Manager dispatch authorization.",
            "type": "Urgent",
            "is_read": False,
            "link": "procurement.html"
        },
        {
            "target_role": "Vendor",
            "title": "Authorized Purchase Order: PO-2026-102",
            "message": "Express Fleet Logistics order ($18,200.00) is authorized. Please confirm and dispatch goods.",
            "type": "Order",
            "is_read": False,
            "link": "procurement.html"
        },
        {
            "target_role": "Supply Chain Manager",
            "title": "Inbound Shipment Tracking: PO-2026-103",
            "message": "Carrier FedEx Freight (TRK-FDX-994821) dispatched server components. Expected at dock in 3 days.",
            "type": "Delivery",
            "is_read": False,
            "link": "dashboard.html"
        },
        {
            "target_role": "Finance Officer",
            "title": "3-Way Match Ready: PO-2026-104",
            "message": "Invoice INV-2026-0881 submitted for $42,000.00. QA score: 4.9/5.0. Ready for payment clearance.",
            "type": "Order",
            "is_read": False,
            "link": "dashboard.html"
        },
        {
            "target_role": "Auditor",
            "title": "Contract SLA Expired Alert",
            "message": "Machinery Leasing SLA CNT-2026-004 with Precision Heavy Equipment has expired. Renewal action required.",
            "type": "Compliance",
            "is_read": False,
            "link": "contracts.html"
        }
    ]

    for n_data in sample_notifs:
        n = Notification(**n_data)
        db.add(n)
    db.commit()

    print("Step 7: Calculating Authentic Mathematical Scores from Database Records...")
    from app.core.metrics import recalculate_all_vendors
    calc_summary = recalculate_all_vendors(db)
    for v_info in calc_summary["vendors"]:
        print(f"  [Calculated] {v_info['company_name']}: "
              f"Deliv Acc={v_info['delivery_accuracy']}% ({v_info['on_time_orders']}/{v_info['delivered_orders']}), "
              f"Quality={v_info['avg_quality_rating']}/5.0, "
              f"Resp={v_info['avg_response_time_hours']}h, "
              f"Contract={v_info['contract_status']}, "
              f"Final Reliability={v_info['reliability_score']}/100 ({v_info['risk_tier']})")

    db.close()
    print("Ingestion & Mathematical Scoring Completed Successfully!")

if __name__ == "__main__":
    ingest_dataco_database()
