import asyncio
import sys
import traceback
sys.path.append('.')
from app.database import AsyncSessionLocal
from app.routers.auth import register_organization
from app.schemas.auth import RegisterOrganizationRequest
try:
    from fastapi import Request
except Exception:
    # Fallback for environments where fastapi isn't resolvable by the linter
    from starlette.requests import Request

async def test():
    req = RegisterOrganizationRequest(
        org_name='test_99', 
        email='test99@test.com', 
        password='password123', 
        display_name='Test', 
        data_residency_region='in'
    )
    scope = {
        "type": "http",
        "client": ("127.0.0.1", 8000),
        "path": "/register-organization",
        "headers": []
    }
    request = Request(scope)
    async with AsyncSessionLocal() as db:
        try:
            await register_organization(request, req, db)
            print("SUCCESS")
        except Exception as e:
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
