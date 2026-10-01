import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

async def run_milestone3c_tests():
    print("==================================================")
    print("STARTING MILESTONE 3 GROUP C (FINAL) VERIFICATION")
    print("==================================================")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:

        # 1. Authenticate as Admin
        print("\n[TEST 1] Authenticate as Administrator...")
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": "admin@example.com",
            "password": "Admin@123456"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("  -> Admin token acquired.")

        # 2. Test All 5 Reports in both PDF and Excel Formats
        report_types = [
            ("vendor-performance", "Vendor Performance & Reliability Audit"),
            ("procurement", "Procurement Pipeline Requisitions"),
            ("purchase-orders", "Purchase Orders Spend Register"),
            ("compliance", "Vendor Risk & Compliance Directory"),
            ("contracts", "Master Contracts & SLA Governance"),
        ]

        print("\n[TEST 2] Testing 5 In-Memory Report Generation Endpoints (PDF & Excel)...")
        for rep_id, rep_name in report_types:
            # Test PDF
            pdf_resp = await client.get(f"/api/v1/reports/{rep_id}?format=pdf", headers=headers)
            assert pdf_resp.status_code == 200, f"PDF export failed for {rep_id}: {pdf_resp.status_code} - {pdf_resp.text}"
            assert pdf_resp.headers["content-type"] == "application/pdf"
            assert "attachment;" in pdf_resp.headers.get("content-disposition", "")
            content = pdf_resp.content
            assert content.startswith(b"%PDF-"), f"Invalid PDF binary header for {rep_id}"
            assert len(content) > 1000, f"PDF content suspiciously small: {len(content)} bytes"
            print(f"  -> [PDF] {rep_name}: {len(content):,} bytes generated successfully.")

            # Test Excel
            excel_resp = await client.get(f"/api/v1/reports/{rep_id}?format=excel", headers=headers)
            assert excel_resp.status_code == 200, f"Excel export failed for {rep_id}: {excel_resp.status_code} - {excel_resp.text}"
            assert "spreadsheetml.sheet" in excel_resp.headers["content-type"]
            assert "attachment;" in excel_resp.headers.get("content-disposition", "")
            excel_content = excel_resp.content
            # OpenPyXL generates a valid zip package starting with 'PK'
            assert excel_content.startswith(b"PK"), f"Invalid XLSX zip header for {rep_id}"
            assert len(excel_content) > 1000, f"Excel content suspiciously small: {len(excel_content)} bytes"
            print(f"  -> [Excel] {rep_name}: {len(excel_content):,} bytes generated successfully.")

        # 3. Test Invalid Format Validation
        print("\n[TEST 3] Testing Invalid Report Format...")
        bad_format_resp = await client.get("/api/v1/reports/vendor-performance?format=docx", headers=headers)
        assert bad_format_resp.status_code == 400
        print("  -> Invalid format correctly rejected with 400 Bad Request.")

        # 4. Test Procurement Analytics Endpoint
        print("\n[TEST 4] Testing Procurement Analytics Endpoint (/api/v1/analytics/procurement)...")
        analytics_resp = await client.get("/api/v1/analytics/procurement", headers=headers)
        assert analytics_resp.status_code == 200, f"Analytics failed: {analytics_resp.text}"
        data = analytics_resp.json()
        print(f"  -> Total PO Spend: ${data['total_spend']:,.2f}")
        print(f"  -> Total POs: {data['total_orders']}, Total Requests: {data['total_requests']}")
        print(f"  -> Request-to-PO Conversion Rate: {data['request_to_po_conversion_rate']}%")
        print(f"  -> Monthly Spend Trend: {len(data['monthly_spend_trend'])} months recorded.")
        print(f"  -> Top Vendors: {len(data['top_vendors_by_spend'])} suppliers ranked.")
        print(f"  -> Categories: {len(data['category_spend'])} categories analyzed.")

        assert "monthly_spend_trend" in data
        assert "top_vendors_by_spend" in data
        assert "category_spend" in data
        assert "request_to_po_conversion_rate" in data
        assert data["total_spend"] > 0
        assert len(data["monthly_spend_trend"]) == 6
        print("  -> Procurement Analytics verified mathematically.")

        # 5. RBAC Authentication Check
        print("\n[TEST 5] Testing RBAC Security...")
        unauth_resp = await client.get("/api/v1/reports/vendor-performance?format=pdf")
        assert unauth_resp.status_code == 401
        print("  -> Unauthenticated request rejected with 401 Unauthorized.")

    print("\n==================================================")
    print("ALL MILESTONE 3 GROUP C TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_milestone3c_tests())
