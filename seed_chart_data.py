import random
from datetime import datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.core.scoring import calculate_reliability_score
import app.models  # registers all models
from app.models.user import User
from app.models.vendor import Vendor, VendorStatus
from app.models.purchase_order import PurchaseOrder, OrderStatus
from app.models.purchase_order_item import PurchaseOrderItem
from app.models.score_history import ScoreHistory

random.seed(42)

ITEMS_BY_CATEGORY = {
    "it_vendor": [("Business Laptop", 62000), ("Network Switch", 18000), ("Software Licences", 9500)],
    "raw_material_supplier": [("Steel Sheets", 850), ("Copper Wire (kg)", 720), ("Aluminium Rods", 640)],
    "equipment_vendor": [("CNC Spindle Unit", 145000), ("Hydraulic Press Part", 52000), ("Industrial Drill", 38000)],
    "service_provider": [("Facility Cleaning (monthly)", 45000), ("Security Services", 60000)],
    "logistics_partner": [("Freight - Bengaluru to Chennai", 32000), ("Warehouse Handling", 21000)],
    "maintenance_vendor": [("AC Servicing", 28000), ("Generator Maintenance", 35000)],
}
DEPARTMENTS = ["Information Technology", "Operations", "Finance", "Facilities"]

STATUS_WEIGHTS = {
    "old": [(OrderStatus.COMPLETED, 60), (OrderStatus.DELIVERED, 20), (OrderStatus.CANCELLED, 10), (OrderStatus.ORDERED, 10)],
    "recent": [(OrderStatus.COMPLETED, 30), (OrderStatus.DELIVERED, 30), (OrderStatus.ORDERED, 25), (OrderStatus.APPROVED, 10), (OrderStatus.CANCELLED, 5)],
    "current": [(OrderStatus.ORDERED, 35), (OrderStatus.APPROVED, 25), (OrderStatus.PENDING, 25), (OrderStatus.DELIVERED, 15)],
}


def month_start(offset):
    now = datetime.now(timezone.utc)
    y, m = now.year, now.month - offset
    while m <= 0:
        m += 12
        y -= 1
    return datetime(y, m, 1, tzinfo=timezone.utc)


def pick_status(offset):
    key = "old" if offset >= 2 else "recent" if offset == 1 else "current"
    statuses, weights = zip(*STATUS_WEIGHTS[key])
    return random.choices(statuses, weights=weights)[0]


def main():
    db = SessionLocal()
    try:
        if db.query(PurchaseOrder).filter(PurchaseOrder.order_number.like("PO-SEED-%")).count() > 0:
            print("Seed data already exists — nothing to do.")
            return

        admin = db.query(User).filter(User.email == "aish@test.com").first()
        vendors = db.query(Vendor).filter(Vendor.status == VendorStatus.APPROVED).all()
        if not admin or not vendors:
            print("Need the aish@test.com user and approved vendors first.")
            return

        now = datetime.now(timezone.utc)
        counter = 1
        status_counts = {}

        for offset in range(5, -1, -1):
            for _ in range(random.randint(3, 5)):
                vendor = random.choice(vendors)
                catalog = ITEMS_BY_CATEGORY.get(vendor.category.value, [("General supplies", 10000)])
                order_date = month_start(offset) + timedelta(days=random.randint(1, 25))
                expected = order_date + timedelta(days=random.randint(7, 14))
                status = pick_status(offset)

                actual = None
                if status in (OrderStatus.DELIVERED, OrderStatus.COMPLETED):
                    actual = expected + timedelta(days=random.choice([-2, -1, 0, 0, 1, 2, 4, 6]))
                    if actual > now:
                        actual = now

                items, subtotal, tax_total = [], 0.0, 0.0
                for desc, price in random.sample(catalog, k=min(len(catalog), random.randint(1, 2))):
                    qty = random.randint(1, 8) if price > 30000 else random.randint(5, 40)
                    base = qty * price
                    tax = base * 0.18
                    subtotal += base
                    tax_total += tax
                    items.append(PurchaseOrderItem(
                        item_description=desc, quantity=qty, unit_price=price,
                        tax_percent=18, line_total=round(base + tax, 2),
                    ))

                po = PurchaseOrder(
                    order_number=f"PO-SEED-{counter:04d}",
                    vendor_id=vendor.id,
                    created_by_id=admin.id,
                    department=random.choice(DEPARTMENTS),
                    payment_terms="Net 30",
                    shipping_address="HQ, Bengaluru",
                    billing_address="HQ, Bengaluru",
                    remarks="Seeded demo order",
                    order_date=order_date,
                    expected_delivery_date=expected,
                    actual_delivery_date=actual,
                    subtotal=round(subtotal, 2),
                    tax_amount=round(tax_total, 2),
                    total_amount=round(subtotal + tax_total, 2),
                    status=status,
                    items=items,
                )
                db.add(po)
                status_counts[status.value] = status_counts.get(status.value, 0) + 1
                counter += 1

        db.commit()

        # Recalculate stored scores + add a history point so trends reflect the new orders
        for v in vendors:
            data = calculate_reliability_score(db, v.id)
            if data["total_records"] > 0:
                v.previous_reliability_score = v.reliability_score
                v.reliability_score = data["reliability_score"]
                db.add(ScoreHistory(vendor_id=v.id, score=data["reliability_score"]))
        db.commit()

        print(f"Created {counter - 1} purchase orders across 6 months.")
        print("By status:", status_counts)
    finally:
        db.close()


if __name__ == "__main__":
    main()