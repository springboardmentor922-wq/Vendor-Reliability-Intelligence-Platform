import asyncio
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models import (
    Vendor, PurchaseOrder, POItem, Contract, Communication,
    VendorPerformance, VendorReliability, User, ActivityLog
)

async def seed_chart_history():
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        po_count = (await db.execute(select(PurchaseOrder))).scalars().all()
        if len(po_count) >= 15:
            print(f"Already have {len(po_count)} POs. Seeding skipped.")
            return

        vendors = (await db.execute(select(Vendor))).scalars().all()
        if not vendors:
            print("No vendors found to seed.")
            return

        users = (await db.execute(select(User))).scalars().all()
        admin_user = next((u for u in users if any(r.name == 'Administrator' for r in u.roles)), users[0] if users else None)

        vendor_map = {v.company_name: v for v in vendors}
        
        # Monthly distributions for past 6 months (Apr 2026 to Sep 2026)
        months_data = [
            (datetime(2026, 4, 12, 10, 0, 0), "PO-202604-01", Decimal("14250.00"), "COMPLETED", "delivered", 45),
            (datetime(2026, 4, 25, 14, 0, 0), "PO-202604-02", Decimal("8900.00"), "DELIVERED", "delivered", 20),
            (datetime(2026, 5, 8, 9, 30, 0), "PO-202605-01", Decimal("22400.00"), "COMPLETED", "delivered", 60),
            (datetime(2026, 5, 20, 16, 0, 0), "PO-202605-02", Decimal("11200.00"), "DELIVERED", "delivered", 35),
            (datetime(2026, 6, 11, 11, 15, 0), "PO-202606-01", Decimal("19800.00"), "COMPLETED", "delivered", 50),
            (datetime(2026, 6, 28, 15, 45, 0), "PO-202606-02", Decimal("16750.00"), "DELIVERED", "delivered", 40),
            (datetime(2026, 7, 5, 10, 20, 0), "PO-202607-01", Decimal("31500.00"), "COMPLETED", "delivered", 85),
            (datetime(2026, 7, 19, 13, 10, 0), "PO-202607-02", Decimal("14900.00"), "DELIVERED", "delivered", 30),
            (datetime(2026, 8, 3, 9, 0, 0), "PO-202608-01", Decimal("27800.00"), "COMPLETED", "delivered", 70),
            (datetime(2026, 8, 16, 14, 30, 0), "PO-202608-02", Decimal("18300.00"), "DELIVERED", "delivered", 45),
            (datetime(2026, 8, 27, 16, 0, 0), "PO-202608-03", Decimal("9500.00"), "SENT_TO_VENDOR", "in_progress", 25),
            (datetime(2026, 9, 2, 10, 0, 0), "PO-202609-01", Decimal("34200.00"), "IN_FULFILLMENT", "in_progress", 90),
            (datetime(2026, 9, 10, 12, 0, 0), "PO-202609-02", Decimal("12800.00"), "SENT_TO_VENDOR", "in_progress", 30),
            (datetime(2026, 9, 18, 15, 0, 0), "PO-202609-03", Decimal("7600.00"), "CANCELLED", "in_progress", 15),
        ]

        # Seed Purchase Orders with realistic items
        for i, (dt, po_num, amount, status, del_status, qty) in enumerate(months_data):
            v = vendors[i % len(vendors)]
            po = PurchaseOrder(
                vendor_id=v.id,
                po_number=po_num,
                status=status,
                delivery_status=del_status,
                total_amount=amount,
                invoice_amount=amount,
                created_at=dt
            )
            db.add(po)
            await db.flush()

            # Add PO Line item
            item = POItem(
                po_id=po.id,
                item_name=f"Enterprise Components Lot #{i+1}",
                quantity=Decimal(str(qty)),
                unit_price=Decimal(str(round(float(amount) / qty, 2)))
            )
            db.add(item)

        # Seed Contracts
        now = datetime.utcnow()
        contract_data = [
            ("Master Supply & Materials Agreement", "ACTIVE", now - timedelta(days=120), now + timedelta(days=240), "None. Verified compliant."),
            ("Strategic Logistics SLA 2026", "ACTIVE", now - timedelta(days=90), now + timedelta(days=18), "Insurance renewal due in 14 days."), # Expiring soon
            ("Maintenance & Facility Support", "ACTIVE", now - timedelta(days=60), now + timedelta(days=300), "None. Full compliance."),
            ("IT Consulting & Infrastructure Agreement", "EXPIRED", now - timedelta(days=400), now - timedelta(days=35), "Expired. Renewal contract pending."),
            ("Hardware & Equipment Master Services", "ACTIVE", now - timedelta(days=30), now + timedelta(days=15), "ISO audit pending review."), # Expiring soon
        ]

        for i, (title, c_status, start_d, end_d, flags) in enumerate(contract_data):
            v = vendors[i % len(vendors)]
            c = Contract(
                vendor_id=v.id,
                title=title,
                start_date=start_d,
                end_date=end_d,
                renewal_notice_period_days=Decimal("30"),
                terms="Standard enterprise procurement terms & conditions.",
                compliance_flags=flags,
                status=c_status,
                created_at=start_d
            )
            db.add(c)

        # Seed Historical Reliability Snapshots for vendors (to give rich line chart trend)
        for v in vendors:
            # Check existing snapshots
            existing_snaps = (await db.execute(select(VendorReliability).where(VendorReliability.vendor_id == v.id))).scalars().all()
            if len(existing_snaps) < 3:
                base_score = 90.0 if "Apex" in v.company_name or "Titan" in v.company_name else 84.0
                for m_offset in [5, 4, 3, 2, 1, 0]:
                    snap_date = now - timedelta(days=m_offset * 30)
                    score = min(100.0, max(70.0, base_score + (5 - m_offset) * 1.5 - (0.5 if m_offset % 2 == 0 else 0)))
                    risk = "Low" if score >= 85 else ("Medium" if score >= 70 else "High")
                    snap = VendorReliability(
                        vendor_id=v.id,
                        delivery_score=round(score + 1.0, 1),
                        quality_score=round(score - 0.5, 1),
                        communication_score=round(score + 2.0, 1),
                        compliance_score=round(score, 1),
                        overall_reliability_score=round(score, 1),
                        risk_level=risk,
                        computed_at=snap_date
                    )
                    db.add(snap)

        # Seed Communications & Activity Logs
        if admin_user:
            comm_samples = [
                ("Order Fulfillment Inquiry", "Can you confirm the tracking details for the Q3 batch?"),
                ("RFQ Specification Review", "Specifications have been reviewed and approved by engineering."),
                ("Delivery Schedule Update", "Delivery scheduled for Monday 10:00 AM at Bay 4."),
                ("Quality Inspection Certificate", "Please find attached the signed inspection certificate."),
                ("Contract Terms Clarification", "Reviewed clause 8.2 regarding payment milestones."),
            ]
            for i, (subj, msg) in enumerate(comm_samples):
                v = vendors[i % len(vendors)]
                comm = Communication(
                    vendor_id=v.id,
                    sender_id=admin_user.id,
                    sender_role="Administrator",
                    message=f"[{subj}] {msg}",
                    created_at=now - timedelta(days=i*4 + 2)
                )
                db.add(comm)

                act = ActivityLog(
                    user_id=admin_user.id,
                    action="SENT_MESSAGE",
                    entity_type="communication",
                    entity_id=v.id,
                    details=f"Admin sent {subj} to {v.company_name}",
                    created_at=now - timedelta(days=i*4 + 2)
                )
                db.add(act)

        await db.commit()
        print("Successfully seeded rich historical data for charts!")

if __name__ == "__main__":
    asyncio.run(seed_chart_history())
