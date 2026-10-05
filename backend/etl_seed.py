"""
VendorIQ ETL & Seed Module
Ingests real data from data/DataCoSupplyChainDataset.xlsx,
creates 6 demo accounts across the 6 mandatory roles,
and seeds the 6 mandatory vendor categories with connected procurement history.
"""
import os
import openpyxl
from datetime import datetime, timedelta, date
from backend.database import get_db, init_db
from backend.auth import get_password_hash

def seed_database(sample_size=10000):
    print("Initializing database schema...")
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # Check if already seeded
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] > 0:
        print("Database already contains data. Skipping re-seed.")
        conn.close()
        return

    print("Seeding demo users...")
    demo_pw = get_password_hash("VendorIQ2026!")

    # 6 Mandatory Roles (vendor_id linked after vendor inserted)
    users = [
        ("admin@vendoriq.internal", demo_pw, "Marcus Vance", "Administrator", None, "Executive Management"),
        ("procurement@vendoriq.internal", demo_pw, "Sarah Jenkins", "Procurement Manager", None, "Procurement & Sourcing"),
        ("supplychain@vendoriq.internal", demo_pw, "David Chen", "Supply Chain Manager", None, "Supply Chain Operations"),
        ("vendor@vendoriq.internal", demo_pw, "Elena Rostova", "Vendor", None, "Apex Materials"),
        ("finance@vendoriq.internal", demo_pw, "Michael Sterling", "Finance Officer", None, "Corporate Finance & Accounts"),
        ("auditor@vendoriq.internal", demo_pw, "Rachel Adams", "Auditor", None, "Internal Audit & Compliance")
    ]

    for u in users:
        cursor.execute("""
            INSERT INTO users (email, password_hash, full_name, role, vendor_id, department)
            VALUES (?, ?, ?, ?, ?, ?)
        """, u)

    print("Seeding 6 mandatory vendors across 6 categories...")
    # 6 Mandatory Categories + Pending / Suspended test vendors
    vendors_data = [
        (1, "VND-RAW-001", "Apex Raw Materials & Metallurgy Corp", "Raw Material Suppliers", "Active",
         "Elena Rostova", "VP Procurement & Materials", "elena.rostova@apexmaterials.com", "+1-555-019-2834",
         "104 Industrial Parkway, Pittsburgh, PA", "US-EIN-9281729", "https://apexmaterials.com",
         "High-grade structural steel alloys, industrial carbon polymers, titanium sheets", "REG-US-2018-8812",
         "2023-01-15 09:30:00", 1),
        (2, "VND-EQP-002", "Precision Industrial Machinery Ltd", "Equipment Vendors", "Active",
         "Robert Thorne", "Director of Industrial Systems", "r.thorne@precisionmachinery.com", "+1-555-014-9821",
         "450 Robotics Way, Detroit, MI", "US-EIN-8172641", "https://precisionmachinery.com",
         "5-axis CNC machining centers, automated robotic arms, calibration sensors", "REG-US-2019-5432",
         "2023-02-10 11:15:00", 1),
        (3, "VND-IT-003", "Nexus Enterprise Technologies Inc", "IT Vendors", "Active",
         "Alistair Finch", "Head of Enterprise Infrastructure", "afinch@nexustechnologies.io", "+1-555-017-3342",
         "700 Silicon Boulevard, San Jose, CA", "US-EIN-4491028", "https://nexustechnologies.io",
         "Cloud compute clusters, 100GbE enterprise switches, SAN arrays, cyber appliances", "REG-US-2020-1198",
         "2023-03-01 14:00:00", 1),
        (4, "VND-SRV-004", "Global Facility & Consulting Services", "Service Providers", "Active",
         "Samantha Miller", "Principal Consultant", "smiller@globalfacility.org", "+1-555-013-6623",
         "220 Corporate Towers, Chicago, IL", "US-EIN-3398124", "https://globalfacility.org",
         "ISO compliance auditing, supply chain optimization consulting, occupational safety training", "REG-US-2021-3948",
         "2023-04-12 10:45:00", 1),
        (5, "VND-LOG-005", "TransGlobal Express & Freight Co", "Logistics Partners", "Active",
         "Carlos Mendez", "Chief Logistics Officer", "carlos.m@transglobalfreight.net", "+1-555-018-7719",
         "880 Harbor Boulevard, Newark, NJ", "US-EIN-7721839", "https://transglobalfreight.net",
         "Global intermodal freight, cold-chain temperature-controlled transit, air express", "REG-US-2017-6621",
         "2023-01-20 08:30:00", 1),
        (6, "VND-MNT-006", "Reliant Engineering Maintenance Corp", "Maintenance Vendors", "Active",
         "Donald Wright", "Operations Maintenance Lead", "dwright@reliantmaint.com", "+1-555-016-4482",
         "312 Service Road, Cleveland, OH", "US-EIN-6629104", "https://reliantmaint.com",
         "Heavy plant preventive maintenance, boiler overhaul, cryogenic HVAC servicing", "REG-US-2019-9023",
         "2023-05-18 16:20:00", 1),
        (7, "VND-RAW-007", "Titan Alloy Dynamics", "Raw Material Suppliers", "Pending Approval",
         "Gregory Hayes", "Sales Director", "gregory@titanalloy.com", "+1-555-012-9981",
         "55 Smelter Drive, Gary, IN", "US-EIN-1928471", "https://titanalloy.com",
         "Specialty titanium and cobalt nickel alloys for aerospace and industrial use", "REG-US-2026-0042",
         None, None),
        (8, "VND-EQP-008", "Vortex Power Systems", "Equipment Vendors", "Suspended",
         "Arthur Pendelton", "General Manager", "art@vortexpower.com", "+1-555-011-8824",
         "90 Dynamo Ave, Houston, TX", "US-EIN-5501928", "https://vortexpower.com",
         "Backup turbine generators and electrical grid distribution hardware", "REG-US-2018-7711",
         "2023-06-01 10:00:00", 1),
        (9, "VND-IT-009", "CyberShield Networks", "IT Vendors", "Inactive",
         "Linus Meyer", "Account Director", "linus@cybershield.net", "+1-555-015-1172",
         "14 Cloud Way, Austin, TX", "US-EIN-8819203", "https://cybershield.net",
         "Hardware firewall gateways and endpoint security appliances", "REG-US-2020-4491",
         "2023-07-15 11:00:00", 1),
        (10, "VND-SRV-010", "Omega Quality Labs", "Service Providers", "Rejected",
         "Hannah Cole", "Managing Partner", "h.cole@omegaquality.com", "+1-555-019-6611",
         "18 Laboratory Lane, Boston, MA", "US-EIN-7729102", "https://omegaquality.com",
         "Materials non-destructive testing and stress simulation", "REG-US-2026-0019",
         None, None)
    ]

    for v in vendors_data:
        cursor.execute("""
            INSERT INTO vendors (
                id, vendor_code, company_name, category, status,
                contact_person, designation, email, phone,
                address, tax_id, website, products_services, registration_number,
                approved_at, approved_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, v)

        # Primary contact
        cursor.execute("""
            INSERT INTO vendor_contacts (vendor_id, name, designation, email, phone, department, is_primary)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        """, (v[0], v[5], v[6], v[7], v[8], v[3]))

        # Documents
        cursor.execute("""
            INSERT INTO vendor_documents (vendor_id, document_type, document_name, document_status)
            VALUES (?, 'Business Registration', 'Business_Registration_Certificate.pdf', 'Verified')
        """, (v[0],))
        cursor.execute("""
            INSERT INTO vendor_documents (vendor_id, document_type, document_name, document_status)
            VALUES (?, 'Tax Clearance', 'Tax_Clearance_W9.pdf', 'Verified')
        """, (v[0],))

    # Link vendor account to vendor 1 (Apex)
    cursor.execute("UPDATE users SET vendor_id = 1 WHERE email = 'vendor@vendoriq.internal'")

    print("Seeding contracts and certifications...")
    contracts_data = [
        ("CNT-2024-001", 1, "Master Supply Agreement", "2024-01-01", "2027-01-01", 1250000.0, "Standard 30-day net terms, quarterly volume discount tier 1", "Active"),
        ("CNT-2024-002", 2, "Equipment Supply & SLA", "2024-03-01", "2026-12-31", 850000.0, "Comprehensive hardware warranty, parts replacement within 48h", "Active"),
        ("CNT-2024-003", 3, "Cloud & Enterprise IT Agreement", "2024-06-01", "2027-06-01", 920000.0, "99.99% uptime guarantee, 4-hour critical incident response", "Active"),
        ("CNT-2024-004", 4, "Annual Consulting Services Retainer", "2024-01-15", "2026-11-30", 450000.0, "500 hours consulting allocated per annum, bi-weekly audits", "Active"),
        ("CNT-2024-005", 5, "Dedicated 3PL Freight Agreement", "2024-02-01", "2027-02-01", 1400000.0, "Dedicated fleet lane pricing, guaranteed cold chain integrity", "Active"),
        ("CNT-2024-006", 6, "Preventive Plant Maintenance Contract", "2024-05-01", "2026-10-31", 620000.0, "24/7 on-call technicians, scheduled monthly diagnostic visits", "Active"),
        ("CNT-2023-008", 8, "Auxiliary Power Service Agreement", "2023-01-01", "2024-01-01", 300000.0, "Expired agreement awaiting compliance resolution", "Expired")
    ]
    for c in contracts_data:
        cursor.execute("""
            INSERT INTO contracts (contract_number, vendor_id, contract_type, start_date, end_date, contract_value, terms, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, c)

    certs_data = [
        (1, "ISO 9001:2015 Quality Management", "Bureau Veritas", "2023-02-01", "2027-02-01", "Compliant"),
        (1, "ISO 14001:2015 Environmental Management", "TUV Rheinland", "2023-04-10", "2027-04-10", "Compliant"),
        (2, "ISO 9001:2015 Machinery Safety", "Lloyds Register", "2023-05-15", "2026-12-15", "Compliant"),
        (2, "CE Declaration of Conformity", "CE Cert International", "2023-06-01", "2027-06-01", "Compliant"),
        (3, "ISO/IEC 27001 Information Security", "BSI Group", "2023-01-10", "2027-01-10", "Compliant"),
        (3, "SOC 2 Type II Compliance", "PwC Auditor", "2024-01-15", "2027-01-15", "Compliant"),
        (4, "ISO 45001 Occupational Health & Safety", "SGS Global", "2023-03-20", "2026-11-20", "Compliant"),
        (5, "C-TPAT Tier 2 Customs Security", "US Customs Border", "2023-07-01", "2027-07-01", "Compliant"),
        (6, "OSHA Plant Safety Certification", "National Safety Council", "2023-08-15", "2026-10-15", "Compliant"),
        (8, "ISO 9001:2015 Quality Management", "Global Standards", "2020-01-01", "2024-01-01", "Non-Compliant/Expired") # Overridden risk
    ]
    for cert in certs_data:
        cursor.execute("""
            INSERT INTO certifications (vendor_id, certification_name, issuing_body, issue_date, expiry_date, compliance_status)
            VALUES (?, ?, ?, ?, ?, ?)
        """, cert)

    print("Seeding procurement requests, purchase orders, deliveries, and invoices...")
    # Seed historical POs for the 6 vendors
    # Apex (Raw Materials) - Vendor 1: High delivery rate, high quality
    pos_seed = [
        # (po_num, req_id, vendor_id, ord_date, exp_date, act_date, amount, status, items, rating, defects, inspected)
        ("PO-2026-001", 1, 1, "2026-01-10", "2026-01-20", "2026-01-18", 45000.0, "Completed", [("High-Strength Structural Steel (100 Tons)", 100, 350.0), ("Carbon Composite Ingots", 20, 500.0)], 4.8, 0, 100),
        ("PO-2026-002", 1, 1, "2026-02-05", "2026-02-15", "2026-02-14", 32000.0, "Completed", [("Titanium Industrial Plate Grade 5", 40, 800.0)], 4.7, 1, 40),
        ("PO-2026-003", 1, 1, "2026-03-01", "2026-03-12", "2026-03-11", 58000.0, "Completed", [("Specialty High-Alloy Bars", 150, 386.67)], 4.9, 0, 150),
        ("PO-2026-004", 1, 1, "2026-04-10", "2026-04-20", "2026-04-19", 29000.0, "Delivered", [("Galvanized Sheet Coils", 50, 580.0)], 4.6, 2, 50),
        ("PO-2026-005", 1, 1, "2026-05-02", "2026-05-14", None, 41000.0, "In Transit", [("Aluminum Alloy 7075 Billets", 80, 512.5)], None, None, None),

        # Precision (Equipment) - Vendor 2:
        ("PO-2026-006", 2, 2, "2026-01-15", "2026-01-30", "2026-01-28", 125000.0, "Completed", [("5-Axis High Precision CNC Milling Station", 1, 125000.0)], 4.9, 0, 1),
        ("PO-2026-007", 2, 2, "2026-02-18", "2026-03-05", "2026-03-09", 74000.0, "Completed", [("Robotic Arm Assembly Pack 6-DOF", 2, 37000.0)], 4.2, 0, 2), # 4 days delayed
        ("PO-2026-008", 2, 2, "2026-03-20", "2026-04-05", "2026-04-04", 36000.0, "Completed", [("Laser Calibration & Metrology Sensors", 6, 6000.0)], 4.5, 0, 6),
        ("PO-2026-009", 2, 2, "2026-04-25", "2026-05-15", None, 88000.0, "Ordered", [("Automated Guided Vehicle (AGV) Transport Unit", 2, 44000.0)], None, None, None),

        # Nexus (IT) - Vendor 3:
        ("PO-2026-010", 3, 3, "2026-01-08", "2026-01-18", "2026-01-16", 65000.0, "Completed", [("Enterprise 2U Server Chassis (Dual Xeon)", 5, 9000.0), ("100Gbps Backbone Switch", 2, 10000.0)], 4.7, 0, 7),
        ("PO-2026-011", 3, 3, "2026-02-12", "2026-02-22", "2026-02-21", 42000.0, "Completed", [("NVMe SAN Enterprise Storage Array 128TB", 1, 42000.0)], 4.8, 0, 1),
        ("PO-2026-012", 3, 3, "2026-03-15", "2026-03-25", "2026-03-24", 51000.0, "Completed", [("Next-Gen Hardware Firewall Gateway", 3, 17000.0)], 4.6, 0, 3),
        ("PO-2026-013", 3, 3, "2026-04-28", "2026-05-08", None, 38000.0, "In Transit", [("High-Density Patch Arrays & Fiber Optics", 20, 1900.0)], None, None, None),

        # Global Facility (Service) - Vendor 4:
        ("PO-2026-014", 4, 4, "2026-01-20", "2026-02-10", "2026-02-08", 28000.0, "Completed", [("Quarterly ISO 9001/45001 Compliance Audit", 1, 28000.0)], 4.5, 0, 1),
        ("PO-2026-015", 4, 4, "2026-03-05", "2026-03-20", "2026-03-18", 35000.0, "Completed", [("Environmental Sourcing Impact Assessment", 1, 35000.0)], 4.6, 0, 1),
        ("PO-2026-016", 4, 4, "2026-04-12", "2026-04-30", "2026-04-29", 19500.0, "Delivered", [("Facility Safety & Emergency Preparedness Workshop", 3, 6500.0)], 4.4, 0, 3),

        # TransGlobal (Logistics) - Vendor 5:
        ("PO-2026-017", 5, 5, "2026-01-05", "2026-01-15", "2026-01-14", 42000.0, "Completed", [("Intermodal Ocean Container Freight (Rotterdam to NY)", 4, 10500.0)], 4.7, 0, 4),
        ("PO-2026-018", 5, 5, "2026-02-08", "2026-02-18", "2026-02-22", 31000.0, "Completed", [("Temperature-Controlled Pharma Flight Route", 2, 15500.0)], 4.1, 0, 2), # 4 days delay
        ("PO-2026-019", 5, 5, "2026-03-12", "2026-03-22", "2026-03-20", 49000.0, "Completed", [("Domestic Dedicated Fleet Freight Contract (30 Runs)", 30, 1633.33)], 4.6, 0, 30),
        ("PO-2026-020", 5, 5, "2026-04-18", "2026-04-28", "2026-05-02", 27000.0, "Completed", [("Cross-Border Express Logistics", 15, 1800.0)], 4.0, 0, 15), # 4 days delay

        # Reliant Engineering (Maintenance) - Vendor 6:
        ("PO-2026-021", 6, 6, "2026-01-12", "2026-01-25", "2026-01-24", 26000.0, "Completed", [("Bi-Annual Cryogenic HVAC Maintenance", 1, 26000.0)], 4.7, 0, 1),
        ("PO-2026-022", 6, 6, "2026-02-20", "2026-03-05", "2026-03-04", 39000.0, "Completed", [("Boiler Overhaul & Pressure Valve Replacement", 2, 19500.0)], 4.8, 0, 2),
        ("PO-2026-023", 6, 6, "2026-04-05", "2026-04-18", "2026-04-16", 18500.0, "Completed", [("Emergency Hydraulic Ram Repair & Seal Calibration", 1, 18500.0)], 4.9, 0, 1),
    ]

    # Seed procurement requests first
    req_data = [
        ("REQ-2026-001", "Manufacturing & Operations", 2, "Q1 Structural Steel & Alloy Restock", "Raw Material Suppliers", "High grade steel plates and composite polymers for fabrication line", 120, 77000.0, "High", "2026-01-18", "Completed"),
        ("REQ-2026-002", "Production Engineering", 2, "Automated 5-Axis CNC Milling Machinery", "Equipment Vendors", "Precision machinery for high tolerance aerospace bracket machining", 1, 125000.0, "Urgent", "2026-01-28", "Completed"),
        ("REQ-2026-003", "Enterprise IT", 2, "Data Center Server Cluster Hardware", "IT Vendors", "Compute servers and 100GbE switches for cloud workload expansion", 7, 65000.0, "High", "2026-01-16", "Completed"),
        ("REQ-2026-004", "Quality & Compliance", 2, "Corporate Environmental & ISO Audit", "Service Providers", "Comprehensive vendor and site compliance certification review", 1, 28000.0, "Medium", "2026-02-08", "Completed"),
        ("REQ-2026-005", "Supply Chain Logistics", 2, "International Container Freight Transit", "Logistics Partners", "Rotterdam to New York maritime intermodal shipping containers", 4, 42000.0, "High", "2026-01-14", "Completed"),
        ("REQ-2026-006", "Facilities Engineering", 2, "Factory Plant HVAC & Cryogenic Servicing", "Maintenance Vendors", "Annual safety maintenance and coolant recharge for primary fabrication hall", 1, 26000.0, "Medium", "2026-01-24", "Completed"),
        ("REQ-2026-007", "Manufacturing & Operations", 2, "Specialty Titanium Alloy Plates", "Raw Material Suppliers", "Lightweight alloy sheet stock for precision casings", 50, 45000.0, "High", "2026-05-25", "Approved"),
        ("REQ-2026-008", "Supply Chain Logistics", 2, "Express Air Cargo Charter Services", "Logistics Partners", "Urgent components air shipment", 2, 22000.0, "Urgent", "2026-05-30", "Pending")
    ]
    for r in req_data:
        cursor.execute("""
            INSERT INTO procurement_requests (request_code, department, requested_by, title, category, description, quantity, estimated_cost, priority, required_date, status, decision_by, decision_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, '2026-01-05 10:00:00')
        """, r)

    # Insert Purchase Orders, items, evaluations, and invoices
    for p in pos_seed:
        po_num, req_id, v_id, ord_date, exp_date, act_date, amount, status, items, rating, defects, inspected = p
        cursor.execute("""
            INSERT INTO purchase_orders (po_number, request_id, vendor_id, order_date, expected_delivery_date, actual_delivery_date, total_amount, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 2)
        """, (po_num, req_id, v_id, ord_date, exp_date, act_date, amount, status))
        po_id = cursor.lastrowid

        for item in items:
            p_name, qty, unit_p = item
            cursor.execute("""
                INSERT INTO purchase_order_items (po_id, product_name, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?)
            """, (po_id, p_name, qty, unit_p, qty * unit_p))

        # Invoices
        if status in ("Completed", "Delivered"):
            inv_status = "Paid" if status == "Completed" else "Pending"
            inv_num = f"INV-{po_num[3:]}"
            cursor.execute("""
                INSERT INTO invoices (invoice_number, po_id, vendor_id, invoice_date, due_date, amount, payment_status, paid_at, payment_reference)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (inv_num, po_id, v_id, ord_date, exp_date, amount, inv_status,
                  f"{act_date} 14:00:00" if inv_status == "Paid" else None,
                  f"WIRE-REF-{po_id}8819" if inv_status == "Paid" else None))

        # Quality Evaluations
        if rating is not None and inspected is not None:
            cursor.execute("""
                INSERT INTO quality_evaluations (po_id, vendor_id, quality_rating, inspected_quantity, defective_quantity, rejected_quantity, evaluator_comments, evaluated_by)
                VALUES (?, ?, ?, ?, ?, 0, 'Standard incoming inspection completed satisfactorily.', 6)
            """, (po_id, v_id, rating, inspected, defects))

    print("Seeding issues and resolution metrics...")
    issues_seed = [
        ("ISS-2026-001", 1, 2, "Minor packaging moisture detected on pallet #4", "Slight surface moisture on outer shrink wrap; core titanium plates unaffected.", "Low", "Resolved", "2026-02-16 10:00:00", "2026-02-17 14:00:00", 28.0, "Pallet repackaged with moisture-barrier film and resealed."),
        ("ISS-2026-002", 2, 7, "Delivery truck dispatch delay due to mechanical breakdown", "Robotic arm shipment delayed by 4 days due to haulage mechanical failure.", "Medium", "Resolved", "2026-03-06 08:30:00", "2026-03-08 11:30:00", 51.0, "Alternative carrier commissioned; expedited delivery waived fee."),
        ("ISS-2026-003", 5, 18, "Airport customs delay on temperature-controlled freight", "Customs clearance paperwork needed additional phytosanitary endorsement.", "Medium", "Resolved", "2026-02-19 14:00:00", "2026-02-21 16:00:00", 50.0, "Updated clearance submitted electronically; release obtained."),
        ("ISS-2026-004", 5, 20, "Road freight traffic congestion at border crossing", "Severe cross-border congestion delayed express truck by 96 hours.", "Low", "Resolved", "2026-04-29 09:00:00", "2026-04-30 18:00:00", 33.0, "Shipment delivered safely; route updated for future assignments.")
    ]
    for iss in issues_seed:
        cursor.execute("""
            INSERT INTO issues (issue_code, vendor_id, po_id, title, description, severity, status, created_at, resolved_at, resolution_time_hours, resolution_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, iss)

    print("Seeding communication records (Email + SMS)...")
    comms_seed = [
        (1, 2, "EMAIL", "elena.rostova@apexmaterials.com", "[VendorIQ] Purchase Order PO-2026-001 Delivery Confirmation",
         "Dear Elena, Please confirm delivery schedule for PO-2026-001 (100 Tons Steel). Regards, Procurement Team.",
         "PO", "PO-2026-001", "2026-01-11 11:30:00", 3.5, "2026-01-11 08:00:00"),
        (1, 2, "SMS", "+15550192834", "[VendorIQ] PO-2026-004 Dispatch Alert",
         "Dispatch confirmation requested for PO-2026-004 coils. Please acknowledge ETA.",
         "PO", "PO-2026-004", "2026-04-11 14:20:00", 1.8, "2026-04-11 12:30:00"),
        (2, 2, "EMAIL", "r.thorne@precisionmachinery.com", "[VendorIQ] Pre-commissioning schedule for CNC Unit",
         "Robert, our plant engineers require setup manuals for PO-2026-006 CNC station.",
         "PO", "PO-2026-006", "2026-01-16 16:00:00", 4.2, "2026-01-16 11:45:00"),
        (3, 2, "EMAIL", "afinch@nexustechnologies.io", "[VendorIQ] Network Switch Firmware Specification",
         "Alistair, confirm if the 100GbE switches have latest OS firmware installed before shipment.",
         "PO", "PO-2026-010", "2026-01-09 10:15:00", 2.1, "2026-01-09 08:10:00"),
        (4, 2, "EMAIL", "smiller@globalfacility.org", "[VendorIQ] Q1 Compliance Audit Schedule",
         "Samantha, please provide auditor biographies for the upcoming ISO review.",
         "Procurement", "REQ-2026-004", "2026-01-21 14:00:00", 5.0, "2026-01-21 09:00:00"),
        (5, 2, "SMS", "+15550187719", "[VendorIQ] Urgent: Container Tracking Link for PO-2026-017",
         "Carlos, please send live vessel tracking ID for ocean freight shipment.",
         "PO", "PO-2026-017", "2026-01-06 13:00:00", 2.5, "2026-01-06 10:30:00"),
        (6, 2, "EMAIL", "dwright@reliantmaint.com", "[VendorIQ] Maintenance window approval for HVAC overhaul",
         "Donald, maintenance permit approved for Saturday fabrication hall shut down.",
         "PO", "PO-2026-021", "2026-01-13 15:30:00", 3.0, "2026-01-13 12:30:00")
    ]
    for com in comms_seed:
        cursor.execute("""
            INSERT INTO communication_records (vendor_id, user_id, communication_type, recipient_contact, subject, message_body, related_record_type, related_record_id, response_received_at, response_time_hours, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, com)

    print("Seeding performance snapshots for trend analysis...")
    # Six months snapshots for Vendor 1-6
    months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"]
    trend_scores = {
        1: [88.5, 89.2, 90.0, 91.5, 92.0, 92.8], # Apex: Improving
        2: [86.0, 85.5, 87.0, 84.0, 85.2, 85.8], # Precision: Stable
        3: [90.5, 91.0, 91.5, 92.0, 92.5, 93.0], # Nexus: Improving
        4: [82.0, 83.5, 84.0, 84.5, 85.0, 85.5], # Global: Stable
        5: [78.0, 77.5, 79.0, 75.0, 76.2, 74.8], # TransGlobal: Declining
        6: [85.0, 86.0, 87.5, 88.0, 88.5, 89.0], # Reliant: Improving
    }
    for v_id, scores in trend_scores.items():
        for i, m in enumerate(months):
            sc = scores[i]
            prev = scores[i-1] if i > 0 else sc
            t_label = "Improving" if sc > prev else ("Declining" if sc < prev else "Stable")
            risk = "Low" if sc >= 80 else ("Medium" if sc >= 60 else "High")
            cursor.execute("""
                INSERT OR REPLACE INTO performance_snapshots (
                    vendor_id, period_month, delivery_score, quality_score, communication_score,
                    compliance_score, purchase_history_score, issue_resolution_score, overall_reliability, risk_level, trend
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (v_id, m, sc, sc + 1.0, 90.0, 95.0, 92.0, 85.0, sc, risk, t_label))

    print("Seeding initial audit logs and notifications...")
    audit_data = [
        (1, "Marcus Vance", "System Initialized", "System", "Platform", "SYS-001", None, "Online", "VendorIQ system schema and security initialized.", "127.0.0.1", "2026-01-01 08:00:00"),
        (1, "Marcus Vance", "Vendor Approved", "Vendor", "Vendor", "1", "Pending Approval", "Active", "Apex Raw Materials & Metallurgy Corp approved as active tier-1 supplier.", "127.0.0.1", "2026-01-15 09:30:00"),
        (1, "Marcus Vance", "Vendor Approved", "Vendor", "Vendor", "2", "Pending Approval", "Active", "Precision Industrial Machinery Ltd verified and approved.", "127.0.0.1", "2026-02-10 11:15:00"),
        (2, "Sarah Jenkins", "Procurement Created", "Procurement", "Request", "REQ-2026-001", None, "Pending", "Procurement request REQ-2026-001 raised for Steel Restock.", "127.0.0.1", "2026-01-05 10:00:00"),
        (2, "Sarah Jenkins", "PO Created", "Procurement", "Purchase Order", "PO-2026-001", None, "Ordered", "Purchase order PO-2026-001 issued to Apex Raw Materials.", "127.0.0.1", "2026-01-10 10:30:00"),
        (2, "Sarah Jenkins", "PO Delivered", "Procurement", "Purchase Order", "PO-2026-001", "In Transit", "Delivered", "Delivery confirmed 2 days ahead of scheduled delivery date.", "127.0.0.1", "2026-01-18 14:20:00"),
        (5, "Michael Sterling", "Invoice Paid", "Finance", "Invoice", "INV-2026-001", "Pending", "Paid", "Payment processed via wire transfer WIRE-REF-18819.", "127.0.0.1", "2026-01-18 16:00:00")
    ]
    for a in audit_data:
        cursor.execute("""
            INSERT INTO audit_logs (user_id, user_name, action, module, record_type, record_id, previous_value, new_value, details, ip_address, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, a)

    notif_data = [
        (None, "Administrator", "New Vendor Registration Pending", "Vendor 'Titan Alloy Dynamics' registered and awaiting verification.", "WARNING", "#/vendor-approval"),
        (None, "Procurement Manager", "Urgent Procurement Request Pending", "REQ-2026-008: Express Air Cargo Charter Services requires approval.", "ALERT", "#/procurement"),
        (None, "Supply Chain Manager", "In Transit Shipment PO-2026-005 Tracking", "Apex Raw Materials aluminum billets shipment dispatched on schedule.", "INFO", "#/purchase-orders"),
        (None, "Finance Officer", "Pending Invoices Ready for Payment", "Invoice INV-2026-004 from Apex Materials ready for review.", "INFO", "#/invoices"),
        (None, "Auditor", "Compliance Expiry Alert", "Vortex Power Systems ISO 9001 certification has expired. Risk escalated to High.", "ALERT", "#/compliance")
    ]
    for n in notif_data:
        cursor.execute("""
            INSERT INTO notifications (user_id, role_target, title, message, type, link)
            VALUES (?, ?, ?, ?, ?, ?)
        """, n)

    print(f"Reading dataset: data/DataCoSupplyChainDataset.xlsx (Ingesting up to {sample_size} records)...")
    excel_path = os.path.join(os.path.dirname(__file__), "..", "data", "DataCoSupplyChainDataset.xlsx")
    if os.path.exists(excel_path):
        wb = openpyxl.load_workbook(excel_path, read_only=True)
        ws = wb.active
        rows = ws.iter_rows(values_only=True)
        header = next(rows)

        col_map = {col: i for i, col in enumerate(header)}

        inserted_count = 0
        batch = []
        for row in rows:
            if inserted_count >= sample_size:
                break
            try:
                order_id = row[col_map.get("Order Id")]
                order_item_id = row[col_map.get("Order Item Id")]
                order_date = row[col_map.get("order date (DateOrders)")]
                shipping_date = row[col_map.get("shipping date (DateOrders)")]
                shipping_mode = row[col_map.get("Shipping Mode")]
                delivery_status = row[col_map.get("Delivery Status")]
                late_delivery_risk = row[col_map.get("Late_delivery_risk")]
                days_real = row[col_map.get("Days for shipping (real)")]
                days_sched = row[col_map.get("Days for shipment (scheduled)")]
                cat_name = row[col_map.get("Category Name")]
                dept_name = row[col_map.get("Department Name")]
                segment = row[col_map.get("Customer Segment")]
                city = row[col_map.get("Order City")]
                country = row[col_map.get("Order Country")]
                region = row[col_map.get("Order Region")]
                market = row[col_map.get("Market")]
                order_status = row[col_map.get("Order Status")]
                prod_name = row[col_map.get("Product Name")]
                prod_price = row[col_map.get("Product Price")]
                qty = row[col_map.get("Order Item Quantity")]
                item_total = row[col_map.get("Order Item Total")]
                benefit = row[col_map.get("Benefit per order")]
                sales = row[col_map.get("Sales")]

                batch.append((
                    order_id, order_item_id, str(order_date) if order_date else None,
                    str(shipping_date) if shipping_date else None, shipping_mode, delivery_status,
                    int(late_delivery_risk) if late_delivery_risk is not None else 0,
                    float(days_real) if days_real is not None else 0.0,
                    float(days_sched) if days_sched is not None else 0.0,
                    cat_name, dept_name, segment, city, country, region, market,
                    order_status, prod_name, float(prod_price) if prod_price is not None else 0.0,
                    int(qty) if qty is not None else 1,
                    float(item_total) if item_total is not None else 0.0,
                    float(benefit) if benefit is not None else 0.0,
                    float(sales) if sales is not None else 0.0
                ))
                inserted_count += 1
                if len(batch) >= 1000:
                    cursor.executemany("""
                        INSERT INTO supply_chain_orders (
                            order_id, order_item_id, order_date, shipping_date, shipping_mode,
                            delivery_status, late_delivery_risk, days_for_shipping_real, days_for_shipment_scheduled,
                            category_name, department_name, customer_segment, order_city, order_country,
                            order_region, market, order_status, product_name, product_price,
                            order_item_quantity, order_item_total, benefit_per_order, sales
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, batch)
                    batch = []
            except Exception as e:
                continue

        if batch:
            cursor.executemany("""
                INSERT INTO supply_chain_orders (
                    order_id, order_item_id, order_date, shipping_date, shipping_mode,
                    delivery_status, late_delivery_risk, days_for_shipping_real, days_for_shipment_scheduled,
                    category_name, department_name, customer_segment, order_city, order_country,
                    order_region, market, order_status, product_name, product_price,
                    order_item_quantity, order_item_total, benefit_per_order, sales
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, batch)

        wb.close()
        print(f"Successfully ingested {inserted_count} real supply chain order rows from dataset.")
    else:
        print(f"Warning: {excel_path} not found.")

    conn.commit()
    conn.close()
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_database()
