"""Integration tests for the auth rate limit under real Redis concurrency.

Requires live Redis (pytest.mark.integration). Verifies RATE_CAP_LUA atomicity
on the auth key pattern; FakeAsyncRedis cannot exercise this.
"""

import asyncio
import os
import uuid

import pytest
import redis.asyncio as aioredis

from app.services.redis_client import RATE_CAP_LUA

pytestmark = pytest.mark.integration


@pytest.fixture
async def real_redis() -> aioredis.Redis:
    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    r = aioredis.Redis.from_url(url, decode_responses=True)
    try:
        await r.ping()
    except Exception as exc:
        pytest.skip(f"Redis not reachable at {url!r}: {exc}")
    yield r
    await r.aclose()


@pytest.mark.asyncio
async def test_auth_rate_limit_lua_atomic_under_concurrency(
    real_redis: aioredis.Redis,
) -> None:
    """cap+10 concurrent eval calls must produce exactly cap counts within the cap.

    A non-atomic GET+SET implementation would allow multiple callers to read the
    same pre-increment value and both proceed, breaking this assertion.
    """
    cap = 5
    window_seconds = 900
    concurrent = cap + 10
    key = f"test:ratelimit:auth:login:{uuid.uuid4().hex}"

    await real_redis.delete(key)

    async def _attempt() -> int:
        count = await real_redis.eval(RATE_CAP_LUA, 1, key, window_seconds)
        return int(count)

    counts = await asyncio.gather(*[_attempt() for _ in range(concurrent)])

    within_cap = sum(1 for c in counts if c <= cap)
    over_cap = sum(1 for c in counts if c > cap)

    assert within_cap == cap, (
        f"Expected exactly {cap} calls within the cap, got {within_cap}. "
        "Indicates non-atomic increment under concurrency."
    )
    assert over_cap == concurrent - cap

    await real_redis.delete(key)
