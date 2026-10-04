from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from app.models.enums import (
    UserRole, VendorCategory, VendorStatus,
    RequestStatus, POStatus, InvoiceStatus,
    ContractStatus, NotificationType
)
from app.models.user import User
from app.models.vendor import Vendor
from app.models.procurement import ProcurementRequest, PurchaseOrder, PurchaseOrderItem, Invoice
from app.models.contract import Contract, Certification
from app.models.communication import Message
from app.models.performance import PerformanceRecord, ReliabilityScore
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.core.security import hash_password

def seed_database(db: Session):
    # Check if database is already seeded
    if db.query(User).count() > 0:
        return {"status": "already_seeded", "message": "Database already contains seed data."}

    today = date.today()

    # 1. Seed Vendors
    vendors_data = [
        {
            "company_name": "Apex Raw Materials Ltd",
            "category": VendorCategory.RAW_MATERIAL,
            "status": VendorStatus.APPROVED,
            "contact_person": "Vikram Patel",
            "email": "contact@apexmaterials.com",
            "phone": "+91 98200 11223",
            "address": "Plot 42, GIDC Industrial Estate, Ahmedabad, Gujarat",
            "gst_number": "24AAACA1234A1Z5",
            "notes": "Primary high-grade steel and industrial polymer supplier."
        },
        {
            "company_name": "Nova Precision Machinery",
            "category": VendorCategory.EQUIPMENT,
            "status": VendorStatus.APPROVED,
            "contact_person": "Sarah Jenkins",
            "email": "sarah@novaprecision.com",
            "phone": "+1 415 555 0192",
            "address": "100 Industrial Parkway, San Jose, CA 95134",
            "gst_number": "06AABCN4321B1Z2",
            "notes": "Tier 1 CNC milling and precision calibration equipment."
        },
        {
            "company_name": "CyberPulse Cloud Solutions",
            "category": VendorCategory.IT,
            "status": VendorStatus.APPROVED,
            "contact_person": "Rahul Verma",
            "email": "enterprise@cyberpulse.io",
            "phone": "+91 80 4123 7890",
            "address": "Block B, TechZone SEZ, Bengaluru, Karnataka",
            "gst_number": "29AAACC7890C1Z8",
            "notes": "Enterprise cloud hosting, cybersecurity audits, and networking gear."
        },
        {
            "company_name": "SwiftLine Global Logistics",
            "category": VendorCategory.LOGISTICS,
            "status": VendorStatus.APPROVED,
            "contact_person": "Elena Rostova",
            "email": "dispatch@swiftlinelogistics.com",
            "phone": "+44 20 7946 0912",
            "address": "Unit 7, Freight Gateway, London Heathrow, UK",
            "gst_number": "07AAACS5566D1Z1",
            "notes": "Multimodal air and surface freight forwarder with cold-chain support."
        },
        {
            "company_name": "ProFacility Maintenance Services",
            "category": VendorCategory.MAINTENANCE,
            "status": VendorStatus.PENDING,
            "contact_person": "Amit Saxena",
            "email": "amit@profacility.in",
            "phone": "+91 97110 99887",
            "address": "Sector 62, Noida, Uttar Pradesh",
            "gst_number": "09AAACP9988E1Z4",
            "notes": "HVAC and electrical maintenance contractor awaiting final vendor review."
        },
        {
            "company_name": "Nexus Professional Advisory",
            "category": VendorCategory.SERVICE_PROVIDER,
            "status": VendorStatus.SUSPENDED,
            "contact_person": "David Chen",
            "email": "compliance@nexusadvisory.com",
            "phone": "+65 6789 0123",
            "address": "12 Marina Boulevard, Marina Bay Financial Centre, Singapore",
            "gst_number": "33AAACN1122F1Z9",
            "notes": "Suspended pending annual ISO compliance audit verification."
        }
    ]

    vendor_objs = []
    for v in vendors_data:
        vendor = Vendor(**v)
        db.add(vendor)
        vendor_objs.append(vendor)
    db.commit()

    # 2. Seed Users for each of the 6 roles
    users_data = [
        {
            "full_name": "Arthur Vance",
            "email": "admin@vendoriq.com",
            "hashed_password": hash_password("Admin@123"),
            "role": UserRole.ADMINISTRATOR,
            "phone": "+1 555 0100",
            "is_active": True,
            "vendor_id": None
        },
        {
            "full_name": "Priya Sharma",
            "email": "procurement@vendoriq.com",
            "hashed_password": hash_password("Procure@123"),
            "role": UserRole.PROCUREMENT_MANAGER,
            "phone": "+91 98111 22334",
            "is_active": True,
            "vendor_id": None
        },
        {
            "full_name": "Marcus Kane",
            "email": "supplychain@vendoriq.com",
            "hashed_password": hash_password("Supply@123"),
            "role": UserRole.SUPPLY_CHAIN_MANAGER,
            "phone": "+1 555 0144",
            "is_active": True,
            "vendor_id": None
        },
        {
            "full_name": "Vikram Patel",
            "email": "vendor@apexmaterials.com",
            "hashed_password": hash_password("Vendor@123"),
            "role": UserRole.VENDOR,
            "phone": "+91 98200 11223",
            "is_active": True,
            "vendor_id": vendor_objs[0].id # Apex Raw Materials
        },
        {
            "full_name": "Clara Higgins",
            "email": "finance@vendoriq.com",
            "hashed_password": hash_password("Finance@123"),
            "role": UserRole.FINANCE_OFFICER,
            "phone": "+1 555 0177",
            "is_active": True,
            "vendor_id": None
        },
        {
            "full_name": "Benjamin Cole",
            "email": "auditor@vendoriq.com",
            "hashed_password": hash_password("Audit@123"),
            "role": UserRole.AUDITOR,
            "phone": "+1 555 0199",
            "is_active": True,
            "vendor_id": None
        }
    ]

    user_objs = []
    for u in users_data:
        user = User(**u)
        db.add(user)
        user_objs.append(user)
    db.commit()

    admin_user = user_objs[0]
    procure_mgr = user_objs[1]
    vendor_user = user_objs[3]
    apex_vendor = vendor_objs[0]
    nova_vendor = vendor_objs[1]
    cyber_vendor = vendor_objs[2]
    swift_vendor = vendor_objs[3]
    pro_vendor = vendor_objs[4]
    nexus_vendor = vendor_objs[5]

    # Update approval references for vendors
    for v in vendor_objs:
        if v.status == VendorStatus.APPROVED:
            v.approved_by_id = procure_mgr.id
    db.commit()

    # 3. Seed Procurement Requests
    req1 = ProcurementRequest(
        title="Q3 Structural Carbon Steel Ingot Procurement",
        description="High-density industrial grade carbon steel batch for heavy machinery frame production.",
        requested_by_id=procure_mgr.id,
        status=RequestStatus.APPROVED
    )
    req2 = ProcurementRequest(
        title="Automated 5-Axis Milling Unit Upgrades",
        description="Replacement components for precision machining shop floor assembly line #4.",
        requested_by_id=user_objs[2].id, # Marcus Kane
        status=RequestStatus.APPROVED
    )
    req3 = ProcurementRequest(
        title="Cloud Telemetry & Infrastructure Server Expansion",
        description="Dedicated compute instances and disaster recovery redundancy setup.",
        requested_by_id=admin_user.id,
        status=RequestStatus.PENDING
    )
    db.add_all([req1, req2, req3])
    db.commit()

    # 4. Seed Purchase Orders with Line Items
    po1 = PurchaseOrder(
        po_number="PO-2026-APX01",
        procurement_request_id=req1.id,
        vendor_id=apex_vendor.id,
        status=POStatus.DELIVERED,
        total_amount=48500.0,
        expected_delivery_date=today - timedelta(days=5),
        actual_delivery_date=today - timedelta(days=4),
        created_by_id=procure_mgr.id,
        approved_by_id=procure_mgr.id
    )
    po2 = PurchaseOrder(
        po_number="PO-2026-NOV02",
        procurement_request_id=req2.id,
        vendor_id=nova_vendor.id,
        status=POStatus.ORDERED,
        total_amount=92000.0,
        expected_delivery_date=today + timedelta(days=14),
        created_by_id=procure_mgr.id,
        approved_by_id=procure_mgr.id
    )
    po3 = PurchaseOrder(
        po_number="PO-2026-CYB03",
        procurement_request_id=None,
        vendor_id=cyber_vendor.id,
        status=POStatus.PENDING,
        total_amount=15400.0,
        expected_delivery_date=today + timedelta(days=20),
        created_by_id=procure_mgr.id
    )
    db.add_all([po1, po2, po3])
    db.commit()

    # Purchase Order Items
    items_data = [
        PurchaseOrderItem(purchase_order_id=po1.id, item_name="Grade 316 Stainless Steel Billets (Tons)", quantity=20.0, unit_price=1850.0),
        PurchaseOrderItem(purchase_order_id=po1.id, item_name="High-Tensile Reinforcement Rods (Pack 100)", quantity=15.0, unit_price=766.67),
        PurchaseOrderItem(purchase_order_id=po2.id, item_name="High-Speed Spindle Assembly 24000 RPM", quantity=4.0, unit_price=15000.0),
        PurchaseOrderItem(purchase_order_id=po2.id, item_name="CNC Optical Tool Setter & Calibration Rig", quantity=2.0, unit_price=16000.0),
        PurchaseOrderItem(purchase_order_id=po3.id, item_name="Enterprise Hybrid Cloud Controller Appliance", quantity=2.0, unit_price=5200.0),
        PurchaseOrderItem(purchase_order_id=po3.id, item_name="Managed Threat Detection & Log Pipeline License (1Y)", quantity=1.0, unit_price=5000.0)
    ]
    db.add_all(items_data)
    db.commit()

    # 5. Seed Invoices
    inv1 = Invoice(
        invoice_number="INV-2026-APX001",
        purchase_order_id=po1.id,
        amount=48500.0,
        status=InvoiceStatus.PAID,
        due_date=today - timedelta(days=2),
        paid_date=today - timedelta(days=1)
    )
    inv2 = Invoice(
        invoice_number="INV-2026-NOV002",
        purchase_order_id=po2.id,
        amount=92000.0,
        status=InvoiceStatus.PENDING,
        due_date=today + timedelta(days=25)
    )
    db.add_all([inv1, inv2])
    db.commit()

    # 6. Seed Contracts & Certifications
    contract1 = Contract(
        contract_number="CTR-2026-APX001",
        vendor_id=apex_vendor.id,
        title="Annual Strategic Raw Material Supply Agreement",
        start_date=today - timedelta(days=180),
        end_date=today + timedelta(days=185),
        status=ContractStatus.ACTIVE,
        file_path="/documents/contracts/CTR-2026-APX001.pdf"
    )
    contract2 = Contract(
        contract_number="CTR-2026-NOV002",
        vendor_id=nova_vendor.id,
        title="Precision Equipment Servicing & Tooling SLA",
        start_date=today - timedelta(days=340),
        end_date=today + timedelta(days=20), # Within 30 days -> EXPIRING SOON!
        status=ContractStatus.EXPIRING_SOON,
        file_path="/documents/contracts/CTR-2026-NOV002.pdf"
    )
    db.add_all([contract1, contract2])
    db.commit()

    cert1 = Certification(
        contract_id=contract1.id,
        vendor_id=apex_vendor.id,
        name="ISO 9001:2015 Quality Management Standard",
        issued_date=today - timedelta(days=300),
        expiry_date=today + timedelta(days=400),
        document_path="/documents/certifications/ISO-9001-APEX.pdf"
    )
    cert2 = Certification(
        contract_id=contract2.id,
        vendor_id=nova_vendor.id,
        name="CE Machinery Safety Directive Compliance",
        issued_date=today - timedelta(days=340),
        expiry_date=today + timedelta(days=25),
        document_path="/documents/certifications/CE-NOVA-2025.pdf"
    )
    db.add_all([cert1, cert2])
    db.commit()

    # 7. Seed Messages
    msg1 = Message(
        vendor_id=apex_vendor.id,
        sender_id=procure_mgr.id,
        body="Hello Vikram, could you please confirm dispatch tracking details for PO-2026-APX01?",
        file_path=None,
        is_read=True,
        timestamp=datetime.utcnow() - timedelta(days=6)
    )
    msg2 = Message(
        vendor_id=apex_vendor.id,
        sender_id=vendor_user.id,
        body="Hi Priya, the shipment has been dispatched via SwiftLine Freight. Tracking AWB: SWF-889921.",
        file_path=None,
        is_read=True,
        timestamp=datetime.utcnow() - timedelta(days=5)
    )
    msg3 = Message(
        vendor_id=apex_vendor.id,
        sender_id=procure_mgr.id,
        body="Materials received in excellent condition and cleared QA inspection. Invoice has been approved.",
        file_path=None,
        is_read=False,
        timestamp=datetime.utcnow() - timedelta(days=1)
    )
    db.add_all([msg1, msg2, msg3])
    db.commit()

    # 8. Seed Performance Records & Reliability Scores for All Vendors
    perfs = [
        PerformanceRecord(vendor_id=apex_vendor.id, purchase_order_id=po1.id, on_time=True, quality_rating=4.9, response_time_hours=1.5, issue_resolution_hours=4.0, recorded_at=datetime.utcnow() - timedelta(days=3)),
        PerformanceRecord(vendor_id=apex_vendor.id, on_time=True, quality_rating=4.8, response_time_hours=2.0, issue_resolution_hours=6.0, recorded_at=datetime.utcnow() - timedelta(days=25)),
        PerformanceRecord(vendor_id=nova_vendor.id, purchase_order_id=po2.id, on_time=True, quality_rating=4.7, response_time_hours=3.0, issue_resolution_hours=10.0, recorded_at=datetime.utcnow() - timedelta(days=6)),
        PerformanceRecord(vendor_id=nova_vendor.id, on_time=False, quality_rating=4.5, response_time_hours=4.5, issue_resolution_hours=16.0, recorded_at=datetime.utcnow() - timedelta(days=40)),
        PerformanceRecord(vendor_id=cyber_vendor.id, on_time=True, quality_rating=5.0, response_time_hours=1.0, issue_resolution_hours=2.0, recorded_at=datetime.utcnow() - timedelta(days=12)),
        PerformanceRecord(vendor_id=cyber_vendor.id, on_time=True, quality_rating=4.9, response_time_hours=1.2, issue_resolution_hours=3.5, recorded_at=datetime.utcnow() - timedelta(days=50)),
        PerformanceRecord(vendor_id=swift_vendor.id, purchase_order_id=po3.id, on_time=False, quality_rating=4.0, response_time_hours=5.5, issue_resolution_hours=22.0, recorded_at=datetime.utcnow() - timedelta(days=15)),
        PerformanceRecord(vendor_id=swift_vendor.id, on_time=True, quality_rating=4.2, response_time_hours=4.0, issue_resolution_hours=18.0, recorded_at=datetime.utcnow() - timedelta(days=45)),
        PerformanceRecord(vendor_id=pro_vendor.id, on_time=True, quality_rating=4.6, response_time_hours=3.2, issue_resolution_hours=12.0, recorded_at=datetime.utcnow() - timedelta(days=8)),
    ]
    db.add_all(perfs)
    db.commit()

    # 9. Seed Notifications
    notif1 = Notification(
        user_id=procure_mgr.id,
        type=NotificationType.VENDOR_APPROVAL,
        message="New vendor 'ProFacility Maintenance Services' registered and awaiting approval.",
        is_read=False,
        created_at=datetime.utcnow() - timedelta(hours=4)
    )
    notif2 = Notification(
        user_id=procure_mgr.id,
        type=NotificationType.CONTRACT_EXPIRY,
        message="Contract CTR-2026-NOV002 with Nova Precision Machinery expires in 20 days.",
        is_read=False,
        created_at=datetime.utcnow() - timedelta(days=1)
    )
    db.add_all([notif1, notif2])
    db.commit()

    # 10. Seed Audit Logs
    audit1 = AuditLog(
        user_id=admin_user.id,
        action="SYSTEM_INIT",
        entity="System",
        details="Platform database initialized with multi-role schemas and enterprise RBAC policies.",
        created_at=datetime.utcnow() - timedelta(days=10)
    )
    audit2 = AuditLog(
        user_id=procure_mgr.id,
        action="APPROVE_VENDOR",
        entity="Vendor",
        details=f"Approved vendor '{apex_vendor.company_name}' for raw materials procurement.",
        created_at=datetime.utcnow() - timedelta(days=8)
    )
    audit3 = AuditLog(
        user_id=procure_mgr.id,
        action="APPROVE_PO",
        entity="PurchaseOrder",
        details=f"Authorized purchase order {po1.po_number} totaling ₹48,500.00.",
        created_at=datetime.utcnow() - timedelta(days=5)
    )
    db.add_all([audit1, audit2, audit3])
    db.commit()

    return {"status": "success", "message": "Database successfully populated with realistic enterprise seed data."}
