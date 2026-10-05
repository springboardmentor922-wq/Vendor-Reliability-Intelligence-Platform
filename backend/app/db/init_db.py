from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.core import security
from app.models.user import User
from app.models.vendor import Vendor
from app.models.contract import Contract
from app.models.purchase_order import PurchaseOrder

SEED_USERS = [
    {
        "email": "admin@vendoriq.com",
        "password": "admin123",
        "full_name": "Sarah Jenkins",
        "role": "Administrator"
    },
    {
        "email": "procurement@vendoriq.com",
        "password": "procure123",
        "full_name": "David Miller",
        "role": "Procurement Manager"
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
        "email": "auditor@vendoriq.com",
        "password": "auditor123",
        "full_name": "Marcus Vance",
        "role": "Auditor"
    }
]

def init_db(db: Session) -> None:
    # 1. Seed users for all 6 roles
    for user_data in SEED_USERS:
        user = db.query(User).filter(User.email == user_data["email"]).first()
        if not user:
            user = User(
                email=user_data["email"],
                hashed_password=security.get_password_hash(user_data["password"]),
                full_name=user_data["full_name"],
                role=user_data["role"],
                is_active=True
            )
            db.add(user)
    db.commit()

    # 2. Seed 6 canonical vendors (exactly 1 for each of the 6 categories)
    SIX_VENDORS = [
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

    for v_data in SIX_VENDORS:
        existing_v = db.query(Vendor).filter(Vendor.company_name == v_data["company_name"]).first()
        if not existing_v:
            v_obj = Vendor(**v_data)
            db.add(v_obj)
    db.commit()

    vendor = db.query(Vendor).filter(Vendor.company_name == "Apex Logistics & Supply Co.").first()

    # 4. Seed contracts
    contract = db.query(Contract).filter(Contract.contract_number == "CNT-2026-001").first()
    if not contract:
        contract = Contract(
            vendor_id=vendor.id,
            contract_number="CNT-2026-001",
            title="Global Freight & Freight Forwarding SLA",
            start_date=date.today() - timedelta(days=90),
            end_date=date.today() + timedelta(days=275),
            value=250000.0,
            compliance_status="Compliant"
        )
        db.add(contract)
        db.commit()

    # 5. Seed sample Purchase Orders
    po1 = db.query(PurchaseOrder).filter(PurchaseOrder.order_number == "PO-2026-101").first()
    if not po1:
        po1 = PurchaseOrder(
            vendor_id=vendor.id,
            order_number="PO-2026-101",
            title="Q1 Priority Logistics Operations",
            status="Delivered",
            total_amount=48500.0,
            expected_delivery_date=date.today() - timedelta(days=5),
            actual_delivery_date=date.today() - timedelta(days=6),
            quality_rating=4.9,
            issue_flag=False,
            issue_resolved=True,
            response_time_hours=1.8
        )
        db.add(po1)

    po2 = db.query(PurchaseOrder).filter(PurchaseOrder.order_number == "PO-2026-102").first()
    if not po2:
        po2 = PurchaseOrder(
            vendor_id=vendor.id,
            order_number="PO-2026-102",
            title="Express Material Transport - Batch B",
            status="Ordered",
            total_amount=18200.0,
            expected_delivery_date=date.today() + timedelta(days=7),
            quality_rating=None,
            issue_flag=False,
            issue_resolved=True,
            response_time_hours=2.0
        )
        db.add(po2)

    db.commit()

    # Recalculate dynamic scores directly from database records
    from app.core.metrics import recalculate_all_vendors
    recalculate_all_vendors(db)

