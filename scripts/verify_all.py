import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.auth_service import login_user as L
from auth.jwt_handler import get_token_claims as V
from database.connection import get_database
from services.communication_service import get_thread_stats

db = get_database()
print("=== DB State ===")
for c in ["users","procurement_requests","communications","vendors","purchase_orders"]:
    print("  " + c + ": " + str(db[c].count_documents({})) + " docs")

print("\n=== Login Tests ===")
demos = [
    ("admin@vendorpulse.com","admin123"),
    ("procurement@vendorpulse.com","procure123"),
    ("supply@vendorpulse.com","supply123"),
    ("finance@vendorpulse.com","finance123"),
    ("auditor@vendorpulse.com","audit123"),
    ("vendor@alpha.com","vendor123"),
]
all_ok = True
for e, pw in demos:
    ok, _, t, u = L(e, pw)
    jwt_ok = bool(V(t)) if ok else False
    status = "PASS" if (ok and jwt_ok) else "FAIL"
    if status == "FAIL":
        all_ok = False
    role = u.get("role") if u else "N/A"
    print("  " + status + " " + e + " -> " + str(role))

stats = get_thread_stats()
print("\n=== Communications ===")
print("  Messages: " + str(stats["total_messages"]))
print("  Vendor threads: " + str(stats["vendor_threads"]))
print("  Procurement threads: " + str(stats["procurement_threads"]))
print("\nAll logins OK: " + str(all_ok))
