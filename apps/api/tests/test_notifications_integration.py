"""Integration tests for the notification rate cap against real Redis.

Requires live Postgres and Redis (pytest.mark.integration). FakeAsyncRedis
is single-threaded and cannot verify that the Lua INCR+EXPIRE is atomic
under true concurrent network clients; these tests do.
"""

import asyncio
import os
import uuid
from datetime import UTC, datetime

import pytest
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.notification_event import CATEGORY_RATE_CAP, NotificationCategory
from app.models.organization import DataResidencyRegion, Organization
from app.models.user import User, UserRole
from app.services.auth_service import hash_email, hash_password
from app.services.notification import NotificationResult, send_notification
from app.settings import settings

pytestmark = pytest.mark.integration

_MIDDAY_UTC = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)


# ---------------------------------------------------------------------------
# Fixtures: function-scoped to avoid event-loop mismatch between module-level
# coroutines and per-test coroutines (pytest-asyncio creates a new loop per test)
# ---------------------------------------------------------------------------


@pytest.fixture
async def real_redis() -> aioredis.Redis:
    url = os.getenv("REDIS_URL", settings.redis_url)
    r = aioredis.Redis.from_url(url, decode_responses=True)
    try:
        await r.ping()
    except Exception as exc:
        pytest.skip(f"Redis not reachable at {url!r}: {exc}")
    yield r
    await r.aclose()


@pytest.fixture
async def pg_engine():
    engine = create_async_engine(settings.database_url, echo=False)
    yield engine
    await engine.dispose()


@pytest.fixture
async def pg_session_factory(pg_engine):
    return async_sessionmaker(pg_engine, expire_on_commit=False)


@pytest.fixture
async def pg_session(pg_session_factory) -> AsyncSession:
    async with pg_session_factory() as session:
        yield session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_org_and_user(
    session: AsyncSession, tag: str
) -> tuple[Organization, User]:
    org = Organization(
        name=f"IntegrationOrg-{tag}-{uuid.uuid4()}",
        data_residency_region=DataResidencyRegion.US,
    )
    session.add(org)
    await session.flush()

    user = User(
        org_id=org.id,
        email_hash=hash_email(f"integ-{tag}-{uuid.uuid4()}@example.com"),
        display_name=f"Integration {tag}",
        role=UserRole.EMPLOYEE,
        password_hash=hash_password("IntegPass123!"),
        consent_analytics=True,
        consent_ai_coaching=True,
    )
    session.add(user)
    await session.commit()
    return org, user


# ---------------------------------------------------------------------------
# Integration test: concurrent sends against real Redis
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_rate_cap_atomic_under_concurrency(
    real_redis: aioredis.Redis,
    pg_session: AsyncSession,
    pg_session_factory,
) -> None:
    """cap+10 concurrent callers must produce exactly cap SENT and 10 RATE_LIMITED.

    Each coroutine uses its own DB session; Redis Lua is the coordination point.
    A non-atomic GET+INCR implementation would let multiple coroutines read the
    same pre-increment count and all proceed, breaking this assertion.
    """
    category = NotificationCategory.BURNOUT_ALERT
    cap = CATEGORY_RATE_CAP[category]
    concurrent = cap + 10

    org, user = await _create_org_and_user(pg_session, "conc")

    # Flush the rate cap key so prior test runs do not affect this assertion.
    rate_key = f"notif:rate:{user.id}:{category.value}"
    await real_redis.delete(rate_key)

    async def _attempt() -> NotificationResult:
        async with pg_session_factory() as db:
            return await send_notification(
                db=db,
                redis=real_redis,
                user_id=user.id,
                org_id=org.id,
                category=category,
                title="Concurrency probe",
                body="Testing atomic rate cap under real concurrency.",
                now_utc=_MIDDAY_UTC,
            )

    results = await asyncio.gather(*[_attempt() for _ in range(concurrent)])

    sent = sum(1 for r in results if r == NotificationResult.SENT)
    limited = sum(1 for r in results if r == NotificationResult.RATE_LIMITED)

    assert sent == cap, (
        f"Expected exactly {cap} SENT under concurrency, got {sent}. "
        "This indicates a non-atomic rate cap implementation."
    )
    assert limited == concurrent - cap, (
        f"Expected {concurrent - cap} RATE_LIMITED, got {limited}."
    )

    # Clean up test data so re-runs stay hermetic.
    await real_redis.delete(rate_key)
    await pg_session.delete(org)
    await pg_session.commit()


@pytest.mark.asyncio
async def test_rate_cap_keys_are_per_user(
    real_redis: aioredis.Redis,
    pg_session: AsyncSession,
    pg_session_factory,
) -> None:
    """Two users share the same category but must not share a rate cap bucket."""
    category = NotificationCategory.CHECKIN_REMINDER
    cap = CATEGORY_RATE_CAP[category]

    org, user_a = await _create_org_and_user(pg_session, "pku-a")
    _, user_b = await _create_org_and_user(pg_session, "pku-b")

    for uid in (user_a.id, user_b.id):
        await real_redis.delete(f"notif:rate:{uid}:{category.value}")

    # Exhaust user_a's cap
    for _ in range(cap + 1):
        async with pg_session_factory() as db:
            await send_notification(
                db=db,
                redis=real_redis,
                user_id=user_a.id,
                org_id=org.id,
                category=category,
                title="Reminder",
                body="Check in please.",
                now_utc=_MIDDAY_UTC,
            )

    # user_b's cap must be untouched
    async with pg_session_factory() as db:
        result = await send_notification(
            db=db,
            redis=real_redis,
            user_id=user_b.id,
            org_id=org.id,
            category=category,
            title="Reminder",
            body="Check in please.",
            now_utc=_MIDDAY_UTC,
        )
    assert result == NotificationResult.SENT

    for uid in (user_a.id, user_b.id):
        await real_redis.delete(f"notif:rate:{uid}:{category.value}")
    await pg_session.delete(org)
    await pg_session.commit()
