"""
VendorIQ Audit Logs & Notifications Routes
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from backend.database import get_db
from backend.auth import get_current_user

router = APIRouter(prefix="/api/audit", tags=["Audit & Notifications"])

@router.get("/logs")
def list_audit_logs(
    module: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM audit_logs WHERE 1=1"
    params = []

    if module and module != "All":
        query += " AND module = ?"
        params.append(module)

    if search:
        s_param = f"%{search}%"
        query += " AND (user_name LIKE ? OR action LIKE ? OR details LIKE ? OR record_id LIKE ?)"
        params.extend([s_param, s_param, s_param, s_param])

    query += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/notifications")
def list_notifications(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()

    # Get notifications for this user or for this user's role or broadcast
    cursor.execute("""
        SELECT * FROM notifications
        WHERE user_id = ? OR role_target = ? OR role_target IS NULL
        ORDER BY created_at DESC LIMIT 20
    """, (current_user["id"], current_user["role"]))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/notifications/{notif_id}/read")
def mark_notification_read(notif_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notif_id,))
    conn.commit()
    conn.close()
    return {"success": True, "notification_id": notif_id}
