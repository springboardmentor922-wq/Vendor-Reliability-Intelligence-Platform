from datetime import date, timedelta
from sqlalchemy.orm import Session
from .models import *
from .auth import hash_password

ROLES = {
    "admin@vendorintel.local": ("Administrator", "Admin@123", None, "System Administrator"),
    "procurement@vendorintel.local": ("Procurement Manager", "Procure@123", None, "Procurement Manager"),
    "supply@vendorintel.local": ("Supply Chain Manager", "Supply@123", None, "Supply Chain Manager"),
    "finance@vendorintel.local": ("Finance Officer", "Finance@123", None, "Finance Officer"),
    "auditor@vendorintel.local": ("Auditor", "Audit@123", None, "Auditor"),
}

def seed(db: Session):
    if db.query(Vendor).count():
        return
    vendors = [
        Vendor(name="Alpha Components", category="Raw Materials", contact_name="Asha Rao", email="asha@alpha.local", phone="9000000001", status="Approved"),
        Vendor(name="BlueWave Logistics", category="Logistics", contact_name="Ravi Kumar", email="ravi@bluewave.local", phone="9000000002", status="Approved"),
        Vendor(name="Nova Industrial", category="Equipment", contact_name="Neha Shah", email="neha@nova.local", phone="9000000003", status="Under Review"),
        Vendor(name="Vertex IT Services", category="IT", contact_name="Vikram Singh", email="vikram@vertex.local", phone="9000000004", status="Approved"),
    ]
    db.add_all(vendors); db.commit()
    for v in vendors: db.refresh(v)

    vendor_user = User(email="vendor@vendorintel.local", password_hash=hash_password("Vendor@123"), full_name="Alpha Components Vendor", role="Vendor", vendor_id=vendors[0].id)
    db.add(vendor_user)
    for email, (role, pw, vid, name) in ROLES.items():
        db.add(User(email=email, password_hash=hash_password(pw), full_name=name, role=role, vendor_id=vid))
    db.commit()

    today = date.today()
    pos = [
        PurchaseOrder(po_number="PO-1048", vendor_id=vendors[0].id, item="Industrial Components", quantity=100, unit_price=4200, total_amount=420000, order_date=today-timedelta(days=8), expected_delivery=today+timedelta(days=5), status="Pending"),
        PurchaseOrder(po_number="PO-1047", vendor_id=vendors[1].id, item="Transport Service", quantity=1, unit_price=280000, total_amount=280000, order_date=today-timedelta(days=12), expected_delivery=today+timedelta(days=2), status="Ordered"),
        PurchaseOrder(po_number="PO-1041", vendor_id=vendors[2].id, item="Production Equipment", quantity=2, unit_price=305000, total_amount=610000, order_date=today-timedelta(days=25), expected_delivery=today-timedelta(days=2), status="Delivered"),
    ]
    db.add_all(pos)
    contracts = [
        Contract(vendor_id=vendors[0].id, contract_number="CTR-221", expiry_date=today+timedelta(days=80), value=1500000),
        Contract(vendor_id=vendors[1].id, contract_number="CTR-198", expiry_date=today+timedelta(days=15), value=900000, compliance_status="Renewal"),
        Contract(vendor_id=vendors[2].id, contract_number="CTR-173", expiry_date=today+timedelta(days=5), value=1200000, compliance_status="Documents Missing", document_status="Missing"),
    ]
    db.add_all(contracts)
    periods = ["2026-04","2026-05","2026-06","2026-07","2026-08","2026-09"]
    profiles = [
        (vendors[0], [96,97,95,94,95,94]),
        (vendors[1], [84,82,81,79,78,78]),
        (vendors[2], [76,72,69,66,63,61]),
        (vendors[3], [88,89,90,90,91,89]),
    ]
    for v, scores in profiles:
        for i,p in enumerate(periods):
            s=scores[i]
            db.add(PerformanceRecord(vendor_id=v.id, period=p, on_time_deliveries=max(1,round(s/10)), total_deliveries=10,
                quality_rating=min(5, 3.0+s/50), response_hours=max(2, 16-s/8),
                contracts_passed=max(1,round(s/10)), contracts_checked=10,
                orders_completed=max(1,round(s/10)), orders_total=10,
                issues_resolved_on_time=max(1,round(s/12)), issues_total=10))
    db.commit()
    db.add_all([
        Notification(title="Vendor approval required", message="Nova Industrial is awaiting review.", type="vendor"),
        Notification(title="Contract expiry approaching", message="BlueWave Logistics contract requires renewal.", type="contract"),
        Notification(title="Delivery alert", message="PO-1041 has passed its expected delivery date.", type="delivery"),
    ])
    db.commit()
if __name__ == "__main__":
    from app.db import SessionLocal
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()