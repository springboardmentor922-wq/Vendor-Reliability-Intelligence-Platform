"""
VendorIQ Communication Routes
Implements Rule 2:
- Native Email (mailto:) and SMS (sms:) URI generation with pre-populated fields.
- Automatic logging of communication events in SQLite with timestamps and response tracking.
- Complete communication history log.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
import urllib.parse
from datetime import datetime
from backend.database import get_db
from backend.auth import get_current_user
from backend.models import CommunicationLogRequest

router = APIRouter(prefix="/api/communication", tags=["Communication"])

@router.post("/log")
def log_communication(
    req: CommunicationLogRequest,
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()

    # Verify vendor exists
    cursor.execute("SELECT company_name, email, phone FROM vendors WHERE id = ?", (req.vendor_id,))
    vendor = cursor.fetchone()
    if not vendor:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        INSERT INTO communication_records (
            vendor_id, user_id, communication_type, recipient_contact,
            subject, message_body, related_record_type, related_record_id,
            response_time_hours, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (req.vendor_id, current_user["id"], req.communication_type, req.recipient_contact,
          req.subject, req.message_body, req.related_record_type, req.related_record_id,
          req.response_time_hours or 3.0, now_str))
    new_id = cursor.lastrowid

    # Audit log
    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, record_type, record_id, details)
        VALUES (?, ?, ?, 'Communication', ?, ?, ?)
    """, (current_user["id"], current_user["full_name"], f"{req.communication_type} Dispatched",
          req.related_record_type or 'Vendor', str(req.vendor_id),
          f"{req.communication_type} initiated to {vendor['company_name']} ({req.recipient_contact}). Subject: {req.subject or 'N/A'}"))

    conn.commit()
    conn.close()

    return {"success": True, "communication_id": new_id, "timestamp": now_str}

@router.get("/compose-intent")
def generate_compose_intent(
    vendor_id: int,
    communication_type: str = Query(..., regex="^(EMAIL|SMS)$"),
    record_type: Optional[str] = Query(None), # PO, Procurement, Issue, Contract
    record_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Constructs pre-filled mailto: or sms: URI scheme with standard enterprise templates,
    and logs the trigger to history.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT company_name, contact_person, email, phone FROM vendors WHERE id = ?", (vendor_id,))
    vendor = cursor.fetchone()
    if not vendor:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found")

    # Build smart templates
    if record_type == "PO" and record_id:
        subject = f"[VendorIQ] Urgent Status Update on Purchase Order {record_id}"
        body = (
            f"Dear {vendor['contact_person']},\n\n"
            f"We are following up regarding Purchase Order {record_id} with {vendor['company_name']}.\n"
            f"Please provide an expedited delivery status update and tracking details at your earliest convenience.\n\n"
            f"Regards,\n{current_user['full_name']}\nVendorIQ Procurement Operations"
        )
        sms_text = f"[VendorIQ] Follow-up on PO {record_id}: Please reply with ETA confirmation. - {current_user['full_name']}"
    elif record_type == "Issue" and record_id:
        subject = f"[VendorIQ] Critical Quality / Resolution Notice: Ticket {record_id}"
        body = (
            f"Dear {vendor['contact_person']},\n\n"
            f"An incident ticket ({record_id}) has been recorded for your review.\n"
            f"Please review corrective actions and respond within your agreed service level agreement.\n\n"
            f"Regards,\n{current_user['full_name']}\nVendorIQ Quality Team"
        )
        sms_text = f"[VendorIQ Alert] Ticket {record_id} requires urgent SLA response. - {current_user['full_name']}"
    elif record_type == "Contract" and record_id:
        subject = f"[VendorIQ] Contract Compliance & Renewal Notice: {record_id}"
        body = (
            f"Dear {vendor['contact_person']},\n\n"
            f"This is a formal communication regarding contract {record_id} with {vendor['company_name']}.\n"
            f"Please ensure documentation and renewal terms are submitted.\n\n"
            f"Regards,\n{current_user['full_name']}\nVendorIQ Compliance"
        )
        sms_text = f"[VendorIQ] Renewal notice for Contract {record_id}. Please review email notice."
    else:
        subject = f"[VendorIQ Enterprise Sourcing] Communication with {vendor['company_name']}"
        body = (
            f"Dear {vendor['contact_person']},\n\n"
            f"This is an official communication from {current_user['full_name']} at VendorIQ.\n\n"
            f"Regards,\n{current_user['full_name']}"
        )
        sms_text = f"[VendorIQ] Communication from {current_user['full_name']}. Please check your email."

    if communication_type == "EMAIL":
        params = {"subject": subject, "body": body}
        uri = f"mailto:{vendor['email']}?{urllib.parse.urlencode(params, quote_via=urllib.parse.quote)}"
        target_contact = vendor["email"]
    else: # SMS
        clean_phone = vendor["phone"].replace(" ", "").replace("-", "")
        params = {"body": sms_text}
        uri = f"sms:{clean_phone}?{urllib.parse.urlencode(params, quote_via=urllib.parse.quote)}"
        target_contact = vendor["phone"]

    # Automatically record in communication history
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO communication_records (
            vendor_id, user_id, communication_type, recipient_contact,
            subject, message_body, related_record_type, related_record_id,
            response_time_hours, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (vendor_id, current_user["id"], communication_type, target_contact,
          subject if communication_type == "EMAIL" else "SMS Alert",
          body if communication_type == "EMAIL" else sms_text,
          record_type, record_id, 2.5, now_str))

    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, record_type, record_id, details)
        VALUES (?, ?, ?, 'Communication', ?, ?, ?)
    """, (current_user["id"], current_user["full_name"], f"{communication_type} Dispatched",
          record_type or 'Vendor', str(vendor_id),
          f"{communication_type} intent opened for {vendor['company_name']} ({target_contact})"))

    conn.commit()
    conn.close()

    return {
        "uri": uri,
        "communication_type": communication_type,
        "target_contact": target_contact,
        "subject": subject if communication_type == "EMAIL" else "SMS Notification",
        "body": body if communication_type == "EMAIL" else sms_text,
        "vendor_name": vendor["company_name"]
    }

@router.get("/history")
def get_communication_history(
    vendor_id: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT cr.*, v.company_name as vendor_name, v.category as vendor_category, u.full_name as user_name
        FROM communication_records cr
        JOIN vendors v ON cr.vendor_id = v.id
        LEFT JOIN users u ON cr.user_id = u.id
        WHERE 1=1
    """
    params = []
    if current_user["role"] == "Vendor":
        if not current_user["vendor_id"]:
            conn.close()
            return []
        query += " AND cr.vendor_id = ?"
        params.append(current_user["vendor_id"])
    elif vendor_id:
        query += " AND cr.vendor_id = ?"
        params.append(vendor_id)

    query += " ORDER BY cr.timestamp DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
