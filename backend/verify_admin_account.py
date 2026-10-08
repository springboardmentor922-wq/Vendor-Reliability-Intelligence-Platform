import asyncio
import json
from app.database import AsyncSessionLocal
from app.security import get_password_hash, verify_password
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT id, email, hashed_password, status FROM users WHERE email='admin@example.com'"))
        user = res.mappings().first()
        if not user:
            print("USER_NOT_FOUND")
            return
        
        user_dict = dict(user)
        user_id = user_dict["id"]
        pwd = user_dict["hashed_password"]
        
        print(f"User ID: {user_id}")
        print(f"Email: {user_dict['email']}")
        print(f"Status: {user_dict['status']}")
        print(f"Stored password prefix: {pwd[:15]}... (length: {len(pwd)})")
        
        # Check if bcrypt hash or plaintext
        is_bcrypt = pwd.startswith("$2b$") or pwd.startswith("$2a$")
        print(f"Is bcrypt hash format: {is_bcrypt}")
        
        matches = verify_password("Admin@123456", pwd)
        print(f"Verifies with 'Admin@123456': {matches}")
        
        # Check roles
        r_res = await db.execute(text("""
            SELECT r.id, r.name 
            FROM roles r 
            JOIN user_roles ur ON ur.role_id = r.id 
            WHERE ur.user_id = :uid
        """), {"uid": user_id})
        roles = [dict(r) for r in r_res.mappings().all()]
        print(f"Linked roles: {roles}")
        
        # If not verified or if plaintext, update password hash using get_password_hash
        if not matches or not is_bcrypt:
            print("Updating password hash using get_password_hash('Admin@123456')...")
            new_hash = get_password_hash("Admin@123456")
            await db.execute(
                text("UPDATE users SET hashed_password = :h WHERE id = :uid"),
                {"h": new_hash, "uid": user_id}
            )
            await db.commit()
            print("Updated successfully.")
            
            # Re-verify
            res2 = await db.execute(text("SELECT hashed_password FROM users WHERE id = :uid"), {"uid": user_id})
            updated_pwd = res2.scalar_one()
            print(f"Post-update verify: {verify_password('Admin@123456', updated_pwd)}")

if __name__ == "__main__":
    asyncio.run(main())
