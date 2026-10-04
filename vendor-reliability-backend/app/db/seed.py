from datetime import datetime, timedelta
import random
from sqlalchemy import func
from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.core.security import hash_password
from app.models.user import User
from app.models.department import Department
from app.models.vendor import Vendor, VendorCategory, VendorContact, VendorDocument, VendorProduct
from app.models.item import ItemCategory, Item
from app.models.procurement import ProcurementRequest, PurchaseRequisitionItem
from app.models.vendor_selection import VendorSelection
from app.models.financial_approval import FinancialApproval
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.delivery import Delivery
from app.models.contract import Contract
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.vendor_metrics import VendorPerformance, VendorRisk
from app.models.audit_finding import AuditFinding, AuditReviewStatus
from app.models.notification import Notification
from app.models.communication import CommunicationMessage, AuditLog
from app.services.reliability_engine import calculate_vendor_metrics

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Seed Departments
        dept_data = [
            ("IT", "Information Technology", "Enterprise IT, Cloud Infrastructure, and End-User Computing", 2500000.0),
            ("MFG", "Manufacturing & Production", "Assembly plants, precision machining, and industrial raw materials", 5000000.0),
            ("SCM", "Supply Chain & Logistics", "Freight routing, warehousing, and inbound transportation", 2000000.0),
            ("FIN", "Corporate Finance", "Treasury, compliance, accounts payable, and auditing", 1000000.0),
            ("FAC", "Operations & Facilities", "Facility maintenance, plant utilities, and safety equipment", 1200000.0),
            ("HR", "Human Resources", "Talent onboarding, workplace tools, and corporate services", 800000.0),
            ("RND", "Research & Development", "Product prototyping, laboratory reagents, and electronic sensors", 1800000.0),
        ]
        for code, name, desc, budget in dept_data:
            if not db.query(Department).filter(Department.code == code).first():
                db.add(Department(code=code, name=name, description=desc, annual_budget=budget, remaining_budget=budget*0.85, is_active=True))
        db.commit()

        # 2. Seed Exactly 6 Official Vendor Categories
        official_categories = [
            ("IT & Electronics", "ITE", "Computing hardware, laptops, monitors, servers, peripherals, and networking systems"),
            ("Raw Materials", "RAW", "Foundational raw materials, structural steel, copper, cement, polymers, and chemicals"),
            ("Office Supplies & Equipment", "OFF", "Workstation desks, ergonomic chairs, stationery, and office furnishings"),
            ("Machinery & Spare Parts", "MSP", "Industrial machinery, electric motors, hydraulic pumps, bearings, and plant components"),
            ("Logistics & Transportation", "LOG", "Intermodal freight, linehaul trucking, express delivery, and warehouse logistics"),
            ("Services & Maintenance", "SRV", "Facility maintenance, HVAC repair, electrical servicing, and certified IT support")
        ]
        for name, code, desc in official_categories:
            if not db.query(VendorCategory).filter(VendorCategory.name == name).first():
                db.add(VendorCategory(name=name, description=desc, is_active=True))
            if not db.query(ItemCategory).filter(ItemCategory.name == name).first():
                db.add(ItemCategory(name=name, code=code, description=desc, is_active=True))
        db.commit()

        # 3. Seed Items Catalog
        items_data = [
            # IT & Electronics
            ("IT & Electronics", "Laptop", "High-performance enterprise business laptop 16-inch Core i7/i9, 32GB RAM", "Units", 50000.0),
            ("IT & Electronics", "Desktop", "Corporate compact desktop workstation, 16GB RAM, 512GB SSD", "Units", 40000.0),
            ("IT & Electronics", "Monitor", "27-inch 4K IPS Ultra-HD Professional Display", "Units", 18000.0),
            ("IT & Electronics", "Printer", "Heavy-duty departmental laser multi-function network printer", "Units", 35000.0),
            ("IT & Electronics", "Networking Equipment", "Enterprise 48-port Gigabit PoE+ Managed Switch", "Units", 45000.0),
            # Raw Materials
            ("Raw Materials", "Steel", "High-tensile structural carbon steel beams and plates", "Tons", 65000.0),
            ("Raw Materials", "Cement", "Grade 53 Portland Cement for plant infrastructure", "Bags", 420.0),
            ("Raw Materials", "Copper", "Electrolytic high-purity copper rods and grounding cables", "Kg", 850.0),
            ("Raw Materials", "Plastic", "Engineering grade polymer granules and resin", "Kg", 160.0),
            ("Raw Materials", "Chemicals", "Industrial solvents and certified degreasing agents", "Liters", 320.0),
            # Office Supplies & Equipment
            ("Office Supplies & Equipment", "Chairs", "Ergonomic mesh task chair with lumbar support", "Units", 8500.0),
            ("Office Supplies & Equipment", "Tables", "Modular height-adjustable collaborative meeting table", "Units", 22000.0),
            ("Office Supplies & Equipment", "Stationery", "Corporate executive paper, pen, and document organizers kit", "Kits", 1500.0),
            ("Office Supplies & Equipment", "Office Equipment", "Heavy duty cross-cut document shredder", "Units", 12000.0),
            # Machinery & Spare Parts
            ("Machinery & Spare Parts", "Motors", "Three-phase 15kW Industrial Electric Motor", "Units", 38000.0),
            ("Machinery & Spare Parts", "Pumps", "Centrifugal heavy slurry water transfer pump", "Units", 55000.0),
            ("Machinery & Spare Parts", "Bearings", "High-precision deep groove ball bearing assemblies", "Sets", 4500.0),
            ("Machinery & Spare Parts", "Machine Components", "Precision CNC machined gear shafts and couplers", "Units", 14000.0),
            # Logistics & Transportation
            ("Logistics & Transportation", "Truck Transportation", "Dedicated 20-ton closed container linehaul transportation", "Trips", 45000.0),
            ("Logistics & Transportation", "Freight", "Express multi-modal air and rail freight forwarding", "Shipments", 28000.0),
            ("Logistics & Transportation", "Warehousing", "Climate-controlled cross-dock warehouse pallet storage (Monthly)", "Pallets", 2500.0),
            ("Logistics & Transportation", "Delivery Services", "Same-day inter-plant courier and critical dispatch service", "Calls", 1200.0),
            # Services & Maintenance
            ("Services & Maintenance", "Equipment Maintenance", "Comprehensive preventive maintenance SLA for manufacturing plant", "Contracts", 125000.0),
            ("Services & Maintenance", "Facility Maintenance", "Corporate campus facility and HVAC quarterly maintenance", "Contracts", 95000.0),
            ("Services & Maintenance", "IT Support", "Tier-2/3 24x7 Enterprise infrastructure & server support", "Month", 80000.0),
            ("Services & Maintenance", "Repair Services", "Emergency electrical and hydraulic breakdown repair service", "Service", 35000.0),
        ]
        for cat_name, item_name, desc, unit, price in items_data:
            if not db.query(Item).filter(Item.name == item_name).first():
                cat = db.query(ItemCategory).filter(ItemCategory.name == cat_name).first()
                db.add(Item(
                    category_id=cat.id if cat else None,
                    category_name=cat_name,
                    name=item_name,
                    sku=f"SKU-{cat_name[:3].upper()}-{abs(hash(item_name)) % 10000:04d}",
                    unit=unit,
                    estimated_unit_price=price,
                    description=desc,
                    is_active=True
                ))
        db.commit()

        # 4. Seed 6 Standard Role Users (Strict RBAC - Exactly 6 Roles)
        demo_users = [
            ("Admin User", "admin@vendor-iq.com", "admin123", "Administrator", "VendorIQ Global", "Administration", "APPROVED", True),
            ("Sarah Jenkins", "procurement@vendor-iq.com", "procure123", "Procurement Manager", "VendorIQ Global", "Procurement Operations", "APPROVED", True),
            ("Elena Rostova", "finance@vendor-iq.com", "finance123", "Finance Officer", "VendorIQ Global", "Corporate Finance", "APPROVED", True),
            ("Marcus Vance", "supplychain@vendor-iq.com", "supply123", "Supply Chain Manager", "VendorIQ Global", "Supply Chain & Logistics", "APPROVED", True),
            ("ABC Tech Rep", "vendor@vendor-iq.com", "vendor123", "Vendor", "ABC Technologies Inc", "External Vendor", "APPROVED", True),
            ("Arthur Pendelton", "auditor@vendor-iq.com", "audit123", "Auditor", "VendorIQ Global", "Internal Risk & Audit", "APPROVED", True),
            ("Department Requester", "requester@vendor-iq.com", "request123", "Requesting User", "VendorIQ Global", "Operations & Facilities", "APPROVED", True)
        ]

        created_users = {}
        for full_name, email, password, role, company, dept, app_status, is_act in demo_users:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                user = User(
                    full_name=full_name,
                    email=email,
                    hashed_password=hash_password(password),
                    role=role,
                    company=company,
                    department=dept,
                    phone="+1 (555) 019-2834",
                    approval_status=app_status,
                    is_active=is_act
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            else:
                user.is_active = True
                user.approval_status = "APPROVED"
                db.commit()
            created_users[role] = user

        # 5. Seed Realistic Vendors across categories
        sample_vendors = [
            # IT & Electronics Vendors (For the prompt's Laptop requirement)
            {
                "name": "ABC Technologies",
                "company": "ABC Technologies Inc",
                "email": "enterprise@abctechnologies.com",
                "phone": "+91 80 4123 4567",
                "address": "45 Tech Park Boulevard, Silicon Corridor, Bengaluru",
                "website": "https://abctechnologies.com",
                "product": "Laptop, Desktop, Monitor, Printer",
                "category": "IT & Electronics",
                "status": "Approved",
                "deliveryRate": 96.0,
                "quality_rating": 4.9,
                "response_time_hours": 6.0,
                "risk_level": "Low",
                "business_reg_number": "CIN-U72200KA2015PTC082910",
                "gst_tax_id": "29AABCA1234C1Z5",
                "bank_details": "HDFC Corporate Bank / AC: 502000881920 / IFSC: HDFC0000123",
                "notes": "Verified OEM distributor with 96% on-time rate and ISO 9001 certified delivery network.",
                "user_id": created_users.get("Vendor").id if created_users.get("Vendor") else None
            },
            {
                "name": "Digital Systems Inc",
                "company": "Digital Systems Solutions Ltd",
                "email": "procure@digitalsystems.io",
                "phone": "+91 22 2847 1199",
                "address": "Plot 12, SEZ Cybercity, Navi Mumbai",
                "website": "https://digitalsystems.io",
                "product": "Laptop, Desktop, Networking Equipment",
                "category": "IT & Electronics",
                "status": "Approved",
                "deliveryRate": 85.0,
                "quality_rating": 4.4,
                "response_time_hours": 18.0,
                "risk_level": "Medium",
                "business_reg_number": "CIN-U72900MH2017PLC094182",
                "gst_tax_id": "27AABCD9910D1Z2",
                "bank_details": "ICICI Bank / AC: 000405012389 / IFSC: ICIC0000004",
                "notes": "Regional IT hardware supplier. Moderate lead-time variance on high-volume laptop orders."
            },
            {
                "name": "Computer World Tech",
                "company": "Computer World Hardware LLP",
                "email": "sales@computerworld.com",
                "phone": "+91 11 4910 8822",
                "address": "88 Nehru Place Commercial Complex, New Delhi",
                "website": "https://computerworld.com",
                "product": "Laptop, Desktop, Computer Peripherals",
                "category": "IT & Electronics",
                "status": "Approved",
                "deliveryRate": 74.0,
                "quality_rating": 3.7,
                "response_time_hours": 36.0,
                "risk_level": "High",
                "business_reg_number": "LLPIN-AAB-9921",
                "gst_tax_id": "07AAACW8819A1Z9",
                "bank_details": "State Bank of India / AC: 31009928174 / IFSC: SBIN0001234",
                "notes": "Subject to frequent delivery delays and partial consignments due to overseas component backlog."
            },
            {
                "name": "TechDistro Global",
                "company": "TechDistro Trading FZ",
                "email": "support@techdistro.com",
                "phone": "+91 44 2819 0011",
                "address": "300 Industrial Ring Road, Chennai",
                "website": "https://techdistro.com",
                "product": "Laptop, Tablets, Accessories",
                "category": "IT & Electronics",
                "status": "Suspended", # SUSPENDED: MUST BE FILTERED OUT
                "deliveryRate": 55.0,
                "quality_rating": 2.8,
                "risk_level": "High",
                "business_reg_number": "CIN-U74999TN2018PTC120491",
                "gst_tax_id": "33AAACT7729B1Z4",
                "notes": "Suspended pending quality audit investigation."
            },
            # Raw Materials Vendors
            {
                "name": "Sri Industrial Materials",
                "company": "Sri Industrial & Alloys Pvt Ltd",
                "email": "supply@srimaterials.com",
                "phone": "+91 40 2300 8844",
                "address": "Balanagar Industrial Area, Hyderabad",
                "website": "https://srimaterials.com",
                "product": "Steel, Cement, Copper",
                "category": "Raw Materials",
                "status": "Approved",
                "deliveryRate": 93.0,
                "quality_rating": 4.7,
                "response_time_hours": 12.0,
                "risk_level": "Low",
                "business_reg_number": "CIN-U27100TG2014PTC091823",
                "gst_tax_id": "36AAACS4412E1Z8",
                "bank_details": "Axis Bank / AC: 914020038819204 / IFSC: UTIB0000123",
                "notes": "Tier-1 metallurgical and raw material supplier with extensive supply depots."
            },
            {
                "name": "Acme Industrial Supplies",
                "company": "Acme Structural Corp",
                "email": "sales@acme-industrial.com",
                "phone": "+1 800-555-0101",
                "address": "1200 Industrial Blvd, Chicago, IL",
                "website": "https://acme-industrial.com",
                "product": "Steel, Fasteners, Structural Metals",
                "category": "Raw Materials",
                "status": "Approved",
                "deliveryRate": 95.0,
                "quality_rating": 4.8,
                "risk_level": "Low",
                "business_reg_number": "US-DE-8829104",
                "gst_tax_id": "TAX-US-36-8819201",
                "notes": "Certified structural steel provider."
            },
            # Services & Maintenance
            {
                "name": "Apex Facility & IT Maintenance",
                "company": "Apex Enterprise Services Ltd",
                "email": "services@apexmaintenance.com",
                "phone": "+91 80 6710 4400",
                "address": "Whitefield IT Highway, Bengaluru",
                "website": "https://apexmaintenance.com",
                "product": "Equipment Maintenance, Facility Maintenance, IT Support, Repair Services",
                "category": "Services & Maintenance",
                "status": "Approved",
                "deliveryRate": 94.0,
                "quality_rating": 4.8,
                "risk_level": "Low",
                "business_reg_number": "CIN-U74140KA2016PLC098231",
                "gst_tax_id": "29AAACA9928F1Z3",
                "notes": "Certified engineering and plant facilities maintenance team."
            },
            # Machinery & Spare Parts
            {
                "name": "Titan Heavy Machining",
                "company": "Titan Heavy Engineering Ltd",
                "email": "orders@titanmachining.com",
                "phone": "+91 20 2712 9900",
                "address": "MIDC Bhosari Industrial Estate, Pune",
                "website": "https://titanmachining.com",
                "product": "Motors, Pumps, Bearings, Machine Components",
                "category": "Machinery & Spare Parts",
                "status": "Approved",
                "deliveryRate": 60.0,
                "quality_rating": 3.4,
                "risk_level": "High",
                "business_reg_number": "CIN-U29100PN2013PLC084920",
                "gst_tax_id": "27AAACT3310G1Z6",
                "notes": "Frequent delivery lead-time slippages and partial consignments."
            },
            # Logistics & Transportation
            {
                "name": "FastMove Logistics Freight",
                "company": "FastMove Intermodal Logistics",
                "email": "dispatch@fastmovelogistics.com",
                "phone": "+91 124 4920 100",
                "address": "Cyber City Logistic Hub, Gurugram",
                "website": "https://fastmovelogistics.com",
                "product": "Truck Transportation, Freight, Warehousing, Delivery Services",
                "category": "Logistics & Transportation",
                "status": "Approved",
                "deliveryRate": 78.0,
                "quality_rating": 4.0,
                "risk_level": "Medium",
                "business_reg_number": "CIN-U60200HR2015PTC078912",
                "gst_tax_id": "06AAACF1102H1Z1",
                "notes": "Multimodal freight carrier."
            },
            # Office Supplies & Equipment
            {
                "name": "Metro Office Solutions",
                "company": "Metro Office Furnishings & Supplies",
                "email": "sales@metro-office.com",
                "phone": "+91 40 4499 1234",
                "address": "Hitec City Phase 2, Hyderabad",
                "website": "https://metro-office.com",
                "product": "Chairs, Tables, Stationery, Office Equipment",
                "category": "Office Supplies & Equipment",
                "status": "Approved",
                "deliveryRate": 91.0,
                "quality_rating": 4.6,
                "risk_level": "Low",
                "business_reg_number": "CIN-U36100TG2017PTC099412",
                "gst_tax_id": "36AAACM8839J1Z7",
                "notes": "Corporate ergonomic workstations and office solutions."
            }
        ]

        seeded_vendors = {}
        scm_user = created_users.get("Supply Chain Manager")
        fin_user = created_users.get("Finance Officer")

        for v_data in sample_vendors:
            # Ensure an active login account (email & password) exists for this vendor
            v_email = v_data["email"].strip().lower()
            v_user = db.query(User).filter(func.lower(User.email) == v_email).first()
            if not v_user:
                v_user = User(
                    full_name=v_data["name"],
                    email=v_email,
                    hashed_password=hash_password("vendor123"),
                    role="Vendor",
                    company=v_data["company"],
                    phone=v_data.get("phone", "+1 800-555-0100"),
                    department="External Vendor",
                    vendor_category=v_data.get("category", "Raw Material Suppliers"),
                    product_service=v_data.get("product", "General Supplies"),
                    business_reg_number=v_data.get("business_reg_number"),
                    gst_tax_id=v_data.get("gst_tax_id"),
                    approval_status="APPROVED",
                    is_active=True
                )
                db.add(v_user)
                db.commit()
                db.refresh(v_user)

            v = db.query(Vendor).filter(Vendor.name == v_data["name"]).first()
            if not v:
                v_dict = dict(v_data)
                v_dict["user_id"] = v_user.id
                v = Vendor(**v_dict)
                db.add(v)
                db.commit()
                db.refresh(v)
            elif not v.user_id:
                v.user_id = v_user.id
                db.commit()

                contact = VendorContact(
                    vendor_id=v.id,
                    contact_name=f"{v.name.split()[0]} Representative",
                    title="Key Account Director",
                    email=v.email,
                    phone=v.phone,
                    is_primary=True
                )
                db.add(contact)

                # Seed documents
                doc1 = VendorDocument(
                    vendor_id=v.id,
                    document_type="Business Registration Certificate",
                    document_name=f"{v.name.replace(' ', '_')}_Certificate_of_Incorporation.pdf",
                    document_url=f"/docs/{v.name.lower().replace(' ', '_')}_inc.pdf",
                    status="VERIFIED"
                )
                doc2 = VendorDocument(
                    vendor_id=v.id,
                    document_type="Tax Compliance / GST Clearance",
                    document_name=f"{v.name.replace(' ', '_')}_Tax_Clearance.pdf",
                    document_url=f"/docs/{v.name.lower().replace(' ', '_')}_tax.pdf",
                    status="VERIFIED"
                )
                db.add(doc1)
                db.add(doc2)

                # Seed products
                prods = [p.strip() for p in v.product.split(",") if p.strip()]
                for p_name in prods:
                    db.add(VendorProduct(
                        vendor_id=v.id,
                        product_name=p_name,
                        category=v.category,
                        unit_price=50000.0 if "Laptop" in p_name else 12000.0,
                        lead_time_days=7,
                        in_stock=True,
                        description=f"Authorized catalogue item: {p_name}"
                    ))
                db.commit()
            seeded_vendors[v.name] = v

        # 6. Seed Actual Orders and Deliveries for the 3 Key IT Vendors
        # to ensure Reliability Scores match the prompt's specifications:
        # Vendor A (ABC Technologies): 48 completed, 2 delayed, 1 partial -> ~94/100, 96% on-time, Low Risk
        # Vendor B (Digital Systems): 40 completed, 7 delayed, 3 partial -> ~82/100, 85% on-time, Medium Risk
        # Vendor C (Computer World): 35 completed, 10 delayed, 5 partial -> ~71/100, 74% on-time, High Risk
        
        vendor_order_profiles = [
            ("ABC Technologies", 48, 2, 1, 0, 50000.0),
            ("Digital Systems Inc", 40, 6, 3, 0, 48000.0),
            ("Computer World Tech", 35, 9, 5, 0, 47000.0)
        ]

        for v_name, num_completed, num_delayed, num_partial, num_cancelled, unit_pr in vendor_order_profiles:
            ven = seeded_vendors.get(v_name)
            if not ven:
                continue
            
            existing_pos = db.query(PurchaseOrder).filter(PurchaseOrder.vendor_id == ven.id).count()
            if existing_pos < 10:
                for idx in range(1, num_completed + 1):
                    po_num = f"PO-{ven.id:02d}-{idx:04d}"
                    is_delayed = (idx <= num_delayed)
                    is_partial = (idx <= num_partial)
                    delay_days = 3 if is_delayed else 0
                    ordered_qty = 10.0
                    delivered_qty = 8.0 if is_partial else 10.0
                    po_total = ordered_qty * unit_pr

                    created_dt = datetime.utcnow() - timedelta(days=200 - idx * 3)
                    exp_dt = created_dt + timedelta(days=10)
                    act_dt = exp_dt + timedelta(days=delay_days)

                    po = PurchaseOrder(
                        po_number=po_num,
                        vendor_id=ven.id,
                        created_by_id=scm_user.id if scm_user else 1,
                        issued_by_id=scm_user.id if scm_user else 1,
                        total_amount=po_total,
                        currency="INR",
                        status="Delivered",
                        issued_at=created_dt + timedelta(days=1),
                        vendor_accepted_at=created_dt + timedelta(days=2),
                        dispatch_date=act_dt - timedelta(days=2),
                        expected_delivery_date=exp_dt,
                        actual_delivery_date=act_dt,
                        carrier="Bluedart Surface Express",
                        shipping_address="Central IT Store, Tech Park, Bengaluru",
                        terms_and_conditions="Net 30 Days."
                    )
                    db.add(po)
                    db.commit()
                    db.refresh(po)

                    deliv = Delivery(
                        purchase_order_id=po.id,
                        recorded_by_id=scm_user.id if scm_user else 1,
                        expected_delivery_date=exp_dt,
                        actual_delivery_date=act_dt,
                        ordered_quantity=ordered_qty,
                        delivered_quantity=delivered_qty,
                        delay_days=delay_days,
                        delivery_status="Partially Delivered" if is_partial else ("Delayed" if is_delayed else "Delivered"),
                        carrier="Bluedart Surface Express",
                        notes=f"Delivery receipt #{idx:03d} for {ven.name}"
                    )
                    db.add(deliv)

                    # Invoice
                    inv = Invoice(
                        invoice_number=f"INV-{ven.id:02d}-{idx:04d}",
                        purchase_order_id=po.id,
                        vendor_id=ven.id,
                        amount=delivered_qty * unit_pr,
                        status="PAID",
                        three_way_match_status="MATCHED",
                        issue_date=act_dt,
                        paid_date=act_dt + timedelta(days=15),
                        payment_method="Electronic Funds Transfer"
                    )
                    db.add(inv)
                db.commit()

        # 7. Seed Official Purchase Requirement PR-001 (Laptop Requirement for PM evaluation)
        pm_user = created_users.get("Procurement Manager")
        pr1 = db.query(ProcurementRequest).filter(ProcurementRequest.request_number == "PR-001").first()
        if not pr1:
            pr1 = ProcurementRequest(
                request_number="PR-001",
                department="Information Technology",
                title="Laptop",
                description="New employee requirements - 50 high-performance developer laptops",
                quantity=50.0,
                required_date=datetime.utcnow() + timedelta(days=25), # 15 October target
                priority="High",
                category="IT & Electronics", # REQUIRED VENDOR CATEGORY
                estimated_budget=2500000.0, # ₹25,00,000
                status="SUBMITTED",
                requested_by_id=pm_user.id if pm_user else 2
            )
            db.add(pr1)
            db.commit()
            db.refresh(pr1)

            item1 = PurchaseRequisitionItem(
                requisition_id=pr1.id,
                item_name="Laptop",
                description="Core i7/i9, 32GB RAM, 1TB SSD, 16-inch display",
                quantity=50.0,
                estimated_unit_price=50000.0,
                estimated_total_price=2500000.0,
                sku="SKU-ITE-0001"
            )
            db.add(item1)
            db.commit()

        # Seed second PR in Raw Materials
        pr2 = db.query(ProcurementRequest).filter(ProcurementRequest.request_number == "PR-002").first()
        if not pr2:
            pr2 = ProcurementRequest(
                request_number="PR-002",
                department="Manufacturing & Production",
                title="Steel",
                description="High-tensile structural steel plates for plant assembly expansion",
                quantity=20.0,
                required_date=datetime.utcnow() + timedelta(days=30),
                priority="Urgent",
                category="Raw Materials",
                estimated_budget=1300000.0,
                status="SUBMITTED",
                requested_by_id=pm_user.id if pm_user else 2
            )
            db.add(pr2)
            db.commit()

        # Seed third PR in Services & Maintenance
        pr3 = db.query(ProcurementRequest).filter(ProcurementRequest.request_number == "PR-003").first()
        if not pr3:
            pr3 = ProcurementRequest(
                request_number="PR-003",
                department="Operations & Facilities",
                title="Facility Maintenance",
                description="Annual preventive maintenance for corporate HVAC and electrical infrastructure",
                quantity=1.0,
                required_date=datetime.utcnow() + timedelta(days=40),
                priority="Medium",
                category="Services & Maintenance",
                estimated_budget=180000.0,
                status="SUBMITTED",
                requested_by_id=pm_user.id if pm_user else 2
            )
            db.add(pr3)
            db.commit()

        # 8. Recalculate Vendor Reliability and Risk for all seeded vendors
        for v in db.query(Vendor).all():
            calculate_vendor_metrics(db, v.id)

        # 9. Seed Role Notifications
        notifications_data = [
            ("Procurement Manager", "Purchase Requirement PR-001 Submitted", "Requirement PR-001 (50 Laptops, Category: IT & Electronics) requires vendor evaluation.", "approval"),
            ("Finance Officer", "Pending Financial Approvals", "Finance dashboard ready for vendor selection budget verifications.", "approval"),
            ("Supply Chain Manager", "Supply Chain Command Center", "PO dispatch and delivery tracking active.", "order"),
            ("Vendor", "Vendor Portal Operational", "Your vendor profile is active and verified by Administrator.", "order"),
            ("Auditor", "Audit Ledger Ready", "System audit logging enabled for all procurement events.", "approval")
        ]
        for role, title, msg, n_type in notifications_data:
            user = created_users.get(role)
            if user and not db.query(Notification).filter(Notification.user_id == user.id, Notification.title == title).first():
                db.add(Notification(
                    user_id=user.id,
                    target_role=role,
                    title=title,
                    message=msg,
                    type=n_type,
                    is_read=False
                ))
        db.commit()

        print("[SUCCESS] Database seeded successfully with the 6 official categories, realistic vendor order histories, and PR-001 ready for vendor evaluation!")
    finally:
        db.close()
