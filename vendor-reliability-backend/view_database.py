"""
Database Table Viewer CLI for Vendor Reliability & Risk Management System
Usage:
    python view_database.py vendors
    python view_database.py orders
    python view_database.py deliveries
    python view_database.py users
    python view_database.py contracts
    python view_database.py [table_name] [--limit 20]
    python view_database.py export
"""
import sys
import os
import sqlite3
import csv

DB_PATH = os.path.join(os.path.dirname(__file__), "vendors.db")

def print_table(headers, rows, max_width=30):
    if not rows:
        print("\n  [No records found in this table]\n")
        return

    # Convert all cells to strings and truncate if too long
    str_rows = []
    for row in rows:
        formatted_row = []
        for cell in row:
            if cell is None:
                val = "NULL"
            elif isinstance(cell, float):
                val = f"{cell:.1f}"
            else:
                val = str(cell)
            if len(val) > max_width:
                val = val[:max_width - 3] + "..."
            formatted_row.append(val)
        str_rows.append(formatted_row)

    col_widths = [len(h) for h in headers]
    for row in str_rows:
        for idx, cell in enumerate(row):
            if idx < len(col_widths):
                col_widths[idx] = max(col_widths[idx], len(cell))

    separator = "+" + "+".join("-" * (w + 2) for w in col_widths) + "+"
    header_str = "|" + "|".join(f" {h:<{col_widths[i]}} " for i, h in enumerate(headers)) + "|"

    print(separator)
    print(header_str)
    print(separator)
    for row in str_rows:
        row_str = "|" + "|".join(f" {row[i]:<{col_widths[i]}} " if i < len(row) else f" {' ' * col_widths[i]} " for i in range(len(col_widths))) + "|"
        print(row_str)
    print(separator)
    print(f"Total Rows Displayed: {len(rows)}\n")

def list_all_tables(conn):
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [r[0] for r in cur.fetchall() if not r[0].startswith("sqlite_")]
    print("\n" + "=" * 65)
    print(" DATABASE TABLES OVERVIEW (vendors.db)")
    print("=" * 65)
    rows = []
    for t in tables:
        count = cur.execute(f"SELECT COUNT(*) FROM {t};").fetchone()[0]
        rows.append([t, count])
    print_table(["Table Name", "Total Records"], rows)
    print("Quick Commands:")
    print("  python view_database.py vendors     -> View Vendors table")
    print("  python view_database.py orders      -> View Purchase Orders table")
    print("  python view_database.py deliveries  -> View Deliveries table")
    print("  python view_database.py users       -> View Users table")
    print("  python view_database.py export      -> Export all tables to CSV files for Excel")
    print("=" * 65 + "\n")

def view_vendors(conn, limit=25):
    cur = conn.cursor()
    query = """
        SELECT id, name, company, email, category, status, deliveryRate, risk_level
        FROM vendors
        ORDER BY id ASC
        LIMIT ?;
    """
    rows = cur.execute(query, (limit,)).fetchall()
    headers = ["ID", "Vendor Name", "Company", "Email", "Category", "Status", "Reliability(%)", "Risk"]
    print(f"\n--- VENDORS TABLE (First {limit} records) ---")
    print_table(headers, rows)

def view_orders(conn, limit=25):
    cur = conn.cursor()
    query = """
        SELECT po.id, po.po_number, COALESCE(v.name, 'Unassigned') AS vendor_name, po.total_amount, po.status, po.expected_delivery_date, po.created_at
        FROM purchase_orders po
        LEFT JOIN vendors v ON po.vendor_id = v.id
        ORDER BY po.id DESC
        LIMIT ?;
    """
    rows = cur.execute(query, (limit,)).fetchall()
    headers = ["ID", "PO Number", "Vendor Name", "Total ($)", "Status", "Expected Delivery", "Created Date"]
    print(f"\n--- PURCHASE ORDERS TABLE (Latest {limit} records) ---")
    print_table(headers, rows)

def view_deliveries(conn, limit=25):
    cur = conn.cursor()
    query = """
        SELECT d.id, po.po_number, COALESCE(v.name, 'Unassigned') AS vendor_name, d.ordered_quantity, d.delivered_quantity, d.delay_days, d.delivery_status, d.created_at
        FROM deliveries d
        LEFT JOIN purchase_orders po ON d.purchase_order_id = po.id
        LEFT JOIN vendors v ON po.vendor_id = v.id
        ORDER BY d.id DESC
        LIMIT ?;
    """
    rows = cur.execute(query, (limit,)).fetchall()
    headers = ["Delivery ID", "PO Number", "Vendor Name", "Ordered Qty", "Delivered Qty", "Delay (Days)", "Status", "Date"]
    print(f"\n--- DELIVERIES TABLE (Latest {limit} records) ---")
    print_table(headers, rows)

def view_users(conn, limit=25):
    cur = conn.cursor()
    query = """
        SELECT id, full_name, email, role, approval_status, is_active, created_at
        FROM users
        ORDER BY id ASC
        LIMIT ?;
    """
    rows = cur.execute(query, (limit,)).fetchall()
    headers = ["ID", "Full Name", "Email", "Role", "Approval Status", "Active", "Created"]
    print(f"\n--- USERS TABLE (First {limit} records) ---")
    print_table(headers, rows)

def view_generic_table(conn, table_name, limit=25):
    cur = conn.cursor()
    # Check table existence safely
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?;", (table_name,))
    if not cur.fetchone():
        print(f"\nError: Table '{table_name}' does not exist in database.")
        list_all_tables(conn)
        return

    cur.execute(f"PRAGMA table_info({table_name});")
    headers = [col[1] for col in cur.fetchall()]

    cur.execute(f"SELECT * FROM {table_name} LIMIT ?;", (limit,))
    rows = cur.fetchall()
    print(f"\n--- TABLE: {table_name} (First {limit} records) ---")
    print_table(headers, rows)

def export_to_csv(conn):
    export_dir = os.path.join(os.path.dirname(__file__), "database_exports_csv")
    os.makedirs(export_dir, exist_ok=True)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [r[0] for r in cur.fetchall() if not r[0].startswith("sqlite_")]

    print(f"\nExporting {len(tables)} tables to CSV in folder: {export_dir}")
    for t in tables:
        cur.execute(f"PRAGMA table_info({t});")
        headers = [col[1] for col in cur.fetchall()]
        cur.execute(f"SELECT * FROM {t};")
        rows = cur.fetchall()
        csv_path = os.path.join(export_dir, f"{t}.csv")
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)
        print(f"  -> Exported '{t}' ({len(rows)} rows) to: {t}.csv")
    print(f"\nAll tables exported successfully! You can open any .csv file in Microsoft Excel or Google Sheets.\nLocation: {os.path.abspath(export_dir)}\n")

def main():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)

    args = sys.argv[1:]
    if not args:
        list_all_tables(conn)
        return

    cmd = args[0].lower()
    limit = 25
    if "--limit" in args:
        try:
            limit_idx = args.index("--limit") + 1
            limit = int(args[limit_idx])
        except (ValueError, IndexError):
            limit = 25

    if cmd == "export":
        export_to_csv(conn)
    elif cmd in ["vendors", "vendor"]:
        view_vendors(conn, limit)
    elif cmd in ["orders", "purchase_orders", "pos"]:
        view_orders(conn, limit)
    elif cmd in ["deliveries", "delivery"]:
        view_deliveries(conn, limit)
    elif cmd in ["users", "user"]:
        view_users(conn, limit)
    else:
        view_generic_table(conn, cmd, limit)

    conn.close()

if __name__ == "__main__":
    main()
