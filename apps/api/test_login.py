import asyncio
import sys
import traceback

sys.path.append(".")
from fastapi import Request

from app.database import AsyncSessionLocal
from app.routers.auth import login
from app.schemas.auth import LoginRequest


async def test():
    req = LoginRequest(email="test99@test.com", password="password123")
    scope = {
        "type": "http",
        "client": ("127.0.0.1", 8000),
        "path": "/login",
        "headers": [],
    }
    request = Request(scope)
    async with AsyncSessionLocal() as db:
        try:
            await login(request, req, db)
            print("SUCCESS")
        except Exception:
            traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test())
