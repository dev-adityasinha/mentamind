import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.auth_service import validate_secret_keys
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
async def test_register_login_refresh_happy_path(client: AsyncClient) -> None:
    email = settings.super_admin_email
    password = "StrongPass123!"

    reg = await client.post(
        "/auth/register-organization",
        json={
            "org_name": "Happy Org",
            "email": email,
            "password": password,
            "display_name": "Happy User",
        },
    )
    assert reg.status_code == 201
    tokens = reg.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens

    # Access token works on /me
    me = await client.get(
        "/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    data = me.json()
    assert data["role"] == "admin"
    assert data["consent_analytics"] is False
    assert data["consent_ai_coaching"] is False

    # Refresh rotates tokens
    refresh = await client.post(
        "/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh.status_code == 200
    new_tokens = refresh.json()
    # Refresh token must rotate (new UUID4 each time, never equals old)
    assert new_tokens["refresh_token"] != tokens["refresh_token"]

    # New access token works
    me2 = await client.get(
        "/me", headers={"Authorization": f"Bearer {new_tokens['access_token']}"}
    )
    assert me2.status_code == 200

    # Old refresh token is revoked (rotation)
    stale = await client.post(
        "/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert stale.status_code == 401


# ---------------------------------------------------------------------------
# Startup secret key validation
# ---------------------------------------------------------------------------


def test_validate_secret_keys_rejects_placeholder_jwt() -> None:
    """validate_secret_keys() must raise when JWT_SECRET_KEY is the default."""
    original = settings.jwt_secret_key
    try:
        settings.jwt_secret_key = "change-me-in-production"
        with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
            validate_secret_keys()
    finally:
        settings.jwt_secret_key = original


def test_validate_secret_keys_rejects_placeholder_api() -> None:
    """validate_secret_keys() must raise when API_SECRET_KEY is the default."""
    original_jwt = settings.jwt_secret_key
    original_api = settings.api_secret_key
    try:
        settings.jwt_secret_key = "a" * 64
        settings.api_secret_key = "change-me-in-production"
        with pytest.raises(RuntimeError, match="API_SECRET_KEY"):
            validate_secret_keys()
    finally:
        settings.jwt_secret_key = original_jwt
        settings.api_secret_key = original_api


def test_validate_secret_keys_rejects_empty_jwt() -> None:
    """validate_secret_keys() must raise when JWT_SECRET_KEY is empty."""
    original = settings.jwt_secret_key
    try:
        settings.jwt_secret_key = ""
        with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
            validate_secret_keys()
    finally:
        settings.jwt_secret_key = original


def test_validate_secret_keys_rejects_short_jwt() -> None:
    """validate_secret_keys() must raise when JWT_SECRET_KEY is too short."""
    original = settings.jwt_secret_key
    try:
        settings.jwt_secret_key = "short"
        with pytest.raises(RuntimeError, match="too short"):
            validate_secret_keys()
    finally:
        settings.jwt_secret_key = original


def test_validate_secret_keys_accepts_valid_keys() -> None:
    """validate_secret_keys() must pass with real (non-placeholder) keys."""
    original_jwt = settings.jwt_secret_key
    original_api = settings.api_secret_key
    try:
        settings.jwt_secret_key = "a" * 64
        settings.api_secret_key = "b" * 32
        validate_secret_keys()  # should not raise
    finally:
        settings.jwt_secret_key = original_jwt
        settings.api_secret_key = original_api
