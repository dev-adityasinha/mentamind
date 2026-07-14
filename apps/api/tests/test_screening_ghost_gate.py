import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.user import UserRole
from app.services.auth_service import create_access_token
from tests.conftest import create_user


@pytest.mark.asyncio
async def test_ghost_user_rejected_from_screening(
    client: AsyncClient,
    db_session: AsyncSession,
    org_a: Organization,
) -> None:
    """A ghost user must be explicitly rejected from clinical screening endpoints."""
    # Create a real employee and a ghost user
    real_user, _ = await create_user(db_session, org_a.id, UserRole.EMPLOYEE, "real")
    ghost_user, _ = await create_user(db_session, org_a.id, UserRole.ANONYMOUS, "ghost")
    ghost_user.is_anonymous = True
    db_session.add(ghost_user)
    await db_session.commit()

    # Ghost token
    ghost_token = create_access_token(ghost_user.id, org_a.id, UserRole.ANONYMOUS.value)
    resp = await client.post(
        "/screening/sessions",
        headers={"Authorization": f"Bearer {ghost_token}"},
    )
    assert resp.status_code == 403
    assert "Anonymous ghost users cannot access this resource" in resp.json()["detail"]

    # Real employee token
    real_token = create_access_token(real_user.id, org_a.id, UserRole.EMPLOYEE.value)
    resp = await client.post(
        "/screening/sessions",
        headers={"Authorization": f"Bearer {real_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "session_started"
