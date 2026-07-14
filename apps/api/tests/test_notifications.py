"""Tests for the notification service: rate cap, quiet hours, and REST endpoints."""

import uuid
from datetime import UTC, datetime

import pytest
from cryptography.exceptions import InvalidTag
from fakeredis import FakeAsyncRedis
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification_event import CATEGORY_RATE_CAP, NotificationCategory
from app.models.organization import Organization
from app.models.user import UserRole
from app.services.notification import (
    NotificationResult,
    _in_quiet_hours,
    send_email_ses_stub,
    send_notification,
)
from tests.conftest import create_user

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


async def _register_and_onboard(
    client: AsyncClient,
    db: AsyncSession,
    org_id: uuid.UUID,
    *,
    consent_analytics: bool = True,
    consent_ai_coaching: bool = True,
) -> dict:
    from app.services.auth_service import create_access_token

    user, _ = await create_user(
        db, org_id, UserRole.EMPLOYEE, tag=str(uuid.uuid4())[:8]
    )
    access_token = create_access_token(user.id, user.org_id, user.role.value)
    tokens = {"access_token": access_token}
    headers = {"Authorization": f"Bearer {access_token}"}

    ob = await client.post(
        "/onboarding/complete",
        headers=headers,
        json={
            "consent_analytics": consent_analytics,
            "consent_ai_coaching": consent_ai_coaching,
        },
    )
    assert ob.status_code == 200
    return tokens


# ---------------------------------------------------------------------------
# Quiet hours unit tests
# ---------------------------------------------------------------------------


def test_quiet_hours_wraps_midnight_inside() -> None:
    # 23:00 UTC should be quiet (22:00-07:00 window)
    assert _in_quiet_hours(datetime(2026, 6, 15, 23, 0, tzinfo=UTC)) is True


def test_quiet_hours_wraps_midnight_early_morning() -> None:
    # 03:00 UTC should be quiet
    assert _in_quiet_hours(datetime(2026, 6, 15, 3, 0, tzinfo=UTC)) is True


def test_quiet_hours_boundary_start_inclusive() -> None:
    # 22:00 UTC - exactly at start, should be quiet
    assert _in_quiet_hours(datetime(2026, 6, 15, 22, 0, tzinfo=UTC)) is True


def test_quiet_hours_boundary_end_exclusive() -> None:
    # 07:00 UTC - exactly at end, should NOT be quiet
    assert _in_quiet_hours(datetime(2026, 6, 15, 7, 0, tzinfo=UTC)) is False


def test_quiet_hours_midday_not_quiet() -> None:
    assert _in_quiet_hours(datetime(2026, 6, 15, 12, 0, tzinfo=UTC)) is False


# ---------------------------------------------------------------------------
# Rate cap unit tests (using FakeAsyncRedis directly)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_rate_cap_allows_up_to_limit(
    fake_redis: FakeAsyncRedis, db_session: AsyncSession, org_a: Organization
) -> None:
    user, _ = await create_user(db_session, org_a.id, UserRole.EMPLOYEE, "rc1")
    cap = CATEGORY_RATE_CAP[NotificationCategory.BURNOUT_ALERT]
    midday = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)

    results = []
    for _ in range(cap):
        r = await send_notification(
            db=db_session,
            redis=fake_redis,
            user_id=user.id,
            org_id=org_a.id,
            category=NotificationCategory.BURNOUT_ALERT,
            title="Risk level changed",
            body="Your burnout risk has increased.",
            now_utc=midday,
        )
        results.append(r)

    assert all(r == NotificationResult.SENT for r in results)


