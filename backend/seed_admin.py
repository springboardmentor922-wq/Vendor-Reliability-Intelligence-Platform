"""
Standalone admin and foundational roles seeding script.
Can be executed directly via terminal or Railway Console:
    python seed_admin.py
"""
import asyncio
from app.database import AsyncSessionLocal
from app.main import seed_default_admin_and_roles
from app.models import Role, User
from app.security import verify_password
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

async def main():
    print("==================================================")
    print("ProcureFlow: Seeding Roles & Admin Account")
    print("==================================================")
    async with AsyncSessionLocal() as db:
        res = await seed_default_admin_and_roles(db)
        print(f"Action: {res['action'].upper()}")
        print(f"Admin Email: {res['admin_email']}")
        print(f"Admin Status: {res['admin_status']}")
        print(f"Admin Roles: {res['admin_roles']}")
        print(f"Database Roles: {res['database_roles']}")
        print(f"Sample Vendor Seeded: {res['sample_vendor_seeded']}")
        
        # Verify credentials
        adm = (await db.execute(select(User).where(User.email == "admin@example.com").options(selectinload(User.roles)))).scalar_one()
        pwd_ok = verify_password("Admin@123456", adm.hashed_password)
        print(f"Password Check ('Admin@123456'): {'PASS' if pwd_ok else 'FAIL'}")
        print("==================================================")
        print("Verification complete! Ready for login and registration.")

if __name__ == "__main__":
    asyncio.run(main())
