from datetime import date

def get_auth_token(client):
    res = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@vendoriq.com", "password": "admin123"}
    )
    return res.json()["access_token"]

def test_get_vendors(client):
    token = get_auth_token(client)
    res = client.get("/api/v1/vendors/", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 2
    assert any(v["company_name"] == "Apex Logistics & Supply Co." for v in data)

def test_create_vendor(client):
    token = get_auth_token(client)
    payload = {
        "company_name": "Precision Optics Ltd",
        "contact_name": "David Clark",
        "email": "dave@precisionoptics.com",
        "phone": "+1 555-1234",
        "address": "90 Optics Way",
        "category": "Equipment Vendors"
    }
    res = client.post("/api/v1/vendors/", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    data = res.json()
    assert data["company_name"] == "Precision Optics Ltd"
    assert data["status"] == "Approved"

def test_get_and_create_orders(client):
    token = get_auth_token(client)
    # 1. Get orders
    res = client.get("/api/v1/procurement/orders", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    orders = res.json()
    assert len(orders) >= 2

    # 2. Create order
    po_payload = {
        "vendor_id": 1,
        "title": "Automated Test Order",
        "total_amount": 12500.0,
        "expected_delivery_date": str(date.today())
    }
    create_res = client.post("/api/v1/procurement/orders", json=po_payload, headers={"Authorization": f"Bearer {token}"})
    assert create_res.status_code == 201
    new_order = create_res.json()
    assert new_order["title"] == "Automated Test Order"
    assert new_order["status"] == "Pending"

    # 3. Update status
    order_id = new_order["id"]
    status_res = client.patch(
        f"/api/v1/procurement/orders/{order_id}/status",
        json={"status": "Approved"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "Approved"

def test_contracts_api(client):
    token = get_auth_token(client)
    res = client.get("/api/v1/contracts/", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    contracts = res.json()
    assert len(contracts) >= 1

def test_analytics_api(client):
    token = get_auth_token(client)
    summary_res = client.get("/api/v1/analytics/summary", headers={"Authorization": f"Bearer {token}"})
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert "total_vendors" in summary
    assert "total_purchase_orders" in summary
    assert "total_spend" in summary

    charts_res = client.get("/api/v1/analytics/charts", headers={"Authorization": f"Bearer {token}"})
    assert charts_res.status_code == 200
    charts = charts_res.json()
    assert "leaderboard" in charts
    assert "monthly_spend" in charts

def test_full_role_workflow_lifecycle(client):
    # Log in as different roles
    procure_res = client.post("/api/v1/auth/login", data={"username": "procurement@vendoriq.com", "password": "procure123"})
    procure_token = procure_res.json()["access_token"]

    vendor_res = client.post("/api/v1/auth/login", data={"username": "vendor@vendoriq.com", "password": "vendor123"})
    vendor_token = vendor_res.json()["access_token"]

    supply_res = client.post("/api/v1/auth/login", data={"username": "supplychain@vendoriq.com", "password": "supply123"})
    supply_token = supply_res.json()["access_token"]

    finance_res = client.post("/api/v1/auth/login", data={"username": "finance@vendoriq.com", "password": "finance123"})
    finance_token = finance_res.json()["access_token"]

    # 1. Procurement Manager creates Requisition (Pending)
    create_res = client.post(
        "/api/v1/procurement/orders",
        json={
            "vendor_id": 1,
            "title": "Full Cycle Logistics Transport",
            "total_amount": 25000.0,
            "expected_delivery_date": str(date.today())
        },
        headers={"Authorization": f"Bearer {procure_token}"}
    )
    assert create_res.status_code == 201
    order = create_res.json()
    order_id = order["id"]
    assert order["status"] == "Pending"

    # 2. Procurement Manager approves (Approved)
    approve_res = client.patch(
        f"/api/v1/procurement/orders/{order_id}/approve",
        headers={"Authorization": f"Bearer {procure_token}"}
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "Approved"

    # 3. Vendor dispatches with Carrier & Tracking (Ordered)
    dispatch_res = client.patch(
        f"/api/v1/procurement/orders/{order_id}/dispatch",
        json={"carrier_name": "FedEx Freight", "tracking_number": "TRK-FDX-771122"},
        headers={"Authorization": f"Bearer {vendor_token}"}
    )
    assert dispatch_res.status_code == 200
    assert dispatch_res.json()["status"] == "Ordered"
    assert dispatch_res.json()["tracking_number"] == "TRK-FDX-771122"

    # 4. Supply Chain Manager receives and conducts QA scoring (Delivered)
    receive_res = client.patch(
        f"/api/v1/procurement/orders/{order_id}/receive",
        json={"quality_rating": 4.9, "qa_notes": "All pallets inspected with 100% manifest match."},
        headers={"Authorization": f"Bearer {supply_token}"}
    )
    assert receive_res.status_code == 200
    assert receive_res.json()["status"] == "Delivered"
    assert receive_res.json()["quality_rating"] == 4.9

    # 5. Vendor submits Invoice (Invoice Submitted)
    invoice_res = client.patch(
        f"/api/v1/procurement/orders/{order_id}/invoice",
        json={"invoice_number": "INV-2026-9999", "invoice_amount": 25000.0},
        headers={"Authorization": f"Bearer {vendor_token}"}
    )
    assert invoice_res.status_code == 200
    assert invoice_res.json()["invoice_status"] == "Submitted"

    # 6. Finance Officer authorizes payment (Completed)
    pay_res = client.patch(
        f"/api/v1/procurement/orders/{order_id}/pay",
        json={"payment_notes": "3-Way Match verified against dock receipt. Settled."},
        headers={"Authorization": f"Bearer {finance_token}"}
    )
    assert pay_res.status_code == 200
    assert pay_res.json()["status"] == "Completed"
    assert pay_res.json()["invoice_status"] == "Paid"

def test_notifications_api(client):
    res = client.post("/api/v1/auth/login", data={"username": "procurement@vendoriq.com", "password": "procure123"})
    token = res.json()["access_token"]

    notifs_res = client.get("/api/v1/notifications/", headers={"Authorization": f"Bearer {token}"})
    assert notifs_res.status_code == 200
    data = notifs_res.json()
    assert isinstance(data, list)

    read_res = client.patch("/api/v1/notifications/read-all", headers={"Authorization": f"Bearer {token}"})
    assert read_res.status_code == 200
