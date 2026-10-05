"""
VendorIQ Vendor Management Routes
Implements 6 category filtering, status filtering, approval workflow,
profile management, and explainable reliability metrics.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime
from backend.database import get_db
from backend.auth import get_current_user, require_roles
from backend.models import VendorStatusUpdateRequest
from backend.calculations import compute_vendor_performance_and_reliability

router = APIRouter(prefix="/api/vendors", tags=["Vendor Management"])

@router.get("")
def list_vendors(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM vendors WHERE 1=1"
    params = []

    # If role is Vendor, restrict to their own vendor profile only!
    if current_user["role"] == "Vendor":
        if not current_user["vendor_id"]:
            conn.close()
            return []
        query += " AND id = ?"
        params.append(current_user["vendor_id"])
    else:
        if category and category != "All":
            query += " AND category = ?"
            params.append(category)

        if status and status != "All":
            query += " AND status = ?"
            params.append(status)

        if search:
            search_param = f"%{search}%"
            query += " AND (company_name LIKE ? OR vendor_code LIKE ? OR contact_person LIKE ? OR products_services LIKE ?)"
            params.extend([search_param, search_param, search_param, search_param])

    query += " ORDER BY id ASC"
    cursor.execute(query, params)
    vendors = cursor.fetchall()

    results = []
    for v in vendors:
        v_dict = dict(v)
        # Compute real-time performance & reliability
        metrics = compute_vendor_performance_and_reliability(v["id"], conn)
        v_dict["reliability_score"] = metrics["overall_reliability"]
        v_dict["risk_level"] = metrics["risk_level"]
        v_dict["recommendation"] = metrics["recommendation"]
        v_dict["recommendation_badge"] = metrics["recommendation_badge"]
        v_dict["delivery_rate"] = metrics["delivery_rate"]
        v_dict["quality_rating"] = metrics["avg_quality_rating"]
        v_dict["trend"] = metrics["trend"]
        v_dict["total_orders"] = metrics["total_orders"]
        v_dict["completed_orders"] = metrics["completed_orders"]
        results.append(v_dict)

    conn.close()
    return results

@router.get("/approval-queue")
def get_approval_queue(current_user: dict = Depends(require_roles("Administrator", "Procurement Manager"))):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT v.*,
               (SELECT COUNT(*) FROM vendor_documents vd WHERE vd.vendor_id = v.id) as doc_count
        FROM vendors v
        WHERE v.status = 'Pending Approval'
        ORDER BY v.created_at ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/{vendor_id}")
def get_vendor_details(vendor_id: int, current_user: dict = Depends(get_current_user)):
    # Role isolation for Vendor
    if current_user["role"] == "Vendor" and current_user["vendor_id"] != vendor_id:
        raise HTTPException(status_code=403, detail="Vendors are only permitted to view their own profile")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vendors WHERE id = ?", (vendor_id,))
    vendor = cursor.fetchone()
    if not vendor:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found")

    v_dict = dict(vendor)

    # Contacts
    cursor.execute("SELECT * FROM vendor_contacts WHERE vendor_id = ?", (vendor_id,))
    v_dict["contacts"] = [dict(c) for c in cursor.fetchall()]

    # Documents
    cursor.execute("SELECT * FROM vendor_documents WHERE vendor_id = ?", (vendor_id,))
    v_dict["documents"] = [dict(d) for d in cursor.fetchall()]

    # Status History
    cursor.execute("""
        SELECT vsh.*, u.full_name as changed_by_name
        FROM vendor_status_history vsh
        LEFT JOIN users u ON vsh.changed_by = u.id
        WHERE vsh.vendor_id = ?
        ORDER BY vsh.timestamp DESC
    """, (vendor_id,))
    v_dict["status_history"] = [dict(sh) for sh in cursor.fetchall()]

    # Contracts
    cursor.execute("SELECT * FROM contracts WHERE vendor_id = ? ORDER BY start_date DESC", (vendor_id,))
    v_dict["contracts"] = [dict(c) for c in cursor.fetchall()]

    # Certifications
    cursor.execute("SELECT * FROM certifications WHERE vendor_id = ? ORDER BY expiry_date DESC", (vendor_id,))
    v_dict["certifications"] = [dict(cert) for cert in cursor.fetchall()]

    # Recent POs
    cursor.execute("""
        SELECT id, po_number, order_date, expected_delivery_date, actual_delivery_date, total_amount, status, shipping_mode
        FROM purchase_orders
        WHERE vendor_id = ?
        ORDER BY order_date DESC LIMIT 15
    """, (vendor_id,))
    v_dict["purchase_orders"] = [dict(po) for po in cursor.fetchall()]

    # Invoices
    cursor.execute("""
        SELECT inv.*, po.po_number
        FROM invoices inv
        JOIN purchase_orders po ON inv.po_id = po.id
        WHERE inv.vendor_id = ?
        ORDER BY inv.invoice_date DESC
    """, (vendor_id,))
    v_dict["invoices"] = [dict(inv) for inv in cursor.fetchall()]

    # Issues
    cursor.execute("SELECT * FROM issues WHERE vendor_id = ? ORDER BY created_at DESC", (vendor_id,))
    v_dict["issues"] = [dict(i) for i in cursor.fetchall()]

    # Communications
    cursor.execute("""
        SELECT cr.*, u.full_name as sender_name
        FROM communication_records cr
        LEFT JOIN users u ON cr.user_id = u.id
        WHERE cr.vendor_id = ?
        ORDER BY cr.timestamp DESC
    """, (vendor_id,))
    v_dict["communications"] = [dict(cm) for cm in cursor.fetchall()]

    # Metrics & 6-factor score
    metrics = compute_vendor_performance_and_reliability(vendor_id, conn)
    v_dict["intelligence"] = metrics

    conn.close()
    return v_dict

@router.post("/{vendor_id}/status")
def update_vendor_status(
    vendor_id: int,
    req: VendorStatusUpdateRequest,
    current_user: dict = Depends(require_roles("Administrator", "Procurement Manager"))
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT status, company_name FROM vendors WHERE id = ?", (vendor_id,))
    v = cursor.fetchone()
    if not v:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found")

    old_status = v["status"]
    new_status = req.status
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Update vendor status
    if new_status == "Active" and old_status != "Active":
        cursor.execute("""
            UPDATE vendors SET status = ?, approved_at = ?, approved_by = ?, updated_at = ?
            WHERE id = ?
        """, (new_status, now_str, current_user["id"], now_str, vendor_id))
    else:
        cursor.execute("""
            UPDATE vendors SET status = ?, updated_at = ?
            WHERE id = ?
        """, (new_status, now_str, vendor_id))

    # Log status history
    cursor.execute("""
        INSERT INTO vendor_status_history (vendor_id, previous_status, new_status, changed_by, notes)
        VALUES (?, ?, ?, ?, ?)
    """, (vendor_id, old_status, new_status, current_user["id"], req.notes or f"Status changed to {new_status}"))

    # Audit log
    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, record_type, record_id, previous_value, new_value, details)
        VALUES (?, ?, 'Vendor Status Update', 'Vendor', 'Vendor', ?, ?, ?, ?)
    """, (current_user["id"], current_user["full_name"], str(vendor_id), old_status, new_status,
          f"Vendor '{v['company_name']}' status changed from '{old_status}' to '{new_status}'. Notes: {req.notes or 'None'}"))

    # Send notification
    cursor.execute("""
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('Administrator', 'Vendor Status Changed', ?, 'INFO', ?)
    """, (f"Vendor {v['company_name']} is now {new_status}.", f"#/vendors/{vendor_id}"))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "vendor_id": vendor_id,
        "previous_status": old_status,
        "new_status": new_status,
        "message": f"Vendor status successfully updated to {new_status}"
    }
