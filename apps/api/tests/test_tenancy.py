import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.user import UserRole
from app.services.auth_service import create_access_token
from tests.conftest import create_user


@pytest.mark.asyncio
async def test_cross_tenant_token_rejected(
    client: AsyncClient,
    db_session: AsyncSession,
    org_a: Organization,
    org_b: Organization,
) -> None:
    """A JWT whose org_id doesn't match the user's actual org must be rejected."""
    _, _ = await create_user(db_session, org_a.id, UserRole.EMPLOYEE, "ta")
    user_b, _ = await create_user(db_session, org_b.id, UserRole.EMPLOYEE, "tb")

    # Forge: user_b's user id but org_a's org_id
    forged_token = create_access_token(user_b.id, org_a.id, UserRole.EMPLOYEE.value)
    resp = await client.get("/me", headers={"Authorization": f"Bearer {forged_token}"})
    # user_b does not exist in org_a: must be 401, not 200
    assert resp.status_code == 401
