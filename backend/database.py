"""
VendorIQ Database Module
Manages SQLite connection, schema definition, and helper functions.
"""
import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "vendoriq.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn

def init_db():
    """Initializes the SQLite schema with all required entities."""
    conn = get_db()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL, -- Administrator, Procurement Manager, Supply Chain Manager, Vendor, Finance Officer, Auditor
        vendor_id INTEGER,
        department TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
    );
    """)

    # 2. Vendors Table (6 Mandatory Categories)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_code TEXT UNIQUE NOT NULL,
        company_name TEXT NOT NULL,
        category TEXT NOT NULL, -- Raw Material Suppliers, Equipment Vendors, IT Vendors, Service Providers, Logistics Partners, Maintenance Vendors
        status TEXT NOT NULL DEFAULT 'Pending Approval', -- Pending Approval, Active, Inactive, Suspended, Rejected
        contact_person TEXT NOT NULL,
        designation TEXT,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        tax_id TEXT,
        website TEXT,
        products_services TEXT,
        registration_number TEXT,
        approved_at TIMESTAMP,
        approved_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    # 3. Vendor Contacts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vendor_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        designation TEXT,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        department TEXT,
        is_primary INTEGER DEFAULT 0,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    );
    """)

    # 4. Vendor Documents Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vendor_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_id INTEGER NOT NULL,
        document_type TEXT NOT NULL,
        document_name TEXT NOT NULL,
        file_path TEXT,
        document_status TEXT DEFAULT 'Verified', -- Pending, Verified, Expired, Rejected
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    );
    """)

    # 5. Vendor Status History
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vendor_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_id INTEGER NOT NULL,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        changed_by INTEGER,
        notes TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
        FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    # 6. Procurement Requests Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS procurement_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_code TEXT UNIQUE NOT NULL,
        department TEXT NOT NULL,
        requested_by INTEGER,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        estimated_cost REAL NOT NULL,
        priority TEXT DEFAULT 'Medium', -- Low, Medium, High, Urgent
        required_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Approved, Rejected, Completed, Cancelled
        decision_by INTEGER,
        decision_date TIMESTAMP,
        decision_comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (decision_by) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    # 7. Purchase Orders Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT UNIQUE NOT NULL,
        request_id INTEGER,
        vendor_id INTEGER NOT NULL,
        order_date DATE NOT NULL,
        expected_delivery_date DATE NOT NULL,
        actual_delivery_date DATE,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'Ordered', -- Ordered, In Transit, Delivered, Completed, Cancelled
        shipping_mode TEXT DEFAULT 'Standard Class', -- Standard Class, First Class, Second Class, Same Day
        delivery_location TEXT,
        notes TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES procurement_requests(id) ON DELETE SET NULL,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    # 8. Purchase Order Items Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
    );
    """)

    # 9. Invoices Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        po_id INTEGER NOT NULL,
        vendor_id INTEGER NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        amount REAL NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Paid, Overdue
        paid_at TIMESTAMP,
        payment_reference TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT
    );
    """)

    # 10. Quality Evaluations Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quality_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_id INTEGER NOT NULL,
        vendor_id INTEGER NOT NULL,
        quality_rating REAL NOT NULL, -- 1.0 to 5.0
        inspected_quantity INTEGER NOT NULL,
        defective_quantity INTEGER NOT NULL DEFAULT 0,
        rejected_quantity INTEGER NOT NULL DEFAULT 0,
        evaluator_comments TEXT,
        evaluated_by INTEGER,
        evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
        FOREIGN KEY (evaluated_by) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    # 11. Issues / Complaints Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_code TEXT UNIQUE NOT NULL,
        vendor_id INTEGER NOT NULL,
        po_id INTEGER,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'Medium', -- Low, Medium, High, Critical
        status TEXT NOT NULL DEFAULT 'Open', -- Open, In Progress, Resolved
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        resolution_time_hours REAL,
        resolution_notes TEXT,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL
    );
    """)

    # 12. Contracts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_number TEXT UNIQUE NOT NULL,
        vendor_id INTEGER NOT NULL,
        contract_type TEXT NOT NULL, -- Master Service Agreement, Supply Agreement, Maintenance Contract, SLA
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        contract_value REAL NOT NULL,
        terms TEXT,
        document_url TEXT,
        status TEXT NOT NULL DEFAULT 'Active', -- Active, Expiring Soon, Expired, Renewed
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    );
    """)

    # 13. Certifications Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS certifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_id INTEGER NOT NULL,
        certification_name TEXT NOT NULL,
        issuing_body TEXT NOT NULL,
        issue_date DATE NOT NULL,
        expiry_date DATE NOT NULL,
        compliance_status TEXT NOT NULL DEFAULT 'Compliant', -- Compliant, Expiring Soon, Non-Compliant/Expired
        certificate_file TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    );
    """)

    # 14. Communication Records Table (Email & SMS only)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS communication_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_id INTEGER NOT NULL,
        user_id INTEGER,
        communication_type TEXT NOT NULL, -- EMAIL, SMS
        recipient_contact TEXT NOT NULL,
        subject TEXT,
        message_body TEXT,
        related_record_type TEXT, -- PO, Procurement, Issue, Contract, Vendor
        related_record_id TEXT,
        response_received_at TIMESTAMP,
        response_time_hours REAL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    # 15. Performance Snapshots (for historical trend tracking)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS performance_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_id INTEGER NOT NULL,
        period_month TEXT NOT NULL, -- YYYY-MM
        delivery_score REAL NOT NULL,
        quality_score REAL NOT NULL,
        communication_score REAL NOT NULL,
        compliance_score REAL NOT NULL,
        purchase_history_score REAL NOT NULL,
        issue_resolution_score REAL NOT NULL,
        overall_reliability REAL NOT NULL,
        risk_level TEXT NOT NULL, -- Low, Medium, High
        trend TEXT DEFAULT 'Stable', -- Improving, Stable, Declining
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
        UNIQUE (vendor_id, period_month)
    );
    """)

    # 16. Audit Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT,
        action TEXT NOT NULL, -- Login, Vendor Registration, Vendor Approval, Status Change, Procurement Request, etc.
        module TEXT NOT NULL,
        record_type TEXT,
        record_id TEXT,
        previous_value TEXT,
        new_value TEXT,
        details TEXT,
        ip_address TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    # 17. Notifications Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        role_target TEXT, -- If set, broadcast to role
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'INFO', -- INFO, WARNING, ALERT, SUCCESS
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 18. Supply Chain Dataset Table (Ingested from Excel for macro benchmarks & analytics)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS supply_chain_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        order_item_id INTEGER,
        order_date TIMESTAMP,
        shipping_date TIMESTAMP,
        shipping_mode TEXT,
        delivery_status TEXT,
        late_delivery_risk INTEGER,
        days_for_shipping_real REAL,
        days_for_shipment_scheduled REAL,
        category_name TEXT,
        department_name TEXT,
        customer_segment TEXT,
        order_city TEXT,
        order_country TEXT,
        order_region TEXT,
        market TEXT,
        order_status TEXT,
        product_name TEXT,
        product_price REAL,
        order_item_quantity INTEGER,
        order_item_total REAL,
        benefit_per_order REAL,
        sales REAL
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_v_cat ON vendors(category);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_v_status ON vendors(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_inv_po ON invoices(po_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sco_cat ON supply_chain_orders(category_name);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sco_dept ON supply_chain_orders(department_name);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sco_date ON supply_chain_orders(order_date);")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database tables initialized successfully.")
