import sqlite3

conn = sqlite3.connect('vendors.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

print("=== ALL PROCUREMENT REQUESTS ===")
prs = c.execute("SELECT id, request_number, title, status, assigned_vendor_id FROM procurement_requests").fetchall()
for pr in prs:
    print(dict(pr))

print("\n=== ALL PURCHASE ORDERS ===")
pos = c.execute("SELECT id, po_number, procurement_request_id, vendor_id, status FROM purchase_orders").fetchall()
for po in pos:
    print(dict(po))
