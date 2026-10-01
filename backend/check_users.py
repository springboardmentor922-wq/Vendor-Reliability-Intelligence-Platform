"""Check users in database."""
import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT email, status FROM users LIMIT 10"))
        rows = result.all()
        print("Users in DB:")
        for r in rows:
            print(f"  {r[0]} -> {r[1]}")

asyncio.run(main())
