"""
VendorIQ Procurement & PO Lifecycle Management Routes
Enforces:
- Only Active/Approved vendors can be selected for procurement
- Automatic calculation of On-Time vs Delayed delivery
- Connected lifecycle: Request -> Approval -> Vendor Assignment -> PO -> Delivery -> Quality -> Invoice -> Recalculation
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, date
from backend.database import get_db
from backend.auth import get_current_user, require_roles
from backend.models import (
    ProcurementRequestCreate, ProcurementRequestDecision,
    VendorAssignCreatePO, PODeliveryUpdate, InvoiceCreate, InvoicePaymentUpdate
)
from backend.calculations import compute_vendor_performance_and_reliability

router = APIRouter(prefix="/api/procurement", tags=["Procurement Management"])

@router.get("/requests")
def list_procurement_requests(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT pr.*, u.full_name as requester_name
        FROM procurement_requests pr
        LEFT JOIN users u ON pr.requested_by = u.id
        WHERE 1=1
    """
    params = []
    if status and status != "All":
        query += " AND pr.status = ?"
        params.append(status)
    if category and category != "All":
        query += " AND pr.category = ?"
        params.append(category)

    query += " ORDER BY pr.id DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/requests")
def create_procurement_request(
    req: ProcurementRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM procurement_requests")
    count = cursor.fetchone()[0] + 1
    req_code = f"REQ-2026-{count:03d}"

    cursor.execute("""
        INSERT INTO procurement_requests (
            request_code, department, requested_by, title, category,
            description, quantity, estimated_cost, priority, required_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
    """, (req_code, req.department, current_user["id"], req.title, req.category,
          req.description, req.quantity, req.estimated_cost, req.priority, req.required_date))
    new_id = cursor.lastrowid

    # Audit log
    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, record_type, record_id, details)
        VALUES (?, ?, 'Procurement Request Created', 'Procurement', 'Request', ?, ?)
    """, (current_user["id"], current_user["full_name"], req_code,
          f"New request '{req.title}' created by {current_user['full_name']} for {req.department}"))

    # Notify Procurement Managers
    cursor.execute("""
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('Procurement Manager', 'New Procurement Request', ?, 'INFO', '#/procurement')
    """, (f"New request {req_code} ({req.title}) requires approval.",))

    conn.commit()
    conn.close()

    return {"success": True, "request_id": new_id, "request_code": req_code, "status": "Pending"}

@router.post("/requests/{req_id}/decision")
def decide_procurement_request(
    req_id: int,
    decision: ProcurementRequestDecision,
    current_user: dict = Depends(require_roles("Administrator", "Procurement Manager"))
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM procurement_requests WHERE id = ?", (req_id,))
    req = cursor.fetchone()
    if not req:
        conn.close()
        raise HTTPException(status_code=404, detail="Request not found")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        UPDATE procurement_requests
        SET status = ?, decision_by = ?, decision_date = ?, decision_comments = ?
        WHERE id = ?
    """, (decision.status, current_user["id"], now_str, decision.comments, req_id))

    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, record_type, record_id, previous_value, new_value, details)
        VALUES (?, ?, 'Procurement Request Decision', 'Procurement', 'Request', ?, ?, ?, ?)
    """, (current_user["id"], current_user["full_name"], req["request_code"], req["status"], decision.status,
          f"Request {req['request_code']} {decision.status} by {current_user['full_name']}. Comments: {decision.comments or 'None'}"))

    conn.commit()
    conn.close()
    return {"success": True, "request_id": req_id, "status": decision.status}

@router.get("/selectable-vendors")
def get_selectable_vendors(
    category: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    CRITICAL RULE:
    Only ACTIVE / APPROVED vendors can be selected for procurement.
    Pending, Suspended, Inactive, and Rejected vendors are strictly excluded.
    Returns live reliability score, risk level, and recommendations to assist assignment.
    """
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM vendors WHERE status = 'Active'"
    params = []
    if category and category != "All":
        query += " AND category = ?"
        params.append(category)

    cursor.execute(query, params)
    active_vendors = cursor.fetchall()

    results = []
    for v in active_vendors:
        metrics = compute_vendor_performance_and_reliability(v["id"], conn)
        results.append({
            "id": v["id"],
            "vendor_code": v["vendor_code"],
            "company_name": v["company_name"],
            "category": v["category"],
            "contact_person": v["contact_person"],
            "email": v["email"],
            "phone": v["phone"],
            "reliability_score": metrics["overall_reliability"],
            "risk_level": metrics["risk_level"],
            "recommendation": metrics["recommendation"],
            "recommendation_badge": metrics["recommendation_badge"],
            "delivery_rate": metrics["delivery_rate"],
            "quality_rating": metrics["avg_quality_rating"],
            "trend": metrics["trend"]
        })

    # Sort by reliability score descending
    results.sort(key=lambda x: x["reliability_score"], reverse=True)
    conn.close()
    return results

