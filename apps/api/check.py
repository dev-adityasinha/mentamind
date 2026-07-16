import asyncio
import sys
sys.path.append('.')
from app.database import AsyncSessionLocal
from app.models.user import User
try:
    from sqlalchemy import select
except Exception:
    # Fallback for environments where top-level sqlalchemy import may not resolve
    from sqlalchemy.sql import select

async def check():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User))
        for u in res.scalars():
            print(f"email_hash: {u.email_hash}, is_verified: {u.is_verified}")

if __name__ == "__main__":
    asyncio.run(check())
