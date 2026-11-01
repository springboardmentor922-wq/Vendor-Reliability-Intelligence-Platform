import sqlite3

conn = sqlite3.connect('vendors.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

logs = c.execute("SELECT * FROM audit_logs WHERE action = 'PR_STATUS_UPDATED'").fetchall()
print([dict(l) for l in logs])