@router.post("/purchase-orders")
def create_purchase_order(
    req: VendorAssignCreatePO,
    current_user: dict = Depends(require_roles("Administrator", "Procurement Manager"))
):
    conn = get_db()
    cursor = conn.cursor()

    # Verify Vendor is Active
    cursor.execute("SELECT id, company_name, status, email, phone FROM vendors WHERE id = ?", (req.vendor_id,))
    vendor = cursor.fetchone()
    if not vendor:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found")
    if vendor["status"] != "Active":
        conn.close()
        raise HTTPException(status_code=400, detail=f"Cannot assign vendor with status '{vendor['status']}'. Only 'Active' vendors can be assigned.")

    # Generate PO Number
    cursor.execute("SELECT COUNT(*) FROM purchase_orders")
    po_count = cursor.fetchone()[0] + 1
    po_num = f"PO-2026-{po_count:03d}"
    order_date = date.today().strftime("%Y-%m-%d")

    cursor.execute("""
        INSERT INTO purchase_orders (
            po_number, request_id, vendor_id, order_date,
            expected_delivery_date, total_amount, status, shipping_mode, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'Ordered', ?, ?, ?)
    """, (po_num, req.request_id, req.vendor_id, order_date, req.expected_delivery_date,
          req.total_amount, req.shipping_mode, req.notes, current_user["id"]))
    po_id = cursor.lastrowid

    # Insert items
    for item in req.items:
        qty = item.get("quantity", 1)
        u_price = item.get("unit_price", 0.0)
        cursor.execute("""
            INSERT INTO purchase_order_items (po_id, product_name, quantity, unit_price, total_price)
            VALUES (?, ?, ?, ?, ?)
        """, (po_id, item.get("product_name", "Supply Item"), qty, u_price, qty * u_price))

    # Update request status to Completed/Ordered
    if req.request_id:
        cursor.execute("UPDATE procurement_requests SET status = 'Completed' WHERE id = ?", (req.request_id,))

    # Audit log
    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, record_type, record_id, new_value, details)
        VALUES (?, ?, 'Purchase Order Created', 'Procurement', 'Purchase Order', ?, 'Ordered', ?)
    """, (current_user["id"], current_user["full_name"], po_num,
          f"Purchase Order {po_num} issued to {vendor['company_name']} for ${req.total_amount:,.2f}"))

    # Send Notification to Vendor & Procurement
    cursor.execute("""
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('Vendor', 'New Purchase Order Received', ?, 'SUCCESS', '#/purchase-orders')
    """, (f"PO {po_num} has been issued to your organization for ${req.total_amount:,.2f}.",))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "po_id": po_id,
        "po_number": po_num,
        "status": "Ordered",
        "vendor_name": vendor["company_name"]
    }

@router.get("/purchase-orders")
def list_purchase_orders(
    status: Optional[str] = Query(None),
    vendor_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT po.*, v.company_name as vendor_name, v.category as vendor_category,
               v.vendor_code, inv.id as invoice_id, inv.payment_status as invoice_payment_status,
               inv.invoice_number
        FROM purchase_orders po
        JOIN vendors v ON po.vendor_id = v.id
        LEFT JOIN invoices inv ON inv.po_id = po.id
        WHERE 1=1
    """
    params = []

    # Vendor role data isolation
    if current_user["role"] == "Vendor":
        if not current_user["vendor_id"]:
            conn.close()
            return []
        query += " AND po.vendor_id = ?"
        params.append(current_user["vendor_id"])
    elif vendor_id:
        query += " AND po.vendor_id = ?"
        params.append(vendor_id)

    if status and status != "All":
        query += " AND po.status = ?"
        params.append(status)

    if search:
        s_param = f"%{search}%"
        query += " AND (po.po_number LIKE ? OR v.company_name LIKE ?)"
        params.extend([s_param, s_param])

    query += " ORDER BY po.order_date DESC, po.id DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/purchase-orders/{po_id}")
