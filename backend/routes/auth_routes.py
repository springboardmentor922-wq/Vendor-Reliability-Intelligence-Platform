"""
VendorIQ Auth Routes
"""
from fastapi import APIRouter, HTTPException, Depends, status
from backend.database import get_db
from backend.models import LoginRequest, DemoLoginRequest, UserRegisterRequest, TokenResponse
from backend.auth import verify_password, get_password_hash, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

DEMO_ROLES = {
    "Administrator": "admin@vendoriq.internal",
    "Procurement Manager": "procurement@vendoriq.internal",
    "Supply Chain Manager": "supplychain@vendoriq.internal",
    "Vendor": "vendor@vendoriq.internal",
    "Finance Officer": "finance@vendoriq.internal",
    "Auditor": "auditor@vendoriq.internal"
}

@router.post("/login", response_model=TokenResponse)
def login(creds: LoginRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, email, password_hash, full_name, role, vendor_id, department, is_active
        FROM users WHERE email = ?
    """, (creds.email,))
    user = cursor.fetchone()

    if not user or not verify_password(creds.password, user["password_hash"]):
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid email or password")

    if not user["is_active"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # Audit log
    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, details)
        VALUES (?, ?, 'User Login', 'Auth', 'User logged in via email credentials')
    """, (user["id"], user["full_name"]))
    conn.commit()
    conn.close()

    token = create_access_token({"sub": user["email"], "role": user["role"], "id": user["id"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "vendor_id": user["vendor_id"],
            "department": user["department"]
        }
    }

@router.post("/demo-login", response_model=TokenResponse)
def demo_login(req: DemoLoginRequest):
    email = DEMO_ROLES.get(req.role)
    if not email:
        raise HTTPException(status_code=400, detail=f"Invalid demo role. Allowed: {list(DEMO_ROLES.keys())}")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, email, full_name, role, vendor_id, department, is_active
        FROM users WHERE email = ?
    """, (email,))
    user = cursor.fetchone()

    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="Demo account not found in database")

    # Audit log
    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, details)
        VALUES (?, ?, 'Demo Login', 'Auth', ?)
    """, (user["id"], user["full_name"], f"Quick-authenticated via Demo Mode card for role: {req.role}"))
    conn.commit()
    conn.close()

    token = create_access_token({"sub": user["email"], "role": user["role"], "id": user["id"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": dict(user)
    }

@router.post("/register")
def register_vendor(req: UserRegisterRequest):
    conn = get_db()
    cursor = conn.cursor()

    # Check if user already exists
    cursor.execute("SELECT id FROM users WHERE email = ?", (req.email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Valid vendor category check
    allowed_categories = [
        "Raw Material Suppliers", "Equipment Vendors", "IT Vendors",
        "Service Providers", "Logistics Partners", "Maintenance Vendors"
    ]
    if req.category not in allowed_categories:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Category must be one of: {allowed_categories}")

    # Generate Vendor Code
    cursor.execute("SELECT COUNT(*) FROM vendors")
    v_count = cursor.fetchone()[0] + 1
    prefix = req.category[:3].upper()
    v_code = f"VND-{prefix}-{v_count:03d}"

    # 1. Create Vendor Record with status 'Pending Approval'
    cursor.execute("""
        INSERT INTO vendors (
            vendor_code, company_name, category, status,
            contact_person, designation, email, phone,
            address, tax_id, products_services
        ) VALUES (?, ?, ?, 'Pending Approval', ?, 'Primary Contact', ?, ?, ?, ?, ?)
    """, (v_code, req.company_name, req.category, req.contact_person, req.email, req.phone, req.address, req.tax_id, req.products_services))
    new_vendor_id = cursor.lastrowid

    # 2. Create User Account for the Vendor
    pw_hash = get_password_hash(req.password)
    user_fullname = req.full_name or req.contact_person
    cursor.execute("""
        INSERT INTO users (email, password_hash, full_name, role, vendor_id, department)
        VALUES (?, ?, ?, 'Vendor', ?, ?)
    """, (req.email, pw_hash, user_fullname, new_vendor_id, req.company_name))
    new_user_id = cursor.lastrowid

    # 3. Add primary contact
    cursor.execute("""
        INSERT INTO vendor_contacts (vendor_id, name, designation, email, phone, is_primary)
        VALUES (?, ?, 'Primary Contact', ?, ?, 1)
    """, (new_vendor_id, req.contact_person, req.email, req.phone))

    # 4. Status history entry
    cursor.execute("""
        INSERT INTO vendor_status_history (vendor_id, previous_status, new_status, changed_by, notes)
        VALUES (?, NULL, 'Pending Approval', ?, 'Vendor self-registered online. Awaiting document verification.')
    """, (new_vendor_id, new_user_id))

    # 5. Audit Log
    cursor.execute("""
        INSERT INTO audit_logs (user_id, user_name, action, module, record_type, record_id, details)
        VALUES (?, ?, 'Vendor Self-Registration', 'Vendor', 'Vendor', ?, ?)
    """, (new_user_id, user_fullname, str(new_vendor_id), f"New vendor registered: {req.company_name} ({v_code}) with status Pending Approval"))

    # 6. Notification for Administrator & Procurement Manager
    cursor.execute("""
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('Administrator', 'New Vendor Registration Pending', ?, 'WARNING', '#/vendor-approval')
    """, (f"Vendor '{req.company_name}' ({req.category}) registered. Requires approval.",))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": "Vendor registration submitted successfully. Your account status is 'Pending Approval' until verified by Administrator.",
        "vendor_code": v_code,
        "status": "Pending Approval"
    }

@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return user
