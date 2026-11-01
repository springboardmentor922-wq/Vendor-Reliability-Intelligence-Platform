"""
Utility script to quickly view records in the SQLite database (vendors.db)
Usage:
    py view_db.py              # Displays latest entries for both vendors and users
    py view_db.py vendors      # Displays all vendors
    py view_db.py users        # Displays all users
"""
import sqlite3
import sys
from pathlib import Path

# Force UTF-8 stdout if supported
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

DB_PATH = Path(__file__).parent / "vendors.db"

def get_connection():
    if not DB_PATH.exists():
        print(f"[ERROR] Database file not found at: {DB_PATH}")
        sys.exit(1)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def show_vendors(limit=10):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        SELECT id, name, company, email, phone, category, product, status, deliveryRate, risk_level, created_at
        FROM vendors
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))
    rows = c.fetchall()
    
    print("\n" + "=" * 90)
    print(f"[VENDORS TABLE] Showing latest {len(rows)} records - Database: vendors.db")
    print("=" * 90)
    
    if not rows:
        print("No vendor records found.")
        return
        
    for r in rows:
        print(f"ID: {r['id']} | Status: [{r['status']}] | Created: {r['created_at']}")
        print(f"  - Contact Name : {r['name']}")
        print(f"  - Company      : {r['company']}")
        print(f"  - Category     : {r['category']}")
        print(f"  - Product      : {r['product']}")
        print(f"  - Email / Phone: {r['email']} | {r['phone']}")
        print(f"  - Delivery Rate: {r['deliveryRate']}% | Risk Level: {r['risk_level']}")
        print("-" * 90)

def show_users(limit=10):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        SELECT id, full_name, email, role, company, phone, is_active, created_at
        FROM users
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))
    rows = c.fetchall()
    
    print("\n" + "=" * 90)
    print(f"[USERS TABLE] Showing latest {len(rows)} records - Database: vendors.db")
    print("=" * 90)
    
    if not rows:
        print("No user records found.")
        return
        
    for r in rows:
        print(f"ID: {r['id']} | Role: [{r['role']}] | Active: {r['is_active']} | Created: {r['created_at']}")
        print(f"  - Name   : {r['full_name']}")
        print(f"  - Email  : {r['email']}")
        print(f"  - Phone  : {r['phone']}")
        print(f"  - Company: {r['company']}")
        print("-" * 90)

if __name__ == "__main__":
    arg = sys.argv[1].lower() if len(sys.argv) > 1 else "all"
    if arg == "vendors":
        show_vendors(limit=25)
    elif arg == "users":
        show_users(limit=25)
    else:
        show_vendors(limit=5)
        show_users(limit=5)