def get_purchase_order_detail(po_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT po.*, v.company_name as vendor_name, v.category as vendor_category,
               v.email as vendor_email, v.phone as vendor_phone, v.vendor_code,
               u.full_name as creator_name
        FROM purchase_orders po
        JOIN vendors v ON po.vendor_id = v.id
        LEFT JOIN users u ON po.created_by = u.id
        WHERE po.id = ?
    """, (po_id,))
    po = cursor.fetchone()
    if not po:
        conn.close()
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Vendor isolation
    if current_user["role"] == "Vendor" and current_user["vendor_id"] != po["vendor_id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Unauthorized")

    po_dict = dict(po)

    # Items
    cursor.execute("SELECT * FROM purchase_order_items WHERE po_id = ?", (po_id,))
    po_dict["items"] = [dict(i) for i in cursor.fetchall()]

    # Invoices
    cursor.execute("SELECT * FROM invoices WHERE po_id = ?", (po_id,))
    inv = cursor.fetchone()
    po_dict["invoice"] = dict(inv) if inv else None

    # Quality evaluations
    cursor.execute("SELECT * FROM quality_evaluations WHERE po_id = ?", (po_id,))
    eval_row = cursor.fetchone()
    po_dict["quality_evaluation"] = dict(eval_row) if eval_row else None

    conn.close()
    return po_dict

@router.post("/purchase-orders/{po_id}/deliver")
def record_po_delivery(
    po_id: int,
    req: PODeliveryUpdate,
    current_user: dict = Depends(require_roles("Administrator", "Procurement Manager", "Supply Chain Manager"))
):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,))
    po = cursor.fetchone()
    if not po:
        conn.close()
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    # Determine On-Time vs Delayed
    exp_date = datetime.strptime(str(po["expected_delivery_date"])[:10], "%Y-%m-%d").date()
    act_date = datetime.strptime(str(req.actual_delivery_date)[:10], "%Y-%m-%d").date()
    is_on_time = act_date <= exp_date
    delay_days = (act_date - exp_date).days if not is_on_time else 0

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Update PO
    cursor.execute("""
        UPDATE purchase_orders
        SET status = 'Delivered', actual_delivery_date = ?, updated_at = ?
        WHERE id = ?
    """, (req.actual_delivery_date, now_str, po_id))

    # Record Quality Evaluation
    cursor.execute("""
        INSERT INTO quality_evaluations (
            po_id, vendor_id, quality_rating, inspected_quantity,
            defective_quantity, rejected_quantity, evaluator_comments, evaluated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (po_id, po["vendor_id"], req.quality_rating, req.inspected_quantity,
          req.defective_quantity, req.defective_quantity, req.evaluator_comments, current_user["id"]))

    # Generate Invoice if not exists
    cursor.execute("SELECT id FROM invoices WHERE po_id = ?", (po_id,))
    if not cursor.fetchone():
        inv_num = f"INV-{po['po_number'][3:]}"
        due_date = (act_date + datetime.resolution.resolution).strftime("%Y-%m-%d") # default net 30 days
        due_d = (datetime.combine(act_date, datetime.min.time()) + datetime.resolution * 0).date()
        # 30 days ahead
        import datetime as dt_module
        due_date_str = (act_date + dt_module.timedelta(days=30)).strftime("%Y-%m-%d")

        cursor.execute("""
            INSERT INTO invoices (invoice_number, po_id, vendor_id, invoice_date, due_date, amount, payment_status)
            VALUES (?, ?, ?, ?, ?, ?, 'Pending')
        """, (inv_num, po_id, po["vendor_id"], req.actual_delivery_date, due_date_str, po["total_amount"]))

    # Audit log
    delivery_status_label = f"ON-TIME (Met target {exp_date})" if is_on_time else f"DELAYED by {delay_days} day(s)"
    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, record_type, record_id, previous_value, new_value, details)
        VALUES (?, ?, 'Delivery Recorded', 'Procurement', 'Purchase Order', ?, 'In Transit', 'Delivered', ?)
    """, (current_user["id"], current_user["full_name"], po["po_number"],
          f"Delivery confirmed on {req.actual_delivery_date}. Status: {delivery_status_label}. Quality rating: {req.quality_rating}/5.0"))

    # Recompute vendor reliability score dynamically
    updated_metrics = compute_vendor_performance_and_reliability(po["vendor_id"], conn)

    # Save performance snapshot
    cur_month = req.actual_delivery_date[:7]
    factors = updated_metrics["factors"]
    cursor.execute("""
        INSERT OR REPLACE INTO performance_snapshots (
            vendor_id, period_month, delivery_score, quality_score, communication_score,
            compliance_score, purchase_history_score, issue_resolution_score,
            overall_reliability, risk_level, trend
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (po["vendor_id"], cur_month, updated_metrics["delivery_rate"],
          factors["product_quality"]["score"], factors["communication_efficiency"]["score"],
          factors["contract_compliance"]["score"], factors["purchase_history"]["score"],
          factors["issue_resolution"]["score"], updated_metrics["overall_reliability"],
          updated_metrics["risk_level"], updated_metrics["trend"]))

    # Notification
    cursor.execute("""
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('Finance Officer', 'New Invoice Generated', ?, 'INFO', '#/invoices')
    """, (f"PO {po['po_number']} marked delivered. Invoice pending payment review.",))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "po_number": po["po_number"],
        "is_on_time": is_on_time,
        "delay_days": delay_days,
        "delivery_status": delivery_status_label,
        "updated_reliability_score": updated_metrics["overall_reliability"],
        "updated_risk_level": updated_metrics["risk_level"],
        "updated_recommendation": updated_metrics["recommendation"]
    }

