"""
VendorIQ Performance & Reliability Routes
Provides 6-factor breakdown, ranking within categories, and historical trends.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from backend.database import get_db
from backend.auth import get_current_user
from backend.calculations import compute_vendor_performance_and_reliability

router = APIRouter(prefix="/api/performance", tags=["Vendor Performance & Reliability"])

@router.get("/vendors/{vendor_id}")
def get_vendor_performance(vendor_id: int, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "Vendor" and current_user["vendor_id"] != vendor_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    conn = get_db()
    metrics = compute_vendor_performance_and_reliability(vendor_id, conn)
    conn.close()

    if not metrics:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return metrics

@router.get("/ranking")
def get_vendor_rankings(
    category: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT id, vendor_code, company_name, category, status FROM vendors WHERE 1=1"
    params = []
    if category and category != "All":
        query += " AND category = ?"
        params.append(category)

    cursor.execute(query, params)
    vendors = cursor.fetchall()

    rankings = []
    for v in vendors:
        m = compute_vendor_performance_and_reliability(v["id"], conn)
        rankings.append({
            "vendor_id": v["id"],
            "vendor_code": v["vendor_code"],
            "company_name": v["company_name"],
            "category": v["category"],
            "status": v["status"],
            "reliability_score": m["overall_reliability"],
            "risk_level": m["risk_level"],
            "delivery_rate": m["delivery_rate"],
            "quality_rating": m["avg_quality_rating"],
            "recommendation": m["recommendation"],
            "recommendation_badge": m["recommendation_badge"],
            "trend": m["trend"]
        })

    conn.close()
    rankings.sort(key=lambda x: x["reliability_score"], reverse=True)
    for rank, item in enumerate(rankings, start=1):
        item["rank"] = rank

    return rankings

@router.get("/trends/{vendor_id}")
def get_vendor_trends(vendor_id: int, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "Vendor" and current_user["vendor_id"] != vendor_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT period_month, delivery_score, quality_score, communication_score,
               compliance_score, purchase_history_score, issue_resolution_score,
               overall_reliability, risk_level, trend
        FROM performance_snapshots
        WHERE vendor_id = ?
        ORDER BY period_month ASC
    """, (vendor_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
