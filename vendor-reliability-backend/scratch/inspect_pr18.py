import sqlite3

conn = sqlite3.connect('vendors.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()
pr = c.execute("SELECT * FROM procurement_requests WHERE request_number = 'PR-2026-0018'").fetchone()
po = c.execute("SELECT * FROM purchase_orders WHERE procurement_request_id = ?", (pr['id'],)).fetchone()
deliv = c.execute("SELECT * FROM deliveries WHERE purchase_order_id = ?", (po['id'],)).fetchone()
rev = c.execute("SELECT * FROM audit_review_statuses WHERE transaction_id = ?", (pr['id'],)).fetchone()
print('PR:', dict(pr))
print('PO:', dict(po) if po else None)
print('Delivery:', dict(deliv) if deliv else None)
print('Audit Review:', dict(rev) if rev else None)
