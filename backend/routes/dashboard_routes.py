"""
VendorIQ Dynamic Dashboards & Chart Analytics Routes
CRITICAL RULE 3: All numbers and charts are derived directly from the database and dataset.
Zero hardcoded numbers. Zero random values.
"""
from fastapi import APIRouter, HTTPException, Depends
from backend.database import get_db
from backend.auth import get_current_user
from backend.calculations import compute_vendor_performance_and_reliability

router = APIRouter(prefix="/api/dashboard", tags=["Dashboards & Analytics"])

@router.get("/procurement")
def get_procurement_dashboard(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    # 1. Procurement Requests KPIs
    cursor.execute("SELECT COUNT(*) FROM procurement_requests")
    total_requests = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM procurement_requests WHERE status = 'Pending'")
    pending_requests = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM procurement_requests WHERE status = 'Approved'")
    approved_requests = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM procurement_requests WHERE status = 'Completed'")
    completed_requests = cursor.fetchone()[0]

    cursor.execute("SELECT COALESCE(SUM(estimated_cost), 0) FROM procurement_requests")
    total_procurement_value = cursor.fetchone()[0]

    completion_rate = round((completed_requests / max(1, total_requests)) * 100.0, 1)

    # 2. Purchase Orders KPIs
    cursor.execute("SELECT COUNT(*), COALESCE(SUM(total_amount), 0) FROM purchase_orders")
    total_pos, total_po_value = cursor.fetchone()

    cursor.execute("SELECT COUNT(*) FROM purchase_orders WHERE status = 'Ordered'")
    ordered_pos = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM purchase_orders WHERE status = 'In Transit'")
    intransit_pos = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM purchase_orders WHERE status = 'Delivered'")
    delivered_pos = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM purchase_orders WHERE status = 'Completed'")
    completed_pos = cursor.fetchone()[0]

    # Active POs = Ordered + In Transit
    active_pos = ordered_pos + intransit_pos

    # 3. Delivery Performance Summary
    cursor.execute("""
        SELECT expected_delivery_date, actual_delivery_date
        FROM purchase_orders
        WHERE status IN ('Delivered', 'Completed') AND actual_delivery_date IS NOT NULL
    """)
    deliv_rows = cursor.fetchall()
    on_time = 0
    delayed = 0
    for r in deliv_rows:
        exp = str(r["expected_delivery_date"])[:10]
        act = str(r["actual_delivery_date"])[:10]
        if act <= exp:
            on_time += 1
        else:
            delayed += 1
    total_delivered = on_time + delayed
    on_time_rate = round((on_time / max(1, total_delivered)) * 100.0, 1) if total_delivered > 0 else 100.0

    # 4. Average Vendor Reliability
    cursor.execute("SELECT id FROM vendors WHERE status = 'Active'")
    active_v_ids = [row["id"] for row in cursor.fetchall()]
    scores = [compute_vendor_performance_and_reliability(v_id, conn)["overall_reliability"] for v_id in active_v_ids]
    avg_reliability = round(sum(scores) / max(1, len(scores)), 1) if scores else 0.0

    conn.close()

    return {
        "kpis": {
            "total_requests": total_requests,
            "pending_requests": pending_requests,
            "approved_requests": approved_requests,
            "completed_requests": completed_requests,
            "total_procurement_value": total_procurement_value,
            "completion_rate": completion_rate,
            "total_pos": total_pos,
            "active_pos": active_pos,
            "ordered_pos": ordered_pos,
            "intransit_pos": intransit_pos,
            "delivered_pos": delivered_pos,
            "completed_pos": completed_pos,
            "total_po_value": total_po_value,
            "on_time_deliveries": on_time,
            "delayed_deliveries": delayed,
            "delivery_rate": on_time_rate,
            "avg_vendor_reliability": avg_reliability
        }
    }

@router.get("/admin")
def get_admin_dashboard(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    # Users
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]

    cursor.execute("SELECT role, COUNT(*) as count FROM users GROUP BY role")
    users_by_role = {r["role"]: r["count"] for r in cursor.fetchall()}

    # Vendors
    cursor.execute("SELECT COUNT(*) FROM vendors")
    total_vendors = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM vendors WHERE status = 'Active'")
    active_vendors = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM vendors WHERE status = 'Pending Approval'")
    pending_vendors = cursor.fetchone()[0]

    cursor.execute("SELECT category, COUNT(*) as count FROM vendors GROUP BY category")
    vendors_by_category = {r["category"]: r["count"] for r in cursor.fetchall()}

    # Contracts & Certs
    cursor.execute("SELECT COUNT(*) FROM contracts WHERE status = 'Active'")
    active_contracts = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM certifications WHERE compliance_status = 'Compliant'")
    compliant_certs = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM certifications WHERE compliance_status != 'Compliant'")
    expired_certs = cursor.fetchone()[0]

    # Calculate High Risk Vendors
    cursor.execute("SELECT id FROM vendors")
    all_v_ids = [row["id"] for row in cursor.fetchall()]
    high_risk_count = 0
    medium_risk_count = 0
    low_risk_count = 0
    for v_id in all_v_ids:
        m = compute_vendor_performance_and_reliability(v_id, conn)
        if m["risk_level"] == "High":
            high_risk_count += 1
        elif m["risk_level"] == "Medium":
            medium_risk_count += 1
        else:
            low_risk_count += 1

    # Recent Audit activity
    cursor.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 6")
    recent_audits = [dict(a) for a in cursor.fetchall()]

    conn.close()

    return {
        "users": {
            "total": total_users,
            "by_role": users_by_role
        },
        "vendors": {
            "total": total_vendors,
            "active": active_vendors,
            "pending": pending_vendors,
            "by_category": vendors_by_category,
            "high_risk": high_risk_count,
            "medium_risk": medium_risk_count,
            "low_risk": low_risk_count
        },
        "compliance": {
            "active_contracts": active_contracts,
            "compliant_certifications": compliant_certs,
            "expired_certifications": expired_certs
        },
        "recent_audits": recent_audits
    }

@router.get("/supply-chain")
def get_supply_chain_dashboard(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    # Macro benchmarks from real supply_chain_orders
    cursor.execute("SELECT COUNT(*), COALESCE(SUM(sales), 0), AVG(days_for_shipping_real) FROM supply_chain_orders")
    sco_count, total_sales, avg_ship_days = cursor.fetchone()

    cursor.execute("SELECT delivery_status, COUNT(*) as count FROM supply_chain_orders GROUP BY delivery_status")
    delivery_status_counts = {r["delivery_status"]: r["count"] for r in cursor.fetchall()}

    cursor.execute("SELECT shipping_mode, COUNT(*) as count FROM supply_chain_orders GROUP BY shipping_mode")
    shipping_modes = {r["shipping_mode"]: r["count"] for r in cursor.fetchall()}

    cursor.execute("SELECT market, COUNT(*) as count, SUM(sales) as total_sales FROM supply_chain_orders GROUP BY market ORDER BY total_sales DESC")
    market_breakdown = [dict(r) for r in cursor.fetchall()]

    # Internal POs
    cursor.execute("SELECT COUNT(*) FROM purchase_orders WHERE status = 'In Transit'")
    active_in_transit = cursor.fetchone()[0]

    conn.close()

    return {
        "dataset_total_orders": sco_count,
        "dataset_total_sales": round(total_sales, 2),
        "avg_shipping_days": round(avg_ship_days or 0, 1),
        "delivery_status_breakdown": delivery_status_counts,
        "shipping_modes": shipping_modes,
        "market_breakdown": market_breakdown,
        "active_in_transit_pos": active_in_transit
    }

@router.get("/vendor")
def get_vendor_dashboard(current_user: dict = Depends(get_current_user)):
    v_id = current_user.get("vendor_id") or 1
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM vendors WHERE id = ?", (v_id,))
    vendor = cursor.fetchone()
    if not vendor:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found")

    metrics = compute_vendor_performance_and_reliability(v_id, conn)

    # Active POs for this vendor
    cursor.execute("""
        SELECT * FROM purchase_orders
        WHERE vendor_id = ?
        ORDER BY order_date DESC LIMIT 10
    """, (v_id,))
    pos = [dict(r) for r in cursor.fetchall()]

    # Invoices
    cursor.execute("""
        SELECT * FROM invoices
        WHERE vendor_id = ?
        ORDER BY invoice_date DESC LIMIT 10
    """, (v_id,))
    invoices = [dict(r) for r in cursor.fetchall()]

    # Open queries / messages
    cursor.execute("""
        SELECT COUNT(*) FROM communication_records WHERE vendor_id = ?
    """, (v_id,))
    total_messages = cursor.fetchone()[0]

    conn.close()

    return {
        "vendor": dict(vendor),
        "metrics": metrics,
        "recent_pos": pos,
        "recent_invoices": invoices,
        "total_messages": total_messages
    }

@router.get("/finance")
def get_finance_dashboard(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM invoices")
    total_invoiced = cursor.fetchone()[0]

    cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE payment_status = 'Paid'")
    total_paid = cursor.fetchone()[0]

    cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE payment_status = 'Pending'")
    total_pending = cursor.fetchone()[0]

    cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE payment_status = 'Overdue'")
    total_overdue = cursor.fetchone()[0]

    cursor.execute("""
        SELECT v.company_name, v.category, SUM(inv.amount) as spend
        FROM invoices inv
        JOIN vendors v ON inv.vendor_id = v.id
        GROUP BY v.id
        ORDER BY spend DESC
    """)
    spend_by_vendor = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "total_invoiced": total_invoiced,
        "total_paid": total_paid,
        "total_pending": total_pending,
        "total_overdue": total_overdue,
        "spend_by_vendor": spend_by_vendor
    }

@router.get("/auditor")
def get_auditor_dashboard(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM audit_logs")
    total_logs = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM contracts WHERE end_date < date('now')")
    expired_contracts = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM certifications WHERE compliance_status != 'Compliant'")
    non_compliant_certs = cursor.fetchone()[0]

    cursor.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 25")
    logs = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "total_logs": total_logs,
        "expired_contracts": expired_contracts,
        "non_compliant_certs": non_compliant_certs,
        "recent_logs": logs
    }

# ================= CHARTS API ENDPOINTS (DATASET & DATABASE DRIVEN) =================

@router.get("/charts/spend-by-category")
def chart_spend_by_category():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT v.category, SUM(po.total_amount) as total_spend
        FROM purchase_orders po
        JOIN vendors v ON po.vendor_id = v.id
        GROUP BY v.category
        ORDER BY total_spend DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return {
        "labels": [r["category"] for r in rows],
        "datasets": [{
            "label": "Procurement Spend ($)",
            "data": [round(r["total_spend"], 2) for r in rows],
            "backgroundColor": ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899"]
        }]
    }

@router.get("/charts/monthly-trend")
def chart_monthly_trend():
    conn = get_db()
    cursor = conn.cursor()
    # Aggregated by month from purchase_orders
    cursor.execute("""
        SELECT strftime('%Y-%m', order_date) as month, SUM(total_amount) as total_amount, COUNT(*) as count
        FROM purchase_orders
        GROUP BY month
        ORDER BY month ASC
    """)
    po_trends = cursor.fetchall()

    conn.close()
    return {
        "labels": [r["month"] for r in po_trends],
        "datasets": [{
            "label": "Monthly Order Value ($)",
            "data": [r["total_amount"] for r in po_trends],
            "borderColor": "#3b82f6",
            "backgroundColor": "rgba(59, 130, 246, 0.1)",
            "tension": 0.3
        }]
    }

@router.get("/charts/delivery-status")
def chart_delivery_status():
    conn = get_db()
    cursor = conn.cursor()
    # Combined with real supply chain dataset macro status!
    cursor.execute("""
        SELECT delivery_status, COUNT(*) as count
        FROM supply_chain_orders
        GROUP BY delivery_status
    """)
    rows = cursor.fetchall()
    conn.close()
    return {
        "labels": [r["delivery_status"] for r in rows],
        "datasets": [{
            "data": [r["count"] for r in rows],
            "backgroundColor": ["#10b981", "#ef4444", "#3b82f6", "#64748b"]
        }]
    }

@router.get("/charts/vendor-reliability-comparison")
def chart_vendor_reliability_comparison():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, company_name, category FROM vendors WHERE status = 'Active'")
    vendors = cursor.fetchall()

    labels = []
    reliabilities = []
    deliveries = []
    qualities = []

    for v in vendors:
        m = compute_vendor_performance_and_reliability(v["id"], conn)
        labels.append(v["company_name"][:18])
        reliabilities.append(m["overall_reliability"])
        deliveries.append(m["delivery_rate"])
        qualities.append(m["factors"]["product_quality"]["score"])

    conn.close()
    return {
        "labels": labels,
        "datasets": [
            {"label": "Overall Reliability Score", "data": reliabilities, "backgroundColor": "#3b82f6"},
            {"label": "Delivery Score", "data": deliveries, "backgroundColor": "#10b981"},
            {"label": "Quality Score", "data": qualities, "backgroundColor": "#8b5cf6"}
        ]
    }

@router.get("/charts/risk-distribution")
def chart_risk_distribution():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM vendors")
    v_ids = [r["id"] for r in cursor.fetchall()]

    low = 0
    med = 0
    high = 0
    for v_id in v_ids:
        m = compute_vendor_performance_and_reliability(v_id, conn)
        if m["risk_level"] == "Low":
            low += 1
        elif m["risk_level"] == "Medium":
            med += 1
        else:
            high += 1

    conn.close()
    return {
        "labels": ["Low Risk (Preferred)", "Medium Risk (Monitor)", "High Risk (Review/Avoid)"],
        "datasets": [{
            "data": [low, med, high],
            "backgroundColor": ["#10b981", "#f59e0b", "#ef4444"]
        }]
    }

@router.get("/charts/shipping-modes")
def chart_shipping_modes():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT shipping_mode, COUNT(*) as count
        FROM supply_chain_orders
        GROUP BY shipping_mode
    """)
    rows = cursor.fetchall()
    conn.close()
    return {
        "labels": [r["shipping_mode"] for r in rows],
        "datasets": [{
            "data": [r["count"] for r in rows],
            "backgroundColor": ["#6366f1", "#06b6d4", "#f97316", "#84cc16"]
        }]
    }
