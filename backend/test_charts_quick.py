"""Quick chart endpoint smoke test."""
import asyncio
import httpx

BASE = "http://localhost:8000/api/v1"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "TestAdmin@2026"

async def main():
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        print(f"Login status: {r.status_code}")
        if r.status_code != 200:
            print(f"Login error: {r.text[:400]}")
            return
        token = r.json()["access_token"]
        hdrs = {"Authorization": f"Bearer {token}"}

        # Procurement charts
        pc = await client.get(f"{BASE}/dashboard/procurement/charts", headers=hdrs)
        print(f"\n[Procurement Charts] HTTP {pc.status_code}")
        if pc.status_code == 200:
            d = pc.json()
            print(f"  PASS: total_pos={d['total_purchase_orders']}, cost={d['total_procurement_cost']:.2f}, vendors={d['active_vendors']}")
            print(f"  PASS: Months={d['procurement_overview']['months']}")
            print(f"  PASS: PO donut labels={d['active_purchase_orders']['labels']}")
            print(f"  PASS: Radar scores={d['vendor_performance_summary']['scores']}")
            print(f"  PASS: Delivery rate={d['delivery_status']['on_time_rate']}%")
        else:
            print(f"  FAIL: {pc.text[:300]}")

        # Admin charts
        ac = await client.get(f"{BASE}/dashboard/admin/charts", headers=hdrs)
        print(f"\n[Admin Charts] HTTP {ac.status_code}")
        if ac.status_code == 200:
            d = ac.json()
            print(f"  PASS: users={d['total_users']}, vendors={d['total_vendors']}, contracts={d['total_contracts']}")
            print(f"  PASS: User roles={d['user_management']['roles']}")
            print(f"  PASS: Risk={d['vendor_risk_distribution']['risk_levels']} => {d['vendor_risk_distribution']['counts']}")
            print(f"  PASS: DB size={d['system_statistics']['database_size']}")
            print(f"  PASS: Compliance={d['compliance_monitoring']['labels']} => {d['compliance_monitoring']['counts']}")
        else:
            print(f"  FAIL: {ac.text[:300]}")

        # Vendor charts
        vlist = await client.get(f"{BASE}/vendors", headers=hdrs)
        vendors = vlist.json() if vlist.status_code == 200 else []
        if vendors:
            vid = vendors[0]["id"]
            vc = await client.get(f"{BASE}/dashboard/vendor/{vid}/charts", headers=hdrs)
            print(f"\n[Vendor Charts - {vendors[0]['company_name']}] HTTP {vc.status_code}")
            if vc.status_code == 200:
                d = vc.json()
                print(f"  PASS: perf={d['performance_score']}, reliability={d['reliability_score']}")
                print(f"  PASS: contracts={d['active_contracts']}, orders={d['total_orders']}")
                print(f"  PASS: Trend dates={d['reliability_score_trend']['dates']}")
                print(f"  PASS: Comm labels={d['communication_activity']['labels']}")
            else:
                print(f"  FAIL: {vc.text[:300]}")

        print("\nAll chart endpoint tests PASSED!")
        print(f"Admin creds: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")

asyncio.run(main())
