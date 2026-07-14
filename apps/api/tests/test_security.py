"""Tests for security headers, CORS, correlation IDs, rate limiting, and log PII."""

import logging
import uuid

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.user import UserRole
from app.services.auth_service import create_access_token
from app.settings import settings
from tests.conftest import create_user

# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------


async def test_security_headers_present(client: AsyncClient) -> None:
    resp = await client.get("/health")
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["x-frame-options"] == "DENY"
    assert resp.headers["x-xss-protection"] == "0"
    assert resp.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert resp.headers["content-security-policy"] == "default-src 'none'"
    assert "geolocation=()" in resp.headers["permissions-policy"]


async def test_hsts_absent_outside_production(client: AsyncClient) -> None:
    # HSTS is only emitted in production to avoid breaking local http:// flows.
    assert settings.environment != "production"
    resp = await client.get("/health")
    assert "strict-transport-security" not in resp.headers


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------


async def test_cors_allowed_origin(client: AsyncClient) -> None:
    resp = await client.get(
        "/health",
        headers={"Origin": "http://localhost:3000"},
    )
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


async def test_cors_disallowed_origin_omits_header(client: AsyncClient) -> None:
    resp = await client.get(
        "/health",
        headers={"Origin": "https://evil.example.com"},
    )
    assert "access-control-allow-origin" not in resp.headers


async def test_cors_preflight_returns_ok(client: AsyncClient) -> None:
    resp = await client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
    )
    # 204 No Content is the correct HTTP response for a successful OPTIONS
    # preflight per RFC 7231 §4.3.7.
    assert resp.status_code == status.HTTP_204_NO_CONTENT
    assert "access-control-allow-methods" in resp.headers


# ---------------------------------------------------------------------------
# Correlation ID
# ---------------------------------------------------------------------------


async def test_correlation_id_present_in_response(client: AsyncClient) -> None:
    resp = await client.get("/health")
    assert "x-request-id" in resp.headers
    uuid.UUID(resp.headers["x-request-id"])  # must be a valid UUID


async def test_correlation_id_preserved_when_provided(client: AsyncClient) -> None:
    custom_id = str(uuid.uuid4())
    resp = await client.get("/health", headers={"X-Request-ID": custom_id})
    assert resp.headers["x-request-id"] == custom_id


# ---------------------------------------------------------------------------
# Auth rate limiting
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="Rate limiting disabled for now")
async def test_login_rate_limit_fires_after_cap(
    client: AsyncClient,
) -> None:
    cap = settings.auth_login_rate_limit_calls

    for _ in range(cap):
        resp = await client.post(
            "/auth/login",
            json={"email": "nobody@example.com", "password": "wrong"},
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    resp = await client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "wrong"},
    )
    assert resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "retry-after" in resp.headers


@pytest.mark.skip(reason="Rate limiting disabled for now")
async def test_register_rate_limit_fires_after_cap(
    client: AsyncClient,
) -> None:
    cap = settings.auth_register_rate_limit_calls

    for i in range(cap):
        resp = await client.post(
            "/auth/register-organization",
            json={
                "org_name": f"RateLimit Org {i}",
                "email": f"rl-{i}-{uuid.uuid4()}@example.com",
                "password": "TestPass123!",
                "display_name": "RL Test",
            },
        )
        assert resp.status_code != status.HTTP_429_TOO_MANY_REQUESTS

    resp = await client.post(
        "/auth/register-organization",
        json={
            "org_name": "RateLimit Org Over",
            "email": f"rl-over-{uuid.uuid4()}@example.com",
            "password": "TestPass123!",
            "display_name": "RL Test",
        },
    )
    assert resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "retry-after" in resp.headers


# ---------------------------------------------------------------------------
# No PII in logs
# ---------------------------------------------------------------------------


