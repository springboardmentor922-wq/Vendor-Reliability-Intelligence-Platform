import asyncio
import sys
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models import Role, User
from app.security import get_password_hash
from sqlalchemy.future import select

async def run_tests():
    print("==================================================")
    print("STARTING COMPREHENSIVE MILESTONE 1, 2 & 3 TESTS")
    print("==================================================")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:

        # 0. Ensure Admin user exists
        async with AsyncSessionLocal() as db:
            r_stmt = select(Role).where(Role.name == "Administrator")
            admin_role = (await db.execute(r_stmt)).scalar_one_or_none()
            if not admin_role:
                admin_role = Role(name="Administrator")
                db.add(admin_role)
                await db.commit()
                await db.refresh(admin_role)

            u_stmt = select(User).where(User.email == "admin@example.com")
            admin_user = (await db.execute(u_stmt)).scalar_one_or_none()
            if not admin_user:
                admin_user = User(
                    email="admin@example.com",
                    hashed_password=get_password_hash("Admin@123456"),
                    full_name="System Administrator",
                    status="APPROVED",
                    roles=[admin_role]
                )
                db.add(admin_user)
                await db.commit()

        # 1. Authenticate Admin
        print("\n[TEST 1] Authenticate as Administrator...")
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": "admin@example.com",
            "password": "Admin@123456"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token_data = login_resp.json()
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("  -> Logged in successfully. Token acquired.")

        # 2. Milestone 1 Regression: Create and List Vendors
        print("\n[TEST 2] Milestone 1: Create and List Vendors...")
        vendor_payload = {
            "company_name": "Titan Precision Logistics",
            "registration_no": f"REG-TITAN-{asyncio.get_event_loop().time():.2f}",
            "category": "Logistics",
            "status": "approved",
            "review_notes": "Tier-1 logistics partner with ISO certifications.",
            "contacts": [{"name": "Marcus Vance", "email": "marcus@titan.com", "phone": "+1 555-9011"}]
        }
        v_create_resp = await client.post("/api/v1/vendors", json=vendor_payload, headers=headers)
        assert v_create_resp.status_code == 201, f"Vendor creation failed: {v_create_resp.text}"
        vendor = v_create_resp.json()
        vendor_id = vendor["id"]
        print(f"  -> Created vendor: {vendor['company_name']} ({vendor_id})")

        v_list_resp = await client.get("/api/v1/vendors", headers=headers)
        assert v_list_resp.status_code == 200
        vendors = v_list_resp.json()
        assert any(v["id"] == vendor_id for v in vendors)
        print(f"  -> Vendor listing confirmed ({len(vendors)} vendors found).")

        # 3. Milestone 1 & 2 Regression: Create PR, Items, and PO
        print("\n[TEST 3] Milestone 1 & 2: Requisitions and PO Generation...")
        pr_payload = {
            "title": "Industrial Precision Motors Requisition",
            "description": "Critical replacement units for manufacturing hub",
            "line_items": [
                {"item_name": "Brushless Servo Motor 400W", "quantity": 10.0, "estimated_cost": 250.0},
                {"item_name": "Encoder Cable 5m", "quantity": 10.0, "estimated_cost": 45.0}
            ]
        }
        pr_resp = await client.post("/api/v1/procurement-requests", json=pr_payload, headers=headers)
        assert pr_resp.status_code == 201, f"PR creation failed: {pr_resp.text}"
        pr = pr_resp.json()
        pr_id = pr["id"]
        print(f"  -> Created PR: {pr['title']} (Total Est: ${pr['total_estimated_cost']})")

        # Approve PR
        pr_app_resp = await client.patch(f"/api/v1/procurement-requests/{pr_id}/status", json={"status": "approved"}, headers=headers)
        assert pr_app_resp.status_code == 200

        # Generate PO from PR
        po_resp = await client.post(f"/api/v1/purchase-orders/from-pr/{pr_id}", json={"vendor_id": vendor_id}, headers=headers)
        assert po_resp.status_code == 201, f"PO generation failed: {po_resp.text}"
        po = po_resp.json()
        po_id = po["id"]
        print(f"  -> Generated PO: {po['po_number']} with vendor {po['vendor_name']}")

        # Update PO Delivery Status
        po_stat_resp = await client.patch(f"/api/v1/purchase-orders/{po_id}/delivery-status", json={"delivery_status": "delivered"}, headers=headers)
        assert po_stat_resp.status_code == 200
        print("  -> PO marked as delivered.")

        # 4. Milestone 2 Regression: Create and List Contracts
        print("\n[TEST 4] Milestone 2: Contracts...")
        contract_payload = {
            "vendor_id": vendor_id,
            "title": "Master Logistics Service Level Agreement",
            "start_date": "2026-01-01T00:00:00",
            "end_date": "2027-12-31T00:00:00",
            "renewal_notice_period_days": 45,
            "terms": "Standard SLAs with 98% uptime and 24hr response window.",
            "compliance_flags": "None. Fully verified.",
            "status": "ACTIVE"
        }
        c_resp = await client.post("/api/v1/contracts", json=contract_payload, headers=headers)
        assert c_resp.status_code == 201, f"Contract creation failed: {c_resp.text}"
        print("  -> Contract created successfully.")

        # 5. Milestone 3 Group A: Record Performance Entries
        print("\n[TEST 5] Milestone 3: Record Performance Evaluations...")
        entries = [
            {"on_time_deliveries": 15, "delayed_deliveries": 1, "quality_rating": 4.8, "response_time_hours": 4.0, "issue_resolution_time_hours": 12.0, "order_completion_rate": 98.0},
            {"on_time_deliveries": 20, "delayed_deliveries": 2, "quality_rating": 4.6, "response_time_hours": 6.0, "issue_resolution_time_hours": 18.0, "order_completion_rate": 96.0},
            {"on_time_deliveries": 18, "delayed_deliveries": 0, "quality_rating": 5.0, "response_time_hours": 2.0, "issue_resolution_time_hours": 8.0, "order_completion_rate": 100.0}
        ]
        for idx, entry in enumerate(entries, 1):
            perf_post_resp = await client.post(f"/api/v1/vendors/{vendor_id}/performance", json=entry, headers=headers)
            assert perf_post_resp.status_code == 201, f"Perf entry {idx} failed: {perf_post_resp.text}"
            p_data = perf_post_resp.json()
            print(f"  -> Recorded Entry {idx}: On-Time={p_data['on_time_deliveries']}, Quality={p_data['quality_rating']}, Completion={p_data['order_completion_rate']}%")

        # 6. Milestone 3 Group A: Verify Performance History & Aggregated Summary
        print("\n[TEST 6] Milestone 3: Performance History & Aggregated Summary...")
        hist_resp = await client.get(f"/api/v1/vendors/{vendor_id}/performance", headers=headers)
        assert hist_resp.status_code == 200
        history = hist_resp.json()
        assert len(history) == 3, f"Expected 3 history items, got {len(history)}"
        print(f"  -> History endpoint returned {len(history)} items.")

        summary_resp = await client.get(f"/api/v1/vendors/{vendor_id}/performance/summary", headers=headers)
        assert summary_resp.status_code == 200
        summary = summary_resp.json()
        print(f"  -> Summary: total_entries={summary['total_entries']}, total_deliveries={summary['total_deliveries']}, on_time_rate={summary['on_time_delivery_rate']}%, avg_quality={summary['average_quality_rating']}, avg_completion={summary['order_completion_rate']}%")

        assert summary["total_entries"] == 3
        assert summary["total_deliveries"] == 56 # 16 + 22 + 18
        assert summary["on_time_deliveries"] == 53
        assert summary["delayed_deliveries"] == 3
        assert abs(summary["on_time_delivery_rate"] - 94.64) < 0.1
        assert abs(summary["average_quality_rating"] - 4.8) < 0.1
        assert abs(summary["order_completion_rate"] - 98.0) < 0.1
        print("  -> Summary values verified mathematically.")

        # 7. Milestone 3 Group A: Performance Rankings
        print("\n[TEST 7] Milestone 3: Vendor Performance Ranking Endpoint...")
        rank_resp = await client.get("/api/v1/vendors/ranking", headers=headers)
        assert rank_resp.status_code == 200
        rankings = rank_resp.json()
        assert len(rankings) >= 1
        top_v = rankings[0]
        print(f"  -> #1 Ranked Vendor: {top_v['company_name']} (Performance Score: {top_v['performance_score']}/100)")
        # Check sorting is descending
        for i in range(len(rankings) - 1):
            assert rankings[i]["performance_score"] >= rankings[i+1]["performance_score"]
        print("  -> Performance rankings descending order verified.")

        # 8. Milestone 3 Group A: Reliability Breakdown & Risk Classification
        print("\n[TEST 8] Milestone 3: Vendor Reliability & Multi-Factor Scoring...")
        rel_resp = await client.get(f"/api/v1/vendors/{vendor_id}/reliability", headers=headers)
        assert rel_resp.status_code == 200
        rel = rel_resp.json()
        print(f"  -> Overall Reliability Score: {rel['overall_reliability_score']} (Risk Level: {rel['risk_level']})")
        print(f"  -> Factor Breakdown: {rel['breakdown']}")
        print(f"  -> Recommendation: {rel['recommendation']}")

        assert "delivery_score" in rel["breakdown"]
        assert "quality_score" in rel["breakdown"]
        assert "communication_score" in rel["breakdown"]
        assert "compliance_score" in rel["breakdown"]
        assert "purchase_history_score" in rel["breakdown"]
        assert "issue_resolution_score" in rel["breakdown"]
        assert rel["risk_level"] in ["Low", "Medium", "High"]
        assert rel["recommendation"] is not None
        print("  -> Reliability data verified.")

        # 9. Milestone 3 Group A: Reliability Ranking & Historical Trend
        print("\n[TEST 9] Milestone 3: Reliability Ranking & Trend Snapshot...")
        rel_rank_resp = await client.get("/api/v1/vendors/reliability-ranking", headers=headers)
        assert rel_rank_resp.status_code == 200
        rel_rankings = rel_rank_resp.json()
        assert len(rel_rankings) >= 1
        for i in range(len(rel_rankings) - 1):
            assert rel_rankings[i]["overall_reliability_score"] >= rel_rankings[i+1]["overall_reliability_score"]
        print(f"  -> Top Reliability Vendor: {rel_rankings[0]['company_name']} ({rel_rankings[0]['overall_reliability_score']})")

        trend_resp = await client.get(f"/api/v1/vendors/{vendor_id}/reliability/trend", headers=headers)
        assert trend_resp.status_code == 200
        trend = trend_resp.json()
        assert len(trend) >= 1
        print(f"  -> Historical snapshots recorded: {len(trend)} trend points.")

        # 10. Milestone 3 RBAC Safety Test
        print("\n[TEST 10] Milestone 3: RBAC Security Checks...")
        # Unauthenticated request
        unauth_resp = await client.post(f"/api/v1/vendors/{vendor_id}/performance", json=entries[0])
        assert unauth_resp.status_code == 401, f"Expected 401, got {unauth_resp.status_code}"
        print("  -> Unauthenticated request correctly rejected with 401 Unauthorized.")

    print("\n==================================================")
    print("ALL MILESTONE 1, 2 & 3 TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
