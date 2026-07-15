"""Tests for the onboarding flow, consent update, and consent enforcement."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.consent import _check_consent, _check_onboarding
from app.models.consent_record import ConsentType
from app.models.organization import Organization
from app.models.user import UserRole
from app.services.auth_service import create_access_token
from tests.conftest import create_user

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _register(db: AsyncSession, org_id: uuid.UUID) -> dict:
    user, _ = await create_user(
        db, org_id, UserRole.EMPLOYEE, tag=str(uuid.uuid4())[:8]
    )
    return {"access_token": create_access_token(user.id, user.org_id, user.role.value)}


def _auth(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


# ---------------------------------------------------------------------------
# Onboarding completion
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_onboarding_sets_timestamp_and_consent(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    tokens = await _register(db_session, org_a.id)
    headers = _auth(tokens)

    before = await client.get("/me", headers=headers)
    assert before.json()["onboarding_completed_at"] is None

    resp = await client.post(
        "/onboarding/complete",
        headers=headers,
        json={"consent_analytics": True, "consent_ai_coaching": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["onboarding_completed_at"] is not None
    assert data["consent_analytics"] is True
    assert data["consent_ai_coaching"] is False


@pytest.mark.asyncio
async def test_onboarding_updates_display_name(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    tokens = await _register(db_session, org_a.id)
    headers = _auth(tokens)

    resp = await client.post(
        "/onboarding/complete",
        headers=headers,
        json={
            "consent_analytics": False,
            "consent_ai_coaching": False,
            "display_name": "Renamed User",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Renamed User"


@pytest.mark.asyncio
async def test_onboarding_twice_returns_409(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    tokens = await _register(db_session, org_a.id)
    headers = _auth(tokens)
    body = {"consent_analytics": True, "consent_ai_coaching": True}

    first = await client.post("/onboarding/complete", headers=headers, json=body)
    assert first.status_code == 200

    second = await client.post("/onboarding/complete", headers=headers, json=body)
    assert second.status_code == 409


# ---------------------------------------------------------------------------
# Consent update
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_consent_update_blocked_before_onboarding(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    tokens = await _register(db_session, org_a.id)
    resp = await client.patch(
        "/me/consent",
        headers=_auth(tokens),
        json={"consent_analytics": True},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_consent_update_grant(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    tokens = await _register(db_session, org_a.id)
    headers = _auth(tokens)

    await client.post(
        "/onboarding/complete",
        headers=headers,
        json={"consent_analytics": False, "consent_ai_coaching": False},
    )

    resp = await client.patch(
        "/me/consent", headers=headers, json={"consent_analytics": True}
    )
    assert resp.status_code == 200
    assert resp.json()["consent_analytics"] is True


@pytest.mark.asyncio
async def test_consent_update_withdraw(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    tokens = await _register(db_session, org_a.id)
    headers = _auth(tokens)

    await client.post(
        "/onboarding/complete",
        headers=headers,
        json={"consent_analytics": True, "consent_ai_coaching": True},
    )

    resp = await client.patch(
        "/me/consent", headers=headers, json={"consent_ai_coaching": False}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["consent_ai_coaching"] is False
    assert data["consent_analytics"] is True


@pytest.mark.asyncio
async def test_consent_update_no_op_when_unchanged(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    tokens = await _register(db_session, org_a.id)
    headers = _auth(tokens)

    await client.post(
        "/onboarding/complete",
        headers=headers,
        json={"consent_analytics": True, "consent_ai_coaching": False},
    )

    resp = await client.patch(
        "/me/consent", headers=headers, json={"consent_analytics": True}
    )
    assert resp.status_code == 200
    assert resp.json()["consent_analytics"] is True


@pytest.mark.asyncio
async def test_consent_update_empty_body_422(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    tokens = await _register(db_session, org_a.id)
    headers = _auth(tokens)

    await client.post(
        "/onboarding/complete",
        headers=headers,
        json={"consent_analytics": True, "consent_ai_coaching": True},
    )

    resp = await client.patch("/me/consent", headers=headers, json={})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Consent records listing
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_consent_records_blocked_pre_onboarding(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    tokens = await _register(db_session, org_a.id)
    resp = await client.get("/me/consent-records", headers=_auth(tokens))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_consent_records_created_at_onboarding(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    tokens = await _register(db_session, org_a.id)
    headers = _auth(tokens)

    await client.post(
        "/onboarding/complete",
        headers=headers,
        json={"consent_analytics": True, "consent_ai_coaching": False},
    )

    resp = await client.get("/me/consent-records", headers=headers)
    assert resp.status_code == 200
    records = resp.json()
    assert len(records) == 2
    types = {r["consent_type"] for r in records}
    assert types == {"analytics", "ai_coaching"}
    actions = {r["consent_type"]: r["action"] for r in records}
    assert actions["analytics"] == "granted"
    assert actions["ai_coaching"] == "withdrawn"


@pytest.mark.asyncio
async def test_consent_records_grow_on_update(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    tokens = await _register(db_session, org_a.id)
    headers = _auth(tokens)

    await client.post(
        "/onboarding/complete",
        headers=headers,
        json={"consent_analytics": False, "consent_ai_coaching": False},
    )
    await client.patch("/me/consent", headers=headers, json={"consent_analytics": True})

    resp = await client.get("/me/consent-records", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 3


@pytest.mark.asyncio
async def test_consent_grant_withdraw_grant_writes_three_records(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    """grant -> withdraw -> grant for same type must produce three distinct records."""
    tokens = await _register(db_session, org_a.id)
    headers = _auth(tokens)

    await client.post(
        "/onboarding/complete",
        headers=headers,
        json={"consent_analytics": True, "consent_ai_coaching": False},
    )
    await client.patch(
        "/me/consent", headers=headers, json={"consent_analytics": False}
    )
    await client.patch("/me/consent", headers=headers, json={"consent_analytics": True})

    resp = await client.get("/me/consent-records", headers=headers)
    assert resp.status_code == 200
    records = resp.json()

    analytics_records = [r for r in records if r["consent_type"] == "analytics"]
    assert len(analytics_records) == 3, (
        "grant -> withdraw -> grant must produce exactly 3 analytics records"
    )
    actions = [r["action"] for r in analytics_records]
    assert actions == ["granted", "withdrawn", "granted"]


@pytest.mark.asyncio
async def test_withdrawal_revokes_access_on_next_request(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    """Verify that consent withdrawal is reflected immediately on the next request."""
    tokens = await _register(db_session, org_a.id)
    headers = _auth(tokens)

    await client.post(
        "/onboarding/complete",
        headers=headers,
        json={"consent_analytics": True, "consent_ai_coaching": True},
    )

    me_before = await client.get("/me", headers=headers)
    assert me_before.json()["consent_analytics"] is True

    patch = await client.patch(
        "/me/consent", headers=headers, json={"consent_analytics": False}
    )
    assert patch.status_code == 200

    me_after = await client.get("/me", headers=headers)
    assert me_after.json()["consent_analytics"] is False

    user_data = me_after.json()
    fresh_user = SimpleNamespace(
        consent_analytics=user_data["consent_analytics"],
        consent_ai_coaching=user_data["consent_ai_coaching"],
    )
    with pytest.raises(HTTPException) as exc:
        _check_consent(fresh_user, ConsentType.ANALYTICS)
    assert exc.value.status_code == 403


# ---------------------------------------------------------------------------
# Tenant isolation: consent records must not cross org boundaries
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_consent_records_org_isolated(
    client: AsyncClient,
    db_session: AsyncSession,
    org_a: Organization,
    org_b: Organization,
) -> None:
    tokens_a = await _register(db_session, org_a.id)
    tokens_b = await _register(db_session, org_b.id)

    for tokens in (tokens_a, tokens_b):
        await client.post(
            "/onboarding/complete",
            headers=_auth(tokens),
            json={"consent_analytics": True, "consent_ai_coaching": True},
        )

    resp_a = await client.get("/me/consent-records", headers=_auth(tokens_a))
    resp_b = await client.get("/me/consent-records", headers=_auth(tokens_b))

    ids_a = {r["id"] for r in resp_a.json()}
    ids_b = {r["id"] for r in resp_b.json()}
    assert ids_a.isdisjoint(ids_b), "consent records leaked across org boundary"


# ---------------------------------------------------------------------------
# Dependency unit tests (no HTTP round-trip needed)
# ---------------------------------------------------------------------------


def _fake_user(**kwargs) -> SimpleNamespace:
    defaults = {
        "onboarding_completed_at": None,
        "consent_analytics": False,
        "consent_ai_coaching": False,
    }
    return SimpleNamespace(**{**defaults, **kwargs})


def test_check_onboarding_blocks_none() -> None:
    user = _fake_user(onboarding_completed_at=None)
    with pytest.raises(HTTPException) as exc:
        _check_onboarding(user)
    assert exc.value.status_code == 403


def test_check_onboarding_passes_when_set() -> None:
    user = _fake_user(onboarding_completed_at=datetime.now(UTC))
    assert _check_onboarding(user) is user


def test_check_consent_blocks_missing_analytics() -> None:
    user = _fake_user(consent_analytics=False, consent_ai_coaching=True)
    with pytest.raises(HTTPException) as exc:
        _check_consent(user, ConsentType.ANALYTICS)
    assert exc.value.status_code == 403
    assert "analytics" in exc.value.detail


def test_check_consent_blocks_missing_ai_coaching() -> None:
    user = _fake_user(consent_analytics=True, consent_ai_coaching=False)
    with pytest.raises(HTTPException) as exc:
        _check_consent(user, ConsentType.AI_COACHING)
    assert exc.value.status_code == 403
    assert "ai_coaching" in exc.value.detail


def test_check_consent_passes_when_all_granted() -> None:
    user = _fake_user(consent_analytics=True, consent_ai_coaching=True)
    assert _check_consent(user, ConsentType.ANALYTICS, ConsentType.AI_COACHING) is user


def test_check_consent_passes_with_no_types_required() -> None:
    user = _fake_user(consent_analytics=False, consent_ai_coaching=False)
    assert _check_consent(user) is user
