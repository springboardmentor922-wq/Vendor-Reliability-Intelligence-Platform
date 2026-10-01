"""Check and fix admin password."""
import asyncio
from app.database import AsyncSessionLocal
from app.security import verify_password, get_password_hash
from sqlalchemy import text

CORRECT_PASSWORD = "Admin@123456"

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT id, email, hashed_password, status FROM users WHERE email='admin@example.com'"))
        row = result.first()
        if not row:
            print("No admin user found!")
            return

        user_id, email, hashed_password, status = row
        print(f"Found admin: {email}, status: {status}")
        print(f"Hash prefix: {hashed_password[:30]}...")

        # Test the expected correct password
        ok = verify_password(CORRECT_PASSWORD, hashed_password)
        print(f"Password '{CORRECT_PASSWORD}' matches: {ok}")

        if not ok:
            print("\nPassword doesn't match. Resetting to correct password...")
            new_hash = get_password_hash(CORRECT_PASSWORD)
            await db.execute(
                text("UPDATE users SET hashed_password = :h WHERE email = 'admin@example.com'"),
                {"h": new_hash}
            )
            await db.commit()
            print("Password reset successfully!")

            # Verify
            result2 = await db.execute(text("SELECT hashed_password FROM users WHERE email='admin@example.com'"))
            row2 = result2.first()
            verify_ok = verify_password(CORRECT_PASSWORD, row2[0])
            print(f"Post-reset verification: {verify_ok}")
        else:
            print("Password is already correct - login should work.")

asyncio.run(main())
