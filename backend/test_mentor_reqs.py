from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_mentor_flow():
    # 1. Check health / public vendor showcase
    res = client.get("/api/vendors/public-showcase")
    print(f"Public Vendor Showcase: {res.status_code}, count: {len(res.json())}")
    assert res.status_code == 200

    # 2. Check public open requisitions
    res = client.get("/api/procurement/public-open-requests")
    print(f"Public Open Requisitions: {res.status_code}, count: {len(res.json())}")
    assert res.status_code == 200
    open_reqs = res.json()

    # 3. Test acquiring requisition with matching vs non-matching category
    if open_reqs:
        test_req = open_reqs[0]
        req_id = test_req["id"]
        req_cat = test_req["category"]
        print(f"Testing Requisition #{req_id} (Category: {req_cat})")

        # Get vendors
        vendors = client.get("/api/vendors/public-showcase").json()
        same_cat_vendor = next((v for v in vendors if v["category"] == req_cat), None)
        diff_cat_vendor = next((v for v in vendors if v["category"] != req_cat), None)

        if diff_cat_vendor:
            print(f"Testing Mismatch Category acquire with Vendor #{diff_cat_vendor['id']} ({diff_cat_vendor['category']})...")
            bad_res = client.post(f"/api/procurement/requests/{req_id}/acquire?vendor_id={diff_cat_vendor['id']}")
            print(f"Mismatch Response: {bad_res.status_code}, {bad_res.json()}")
            assert bad_res.status_code == 400
            print("Category mismatch correctly blocked (400 Bad Request)!")

        if same_cat_vendor:
            print(f"Testing Same Category acquire with Vendor #{same_cat_vendor['id']} ({same_cat_vendor['category']})...")
            good_res = client.post(f"/api/procurement/requests/{req_id}/acquire?vendor_id={same_cat_vendor['id']}")
            print(f"Success Response: {good_res.status_code}, {good_res.json()}")
            assert good_res.status_code == 200
            print("Successfully acquired requisition and created Direct PO!")

if __name__ == "__main__":
    test_mentor_flow()
