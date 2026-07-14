import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.settings import settings


@pytest.fixture(autouse=True)
async def clear_db(db_session: AsyncSession):
    from sqlalchemy import text

    await db_session.execute(text("DELETE FROM refresh_tokens"))
    await db_session.execute(text("DELETE FROM invitations"))
    await db_session.execute(text("DELETE FROM users"))
    await db_session.execute(text("DELETE FROM organizations"))
    await db_session.commit()


@pytest.mark.asyncio
async def test_register_org_happy_path(client: AsyncClient) -> None:
    resp = await client.post(
        "/auth/register-organization",
        json={
            "org_name": "Acme Corp",
            "email": settings.super_admin_email,
            "password": "StrongPass123!",
            "display_name": "Acme Admin",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data

    me = await client.get(
        "/me", headers={"Authorization": f"Bearer {data['access_token']}"}
    )
    assert me.status_code == 200
    me_data = me.json()
    assert me_data["role"] == "admin"
    assert me_data["onboarding_completed_at"] is None


@pytest.mark.asyncio
async def test_register_org_duplicate_email(client: AsyncClient) -> None:
    payload = {
        "org_name": "Beta Inc",
        "email": settings.super_admin_email,
        "password": "StrongPass123!",
        "display_name": "Beta Founder",
    }
    r1 = await client.post("/auth/register-organization", json=payload)
    assert r1.status_code == 201

    r2 = await client.post(
        "/auth/register-organization",
        json={**payload, "org_name": "Beta Inc 2"},
    )
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_register_org_rejects_client_org_id(client: AsyncClient) -> None:
    import uuid

    resp = await client.post(
        "/auth/register-organization",
        json={
            "org_name": "Sneaky Corp",
            "email": settings.super_admin_email,
            "password": "StrongPass123!",
            "display_name": "Sneaky",
            "org_id": str(uuid.uuid4()),
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_org_weak_password(client: AsyncClient) -> None:
    resp = await client.post(
        "/auth/register-organization",
        json={
            "org_name": "WeakCo",
            "email": settings.super_admin_email,
            "password": "short",
            "display_name": "Weak",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_org_short_name(client: AsyncClient) -> None:
    resp = await client.post(
        "/auth/register-organization",
        json={
            "org_name": "X",
            "email": settings.super_admin_email,
            "password": "StrongPass123!",
            "display_name": "X",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_org_stores_region(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    from sqlalchemy import select

    from app.models.organization import Organization

    resp = await client.post(
        "/auth/register-organization",
        json={
            "org_name": "India Corp",
            "email": settings.super_admin_email,
            "password": "StrongPass123!",
            "display_name": "CTO",
            "data_residency_region": "in",
        },
    )
    assert resp.status_code == 201

    me = await client.get(
        "/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"}
    )
    org_id = me.json()["org_id"]

    import uuid

    result = await db_session.execute(
        select(Organization).where(Organization.id == uuid.UUID(org_id))
    )
    org = result.scalar_one()
    assert org.data_residency_region.value == "in"


@pytest.mark.asyncio
async def test_register_org_default_region_is_india(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    from sqlalchemy import select

    from app.models.organization import Organization

    resp = await client.post(
        "/auth/register-organization",
        json={
            "org_name": "Default Region Corp",
            "email": settings.super_admin_email,
            "password": "StrongPass123!",
            "display_name": "Founder",
        },
    )
    assert resp.status_code == 201

    me = await client.get(
        "/me", headers={"Authorization": f"Bearer {resp.json()['access_token']}"}
    )
    org_id = me.json()["org_id"]

    import uuid

    result = await db_session.execute(
        select(Organization).where(Organization.id == uuid.UUID(org_id))
    )
    org = result.scalar_one()
    assert org.data_residency_region.value == "in"


@pytest.mark.asyncio
async def test_old_register_endpoint_gone(client: AsyncClient) -> None:
    """POST /auth/register must not exist; a client must not be able to supply
    org_id and role=admin."""
    import uuid

    resp = await client.post(
        "/auth/register",
        json={
            "org_id": str(uuid.uuid4()),
            "email": "attacker@evil.com",
            "password": "StrongPass123!",
            "display_name": "Attacker",
            "role": "admin",
        },
    )
    assert resp.status_code in (
        status.HTTP_404_NOT_FOUND,
        status.HTTP_405_METHOD_NOT_ALLOWED,
    )
