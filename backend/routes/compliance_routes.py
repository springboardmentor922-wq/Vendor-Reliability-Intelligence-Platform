"""
VendorIQ Contracts & Compliance Module Routes
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, date, timedelta
from backend.database import get_db
from backend.auth import get_current_user, require_roles
from backend.models import ContractCreate, CertificationCreate

router = APIRouter(prefix="/api/compliance", tags=["Contracts & Compliance"])

@router.get("/contracts")
def list_contracts(status: Optional[str] = Query(None), current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT c.*, v.company_name as vendor_name, v.category as vendor_category, v.vendor_code
        FROM contracts c
        JOIN vendors v ON c.vendor_id = v.id
        WHERE 1=1
    """
    params = []
    if current_user["role"] == "Vendor":
        if not current_user["vendor_id"]:
            conn.close()
            return []
        query += " AND c.vendor_id = ?"
        params.append(current_user["vendor_id"])

    if status and status != "All":
        query += " AND c.status = ?"
        params.append(status)

    query += " ORDER BY c.end_date ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/contracts")
def create_contract(req: ContractCreate, current_user: dict = Depends(require_roles("Administrator", "Procurement Manager"))):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO contracts (contract_number, vendor_id, contract_type, start_date, end_date, contract_value, terms, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
    """, (req.contract_number, req.vendor_id, req.contract_type, req.start_date, req.end_date, req.contract_value, req.terms))
    new_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, record_type, record_id, details)
        VALUES (?, ?, 'Contract Created', 'Compliance', 'Contract', ?, ?)
    """, (current_user["id"], current_user["full_name"], req.contract_number, f"New contract {req.contract_number} value ${req.contract_value:,.2f} registered"))

    conn.commit()
    conn.close()
    return {"success": True, "contract_id": new_id, "contract_number": req.contract_number}

@router.get("/certifications")
def list_certifications(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT cert.*, v.company_name as vendor_name, v.category as vendor_category, v.vendor_code
        FROM certifications cert
        JOIN vendors v ON cert.vendor_id = v.id
        WHERE 1=1
    """
    params = []
    if current_user["role"] == "Vendor":
        if not current_user["vendor_id"]:
            conn.close()
            return []
        query += " AND cert.vendor_id = ?"
        params.append(current_user["vendor_id"])

    query += " ORDER BY cert.expiry_date ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/certifications")
def add_certification(req: CertificationCreate, current_user: dict = Depends(require_roles("Administrator", "Procurement Manager", "Vendor"))):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO certifications (vendor_id, certification_name, issuing_body, issue_date, expiry_date, compliance_status)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (req.vendor_id, req.certification_name, req.issuing_body, req.issue_date, req.expiry_date, req.compliance_status or 'Compliant'))
    new_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, record_type, record_id, details)
        VALUES (?, ?, 'Certification Added', 'Compliance', 'Certification', ?, ?)
    """, (current_user["id"], current_user["full_name"], str(new_id), f"Certification {req.certification_name} registered for vendor {req.vendor_id}"))

    conn.commit()
    conn.close()
    return {"success": True, "certification_id": new_id}

@router.get("/alerts")
def get_compliance_alerts(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    today_str = date.today().strftime("%Y-%m-%d")
    sixty_days_str = (date.today() + timedelta(days=60)).strftime("%Y-%m-%d")

    # Expired or expiring contracts
    cursor.execute("""
        SELECT 'Contract' as alert_type, c.contract_number as item_code, c.contract_type as name,
               v.company_name as vendor_name, c.end_date as deadline,
               CASE WHEN c.end_date < ? THEN 'EXPIRED' ELSE 'EXPIRING_SOON' END as severity
        FROM contracts c
        JOIN vendors v ON c.vendor_id = v.id
        WHERE c.end_date <= ?
        ORDER BY c.end_date ASC
    """, (today_str, sixty_days_str))
    contract_alerts = cursor.fetchall()

    # Expired or expiring certifications
    cursor.execute("""
        SELECT 'Certification' as alert_type, cert.id as item_code, cert.certification_name as name,
               v.company_name as vendor_name, cert.expiry_date as deadline,
               CASE WHEN cert.expiry_date < ? THEN 'EXPIRED' ELSE 'EXPIRING_SOON' END as severity
        FROM certifications cert
        JOIN vendors v ON cert.vendor_id = v.id
        WHERE cert.expiry_date <= ?
        ORDER BY cert.expiry_date ASC
    """, (today_str, sixty_days_str))
    cert_alerts = cursor.fetchall()
    conn.close()

    alerts = [dict(a) for a in contract_alerts] + [dict(a) for a in cert_alerts]
    alerts.sort(key=lambda x: str(x["deadline"]))
    return alerts