@router.get("/invoices")
def list_invoices(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT inv.*, po.po_number, v.company_name as vendor_name, v.category as vendor_category
        FROM invoices inv
        JOIN purchase_orders po ON inv.po_id = po.id
        JOIN vendors v ON inv.vendor_id = v.id
        WHERE 1=1
    """
    params = []
    if current_user["role"] == "Vendor":
        if not current_user["vendor_id"]:
            conn.close()
            return []
        query += " AND inv.vendor_id = ?"
        params.append(current_user["vendor_id"])

    if status and status != "All":
        query += " AND inv.payment_status = ?"
        params.append(status)

    query += " ORDER BY inv.invoice_date DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/invoices/{invoice_id}/pay")
def pay_invoice(
    invoice_id: int,
    req: InvoicePaymentUpdate,
    current_user: dict = Depends(require_roles("Administrator", "Finance Officer"))
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
    inv = cursor.fetchone()
    if not inv:
        conn.close()
        raise HTTPException(status_code=404, detail="Invoice not found")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ref = req.payment_reference or f"WIRE-{invoice_id}-{int(datetime.now().timestamp())}"

    cursor.execute("""
        UPDATE invoices
        SET payment_status = ?, paid_at = ?, payment_reference = ?
        WHERE id = ?
    """, (req.payment_status, now_str if req.payment_status == "Paid" else None, ref, invoice_id))

    # Also update purchase order to Completed if invoice paid
    if req.payment_status == "Paid":
        cursor.execute("UPDATE purchase_orders SET status = 'Completed', updated_at = ? WHERE id = ?", (now_str, inv["po_id"]))

    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, record_type, record_id, previous_value, new_value, details)
        VALUES (?, ?, 'Invoice Payment Processed', 'Finance', 'Invoice', ?, ?, ?, ?)
    """, (current_user["id"], current_user["full_name"], inv["invoice_number"], inv["payment_status"], req.payment_status,
          f"Payment of ${inv['amount']:,.2f} recorded for {inv['invoice_number']}. Ref: {ref}"))

    conn.commit()
    conn.close()
    return {"success": True, "invoice_id": invoice_id, "payment_status": req.payment_status, "payment_reference": ref}