@pytest.mark.asyncio
async def test_rate_cap_blocks_on_exceed(
    fake_redis: FakeAsyncRedis, db_session: AsyncSession, org_a: Organization
) -> None:
    user, _ = await create_user(db_session, org_a.id, UserRole.EMPLOYEE, "rc2")
    cap = CATEGORY_RATE_CAP[NotificationCategory.BURNOUT_ALERT]
    midday = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)

    for _ in range(cap):
        await send_notification(
            db=db_session,
            redis=fake_redis,
            user_id=user.id,
            org_id=org_a.id,
            category=NotificationCategory.BURNOUT_ALERT,
            title="Risk level changed",
            body="Your burnout risk has increased.",
            now_utc=midday,
        )

    # One more call beyond the cap
    result = await send_notification(
        db=db_session,
        redis=fake_redis,
        user_id=user.id,
        org_id=org_a.id,
        category=NotificationCategory.BURNOUT_ALERT,
        title="Risk level changed",
        body="Your burnout risk has increased.",
        now_utc=midday,
    )
    assert result == NotificationResult.RATE_LIMITED


@pytest.mark.asyncio
async def test_rate_cap_is_per_category(
    fake_redis: FakeAsyncRedis, db_session: AsyncSession, org_a: Organization
) -> None:
    """Exhausting the cap for one category must not affect another."""
    user, _ = await create_user(db_session, org_a.id, UserRole.EMPLOYEE, "rc3")
    cap = CATEGORY_RATE_CAP[NotificationCategory.BURNOUT_ALERT]
    midday = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)

    for _ in range(cap + 1):
        await send_notification(
            db=db_session,
            redis=fake_redis,
            user_id=user.id,
            org_id=org_a.id,
            category=NotificationCategory.BURNOUT_ALERT,
            title="Burnout",
            body="Risk up.",
            now_utc=midday,
        )

    result = await send_notification(
        db=db_session,
        redis=fake_redis,
        user_id=user.id,
        org_id=org_a.id,
        category=NotificationCategory.CHECKIN_REMINDER,
        title="Check in",
        body="How are you feeling?",
        now_utc=midday,
    )
    assert result == NotificationResult.SENT


# ---------------------------------------------------------------------------
# Quiet hours suppression via service layer
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_quiet_hours_suppresses_notification(
    fake_redis: FakeAsyncRedis, db_session: AsyncSession, org_a: Organization
) -> None:
    user, _ = await create_user(db_session, org_a.id, UserRole.EMPLOYEE, "qh1")
    quiet_time = datetime(2026, 6, 15, 23, 30, tzinfo=UTC)

    result = await send_notification(
        db=db_session,
        redis=fake_redis,
        user_id=user.id,
        org_id=org_a.id,
        category=NotificationCategory.CHECKIN_REMINDER,
        title="Check in",
        body="How are you feeling today?",
        now_utc=quiet_time,
    )
    assert result == NotificationResult.QUIET_HOURS