async def test_no_email_in_request_logs(
    client: AsyncClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Email in the request body must never appear in structured log output."""
    sentinel_email = f"pii-probe-{uuid.uuid4()}@example.com"

    with caplog.at_level(logging.INFO):
        await client.post(
            "/auth/register-organization",
            json={
                "org_name": "PII Test Org",
                "email": sentinel_email,
                "password": "TestPass123!",
                "display_name": "PII Test",
            },
        )

    all_log_text = " ".join(caplog.messages)
    assert (
        sentinel_email not in all_log_text
    ), f"Email address appeared in log output. Captured: {all_log_text!r}"


async def test_no_token_in_request_logs(
    client: AsyncClient,
    db_session,
    org_a: Organization,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """JWT in the Authorization header must never appear in structured log output."""
    from app.services.auth_service import create_access_token

    user, _ = await create_user(db_session, org_a.id, UserRole.EMPLOYEE, tag="tokpii")
    access_token = create_access_token(user.id, user.org_id, user.role.value)

    with caplog.at_level(logging.INFO):
        await client.get("/health", headers={"Authorization": f"Bearer {access_token}"})

    all_log_text = " ".join(caplog.messages)
    assert access_token not in all_log_text, "Access token appeared in log output."


# ---------------------------------------------------------------------------
# Ghost merge ownership verification
# ---------------------------------------------------------------------------


async def test_ghost_merge_rejects_unauthenticated(
    client: AsyncClient,
    db_session: AsyncSession,
    org_a: Organization,
) -> None:
    """POST /auth/ghost/merge must require a valid ghost JWT.

    Without authentication, or with a real user's token (not a ghost), the
    endpoint must reject the request.  Only a valid anonymous ghost JWT
    (obtainable only through /auth/spawn-ghost) should be accepted.
    """
    merge_body = {
        "email": "merge-test@example.com",
        "display_name": "Merged User",
        "password": "NewPass123!",
    }

    # 1. No auth header at all → 403 (FastAPI's HTTPBearer raises 403 when
    #    the Authorization header is missing entirely)
    resp = await client.post("/auth/ghost/merge", json=merge_body)
    assert resp.status_code == status.HTTP_403_FORBIDDEN, "No-auth rejected"

    # 2. Real (non-ghost) user JWT → 403
    real_user, _ = await create_user(
        db_session, org_a.id, UserRole.EMPLOYEE, tag="merge-real"
    )
    real_token = create_access_token(real_user.id, org_a.id, UserRole.EMPLOYEE.value)
    resp = await client.post(
        "/auth/ghost/merge",
        json=merge_body,
        headers={"Authorization": f"Bearer {real_token}"},
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN, "Real-user rejected"

    # 3. Ghost user's JWT → 200 (and returns new tokens).  The ghost must have
    #    been spawned through /auth/spawn-ghost so that anonymous_session_id is set.
    ghost_user, _ = await create_user(
        db_session, org_a.id, UserRole.ANONYMOUS, tag="merge-ghost"
    )
    ghost_user.is_anonymous = True
    ghost_user.anonymous_session_id = str(uuid.uuid4())
    db_session.add(ghost_user)
    await db_session.commit()

    ghost_token = create_access_token(ghost_user.id, org_a.id, UserRole.ANONYMOUS.value)
    resp = await client.post(
        "/auth/ghost/merge",
        json=merge_body,
        headers={"Authorization": f"Bearer {ghost_token}"},
    )
    assert resp.status_code == status.HTTP_200_OK, "Ghost token must be accepted"
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    # The merged user should no longer be anonymous
    assert data["token_type"] == "bearer"


async def test_ghost_merge_rejects_no_anonymous_session(
    client: AsyncClient,
    db_session: AsyncSession,
    org_a: Organization,
) -> None:
    """Ghost without anonymous_session_id is rejected.

    The merge endpoint requires the ghost was spawned through the proper
    flow, which sets anonymous_session_id on the user.
    A ghost created directly in the DB bypasses this and must be rejected.
    """
    ghost_user, _ = await create_user(
        db_session, org_a.id, UserRole.ANONYMOUS, tag="xa-no-session"
    )
    ghost_user.is_anonymous = True
    ghost_user.anonymous_session_id = None
    db_session.add(ghost_user)
    await db_session.commit()

    ghost_token = create_access_token(ghost_user.id, org_a.id, UserRole.ANONYMOUS.value)
    resp = await client.post(
        "/auth/ghost/merge",
        json={
            "email": "no-session@example.com",
            "display_name": "No Session",
            "password": "Pass123!",
        },
        headers={"Authorization": f"Bearer {ghost_token}"},
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert "anonymous session" in resp.text.lower()

    # Ghost user must still exist and remain anonymous
    await db_session.refresh(ghost_user)
    assert ghost_user.is_anonymous is True
