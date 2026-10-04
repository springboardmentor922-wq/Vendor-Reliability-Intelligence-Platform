import sqlite3
from datetime import datetime

conn = sqlite3.connect('vendors.db')
c = conn.cursor()

# 1. Update purchase_orders row 140 to 'Accepted'
c.execute("""
    UPDATE purchase_orders 
    SET status = 'Accepted', updated_at = ?
    WHERE id = 140
""", (datetime.utcnow().isoformat(),))

# 2. Update procurement_requests row 18 to 'Ordered'
c.execute("""
    UPDATE procurement_requests 
    SET status = 'Ordered', updated_at = ?
    WHERE id = 18
""", (datetime.utcnow().isoformat(),))

# 3. Clean up premature audit review status
c.execute("""
    DELETE FROM audit_review_statuses 
    WHERE transaction_id = 18 AND transaction_type = 'ProcurementRequest'
""")

# 4. Add audit log entry
c.execute("""
    INSERT INTO audit_logs (
        user_id, user_name, user_role, action, entity_type, entity_id,
        previous_status, new_status, details, created_at
    ) VALUES (
        1, 'Administrator', 'Administrator', 'CORRECTION_STATUS_RESTORED',
        'ProcurementRequest', 18, 'Completed', 'Ordered',
        'Restored PR-2026-0018 and PO-2026-0140 from premature Completed status back to Ordered/Accepted as delivery is pending from vendor yashwanth.',
        ?
    )
""", (datetime.utcnow().isoformat(),))

conn.commit()
print("Successfully updated database records.")
