"""Check admin password hash."""
import asyncio
from app.database import AsyncSessionLocal
from app.security import verify_password
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users'"))
        cols = [r[0] for r in result]
        print("User columns:", cols)
        
        result = await db.execute(text("SELECT email, hashed_password FROM users WHERE email='admin@example.com'"))
        row = result.first()
        if row:
            print(f"Found: {row[0]}")
            for pwd in ['Admin@123', 'admin123', 'admin@123', 'Admin123', 'password', 'admin', 'Passw0rd!', 'Admin1234']:
                try:
                    ok = verify_password(pwd, row[1])
                    print(f"  password '{pwd}': {ok}")
                    if ok:
                        break
                except Exception as e:
                    print(f"  error: {e}")
        else:
            print("No admin user found")

asyncio.run(main())