# ---------------------------------------------------------------------------
# SES stub smoke test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ses_stub_does_not_raise() -> None:
    await send_email_ses_stub(
        email_hash="abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
        subject="Welcome to Mentamind",
        body_preview="Your account is ready.",
    )


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_notifications_empty(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    tokens = await _register_and_onboard(client, db_session, org_a.id)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    resp = await client.get("/me/notifications", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_notifications_blocked_pre_onboarding(
    client: AsyncClient, db_session: AsyncSession, org_a: Organization
) -> None:
    from app.services.auth_service import create_access_token

    user, _ = await create_user(db_session, org_a.id, UserRole.EMPLOYEE, "pre-ob")
    access_token = create_access_token(user.id, user.org_id, user.role.value)
    headers = {"Authorization": f"Bearer {access_token}"}
    resp2 = await client.get("/me/notifications", headers=headers)
    assert resp2.status_code == 403


@pytest.mark.asyncio
async def test_notification_send_and_list(
    client: AsyncClient,
    fake_redis: FakeAsyncRedis,
    db_session: AsyncSession,
    org_a: Organization,
) -> None:
    tokens = await _register_and_onboard(client, db_session, org_a.id)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    me = await client.get("/me", headers=headers)
    user_id = uuid.UUID(me.json()["id"])
    org_id = uuid.UUID(me.json()["org_id"])

    result = await send_notification(
        db=db_session,
        redis=fake_redis,
        user_id=user_id,
        org_id=org_id,
        category=NotificationCategory.WELLNESS_TIP,
        title="Tip of the day",
        body="Take a 5-minute break every hour.",
        now_utc=datetime(2026, 6, 15, 12, 0, tzinfo=UTC),
    )
    assert result == NotificationResult.SENT

    resp = await client.get("/me/notifications", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Tip of the day"
    assert data[0]["body"] == "Take a 5-minute break every hour."
    assert data[0]["is_read"] is False


@pytest.mark.asyncio
async def test_mark_notification_read(
    client: AsyncClient,
    fake_redis: FakeAsyncRedis,
    db_session: AsyncSession,
    org_a: Organization,
) -> None:
    tokens = await _register_and_onboard(client, db_session, org_a.id)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    me = await client.get("/me", headers=headers)
    user_id = uuid.UUID(me.json()["id"])
    org_id = uuid.UUID(me.json()["org_id"])

    await send_notification(
        db=db_session,
        redis=fake_redis,
        user_id=user_id,
        org_id=org_id,
        category=NotificationCategory.CHECKIN_REMINDER,
        title="Check in",
        body="How are you feeling?",
        now_utc=datetime(2026, 6, 15, 10, 0, tzinfo=UTC),
    )

    list_resp = await client.get("/me/notifications", headers=headers)
    notif_id = list_resp.json()[0]["id"]

    read_resp = await client.post(f"/me/notifications/{notif_id}/read", headers=headers)
    assert read_resp.status_code == 200
    assert read_resp.json()["is_read"] is True
    assert read_resp.json()["read_at"] is not None

    unread_resp = await client.get(
        "/me/notifications?unread_only=true", headers=headers
    )
    assert unread_resp.json() == []


@pytest.mark.asyncio
async def test_mark_notification_read_idempotent(
    client: AsyncClient,
    fake_redis: FakeAsyncRedis,
    db_session: AsyncSession,
    org_a: Organization,
) -> None:
    tokens = await _register_and_onboard(client, db_session, org_a.id)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    me = await client.get("/me", headers=headers)
    user_id = uuid.UUID(me.json()["id"])
    org_id = uuid.UUID(me.json()["org_id"])

    await send_notification(
        db=db_session,
        redis=fake_redis,
        user_id=user_id,
        org_id=org_id,
        category=NotificationCategory.WELLNESS_TIP,
        title="Tip",
        body="Rest well.",
        now_utc=datetime(2026, 6, 15, 10, 0, tzinfo=UTC),
    )
    notif_id = (await client.get("/me/notifications", headers=headers)).json()[0]["id"]

    first = await client.post(f"/me/notifications/{notif_id}/read", headers=headers)
    second = await client.post(f"/me/notifications/{notif_id}/read", headers=headers)
    assert first.status_code == 200
    assert second.status_code == 200
    # read_at must not change on second call
    assert first.json()["read_at"] == second.json()["read_at"]


@pytest.mark.asyncio
async def test_mark_notification_read_wrong_org_404(
    client: AsyncClient,
    fake_redis: FakeAsyncRedis,
    db_session: AsyncSession,
    org_a: Organization,
    org_b: Organization,
) -> None:
    """A user from org_b cannot mark a notification that belongs to org_a."""
    tokens_a = await _register_and_onboard(client, db_session, org_a.id)
    tokens_b = await _register_and_onboard(client, db_session, org_b.id)

    me_a = await client.get(
        "/me", headers={"Authorization": f"Bearer {tokens_a['access_token']}"}
    )
    user_a_id = uuid.UUID(me_a.json()["id"])

    await send_notification(
        db=db_session,
        redis=fake_redis,
        user_id=user_a_id,
        org_id=org_a.id,
        category=NotificationCategory.BURNOUT_ALERT,
        title="Alert",
        body="Burnout risk rising.",
        now_utc=datetime(2026, 6, 15, 12, 0, tzinfo=UTC),
    )

    notif_id = (
        await client.get(
            "/me/notifications",
            headers={"Authorization": f"Bearer {tokens_a['access_token']}"},
        )
    ).json()[0]["id"]

    resp = await client.post(
        f"/me/notifications/{notif_id}/read",
        headers={"Authorization": f"Bearer {tokens_b['access_token']}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_notifications_not_visible_cross_org(
    client: AsyncClient,
    fake_redis: FakeAsyncRedis,
    db_session: AsyncSession,
    org_a: Organization,
    org_b: Organization,
) -> None:
    tokens_a = await _register_and_onboard(client, db_session, org_a.id)
    tokens_b = await _register_and_onboard(client, db_session, org_b.id)

    me_a = await client.get(
        "/me", headers={"Authorization": f"Bearer {tokens_a['access_token']}"}
    )
    user_a_id = uuid.UUID(me_a.json()["id"])

    await send_notification(
        db=db_session,
        redis=fake_redis,
        user_id=user_a_id,
        org_id=org_a.id,
        category=NotificationCategory.WELLNESS_TIP,
        title="Only for A",
        body="This is private to org A.",
        now_utc=datetime(2026, 6, 15, 12, 0, tzinfo=UTC),
    )

    resp_b = await client.get(
        "/me/notifications",
        headers={"Authorization": f"Bearer {tokens_b['access_token']}"},
    )
    assert resp_b.status_code == 200
    assert resp_b.json() == []


# ---------------------------------------------------------------------------
# Encryption binding: body_encrypted is tied to the owning user via AAD
# ---------------------------------------------------------------------------


def test_notification_body_decrypt_with_wrong_user_raises() -> None:
    """Decrypting a notification body with a different user_id as AAD must fail.

    This proves the ciphertext is bound to the owning user: copying a
    notification_event row to another user's account does not expose plaintext.
    This is the same guarantee mood_log.context_encrypted provides.
    """
    from app.services.encryption import decrypt, encrypt

    owner_id = uuid.uuid4()
    attacker_id = uuid.uuid4()

    body = "Your burnout risk has increased to HIGH."
    ciphertext = encrypt(body, associated_data=str(owner_id).encode())

    # Round-trip with correct binding succeeds
    assert decrypt(ciphertext, associated_data=str(owner_id).encode()) == body

    # Wrong user_id as AAD must raise InvalidTag (cryptographic proof of binding)
    with pytest.raises(InvalidTag):
        decrypt(ciphertext, associated_data=str(attacker_id).encode())


def test_notification_body_decrypt_without_aad_raises() -> None:
    """Omitting AAD on decrypt must also fail, not silently return garbage."""
    from app.services.encryption import decrypt, encrypt

    user_id = uuid.uuid4()
    ciphertext = encrypt("Sensitive content", associated_data=str(user_id).encode())

    with pytest.raises(InvalidTag):
        decrypt(ciphertext, associated_data=None)


@pytest.mark.asyncio
async def test_notification_body_is_ciphertext_at_rest(
    fake_redis: FakeAsyncRedis,
    db_session: AsyncSession,
    org_a: Organization,
) -> None:
    """The value stored in body_encrypted must not be the plaintext."""
    from sqlalchemy import select

    from app.models.notification_event import NotificationEvent

    user, _ = await create_user(db_session, org_a.id, UserRole.EMPLOYEE, "ciph")
    plaintext = "Take a 5-minute break every hour."
    midday = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)

    result = await send_notification(
        db=db_session,
        redis=fake_redis,
        user_id=user.id,
        org_id=org_a.id,
        category=NotificationCategory.WELLNESS_TIP,
        title="Tip",
        body=plaintext,
        now_utc=midday,
    )
    assert result == NotificationResult.SENT

    row = await db_session.execute(
        select(NotificationEvent).where(NotificationEvent.user_id == user.id)
    )
    event = row.scalar_one()
    assert event.body_encrypted != plaintext
    assert plaintext not in event.body_encrypted
