import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.user import UserRole
from app.services.auth_service import create_access_token
from tests.conftest import create_user


@pytest.mark.asyncio
async def test_employee_rejected_from_admin_ping(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    user, _ = await create_user(db_session, org_a.id, UserRole.EMPLOYEE, "emp")
    token = create_access_token(user.id, user.org_id, user.role.value)
    resp = await client.get("/admin/ping", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_accepted_at_admin_ping(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    user, _ = await create_user(db_session, org_a.id, UserRole.ADMIN, "adm")
    token = create_access_token(user.id, user.org_id, user.role.value)
    resp = await client.get("/admin/ping", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["pong"] is True


@pytest.mark.asyncio
async def test_hr_manager_accepted_at_admin_ping(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    user, _ = await create_user(db_session, org_a.id, UserRole.HR_MANAGER, "hr")
    token = create_access_token(user.id, user.org_id, user.role.value)
    resp = await client.get("/admin/ping", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected(client: AsyncClient) -> None:
    resp = await client.get("/admin/ping")
    assert resp.status_code == 401
