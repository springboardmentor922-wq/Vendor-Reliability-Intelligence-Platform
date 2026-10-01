import asyncio
import uuid
from httpx import AsyncClient

BASE_URL = "http://127.0.0.1:8000"

async def test_complete_dashboard_suite():
    print("==================================================================")
    print("COMPREHENSIVE DASHBOARD CHARTS & REAL-TIME REFRESH VERIFICATION")
    print("==================================================================")

    async with AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # 1. Authenticate Admin
        print("\n[STEP 1] Authenticating as Administrator...")
        admin_login = await client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "Admin@123456"})
        assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
        admin_token = admin_login.json()["access_token"]
        admin_h = {"Authorization": f"Bearer {admin_token}"}
        print("  -> Admin authenticated.")

        # 2. Authenticate Procurement Manager
        print("\n[STEP 2] Authenticating as Procurement Manager...")
        pm_login = await client.post("/api/v1/auth/login", json={"email": "pm@example.com", "password": "Procurement@123456"})
        assert pm_login.status_code == 200, f"PM login failed: {pm_login.text}"
        pm_token = pm_login.json()["access_token"]
        pm_h = {"Authorization": f"Bearer {pm_token}"}
        print("  -> Procurement Manager authenticated.")

        # 3. Authenticate Vendor
        print("\n[STEP 3] Authenticating as Vendor...")
        v_login = await client.post("/api/v1/auth/login", json={"email": "vendor_user@example.com", "password": "Vendor@123456"})
        assert v_login.status_code == 200, f"Vendor login failed: {v_login.text}"
        v_token = v_login.json()["access_token"]
        v_h = {"Authorization": f"Bearer {v_token}"}
        print("  -> Vendor authenticated.")

        # 4. Verify Admin Dashboard Charts
        print("\n[STEP 4] Verifying Administrator Dashboard Charts (/api/v1/dashboard/admin/charts)...")
        admin_charts = await client.get("/api/v1/dashboard/admin/charts", headers=admin_h)
        assert admin_charts.status_code == 200, f"Admin charts failed: {admin_charts.text}"
        ac_data = admin_charts.json()

        print(f"  -> Top Stats: Users={ac_data['total_users']} ({ac_data['users_change_pct']}), Vendors={ac_data['total_vendors']} ({ac_data['vendors_change_pct']}), Contracts={ac_data['total_contracts']} ({ac_data['contracts_change_pct']}), Uptime={ac_data['system_uptime']}")
        print(f"  -> Chart 1: User Management Donut - Roles: {ac_data['user_management']['roles']}, Counts: {ac_data['user_management']['counts']}")
        print(f"  -> Chart 2: Vendor Risk Distribution Bar - Levels: {ac_data['vendor_risk_distribution']['risk_levels']}, Counts: {ac_data['vendor_risk_distribution']['counts']}")
        print(f"  -> Chart 3: Procurement Reports Combo - Months: {ac_data['procurement_reports']['months']}, Spend: {ac_data['procurement_reports']['costs']}")
        print(f"  -> Chart 4: Compliance Monitoring Donut - Labels: {ac_data['compliance_monitoring']['labels']}, Counts: {ac_data['compliance_monitoring']['counts']}")
        print(f"  -> Chart 5: System Telemetry Tiles - DB Size: {ac_data['system_statistics']['database_size']}, Storage: {ac_data['system_statistics']['storage_usage']}, Active Sessions: {ac_data['system_statistics']['active_sessions']}, Latency: {ac_data['system_statistics']['api_response_time']}")

        assert len(ac_data["user_management"]["roles"]) >= 3
        assert len(ac_data["procurement_reports"]["months"]) == 6
        assert len(ac_data["vendor_risk_distribution"]["counts"]) == 3
        print("  -> Administrator charts verified successfully.")

        # 5. Verify Procurement Dashboard Charts
        print("\n[STEP 5] Verifying Procurement Dashboard Charts (/api/v1/dashboard/procurement/charts)...")
        proc_charts = await client.get("/api/v1/dashboard/procurement/charts", headers=pm_h)
        assert proc_charts.status_code == 200, f"Procurement charts failed: {proc_charts.text}"
        pc_data = proc_charts.json()

        initial_po_count = pc_data["total_purchase_orders"]
        initial_spend = pc_data["total_procurement_cost"]

        print(f"  -> Top Stats: Total POs={pc_data['total_purchase_orders']} ({pc_data['po_change_pct']}), Total Spend=${pc_data['total_procurement_cost']} ({pc_data['cost_change_pct']}), Active Vendors={pc_data['active_vendors']} ({pc_data['active_vendors_change_pct']}), Items Procured={pc_data['items_procured']} ({pc_data['items_change_pct']})")
        print(f"  -> Chart 1: Procurement Overview Combo - Months: {pc_data['procurement_overview']['months']}, Costs: {pc_data['procurement_overview']['costs']}, Volume: {pc_data['procurement_overview']['po_counts']}")
        print(f"  -> Chart 2: Active Purchase Orders Donut - Labels: {pc_data['active_purchase_orders']['labels']}, Counts: {pc_data['active_purchase_orders']['counts']}")
        print(f"  -> Chart 3: Vendor Performance Summary Radar - Categories: {pc_data['vendor_performance_summary']['categories']}, Scores: {pc_data['vendor_performance_summary']['scores']}")
        print(f"  -> Chart 4: Procurement Cost Analysis Donut - Categories: {pc_data['procurement_cost_analysis']['categories']}, Costs: {pc_data['procurement_cost_analysis']['costs']}")
        print(f"  -> Chart 5: Delivery Status Gauge - On-Time: {pc_data['delivery_status']['on_time_rate']}%, Delayed: {pc_data['delivery_status']['delayed_rate']}%, Total Deliveries: {pc_data['delivery_status']['total_deliveries']}")

        assert len(pc_data["procurement_overview"]["months"]) == 6
        assert len(pc_data["vendor_performance_summary"]["categories"]) == 5
        assert pc_data["delivery_status"]["on_time_rate"] > 0
        print("  -> Procurement charts verified successfully.")

        # 6. Verify Vendor Dashboard Charts
        print("\n[STEP 6] Verifying Vendor Dashboard Charts (/api/v1/dashboard/vendor/{vendor_id}/charts)...")
        # Fetch vendor list to find vendor_user's vendor
        vendors_resp = await client.get("/api/v1/vendors", headers=v_h)
        assert vendors_resp.status_code == 200
        vendors = vendors_resp.json()
        my_vendor = next((v for v in vendors if v["company_name"] == "Apex Strategic Systems"), vendors[0])
        my_vendor_id = my_vendor["id"]

        vendor_charts = await client.get(f"/api/v1/dashboard/vendor/{my_vendor_id}/charts", headers=v_h)
        assert vendor_charts.status_code == 200, f"Vendor charts failed: {vendor_charts.text}"
        vc_data = vendor_charts.json()

        print(f"  -> Vendor: {vc_data['company_name']}")
        print(f"  -> Top Stats: Perf={vc_data['performance_score']}% ({vc_data['performance_score_change_pct']}), Rel={vc_data['reliability_score']}% ({vc_data['reliability_score_change_pct']}), Contracts={vc_data['active_contracts']} ({vc_data['contracts_change_pct']}), Orders={vc_data['total_orders']} ({vc_data['orders_change_pct']})")
        print(f"  -> Chart 1: Vendor Performance Grouped Bar - Labels: {vc_data['vendor_performance']['labels']}, Vendor Scores: {vc_data['vendor_performance']['vendor_scores']}, Peer Scores: {vc_data['vendor_performance']['peer_average_scores']}")
        print(f"  -> Chart 2: Reliability Score Trend Line - Dates: {vc_data['reliability_score_trend']['dates']}, Scores: {vc_data['reliability_score_trend']['scores']}")
        print(f"  -> Chart 3: Contract Status Donut - Labels: {vc_data['contract_status']['labels']}, Counts: {vc_data['contract_status']['counts']}")
        print(f"  -> Chart 4: Order History Combo - Months: {vc_data['order_history']['months']}, Values: {vc_data['order_history']['order_values']}, Counts: {vc_data['order_history']['order_counts']}")
        print(f"  -> Chart 5: Communication Activity Donut - Labels: {vc_data['communication_activity']['labels']}, Counts: {vc_data['communication_activity']['counts']}")

        assert len(vc_data["vendor_performance"]["labels"]) == 4
        assert len(vc_data["reliability_score_trend"]["scores"]) >= 3
        print("  -> Vendor charts verified successfully.")

        # 7. Test Real-Time Data Update: Create a new PO and verify charts update
        print("\n[STEP 7] Testing Real-Time Chart Update (Creating a new Purchase Order)...")
        # Create a PO directly
        po_payload = {
            "vendor_id": my_vendor_id,
            "items": [{"item_name": "Realtime Sensor Grid", "quantity": 10.0, "unit_price": 500.0}]
        }
        po_resp = await client.post("/api/v1/purchase-orders", json=po_payload, headers=pm_h)
        assert po_resp.status_code == 201, f"PO creation failed: {po_resp.text}"
        new_po_data = po_resp.json()
        print(f"  -> Created PO: {new_po_data['po_number']} with amount ${new_po_data['total_amount']}")

        # Fetch procurement charts again to confirm real-time update
        updated_proc_charts = await client.get("/api/v1/dashboard/procurement/charts", headers=pm_h)
        assert updated_proc_charts.status_code == 200
        upc_data = updated_proc_charts.json()

        print(f"  -> Updated PO count: {upc_data['total_purchase_orders']} (Previous: {initial_po_count})")
        print(f"  -> Updated Total Spend: ${upc_data['total_procurement_cost']} (Previous: ${initial_spend})")
        assert upc_data["total_purchase_orders"] == initial_po_count + 1
        assert upc_data["total_procurement_cost"] == initial_spend + 5000.0
        print("  -> Real-time chart aggregation update CONFIRMED!")

        # 8. Cross-role RBAC isolation
        print("\n[STEP 8] Verifying Cross-Role RBAC Isolation...")
        # Vendor cannot access Admin charts
        v_admin_resp = await client.get("/api/v1/dashboard/admin/charts", headers=v_h)
        assert v_admin_resp.status_code == 403
        print("  -> Vendor denied access to /dashboard/admin/charts (403 Forbidden).")

        # Vendor cannot access random other vendor's charts
        other_vendor_id = str(uuid.uuid4())
        cross_v_resp = await client.get(f"/api/v1/dashboard/vendor/{other_vendor_id}/charts", headers=v_h)
        assert cross_v_resp.status_code in (403, 404)
        print(f"  -> Vendor denied access to unauthorized vendor charts ({cross_v_resp.status_code}).")

        # Unauthenticated request
        unauth_resp = await client.get("/api/v1/dashboard/procurement/charts")
        assert unauth_resp.status_code == 401
        print("  -> Unauthenticated request rejected (401 Unauthorized).")

    print("\n==================================================================")
    print("ALL DASHBOARD CHARTS, AGGREGATIONS & REAL-TIME REFRESH TESTS PASSED!")
    print("==================================================================")

if __name__ == "__main__":
    asyncio.run(test_complete_dashboard_suite())
