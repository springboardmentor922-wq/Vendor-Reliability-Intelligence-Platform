import sys
from datetime import datetime, timedelta
from app.db.session import SessionLocal
from app.models.user import User
from app.models.vendor import Vendor
from app.models.procurement import ProcurementRequest
from app.models.vendor_selection import VendorSelection
from app.models.financial_approval import FinancialApproval
from app.models.purchase_order import PurchaseOrder
from app.models.delivery import Delivery
from app.models.invoice import Invoice
from app.routers.requisitions import format_pr_response

def test_order_tracking_lifecycle():
    db = SessionLocal()
    try:
        proc_user = db.query(User).filter(User.role == "Procurement Manager").first()
        fin_user = db.query(User).filter(User.role == "Finance Officer").first()
        scm_user = db.query(User).filter(User.role == "Supply Chain Manager").first()
        vendor = db.query(Vendor).filter(Vendor.status.in_(["Approved", "Active"])).first()

        assert proc_user is not None, "Procurement Manager not found"
        assert fin_user is not None, "Finance Officer not found"
        assert scm_user is not None, "Supply Chain Manager not found"
        assert vendor is not None, "Active Verified Vendor not found"

        count = db.query(ProcurementRequest).count() + 1
        pr_number = f"PR-TEST-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        # 1. PR Created
        pr = ProcurementRequest(
            request_number=pr_number,
            department="IT Infrastructure",
            title="High Performance Laptops Lifecycle Test",
            description="Testing moving order tracking synchronization",
            quantity=20.0,
            required_date=datetime.utcnow() + timedelta(days=14),
            priority="High",
            category=vendor.category,
            estimated_budget=150000.0,
            status="SUBMITTED",
            requested_by_id=proc_user.id
        )
        db.add(pr)
        db.commit()
        db.refresh(pr)

        data = format_pr_response(pr, db)
        assert data["status"] == "SUBMITTED", f"Expected SUBMITTED, got {data['status']}"
        print(f"[PASS] Stage 1 (PR Submitted): Status={data['status']}, RequestNumber={data['request_number']}")

        # 2. Vendor Selected
        sel = VendorSelection(
            requisition_id=pr.id,
            vendor_id=vendor.id,
            selected_by_id=proc_user.id,
            quotation_amount=145000.0,
            justification="Best reliability score in category",
            status="Awaiting Financial Approval"
        )
        db.add(sel)
        pr.assigned_vendor_id = vendor.id
        pr.status = "VENDOR_SELECTED"
        db.commit()
        db.refresh(pr)

        data = format_pr_response(pr, db)
        assert data["status"] == "VENDOR_SELECTED", f"Expected VENDOR_SELECTED, got {data['status']}"
        assert data["selected_vendor"]["name"] == vendor.name
        print(f"[PASS] Stage 2 (Vendor Selected): Status={data['status']}, Vendor={data['selected_vendor']['name']}")

        # 3. Finance Approved
        fin = FinancialApproval(
            requisition_id=pr.id,
            vendor_selection_id=sel.id,
            approved_by_id=fin_user.id,
            status="Approved",
            budget_allocated=145000.0,
            comments="Budget approved within organizational limits"
        )
        db.add(fin)
        pr.status = "Approved"
        db.commit()
        db.refresh(pr)

        data = format_pr_response(pr, db)
        assert data["status"] == "Approved", f"Expected Approved, got {data['status']}"
        assert data["financial_approval"]["status"] == "Approved"
        print(f"[PASS] Stage 3 (Finance Approved): Status={data['status']}, Budget=${data['financial_approval']['budget_allocated']}")

        # 4. SCM Creates & Issues PO (Ordered)
        po_number = f"PO-TEST-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        po = PurchaseOrder(
            po_number=po_number,
            procurement_request_id=pr.id,
            vendor_id=vendor.id,
            created_by_id=scm_user.id,
            total_amount=145000.0,
            status="Issued",
            terms_and_conditions="Net 30 Payment Terms"
        )
        db.add(po)
        pr.status = "Ordered"
        db.commit()
        db.refresh(pr)
        db.refresh(po)

        data = format_pr_response(pr, db)
        assert data["status"] == "Ordered", f"Expected Ordered, got {data['status']}"
        assert data["purchase_order"]["po_number"] == po_number
        assert data["purchase_order"]["status"] == "Issued"
        print(f"[PASS] Stage 4 (PO Ordered/Issued): Status={data['status']}, PO={data['purchase_order']['po_number']}")

        # 5. Vendor Dispatches with Carrier & Tracking (In Transit)
        po.carrier = "FedEx Express Logistics"
        po.tracking_number = "TRK-987654321"
        po.dispatch_date = datetime.utcnow()
        po.expected_delivery_date = datetime.utcnow() + timedelta(days=3)
        po.status = "In Transit"
        pr.status = "In Transit"
        db.commit()
        db.refresh(pr)

        data = format_pr_response(pr, db)
        assert data["status"] == "In Transit", f"Expected In Transit, got {data['status']}"
        assert data["purchase_order"]["carrier"] == "FedEx Express Logistics"
        assert data["purchase_order"]["tracking_number"] == "TRK-987654321"
        print(f"[PASS] Stage 5 (In Transit): Status={data['status']}, Carrier={data['purchase_order']['carrier']}, Tracking={data['purchase_order']['tracking_number']}")

        # 6. Physical Delivery Inspected & Received (Delivered)
        deliv = Delivery(
            purchase_order_id=po.id,
            carrier="FedEx Express Logistics",
            tracking_number="TRK-987654321",
            expected_delivery_date=datetime.utcnow() + timedelta(days=1),
            actual_delivery_date=datetime.utcnow(),
            delivery_status="Delivered",
            delay_days=0,
            delivered_quantity=20,
            ordered_quantity=20
        )
        db.add(deliv)
        po.status = "Delivered"
        pr.status = "Delivered"
        db.commit()
        db.refresh(pr)

        data = format_pr_response(pr, db)
        assert data["status"] == "Delivered", f"Expected Delivered, got {data['status']}"
        assert data["purchase_order"]["delivery_status"] == "Delivered"
        assert data["purchase_order"]["delay_days"] == 0
        assert data["purchase_order"]["delivered_quantity"] == 20
        print(f"[PASS] Stage 6 (Delivered): Status={data['status']}, DeliveryStatus={data['purchase_order']['delivery_status']}, QtyDelivered={data['purchase_order']['delivered_quantity']}")

        # 7. Invoice Verified & Settled (Completed)
        inv = Invoice(
            purchase_order_id=po.id,
            vendor_id=vendor.id,
            invoice_number=f"INV-TEST-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            amount=145000.0,
            status="PAID"
        )
        db.add(inv)
        po.status = "Completed"
        pr.status = "Completed"
        db.commit()
        db.refresh(pr)

        data = format_pr_response(pr, db)
        assert data["status"] == "Completed", f"Expected Completed, got {data['status']}"
        assert data["purchase_order"]["is_paid"] is True
        assert data["purchase_order"]["invoice_number"] == inv.invoice_number
        print(f"[PASS] Stage 7 (Completed & Paid): Status={data['status']}, Invoice={data['purchase_order']['invoice_number']}, IsPaid={data['purchase_order']['is_paid']}")

        print("\n==========================================")
        print("ALL 7 MOVING ORDER LIFECYCLE STAGES VERIFIED!")
        print("==========================================")

    finally:
        db.close()

if __name__ == "__main__":
    test_order_tracking_lifecycle()
